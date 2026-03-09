/**
 * Radar Chart — Power BI IVisual implementation.
 * Spider/radar chart with animated polygon series and concentric web grid.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { RadarChartSettings } from './settings';
import {
  animate,
  cubicOut,
  popIn,
  fadeSlideIn,
  DURATION,
  getGlassStyle,
  getHostChartColor,
  getChartColor,
  withOpacity,
  formatNumber,
  renderChartTitle,
  applyDataLabelFormatting,
  resolveDropdown,
  applyChartAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
  createHoverDim,
  resolveColorTheme,
  buildConditionalConfig,
  resolveConditionalColor,
  resolveSeriesFormatting,
  populateSeriesFormattingGroups,
  lineStyleToDashArray,
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import ISelectionId = powerbi.visuals.ISelectionId;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import '../style/visual.less';

// ── Types ────────────────────────────────────────────────────────────

interface RadarSeries {
  name: string;
  values: number[];
  color: string;
}

// ── Visual ───────────────────────────────────────────────────────────

export class RadarChartVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: RadarChartSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new RadarChartSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('radar-container');
  }

  public update(options: VisualUpdateOptions): void {
    this.cancelAllAnimations();

    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        RadarChartSettings,
        dataView,
      );
    }

    // Hide inapplicable shared axis properties — radar-chart doesn't use titles/rotation/min/max
    this.settings.axisFormattingCard.showXAxis.visible = false;
    this.settings.axisFormattingCard.showYAxis.visible = false;
    this.settings.axisFormattingCard.xAxisTitle.visible = false;
    this.settings.axisFormattingCard.yAxisTitle.visible = false;
    this.settings.axisFormattingCard.axisLabelRotation.visible = false;
    this.settings.axisFormattingCard.yAxisMin.visible = false;
    this.settings.axisFormattingCard.yAxisMax.visible = false;

    this.applyCardStyle();

    const categories = this.extractCategories(dataView);
    const categorySelectionIds = this.extractCategorySelectionIds(dataView, categories.length);
    const series = this.extractSeries(dataView, categories.length);

    // Populate per-series formatting groups
    {
      const colorLookup = new Map<string, string>();
      for (const ser of series) {
        colorLookup.set(ser.name, ser.color);
      }
      populateSeriesFormattingGroups(
        this.settings.seriesFormattingCard,
        dataView,
        ['measure'],
        colorLookup,
      );
    }

    this.notifyRenderStarted();
    try {
      if (categories.length < 3 || series.length === 0) {
        this.renderEmpty();
      } else {
        this.render(categories, categorySelectionIds, series, options.viewport);
      }
      this.notifyRenderFinished();
    } catch (error) {
      this.notifyRenderFailed(error);
      throw error;
    }
  }

  // ── Data Extraction ──────────────────────────────────────────────

  private extractCategories(dataView: DataView | undefined): string[] {
    if (!dataView?.categorical?.categories?.[0]) return [];
    return dataView.categorical.categories[0].values.map((v) =>
      v !== null && v !== undefined ? String(v) : '',
    );
  }

  private extractSeries(dataView: DataView | undefined, numAxes: number): RadarSeries[] {
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    if (!dataView?.categorical?.values || numAxes === 0) return [];

    const result: RadarSeries[] = [];
    const valueColumns = dataView.categorical.values;
    const useChartPalette = this.settings.colorSettings.useChartPalette.value;

    for (let si = 0; si < valueColumns.length; si++) {
      const col = valueColumns[si];
      const name = col.source.displayName ?? `Series ${si + 1}`;
      const values: number[] = [];

      for (let i = 0; i < numAxes; i++) {
        const raw = col.values[i];
        values.push(typeof raw === 'number' && Number.isFinite(raw) ? raw : 0);
      }

      result.push({
        name,
        values,
        color: useChartPalette
          ? getHostChartColor(this.host.colorPalette, si, themeName)
          : getChartColor(si, themeName),
      });
    }

    return result;
  }

  private extractCategorySelectionIds(dataView: DataView | undefined, count: number): ISelectionId[] {
    const categoryColumn = dataView?.categorical?.categories?.[0];
    if (!categoryColumn) return [];

    const selectionIds: ISelectionId[] = [];
    for (let i = 0; i < count; i++) {
      selectionIds.push(this.host.createSelectionIdBuilder()
        .withCategory(categoryColumn, i)
        .createSelectionId());
    }
    return selectionIds;
  }

  // ── Card Style ─────────────────────────────────────────────────

  private applyCardStyle(): void {
    const s = this.settings.cardSettings;
    if (s.enableGlass.value) {
      const glass = getGlassStyle({
        mode: 'light',
        opacity: s.backgroundOpacity.value / 100,
        backgroundColor: s.backgroundColor.value?.value,
        borderRadius: s.borderRadius.value,
      });
      Object.assign(this.container.style, glass);
    } else {
      this.container.style.background = '';
      this.container.style.backdropFilter = '';
      (this.container.style as unknown as Record<string, string>)['WebkitBackdropFilter'] = '';
      this.container.style.border = '';
      this.container.style.boxShadow = '';
      this.container.style.borderRadius = `${s.borderRadius.value}px`;
    }
  }

  // ── Empty State ────────────────────────────────────────────────

  private renderEmpty(): void {
    this.clearContainer();
    const el = document.createElement('div');
    el.className = 'radar-empty';
    el.textContent = 'Add at least 3 categories and a measure.';
    this.container.appendChild(el);
  }

  // ── Main Render ────────────────────────────────────────────────

  private render(
    categories: string[],
    categorySelectionIds: ISelectionId[],
    series: RadarSeries[],
    viewport: powerbi.IViewport,
  ): void {
    this.clearContainer();
    renderChartTitle(this.container, this.settings.titleFormattingCard);

    const s = this.settings;
    const showGrid = s.radarSettings.showGrid.value;
    const gridLevels = Math.max(1, s.radarSettings.gridLevels.value);
    const fillOpacity = Math.max(0, Math.min(100, s.radarSettings.fillOpacity.value)) / 100;
    const showDots = s.radarSettings.showDots.value;
    const dotRadius = Math.max(1, s.radarSettings.dotRadius.value);
    const gridShape = resolveDropdown(s.radarSettings.gridShape) ?? 'polygon';
    const webStrokeColor = s.radarSettings.webStrokeColor.value?.value || '#CBD5E1';
    const webStrokeWidth = Math.max(0.5, s.radarSettings.webStrokeWidth.value);
    const webFillOpacity = Math.max(0, Math.min(100, s.radarSettings.webFillOpacity.value)) / 100;
    const areaOpacity = Math.max(0, Math.min(100, s.radarSettings.areaOpacity.value)) / 100;
    const showLegend = s.legendFormattingCard.showLegend.value;
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;

    // Axis formatting
    const axisColor = s.axisFormattingCard.axisLabelColor.value?.value || '#1E293B';
    const axisLabelSize = s.axisFormattingCard.axisLabelSize.value;
    const axisLineColor = s.axisFormattingCard.axisLineColor.value?.value || '#CBD5E1';
    const axisLineWidth = Math.max(0.5, s.axisFormattingCard.axisLineWidth.value);
    const showGridLines = s.axisFormattingCard.showGridLines.value;
    const gridLineColor = s.axisFormattingCard.gridLineColor.value?.value || '#E2E8F0';
    const gridLineStyleRaw = s.axisFormattingCard.gridLineStyle.value;
    const gridLineStyle: string = (typeof gridLineStyleRaw === 'string'
      ? gridLineStyleRaw
      : (gridLineStyleRaw as { value?: string } | undefined)?.value) ?? 'dashed';
    const gridDashArray = gridLineStyle === 'dashed' ? '4 3' : 'none';

    // Legend formatting
    const legendFontColor = s.legendFormattingCard.legendFontColor.value?.value || '#1E293B';
    const legendFontSize = s.legendFormattingCard.legendFontSize.value;
    const legendPosRaw = s.legendFormattingCard.legendPosition.value;
    const legendPos: string = (typeof legendPosRaw === 'string'
      ? legendPosRaw
      : (legendPosRaw as { value?: string } | undefined)?.value) ?? 'bottom';

    // Data label formatting
    const showDataLabels = s.dataLabelFormattingCard.showDataLabels.value;

    const numAxes = categories.length;
    const angleSlice = (2 * Math.PI) / numAxes;

    // User-configurable start angle offset (degrees -> radians)
    const startAngleOffset = (s.radarDisplaySettings.startAngle.value * Math.PI) / 180;

    // Independent axis scales: when enabled, each axis gets its own max
    const useIndependentScales = s.radarDisplaySettings.independentScales.value;

    // Compute global max value across all series
    let maxVal = 0;
    for (const ser of series) {
      for (const v of ser.values) {
        if (v > maxVal) maxVal = v;
      }
    }
    if (maxVal === 0) maxVal = 1;

    // Per-axis max values (only used when independentScales is on)
    const axisMaxValues: number[] = [];
    if (useIndependentScales) {
      for (let i = 0; i < numAxes; i++) {
        let axisMax = 0;
        for (const ser of series) {
          if (ser.values[i] > axisMax) axisMax = ser.values[i];
        }
        axisMaxValues.push(axisMax > 0 ? axisMax : 1);
      }
    }

    /** Get the max value for a given axis index. */
    const getAxisMax = (axisIndex: number): number =>
      useIndependentScales ? axisMaxValues[axisIndex] : maxVal;

    const effectiveShowLegend = showLegend;
    const isLegendVertical = legendPos === 'top' || legendPos === 'bottom';
    const legendHeight = effectiveShowLegend && isLegendVertical ? 30 : 0;
    const margin = 40;
    const svgWidth = viewport.width;
    const svgHeight = viewport.height - legendHeight;
    const radius = Math.max(20, Math.min(svgWidth, svgHeight) / 2 - margin);
    const cx = svgWidth / 2;
    const cy = svgHeight / 2;

    if (radius < 20) {
      this.renderEmpty();
      return;
    }

    const svg = d3.select(this.container)
      .append('svg')
      .attr('width', svgWidth)
      .attr('height', svgHeight);

    const g = svg.append('g')
      .attr('transform', `translate(${cx},${cy})`);

    // ── Grid ──

    if (showGrid && showGridLines) {
      for (let level = 1; level <= gridLevels; level++) {
        const r = (radius / gridLevels) * level;
        if (gridShape === 'circle') {
          g.append('circle')
            .attr('class', 'radar-grid-line')
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('r', r)
            .attr('stroke', gridLineColor)
            .attr('stroke-width', webStrokeWidth)
            .attr('stroke-dasharray', gridDashArray)
            .attr('fill', withOpacity(webStrokeColor, webFillOpacity));
        } else {
          const points = this.buildPolygonPoints(numAxes, angleSlice, r, startAngleOffset);
          g.append('polygon')
            .attr('class', 'radar-grid-line')
            .attr('points', points)
            .attr('stroke', gridLineColor)
            .attr('stroke-width', webStrokeWidth)
            .attr('stroke-dasharray', gridDashArray)
            .attr('fill', withOpacity(webStrokeColor, webFillOpacity));
        }
      }
    }

    // ── Axis lines + labels ──

    for (let i = 0; i < numAxes; i++) {
      const angle = angleSlice * i - Math.PI / 2 + startAngleOffset;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);

      g.append('line')
        .attr('class', 'radar-axis-line')
        .attr('x1', 0).attr('y1', 0)
        .attr('x2', x).attr('y2', y)
        .attr('stroke', axisLineColor)
        .attr('stroke-width', axisLineWidth);

      const labelR = radius + 14;
      const lx = labelR * Math.cos(angle);
      const ly = labelR * Math.sin(angle);

      g.append('text')
        .attr('class', 'radar-axis-label')
        .attr('x', lx)
        .attr('y', ly)
        .attr('dy', '0.35em')
        .attr('fill', axisColor)
        .style('font-size', `${axisLabelSize}px`)
        .text(categories[i]);
    }

    // ── Series polygons ──

    for (let si = 0; si < series.length; si++) {
      const ser = series[si];
      const sf = resolveSeriesFormatting(this.settings.seriesFormattingCard, si, ser.color);
      const seriesColor = sf.color;
      const seriesOpacity = sf.opacity / 100;
      const seriesLineStyle = lineStyleToDashArray(sf.lineStyle);
      const seriesLineWidth = sf.lineWidth;
      const points: Array<[number, number]> = [];

      for (let i = 0; i < numAxes; i++) {
        const angle = angleSlice * i - Math.PI / 2 + startAngleOffset;
        const r = (ser.values[i] / getAxisMax(i)) * radius;
        points.push([r * Math.cos(angle), r * Math.sin(angle)]);
      }

      // Polygon fill
      const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + ' Z';

      const polygon = g.append('path')
        .attr('class', 'radar-polygon')
        .attr('d', pathData)
        .attr('fill', withOpacity(seriesColor, fillOpacity * seriesOpacity))
        .attr('fill-opacity', areaOpacity)
        .attr('stroke', seriesColor)
        .attr('stroke-width', seriesLineWidth)
        .attr('stroke-dasharray', seriesLineStyle);

      polygon
        .on('mouseenter', (event: MouseEvent) => {
          this.showSeriesTooltip(ser, event);
        })
        .on('mousemove', (event: MouseEvent) => {
          this.moveTooltip(event);
        })
        .on('mouseleave', () => {
          this.hideTooltip();
        });

      // Animation: morph from center
      if (animEnabled && animDuration > 0) {
        const zeroPoints = new Array(numAxes).fill('0,0');
        const zeroPath = 'M' + zeroPoints.join(' L') + ' Z';
        const finalPath = pathData;

        polygon.attr('d', zeroPath);

        const delay = si * DURATION.stagger * 2;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let cancelAnim: (() => void) | null = null;

        timeoutId = setTimeout(() => {
          cancelAnim = animate(animDuration, cubicOut, (progress) => {
            const interp: string[] = [];
            for (let i = 0; i < numAxes; i++) {
              const x = points[i][0] * progress;
              const y = points[i][1] * progress;
              interp.push(`${i === 0 ? 'M' : 'L'}${x},${y}`);
            }
            polygon.attr('d', interp.join(' ') + ' Z');
          }, () => {
            polygon.attr('d', finalPath);
          });
        }, delay);

        this.cancelAnimations.push(() => {
          if (timeoutId !== null) clearTimeout(timeoutId);
          cancelAnim?.();
        });
      }

      // Dots
      if (showDots) {
        for (let i = 0; i < numAxes; i++) {
          const dotConditionalFill = this.getConditionalColor(ser.values[i]);
          const dot = g.append('circle')
            .attr('class', 'radar-dot')
            .attr('cx', points[i][0])
            .attr('cy', points[i][1])
            .attr('r', dotRadius)
            .attr('fill', dotConditionalFill ?? seriesColor)
            .style('cursor', 'pointer');

          const pointCategory = categories[i];
          const pointValue = ser.values[i];
          dot
            .on('mouseenter', (event: MouseEvent) => {
              this.showPointTooltip(pointCategory, ser.name, pointValue, categorySelectionIds[i], event);
            })
            .on('mousemove', (event: MouseEvent) => {
              this.moveTooltip(event);
            })
            .on('mouseleave', () => {
              this.hideTooltip();
            });

          const selectionId = categorySelectionIds[i];
          if (selectionId) {
            dot
              .on('click', (event: MouseEvent) => {
                event.stopPropagation();
                void this.selectionManager.select(selectionId, event.ctrlKey || event.metaKey);
              })
              .on('contextmenu', (event: MouseEvent) => {
                event.preventDefault();
                event.stopPropagation();
                void this.selectionManager.showContextMenu(selectionId, {
                  x: event.clientX,
                  y: event.clientY,
                });
              });
          }

          if (animEnabled) {
            const dotNode = dot.node();
            if (dotNode) {
              const delay = si * DURATION.stagger * 2 + animDuration * 0.5 + i * 30;
              const cancel = popIn(dotNode, delay, 400);
              this.cancelAnimations.push(cancel);
            }
          }
        }
      }

      // Data labels
      if (showDataLabels && sf.showLabels) {
        for (let i = 0; i < numAxes; i++) {
          const angle = angleSlice * i - Math.PI / 2 + startAngleOffset;
          const labelR = (ser.values[i] / getAxisMax(i)) * radius + dotRadius + 6;
          const lx = labelR * Math.cos(angle);
          const ly = labelR * Math.sin(angle);
          const locale = this.getHostLocale();

          const dataLabel = g.append('text')
            .attr('class', 'radar-data-label')
            .attr('x', lx)
            .attr('y', ly)
            .attr('dy', '0.35em')
            .attr('text-anchor', 'middle')
            .text(formatNumber(ser.values[i], { abbreviate: false, locale }));

          if (animEnabled) {
            dataLabel.attr('opacity', 0);
            const labelDelay = si * DURATION.stagger * 2 + animDuration * 0.8 + i * 30;
            let labelTimeoutId: ReturnType<typeof setTimeout> | null = null;
            let cancelLabelAnim: (() => void) | null = null;

            labelTimeoutId = setTimeout(() => {
              cancelLabelAnim = animate(DURATION.fast, cubicOut, (progress) => {
                dataLabel.attr('opacity', progress);
              });
            }, labelDelay);

            this.cancelAnimations.push(() => {
              if (labelTimeoutId !== null) clearTimeout(labelTimeoutId);
              cancelLabelAnim?.();
            });
          }
        }
      }
    }

    // ── Legend ──

    if (effectiveShowLegend && series.length > 1) {
      const legend = document.createElement('div');
      legend.style.display = 'flex';
      legend.style.justifyContent = 'center';
      legend.style.gap = '16px';
      legend.style.padding = '4px 0';
      if (legendPos === 'left' || legendPos === 'right') {
        legend.style.flexDirection = 'column';
        legend.style.alignItems = 'flex-start';
      }

      for (let li = 0; li < series.length; li++) {
        const ser = series[li];
        const legendSf = resolveSeriesFormatting(this.settings.seriesFormattingCard, li, ser.color);
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.gap = '4px';

        const swatch = document.createElement('div');
        swatch.style.width = '10px';
        swatch.style.height = '10px';
        swatch.style.borderRadius = '2px';
        swatch.style.backgroundColor = legendSf.color;

        const label = document.createElement('span');
        label.style.fontSize = `${legendFontSize}px`;
        label.style.color = legendFontColor;
        label.textContent = ser.name;

        item.appendChild(swatch);
        item.appendChild(label);
        legend.appendChild(item);
      }

      if (legendPos === 'top') {
        this.container.insertBefore(legend, this.container.firstChild);
      } else {
        this.container.appendChild(legend);
      }

      if (animEnabled) {
        const cancel = fadeSlideIn(legend, 'up', DURATION.fast, animDuration * 0.5);
        this.cancelAnimations.push(cancel);
      }
    }

    // Apply shared data label formatting
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.radar-data-label');

    // Benchmark overlay, axis values, hover behavior
    this.renderBenchmarkOverlay(g, series, numAxes, angleSlice, radius, maxVal, startAngleOffset, getAxisMax);
    this.renderAxisValues(g, gridLevels, radius, maxVal, axisLineColor, axisLabelSize, startAngleOffset, numAxes, angleSlice, getAxisMax);
    this.applyHoverDimBehavior();
    this.applyAccessibility();
    this.container.addEventListener('click', this.handleBackgroundClick);
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private buildPolygonPoints(numAxes: number, angleSlice: number, radius: number, angleOffset: number = 0): string {
    const pts: string[] = [];
    for (let i = 0; i < numAxes; i++) {
      const angle = angleSlice * i - Math.PI / 2 + angleOffset;
      pts.push(`${radius * Math.cos(angle)},${radius * Math.sin(angle)}`);
    }
    return pts.join(' ');
  }

  // ── Formatting Model ───────────────────────────────────────────

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  // ── Utilities ──────────────────────────────────────────────────

  private clearContainer(): void {
    this.hideTooltip();
    this.container.removeEventListener('click', this.handleBackgroundClick);
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }

  private cancelAllAnimations(): void {
    for (const cancel of this.cancelAnimations) cancel();
    this.cancelAnimations = [];
  }

  private handleBackgroundClick = (): void => {
    void this.selectionManager.clear();
  };

  private showSeriesTooltip(ser: RadarSeries, event: MouseEvent): void {
    const tooltipData: VisualTooltipDataItem[] = [
      { displayName: 'Series', value: ser.name },
    ];

    this.host.tooltipService.show({
      dataItems: tooltipData,
      identities: [],
      coordinates: [event.clientX, event.clientY],
      isTouchEvent: false,
    });
  }

  private showPointTooltip(
    category: string,
    seriesName: string,
    value: number,
    selectionId: ISelectionId | undefined,
    event: MouseEvent,
  ): void {
    const locale = this.getHostLocale();
    const tooltipData: VisualTooltipDataItem[] = [
      { displayName: 'Category', value: category },
      { displayName: 'Series', value: seriesName },
      { displayName: 'Value', value: formatNumber(value, { abbreviate: false, locale }) },
    ];

    this.host.tooltipService.show({
      dataItems: tooltipData,
      identities: selectionId ? [selectionId] : [],
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

  // ── Conditional Formatting ───────────────────────────────────

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

  // -- Benchmark Overlay -------------------------------------------------------

  /**
   * Renders a dashed benchmark polygon using the last series as reference data.
   * Only renders if benchmark settings are enabled and there are 2+ series.
   */
  private renderBenchmarkOverlay(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    series: RadarSeries[],
    numAxes: number,
    angleSlice: number,
    radius: number,
    _maxVal: number,
    startAngleOffset: number = 0,
    getAxisMax: (i: number) => number = () => _maxVal,
  ): void {
    const benchmarkSettings = this.settings.radarBenchmarkSettings;
    if (!benchmarkSettings.show.value || series.length < 2) return;

    // Use the last series as the benchmark
    const benchSeries = series[series.length - 1];
    const color = benchmarkSettings.color.value?.value ?? '#94A3B8';
    const dashRaw = resolveDropdown(benchmarkSettings.dashPattern) ?? 'dashed';
    const dashArray = dashRaw === 'dotted' ? '2,3' : dashRaw === 'dashed' ? '6,4' : 'none';

    const points: Array<[number, number]> = [];
    for (let i = 0; i < numAxes; i++) {
      const angle = angleSlice * i - Math.PI / 2 + startAngleOffset;
      const r = (benchSeries.values[i] / getAxisMax(i)) * radius;
      points.push([r * Math.cos(angle), r * Math.sin(angle)]);
    }

    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + ' Z';

    g.append('path')
      .attr('class', 'radar-benchmark')
      .attr('d', pathData)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', dashArray);
  }

  // -- Axis Value Labels ------------------------------------------------------

  private renderAxisValues(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    gridLevels: number,
    radius: number,
    maxVal: number,
    axisColor: string,
    axisLabelSize: number,
    startAngleOffset: number = 0,
    numAxes: number = 0,
    angleSlice: number = 0,
    getAxisMax: (i: number) => number = () => maxVal,
  ): void {
    const displaySettings = this.settings.radarDisplaySettings;
    if (!displaySettings.showAxisValues.value) return;

    const useIndependentScales = displaySettings.independentScales.value;
    const fontSize = `${Math.max(8, axisLabelSize - 2)}px`;

    if (useIndependentScales && numAxes > 0) {
      // Show per-axis max labels at the tip of each axis
      for (let i = 0; i < numAxes; i++) {
        const angle = angleSlice * i - Math.PI / 2 + startAngleOffset;
        const axisMax = getAxisMax(i);
        for (let level = 1; level <= gridLevels; level++) {
          const r = (radius / gridLevels) * level;
          const value = (axisMax / gridLevels) * level;
          g.append('text')
            .attr('class', 'radar-axis-value')
            .attr('x', r * Math.cos(angle) + 4)
            .attr('y', r * Math.sin(angle))
            .attr('fill', axisColor)
            .style('font-size', fontSize)
            .text(formatNumber(value));
        }
      }
    } else {
      // Uniform scale: show values along the first axis
      const baseAngle = -Math.PI / 2 + startAngleOffset;
      for (let level = 1; level <= gridLevels; level++) {
        const r = (radius / gridLevels) * level;
        const value = (maxVal / gridLevels) * level;
        g.append('text')
          .attr('class', 'radar-axis-value')
          .attr('x', r * Math.cos(baseAngle) + 4)
          .attr('y', r * Math.sin(baseAngle))
          .attr('fill', axisColor)
          .style('font-size', fontSize)
          .text(formatNumber(value));
      }
    }
  }

  // -- Hover Dim/Isolate ------------------------------------------------------

  private applyHoverDimBehavior(): void {
    const interactionSettings = this.settings.radarInteractionSettings;
    if (!interactionSettings.hoverDim.value) return;

    const polygons = this.container.querySelectorAll('.radar-polygon');
    if (polygons.length > 0) {
      createHoverDim({
        elements: polygons,
        dimOpacity: 0.15,
      });
    }
  }

  // -- Accessibility ----------------------------------------------------------

  private applyAccessibility(): void {
    const a11y = this.settings.accessibilityFormattingCard;
    if (a11y.enableKeyboardNav.value) {
      ensureFocusRingStyles();
      attachKeyboardNav({
        container: this.container,
        itemSelector: '.radar-dot',
        onActivate: (el: Element) => {
          (el as HTMLElement).click();
        },
      });
    }
    applyChartAria(this.container, {
      chartType: 'radar chart',
      dataPointCount: this.container.querySelectorAll('.radar-dot').length,
    });
  }

  public destroy(): void {
    this.cancelAllAnimations();
    this.clearContainer();
  }
}
