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
  formatWithSettings,
  getGlassStyle,
  withOpacity,
  renderChartTitle,
  applyAxisFormatting,
  applyGridFormatting,
  applyDataLabelFormatting,
  applyAllAxisFormatting,
  createScrollableChart,
  buildConditionalConfig,
  resolveConditionalColor,
  resolveDropdown,
  applyChartAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
  renderHorizontalReferenceLine,
  computeStatValue,
  type StatType,
  renderTrendLine,
  computeRegression,
  type TrendType,
  renderAnnotations,
  buildAnnotationConfig,
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
  isSubtotal: boolean;
  selectionId: ISelectionId;
}

interface WaterfallData {
  steps: WaterfallStep[];
  maxValue: number;
  minValue: number;
  isEmpty: boolean;
  /** Whether sub-category data is available for drill-down */
  hasSubCategory: boolean;
  /** Map from category label to its sub-category WaterfallData */
  subCategoryMap: Map<string, WaterfallData>;
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

  /** Chain of category values the user has drilled into */
  private drillPath: string[] = [];
  /** Full extracted data, kept for drill-down without re-parsing */
  private currentData: WaterfallData | null = null;
  /** Last known viewport for re-renders on drill navigation */
  private currentViewport: powerbi.IViewport = { width: 300, height: 300 };

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

    // Hide shared axis toggles that are shadowed by local settings
    this.settings.axisFormattingCard.showXAxis.visible = false;
    this.settings.axisFormattingCard.showYAxis.visible = false;
    this.settings.axisFormattingCard.xAxisTitle.visible = false;
    this.settings.axisFormattingCard.yAxisTitle.visible = false;
    this.settings.axisFormattingCard.yAxisMin.visible = false;
    this.settings.axisFormattingCard.yAxisMax.visible = false;
    this.settings.dataLabelFormattingCard.showDataLabels.visible = false;

    // ── Conditional visibility ──────────────────────────────────────
    // Subtotal sub-settings: hide when subtotals disabled
    const subtotalOn = this.settings.subtotalSettings.enabled.value;
    this.settings.subtotalSettings.subtotalColor.visible = subtotalOn;
    this.settings.subtotalSettings.subtotalLabel.visible = subtotalOn;
    this.settings.subtotalSettings.indices.visible = subtotalOn;

    // Drill-down sub-settings: hide when drill disabled
    const drillOn = this.settings.drillDownSettings.enabled.value;
    this.settings.drillDownSettings.showBreadcrumb.visible = drillOn;
    this.settings.drillDownSettings.breadcrumbFontSize.visible = drillOn;
    this.settings.drillDownSettings.breadcrumbColor.visible = drillOn;

    // Summary banner fontSize: hide when banner off
    this.settings.waterfallSummary.fontSize.visible = this.settings.waterfallSummary.show.value;

    // Connector sub-settings: hide when showConnectors false
    const connectorsOn = this.settings.waterfallSettings.showConnectors.value;
    this.settings.connectorSettings.connectorColor.visible = connectorsOn;
    this.settings.connectorSettings.connectorWidth.visible = connectorsOn;
    this.settings.connectorSettings.connectorStyle.visible = connectorsOn;

    // Total bar sub-settings: hide when total bar off
    const totalBarOn = this.settings.waterfallTotalBar.show.value;
    this.settings.waterfallTotalBar.label.visible = totalBarOn;
    this.settings.waterfallTotalBar.color.visible = totalBarOn;

    // Extract data
    const data = this.extractData(dataView);
    this.currentData = data;
    this.currentViewport = options.viewport;

    // Reset drill if data changed structurally
    if (data.isEmpty || !data.hasSubCategory) {
      this.drillPath = [];
    }

    // Apply glass effect
    this.applyCardStyle();

    // Resolve drill path to get the effective data
    const effectiveData = this.resolveDrillData(data);

