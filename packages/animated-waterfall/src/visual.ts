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
  allowInteractions,
  attachEmptySpaceContextMenu,
  applyBasicHighContrastStyles,
  fallIn,
  drawPath,
  fadeSlideIn,
  DURATION,
  formatWithSettings,
  applyCardStyle,
  type CardStyleMode,
  renderChartTitle,
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
  renderLegend,
  type LegendItem,
  getDateFilterIndices,
  isDateColumn,
  type DateFilterConfig,
  resolveColorTheme,
  getHostChartColor,
  hideInlineLegendFormatting,
  syncCardStyleVisibility,
  syncDateFilterFormattingVisibility,
  syncLegendFormattingVisibility,
  syncTitleFormattingVisibility,
  getHostHighContrastColors,
  notifyRenderingStarted,
  notifyRenderingFinished,
  notifyRenderingFailed,
  renderLandingPage,
  renderNoDataState,
  getVisualEmptyStateMode,
  getLocalizedString,
  prefersReducedMotion,
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
  highlighted: boolean;
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
  /** Whether cross-highlight data is present from another visual/slicer */
  hasHighlights: boolean;
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
  private detachEmptySpaceContextMenu: (() => void) | null = null;
  private emptyStateMode: 'unconfigured' | 'noData' = 'unconfigured';

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
    this.formattingSettingsService = new FormattingSettingsService(options.host.createLocalizationManager());
    this.container.classList.add('waterfall-container');
    this.detachEmptySpaceContextMenu = attachEmptySpaceContextMenu(
      this.container,
      this.selectionManager,
      () => this.host.createSelectionIdBuilder().createSelectionId(),
      () => allowInteractions(this.host),
    );
  }

  public update(options: VisualUpdateOptions): void {
    notifyRenderingStarted(this.host, options);
    try {
      // Cancel running animations before re-render
      this.cancelAnimations.forEach((cancel) => cancel());
      this.cancelAnimations = [];

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    this.emptyStateMode = getVisualEmptyStateMode(dataView);
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        AnimatedWaterfallSettings,
        dataView,
      );
    }

    // Migrate legacy enableGlass -> cardStyleMode (backward compat)
    const legacyCardObj = dataView?.metadata?.objects?.['cardSettings'];
    if (legacyCardObj) {
      const legacyGlass = legacyCardObj['enableGlass'];
      if (legacyGlass === false && legacyCardObj['cardStyleMode'] == null) {
        this.settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
      }
    }

    syncDateFilterFormattingVisibility(this.settings.dateFilterFormattingCard);
    syncTitleFormattingVisibility(this.settings.titleFormattingCard);
    syncLegendFormattingVisibility(this.settings.legendFormattingCard);

    const axis = this.settings.axisFormattingCard;
    axis.xAxisTitle.visible = axis.showXAxis.value;
    axis.yAxisTitle.visible = axis.showYAxis.value;
    axis.axisLabelRotation.visible = axis.showXAxis.value;
    axis.yAxisMin.visible = axis.showYAxis.value;
    axis.yAxisMax.visible = axis.showYAxis.value;
    axis.integerTicks.visible = axis.showYAxis.value;
    axis.gridLineColor.visible = axis.showGridLines.value;
    axis.gridLineStyle.visible = axis.showGridLines.value;
    axis.gridLineWidth.visible = axis.showGridLines.value;
    axis.gridLineOpacity.visible = axis.showGridLines.value;
    this.settings.dataLabelFormattingCard.showDataLabels.visible = false;
    this.settings.dataLabelFormattingCard.dataLabelFontSize.visible = false;
    this.settings.dataLabelFormattingCard.dataLabelFontColor.visible = false;
    this.settings.dataLabelFormattingCard.dataLabelFontWeight.visible = false;
    this.settings.dataLabelFormattingCard.dataLabelFontFamily.visible = false;
    this.settings.dataLabelFormattingCard.dataLabelPosition.visible = false;

    // Hide dual-axis-only properties (no combo/dual-axis support)
    this.settings.referenceLineFormattingCard.referenceLineAxis.visible = false;
    this.settings.referenceLineFormattingCard.referenceBandWidth.visible = false;
    this.settings.trendLineFormattingCard.trendLineAxis.visible = false;
    hideInlineLegendFormatting(this.settings.legendFormattingCard);

    // ── Conditional visibility ──────────────────────────────────────
    // Subtotal sub-settings: hide when subtotals disabled
    const subtotalOn = this.settings.subtotalSettings.enabled.value;
    this.settings.subtotalSettings.subtotalColor.visible = subtotalOn;
    this.settings.subtotalSettings.subtotalLabel.visible = subtotalOn;
    this.settings.subtotalSettings.indices.visible = subtotalOn;

    // Drill-down sub-settings: hide when drill disabled
    const hasSubCategory = dataView?.categorical?.categories?.some(
      (column) => column.source.roles?.['subCategory'] === true,
    ) ?? false;
    const drillOn = hasSubCategory && this.settings.drillDownSettings.enabled.value;
    this.settings.drillDownSettings.enabled.visible = hasSubCategory;
    this.settings.drillDownSettings.showBreadcrumb.visible = drillOn;
    this.settings.drillDownSettings.breadcrumbFontSize.visible = drillOn && this.settings.drillDownSettings.showBreadcrumb.value;
    this.settings.drillDownSettings.breadcrumbColor.visible = drillOn && this.settings.drillDownSettings.showBreadcrumb.value;
    this.settings.drillDownSettings.breadcrumbFontFamily.visible = drillOn && this.settings.drillDownSettings.showBreadcrumb.value;
    this.settings.drillDownSettings.breadcrumbFontWeight.visible = drillOn && this.settings.drillDownSettings.showBreadcrumb.value;
    this.settings.drillDownSettings.breadcrumbPadding.visible = drillOn && this.settings.drillDownSettings.showBreadcrumb.value;

    // Value label sub-settings: hide when values off
    const showValuesToggle = this.settings.valueSettings.show.value;
    this.settings.valueSettings.fontSize.visible = showValuesToggle;
    this.settings.valueSettings.fontColor.visible = showValuesToggle;
    this.settings.valueSettings.fontFamily.visible = showValuesToggle;
    this.settings.valueSettings.fontWeight.visible = showValuesToggle;

    // Summary banner sub-settings: hide when banner off
    const summaryOn = this.settings.waterfallSummary.show.value;
    this.settings.waterfallSummary.fontSize.visible = summaryOn;
    this.settings.waterfallSummary.fontColor.visible = summaryOn;
    this.settings.waterfallSummary.fontFamily.visible = summaryOn;
    this.settings.waterfallSummary.fontWeight.visible = summaryOn;
    this.settings.waterfallSummary.alignment.visible = summaryOn;
    this.settings.waterfallSummary.paddingTop.visible = summaryOn;

    // Connector sub-settings: hide when showConnectors false
    const connectorsOn = this.settings.waterfallSettings.showConnectors.value;
    this.settings.connectorSettings.connectorColor.visible = connectorsOn;
    this.settings.connectorSettings.connectorWidth.visible = connectorsOn;
    this.settings.connectorSettings.connectorStyle.visible = connectorsOn;

    // Total bar sub-settings: hide when total bar off
    const totalBarOn = this.settings.waterfallTotalBar.show.value;
    this.settings.waterfallTotalBar.label.visible = totalBarOn;
    this.settings.waterfallTotalBar.color.visible = totalBarOn;

    const animationOn = this.settings.animationSettings.enabled.value;
    this.settings.animationSettings.duration.visible = animationOn;
    this.settings.animationSettings.staggerDelay.visible = animationOn;

    const reference = this.settings.referenceLineFormattingCard;
    const referenceOn = reference.showReferenceLine.value;
    const referenceType = resolveDropdown(reference.referenceLineType) ?? 'custom';
    reference.referenceLineType.visible = referenceOn;
    reference.referenceLineValue.visible = referenceOn && referenceType === 'custom';
    reference.referenceLineColor.visible = referenceOn;
    reference.referenceLineWidth.visible = referenceOn;
    reference.referenceLineStyle.visible = referenceOn;
    reference.showReferenceLabel.visible = referenceOn;
    reference.referenceLabelText.visible = referenceOn && reference.showReferenceLabel.value;
    reference.showReferenceBand.visible = referenceOn;
    reference.referenceBandOpacity.visible = referenceOn && reference.showReferenceBand.value;

    const trend = this.settings.trendLineFormattingCard;
    const trendOn = trend.showTrendLine.value;
    const trendType = resolveDropdown(trend.trendLineType) ?? 'linear';
    trend.trendLineType.visible = trendOn;
    trend.polynomialOrder.visible = trendOn && trendType === 'polynomial';
    trend.trendLineColor.visible = trendOn;
    trend.trendLineWidth.visible = trendOn;
    trend.showEquation.visible = trendOn;
    trend.showR2.visible = trendOn;

    const conditional = this.settings.conditionalFormattingCard;
    const conditionalOn = conditional.enableConditional.value;
    conditional.conditionalDirection.visible = conditionalOn;
    conditional.threshold1.visible = conditionalOn;
    conditional.threshold2.visible = conditionalOn;
    conditional.conditionalColor1.visible = conditionalOn;
    conditional.conditionalColor2.visible = conditionalOn;
    conditional.conditionalColor3.visible = conditionalOn;

    const annotations = this.settings.annotationFormattingCard;
    for (const slice of annotations.slices.slice(1)) slice.visible = annotations.showAnnotations.value;

    // Extract data
    const data = this.extractData(dataView);
    this.currentData = data;
    this.currentViewport = options.viewport;

    // Reset drill if data changed structurally
    if (data.isEmpty || !data.hasSubCategory) {
      this.drillPath = [];
    }

    // Resolve drill path to get the effective data
    const effectiveData = this.resolveDrillData(data);

    // Render
    if (effectiveData.isEmpty) {
      this.renderEmpty();
    } else {
      this.render(effectiveData, options.viewport);
    }

      // Apply cross-highlight dimming after render
      this.applySelectionHighlight();

      // Apply card styling AFTER render — render clears the container, which would destroy the glass backdrop div.
      this.applyCardStyle();
      this.applyHighContrast();
      notifyRenderingFinished(this.host, options);
    } catch (error) {
      notifyRenderingFailed(this.host, options, error instanceof Error ? error.message : String(error));
      throw error;
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
      hasHighlights: false,
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
    let measureHighlights: (unknown | null)[] = [];
    let isTotalValues: (number | null)[] = [];
    let fallbackMeasureValues: (number | null)[] = [];
    let fallbackHighlights: (unknown | null)[] = [];

    for (const col of valuesColumns) {
      const numericValues = col.values.map((v) => (typeof v === 'number' ? v : null));
      const hlRaw = (col as unknown as { highlights?: unknown[] }).highlights as unknown[] | undefined;
      if (fallbackMeasureValues.length === 0 && numericValues.some((v) => v !== null)) {
        fallbackMeasureValues = numericValues;
        fallbackHighlights = hlRaw ?? numericValues.map(() => null);
      }

      const role = col.source.roles;
      if (!role) continue;

      if (role['measure']) {
        measureValues = numericValues;
        measureHighlights = hlRaw ?? numericValues.map(() => null);
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
      measureHighlights = fallbackHighlights;
    }
    if (measureValues.length === 0) return empty;

    const showTotal = this.settings.waterfallTotalBar.show.value;
    const hasIsTotalField = isTotalValues.length > 0;

    // Build waterfall steps
    const steps: WaterfallStep[] = [];
    let runningTotal = 0;

    const rowCount = Math.min(categories.length, measureValues.length);

    const dateConfig: DateFilterConfig = {
      enabled: this.settings.dateFilterFormattingCard.enableDateFilter.value,
      startDate: this.settings.dateFilterFormattingCard.startDate.value,
      endAtCurrentDate: this.settings.dateFilterFormattingCard.endAtCurrentDate.value,
      endDate: this.settings.dateFilterFormattingCard.endDate.value,
    };
    const dateIndices = isDateColumn(categoryColumn.source) ? getDateFilterIndices(categoryColumn.values, dateConfig) : null;

    for (let i = 0; i < rowCount; i++) {
      if (dateIndices && !dateIndices.has(i)) continue;

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

      const hlVal = measureHighlights[i];
      const highlighted = hlVal !== null && hlVal !== undefined;

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
        highlighted,
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
          highlighted: false,
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
        highlighted: false,
      });
    }

    if (steps.length === 0) return empty;

    // Sort by absolute contribution if enabled (only non-total, non-subtotal steps)
    if (this.settings.waterfallSort.sortByContribution.value) {
      // Separate total/subtotal entries from regular steps
      const regularSteps = steps.filter((s) => !s.isTotal && !s.isSubtotal);
      const totalSteps = steps.filter((s) => s.isTotal);

      // Build a map of subtotals keyed by the original index they followed
      // so we can re-insert them after sorting
      const subtotalAfter = new Map<string, WaterfallStep[]>();
      for (let si = 0; si < steps.length; si++) {
        if (!steps[si].isSubtotal) continue;
        // Find the preceding non-subtotal step's key
        for (let pi = si - 1; pi >= 0; pi--) {
          if (!steps[pi].isSubtotal) {
            const parentKey = steps[pi].key;
            const existing = subtotalAfter.get(parentKey);
            if (existing) {
              existing.push(steps[si]);
            } else {
              subtotalAfter.set(parentKey, [steps[si]]);
            }
            break;
          }
        }
      }

      // Sort regular steps by absolute value descending
      regularSteps.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

      // Recalculate running totals after sorting
      let newRunning = 0;
      steps.length = 0;
      for (const step of regularSteps) {
        step.previousRunningTotal = newRunning;
        newRunning += step.value;
        step.runningTotal = newRunning;
        steps.push(step);

        // Re-insert any subtotals that belonged after this step
        const subs = subtotalAfter.get(step.key);
        if (subs) {
          for (const sub of subs) {
            sub.runningTotal = newRunning;
            sub.previousRunningTotal = newRunning;
            sub.value = newRunning;
            steps.push(sub);
          }
        }
      }

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
        if (dateIndices && !dateIndices.has(i)) continue;
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

          const subHlVal = measureHighlights[ri];
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
            highlighted: subHlVal !== null && subHlVal !== undefined,
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
            highlighted: subSteps.some(s => s.highlighted && !s.isTotal),
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
            hasHighlights: subSteps.some((s) => s.highlighted),
          });
        }
      }
    }

    const hasHighlights = steps.some((s) => s.highlighted);
    return {
      steps,
      maxValue,
      minValue,
      isEmpty: false,
      hasSubCategory,
      subCategoryMap,
      hasHighlights,
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
    const fontFamily = resolveDropdown(ds.breadcrumbFontFamily);
    const fontWeight = resolveDropdown(ds.breadcrumbFontWeight) ?? 'normal';
    const padding = Math.max(0, ds.breadcrumbPadding.value);

    const breadcrumb = document.createElement('div');
    breadcrumb.className = 'waterfall-breadcrumb';
    breadcrumb.style.display = 'flex';
    breadcrumb.style.alignItems = 'center';
    breadcrumb.style.gap = '4px';
    breadcrumb.style.padding = `${Math.max(2, Math.round(padding / 2))}px ${padding}px`;
    breadcrumb.style.fontSize = `${fontSize}px`;
    breadcrumb.style.color = color;
    breadcrumb.style.flexWrap = 'wrap';
    breadcrumb.style.fontWeight = fontWeight;
    if (fontFamily) {
      breadcrumb.style.fontFamily = fontFamily;
    }

    // "All" root segment
    const allSpan = document.createElement('span');
    allSpan.textContent = getLocalizedString(this.host, 'Common_BreadcrumbAll', 'All');
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

    if (this.settings.animationSettings.enabled.value && !prefersReducedMotion()) {
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
    this.applySelectionHighlight();
    this.applyCardStyle();
    this.applyHighContrast();
  }

  // -- Card Style -------------------------------------------------------------

  private applyCardStyle(): void {
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
  }

  // -- Empty State ------------------------------------------------------------

  private renderEmpty(): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    if (this.emptyStateMode === 'noData') {
      renderNoDataState(
        this.container,
        getLocalizedString(this.host, 'AnimatedWaterfall_NoDataState', 'No data for the current selection.'),
        getHostHighContrastColors(this.host),
      );
      return;
    }
    renderLandingPage(this.container, {
      title: getLocalizedString(this.host, 'AnimatedWaterfall_LandingTitle', 'Add data to build a waterfall chart'),
      description: getLocalizedString(this.host, 'AnimatedWaterfall_LandingDescription', 'Animated Waterfall needs a category and a measure to show cumulative change.'),
      steps: [
        getLocalizedString(this.host, 'AnimatedWaterfall_LandingStepAxis', 'Put a category on the axis.'),
        getLocalizedString(this.host, 'AnimatedWaterfall_LandingStepMeasure', 'Add a measure for the change value.'),
        getLocalizedString(this.host, 'AnimatedWaterfall_LandingStepOptional', 'Optional total and subtotal fields enable richer waterfalls.'),
      ],
    }, getHostHighContrastColors(this.host));
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

    // Measure space consumed by title and breadcrumb so SVG doesn't overflow
    let reservedHeight = 0;
    const titleEl = this.container.querySelector('.chart-title') as HTMLElement | null;
    if (titleEl) reservedHeight += titleEl.offsetHeight;
    const breadcrumbEl = this.container.querySelector('.waterfall-breadcrumb') as HTMLElement | null;
    if (breadcrumbEl) reservedHeight += breadcrumbEl.offsetHeight;

    const s = this.settings;
    const padding = Math.max(0, s.waterfallSettings.outerPadding.value + s.cardSettings.contentPadding.value);
    const baseSvgWidth = viewport.width - padding * 2;
    const baseSvgHeight = viewport.height - padding * 2 - reservedHeight;
    const baseChartWidth = Math.max(0, baseSvgWidth - MARGIN.left - MARGIN.right);
    const summaryReserve = s.waterfallSummary.show.value
      ? Math.max(0, s.waterfallSummary.paddingTop.value)
        + Math.max(8, s.waterfallSummary.fontSize.value)
        + 6
      : 0;
    const baseChartHeight = Math.max(
      0,
      baseSvgHeight - MARGIN.top - MARGIN.bottom - summaryReserve,
    );

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
    const configuredMin = s.axisFormattingCard.yAxisMin.value;
    const configuredMax = s.axisFormattingCard.yAxisMax.value;
    const domainMin = typeof configuredMin === 'number' && Number.isFinite(configuredMin)
      ? configuredMin
      : yMin - yPadding;
    const domainMax = typeof configuredMax === 'number' && Number.isFinite(configuredMax) && configuredMax > domainMin
      ? configuredMax
      : yMax + yPadding;
    const yScale = d3.scaleLinear()
      .domain([domainMin, domainMax])
      .nice()
      .range([chartHeight, 0]);

    // Grid lines
    this.renderGrid(chartGroup, yScale, chartWidth, chartHeight);

    // Axes
    this.renderAxes(chartGroup, xScale, yScale, chartWidth, chartHeight, data.steps);

    // Colors — theme overrides when non-default
    const themeName = resolveColorTheme(s.colorThemeFormattingCard);
    const positiveColor = themeName !== 'default'
      ? getHostChartColor(this.host.colorPalette, 0, themeName)
      : (s.colorSettings.positiveColor.value?.value ?? '#34D399');
    const negativeColor = themeName !== 'default'
      ? getHostChartColor(this.host.colorPalette, 1, themeName)
      : (s.colorSettings.negativeColor.value?.value ?? '#F87171');
    const totalColor = themeName !== 'default'
      ? getHostChartColor(this.host.colorPalette, 2, themeName)
      : (s.waterfallTotalBar.color.value?.value || '#3B82F6');
    const subtotalColor = themeName !== 'default'
      ? getHostChartColor(this.host.colorPalette, 3, themeName)
      : (s.subtotalSettings.subtotalColor.value?.value ?? '#6366F1');

    // Animation settings
    const animEnabled = s.animationSettings.enabled.value && !prefersReducedMotion();
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
      rect.setAttribute('data-selection-key', step.selectionId.getKey());
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
      rect.style.cursor = allowInteractions(this.host) ? 'pointer' : 'default';
      rect.addEventListener('click', (event: MouseEvent) => {
        if (!allowInteractions(this.host)) return;
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

        void this.selectionManager.select(step.selectionId, event.ctrlKey || event.metaKey).then(() => {
          this.applySelectionHighlight();
        });
      });
      rect.addEventListener('contextmenu', (event: MouseEvent) => {
        if (!allowInteractions(this.host)) return;
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
        const connectorW = String(this.settings.connectorSettings?.connectorWidth.value ?? 1);
        const cStyleVal = resolveDropdown(this.settings.connectorSettings?.connectorStyle);
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
        const valueFontColor = s.valueSettings.fontColor.value?.value;
        if (valueFontColor) text.setAttribute('fill', valueFontColor);
      const valueFontFamily = resolveDropdown(s.valueSettings.fontFamily);
      if (valueFontFamily) text.style.setProperty('font-family', valueFontFamily);
      const valueFontWeight = resolveDropdown(s.valueSettings.fontWeight);
      text.style.setProperty('font-weight', valueFontWeight || 'normal');
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

    // Value labels use the dedicated Value Labels card above.
    applyAllAxisFormatting(this.container, this.settings.axisFormattingCard, '.waterfall-axis', '.waterfall-grid');

    // Waterfall summary banner
    if (s.waterfallSummary.show.value) {
      const nonTotalSteps = data.steps.filter((step) => !step.isTotal && !step.isSubtotal);
      const totalPositive = nonTotalSteps.filter((step) => step.value > 0).reduce((sum, step) => sum + step.value, 0);
      const totalNegative = nonTotalSteps.filter((step) => step.value < 0).reduce((sum, step) => sum + step.value, 0);
      const netChange = totalPositive + totalNegative;
      const sign = netChange >= 0 ? '+' : '';
      const summaryText = `Increase: ${formatWithSettings(totalPositive, s.numberFormattingCard)}  |  Decrease: ${formatWithSettings(totalNegative, s.numberFormattingCard)}  |  Net Change: ${sign}${formatWithSettings(netChange, s.numberFormattingCard)}`;
      const summaryFontSize = s.waterfallSummary.fontSize.value ?? 11;
      const summaryFontColor = s.waterfallSummary.fontColor.value?.value || s.axisFormattingCard.axisLabelColor.value?.value || '#64748B';
      const summaryFontFamily = resolveDropdown(s.waterfallSummary.fontFamily);
      const summaryFontWeight = resolveDropdown(s.waterfallSummary.fontWeight) ?? 'normal';
      const summaryAlignment = resolveDropdown(s.waterfallSummary.alignment) ?? 'center';
      const summaryPaddingTop = Math.max(0, s.waterfallSummary.paddingTop.value);
      const summaryX = summaryAlignment === 'left'
        ? 0
        : summaryAlignment === 'right'
          ? chartWidth
          : chartWidth / 2;

      const summaryEl = document.createElementNS(SVG_NS, 'text');
      summaryEl.setAttribute('class', 'waterfall-summary');
      summaryEl.setAttribute('x', String(summaryX));
      summaryEl.setAttribute('y', String(chartHeight + MARGIN.bottom - 4 + summaryPaddingTop));
      summaryEl.setAttribute('text-anchor', summaryAlignment === 'left' ? 'start' : summaryAlignment === 'right' ? 'end' : 'middle');
      summaryEl.style.setProperty('font-size', `${summaryFontSize}px`);
      summaryEl.style.setProperty('fill', summaryFontColor);
      summaryEl.style.setProperty('font-weight', summaryFontWeight);
      if (summaryFontFamily) {
        summaryEl.style.setProperty('font-family', summaryFontFamily);
      }
      summaryEl.textContent = summaryText;
      chartGroup.appendChild(summaryEl);
    }

    // Legend
    const legendCard = this.settings.legendFormattingCard;
    if (legendCard.showLegend.value) {
      const legendPos = resolveDropdown(legendCard.legendPosition) ?? 'bottom';
      const rawFontColor = legendCard.legendFontColor.value?.value;
      const legendItems: LegendItem[] = [];
      if (data.steps.some((step) => !step.isTotal && !step.isSubtotal && step.value >= 0)) {
        legendItems.push({ label: 'Increase', color: positiveColor });
      }
      if (data.steps.some((step) => !step.isTotal && !step.isSubtotal && step.value < 0)) {
        legendItems.push({ label: 'Decrease', color: negativeColor });
      }
      if (data.steps.some((step) => step.isSubtotal)) {
        legendItems.push({ label: 'Subtotal', color: subtotalColor });
      }
      if (data.steps.some((step) => step.isTotal)) {
        legendItems.push({ label: 'Total', color: totalColor });
      }
      renderLegend(this.container, {
        items: legendItems,
        position: legendPos as 'top' | 'bottom' | 'left' | 'right',
        fontSize: legendCard.legendFontSize.value,
        fontColor: rawFontColor && rawFontColor.length > 0 ? rawFontColor : '#64748B',
        fontFamily: resolveDropdown(legendCard.legendFontFamily) || undefined,
        fontWeight: resolveDropdown(legendCard.legendFontWeight) || 'normal',
        aliases: legendCard.legendAliases.value,
      });
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
    if (!acc.enableKeyboardNav.value) {
      this.container.removeAttribute('role');
      this.container.removeAttribute('aria-label');
      return;
    }

    ensureFocusRingStyles();

    applyChartAria(this.container, {
      chartType: 'waterfall chart',
      title: this.settings.titleFormattingCard.titleText.value || undefined,
      dataPointCount: data.steps.length,
    });

    const bars = this.container.querySelectorAll<SVGRectElement>('.waterfall-bar');
    bars.forEach((bar, index) => {
      const step = data.steps[index];
      bar.setAttribute('role', 'listitem');
      bar.setAttribute('tabindex', '0');
      bar.setAttribute(
        'aria-label',
        step
          ? `${step.label}, ${formatWithSettings(step.value, this.settings.numberFormattingCard)}`
          : `Waterfall step ${index + 1}`,
      );
    });

    const cleanup = attachKeyboardNav({
      container: this.container,
      itemSelector: '.waterfall-bar[tabindex="0"]',
      onActivate: (el) => {
        if (allowInteractions(this.host)) (el as HTMLElement).click?.();
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
      {
        fontFamily: resolveDropdown(ann.annotationFontFamily) || undefined,
        fontWeight: resolveDropdown(ann.annotationFontWeight) || '500',
        offset: ann.annotationOffset.value,
        padding: ann.annotationPadding.value,
        backgroundColor: ann.annotationBackgroundColor.value?.value || '#FFFFFF',
        backgroundOpacity: ann.annotationBackgroundOpacity.value / 100,
        cornerRadius: ann.annotationCornerRadius.value,
      },
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
    const rawTicks = yScale.ticks(6);
    const ticks = this.settings.axisFormattingCard.integerTicks.value
      ? rawTicks.filter(Number.isInteger)
      : rawTicks;

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
    if (s.axisFormattingCard.showXAxis.value) {
      const xAxisGroup = document.createElementNS(SVG_NS, 'g');
      xAxisGroup.setAttribute('class', 'waterfall-axis waterfall-axis-x');
      xAxisGroup.setAttribute('transform', `translate(0,${height})`);
      g.appendChild(xAxisGroup);

      const keys = xScale.domain();
      const rotation = Math.max(-90, Math.min(90, s.axisFormattingCard.axisLabelRotation.value));
      for (const key of keys) {
        const x = (xScale(key) ?? 0) + xScale.bandwidth() / 2;
        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('x', String(x));
        text.setAttribute('y', '16');
        text.setAttribute('text-anchor', 'middle');
        text.textContent = labelByKey.get(key) ?? '';
        xAxisGroup.appendChild(text);

        if (rotation !== 0) {
          text.setAttribute('transform', `rotate(${rotation}, ${x}, 16)`);
          text.setAttribute('text-anchor', rotation < 0 ? 'end' : 'start');
        }
      }

      // Axis line
      const axisLine = document.createElementNS(SVG_NS, 'line');
      axisLine.setAttribute('x1', '0');
      axisLine.setAttribute('y1', '0');
      axisLine.setAttribute('x2', String(width));
      axisLine.setAttribute('y2', '0');
      xAxisGroup.appendChild(axisLine);

      if (s.axisFormattingCard.xAxisTitle.value.trim()) {
        const title = document.createElementNS(SVG_NS, 'text');
        title.setAttribute('x', String(width / 2));
        title.setAttribute('y', '40');
        title.setAttribute('text-anchor', 'middle');
        title.textContent = s.axisFormattingCard.xAxisTitle.value;
        xAxisGroup.appendChild(title);
      }
    }

    // Y-Axis
    if (s.axisFormattingCard.showYAxis.value) {
      const yAxisGroup = document.createElementNS(SVG_NS, 'g');
      yAxisGroup.setAttribute('class', 'waterfall-axis waterfall-axis-y');
      g.appendChild(yAxisGroup);

      const rawTicks = yScale.ticks(6);
      const ticks = s.axisFormattingCard.integerTicks.value
        ? rawTicks.filter(Number.isInteger)
        : rawTicks;
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

      if (s.axisFormattingCard.yAxisTitle.value.trim()) {
        const title = document.createElementNS(SVG_NS, 'text');
        title.setAttribute('x', String(-height / 2));
        title.setAttribute('y', '-44');
        title.setAttribute('text-anchor', 'middle');
        title.setAttribute('transform', 'rotate(-90)');
        title.textContent = s.axisFormattingCard.yAxisTitle.value;
        yAxisGroup.appendChild(title);
      }
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
        identities: [step.selectionId],
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
    const s = this.settings;
    syncCardStyleVisibility(s.cardSettings);
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private handleBackgroundClick = (): void => {
    if (!allowInteractions(this.host)) return;
    void this.selectionManager.clear();
    this.applySelectionHighlight();
  };

  private applyHighContrast(): void {
    const highContrastColors = getHostHighContrastColors(this.host);
    applyBasicHighContrastStyles(this.container, highContrastColors, {
      textSelectors: [
        '.waterfall-empty',
        '.chart-title',
        '.chart-subtitle',
        '.waterfall-breadcrumb',
        '.waterfall-value',
        '.waterfall-summary',
        '.waterfall-axis text',
        '.pbi-shared-legend span',
      ],
      fillSelectors: ['.waterfall-bar'],
      strokeSelectors: ['.waterfall-axis line', '.waterfall-grid-line', '.waterfall-connector'],
    });
  }

  // -- Selection & Cross-Highlight --------------------------------------------

  private applySelectionHighlight(): void {
    const hasSelection = this.selectionManager.hasSelection();
    const selectedIds = this.selectionManager.getSelectionIds() as ISelectionId[];
    const selectedKeys = new Set(selectedIds.map((id) => id.getKey()));

    const data = this.currentData;
    const effectiveData = data ? this.resolveDrillData(data) : null;
    const hasHighlights = effectiveData?.hasHighlights ?? false;
    const highlightedKeys = new Set<string>();
    if (hasHighlights && effectiveData) {
      for (const step of effectiveData.steps) {
        if (step.highlighted) {
          highlightedKeys.add(step.selectionId.getKey());
        }
      }
    }

    const bars = this.container.querySelectorAll<SVGRectElement>('.waterfall-bar');
    const shouldDim = hasSelection || hasHighlights;

    for (const el of bars) {
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

  // -- Cleanup ----------------------------------------------------------------

  public destroy(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.detachEmptySpaceContextMenu?.();
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }
}
