/**
 * KPI Card Pro — Power BI IVisual implementation.
 * Bridges PBI data/lifecycle with the D3 rendering engine.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { KpiCardSettings } from './settings';
import {
  formatWithSettings,
  countUp,
  drawPath,
  fadeSlideIn,
  DURATION,
  applyCardStyle,
  type CardStyleMode,
  renderChartTitle,
  applyChartAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
  buildConditionalConfig,
  resolveConditionalColor,
  resolveDropdown,
  getHostChartColor,
  resolveColorTheme,
  getDateFilterIndices,
  isDateColumn,
  type DateFilterConfig,
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import ISelectionId = powerbi.visuals.ISelectionId;

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
    let step = 'init';
    try {
      step = 'settings';
      this.updateSettings(options);
      step = 'visibility';
      this.updateVisibility();
      step = 'extract';
      const data = this.extractData(options.dataViews?.[0]);
      const customText = this.settings.labelSettings.customText.value;
      if (customText) data.label = customText;
      // Cumulative mode: convert trend to running totals and update value
      if (this.settings.sparklineSettings.cumulative.value && data.trend.length > 0) {
        let runningTotal = 0;
        const cumulativeTrend: number[] = [];
        for (const v of data.trend) {
          runningTotal += v;
          cumulativeTrend.push(runningTotal);
        }
        data.trend = cumulativeTrend;
        data.value = runningTotal;
      }
      step = 'render';
      this.render(data);
    } catch (err) {
      while (this.container.firstChild) this.container.removeChild(this.container.firstChild);
      const errEl = document.createElement('div');
      errEl.style.cssText = 'color:red;font-size:11px;padding:8px;word-break:break-all;';
      errEl.textContent = `[KPI Error @ ${step}] ${err instanceof Error ? err.message : String(err)}`;
      this.container.appendChild(errEl);
    }
  }

  private updateSettings(options: VisualUpdateOptions): void {
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    const settingsView = options.dataViews?.[0];
    if (settingsView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        KpiCardSettings,
        settingsView
      );
    }

    // Migrate legacy enableGlass -> cardStyleMode (backward compat)
    const legacyCardObj = settingsView?.metadata?.objects?.['cardSettings'];
    if (legacyCardObj) {
      const legacyGlass = legacyCardObj['enableGlass'];
      if (legacyGlass === false) {
        this.settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
      }
    }
  }

  private updateVisibility(): void {
    const s = this.settings;
    s.kpiGoalSettings.goalValue.visible = s.kpiGoalSettings.show.value;
    s.kpiGoalSettings.showProgressBar.visible = s.kpiGoalSettings.show.value;
    s.kpiGoalSettings.gradientProgress.visible = s.kpiGoalSettings.show.value && s.kpiGoalSettings.showProgressBar.value;
    s.kpiGoalSettings.metColor.visible = s.kpiGoalSettings.show.value && s.kpiGoalSettings.showProgressBar.value;
    s.kpiGoalSettings.unmetColor.visible = s.kpiGoalSettings.show.value && s.kpiGoalSettings.showProgressBar.value;
    s.kpiComparisonSettings.compareMode.visible = s.kpiComparisonSettings.show.value;
    s.kpiComparisonSettings.showPercentChange.visible = s.kpiComparisonSettings.show.value;
    s.kpiComparisonSettings.fontSize.visible = s.kpiComparisonSettings.show.value;
    s.kpiComparisonSettings.fontColor.visible = s.kpiComparisonSettings.show.value;
    s.sparklineSettings.sparklineType.visible = s.sparklineSettings.show.value;

    s.labelSettings.position.visible = s.labelSettings.show.value;
    s.labelSettings.alignment.visible = s.labelSettings.show.value;
    s.labelSettings.fontSize.visible = s.labelSettings.show.value;
    s.labelSettings.fontColor.visible = s.labelSettings.show.value;
    s.labelSettings.fontFamily.visible = s.labelSettings.show.value;
    s.labelSettings.fontWeight.visible = s.labelSettings.show.value;
    s.labelSettings.customText.visible = s.labelSettings.show.value;
    s.trendSettings.fontSize.visible = s.trendSettings.show.value;
    s.trendSettings.positiveColor.visible = s.trendSettings.show.value;
    s.trendSettings.negativeColor.visible = s.trendSettings.show.value;
    s.trendSettings.neutralColor.visible = s.trendSettings.show.value;
    s.trendSettings.fontFamily.visible = s.trendSettings.show.value;
    s.trendSettings.fontWeight.visible = s.trendSettings.show.value;
    const sparkShow = s.sparklineSettings.show.value;
    const sparkType = resolveDropdown(s.sparklineSettings.sparklineType) ?? 'line';
    const isLineOrArea = sparkType === 'line' || sparkType === 'area';
    s.sparklineSettings.lineColor.visible = sparkShow;
    s.sparklineSettings.fillOpacity.visible = sparkShow && sparkType === 'area';
    s.sparklineSettings.sparklineColor.visible = sparkShow;
    s.sparklineSettings.sparklineWidth.visible = sparkShow && isLineOrArea;
    s.sparklineSettings.dividerColor.visible = sparkShow;
    s.sparklineSettings.showMinMax.visible = sparkShow && isLineOrArea;
    s.sparklineSettings.minColor.visible = sparkShow && isLineOrArea && s.sparklineSettings.showMinMax.value;
    s.sparklineSettings.maxColor.visible = sparkShow && isLineOrArea && s.sparklineSettings.showMinMax.value;
    s.sparklineSettings.cumulative.visible = sparkShow;
    s.sparklineSettings.endpointMarker.visible = sparkShow && isLineOrArea;
    s.animationSettings.duration.visible = s.animationSettings.enabled.value;
    const showCond = s.conditionalFormattingCard.enableConditional.value;
    s.conditionalFormattingCard.conditionalDirection.visible = showCond;
    s.conditionalFormattingCard.threshold1.visible = showCond;
    s.conditionalFormattingCard.threshold2.visible = showCond;
    s.conditionalFormattingCard.conditionalColor1.visible = showCond;
    s.conditionalFormattingCard.conditionalColor2.visible = showCond;
    s.conditionalFormattingCard.conditionalColor3.visible = showCond;
    const showTitle = s.titleFormattingCard.showTitle.value;
    s.titleFormattingCard.titleText.visible = showTitle;
    s.titleFormattingCard.titleFontSize.visible = showTitle;
    s.titleFormattingCard.titleFontColor.visible = showTitle;
    s.titleFormattingCard.titleAlignment.visible = showTitle;
    s.titleFormattingCard.titleFontFamily.visible = showTitle;
    s.titleFormattingCard.titleFontWeight.visible = showTitle;
    s.titleFormattingCard.subtitleText.visible = showTitle;
    s.titleFormattingCard.subtitleFontSize.visible = showTitle;
    s.titleFormattingCard.subtitleFontColor.visible = showTitle;
    s.titleFormattingCard.subtitleFontFamily.visible = showTitle;
    s.titleFormattingCard.subtitleFontWeight.visible = showTitle;
    const cardMode = (resolveDropdown(s.cardSettings.cardStyleMode) ?? 'glass') as CardStyleMode;
    s.cardSettings.backgroundOpacity.visible = cardMode !== 'none';
    s.cardSettings.backgroundColor.visible = cardMode !== 'none';
    s.dateFilterFormattingCard.startDate.visible = s.dateFilterFormattingCard.enableDateFilter.value;
    s.dateFilterFormattingCard.endAtCurrentDate.visible = s.dateFilterFormattingCard.enableDateFilter.value;
    s.dateFilterFormattingCard.endDate.visible = s.dateFilterFormattingCard.enableDateFilter.value && !s.dateFilterFormattingCard.endAtCurrentDate.value;
  }

  /**
   * Extract KPI data from the categorical dataView.
   */
  private extractData(dataView: DataView | undefined): KpiCardData {
    const result: KpiCardData = {
      value: null,
      target: null,
      label: '',
      trend: [],
      trendLabels: [],
      selectionIds: [],
      hasHighlights: false,
      valueHighlighted: false,
    };

    if (!dataView?.categorical) return result;

    return this.extractFromCategorical(dataView.categorical, result);
  }

  private extractFromCategorical(
    categorical: powerbi.DataViewCategorical,
    result: KpiCardData,
  ): KpiCardData {
    const valuesGroup = categorical.values;
    if (!valuesGroup || valuesGroup.length === 0) return result;

    const categoryColumn = categorical.categories?.[0];
    const dateConfig: DateFilterConfig = {
      enabled: this.settings.dateFilterFormattingCard.enableDateFilter.value,
      startDate: this.settings.dateFilterFormattingCard.startDate.value,
      endAtCurrentDate: this.settings.dateFilterFormattingCard.endAtCurrentDate.value,
      endDate: this.settings.dateFilterFormattingCard.endDate.value,
    };
    const dateIndices = categoryColumn && isDateColumn(categoryColumn.source) ? getDateFilterIndices(categoryColumn.values, dateConfig) : null;

    // Find measure and target columns by role
    let measureCol: powerbi.DataViewValueColumn | undefined;
    let targetCol: powerbi.DataViewValueColumn | undefined;
    let trendCol: powerbi.DataViewValueColumn | undefined;

    for (const col of valuesGroup) {
      const roles = col.source.roles;
      if (!roles) continue;
      if (roles['measure'] && !measureCol) measureCol = col;
      if (roles['target'] && !targetCol) targetCol = col;
      if (roles['trendValues'] && !trendCol) trendCol = col;
    }

    if (!measureCol) return result;

    const selectionIds: ISelectionId[] = [];
    if (categoryColumn) {
      for (let i = 0; i < categoryColumn.values.length; i++) {
        selectionIds.push(
          this.host.createSelectionIdBuilder()
            .withCategory(categoryColumn, i)
            .createSelectionId()
        );
      }
    }
    result.selectionIds = selectionIds;

    result.label = measureCol.source.displayName ?? '';

    // Use last value (most recent when grouped by time)
    const vals = measureCol.values;
    const lastVal = vals[vals.length - 1];
    result.value = typeof lastVal === 'number' ? lastVal : 0;

    // Cross-highlight detection: read highlights from the measure column,
    // respecting date filter so highlights outside the filter range are ignored.
    const hlRaw = measureCol.highlights as unknown[] | undefined;
    if (hlRaw) {
      for (let i = 0; i < hlRaw.length; i++) {
        if (dateIndices && !dateIndices.has(i)) continue;
        if (hlRaw[i] !== null && hlRaw[i] !== undefined) {
          result.hasHighlights = true;
          break;
        }
      }
      // Check if the displayed value's highlight is non-null (last in-range row)
      if (hlRaw.length > 0) {
        const lastHl = hlRaw[hlRaw.length - 1];
        result.valueHighlighted = lastHl !== null && lastHl !== undefined;
      }
    }

    // Target
    if (targetCol) {
      const t = targetCol.values[targetCol.values.length - 1];
      result.target = typeof t === 'number' ? t : null;
    }

    // Trend data — use trendValues role if bound, otherwise measure values across categories
    const trendSource = trendCol ?? measureCol;
    if (trendSource.values.length > 1) {
      result.trend = trendSource.values
        .filter((v, i): v is number => typeof v === 'number' && (!dateIndices || dateIndices.has(i)));
    }

    // Category labels for sparkline tooltips
    if (categoryColumn) {
      result.trendLabels = categoryColumn.values
        .filter((_, i) => !dateIndices || dateIndices.has(i))
        .map(v => String(v ?? ''));
    }

    return result;
  }

  private render(data: KpiCardData): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.container.removeEventListener('click', this.handleBackgroundClick);

    const s = this.settings;

    // Apply card style
    const cardMode = (resolveDropdown(s.cardSettings.cardStyleMode) ?? 'glass') as CardStyleMode;
    applyCardStyle(
      this.container,
      {
        mode: cardMode,
        opacity: s.cardSettings.backgroundOpacity.value / 100,
        backgroundColor: s.cardSettings.backgroundColor?.value?.value,
        borderRadius: s.cardSettings.borderRadius.value,
      },
    );
    if (cardMode === 'none') {
      this.container.style.borderRadius = `${s.cardSettings.borderRadius.value}px`;
    }

    // Empty state — no value data
    if (data.value === null) {
      this.renderEmpty();
      this.container.addEventListener('click', this.handleBackgroundClick);
      return;
    }

    // Determine KPI count from layout settings
    const kpiCount = Math.max(1, Math.min(4, parseInt(resolveDropdown(s.cardSettings.kpiCount) ?? '1', 10)));

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
          trendLabels: [],
          selectionIds: [],
          hasHighlights: primaryData.hasHighlights,
          valueHighlighted: primaryData.valueHighlighted,
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

    // Resolve vertical alignment — value setting takes precedence, then label, default top
    const valueVAlign = resolveDropdown(s.valueSettings.verticalAlignment) ?? 'top';
    const labelVAlign = resolveDropdown(s.labelSettings.verticalAlignment) ?? 'top';
    const vAlign = valueVAlign !== 'top' ? valueVAlign : labelVAlign;
    const justifyMap: Record<string, string> = { top: 'flex-start', center: 'center', bottom: 'flex-end' };

    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 6px;
      height: 100%;
      justify-content: ${justifyMap[vAlign] || 'flex-start'};
      position: relative;
      z-index: 1;
    `;
    wrapper.addEventListener('mouseenter', (event) => this.showKpiTooltip(data, event));
    wrapper.addEventListener('mousemove', (event) => this.moveTooltip(event));
    wrapper.addEventListener('mouseleave', () => this.hideTooltip());
    wrapper.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      const selId = data.selectionIds.length > 0 ? data.selectionIds[0] : undefined;
      if (selId) {
        void this.selectionManager.showContextMenu(selId, {
          x: event.clientX,
          y: event.clientY,
        });
      }
    });

    // Label — build it now, insert based on position setting
    let labelEl: HTMLElement | null = null;
    if (s.labelSettings.show.value && data.label) {
      labelEl = document.createElement('div');
      labelEl.className = 'kpi-label';
      labelEl.textContent = data.label;
      labelEl.style.fontSize = `${s.labelSettings.fontSize.value}px`;
      labelEl.style.color = s.labelSettings.fontColor.value?.value || '#64748B';
      const labelFont = resolveDropdown(s.labelSettings.fontFamily);
      if (labelFont) labelEl.style.fontFamily = labelFont;
      const labelWeight = resolveDropdown(s.labelSettings.fontWeight);
      if (labelWeight) labelEl.style.fontWeight = labelWeight;
      const labelAlign = resolveDropdown(s.labelSettings.alignment) ?? 'left';
      labelEl.style.textAlign = labelAlign;
      labelEl.style.width = '100%';
    }

    // Insert label above value if position is 'above'
    const labelPosition = resolveDropdown(s.labelSettings.position) ?? 'above';
    if (labelEl && labelPosition === 'above') {
      wrapper.appendChild(labelEl);
    }

    // Value row
    const valueRow = document.createElement('div');
    valueRow.className = 'kpi-value-row';

    const valueEl = document.createElement('div');
    valueEl.className = 'kpi-value';
    valueEl.style.fontSize = `${s.valueSettings.fontSize.value}px`;
    valueEl.style.color = s.valueSettings.fontColor.value?.value || '#0F172A';
    const valueFont = resolveDropdown(s.valueSettings.fontFamily);
    if (valueFont) valueEl.style.fontFamily = valueFont;
    const valueWeight = resolveDropdown(s.valueSettings.fontWeight);
    if (valueWeight) valueEl.style.fontWeight = valueWeight;
    const valueAlign = resolveDropdown(s.valueSettings.alignment) ?? 'left';
    valueEl.style.textAlign = valueAlign;
    // The value row is display:flex, so text-align alone doesn't center.
    // Apply justify-content to position the value + trend arrow within the row.
    const hAlignMap: Record<string, string> = { left: 'flex-start', center: 'center', right: 'flex-end' };
    valueRow.style.justifyContent = hAlignMap[valueAlign] || 'flex-start';
    valueRow.style.width = '100%';

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

    valueRow.addEventListener('click', (event) => {
      event.stopPropagation();
      if (data.selectionIds.length > 0) {
        void this.selectionManager.select(data.selectionIds, event.ctrlKey || event.metaKey);
      }
    });

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
      trendEl.style.fontSize = `${s.trendSettings.fontSize.value}px`;
      const trendFontFamily = resolveDropdown(s.trendSettings.fontFamily);
      if (trendFontFamily) trendEl.style.fontFamily = trendFontFamily;
      const trendFontWeight = resolveDropdown(s.trendSettings.fontWeight);
      trendEl.style.fontWeight = trendFontWeight || 'normal';
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

    // Insert label below value if position is 'below'
    if (labelEl && labelPosition === 'below') {
      wrapper.appendChild(labelEl);
    }

    // Sparkline
    if (s.sparklineSettings.show.value && data.trend.length > 1) {
      this.renderSparkline(wrapper, data.trend, slotIndex, data.trendLabels);
      // When vertically centered/bottom-aligned, prevent sparkline from consuming
      // all remaining space so justify-content can position the content block.
      if (vAlign !== 'top') {
        const sparkEl = wrapper.querySelector('.kpi-sparkline') as HTMLElement | null;
        if (sparkEl) {
          sparkEl.style.flex = '0 0 auto';
          sparkEl.style.height = '40px';
        }
      }
    }

    // Goal progress bar and comparison
    if (data.value !== null) {
      this.renderGoalProgressBar(wrapper, data.value);
    }
    this.renderComparison(wrapper, data);

    // Entrance animation
    // Skip animation when cross-highlighting is active and this value is dimmed,
    // to avoid overwriting the dimmed opacity (0.3) set by cross-highlight
    if (s.animationSettings.enabled.value && !(data.hasHighlights && !data.valueHighlighted)) {
      const delay = slotIndex * 50;
      const cancel = fadeSlideIn(wrapper, 'up', DURATION.fast, delay);
      this.cancelAnimations.push(cancel);
    }

    // Cross-highlight dimming: dim entire card content if highlights exist but value is not highlighted
    if (data.hasHighlights && !data.valueHighlighted) {
      wrapper.style.opacity = '0.3';
    }

    return wrapper;
  }

  /**
   * Render a sparkline (line, area, or bar) into the given container.
   */
  private renderSparkline(container: HTMLElement, trend: number[], slotIndex: number, trendLabels: string[] = []): void {
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

    container.appendChild(sparkDiv);
    // Use a fixed viewBox height since preserveAspectRatio='none' stretches to fill.
    // clientHeight returns 0 when the element hasn't been laid out yet.
    const viewBoxH = 40;

    const themeName = resolveColorTheme(s.colorThemeFormattingCard);
    const userLineColor = s.sparklineSettings.lineColor.value?.value;
    const lineColor = (userLineColor && userLineColor.length > 0) ? userLineColor : getHostChartColor(this.host.colorPalette, 0, themeName);
    const strokeColor = s.sparklineSettings.sparklineColor.value?.value || lineColor;
    const strokeWidth = s.sparklineSettings.sparklineWidth.value ?? 2;
    const fillOp = (s.sparklineSettings.fillOpacity.value ?? 45) / 100;

    const sparklineType = resolveDropdown(s.sparklineSettings.sparklineType) ?? 'line';
    const gradId = `kpi-spark-grad-${slotIndex}`;

    const svg = d3.select(sparkDiv)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 200 ${viewBoxH}`)
      .attr('preserveAspectRatio', 'none')
      .style('overflow', 'visible');

    const x = d3.scaleLinear()
      .domain([0, trend.length - 1])
      .range([6, 188]);

    const yMin = d3.min(trend) ?? 0;
    const yMax = d3.max(trend) ?? 1;
    const yPad = (yMax - yMin) * 0.15 || 1;
    const yScale = d3.scaleLinear()
      .domain([yMin - yPad, yMax + yPad])
      .range([viewBoxH - 2, 2]);

    let pathEl: d3.Selection<SVGPathElement, number[], null, undefined> | null = null;

    const host = this.host;
    const numberSettings = this.settings.numberFormattingCard;

    if (sparklineType === 'bar') {
      const barWidth = Math.max(1, 200 / trend.length - 1);
      const zeroY = yScale(0);
      const bars = svg.selectAll('rect')
        .data(trend)
        .enter()
        .append('rect')
        .attr('x', (_, i) => x(i) - barWidth / 2)
        .attr('y', (d) => d >= 0 ? yScale(d) : zeroY)
        .attr('width', barWidth)
        .attr('height', (d) => Math.abs(yScale(d) - zeroY))
        .attr('fill', strokeColor)
        .attr('opacity', 0.85);

      bars
        .attr('cursor', 'crosshair')
        .attr('pointer-events', 'all')
        .on('mouseover', function (_event: MouseEvent, d: number) {
          const idx = trend.indexOf(d);
          const label = (idx >= 0 && trendLabels[idx]) ? trendLabels[idx] : `Point ${idx + 1}`;
          host.tooltipService.show({
            dataItems: [{ displayName: label, value: formatWithSettings(d, numberSettings) }],
            identities: [],
            coordinates: [_event.clientX, _event.clientY],
            isTouchEvent: false,
          });
        })
        .on('mousemove', function (_event: MouseEvent) {
          host.tooltipService.move({
            dataItems: [],
            identities: [],
            coordinates: [_event.clientX, _event.clientY],
            isTouchEvent: false,
          });
        })
        .on('mouseout', function () {
          host.tooltipService.hide({ immediately: true, isTouchEvent: false });
        });
    } else {
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
          .y0(viewBoxH)
          .y1((d) => yScale(d))
          .curve(d3.curveMonotoneX);

        svg.append('path')
          .datum(trend)
          .attr('d', area)
          .attr('fill', `url(#${gradId})`);
      }

      // Resolve marker type before drawing the line so we can pull back the
      // last point when using the triangle arrowhead.
      const lastIdx = trend.length - 1;
      const markerType = resolveDropdown(s.sparklineSettings.endpointMarker) ?? 'circle';
      const endX = x(lastIdx);
      const endY = yScale(trend[lastIdx]);

      // For triangle marker, compute pullback so the line ends at the
      // arrowhead base instead of poking past the tip.
      let linePullbackX = 0;
      let linePullbackY = 0;
      let triAngle = 0;
      const triSize = 6;
      if (markerType === 'triangle' && lastIdx > 0) {
        const prevX = x(lastIdx - 1);
        const prevY = yScale(trend[lastIdx - 1]);
        triAngle = Math.atan2(endY - prevY, endX - prevX);
        linePullbackX = triSize * Math.cos(triAngle);
        linePullbackY = triSize * Math.sin(triAngle);
      }

      const line = d3.line<number>()
        .x((_, i) => i === lastIdx && linePullbackX !== 0 ? x(i) - linePullbackX : x(i))
        .y((d, i) => i === lastIdx && linePullbackY !== 0 ? yScale(d) - linePullbackY : yScale(d))
        .curve(d3.curveMonotoneX);

      pathEl = svg.append('path')
        .datum(trend)
        .attr('d', line)
        .attr('fill', 'none')
        .attr('stroke', strokeColor)
        .attr('stroke-width', strokeWidth)
        .attr('stroke-linecap', 'round');

      // Endpoint marker
      if (markerType === 'circle') {
        svg.append('circle')
          .attr('cx', endX)
          .attr('cy', endY)
          .attr('r', 3)
          .attr('fill', strokeColor);
      } else if (markerType === 'triangle') {
        // Arrowhead that follows the line's angle at the endpoint
        const wingAngle = 0.45; // ~26° spread from line direction
        // Tip is at the endpoint; two wing points behind
        const wing1X = endX - triSize * Math.cos(triAngle - wingAngle);
        const wing1Y = endY - triSize * Math.sin(triAngle - wingAngle);
        const wing2X = endX - triSize * Math.cos(triAngle + wingAngle);
        const wing2Y = endY - triSize * Math.sin(triAngle + wingAngle);
        svg.append('polygon')
          .attr('points', `${endX},${endY} ${wing1X},${wing1Y} ${wing2X},${wing2Y}`)
          .attr('fill', strokeColor);
      } else if (markerType === 'diamond') {
        const size = 4;
        svg.append('polygon')
          .attr('points', `${endX},${endY - size} ${endX + size},${endY} ${endX},${endY + size} ${endX - size},${endY}`)
          .attr('fill', strokeColor);
      }
      // 'none' — no marker rendered

      // Min/Max markers
      if (s.sparklineSettings.showMinMax.value) {
        const minVal = d3.min(trend)!;
        const maxVal = d3.max(trend)!;
        const minMarkerColor = s.sparklineSettings.minColor.value?.value || '#F87171';
        const maxMarkerColor = s.sparklineSettings.maxColor.value?.value || '#34D399';
        if (minVal !== maxVal) {
          const minIdx = trend.indexOf(minVal);
          const maxIdx = trend.indexOf(maxVal);
          if (minIdx !== lastIdx) {
            svg.append('circle')
              .attr('cx', x(minIdx))
              .attr('cy', yScale(trend[minIdx]))
              .attr('r', 3)
              .attr('fill', minMarkerColor);
          }
          if (maxIdx !== lastIdx) {
            svg.append('circle')
              .attr('cx', x(maxIdx))
              .attr('cy', yScale(trend[maxIdx]))
              .attr('r', 3)
              .attr('fill', maxMarkerColor);
          }
        }
      }

      // Hover circles for tooltips
      for (let i = 0; i < trend.length; i++) {
        const cx = x(i);
        const cy = yScale(trend[i]);
        const val = trend[i];
        const pointIdx = i;
        svg.append('circle')
          .attr('cx', cx)
          .attr('cy', cy)
          .attr('r', 8)
          .attr('fill', 'transparent')
          .attr('pointer-events', 'all')
          .attr('cursor', 'crosshair')
          .on('mouseover', function (_event: MouseEvent) {
            const label = trendLabels[pointIdx] || `Point ${pointIdx + 1}`;
            host.tooltipService.show({
              dataItems: [{ displayName: label, value: formatWithSettings(val, numberSettings) }],
              identities: [],
              coordinates: [_event.clientX, _event.clientY],
              isTouchEvent: false,
            });
          })
          .on('mousemove', function (_event: MouseEvent) {
            host.tooltipService.move({
              dataItems: [],
              identities: [],
              coordinates: [_event.clientX, _event.clientY],
              isTouchEvent: false,
            });
          })
          .on('mouseout', function () {
            host.tooltipService.hide({ immediately: true, isTouchEvent: false });
          });
      }
    }

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

  // Render lifecycle notifications removed — Power BI's eventService.renderingStarted()
  // requires VisualUpdateOptions with updateId, and calling without args crashes the visual.

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

    let barColor: string;
    if (goalSettings.gradientProgress.value) {
      if (progress >= 100) {
        barColor = goalSettings.metColor.value?.value || '#22C55E';
      } else {
        const colorScale = d3.scaleLinear<string>()
          .domain([0, 50, 100])
          .range([
            goalSettings.unmetColor.value?.value || '#3B82F6',
            '#F59E0B',
            goalSettings.metColor.value?.value || '#22C55E',
          ]);
        barColor = colorScale(Math.min(progress, 100));
      }
    } else {
      barColor = progress >= 100
        ? (goalSettings.metColor.value?.value || '#22C55E')
        : (goalSettings.unmetColor.value?.value || '#3B82F6');
    }

    const barFill = document.createElement('div');
    barFill.className = 'kpi-goal-bar-fill';
    barFill.style.cssText = `
      width: ${progress}%;
      height: 100%;
      background: ${barColor};
      border-radius: 3px;
      transition: width 0.3s ease;
    `;

    barContainer.appendChild(barFill);
    wrapper.appendChild(barContainer);

    // Goal text
    if (goalSettings.showGoalText.value) {
      const goalText = document.createElement('div');
      goalText.className = 'kpi-goal-text';
      const alignment = resolveDropdown(goalSettings.goalTextAlignment) ?? 'center';
      goalText.style.cssText = `
        width: 100%;
        text-align: ${alignment};
        font-size: 11px;
        color: #64748B;
        margin-top: 2px;
      `;
      goalText.textContent = `${Math.round(progress)}% of Goal`;
      wrapper.appendChild(goalText);
    }
  }

  // -- Comparison Rendering ---------------------------------------------------

  private renderComparison(wrapper: HTMLElement, data: KpiCardData): void {
    const comparison = this.settings.kpiComparisonSettings;
    if (!comparison.show.value || data.value === null) return;

    const mode = resolveDropdown(comparison.compareMode) ?? 'target';

    let delta: number | null = null;
    let baseValue: number | null = null;
    let vsLabel = 'vs target';

    if (mode === 'previous') {
      if (data.trend.length >= 2) {
        const current = data.trend[data.trend.length - 1];
        const previous = data.trend[data.trend.length - 2];
        delta = current - previous;
        baseValue = previous;
        vsLabel = 'vs prev period';
      }
    } else if (mode === 'first') {
      if (data.trend.length >= 1) {
        const current = data.trend[data.trend.length - 1];
        const first = data.trend[0];
        delta = current - first;
        baseValue = first;
        vsLabel = 'vs first period';
      }
    } else {
      if (data.target === null) return;
      delta = data.value - data.target;
      baseValue = data.target;
      vsLabel = 'vs target';
    }

    if (delta === null) return;

    const compEl = document.createElement('div');
    compEl.className = 'kpi-comparison';
    compEl.style.cssText = `
      display: flex;
      align-items: center;
      gap: 4px;
    `;
    compEl.style.fontSize = `${comparison.fontSize.value}px`;
    compEl.style.color = comparison.fontColor.value?.value || '#64748B';

    if (comparison.showPercentChange.value && baseValue !== null && baseValue !== 0) {
      const pct = ((delta / Math.abs(baseValue)) * 100).toFixed(1);
      const sign = delta >= 0 ? '+' : '';
      compEl.textContent = `${sign}${pct}% ${vsLabel}`;
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
  trendLabels: string[];
  selectionIds: ISelectionId[];
  /** Whether cross-highlight data is present from another visual/slicer */
  hasHighlights: boolean;
  /** Whether the value is highlighted (non-null highlight on the measure) */
  valueHighlighted: boolean;
}
