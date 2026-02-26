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
  countUp,
  drawPath,
  fadeSlideIn,
  DURATION,
  getGlassStyle,
  renderChartTitle,
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

    // Build DOM
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

    // Format function
    const fmt = (v: number | null | undefined): string => {
      return formatNumber(v, {
        prefix: s.valueSettings.prefix.value,
        suffix: s.valueSettings.suffix.value,
        decimals: s.valueSettings.decimalPlaces.value,
        abbreviate: true,
      });
    };
    // Count-up animation
    if (data.value !== null && s.animationSettings.enabled.value) {
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
      this.previousValue = data.value;
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
      deltaSpan.textContent = formatNumber(Math.abs(delta), { abbreviate: false });
      trendEl.appendChild(deltaSpan);
      valueRow.appendChild(trendEl);
    }

    wrapper.appendChild(valueRow);

    // Sparkline
    if (s.sparklineSettings.show.value && data.trend.length > 1) {
      // Divider between value row and sparkline
      const divColor = s.sparklineSettings.dividerColor.value?.value;
      if (divColor) {
        const divider = document.createElement('hr');
        divider.className = 'kpi-divider';
        divider.style.borderColor = divColor;
        wrapper.appendChild(divider);
      }

      const sparkDiv = document.createElement('div');
      sparkDiv.className = 'kpi-sparkline';

      const lineColor = s.sparklineSettings.lineColor.value?.value ?? '#3B82F6';
      const strokeColor = s.sparklineSettings.sparklineColor.value?.value || lineColor;
      const strokeWidth = s.sparklineSettings.sparklineWidth.value ?? 2;
      const fillOp = (s.sparklineSettings.fillOpacity.value ?? 45) / 100;

      const svg = d3.select(sparkDiv)
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', '0 0 200 32')
        .attr('preserveAspectRatio', 'none');

      const x = d3.scaleLinear()
        .domain([0, data.trend.length - 1])
        .range([0, 200]);

      const yMin = d3.min(data.trend) ?? 0;
      const yMax = d3.max(data.trend) ?? 1;
      const yPad = (yMax - yMin) * 0.15 || 1;
      const yScale = d3.scaleLinear()
        .domain([yMin - yPad, yMax + yPad])
        .range([30, 2]);

      // Gradient fill
      const gradId = 'kpi-spark-grad';
      const defs = svg.append('defs');
      const grad = defs.append('linearGradient')
        .attr('id', gradId)
        .attr('x1', '0%').attr('y1', '0%')
        .attr('x2', '0%').attr('y2', '100%');
      grad.append('stop').attr('offset', '0%')
        .attr('stop-color', lineColor).attr('stop-opacity', fillOp);
      grad.append('stop').attr('offset', '100%')
        .attr('stop-color', lineColor).attr('stop-opacity', 0.05);

      const area = d3.area<number>()
        .x((_, i) => x(i))
        .y0(32)
        .y1((d) => yScale(d))
        .curve(d3.curveMonotoneX);

      svg.append('path')
        .datum(data.trend)
        .attr('d', area)
        .attr('fill', `url(#${gradId})`);

      const line = d3.line<number>()
        .x((_, i) => x(i))
        .y((d) => yScale(d))
        .curve(d3.curveMonotoneX);

      const pathEl = svg.append('path')
        .datum(data.trend)
        .attr('d', line)
        .attr('fill', 'none')
        .attr('stroke', strokeColor)
        .attr('stroke-width', strokeWidth)
        .attr('stroke-linecap', 'round');

      // End dot
      const lastIdx = data.trend.length - 1;
      svg.append('circle')
        .attr('cx', x(lastIdx))
        .attr('cy', yScale(data.trend[lastIdx]))
        .attr('r', 3)
        .attr('fill', strokeColor);

      wrapper.appendChild(sparkDiv);

      // Draw animation
      if (s.animationSettings.enabled.value) {
        requestAnimationFrame(() => {
          const node = pathEl.node();
          if (node) {
            const cancel = drawPath(node, s.animationSettings.duration.value, 200);
            this.cancelAnimations.push(cancel);
          }
        });
      }
    }

    this.container.appendChild(wrapper);
    this.container.addEventListener('click', this.handleBackgroundClick);

    // Entrance animation
    if (s.animationSettings.enabled.value) {
      const cancel = fadeSlideIn(wrapper, 'up', DURATION.fast, 50);
      this.cancelAnimations.push(cancel);
    }
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private showKpiTooltip(data: KpiCardData, event: MouseEvent): void {
    if (data.value === null) return;
    const locale = this.getHostLocale();
    const tooltipData: VisualTooltipDataItem[] = [
      { displayName: data.label || 'KPI', value: formatNumber(data.value, { abbreviate: false, locale }) },
    ];
    if (data.target !== null) {
      tooltipData.push({
        displayName: 'Target',
        value: formatNumber(data.target, { abbreviate: false, locale }),
      });
      tooltipData.push({
        displayName: 'Delta',
        value: formatNumber(data.value - data.target, { abbreviate: false, locale }),
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
