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

    this.applyCardStyle();

    const categories = this.extractCategories(dataView);
    const categorySelectionIds = this.extractCategorySelectionIds(dataView, categories.length);
    const series = this.extractSeries(dataView, categories.length);

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
          ? getHostChartColor(this.host.colorPalette, si)
          : getChartColor(si),
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
        backgroundColor: ((s as any).backgroundColor?.value?.value ?? (s as any).bgColor?.value?.value),
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
    const showLegend = s.legendSettings.show.value;
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
    const showLegendFormatted = s.legendFormattingCard.showLegend.value;
    const legendPosRaw = s.legendFormattingCard.legendPosition.value;
    const legendPos: string = (typeof legendPosRaw === 'string'
      ? legendPosRaw
      : (legendPosRaw as { value?: string } | undefined)?.value) ?? 'bottom';

    // Data label formatting
    const showDataLabels = s.dataLabelFormattingCard.showDataLabels.value;

    const numAxes = categories.length;
    const angleSlice = (2 * Math.PI) / numAxes;

    // Compute max value across all series
    let maxVal = 0;
    for (const ser of series) {
      for (const v of ser.values) {
        if (v > maxVal) maxVal = v;
      }
    }
    if (maxVal === 0) maxVal = 1;

    const effectiveShowLegend = showLegend && showLegendFormatted;
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
          const points = this.buildPolygonPoints(numAxes, angleSlice, r);
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
      const angle = angleSlice * i - Math.PI / 2;
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
      const points: Array<[number, number]> = [];

      for (let i = 0; i < numAxes; i++) {
        const angle = angleSlice * i - Math.PI / 2;
        const r = (ser.values[i] / maxVal) * radius;
        points.push([r * Math.cos(angle), r * Math.sin(angle)]);
      }

      // Polygon fill
      const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + ' Z';

      const polygon = g.append('path')
        .attr('class', 'radar-polygon')
        .attr('d', pathData)
        .attr('fill', withOpacity(ser.color, fillOpacity))
        .attr('fill-opacity', areaOpacity)
        .attr('stroke', ser.color)
        .attr('stroke-width', webStrokeWidth);

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
          const dot = g.append('circle')
            .attr('class', 'radar-dot')
            .attr('cx', points[i][0])
            .attr('cy', points[i][1])
            .attr('r', dotRadius)
            .attr('fill', ser.color)
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
      if (showDataLabels) {
        for (let i = 0; i < numAxes; i++) {
          const angle = angleSlice * i - Math.PI / 2;
          const labelR = (ser.values[i] / maxVal) * radius + dotRadius + 6;
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

      for (const ser of series) {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.gap = '4px';

        const swatch = document.createElement('div');
        swatch.style.width = '10px';
        swatch.style.height = '10px';
        swatch.style.borderRadius = '2px';
        swatch.style.backgroundColor = ser.color;

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

    this.container.addEventListener('click', this.handleBackgroundClick);
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private buildPolygonPoints(numAxes: number, angleSlice: number, radius: number): string {
    const pts: string[] = [];
    for (let i = 0; i < numAxes; i++) {
      const angle = angleSlice * i - Math.PI / 2;
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

  public destroy(): void {
    this.cancelAllAnimations();
    this.clearContainer();
  }
}