    // Render
    if (effectiveData.isEmpty) {
      this.renderEmpty();
    } else {
      this.render(effectiveData, options.viewport);
    }
  }

  // -- Data Extraction --------------------------------------------------------

  private extractData(dataView: DataView | undefined): WaterfallData {
    const empty: WaterfallData = {
      steps: [],
      maxValue: 0,
      minValue: 0,
      isEmpty: true,
      hasSubCategory: false,
      subCategoryMap: new Map<string, WaterfallData>(),
    };

    if (!dataView?.categorical) return empty;

    const categorical = dataView.categorical;
    const categoryColumn = categorical.categories?.[0];
    const subCategoryColumn = categorical.categories && categorical.categories.length > 1
      ? categorical.categories[1]
      : null;
    const valuesColumns = categorical.values;

    if (!categoryColumn || !valuesColumns || valuesColumns.length === 0) return empty;

    const hasSubCategory = subCategoryColumn !== null;

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

    const showTotal = this.settings.waterfallTotalBar.show.value;
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
        isSubtotal: false,
        selectionId: this.host.createSelectionIdBuilder()
          .withCategory(categoryColumn, i)
          .createSelectionId(),
      });
    }

    // Insert subtotal bars at the specified positions (before appending synthetic total)
    const subtotalS = this.settings.subtotalSettings;
    if (subtotalS.enabled.value && subtotalS.indices.value.trim().length > 0) {
      const subtotalLabel = subtotalS.subtotalLabel.value || 'Subtotal';

      // Parse 1-based indices, convert to 0-based, sort descending so inserts don't shift earlier indices
      const parsedIndices = subtotalS.indices.value
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n >= 1)
        .map((n) => n - 1) // convert to 0-based
        .filter((idx) => idx < steps.length) // only valid positions
        .filter((v, i, arr) => arr.indexOf(v) === i) // deduplicate
        .sort((a, b) => b - a); // descending so inserts don't shift

      for (const idx of parsedIndices) {
        // The subtotal value is the running total at the step at position idx
        const targetStep = steps[idx];
        const subtotalValue = targetStep.runningTotal;

        const subtotalEntry: WaterfallStep = {
          key: `subtotal::${idx}::${subtotalLabel}`,
          label: subtotalLabel,
          value: subtotalValue,
          runningTotal: subtotalValue,
          previousRunningTotal: subtotalValue, // same as runningTotal for connector alignment
          isPositive: subtotalValue >= 0,
          isTotal: false,
          isSubtotal: true,
          selectionId: this.host.createSelectionIdBuilder().createSelectionId(),
        };

        // Insert after the target position (idx + 1)
        steps.splice(idx + 1, 0, subtotalEntry);
      }
    }

    // Append a synthetic total bar when showTotal is on and no explicit isTotal field
    if (showTotal && !hasIsTotalField && steps.length > 0) {
      // Recalculate running total from the last non-subtotal step
      const lastNonSubtotal = [...steps].reverse().find((s) => !s.isSubtotal);
      const finalRunningTotal = lastNonSubtotal ? lastNonSubtotal.runningTotal : runningTotal;
      const totalLabel = this.settings.waterfallTotalBar.label.value || 'Total';
      steps.push({
        key: `${rowCount}::${totalLabel}`,
        label: totalLabel,
        value: finalRunningTotal,
        runningTotal: finalRunningTotal,
        previousRunningTotal: 0,
        isPositive: finalRunningTotal >= 0,
        isTotal: true,
        isSubtotal: false,
        selectionId: this.host.createSelectionIdBuilder().createSelectionId(),
      });
    }

    if (steps.length === 0) return empty;

    // Sort by absolute contribution if enabled (only non-total, non-subtotal steps)
    if (this.settings.waterfallSort.sortByContribution.value) {
      // Separate total/subtotal entries from regular steps
      const regularSteps = steps.filter((s) => !s.isTotal && !s.isSubtotal);
      const totalSteps = steps.filter((s) => s.isTotal);
      const subtotalSteps = steps.filter((s) => s.isSubtotal);

      // Sort regular steps by absolute value descending
      regularSteps.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

      // Recalculate running totals after sorting
      let newRunning = 0;
      for (const step of regularSteps) {
        step.previousRunningTotal = newRunning;
        newRunning += step.value;
        step.runningTotal = newRunning;
      }

      // Re-assemble: regular steps first, then any subtotals, then total
      steps.length = 0;
      steps.push(...regularSteps, ...subtotalSteps);

      // Update total bar's running total
      for (const t of totalSteps) {
        t.runningTotal = newRunning;
        t.previousRunningTotal = 0;
        t.value = newRunning;
        steps.push(t);
      }
    }

    // Compute domain bounds across all running totals and 0
    const allTotals = steps.map((s) => s.runningTotal);
    const allPrevTotals = steps.map((s) => s.previousRunningTotal);
    const allValues = [...allTotals, ...allPrevTotals, 0];
    const maxValue = d3.max(allValues) ?? 0;
    const minValue = d3.min(allValues) ?? 0;

    // Build sub-category map for drill-down
    const subCategoryMap = new Map<string, WaterfallData>();

    if (hasSubCategory && subCategoryColumn) {
      // Group rows by parent category
      const catGroups = new Map<string, number[]>();
      for (let i = 0; i < categories.length; i++) {
        const catLabel = categories[i];
        const existing = catGroups.get(catLabel);
        if (existing) {
          existing.push(i);
        } else {
          catGroups.set(catLabel, [i]);
        }
      }

      for (const [catLabel, rowIndices] of catGroups) {
        const subSteps: WaterfallStep[] = [];
        let subRunningTotal = 0;

        for (const ri of rowIndices) {
          const val = measureValues[ri];
          if (val === null || val === undefined || !Number.isFinite(val)) continue;

          const subRaw = subCategoryColumn.values[ri];
          const subLabel = subRaw !== null && subRaw !== undefined ? String(subRaw) : '';

          const previousSubRunning = subRunningTotal;
          subRunningTotal += val;

          subSteps.push({
            key: `${subSteps.length}::${subLabel}`,
            label: subLabel,
            value: val,
            runningTotal: subRunningTotal,
            previousRunningTotal: previousSubRunning,
            isPositive: val >= 0,
            isTotal: false,
            isSubtotal: false,
            selectionId: this.host.createSelectionIdBuilder()
              .withCategory(categoryColumn, ri)
              .withCategory(subCategoryColumn, ri)
              .createSelectionId(),
          });
        }

        if (subSteps.length > 0) {
          // Add a total bar for the sub-category view
          subSteps.push({
            key: `${subSteps.length}::Total`,
            label: 'Total',
            value: subRunningTotal,
            runningTotal: subRunningTotal,
            previousRunningTotal: 0,
            isPositive: subRunningTotal >= 0,
            isTotal: true,
            isSubtotal: false,
            selectionId: this.host.createSelectionIdBuilder().createSelectionId(),
          });

          const subAllTotals = subSteps.map((s) => s.runningTotal);
          const subAllPrev = subSteps.map((s) => s.previousRunningTotal);
          const subAllVals = [...subAllTotals, ...subAllPrev, 0];

          subCategoryMap.set(catLabel, {
            steps: subSteps,
            maxValue: d3.max(subAllVals) ?? 0,
            minValue: d3.min(subAllVals) ?? 0,
            isEmpty: false,
            hasSubCategory: false,
            subCategoryMap: new Map<string, WaterfallData>(),
          });
        }
      }
    }

    return {
      steps,
      maxValue,
      minValue,
      isEmpty: false,
      hasSubCategory,
      subCategoryMap,
    };
  }

  // -- Drill-Down Resolution --------------------------------------------------

  private resolveDrillData(data: WaterfallData): WaterfallData {
    if (!this.settings.drillDownSettings.enabled.value || this.drillPath.length === 0) {
      return data;
    }

    let current = data;
    for (const segment of this.drillPath) {
      const sub = current.subCategoryMap.get(segment);
      if (sub) {
        current = sub;
      } else {
        this.drillPath = [];
        return data;
      }
    }
    return current;
  }

  // -- Breadcrumb ------------------------------------------------------------

  private renderBreadcrumb(): void {
    const ds = this.settings.drillDownSettings;
    if (!ds.showBreadcrumb.value || this.drillPath.length === 0) return;

    const fontSize = ds.breadcrumbFontSize.value;
    const color = ds.breadcrumbColor.value?.value || '#64748B';

    const breadcrumb = document.createElement('div');
    breadcrumb.className = 'waterfall-breadcrumb';
    breadcrumb.style.display = 'flex';
    breadcrumb.style.alignItems = 'center';
    breadcrumb.style.gap = '4px';
    breadcrumb.style.padding = '4px 8px';
    breadcrumb.style.fontSize = `${fontSize}px`;
    breadcrumb.style.color = color;
    breadcrumb.style.flexWrap = 'wrap';

    // "All" root segment
    const allSpan = document.createElement('span');
    allSpan.textContent = 'All';
    allSpan.style.cursor = 'pointer';
    allSpan.style.textDecoration = 'underline';
    allSpan.style.color = color;
    allSpan.addEventListener('click', (event: MouseEvent) => {
      event.stopPropagation();
      this.drillPath = [];
      this.reRenderWithDrill();
    });
    breadcrumb.appendChild(allSpan);

    for (let i = 0; i < this.drillPath.length; i++) {
      const sep = document.createElement('span');
      sep.textContent = ' > ';
      sep.style.color = color;
      breadcrumb.appendChild(sep);

      const segment = document.createElement('span');
      segment.textContent = this.drillPath[i];
      segment.style.color = color;

      if (i < this.drillPath.length - 1) {
        segment.style.cursor = 'pointer';
        segment.style.textDecoration = 'underline';
        const targetIndex = i;
        segment.addEventListener('click', (event: MouseEvent) => {
          event.stopPropagation();
          this.drillPath = this.drillPath.slice(0, targetIndex + 1);
          this.reRenderWithDrill();
        });
      } else {
        segment.style.fontWeight = '600';
      }

      breadcrumb.appendChild(segment);
    }

    this.container.appendChild(breadcrumb);

    if (this.settings.animationSettings.enabled.value) {
      const cancel = fadeSlideIn(
        breadcrumb as unknown as HTMLElement,
        'left',
        DURATION.fast,
      );
      this.cancelAnimations.push(cancel);
    }
  }

  private reRenderWithDrill(): void {
    if (!this.currentData) return;
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    const effectiveData = this.resolveDrillData(this.currentData);
    if (effectiveData.isEmpty) {
      this.renderEmpty();
    } else {
      this.render(effectiveData, this.currentViewport);
    }
  }

  // -- Card Style -------------------------------------------------------------

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

    // Render breadcrumb if drilled
    if (this.settings.drillDownSettings.enabled.value && this.drillPath.length > 0) {
      this.renderBreadcrumb();
    }

    this.container.removeEventListener('click', this.handleBackgroundClick);

    const s = this.settings;
    const padding = 8;
    const baseSvgWidth = viewport.width - padding * 2;
    const baseSvgHeight = viewport.height - padding * 2;
    const baseChartWidth = Math.max(0, baseSvgWidth - MARGIN.left - MARGIN.right);
    const baseChartHeight = Math.max(0, baseSvgHeight - MARGIN.top - MARGIN.bottom);

    if (baseChartWidth <= 0 || baseChartHeight <= 0) {
      this.renderEmpty();
      return;
    }

    // Scroll support
    const scroll = createScrollableChart({
      container: this.container,
      viewportWidth: baseSvgWidth,
      viewportHeight: baseSvgHeight,
      categoryCount: data.steps.length,
      scrollSettings: s.scrollFormattingCard,
      availableChartWidth: baseChartWidth,
      availableChartHeight: baseChartHeight,
      direction: 'horizontal',
    });
    const svgWidth = scroll.svgWidth;
    const svgHeight = scroll.svgHeight;
    const chartWidth = scroll.chartWidth;
    const chartHeight = scroll.chartHeight;

    // Create SVG
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'waterfall-svg');
    svg.setAttribute('width', String(svgWidth));
    svg.setAttribute('height', String(svgHeight));
    scroll.svgParent.appendChild(svg);

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
    const totalColor = s.waterfallTotalBar.color.value?.value || s.colorSettings.totalColor.value?.value || '#3B82F6';
    const subtotalColor = s.subtotalSettings.subtotalColor.value?.value ?? '#6366F1';

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

      if (step.isSubtotal) {
        // Subtotal bar: from 0 to runningTotal (same geometry as total)
        barTop = yScale(Math.max(0, step.runningTotal));
        barBottom = yScale(Math.min(0, step.runningTotal));
        barColor = subtotalColor;
      } else if (step.isTotal) {
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

      // Conditional formatting override
      const condColor = this.getConditionalColor(step.value);
      if (condColor) barColor = condColor;

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

        // Drill-down: if enabled and this step has sub-categories, drill into it
        if (
          this.settings.drillDownSettings.enabled.value &&
          !step.isTotal &&
          !step.isSubtotal &&
          !event.ctrlKey &&
          !event.metaKey &&
          this.currentData
        ) {
          const resolved = this.resolveDrillData(this.currentData);
          if (resolved.subCategoryMap.has(step.label)) {
            this.drillPath.push(step.label);
            this.reRenderWithDrill();
            return;
          }
        }

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
      // Subtotal bars get connectors (unlike total bars which don't)
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
        const labelValue = (step.isTotal || step.isSubtotal) ? step.runningTotal : step.value;
        const formattedValue = formatWithSettings(labelValue, this.settings.numberFormattingCard);
        const labelX = barX + barWidth / 2;

        // Position label above positive bars, below negative bars
        let labelY: number;
        if (step.isTotal || step.isSubtotal) {
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

    // Wrap chartGroup in d3 selection for shared overlay renderers
    const gSelection = d3.select(chartGroup) as unknown as d3.Selection<SVGGElement, unknown, null, undefined>;

    // Collect all values for statistical computations
    const allValues = data.steps
      .filter((step) => !step.isTotal && !step.isSubtotal)
      .map((step) => step.value);

    // Reference line overlay
    this.renderReferenceLine(gSelection, yScale, chartWidth, allValues);

    // Trend line overlay on cumulative running totals
    const cumulativeValues = data.steps.map((step) => step.runningTotal);
    this.renderTrendLineOverlay(
      gSelection,
      cumulativeValues,
      (i) => (xScale(data.steps[i]?.key ?? '') ?? 0) + xScale.bandwidth() / 2,
      yScale,
    );

    // Annotation overlays — resolve category names to bar center positions
    this.renderAnnotationOverlay(gSelection, (category: string) => {
      const step = data.steps.find((s) => s.label === category);
      if (!step) return null;
      const bx = xScale(step.key) ?? 0;
      const bw = xScale.bandwidth();
      const cx = bx + bw / 2;
      const cy = step.isTotal || step.isSubtotal
        ? yScale(Math.max(0, step.runningTotal))
        : step.isPositive
          ? yScale(step.runningTotal)
          : yScale(step.previousRunningTotal);
      return { x: cx, y: cy };
    });

    // Apply shared formatting settings
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.waterfall-value');
    applyAllAxisFormatting(this.container, this.settings.axisFormattingCard, '.waterfall-axis', '.waterfall-grid');

    // Waterfall summary banner
    if (s.waterfallSummary.show.value) {
      const nonTotalSteps = data.steps.filter((step) => !step.isTotal && !step.isSubtotal);
      const totalPositive = nonTotalSteps.filter((step) => step.value > 0).reduce((sum, step) => sum + step.value, 0);
      const totalNegative = nonTotalSteps.filter((step) => step.value < 0).reduce((sum, step) => sum + step.value, 0);
      const netChange = totalPositive + totalNegative;
      const sign = netChange >= 0 ? '+' : '';
      const summaryText = `Increase: ${formatWithSettings(totalPositive, s.numberFormattingCard)}  |  Decrease: ${formatWithSettings(totalNegative, s.numberFormattingCard)}  |  Net Change: ${sign}${formatWithSettings(netChange, s.numberFormattingCard)}`;
      const summaryFontSize = s.waterfallSummary.fontSize.value || 11;

      const summaryEl = document.createElementNS(SVG_NS, 'text');
      summaryEl.setAttribute('class', 'waterfall-summary');
      summaryEl.setAttribute('x', String(chartWidth / 2));
      summaryEl.setAttribute('y', String(chartHeight + MARGIN.bottom - 4));
      summaryEl.setAttribute('text-anchor', 'middle');
      summaryEl.style.setProperty('font-size', `${summaryFontSize}px`);
      summaryEl.style.setProperty('fill', s.axisFormattingCard.axisLabelColor.value?.value || '#64748B');
      summaryEl.textContent = summaryText;
      chartGroup.appendChild(summaryEl);
    }

    // Accessibility
    this.applyAccessibility(data);

    this.container.addEventListener('click', this.handleBackgroundClick);
  }

  // -- Conditional Formatting ------------------------------------------------

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

  // -- Accessibility --------------------------------------------------------

  private applyAccessibility(data: WaterfallData): void {
    const acc = this.settings.accessibilityFormattingCard;
    if (!acc.enableKeyboardNav.value) return;

    ensureFocusRingStyles();

    applyChartAria(this.container, {
      chartType: 'waterfall chart',
      title: this.settings.titleFormattingCard.titleText.value || undefined,
      dataPointCount: data.steps.length,
    });

    const cleanup = attachKeyboardNav({
      container: this.container,
      itemSelector: '.waterfall-bar, [tabindex="0"]',
      onActivate: (el) => {
        (el as HTMLElement).click?.();
      },
    });
    this.cancelAnimations.push(cleanup);
  }

  // -- Reference Line -------------------------------------------------------

  private renderReferenceLine(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    yScale: d3.ScaleLinear<number, number>,
    chartWidth: number,
    allValues: number[],
  ): void {
    const ref = this.settings.referenceLineFormattingCard;
    if (!ref.showReferenceLine.value) return;

    const refType = resolveDropdown(ref.referenceLineType) ?? 'custom';
    let refValue = ref.referenceLineValue.value;

    if (refType !== 'custom' && allValues.length > 0) {
      refValue = computeStatValue(allValues, refType as StatType);
    }

    const refColor = ref.referenceLineColor.value?.value ?? '#EF4444';
    const refStyle = resolveDropdown(ref.referenceLineStyle) ?? 'dashed';
    const labelText = ref.referenceLabelText.value.length > 0
      ? ref.referenceLabelText.value
      : formatWithSettings(refValue, this.settings.numberFormattingCard);

    renderHorizontalReferenceLine(g, {
      value: refValue,
      yScale,
      chartWidth,
      lineColor: refColor,
      lineWidth: ref.referenceLineWidth.value,
      lineStyle: refStyle as 'solid' | 'dashed' | 'dotted',
      showLabel: ref.showReferenceLabel.value,
      labelText,
      showBand: ref.showReferenceBand.value,
      bandUpperValue: refValue * 1.1,
      bandOpacity: ref.referenceBandOpacity.value / 100,
    });
  }

  // -- Trend Line -----------------------------------------------------------

  private renderTrendLineOverlay(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    values: number[],
    xScale: (index: number) => number,
    yScale: d3.ScaleLinear<number, number>,
  ): void {
    const tl = this.settings.trendLineFormattingCard;
    if (!tl.showTrendLine.value || values.length < 2) return;

    const trendType = (resolveDropdown(tl.trendLineType) ?? 'linear') as TrendType;
    const result = computeRegression(values, trendType, tl.polynomialOrder.value);
    const trendColor = tl.trendLineColor.value?.value ?? '#6366F1';

    renderTrendLine(g, {
      predicted: result.predicted,
      xScale,
      yScale,
      lineColor: trendColor,
      lineWidth: tl.trendLineWidth.value,
      showEquation: tl.showEquation.value,
      showR2: tl.showR2.value,
      equation: result.equation,
      r2: result.r2,
    });
  }

  // -- Annotations ----------------------------------------------------------

  private renderAnnotationOverlay(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    resolvePosition: (category: string) => { x: number; y: number } | null,
  ): void {
    const ann = this.settings.annotationFormattingCard;
    if (!ann.showAnnotations.value) return;

    const slots = [
      { category: ann.annotation1Category.value, text: ann.annotation1Text.value, position: resolveDropdown(ann.annotation1Position) ?? 'above' },
      { category: ann.annotation2Category.value, text: ann.annotation2Text.value, position: resolveDropdown(ann.annotation2Position) ?? 'above' },
      { category: ann.annotation3Category.value, text: ann.annotation3Text.value, position: resolveDropdown(ann.annotation3Position) ?? 'above' },
    ];

    const config = buildAnnotationConfig(
      true,
      slots,
      ann.annotationFontSize.value,
      ann.annotationFontColor.value?.value || '#475569',
      ann.annotationConnectorColor.value?.value || '#94A3B8',
      resolvePosition,
    );
    if (config) renderAnnotations(g, config);
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
        text.textContent = formatWithSettings(tick, this.settings.numberFormattingCard);
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
          displayName: step.isTotal ? 'Total' : step.isSubtotal ? 'Subtotal' : 'Change',
          value: formatWithSettings(step.value, this.settings.numberFormattingCard),
        },
        {
          displayName: 'Running Total',
          value: formatWithSettings(step.runningTotal, this.settings.numberFormattingCard),
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
