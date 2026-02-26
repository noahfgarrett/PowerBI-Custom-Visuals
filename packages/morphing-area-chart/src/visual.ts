/**
 * Morphing Area Chart — Power BI IVisual implementation.
 * Line chart with gradient fill beneath, animated path drawing,
 * dot pop-in, and optional multi-series support.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { MorphingAreaChartSettings } from './settings';
import {
  formatNumber,
  animate,
  drawPath,
  popIn,
  fadeSlideIn,
  cubicOut,
  getHostChartColor,
  withOpacity,
  getGlassStyle,
  renderChartTitle,
  applyAxisFormatting,
  applyGridFormatting,
  applyDataLabelFormatting,
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import ISelectionId = powerbi.visuals.ISelectionId;

import '../style/visual.less';

// ── Types ───────────────────────────────────────────────────────────

type CurveType = 'monotoneX' | 'linear' | 'step';
type LegendPosition = 'top' | 'bottom' | 'left' | 'right';

interface SeriesData {
  name: string;
  values: (number | null)[];
  color: string;
}

interface ChartData {
  categories: string[];
  categorySelectionIds: ISelectionId[];
  series: SeriesData[];
  isEmpty: boolean;
}

interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// ── Constants ───────────────────────────────────────────────────────

const MARGIN_DEFAULT: Margin = { top: 20, right: 20, bottom: 40, left: 50 };
const DOT_HOVER_EXTRA = 2;
const LEGEND_HEIGHT = 28;
const LEGEND_SIDE_WIDTH = 90;

// ── Visual ──────────────────────────────────────────────────────────

export class MorphingAreaChartVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: MorphingAreaChartSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];
  /** Monotonically increasing ID to namespace SVG gradient defs per render. */
  private renderGeneration = 0;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new MorphingAreaChartSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('area-chart-container');
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel running animations before re-render
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        MorphingAreaChartSettings,
        dataView,
      );
    }

    // Extract data
    const data = this.extractData(dataView);

    // Apply glass effect
    this.applyCardStyle();

    // Render
    if (data.isEmpty) {
      this.renderEmpty();
    } else {
      this.render(data, options.viewport);
    }
  }

  // ── Data Extraction ─────────────────────────────────────────────

  private extractData(dataView: DataView | undefined): ChartData {
    const empty: ChartData = {
      categories: [],
      categorySelectionIds: [],
      series: [],
      isEmpty: true,
    };

    if (!dataView?.categorical) return empty;

    const categorical = dataView.categorical;
    const categoryColumn = categorical.categories?.[0];
    const valuesColumns = categorical.values;

    if (!categoryColumn || !valuesColumns || valuesColumns.length === 0) return empty;

    // Extract category labels
    const categories = categoryColumn.values.map((v) =>
      v !== null && v !== undefined ? String(v) : '',
    );
    const categorySelectionIds = categoryColumn.values.map((_, index) =>
      this.host.createSelectionIdBuilder()
        .withCategory(categoryColumn, index)
        .createSelectionId(),
    );

    if (categories.length === 0) return empty;

    const series: SeriesData[] = [];
    let colorIdx = 0;

    for (const col of valuesColumns) {
      const role = col.source.roles;
      if (!role) continue;

      if (role['measure']) {
        const vals = col.values.map((v) => (typeof v === 'number' ? v : null));
        series.push({
          name: col.source.displayName ?? `Series ${series.length + 1}`,
          values: vals,
          color: getHostChartColor(this.host.colorPalette, colorIdx),
        });
        colorIdx++;
      }
    }

    return {
      categories,
      categorySelectionIds,
      series,
      isEmpty: series.length === 0,
    };
  }

  // ── Card Style ────────────────────────────────────────────────────

  private applyCardStyle(): void {
    const s = this.settings.cardSettings;
    if (s.enableGlass.value) {
      const glass = getGlassStyle({
        mode: 'light',
        opacity: s.bgOpacity.value / 100,
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

  // ── Empty State ───────────────────────────────────────────────────

  private renderEmpty(): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    const emptyEl = document.createElement('div');
    emptyEl.className = 'area-chart-empty';
    emptyEl.textContent = 'Add a Category and at least one Measure to get started.';
    this.container.appendChild(emptyEl);
  }

  // ── Main Render ───────────────────────────────────────────────────

  private render(data: ChartData, viewport: powerbi.IViewport): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.container.removeEventListener('click', this.handleBackgroundClick);

    this.renderGeneration++;
    const s = this.settings;

    // Legend dimensions
    const showLegend = s.legendSettings.show.value && data.series.length > 1;
    const legendPos = this.getLegendPosition();
    const legendReserveV = showLegend && (legendPos === 'top' || legendPos === 'bottom') ? LEGEND_HEIGHT : 0;
    const legendReserveH = showLegend && (legendPos === 'left' || legendPos === 'right') ? LEGEND_SIDE_WIDTH : 0;

    // Margins
    const margin: Margin = { ...MARGIN_DEFAULT };
    if (!s.axisSettings.showXAxis.value) margin.bottom = 8;
    if (!s.axisSettings.showYAxis.value) margin.left = 8;
    if (legendPos === 'top') margin.top += legendReserveV;

    // Compute chart dimensions
    const padding = 8;
    const svgWidth = viewport.width - padding * 2 - legendReserveH;
    const svgHeight = viewport.height - padding * 2 - legendReserveV;
    const chartWidth = Math.max(0, svgWidth - margin.left - margin.right);
    const chartHeight = Math.max(0, svgHeight - margin.top - margin.bottom);

    if (chartWidth <= 0 || chartHeight <= 0) {
      this.renderEmpty();
      return;
    }

    // Wrapper for horizontal legend layout (left/right)
    const wrapper = document.createElement('div');
    wrapper.className = 'area-chart-wrapper';
    if (showLegend && (legendPos === 'left' || legendPos === 'right')) {
      wrapper.style.display = 'flex';
      wrapper.style.flexDirection = legendPos === 'left' ? 'row' : 'row-reverse';
      wrapper.style.width = '100%';
      wrapper.style.height = '100%';
    } else {
      wrapper.style.display = 'flex';
      wrapper.style.flexDirection = 'column';
      wrapper.style.width = '100%';
      wrapper.style.height = '100%';
    }
    this.container.appendChild(wrapper);

    // Legend (top or left)
    if (showLegend && (legendPos === 'top' || legendPos === 'left')) {
      this.renderLegend(data, wrapper, legendPos);
    }

    // SVG
    const svgContainer = document.createElement('div');
    svgContainer.style.flex = '1';
    svgContainer.style.minWidth = '0';
    svgContainer.style.minHeight = '0';
    wrapper.appendChild(svgContainer);

    const svg = d3.select(svgContainer)
      .append('svg')
      .attr('class', 'area-chart-svg')
      .attr('width', svgWidth)
      .attr('height', svgHeight);

    // Defs for gradients
    const defs = svg.append('defs');

    const chartGroup = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3.scalePoint<string>()
      .domain(data.categories)
      .range([0, chartWidth])
      .padding(0.5);

    const allValues = data.series.flatMap((ser) =>
      ser.values.filter((v): v is number => v !== null),
    );
    const yMax = d3.max(allValues) ?? 0;
    const yMin = d3.min(allValues) ?? 0;
    const domainMin = Math.min(0, yMin);
    const y = d3.scaleLinear()
      .domain([domainMin, yMax * 1.1 || 1])
      .nice()
      .range([chartHeight, 0]);

    // Grid lines
    if (s.axisSettings.gridLines.value) {
      chartGroup.append('g')
        .attr('class', 'area-grid')
        .call(
          d3.axisLeft(y)
            .ticks(6)
            .tickSize(-chartWidth)
            .tickFormat(() => ''),
        )
        .select('.domain').remove();
    }

    // Axes
    if (s.axisSettings.showXAxis.value) {
      const xAxisGroup = chartGroup.append('g')
        .attr('class', 'area-axis area-axis-x')
        .attr('transform', `translate(0,${chartHeight})`)
        .call(d3.axisBottom(x).tickSize(0));

      xAxisGroup.select('.domain').remove();

      // Rotate labels if there are many categories
      if (data.categories.length > 12) {
        xAxisGroup.selectAll('text')
          .attr('transform', 'rotate(-45)')
          .style('text-anchor', 'end')
          .attr('dx', '-0.5em')
          .attr('dy', '0.25em');
      }
    }

    if (s.axisSettings.showYAxis.value) {
      chartGroup.append('g')
        .attr('class', 'area-axis')
        .call(
          d3.axisLeft(y)
            .ticks(6)
            .tickFormat((d) => formatNumber(d as number, { abbreviate: true })),
        )
        .select('.domain').remove();
    }

    // Curve function
    const curveFn = this.getCurveFunction();

    // Animation settings
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;
    const showArea = s.lineSettings.showArea.value;
    const showDots = s.lineSettings.showDots.value;
    const dotRadius = this.settings.lineSettings.dotRadius.value;
    const lineWidth = s.lineSettings.lineWidth.value;
    const fillOpacity = s.areaSettings.fillOpacity.value / 100;
    const useGradient = s.areaSettings.useGradient.value;
    const showDataLabels = s.dataLabelFormattingCard.showDataLabels.value;

    // Render each series
    data.series.forEach((series, seriesIdx) => {
      const seriesDelay = seriesIdx * 150;

      // Build valid data points (skip nulls to create gaps)
      const validPoints: Array<{
        catIdx: number;
        x: number;
        y: number;
        val: number;
        cat: string;
        selectionId: ISelectionId;
      }> = [];
      data.categories.forEach((cat, i) => {
        const val = series.values[i];
        if (val !== null) {
          const px = x(cat);
          if (px !== undefined) {
            validPoints.push({
              catIdx: i,
              x: px,
              y: y(val),
              val,
              cat,
              selectionId: data.categorySelectionIds[i],
            });
          }
        }
      });

      if (validPoints.length === 0) return;

      // ── Area fill ──────────────────────────────────────────────
      if (showArea && validPoints.length >= 2) {
        const gradientId = `area-grad-${this.renderGeneration}-${seriesIdx}`;

        if (useGradient) {
          // Use userSpaceOnUse so the gradient maps to the chart coordinate
          // system rather than the path bounding box. This produces a
          // consistent vertical fade from the highest data point to the
          // chart baseline regardless of the series value range.
          const seriesMinY = d3.min(validPoints, (pt) => pt.y) ?? 0;

          const gradient = defs.append('linearGradient')
            .attr('id', gradientId)
            .attr('gradientUnits', 'userSpaceOnUse')
            .attr('x1', 0)
            .attr('y1', seriesMinY)
            .attr('x2', 0)
            .attr('y2', chartHeight);

          // Top stop: line color at the user-specified fill opacity
          gradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', series.color)
            .attr('stop-opacity', fillOpacity);

          // Mid stop: softer fade for a smoother transition
          gradient.append('stop')
            .attr('offset', '60%')
            .attr('stop-color', series.color)
            .attr('stop-opacity', fillOpacity * 0.35);

          // Bottom stop: fully transparent at the baseline
          gradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', series.color)
            .attr('stop-opacity', 0);
        }

        const areaGen = d3.area<{ x: number; y: number }>()
          .x((d) => d.x)
          .y0(chartHeight)
          .y1((d) => d.y)
          .curve(curveFn);

        const areaPath = chartGroup.append('path')
          .datum(validPoints)
          .attr('class', 'area-fill')
          .attr('d', areaGen)
          .attr('fill', useGradient ? `url(#${gradientId})` : withOpacity(series.color, fillOpacity));

        // Animate area fade-in
        if (animEnabled) {
          const areaNode = areaPath.node();
          if (areaNode) {
            areaNode.style.opacity = '0';
            const timeoutId = setTimeout(() => {
              const cancelAnim = animate(animDuration, cubicOut, (progress) => {
                areaNode.style.opacity = `${progress}`;
              }, () => {
                areaNode.style.opacity = '1';
              });
              this.cancelAnimations.push(cancelAnim);
            }, seriesDelay + 100);
            this.cancelAnimations.push(() => clearTimeout(timeoutId));
          }
        }
      }

      // ── Line path ──────────────────────────────────────────────
      if (validPoints.length >= 2) {
        const lineGen = d3.line<{ x: number; y: number }>()
          .x((d) => d.x)
          .y((d) => d.y)
          .curve(curveFn);

        // Apply line style from the shared lineStrokeFormattingCard if set
        const strokeStyleVal = (this.settings.lineStrokeFormattingCard.lineStyle.value as
          { value?: string } | undefined)?.value;
        const strokeDash = strokeStyleVal === 'dashed'
          ? '6 3'
          : strokeStyleVal === 'dotted'
            ? '2 2'
            : 'none';

        const linePath = chartGroup.append('path')
          .datum(validPoints)
          .attr('class', 'area-line')
          .attr('d', lineGen)
          .attr('stroke', series.color)
          .attr('stroke-width', lineWidth)
          .attr('stroke-dasharray', strokeDash);

        // Animate line draw
        if (animEnabled) {
          const lineNode = linePath.node();
          if (lineNode) {
            const cancel = drawPath(lineNode, animDuration, seriesDelay);
            this.cancelAnimations.push(cancel);
          }
        }
      } else if (validPoints.length === 1) {
        // Single point: just draw a dot (no line possible)
      }

      // ── Dots ───────────────────────────────────────────────────
      if (showDots) {
        validPoints.forEach((pt, ptIdx) => {
          const dot = chartGroup.append('circle')
            .attr('class', 'area-dot')
            .attr('cx', pt.x)
            .attr('cy', pt.y)
            .attr('r', dotRadius)
            .attr('fill', series.color)
            .attr('stroke', this.settings.lineSettings.dotStrokeColor.value?.value || '#FFFFFF')
            .attr('stroke-width', this.settings.lineSettings.dotStrokeWidth.value);

          // Tooltip
          this.attachDotTooltip(dot, pt.cat, series.name, pt.val);

          // Hover enlargement
          const dotHoverRadius = dotRadius + DOT_HOVER_EXTRA;
          dot.on('mouseenter', function () {
            d3.select(this).attr('r', dotHoverRadius);
          });
          dot.on('mouseleave', function () {
            d3.select(this).attr('r', dotRadius);
          });
          dot
            .style('cursor', 'pointer')
            .on('click', (event: MouseEvent) => {
              event.stopPropagation();
              void this.selectionManager.select(pt.selectionId, event.ctrlKey || event.metaKey);
            })
            .on('contextmenu', (event: MouseEvent) => {
              event.preventDefault();
              event.stopPropagation();
              void this.selectionManager.showContextMenu(pt.selectionId, {
                x: event.clientX,
                y: event.clientY,
              });
            });

          // Animate dot pop-in
          if (animEnabled) {
            const dotNode = dot.node();
            if (dotNode) {
              const dotDelay = seriesDelay + ptIdx * 40;
              const cancel = popIn(dotNode, dotDelay, 400);
              this.cancelAnimations.push(cancel);
            }
          }
        });
      }

      // ── Data Labels ─────────────────────────────────────────────
      if (showDataLabels) {
        validPoints.forEach((pt) => {
          chartGroup.append('text')
            .attr('class', 'area-data-label')
            .attr('x', pt.x)
            .attr('y', pt.y - dotRadius - 4)
            .attr('text-anchor', 'middle')
            .text(formatNumber(pt.val, { abbreviate: true }));
        });
      }
    });

    // Apply data label formatting from settings
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.area-data-label');

    // Apply axis and grid formatting from settings
    const svgEl = this.container.querySelector('svg');
    if (svgEl) {
      svgEl.querySelectorAll('[class*="area-axis"]').forEach((el) => {
        applyAxisFormatting(el as SVGGElement, this.settings.axisFormattingCard);
      });
      svgEl.querySelectorAll('[class*="area-grid"]').forEach((el) => {
        applyGridFormatting(el as SVGGElement, this.settings.axisFormattingCard);
      });
    }

    // Legend (bottom or right)
    if (showLegend && (legendPos === 'bottom' || legendPos === 'right')) {
      this.renderLegend(data, wrapper, legendPos);
    }
    this.container.addEventListener('click', this.handleBackgroundClick);
  }

  // ── Legend ─────────────────────────────────────────────────────────

  private renderLegend(
    data: ChartData,
    parent: HTMLElement,
    position: LegendPosition,
  ): void {
    const legendDiv = document.createElement('div');
    legendDiv.className = 'area-legend';

    if (position === 'left' || position === 'right') {
      legendDiv.style.display = 'flex';
      legendDiv.style.flexDirection = 'column';
      legendDiv.style.gap = '6px';
      legendDiv.style.padding = '8px';
      legendDiv.style.width = `${LEGEND_SIDE_WIDTH}px`;
      legendDiv.style.flexShrink = '0';
    }

    // Resolve legend font styling from the shared legendFormattingCard
    const legendFmtCard = this.settings.legendFormattingCard;
    const rawFontColor = legendFmtCard.legendFontColor.value?.value;
    const legendFontColor = rawFontColor != null && rawFontColor.length > 0 ? rawFontColor : '';
    const legendFontSize = legendFmtCard.legendFontSize.value;

    for (const series of data.series) {
      const item = document.createElement('div');
      item.className = 'area-legend-item';

      const swatch = document.createElement('div');
      swatch.className = 'area-legend-swatch';
      swatch.style.backgroundColor = series.color;
      item.appendChild(swatch);

      const label = document.createElement('span');
      label.textContent = series.name;
      if (legendFontColor.length > 0) label.style.color = legendFontColor;
      if (legendFontSize !== 11) label.style.fontSize = `${legendFontSize}px`;
      item.appendChild(label);

      legendDiv.appendChild(item);
    }

    // Animate legend entrance
    const animEnabled = this.settings.animationSettings.enabled.value;
    const animDuration = this.settings.animationSettings.duration.value;
    if (animEnabled) {
      const cancel = fadeSlideIn(
        legendDiv as unknown as HTMLElement,
        position === 'top' || position === 'left' ? 'down' : 'up',
        animDuration,
        300,
      );
      this.cancelAnimations.push(cancel);
    }

    parent.appendChild(legendDiv);
  }

  // ── Curve Mapping ─────────────────────────────────────────────────

  private getCurveFunction(): d3.CurveFactory {
    const curveType = this.getCurveType();
    switch (curveType) {
      case 'linear':
        return d3.curveLinear;
      case 'step':
        return d3.curveStep;
      case 'monotoneX':
      default:
        return d3.curveMonotoneX;
    }
  }

  // ── Tooltips ──────────────────────────────────────────────────────

  private attachDotTooltip(
    circle: d3.Selection<SVGCircleElement, unknown, null, undefined>,
    category: string,
    seriesName: string,
    value: number,
  ): void {
    const host = this.host;

    circle.on('mouseover', (event: MouseEvent) => {
      const tooltipData: VisualTooltipDataItem[] = [
        { displayName: 'Category', value: category },
        { displayName: seriesName, value: formatNumber(value, { abbreviate: false }) },
      ];

      host.tooltipService.show({
        dataItems: tooltipData,
        identities: [],
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
      });
    });

    circle.on('mousemove', (event: MouseEvent) => {
      host.tooltipService.move({
        dataItems: [],
        identities: [],
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
      });
    });

    circle.on('mouseout', () => {
      host.tooltipService.hide({ immediately: true, isTouchEvent: false });
    });
  }

  // ── Setting Accessors ─────────────────────────────────────────────

  private getCurveType(): CurveType {
    const val = this.settings.lineSettings.curve.value?.value;
    const valid: CurveType[] = ['monotoneX', 'linear', 'step'];
    if (typeof val === 'string' && valid.includes(val as CurveType)) {
      return val as CurveType;
    }
    return 'monotoneX';
  }

  private getLegendPosition(): LegendPosition {
    const val = this.settings.legendSettings.position.value?.value;
    const valid: LegendPosition[] = ['top', 'bottom', 'left', 'right'];
    if (typeof val === 'string' && valid.includes(val as LegendPosition)) {
      return val as LegendPosition;
    }
    return 'top';
  }

  // ── Formatting Model ──────────────────────────────────────────────

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private handleBackgroundClick = (): void => {
    void this.selectionManager.clear();
  };

  // ── Cleanup ───────────────────────────────────────────────────────

  public destroy(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }
}
