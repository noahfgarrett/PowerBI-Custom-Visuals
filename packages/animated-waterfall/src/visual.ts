/**
 * Animated Waterfall Chart — Power BI IVisual implementation.
 * Blocks drop Tetris-style with bounceOut easing, dashed connectors between steps,
 * glassmorphic card styling, and staggered entrance animations.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { AnimatedWaterfallSettings } from './settings';
import {
  fallIn,
  drawPath,
  fadeSlideIn,
  countUp,
  animate,
  bounceOut,
  cubicOut,
  DURATION,
  formatNumber,
  getGlassStyle,
  withOpacity,
  renderChartTitle,
  applyAxisFormatting,
  applyGridFormatting,
  applyDataLabelFormatting,
  applyAllAxisFormatting,
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import ISelectionId = powerbi.visuals.ISelectionId;

import '../style/visual.less';

// -- Types --------------------------------------------------------------------

interface WaterfallStep {
  key: string;
  label: string;
  value: number;
  runningTotal: number;
  previousRunningTotal: number;
  isPositive: boolean;
  isTotal: boolean;
  selectionId: ISelectionId;
}

interface WaterfallData {
  steps: WaterfallStep[];
  maxValue: number;
  minValue: number;
  isEmpty: boolean;
}

interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// -- Constants ----------------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg';
const MARGIN: Margin = { top: 20, right: 20, bottom: 50, left: 60 };
const MIN_BAR_HEIGHT = 2;

// -- Visual -------------------------------------------------------------------

export class AnimatedWaterfallVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: AnimatedWaterfallSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new AnimatedWaterfallSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('waterfall-container');
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel running animations before re-render
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        AnimatedWaterfallSettings,
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

  // -- Data Extraction --------------------------------------------------------

  private extractData(dataView: DataView | undefined): WaterfallData {
    const empty: WaterfallData = {
      steps: [],
      maxValue: 0,
      minValue: 0,
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

    if (categories.length === 0) return empty;

    // Find measure and isTotal columns by role
    let measureValues: (number | null)[] = [];
    let isTotalValues: (number | null)[] = [];
    let fallbackMeasureValues: (number | null)[] = [];

    for (const col of valuesColumns) {
      const numericValues = col.values.map((v) => (typeof v === 'number' ? v : null));
      if (fallbackMeasureValues.length === 0 && numericValues.some((v) => v !== null)) {
        fallbackMeasureValues = numericValues;
      }

      const role = col.source.roles;
      if (!role) continue;

      if (role['measure']) {
        measureValues = numericValues;
      }
      if (role['isTotal']) {
        isTotalValues = col.values.map((v) => {
          if (typeof v === 'number') return v;
          if (typeof v === 'boolean') return v ? 1 : 0;
          if (typeof v === 'string') {
            const normalized = v.trim().toLowerCase();
            if (normalized === 'true' || normalized === 'yes' || normalized === 'total') return 1;
            if (normalized === 'false' || normalized === 'no') return 0;
          }
          return null;
        });
      }
    }

    if (measureValues.length === 0) {
      measureValues = fallbackMeasureValues;
    }
    if (measureValues.length === 0) return empty;

    const showTotal = this.settings.waterfallSettings.showTotal.value;
    const hasIsTotalField = isTotalValues.length > 0;

    // Build waterfall steps
    const steps: WaterfallStep[] = [];
    let runningTotal = 0;

    const rowCount = Math.min(categories.length, measureValues.length);
    for (let i = 0; i < rowCount; i++) {
      const val = measureValues[i];
      if (val === null || val === undefined || !Number.isFinite(val)) continue;

      const isTotal = hasIsTotalField && isTotalValues[i] === 1;

      const previousRunningTotal = runningTotal;

      if (isTotal) {
        // Total bar shows its raw value; running total resets to that value
        runningTotal = val;
      } else {
        runningTotal += val;
      }

      steps.push({
        key: `${i}::${categories[i]}`,
        label: categories[i],
        value: val,
        runningTotal,
        previousRunningTotal,
        isPositive: val >= 0,
        isTotal,
        selectionId: this.host.createSelectionIdBuilder()
          .withCategory(categoryColumn, i)
          .createSelectionId(),
      });
    }

    // Append a synthetic total bar when showTotal is on and no explicit isTotal field
    if (showTotal && !hasIsTotalField && steps.length > 0) {
      steps.push({
        key: `${rowCount}::Total`,
        label: 'Total',
        value: runningTotal,
        runningTotal,
        previousRunningTotal: 0,
        isPositive: runningTotal >= 0,
        isTotal: true,
        selectionId: this.host.createSelectionIdBuilder().createSelectionId(),
      });
    }

    if (steps.length === 0) return empty;

    // Compute domain bounds across all running totals and 0
    const allTotals = steps.map((s) => s.runningTotal);
    const allPrevTotals = steps.map((s) => s.previousRunningTotal);
    const allValues = [...allTotals, ...allPrevTotals, 0];
    const maxValue = d3.max(allValues) ?? 0;
    const minValue = d3.min(allValues) ?? 0;

    return {
      steps,
      maxValue,
      minValue,
      isEmpty: false,
    };
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
    emptyEl.className = 'waterfall-empty';
    emptyEl.textContent = 'Add a Category and a Measure to get started.';
    this.container.appendChild(emptyEl);
  }

  // -- Main Render ------------------------------------------------------------

  private render(data: WaterfallData, viewport: powerbi.IViewport): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.container.removeEventListener('click', this.handleBackgroundClick);

    const s = this.settings;
    const padding = 8;
    const svgWidth = viewport.width - padding * 2;
    const svgHeight = viewport.height - padding * 2;
    const chartWidth = Math.max(0, svgWidth - MARGIN.left - MARGIN.right);
    const chartHeight = Math.max(0, svgHeight - MARGIN.top - MARGIN.bottom);

    if (chartWidth <= 0 || chartHeight <= 0) {
      this.renderEmpty();
      return;
    }

    // Create SVG
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'waterfall-svg');
    svg.setAttribute('width', String(svgWidth));
    svg.setAttribute('height', String(svgHeight));
    this.container.appendChild(svg);

    // Chart group with margins
    const chartGroup = document.createElementNS(SVG_NS, 'g');
    chartGroup.setAttribute('transform', `translate(${MARGIN.left},${MARGIN.top})`);
    svg.appendChild(chartGroup);

    // Scales
    const categories = data.steps.map((step) => step.key);
    const xScale = d3.scaleBand<string>()
      .domain(categories)
      .range([0, chartWidth])
      .paddingInner(0.2)
      .paddingOuter(0.1);

    // Y domain: from min(0, minValue) to max with 10% padding
    const yMin = Math.min(0, data.minValue);
    const yMax = data.maxValue;
    const yPadding = (yMax - yMin) * 0.1 || 10;
    const yScale = d3.scaleLinear()
      .domain([yMin - yPadding, yMax + yPadding])
      .nice()
      .range([chartHeight, 0]);

    // Grid lines
    this.renderGrid(chartGroup, yScale, chartWidth, chartHeight);

    // Axes
    this.renderAxes(chartGroup, xScale, yScale, chartWidth, chartHeight, data.steps);

    // Colors
    const positiveColor = s.colorSettings.positiveColor.value?.value ?? '#34D399';
    const negativeColor = s.colorSettings.negativeColor.value?.value ?? '#F87171';
    const totalColor = s.colorSettings.totalColor.value?.value ?? '#3B82F6';

    // Animation settings
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;
    const staggerDelay = s.animationSettings.staggerDelay.value;
    const showConnectors = s.waterfallSettings.showConnectors.value;
    const showValues = s.valueSettings.show.value;
    const fontSize = s.valueSettings.fontSize.value;

    // Render bars and connectors
    for (let i = 0; i < data.steps.length; i++) {
      const step = data.steps[i];
      const bandX = xScale(step.key) ?? 0;
      const bandWidth = xScale.bandwidth();

      // Bar width capped by setting (percentage of band)
      const barWidthPct = Math.min(s.waterfallSettings.barWidth.value, 100) / 100;
      const barWidth = Math.max(4, bandWidth * barWidthPct);
      const barX = bandX + (bandWidth - barWidth) / 2;

      let barTop: number;
      let barBottom: number;
      let barColor: string;

      if (step.isTotal) {
        // Total bar: from 0 to runningTotal
        barTop = yScale(Math.max(0, step.runningTotal));
        barBottom = yScale(Math.min(0, step.runningTotal));
        barColor = totalColor;
      } else if (step.isPositive) {
        // Positive step: bar goes up from previousRunningTotal to runningTotal
        barTop = yScale(step.runningTotal);
        barBottom = yScale(step.previousRunningTotal);
        barColor = positiveColor;
      } else {
        // Negative step: bar goes down from previousRunningTotal to runningTotal
        barTop = yScale(step.previousRunningTotal);
        barBottom = yScale(step.runningTotal);
        barColor = negativeColor;
      }

      const barHeight = Math.max(MIN_BAR_HEIGHT, barBottom - barTop);

      // Render bar
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('class', 'waterfall-bar');
      rect.setAttribute('x', String(barX));
      rect.setAttribute('y', String(barTop));
      rect.setAttribute('width', String(barWidth));
      rect.setAttribute('height', String(barHeight));
      rect.setAttribute('rx', String(this.settings.waterfallSettings.barCornerRadius.value));
      rect.setAttribute('ry', String(this.settings.waterfallSettings.barCornerRadius.value));
      rect.setAttribute('fill', barColor);
      const borderColor = this.settings.waterfallSettings.barBorderColor.value?.value;
      const borderWidth = this.settings.waterfallSettings.barBorderWidth.value;
      if (borderColor && borderWidth > 0) {
        rect.style.setProperty('stroke', borderColor);
        rect.style.setProperty('stroke-width', `${borderWidth}px`);
      }
      chartGroup.appendChild(rect);

      // Tooltip
      this.attachTooltip(rect, step);
      rect.style.cursor = 'pointer';
      rect.addEventListener('click', (event: MouseEvent) => {
        event.stopPropagation();
        void this.selectionManager.select(step.selectionId, event.ctrlKey || event.metaKey);
      });
      rect.addEventListener('contextmenu', (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        void this.selectionManager.showContextMenu(step.selectionId, {
          x: event.clientX,
          y: event.clientY,
        });
      });

      // Animation: Tetris-style drop with bounceOut
      if (animEnabled) {
        const delay = i * staggerDelay;
        const cancel = fallIn(
          rect as unknown as HTMLElement,
          delay,
          animDuration,
          40,
        );
        this.cancelAnimations.push(cancel);
      }

      // Connector line from previous bar to current bar
      if (showConnectors && i > 0 && !step.isTotal) {
        const prevStep = data.steps[i - 1];
        const prevBandX = xScale(prevStep.key) ?? 0;
        const prevBandWidth = xScale.bandwidth();
        const prevBarWidth = Math.max(4, prevBandWidth * barWidthPct);
        const prevBarX = prevBandX + (prevBandWidth - prevBarWidth) / 2;

        // Connector goes from right edge of previous bar at previous running total
        // to left edge of current bar at current bar's starting point
        const connectorY = yScale(step.previousRunningTotal);
        const connectorX1 = prevBarX + prevBarWidth;
        const connectorX2 = barX;

        const connectorColor = this.settings.connectorSettings?.connectorColor.value?.value || '#94A3B8';
        const connectorW = String(this.settings.connectorSettings?.connectorWidth.value || 1);
        const cStyleVal = (this.settings.connectorSettings?.connectorStyle?.value as unknown as { value?: string })?.value;
        const connectorDash = cStyleVal === 'solid' ? 'none' : '4 2';

        const connector = document.createElementNS(SVG_NS, 'line');
        connector.setAttribute('class', 'waterfall-connector');
        connector.setAttribute('x1', String(connectorX1));
        connector.setAttribute('y1', String(connectorY));
        connector.setAttribute('x2', String(connectorX2));
        connector.setAttribute('y2', String(connectorY));
        connector.style.setProperty('stroke', connectorColor);
        connector.style.setProperty('stroke-width', connectorW);
        connector.style.setProperty('stroke-dasharray', connectorDash);
        chartGroup.appendChild(connector);

        // Animate connector: fade in after connected blocks land
        if (animEnabled) {
          const connectorDelay = i * staggerDelay + animDuration * 0.5;
          // drawPath needs a path element, so create a path for the line
          const connectorPath = document.createElementNS(SVG_NS, 'path');
          connectorPath.setAttribute('d',
            `M${connectorX1},${connectorY} L${connectorX2},${connectorY}`);
          connectorPath.setAttribute('class', 'waterfall-connector');
          connectorPath.style.setProperty('stroke', connectorColor);
          connectorPath.style.setProperty('stroke-width', connectorW);
          connectorPath.style.setProperty('stroke-dasharray', connectorDash);
          connectorPath.setAttribute('fill', 'none');
          chartGroup.appendChild(connectorPath);

          // Remove the line element and use the path instead
          chartGroup.removeChild(connector);

          const cancel = drawPath(connectorPath, DURATION.fast, connectorDelay);
          this.cancelAnimations.push(cancel);

          // drawPath overrides stroke-dasharray for its reveal animation.
          // Restore the user's connector style after the animation completes.
          if (connectorDash !== 'none') {
            const restoreId = setTimeout(() => {
              connectorPath.style.setProperty('stroke-dasharray', connectorDash);
              connectorPath.style.setProperty('stroke-dashoffset', '');
            }, connectorDelay + DURATION.fast + 50);
            this.cancelAnimations.push(() => clearTimeout(restoreId));
          }
        }
      }

      // Value label
      if (showValues) {
        const labelValue = step.isTotal ? step.runningTotal : step.value;
        const formattedValue = formatNumber(labelValue, { abbreviate: true, showSign: !step.isTotal });
        const labelX = barX + barWidth / 2;

        // Position label above positive bars, below negative bars
        let labelY: number;
        if (step.isTotal) {
          labelY = barTop - 6;
        } else if (step.isPositive) {
          labelY = barTop - 6;
        } else {
          labelY = barBottom + fontSize + 4;
        }

        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('class', 'waterfall-value');
        text.setAttribute('x', String(labelX));
        text.setAttribute('y', String(labelY));
        text.setAttribute('text-anchor', 'middle');
        text.style.setProperty('font-size', `${fontSize}px`);
        text.textContent = formattedValue;
        chartGroup.appendChild(text);

        // Animate value labels
        if (animEnabled) {
          const labelDelay = i * staggerDelay + animDuration * 0.4;
          const cancel = fadeSlideIn(
            text as unknown as HTMLElement,
            'up',
            DURATION.fast,
            labelDelay,
          );
          this.cancelAnimations.push(cancel);
        }
      }
    }

    // Apply shared formatting settings
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.waterfall-value');
    applyAllAxisFormatting(this.container, this.settings.axisFormattingCard, '.waterfall-axis', '.waterfall-grid');

    this.container.addEventListener('click', this.handleBackgroundClick);
  }

  // -- Grid -------------------------------------------------------------------

  private renderGrid(
    g: SVGGElement,
    yScale: d3.ScaleLinear<number, number>,
    width: number,
    _height: number,
  ): void {
    const gridGroup = document.createElementNS(SVG_NS, 'g');
    gridGroup.setAttribute('class', 'waterfall-grid');
    const ticks = yScale.ticks(6);

    for (const tick of ticks) {
      const y = yScale(tick);
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('class', 'waterfall-grid-line');
      line.setAttribute('x1', '0');
      line.setAttribute('y1', String(y));
      line.setAttribute('x2', String(width));
      line.setAttribute('y2', String(y));
      gridGroup.appendChild(line);
    }
    g.appendChild(gridGroup);
  }

  // -- Axes -------------------------------------------------------------------

  private renderAxes(
    g: SVGGElement,
    xScale: d3.ScaleBand<string>,
    yScale: d3.ScaleLinear<number, number>,
    width: number,
    height: number,
    steps: WaterfallStep[],
  ): void {
    const s = this.settings;
    const labelByKey = new Map(steps.map((step) => [step.key, step.label]));

    // X-Axis
    if (s.axisSettings.showXAxis.value) {
      const xAxisGroup = document.createElementNS(SVG_NS, 'g');
      xAxisGroup.setAttribute('class', 'waterfall-axis waterfall-axis-x');
      xAxisGroup.setAttribute('transform', `translate(0,${height})`);
      g.appendChild(xAxisGroup);

      const keys = xScale.domain();
      for (const key of keys) {
        const x = (xScale(key) ?? 0) + xScale.bandwidth() / 2;
        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('x', String(x));
        text.setAttribute('y', '16');
        text.setAttribute('text-anchor', 'middle');
        text.textContent = labelByKey.get(key) ?? '';
        xAxisGroup.appendChild(text);

        // Rotate if many categories
        if (keys.length > 8) {
          text.setAttribute('transform', `rotate(-35, ${x}, 16)`);
          text.setAttribute('text-anchor', 'end');
        }
      }

      // Axis line
      const axisLine = document.createElementNS(SVG_NS, 'line');
      axisLine.setAttribute('x1', '0');
      axisLine.setAttribute('y1', '0');
      axisLine.setAttribute('x2', String(width));
      axisLine.setAttribute('y2', '0');
      xAxisGroup.appendChild(axisLine);
    }

    // Y-Axis
    if (s.axisSettings.showYAxis.value) {
      const yAxisGroup = document.createElementNS(SVG_NS, 'g');
      yAxisGroup.setAttribute('class', 'waterfall-axis waterfall-axis-y');
      g.appendChild(yAxisGroup);

      const ticks = yScale.ticks(6);
      for (const tick of ticks) {
        const y = yScale(tick);
        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('x', '-8');
        text.setAttribute('y', String(y + 4));
        text.setAttribute('text-anchor', 'end');
        text.textContent = formatNumber(tick, { abbreviate: true });
        yAxisGroup.appendChild(text);
      }

      // Axis line
      const axisLine = document.createElementNS(SVG_NS, 'line');
      axisLine.setAttribute('x1', '0');
      axisLine.setAttribute('y1', '0');
      axisLine.setAttribute('x2', '0');
      axisLine.setAttribute('y2', String(height));
      yAxisGroup.appendChild(axisLine);
    }
  }

  // -- Tooltips ---------------------------------------------------------------

  private attachTooltip(rect: SVGRectElement, step: WaterfallStep): void {
    const host = this.host;

    rect.addEventListener('mouseover', (event: MouseEvent) => {
      const tooltipItems: VisualTooltipDataItem[] = [
        { displayName: 'Step', value: step.label },
        {
          displayName: step.isTotal ? 'Total' : 'Change',
          value: formatNumber(step.value, { abbreviate: false, showSign: !step.isTotal }),
        },
        {
          displayName: 'Running Total',
          value: formatNumber(step.runningTotal, { abbreviate: false }),
        },
      ];

      host.tooltipService.show({
        dataItems: tooltipItems,
        identities: [],
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
      });
    });

    rect.addEventListener('mousemove', (event: MouseEvent) => {
      host.tooltipService.move({
        dataItems: [],
        identities: [],
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
      });
    });

    rect.addEventListener('mouseout', () => {
      host.tooltipService.hide({ immediately: true, isTouchEvent: false });
    });
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
