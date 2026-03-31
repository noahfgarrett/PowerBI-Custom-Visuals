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
  applyCardStyle,
  type CardStyleMode,
  getHostChartColor,
  getChartColor,
  withOpacity,
  formatWithSettings,
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
  getDateFilterIndices,
  isDateColumn,
  type DateFilterConfig,
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
  /** Per-axis highlight flags (true = this axis/value is cross-highlighted). */
  highlights: boolean[];
}

/** Top-level radar chart data container. */
interface RadarChartData {
  categories: string[];
  categorySelectionIds: ISelectionId[];
  series: RadarSeries[];
  /** Whether cross-highlight data is present from another visual/slicer. */
  hasHighlights: boolean;
}

// ── Visual ───────────────────────────────────────────────────────────

export class RadarChartVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: RadarChartSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];
  private currentData: RadarChartData | null = null;

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

    // Migrate legacy enableGlass -> cardStyleMode (backward compat)
    const legacyCardObj = dataView?.metadata?.objects?.['cardSettings'];
    if (legacyCardObj) {
      const legacyGlass = legacyCardObj['enableGlass'];
      if (legacyGlass === false) {
        this.settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
      }
    }

    // Hide inapplicable shared axis properties — radar-chart doesn't use titles/rotation/min/max

    // Date filter: hide start/end when disabled
    this.settings.dateFilterFormattingCard.startDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value;
    this.settings.dateFilterFormattingCard.endAtCurrentDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value;
    this.settings.dateFilterFormattingCard.endDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value && !this.settings.dateFilterFormattingCard.endAtCurrentDate.value;
    this.settings.axisFormattingCard.showXAxis.visible = false;
    this.settings.axisFormattingCard.showYAxis.visible = false;
    this.settings.axisFormattingCard.xAxisTitle.visible = false;
    this.settings.axisFormattingCard.yAxisTitle.visible = false;
    this.settings.axisFormattingCard.axisLabelRotation.visible = false;
    this.settings.axisFormattingCard.yAxisMin.visible = false;
    this.settings.axisFormattingCard.yAxisMax.visible = false;
    this.settings.axisFormattingCard.gridLineWidth.visible = false;
    this.settings.axisFormattingCard.gridLineOpacity.visible = false;

    // Card style: hide opacity when style is 'none'
    const cardMode = (resolveDropdown(this.settings.cardSettings.cardStyleMode) ?? 'glass') as CardStyleMode;
    this.settings.cardSettings.backgroundOpacity.visible = cardMode !== 'none';
    this.settings.cardSettings.backgroundColor.visible = cardMode !== 'none';

    // Hide data label position — position is determined by chart geometry
    this.settings.dataLabelFormattingCard.dataLabelPosition.visible = false;

    // Conditional visibility: hide dot sub-settings when showDots is off
    const dotsVisible = this.settings.radarAppearance.showDots.value;
    this.settings.radarAppearance.dotRadius.visible = dotsVisible;
    this.settings.radarAppearance.dotBorderColor.visible = dotsVisible;
    this.settings.radarAppearance.dotBorderWidth.visible = dotsVisible;

    // Conditional visibility: hide benchmark sub-settings when showBenchmark is off
    const benchVisible = this.settings.radarBenchmarkSettings.show.value;
    this.settings.radarBenchmarkSettings.dashPattern.visible = benchVisible;
    this.settings.radarBenchmarkSettings.color.visible = benchVisible;
    this.settings.radarBenchmarkSettings.lineWidth.visible = benchVisible;

    const categories = this.extractCategories(dataView);
    const categorySelectionIds = this.extractCategorySelectionIds(dataView, categories.length);
    const series = this.extractSeries(dataView, categories.length);

    // Compute cross-highlight state
    const hasHighlights = series.some(s => s.highlights.some(h => h));
    this.currentData = { categories, categorySelectionIds, series, hasHighlights };

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

    if (categories.length < 3 || series.length === 0) {
      this.renderEmpty();
    } else {
      this.render(categories, categorySelectionIds, series, options.viewport);
    }

    // Apply card styling AFTER render — render clears the container, which would destroy the glass backdrop div.
    this.applyCardStyling();
  }

  // ── Data Extraction ──────────────────────────────────────────────

  private extractCategories(dataView: DataView | undefined): string[] {
    if (!dataView?.categorical?.categories?.[0]) return [];
    const catCol = dataView.categorical.categories[0];
    const dateConfig: DateFilterConfig = {
      enabled: this.settings.dateFilterFormattingCard.enableDateFilter.value,
      startDate: this.settings.dateFilterFormattingCard.startDate.value,
      endAtCurrentDate: this.settings.dateFilterFormattingCard.endAtCurrentDate.value,
      endDate: this.settings.dateFilterFormattingCard.endDate.value,
    };
    const dateIndices = isDateColumn(catCol.source) ? getDateFilterIndices(catCol.values, dateConfig) : null;
    return catCol.values
      .map((v, i) => dateIndices && !dateIndices.has(i) ? null : (v !== null && v !== undefined ? String(v) : ''))
      .filter((v): v is string => v !== null);
  }

  private extractSeries(dataView: DataView | undefined, numAxes: number): RadarSeries[] {
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    if (!dataView?.categorical?.values || numAxes === 0) return [];

    // Build filtered index map for date filter
    const catCol = dataView.categorical?.categories?.[0];
    const dateConfig: DateFilterConfig = {
      enabled: this.settings.dateFilterFormattingCard.enableDateFilter.value,
      startDate: this.settings.dateFilterFormattingCard.startDate.value,
      endAtCurrentDate: this.settings.dateFilterFormattingCard.endAtCurrentDate.value,
      endDate: this.settings.dateFilterFormattingCard.endDate.value,
    };
    const dateIndices = catCol && isDateColumn(catCol.source) ? getDateFilterIndices(catCol.values, dateConfig) : null;
    const filteredIndices: number[] = [];
    const totalRows = catCol ? catCol.values.length : numAxes;
    for (let i = 0; i < totalRows; i++) {
      if (dateIndices && !dateIndices.has(i)) continue;
      filteredIndices.push(i);
    }

    const result: RadarSeries[] = [];
    const valueColumns = dataView.categorical.values;
    const useChartPalette = this.settings.radarAppearance.useChartPalette.value;

    for (let si = 0; si < valueColumns.length; si++) {
      const col = valueColumns[si];
      const name = col.source.displayName ?? `Series ${si + 1}`;
      const values: number[] = [];
      const highlights: boolean[] = [];

      // Cross-highlight: read highlight values
      const hlRaw = (col as unknown as { highlights?: unknown }).highlights as unknown[] | undefined;

      for (let fi = 0; fi < numAxes; fi++) {
        const i = filteredIndices[fi] ?? fi;
        const raw = col.values[i];
        values.push(typeof raw === 'number' && Number.isFinite(raw) ? raw : 0);
        highlights.push(hlRaw ? hlRaw[i] !== null && hlRaw[i] !== undefined : false);
      }

      result.push({
        name,
        values,
        highlights,
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

  private applyCardStyling(): void {
    const s = this.settings.cardSettings;
    const mode = (resolveDropdown(s.cardStyleMode) ?? 'glass') as CardStyleMode;
    applyCardStyle(
      this.container,
      {
        mode,
        opacity: s.backgroundOpacity.value / 100,
        backgroundColor: s.backgroundColor.value?.value,
        borderRadius: s.borderRadius.value,
      },
    );
    if (mode === 'none') {
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
    const fillOpacity = Math.max(0, Math.min(100, s.radarAppearance.fillOpacity.value)) / 100;
    const showDots = s.radarAppearance.showDots.value;
    const dotRadius = Math.max(1, s.radarAppearance.dotRadius.value);
    const gridShape = resolveDropdown(s.radarSettings.gridShape) ?? 'polygon';
    const webStrokeColor = s.radarSettings.webStrokeColor.value?.value || '#CBD5E1';
    const webStrokeWidth = Math.max(0.5, s.radarSettings.webStrokeWidth.value);
    const webFillOpacity = Math.max(0, Math.min(100, s.radarSettings.webFillOpacity.value)) / 100;
    const areaOpacity = Math.max(0, Math.min(100, s.radarAppearance.areaOpacity.value)) / 100;
    const showLegend = s.legendFormattingCard.showLegend.value;
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;

    // Axis formatting
    const axisColor = s.axisFormattingCard.axisLabelColor.value?.value || '#1E293B';
    const axisLabelSize = s.axisFormattingCard.axisLabelSize.value;
    const axisLabelFontFamily = resolveDropdown(s.axisFormattingCard.axisLabelFontFamily) || undefined;
    const axisLabelFontWeight = resolveDropdown(s.axisFormattingCard.axisLabelFontWeight) || undefined;
    const axisLineColor = s.axisFormattingCard.axisLineColor.value?.value || '#CBD5E1';
    const axisLineWidth = Math.max(0.5, s.axisFormattingCard.axisLineWidth.value);
    const showGridLines = s.axisFormattingCard.showGridLines.value;
    const gridLineColor = s.axisFormattingCard.gridLineColor.value?.value || '#E2E8F0';
    const gridLineStyle = resolveDropdown(s.axisFormattingCard.gridLineStyle) ?? 'dashed';
    const gridDashArray = gridLineStyle === 'dashed' ? '4 3' : 'none';
    const showAxisLabels = s.radarSettings.showAxisLabels.value;

    // Legend formatting
    const legendFontColor = s.legendFormattingCard.legendFontColor.value?.value || '#1E293B';
    const legendFontSize = s.legendFormattingCard.legendFontSize.value;
    const legendFontFamily = resolveDropdown(s.legendFormattingCard.legendFontFamily) || undefined;
    const legendFontWeight = resolveDropdown(s.legendFormattingCard.legendFontWeight) || undefined;
    const legendPos = resolveDropdown(s.legendFormattingCard.legendPosition) ?? 'bottom';

    // Series appearance
    const globalLineWidth = s.radarAppearance.lineWidth.value;
    const dotBorderColor = s.radarAppearance.dotBorderColor.value?.value || '#FFFFFF';
    const dotBorderWidth = s.radarAppearance.dotBorderWidth.value;

    // Data label formatting
    const showDataLabels = s.dataLabelFormattingCard.showDataLabels.value;

    const numAxes = categories.length;
    const angleSlice = (2 * Math.PI) / numAxes;

    // User-configurable start angle offset (degrees -> radians)
    const startAngleOffset = (s.radarSettings.startAngle.value * Math.PI) / 180;

    // Independent axis scales: when enabled, each axis gets its own max
    const useIndependentScales = s.radarSettings.independentScales.value;

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

    const isLegendHorizontal = legendPos === 'top' || legendPos === 'bottom';
    const isLegendSide = legendPos === 'left' || legendPos === 'right';
    const legendHeight = showLegend && isLegendHorizontal ? 30 : 0;
    const legendWidth = showLegend && isLegendSide ? 80 : 0;
    const margin = 40;
    const svgWidth = viewport.width - legendWidth;
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

      if (showAxisLabels) {
        const labelR = radius + 14;
        const lx = labelR * Math.cos(angle);
        const ly = labelR * Math.sin(angle);
        // Intelligent text-anchor based on position around the chart
        const anchor = Math.abs(lx) < 1 ? 'middle' : lx > 0 ? 'start' : 'end';

        const labelEl = g.append('text')
          .attr('class', 'radar-axis-label')
          .attr('x', lx)
          .attr('y', ly)
          .attr('dy', '0.35em')
          .attr('text-anchor', anchor)
          .attr('fill', axisColor)
          .style('font-size', `${axisLabelSize}px`);
        if (axisLabelFontFamily) labelEl.style('font-family', axisLabelFontFamily);
        if (axisLabelFontWeight) labelEl.style('font-weight', axisLabelFontWeight);
        labelEl.text(categories[i]);
      }
    }

    // ── Benchmark overlay (behind series, in front of grid) ──
    this.renderBenchmarkOverlay(g, series, numAxes, angleSlice, radius, maxVal, startAngleOffset, getAxisMax);

    // ── Series polygons ──

    for (let si = 0; si < series.length; si++) {
      const ser = series[si];
      const sf = resolveSeriesFormatting(this.settings.seriesFormattingCard, si, ser.color);
      const seriesColor = sf.color;
      const seriesOpacity = sf.opacity / 100;
      const seriesLineStyle = lineStyleToDashArray(sf.lineStyle);
      const seriesLineWidth = sf.lineWidth > 0 ? sf.lineWidth : globalLineWidth;
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
        .attr('data-series-index', si)
        .attr('d', pathData)
        .attr('fill', withOpacity(seriesColor, fillOpacity * seriesOpacity))
        .attr('fill-opacity', areaOpacity)
        .attr('stroke', seriesColor)
        .attr('stroke-width', seriesLineWidth)
        .attr('stroke-dasharray', seriesLineStyle);

      // Hover: brightness boost + soft glow
      polygon
        .style('transition', 'filter 0.2s ease, opacity 0.15s ease')
        .on('mouseenter', (event: MouseEvent) => {
          polygon.style('filter', `brightness(1.2) drop-shadow(0 0 6px ${seriesColor})`);
          this.showSeriesTooltip(ser, event);
        })
        .on('mousemove', (event: MouseEvent) => {
          this.moveTooltip(event);
        })
        .on('mouseleave', () => {
          polygon.style('filter', 'none');
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
            .attr('stroke', dotBorderColor)
            .attr('stroke-width', dotBorderWidth)
            .attr('data-selection-key', categorySelectionIds[i]?.getKey() ?? '')
            .attr('data-axis-index', i)
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
          const dataLabel = g.append('text')
            .attr('class', 'radar-data-label')
            .attr('x', lx)
            .attr('y', ly)
            .attr('dy', '0.35em')
            .attr('text-anchor', 'middle')
            .text(formatWithSettings(ser.values[i], this.settings.numberFormattingCard));

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

    if (showLegend && series.length > 1) {
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
        if (legendFontFamily) label.style.fontFamily = legendFontFamily;
        if (legendFontWeight) label.style.fontWeight = legendFontWeight;
        label.textContent = ser.name;

        item.appendChild(swatch);
        item.appendChild(label);
        legend.appendChild(item);
      }

      if (legendPos === 'top' || legendPos === 'left') {
        this.container.insertBefore(legend, this.container.firstChild);
      } else {
        this.container.appendChild(legend);
      }

      // Adjust container layout for side legends
      if (legendPos === 'left' || legendPos === 'right') {
        this.container.style.flexDirection = legendPos === 'left' ? 'row' : 'row-reverse';
      }

      if (animEnabled) {
        const cancel = fadeSlideIn(legend, 'up', DURATION.fast, animDuration * 0.5);
        this.cancelAnimations.push(cancel);
      }
    }

    // Apply shared data label formatting
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.radar-data-label');

    // Axis values, hover behavior
    this.renderAxisValues(g, gridLevels, radius, maxVal, axisLineColor, axisLabelSize, startAngleOffset, numAxes, angleSlice, getAxisMax);
    this.applyHoverDimBehavior();
    this.applyCrossHighlight();
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
    // Reset flex layout so stale flexDirection from side-legends doesn't persist
    this.container.style.flexDirection = 'column';
  }

  private cancelAllAnimations(): void {
    for (const cancel of this.cancelAnimations) cancel();
    this.cancelAnimations = [];
  }

  // ── Cross-Highlight ──────────────────────────────────────────────

  private applyCrossHighlight(): void {
    const data = this.currentData;
    if (!data) return;

    const hasHighlights = data.hasHighlights;
    const hasSelection = this.selectionManager.hasSelection();
    const selectedIds = this.selectionManager.getSelectionIds() as ISelectionId[];
    const selectedKeys = new Set(selectedIds.map((id) => id.getKey()));

    // Build set of highlighted axis indices from cross-highlight data
    const highlightedAxisIndices = new Set<number>();
    if (hasHighlights) {
      for (const ser of data.series) {
        ser.highlights.forEach((h, i) => { if (h) highlightedAxisIndices.add(i); });
      }
    }
    const highlightedKeys = new Set<string>();
    for (const idx of highlightedAxisIndices) {
      if (data.categorySelectionIds[idx]) {
        highlightedKeys.add(data.categorySelectionIds[idx].getKey());
      }
    }

    // Determine if any series has ALL its axes highlighted (dim others)
    const shouldDim = hasSelection || hasHighlights;

    // Dim polygons: a polygon is highlighted if any of its axis points are highlighted
    const polygons = this.container.querySelectorAll<SVGPathElement>('.radar-polygon');
    for (const el of Array.from(polygons)) {
      if (shouldDim) {
        const seriesIdx = parseInt(el.getAttribute('data-series-index') ?? '-1', 10);
        const ser = data.series[seriesIdx];
        const seriesHasHighlight = hasHighlights && ser ? ser.highlights.some(h => h) : false;
        const elKey = el.getAttribute('data-selection-key');
        const isSelected = hasSelection && elKey !== null && selectedKeys.has(elKey);
        el.style.opacity = (seriesHasHighlight || isSelected) ? '' : '0.3';
      } else {
        el.style.opacity = '';
      }
    }

    // Dim dots
    const dots = this.container.querySelectorAll<SVGCircleElement>('.radar-dot');
    for (const el of Array.from(dots)) {
      if (shouldDim) {
        const elKey = el.getAttribute('data-selection-key');
        const isSelected = hasSelection && elKey !== null && selectedKeys.has(elKey);
        const isHighlighted = hasHighlights && elKey !== null && highlightedKeys.has(elKey);
        el.style.opacity = (isSelected || isHighlighted) ? '' : '0.3';
      } else {
        el.style.opacity = '';
      }
    }
  }

  private handleBackgroundClick = (): void => {
    void this.selectionManager.clear();
    this.applyCrossHighlight();
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
    const tooltipData: VisualTooltipDataItem[] = [
      { displayName: 'Category', value: category },
      { displayName: 'Series', value: seriesName },
      { displayName: 'Value', value: formatWithSettings(value, this.settings.numberFormattingCard) },
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

  // Render lifecycle notifications removed — Power BI's eventService.renderingStarted()
  // requires VisualUpdateOptions with updateId, and calling without args crashes the visual.

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
   * Renders a benchmark polygon at the average value across all series per axis.
   * Styled with the user-configured color and dash pattern from benchmark settings.
   * Drawn behind data series but in front of the grid (inserted before series polygons).
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
    if (!benchmarkSettings.show.value || series.length === 0 || numAxes < 3) return;

    // Compute the average value per axis across all series
    const avgValues: number[] = [];
    for (let i = 0; i < numAxes; i++) {
      let sum = 0;
      for (const ser of series) {
        sum += ser.values[i];
      }
      avgValues.push(sum / series.length);
    }

    const color = benchmarkSettings.color.value?.value ?? '#94A3B8';
    const dashStyle = resolveDropdown(benchmarkSettings.dashPattern) ?? 'dashed';
    const dashArray = lineStyleToDashArray(dashStyle);
    const benchLineWidth = benchmarkSettings.lineWidth.value;

    const points: Array<[number, number]> = [];
    for (let i = 0; i < numAxes; i++) {
      const angle = angleSlice * i - Math.PI / 2 + startAngleOffset;
      const r = (avgValues[i] / getAxisMax(i)) * radius;
      points.push([r * Math.cos(angle), r * Math.sin(angle)]);
    }

    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + ' Z';

    g.append('path')
      .attr('class', 'radar-benchmark')
      .attr('d', pathData)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', benchLineWidth)
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
    const displaySettings = this.settings.radarSettings;
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
            .text(formatWithSettings(value, this.settings.numberFormattingCard));
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
          .text(formatWithSettings(value, this.settings.numberFormattingCard));
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
