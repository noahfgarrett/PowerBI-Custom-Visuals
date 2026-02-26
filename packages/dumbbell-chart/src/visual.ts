/**
 * Dumbbell Chart — Power BI IVisual implementation.
 * Horizontal chart showing two dots connected by a line per category
 * (start vs end comparison) with glassmorphic styling and staggered animations.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { DumbbellChartSettings } from './settings';
import {
  popIn,
  drawPath,
  fadeSlideIn,
  animate,
  cubicOut,
  DURATION,
  formatNumber,
  getGlassStyle,
  withOpacity,
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
import ISelectionId = powerbi.visuals.ISelectionId;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import '../style/visual.less';

// -- Types --------------------------------------------------------------------

interface DumbbellRow {
  key: string;
  label: string;
  start: number;
  end: number;
  selectionId: ISelectionId;
}

interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// -- Constants ----------------------------------------------------------------

const MARGIN_DEFAULT: Margin = { top: 20, right: 30, bottom: 40, left: 100 };
const LEGEND_HEIGHT = 28;
const STAGGER_DELAY = DURATION.stagger;

// -- Visual -------------------------------------------------------------------

export class DumbbellChartVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: DumbbellChartSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new DumbbellChartSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('dumbbell-container');
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel running animations before re-render
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        DumbbellChartSettings,
        dataView,
      );
    }

    // Apply glass effect
    this.applyCardStyle();

    // Extract data
    const rows = this.extractData(dataView);

    // Render
    if (rows.length === 0) {
      this.renderEmpty();
    } else {
      this.render(rows, options.viewport);
    }
  }

  // -- Data Extraction --------------------------------------------------------

  private extractData(dataView: DataView | undefined): DumbbellRow[] {
    if (!dataView?.categorical) return [];

    const categorical = dataView.categorical;
    const categoryColumn = categorical.categories?.[0];
    const valuesColumns = categorical.values;

    if (!categoryColumn || !valuesColumns || valuesColumns.length === 0) return [];

    // Find start and end value columns by role
    let startCol: powerbi.DataViewValueColumn | undefined;
    let endCol: powerbi.DataViewValueColumn | undefined;
    const numericColumns = valuesColumns.filter((col) =>
      col.values.some((v) => typeof v === 'number'),
    );

    for (const col of valuesColumns) {
      const role = col.source.roles;
      if (!role) continue;
      if (role['startValue']) startCol = col;
      if (role['endValue']) endCol = col;
    }

    if (!startCol || !endCol) {
      if (!startCol) startCol = numericColumns[0];
      if (!endCol) endCol = numericColumns[1];
    }
    if (!startCol || !endCol) return [];

    const rows: DumbbellRow[] = [];

    for (let i = 0; i < categoryColumn.values.length; i++) {
      const label = categoryColumn.values[i];
      const startVal = startCol.values[i];
      const endVal = endCol.values[i];

      if (
        label === null || label === undefined ||
        typeof startVal !== 'number' ||
        typeof endVal !== 'number'
      ) {
        continue;
      }

      rows.push({
        key: `${i}::${String(label)}`,
        label: String(label),
        start: startVal,
        end: endVal,
        selectionId: this.host.createSelectionIdBuilder()
          .withCategory(categoryColumn, i)
          .createSelectionId(),
      });
    }

    return rows;
  }

  // -- Card Style -------------------------------------------------------------

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
      // Reset glass styles
      this.container.style.background = '';
      this.container.style.backdropFilter = '';
      (this.container.style as unknown as Record<string, string>)['WebkitBackdropFilter'] = '';
      this.container.style.border = '';
      this.container.style.boxShadow = '';
      this.container.style.borderRadius = `${s.borderRadius.value}px`;
    }
  }

  // -- Empty State ------------------------------------------------------------

  private renderEmpty(): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    const emptyEl = document.createElement('div');
    emptyEl.className = 'dumbbell-empty';
    emptyEl.textContent = 'Add Category, Start Value, and End Value';
    this.container.appendChild(emptyEl);
  }

  // -- Main Render ------------------------------------------------------------

  private render(rows: DumbbellRow[], viewport: powerbi.IViewport): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.container.removeEventListener('click', this.handleBackgroundClick);

    const s = this.settings;
    const margin = { ...MARGIN_DEFAULT };

    if (!s.axisSettings.showXAxis.value) margin.bottom = 8;
    if (!s.axisSettings.showYAxis.value) margin.left = 8;

    // Legend
    const showLegend = s.legendFormattingCard.showLegend.value;
    const legendPosRaw = s.legendFormattingCard.legendPosition.value;
    const legendPos = (typeof legendPosRaw === 'string'
      ? legendPosRaw
      : (legendPosRaw as { value?: string })?.value) ?? 'bottom';
    const legendReserve = showLegend ? LEGEND_HEIGHT : 0;

    // Compute chart dimensions
    const padding = 8; // CSS padding on container
    const svgWidth = viewport.width - padding * 2;
    const svgHeight = viewport.height - padding * 2 - legendReserve;
    const chartWidth = Math.max(0, svgWidth - margin.left - margin.right);
    const chartHeight = Math.max(0, svgHeight - margin.top - margin.bottom);

    if (chartWidth <= 0 || chartHeight <= 0) {
      this.renderEmpty();
      return;
    }

    // Settings values
    const dotRadius = s.dumbbellSettings.dotRadius.value;
    const lineWidth = s.dumbbellSettings.lineWidth.value;
    const startColor = s.dumbbellSettings.startColor.value?.value ?? '#94A3B8';
    const endColor = s.dumbbellSettings.endColor.value?.value ?? '#3B82F6';
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;

    // Legend (top)
    if (showLegend && legendPos === 'top') {
      this.renderLegend(startColor, endColor);
    }

    // SVG
    const svg = d3.select(this.container)
      .append('svg')
      .attr('class', 'dumbbell-svg')
      .attr('width', svgWidth)
      .attr('height', svgHeight);

    const chartGroup = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Data labels
    const showDataLabels = s.dataLabelFormattingCard.showDataLabels.value;

    // Dumbbell-specific settings — apply if set, otherwise use fallback
    const lineColorValue = s.dumbbellSettings.lineColor.value?.value;
    const resolvedLineColor = lineColorValue && lineColorValue.length > 0 ? lineColorValue : withOpacity(endColor, 0.35);
    const dotStrokeColorValue = s.dumbbellSettings.dotStrokeColor.value?.value;
    const dotStrokeColor = dotStrokeColorValue && dotStrokeColorValue.length > 0 ? dotStrokeColorValue : '#FFFFFF';
    const dotStrokeWidth = s.dumbbellSettings.dotStrokeWidth.value;

    const labelByKey = new Map(rows.map((r) => [r.key, r.label]));

    // Y-axis: scaleBand for categories (rows)
    const yScale = d3.scaleBand()
      .domain(rows.map((r) => r.key))
      .range([0, chartHeight])
      .paddingInner(0.3)
      .paddingOuter(0.15);

    // X-axis: scaleLinear from min to max of all values
    const allValues = rows.flatMap((r) => [r.start, r.end]);
    const dataMin = d3.min(allValues) ?? 0;
    const dataMax = d3.max(allValues) ?? 0;
    const valuePadding = (dataMax - dataMin) * 0.08 || 1;

    const xScale = d3.scaleLinear()
      .domain([dataMin - valuePadding, dataMax + valuePadding])
      .nice()
      .range([0, chartWidth]);

    // Grid lines (vertical)
    chartGroup.append('g')
      .attr('class', 'dumbbell-grid')
      .call(
        d3.axisBottom(xScale)
          .ticks(6)
          .tickSize(chartHeight)
          .tickFormat(() => ''),
      )
      .attr('transform', 'translate(0,0)');

    // Axes
    if (s.axisSettings.showYAxis.value) {
      chartGroup.append('g')
        .attr('class', 'dumbbell-axis dumbbell-axis-y')
        .call(
          d3.axisLeft(yScale)
            .tickSize(0)
            .tickFormat((d) => labelByKey.get(String(d)) ?? String(d)),
        )
        .select('.domain').remove();
    }

    if (s.axisSettings.showXAxis.value) {
      chartGroup.append('g')
        .attr('class', 'dumbbell-axis dumbbell-axis-x')
        .attr('transform', `translate(0,${chartHeight})`)
        .call(
          d3.axisBottom(xScale)
            .ticks(6)
            .tickFormat((d) => formatNumber(d as number, { abbreviate: true })),
        )
        .select('.domain').remove();
    }

    // Render dumbbell rows
    const bandMiddle = yScale.bandwidth() / 2;

    rows.forEach((row, rowIdx) => {
      const cy = (yScale(row.key) ?? 0) + bandMiddle;
      const x1 = xScale(row.start);
      const x2 = xScale(row.end);
      const delay = rowIdx * STAGGER_DELAY;

      // Connecting line (rendered as SVG path for drawPath animation)
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);

      const pathEl = chartGroup.append('path')
        .attr('class', 'dumbbell-line')
        .attr('d', `M${minX},${cy} L${maxX},${cy}`)
        .attr('stroke', resolvedLineColor)
        .attr('stroke-width', lineWidth)
        .attr('fill', 'none');
      this.attachSelection(pathEl, row.selectionId);

      if (animEnabled) {
        const pathNode = pathEl.node();
        if (pathNode) {
          const cancelDraw = drawPath(pathNode, animDuration, delay);
          this.cancelAnimations.push(cancelDraw);

          // Fade in the line opacity alongside the draw animation
          pathNode.style.opacity = '0';
          const cancelFade = animate(animDuration, cubicOut, (progress) => {
            pathNode.style.opacity = `${progress}`;
          });
          this.cancelAnimations.push(cancelFade);
        }
      }

      // Start dot
      const startDot = chartGroup.append('circle')
        .attr('class', 'dumbbell-dot dumbbell-dot-start')
        .attr('cx', x1)
        .attr('cy', cy)
        .attr('r', dotRadius)
        .attr('fill', startColor)
        .attr('stroke', dotStrokeColor)
        .attr('stroke-width', dotStrokeWidth);
      this.attachSelection(startDot, row.selectionId);

      this.attachDotTooltip(startDot, row.label, 'Start', row.start);

      // End dot
      const endDot = chartGroup.append('circle')
        .attr('class', 'dumbbell-dot dumbbell-dot-end')
        .attr('cx', x2)
        .attr('cy', cy)
        .attr('r', dotRadius)
        .attr('fill', endColor)
        .attr('stroke', dotStrokeColor)
        .attr('stroke-width', dotStrokeWidth);
      this.attachSelection(endDot, row.selectionId);

      this.attachDotTooltip(endDot, row.label, 'End', row.end);

      // Data labels
      if (showDataLabels) {
        const labelOffset = dotRadius + 4;

        chartGroup.append('text')
          .attr('class', 'dumbbell-data-label')
          .attr('x', x1)
          .attr('y', cy - labelOffset)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'auto')
          .text(formatNumber(row.start, { abbreviate: true }));

        chartGroup.append('text')
          .attr('class', 'dumbbell-data-label')
          .attr('x', x2)
          .attr('y', cy - labelOffset)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'auto')
          .text(formatNumber(row.end, { abbreviate: true }));
      }

      // Animate dots
      if (animEnabled) {
        const startNode = startDot.node();
        if (startNode) {
          const cancel = popIn(startNode, delay + animDuration * 0.3);
          this.cancelAnimations.push(cancel);
        }

        const endNode = endDot.node();
        if (endNode) {
          const cancel = popIn(endNode, delay + animDuration * 0.5);
          this.cancelAnimations.push(cancel);
        }
      }
    });

    // Apply axis and grid formatting from settings
    const svgEl = this.container.querySelector('svg');
    if (svgEl) {
      svgEl.querySelectorAll('[class*="dumbbell-axis"]').forEach((el) => {
        applyAxisFormatting(el as SVGGElement, this.settings.axisFormattingCard);
      });
      svgEl.querySelectorAll('[class*="dumbbell-grid"]').forEach((el) => {
        applyGridFormatting(el as SVGGElement, this.settings.axisFormattingCard);
      });
    }

    // Apply data label formatting from settings
    if (showDataLabels) {
      applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.dumbbell-data-label');
    }

    // Legend (bottom)
    if (showLegend && legendPos !== 'top') {
      this.renderLegend(startColor, endColor);
    }

    this.container.addEventListener('click', this.handleBackgroundClick);

    // Animate the Y-axis labels with fadeSlideIn
    if (animEnabled && s.axisSettings.showYAxis.value) {
      const yAxisTexts = this.container.querySelectorAll('.dumbbell-axis-y .tick text');
      yAxisTexts.forEach((textEl, idx) => {
        const cancel = fadeSlideIn(
          textEl as unknown as HTMLElement,
          'left',
          animDuration,
          idx * STAGGER_DELAY,
        );
        this.cancelAnimations.push(cancel);
      });
    }
  }

  // -- Tooltips ---------------------------------------------------------------

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

  private attachSelection<E extends SVGElement>(
    node: d3.Selection<E, unknown, null, undefined>,
    selectionId: ISelectionId,
  ): void {
    node.style('cursor', 'pointer');
    node.on('click.selection', (event: MouseEvent) => {
      event.stopPropagation();
      void this.selectionManager.select(selectionId, event.ctrlKey || event.metaKey);
    });
    node.on('contextmenu.selection', (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      void this.selectionManager.showContextMenu(selectionId, {
        x: event.clientX,
        y: event.clientY,
      });
    });
  }

  // -- Legend -----------------------------------------------------------------

  private renderLegend(startColor: string, endColor: string): void {
    const legendFmtCard = this.settings.legendFormattingCard;
    const rawFontColor = legendFmtCard.legendFontColor.value?.value;
    const legendFontColor = rawFontColor != null && rawFontColor.length > 0 ? rawFontColor : '';
    const legendFontSize = legendFmtCard.legendFontSize.value;

    const legendDiv = document.createElement('div');
    legendDiv.className = 'dumbbell-legend';

    const entries: Array<{ label: string; color: string }> = [
      { label: 'Start', color: startColor },
      { label: 'End', color: endColor },
    ];

    for (const entry of entries) {
      const item = document.createElement('div');
      item.className = 'dumbbell-legend-item';

      const swatch = document.createElement('div');
      swatch.className = 'dumbbell-legend-swatch';
      swatch.style.backgroundColor = entry.color;
      item.appendChild(swatch);

      const label = document.createElement('span');
      label.textContent = entry.label;
      if (legendFontColor.length > 0) label.style.color = legendFontColor;
      if (legendFontSize !== 11) label.style.fontSize = `${legendFontSize}px`;
      item.appendChild(label);

      legendDiv.appendChild(item);
    }

    this.container.appendChild(legendDiv);
  }

  // -- Formatting Model -------------------------------------------------------

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private handleBackgroundClick = (): void => {
    void this.selectionManager.clear();
  };

  // -- Cleanup ----------------------------------------------------------------

  public destroy(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }
}
