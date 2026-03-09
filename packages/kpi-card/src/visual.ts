/**
 * KPI Card Pro — Power BI IVisual implementation.
 * Bridges PBI data/lifecycle with the D3 rendering engine.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { KpiCardSettings } from './settings';
import {
  formatNumber,
  formatWithSettings,
  countUp,
  drawPath,
  fadeSlideIn,
  DURATION,
  getGlassStyle,
  renderChartTitle,
  applyChartAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
  buildConditionalConfig,
  resolveConditionalColor,
  resolveDropdown,
  getHostChartColor,
  resolveColorTheme,
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import '../style/visual.less';

export class KpiCardVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: KpiCardSettings;
  private formattingSettingsService: FormattingSettingsService;
  private previousValue: number | null = null;
  private cancelAnimations: Array<() => void> = [];

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new KpiCardSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('kpi-card-container');
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel any running animations
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Parse settings from the first available dataView
    const dataViews = options.dataViews;
    const settingsView = dataViews?.[0];
    if (settingsView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        KpiCardSettings,
        settingsView
      );
    }

    // Conditional visibility: hide child settings when parent toggle is off
    const s = this.settings;
    s.kpiGoalSettings.goalValue.visible = s.kpiGoalSettings.show.value;
    s.kpiGoalSettings.showProgressBar.visible = s.kpiGoalSettings.show.value;
    s.kpiGoalSettings.metColor.visible = s.kpiGoalSettings.show.value;
    s.kpiGoalSettings.unmetColor.visible = s.kpiGoalSettings.show.value;
    s.kpiComparisonSettings.showPercentChange.visible = s.kpiComparisonSettings.show.value;
    s.kpiLayoutSettings.sparklineType.visible = s.sparklineSettings.show.value;
    s.sparklineSettings.lineColor.visible = s.sparklineSettings.show.value;

    // Extract data from the table dataView
    const data = this.extractData(dataViews?.[0]);

    // Apply custom text override for label
    const customText = this.settings.labelSettings.customText.value;
    if (customText) data.label = customText;

    this.notifyRenderStarted();
    try {
      this.render(data, options.viewport);
      this.notifyRenderFinished();
    } catch (error) {
      this.notifyRenderFailed(error);
      throw error;
    }
  }

  /**
   * Extract KPI data from a table dataView.
   * Table mapping always produces a dataView regardless of which roles are bound,
   * eliminating the crash caused by dual categorical mappings.
   */
  private extractData(dataView: DataView | undefined): KpiCardData {
    const result: KpiCardData = {
      value: null,
      target: null,
      label: '',
      trend: [],
    };

    if (!dataView?.table) return result;

    const table = dataView.table;
    const columns = table.columns;
    const rows = table.rows;

    if (!columns || !rows || rows.length === 0) return result;

    // Find column indices by role
    let measureIdx = -1;
    let targetIdx = -1;
    let trendValuesIdx = -1;

    for (let i = 0; i < columns.length; i++) {
      const roles = columns[i].roles;
      if (!roles) continue;
      if (roles['measure']) measureIdx = i;
      if (roles['target']) targetIdx = i;
      if (roles['trendValues']) trendValuesIdx = i;
    }

    // Need at least a measure to show anything
    if (measureIdx < 0) return result;

    // Label from measure display name
    result.label = columns[measureIdx].displayName ?? '';

    // Last row contains the most recent value (matches original categorical behavior)
    const lastRow = rows[rows.length - 1];

    // Main KPI value
    const val = lastRow[measureIdx];
    result.value = typeof val === 'number' ? val : null;

    // Target value
    if (targetIdx >= 0) {
      const t = lastRow[targetIdx];
      result.target = typeof t === 'number' ? t : null;
    }

    // Trend data for sparkline (only when multiple rows = grouping is active)
    if (rows.length > 1) {
      // Use trendValues role if bound, otherwise use measure values across rows
      const trendIdx = trendValuesIdx >= 0 ? trendValuesIdx : measureIdx;
      result.trend = rows
        .map((row) => row[trendIdx])
        .filter((v): v is number => typeof v === 'number');
    }

    return result;
  }

  private render(data: KpiCardData, viewport: powerbi.IViewport): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.container.removeEventListener('click', this.handleBackgroundClick);

    const s = this.settings;

    // Apply glass effect if enabled
    if (s.cardSettings.enableGlass.value) {
      const glass = getGlassStyle({
        mode: 'light',
        opacity: s.cardSettings.backgroundOpacity.value / 100,
        backgroundColor: s.cardSettings.backgroundColor?.value?.value,
        borderRadius: s.cardSettings.borderRadius.value,
      });
      Object.assign(this.container.style, glass);
    } else {
      this.container.style.background = '';
      this.container.style.backdropFilter = '';
      (this.container.style as unknown as Record<string, string>).WebkitBackdropFilter = '';
      this.container.style.border = '';
      this.container.style.boxShadow = '';
      this.container.style.borderRadius = `${s.cardSettings.borderRadius.value}px`;
    }

    // Empty state — no value data
    if (data.value === null) {
      this.renderEmpty();
      this.container.addEventListener('click', this.handleBackgroundClick);
      return;
    }

    // Determine KPI count from layout settings
    const kpiCount = Math.max(1, Math.min(4, parseInt(resolveDropdown(s.kpiLayoutSettings.kpiCount) ?? '1', 10)));

    if (kpiCount === 1) {
      // Single KPI — original behavior
      const wrapper = this.renderSingleKpi(data, 0);
      this.container.appendChild(wrapper);
    } else {
      // Multi-KPI grid layout
      const grid = document.createElement('div');
      grid.className = 'kpi-grid';
      const gridRows = kpiCount <= 2 ? 1 : 2;
      grid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        grid-template-rows: repeat(${gridRows}, 1fr);
        gap: 8px;
        width: 100%;
        height: 100%;
      `;

      // Build KPI data for each slot from trend data
      const kpiDataSlots = this.buildMultiKpiData(data, kpiCount);
      for (let i = 0; i < kpiCount; i++) {
        const slotData = kpiDataSlots[i];
        if (slotData !== undefined) {
          const cell = this.renderSingleKpi(slotData, i);
          cell.style.borderRadius = `${s.cardSettings.borderRadius.value}px`;
          cell.style.border = '1px solid rgba(0,0,0,0.06)';
          cell.style.padding = '8px';
          cell.style.overflow = 'hidden';
          grid.appendChild(cell);
        } else {
          // Placeholder for empty KPI slot
          const placeholder = document.createElement('div');
          placeholder.className = 'kpi-slot-empty';
          placeholder.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            color: #94A3B8;
            font-style: italic;
            border-radius: ${s.cardSettings.borderRadius.value}px;
            border: 1px dashed rgba(0,0,0,0.1);
            padding: 8px;
          `;
          placeholder.textContent = 'No data';
          grid.appendChild(placeholder);
        }
      }

      this.container.appendChild(grid);
    }

    this.applyAccessibility();
    this.container.addEventListener('click', this.handleBackgroundClick);
  }

  /**
   * Build an array of KpiCardData for multi-KPI grid slots.
   * The first slot always uses the primary data. Additional slots
   * are derived from trend data points (using chunks of the trend array).
   */
  private buildMultiKpiData(primaryData: KpiCardData, count: number): Array<KpiCardData | undefined> {
    const results: Array<KpiCardData | undefined> = [];

    // First slot is always the primary KPI
    results.push(primaryData);

    if (count <= 1) return results;

    // For additional slots, partition trend data to create secondary KPI values.
    // Each additional slot gets a value from evenly-spaced trend data points.
    const trend = primaryData.trend;
    if (trend.length === 0) {
      // No trend data — fill remaining slots as empty
      for (let i = 1; i < count; i++) {
        results.push(undefined);
      }
      return results;
    }

    // Pick evenly-spaced values from trend for additional KPIs
    const additionalCount = count - 1;
    for (let i = 0; i < additionalCount; i++) {
      // Map slot index to a trend data point
      const trendIdx = Math.round((i / additionalCount) * (trend.length - 1));
      const val = trend[trendIdx];
      if (val === undefined) {
        results.push(undefined);
      } else {
        results.push({
          value: val,
          target: primaryData.target,
          label: `${primaryData.label} (${trendIdx + 1})`,
          trend: [], // secondary slots do not get their own sparkline data
        });
      }
    }

    return results;
  }

  /**
   * Render a single KPI cell (value, label, trend arrow, sparkline, progress bar, comparison).
   * Used both for single-KPI mode and for each cell in the multi-KPI grid.
   */
  private renderSingleKpi(data: KpiCardData, slotIndex: number): HTMLElement {
    const s = this.settings;

    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 6px;
      height: 100%;
      justify-content: center;
    `;
    wrapper.addEventListener('mouseenter', (event) => this.showKpiTooltip(data, event));
    wrapper.addEventListener('mousemove', (event) => this.moveTooltip(event));
    wrapper.addEventListener('mouseleave', () => this.hideTooltip());

    // Label
    if (s.labelSettings.show.value && data.label) {
      const label = document.createElement('div');
      label.className = 'kpi-label';
      label.textContent = data.label;
      label.style.fontSize = `${s.labelSettings.fontSize.value}px`;
      label.style.color = s.labelSettings.fontColor.value?.value || '#64748B';
      wrapper.appendChild(label);
    }

    // Value row
    const valueRow = document.createElement('div');
    valueRow.className = 'kpi-value-row';

    const valueEl = document.createElement('div');
    valueEl.className = 'kpi-value';
    valueEl.style.fontSize = `${s.valueSettings.fontSize.value}px`;
    valueEl.style.color = s.valueSettings.fontColor.value?.value || '#0F172A';

    // Shared conditional formatting card — overrides font color if enabled
    if (data.value !== null) {
      const sharedColor = this.getConditionalColor(data.value);
      if (sharedColor) {
        valueEl.style.color = sharedColor;
      }
    }

    // Format function — guards against null/undefined values
    const fmt = (v: number | null | undefined): string => {
      if (v === null || v === undefined) return '\u2014';
      return formatWithSettings(v, this.settings.numberFormattingCard);
    };
    // Count-up animation (only for the primary KPI slot)
    if (data.value !== null && s.animationSettings.enabled.value && slotIndex === 0) {
      const from = this.previousValue ?? 0;
      valueEl.textContent = fmt(from);
      const cancel = countUp(
        from,
        data.value,
        s.animationSettings.duration.value,
        (v) => { valueEl.textContent = fmt(v); }
      );
      this.cancelAnimations.push(cancel);
      this.previousValue = data.value;
    } else {
      valueEl.textContent = fmt(data.value);
      if (slotIndex === 0) {
        this.previousValue = data.value;
      }
    }

    valueRow.appendChild(valueEl);

    // Trend arrow
    if (s.trendSettings.show.value && data.target !== null && data.value !== null) {
      const delta = data.value - data.target;
      const colors = {
        positive: s.trendSettings.positiveColor.value?.value ?? '#34D399',
        negative: s.trendSettings.negativeColor.value?.value ?? '#F87171',
        neutral: s.trendSettings.neutralColor.value?.value ?? '#94A3B8',
      };
      const color = delta > 0 ? colors.positive : delta < 0 ? colors.negative : colors.neutral;
      const arrow = delta > 0 ? '\u25B2' : delta < 0 ? '\u25BC' : '\u2014';

      const trendEl = document.createElement('div');
      trendEl.className = 'kpi-trend';
      trendEl.style.color = color;
      const arrowSpan = document.createElement('span');
      arrowSpan.className = 'kpi-trend-arrow';
      arrowSpan.textContent = arrow;
      trendEl.appendChild(arrowSpan);
      const deltaSpan = document.createElement('span');
      deltaSpan.textContent = formatWithSettings(Math.abs(delta), this.settings.numberFormattingCard);
      trendEl.appendChild(deltaSpan);
      valueRow.appendChild(trendEl);
    }

    wrapper.appendChild(valueRow);

    // Sparkline
    if (s.sparklineSettings.show.value && data.trend.length > 1) {
      this.renderSparkline(wrapper, data.trend, slotIndex);
    }

    // Goal progress bar and comparison
    if (data.value !== null) {
      this.renderGoalProgressBar(wrapper, data.value);
    }
    this.renderComparison(wrapper, data);

    // Entrance animation
    if (s.animationSettings.enabled.value) {
      const delay = slotIndex * 50;
      const cancel = fadeSlideIn(wrapper, 'up', DURATION.fast, delay);
      this.cancelAnimations.push(cancel);
    }

    return wrapper;
  }

  /**
   * Render a sparkline (line, area, or bar) into the given container.
   */
  private renderSparkline(container: HTMLElement, trend: number[], slotIndex: number): void {
    const s = this.settings;

    // Divider between value row and sparkline
    const divColor = s.sparklineSettings.dividerColor.value?.value;
    if (divColor) {
      const divider = document.createElement('hr');
      divider.className = 'kpi-divider';
      divider.style.borderColor = divColor;
      container.appendChild(divider);
    }

    const sparkDiv = document.createElement('div');
    sparkDiv.className = 'kpi-sparkline';

    const themeName = resolveColorTheme(s.colorThemeFormattingCard);
    const userLineColor = s.sparklineSettings.lineColor.value?.value;
    const lineColor = (userLineColor && userLineColor.length > 0) ? userLineColor : getHostChartColor(this.host.colorPalette, 0, themeName);
    const strokeColor = s.sparklineSettings.sparklineColor.value?.value || lineColor;
    const strokeWidth = s.sparklineSettings.sparklineWidth.value ?? 2;
    const fillOp = (s.sparklineSettings.fillOpacity.value ?? 45) / 100;

    const sparklineType = resolveDropdown(s.kpiLayoutSettings.sparklineType) ?? 'line';
    // Use a unique gradient ID per slot to avoid SVG ID collisions in multi-KPI grid
    const gradId = `kpi-spark-grad-${slotIndex}`;

    const svg = d3.select(sparkDiv)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', '0 0 200 32')
      .attr('preserveAspectRatio', 'none');

    const x = d3.scaleLinear()
      .domain([0, trend.length - 1])
      .range([0, 200]);

    const yMin = d3.min(trend) ?? 0;
    const yMax = d3.max(trend) ?? 1;
    const yPad = (yMax - yMin) * 0.15 || 1;
    const yScale = d3.scaleLinear()
      .domain([yMin - yPad, yMax + yPad])
      .range([30, 2]);

    let pathEl: d3.Selection<SVGPathElement, number[], null, undefined> | null = null;

    if (sparklineType === 'bar') {
      // Bar sparkline
      const barWidth = Math.max(1, 200 / trend.length - 1);
      svg.selectAll('rect')
        .data(trend)
        .enter()
        .append('rect')
        .attr('x', (_, i) => x(i) - barWidth / 2)
        .attr('y', (d) => yScale(d))
        .attr('width', barWidth)
        .attr('height', (d) => 32 - yScale(d))
        .attr('fill', strokeColor)
        .attr('opacity', 0.85);
    } else {
      // Line or Area sparkline
      // Gradient fill
      const defs = svg.append('defs');
      const grad = defs.append('linearGradient')
        .attr('id', gradId)
        .attr('x1', '0%').attr('y1', '0%')
        .attr('x2', '0%').attr('y2', '100%');
      grad.append('stop').attr('offset', '0%')
        .attr('stop-color', lineColor).attr('stop-opacity', fillOp);
      grad.append('stop').attr('offset', '100%')
        .attr('stop-color', lineColor).attr('stop-opacity', 0.05);

      if (sparklineType === 'area') {
        const area = d3.area<number>()
          .x((_, i) => x(i))
          .y0(32)
          .y1((d) => yScale(d))
          .curve(d3.curveMonotoneX);

        svg.append('path')
          .datum(trend)
          .attr('d', area)
          .attr('fill', `url(#${gradId})`);
      }

      const line = d3.line<number>()
        .x((_, i) => x(i))
        .y((d) => yScale(d))
        .curve(d3.curveMonotoneX);

      pathEl = svg.append('path')
        .datum(trend)
        .attr('d', line)
        .attr('fill', 'none')
        .attr('stroke', strokeColor)
        .attr('stroke-width', strokeWidth)
        .attr('stroke-linecap', 'round');

      // End dot
      const lastIdx = trend.length - 1;
      svg.append('circle')
        .attr('cx', x(lastIdx))
        .attr('cy', yScale(trend[lastIdx]))
        .attr('r', 3)
        .attr('fill', strokeColor);
    }

    container.appendChild(sparkDiv);

    // Draw animation (line/area only)
    if (s.animationSettings.enabled.value && pathEl) {
      const animPathEl = pathEl;
      requestAnimationFrame(() => {
        const node = animPathEl.node();
        if (node) {
          const cancel = drawPath(node, s.animationSettings.duration.value, 200);
          this.cancelAnimations.push(cancel);
        }
      });
    }
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private showKpiTooltip(data: KpiCardData, event: MouseEvent): void {
    if (data.value === null) return;
    const locale = this.getHostLocale();
    const numberSettings = this.settings.numberFormattingCard;
    const tooltipData: VisualTooltipDataItem[] = [
      { displayName: data.label || 'KPI', value: formatWithSettings(data.value as number, numberSettings) },
    ];
    if (data.target !== null) {
      tooltipData.push({
        displayName: 'Target',
        value: formatWithSettings(data.target, numberSettings),
      });
      tooltipData.push({
        displayName: 'Delta',
        value: formatWithSettings(data.value - data.target, numberSettings),
      });
    }

    this.host.tooltipService.show({
      dataItems: tooltipData,
      identities: [],
      coordinates: [event.clientX, event.clientY],
      isTouchEvent: false,
    });
  }

  private moveTooltip(event: MouseEvent): void {
    this.host.tooltipService.move({
      dataItems: [],
      identities: [],
      coordinates: [event.clientX, event.clientY],
      isTouchEvent: false,
    });
  }

  private hideTooltip(): void {
    this.host.tooltipService.hide({ immediately: true, isTouchEvent: false });
  }

  private getHostLocale(): string | undefined {
    const locale = (this.host as unknown as { locale?: unknown }).locale;
    return typeof locale === 'string' && locale.length > 0 ? locale : undefined;
  }

  private notifyRenderStarted(): void {
    const eventService = (this.host as unknown as {
      eventService?: { renderingStarted?: () => void };
    }).eventService;
    eventService?.renderingStarted?.();
  }

  private notifyRenderFinished(): void {
    const eventService = (this.host as unknown as {
      eventService?: { renderingFinished?: () => void };
    }).eventService;
    eventService?.renderingFinished?.();
  }

  private notifyRenderFailed(error: unknown): void {
    const eventService = (this.host as unknown as {
      eventService?: { renderingFailed?: (reason: string) => void };
    }).eventService;
    const reason = error instanceof Error ? error.message : 'render failure';
    eventService?.renderingFailed?.(reason);
  }

  private renderEmpty(): void {
    const el = document.createElement('div');
    el.className = 'kpi-empty';
    el.textContent = 'Add a measure to the Value field to see KPI data.';
    this.container.appendChild(el);
  }

  private handleBackgroundClick = (): void => {
    void this.selectionManager.clear();
  };

  // -- Goal / Target Progress Bar ---------------------------------------------

  private renderGoalProgressBar(wrapper: HTMLElement, value: number): void {
    const goalSettings = this.settings.kpiGoalSettings;
    if (!goalSettings.show.value || !goalSettings.showProgressBar.value) return;

    const goalValue = goalSettings.goalValue.value;
    if (goalValue <= 0) return;

    const progress = Math.min(100, Math.max(0, (value / goalValue) * 100));

    const barContainer = document.createElement('div');
    barContainer.className = 'kpi-goal-bar-container';
    barContainer.style.cssText = `
      width: 100%;
      height: 6px;
      background: rgba(0,0,0,0.1);
      border-radius: 3px;
      overflow: hidden;
    `;

    const barFill = document.createElement('div');
    barFill.className = 'kpi-goal-bar-fill';
    barFill.style.cssText = `
      width: ${progress}%;
      height: 100%;
      background: ${progress >= 100
        ? (goalSettings.metColor.value?.value || '#22C55E')
        : (goalSettings.unmetColor.value?.value || '#3B82F6')};
      border-radius: 3px;
      transition: width 0.3s ease;
    `;

    barContainer.appendChild(barFill);
    wrapper.appendChild(barContainer);
  }

  // -- Comparison Rendering ---------------------------------------------------

  private renderComparison(wrapper: HTMLElement, data: KpiCardData): void {
    const comparison = this.settings.kpiComparisonSettings;
    if (!comparison.show.value || data.value === null || data.target === null) return;

    const delta = data.value - data.target;
    const compEl = document.createElement('div');
    compEl.className = 'kpi-comparison';
    compEl.style.cssText = `
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: #64748B;
    `;

    if (comparison.showPercentChange.value && data.target !== 0) {
      const pct = ((delta / Math.abs(data.target)) * 100).toFixed(1);
      const sign = delta >= 0 ? '+' : '';
      compEl.textContent = `${sign}${pct}% vs target`;
    } else {
      compEl.textContent = `Delta: ${formatWithSettings(delta, this.settings.numberFormattingCard)}`;
    }

    wrapper.appendChild(compEl);
  }

  // -- Shared Conditional Formatting ------------------------------------------

  private getConditionalColor(value: number): string | undefined {
    const cc = this.settings.conditionalFormattingCard;
    if (!cc.enableConditional.value) return undefined;
    const config = buildConditionalConfig(
      true,
      resolveDropdown(cc.conditionalDirection),
      cc.threshold1.value,
      cc.threshold2.value,
      cc.conditionalColor1.value?.value,
      cc.conditionalColor2.value?.value,
      cc.conditionalColor3.value?.value,
    );
    return resolveConditionalColor(value, config);
  }

  // -- Accessibility ----------------------------------------------------------

  private applyAccessibility(): void {
    const a11y = this.settings.accessibilityFormattingCard;
    if (!a11y.enableKeyboardNav.value) return;
    ensureFocusRingStyles();
    applyChartAria(this.container, {
      chartType: 'KPI card',
      title: this.settings.titleFormattingCard?.titleText?.value || undefined,
      dataPointCount: 1,
    });
    const cleanup = attachKeyboardNav({
      container: this.container,
      itemSelector: '.kpi-value-row',
      onActivate: (el) => (el as HTMLElement).click?.(),
    });
    this.cancelAnimations.push(cleanup);
  }

  public destroy(): void {
    this.hideTooltip();
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
  }
}

interface KpiCardData {
  value: number | null;
  target: number | null;
  label: string;
  trend: number[];
}
