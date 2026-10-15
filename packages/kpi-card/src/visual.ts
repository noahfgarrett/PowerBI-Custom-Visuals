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
  applyDataPointAria,
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
  syncTitleFormattingVisibility,
  syncCardStyleVisibility,
  syncDateFilterFormattingVisibility,
  attachEmptySpaceContextMenu,
  allowInteractions,
  notifyRenderingStarted,
  notifyRenderingFinished,
  notifyRenderingFailed,
  renderLandingPage,
  renderNoDataState,
  getHostHighContrastColors,
  applyBasicHighContrastStyles,
  getLocalizedString,
  getVisualEmptyStateMode,
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
  private emptyStateMode: 'unconfigured' | 'noData' = 'unconfigured';
  private currentKpiCells: KpiCardData[] = [];

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new KpiCardSettings();
    this.formattingSettingsService = new FormattingSettingsService(options.host.createLocalizationManager());
    this.container.classList.add('kpi-card-container');
    attachEmptySpaceContextMenu(this.container, this.selectionManager, () =>
      this.host.createSelectionIdBuilder().createSelectionId(),
      () => allowInteractions(this.host),
    );
  }

  public update(options: VisualUpdateOptions): void {
    notifyRenderingStarted(this.host, options);
    let step = 'init';
    try {
      step = 'settings';
      this.updateSettings(options);
      step = 'visibility';
      this.updateVisibility(options.dataViews?.[0]);
      step = 'extract';
      const dataView = options.dataViews?.[0];
      const hasMeasureRole = dataView?.metadata?.columns?.some((column) => column.roles?.['measure']) ?? false;
      this.emptyStateMode = hasMeasureRole ? getVisualEmptyStateMode(dataView) : 'unconfigured';
      const data = this.extractData(dataView);
      const customText = this.settings.labelSettings.customText.value;
      if (customText) data.label = customText;
      // Cumulative mode: convert trend to running totals and update value
      if (this.settings.sparklineSettings.show.value
        && this.settings.sparklineSettings.cumulative.value
        && data.trend.length > 0) {
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
      const highContrast = getHostHighContrastColors(this.host);
      this.render(data, highContrast);
      applyBasicHighContrastStyles(this.container, highContrast, {
        textSelectors: ['.kpi-label', '.kpi-value', '.kpi-trend', '.kpi-change-indicator', '.kpi-comparison', '.kpi-goal-text', '.kpi-goal-legend', '.kpi-empty', '.pbi-landing-page-title', '.pbi-landing-page-description', '.pbi-landing-page-hint', '.pbi-landing-page li'],
        fillSelectors: ['.kpi-sparkline rect', '.kpi-goal-bar-container', '.kpi-goal-range-segment', '.pbi-landing-page'],
        strokeSelectors: ['.kpi-sparkline path', '.kpi-sparkline circle', '.kpi-sparkline polygon', '.kpi-goal-marker'],
      });
      notifyRenderingFinished(this.host, options);
    } catch (err) {
      notifyRenderingFailed(this.host, options, err instanceof Error ? err.message : String(err));
      while (this.container.firstChild) this.container.removeChild(this.container.firstChild);
      const highContrast = getHostHighContrastColors(this.host);
      const errorState = renderNoDataState(
        this.container,
        getLocalizedString(this.host, 'KpiCard_RenderError', 'Unable to render this KPI. Check the bound fields and formatting settings.'),
        highContrast,
      );
      errorState.title = `Rendering failed during ${step}.`;
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
    if (legacyCardObj?.['cardStyleMode'] === undefined && legacyCardObj?.['enableGlass'] === false) {
      this.settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
    }
  }

  private updateVisibility(dataView: DataView | undefined): void {
    const s = this.settings;
    const categoryColumn = dataView?.categorical?.categories?.[0];
    const hasTrendAxis = Boolean(categoryColumn);
    const hasDateAxis = Boolean(categoryColumn && isDateColumn(categoryColumn.source));
    const hasTargetRole = dataView?.metadata?.columns?.some((column) => column.roles?.['target']) ?? false;
    const hasChangeRole = dataView?.metadata?.columns?.some((column) => column.roles?.['change']) ?? false;
    s.kpiGoalSettings.goalValue.visible = s.kpiGoalSettings.show.value;
    s.kpiGoalSettings.showProgressBar.visible = s.kpiGoalSettings.show.value;
    s.kpiGoalSettings.gradientProgress.visible = s.kpiGoalSettings.show.value && s.kpiGoalSettings.showProgressBar.value;
    s.kpiGoalSettings.metColor.visible = s.kpiGoalSettings.show.value && s.kpiGoalSettings.showProgressBar.value;
    s.kpiGoalSettings.warningColor.visible = s.kpiGoalSettings.show.value && s.kpiGoalSettings.showProgressBar.value;
    s.kpiGoalSettings.unmetColor.visible = s.kpiGoalSettings.show.value && s.kpiGoalSettings.showProgressBar.value;
    s.kpiGoalSettings.goalWarningValue.visible = s.kpiGoalSettings.show.value
      && (s.kpiGoalSettings.showProgressBar.value || s.kpiGoalSettings.showGoalText.value);
    s.kpiGoalSettings.progressBarHeight.visible = s.kpiGoalSettings.show.value && s.kpiGoalSettings.showProgressBar.value;
    s.kpiGoalSettings.showGoalLegend.visible = s.kpiGoalSettings.show.value && s.kpiGoalSettings.showProgressBar.value;
    s.kpiGoalSettings.invertLegendDirection.visible = s.kpiGoalSettings.show.value && s.kpiGoalSettings.showProgressBar.value && s.kpiGoalSettings.showGoalLegend.value;
    s.kpiGoalSettings.goalBlockPaddingTop.visible = s.kpiGoalSettings.show.value;
    s.kpiGoalSettings.showGoalText.visible = s.kpiGoalSettings.show.value;
    s.kpiGoalSettings.goalTextAlignment.visible = s.kpiGoalSettings.show.value && s.kpiGoalSettings.showGoalText.value;
    s.kpiGoalSettings.goalTextFontSize.visible = s.kpiGoalSettings.show.value && s.kpiGoalSettings.showGoalText.value;
    s.kpiGoalSettings.goalTextColor.visible = s.kpiGoalSettings.show.value && s.kpiGoalSettings.showGoalText.value;
    s.kpiGoalSettings.goalTextFontFamily.visible = s.kpiGoalSettings.show.value && s.kpiGoalSettings.showGoalText.value;
    s.kpiGoalSettings.goalTextFontWeight.visible = s.kpiGoalSettings.show.value && s.kpiGoalSettings.showGoalText.value;
    s.kpiGoalSettings.goalTextPaddingTop.visible = s.kpiGoalSettings.show.value && s.kpiGoalSettings.showGoalText.value;
    s.kpiComparisonSettings.compareMode.visible = s.kpiComparisonSettings.show.value;
    s.kpiComparisonSettings.showPercentChange.visible = s.kpiComparisonSettings.show.value;
    s.kpiComparisonSettings.fontSize.visible = s.kpiComparisonSettings.show.value;
    s.kpiComparisonSettings.fontColor.visible = s.kpiComparisonSettings.show.value;
    s.kpiComparisonSettings.fontFamily.visible = s.kpiComparisonSettings.show.value;
    s.kpiComparisonSettings.fontWeight.visible = s.kpiComparisonSettings.show.value;
    s.kpiComparisonSettings.alignment.visible = s.kpiComparisonSettings.show.value;
    s.kpiComparisonSettings.paddingTop.visible = s.kpiComparisonSettings.show.value;
    s.kpiChangeIndicatorSettings.showIcon.visible = s.kpiChangeIndicatorSettings.show.value;
    s.kpiChangeIndicatorSettings.fontSize.visible = s.kpiChangeIndicatorSettings.show.value;
    s.kpiChangeIndicatorSettings.fontFamily.visible = s.kpiChangeIndicatorSettings.show.value;
    s.kpiChangeIndicatorSettings.fontWeight.visible = s.kpiChangeIndicatorSettings.show.value;
    s.kpiChangeIndicatorSettings.alignment.visible = s.kpiChangeIndicatorSettings.show.value;
    s.kpiChangeIndicatorSettings.paddingTop.visible = s.kpiChangeIndicatorSettings.show.value;
    s.kpiChangeIndicatorSettings.iconSize.visible = s.kpiChangeIndicatorSettings.show.value && s.kpiChangeIndicatorSettings.showIcon.value;
    s.kpiChangeIndicatorSettings.positiveColor.visible = s.kpiChangeIndicatorSettings.show.value;
    s.kpiChangeIndicatorSettings.negativeColor.visible = s.kpiChangeIndicatorSettings.show.value;
    s.kpiChangeIndicatorSettings.neutralColor.visible = s.kpiChangeIndicatorSettings.show.value;
    s.trendSettings.visible = hasTargetRole;
    s.kpiChangeIndicatorSettings.visible = hasChangeRole;
    s.sparklineSettings.visible = hasTrendAxis;
    s.kpiComparisonSettings.visible = hasTargetRole || hasTrendAxis;
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
    s.sparklineSettings.lineColor.visible = sparkShow && sparkType === 'area';
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
    syncTitleFormattingVisibility(s.titleFormattingCard);
    syncCardStyleVisibility(s.cardSettings);
    s.dateFilterFormattingCard.visible = hasDateAxis;
    syncDateFilterFormattingVisibility(s.dateFilterFormattingCard);
    if (!hasDateAxis) {
      s.dateFilterFormattingCard.startDate.visible = false;
      s.dateFilterFormattingCard.endAtCurrentDate.visible = false;
      s.dateFilterFormattingCard.endDate.visible = false;
    }
  }

  /**
   * Extract KPI data from the categorical dataView.
   */
  private extractData(dataView: DataView | undefined): KpiCardData {
    const result: KpiCardData = {
      value: null,
      target: null,
      targetSeries: [],
      label: '',
      trend: [],
      trendLabels: [],
      changeValue: null,
      changeLabel: '',
      changeSeries: [],
      selectionIds: [],
      trendSelectionIds: [],
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
    let changeCol: powerbi.DataViewValueColumn | undefined;

    for (const col of valuesGroup) {
      const roles = col.source.roles;
      if (!roles) continue;
      if (roles['measure'] && !measureCol) measureCol = col;
      if (roles['target'] && !targetCol) targetCol = col;
      if (roles['trendValues'] && !trendCol) trendCol = col;
      if (roles['change'] && !changeCol) changeCol = col;
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
    result.trendSelectionIds = selectionIds;

    result.label = measureCol.source.displayName ?? '';

    const isIncludedRow = (index: number): boolean => !dateIndices || dateIndices.has(index);
    const findLastIncludedNumber = (values: ReadonlyArray<unknown>): { value: number; index: number } | null => {
      for (let i = values.length - 1; i >= 0; i--) {
        if (!isIncludedRow(i)) continue;
        const value = values[i];
        if (typeof value === 'number' && Number.isFinite(value)) {
          return { value, index: i };
        }
      }
      return null;
    };

    // Use the last in-range value (most recent when grouped by time).
    const displayedMeasure = findLastIncludedNumber(measureCol.values);
    result.value = displayedMeasure?.value ?? 0;
    if (displayedMeasure && selectionIds[displayedMeasure.index]) {
      result.selectionIds = [selectionIds[displayedMeasure.index]];
    } else if (!categoryColumn) {
      const builder = this.host.createSelectionIdBuilder();
      result.selectionIds = [
        measureCol.source.queryName
          ? builder.withMeasure(measureCol.source.queryName).createSelectionId()
          : builder.createSelectionId(),
      ];
    }

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
      if (displayedMeasure) {
        const displayedHighlight = hlRaw[displayedMeasure.index];
        result.valueHighlighted = displayedHighlight !== null && displayedHighlight !== undefined;
      }
    }

    // Target
    if (targetCol) {
      result.targetSeries = targetCol.values
        .filter((_, i) => !dateIndices || dateIndices.has(i))
        .map((v) => typeof v === 'number' ? v : null);
      const displayedTarget = findLastIncludedNumber(targetCol.values);
      if (displayedTarget) {
        result.target = displayedTarget.value;
      }
    }

    if (changeCol) {
      result.changeLabel = changeCol.source.displayName ?? 'Change';
      result.changeSeries = changeCol.values
        .filter((_, i) => !dateIndices || dateIndices.has(i))
        .map((v) => typeof v === 'number' ? v : null);
      const displayedChange = findLastIncludedNumber(changeCol.values);
      if (displayedChange) {
        result.changeValue = displayedChange.value;
      }
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

  private render(
    data: KpiCardData,
    highContrast: ReturnType<typeof getHostHighContrastColors>,
  ): void {
    this.hideTooltip();
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
    // Empty state — no value data
    if (data.value === null) {
      this.currentKpiCells = [];
      this.renderEmpty(highContrast);
      if (allowInteractions(this.host)) {
        this.container.addEventListener('click', this.handleBackgroundClick);
      }
      return;
    }

    // Determine KPI count from layout settings
    const kpiCount = Math.max(1, Math.min(4, parseInt(resolveDropdown(s.cardSettings.kpiCount) ?? '1', 10)));

    if (kpiCount === 1) {
      // Single KPI — original behavior
      this.currentKpiCells = [data];
      const wrapper = this.renderSingleKpi(data, 0);
      this.container.appendChild(wrapper);
    } else {
      // Multi-KPI grid layout
      const grid = document.createElement('div');
      grid.className = 'kpi-grid';
      grid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(140px, 100%), 1fr));
        grid-auto-rows: minmax(0, 1fr);
        gap: 8px;
        width: 100%;
        height: 100%;
      `;

      // Build KPI data for each slot from trend data
      const kpiDataSlots = this.buildMultiKpiData(data, kpiCount);
      this.currentKpiCells = kpiDataSlots.filter((slot): slot is KpiCardData => slot !== undefined);
      for (let i = 0; i < kpiCount; i++) {
        const slotData = kpiDataSlots[i];
        if (slotData !== undefined) {
          const cell = this.renderSingleKpi(slotData, i);
          cell.style.borderRadius = `${s.cardSettings.borderRadius.value}px`;
          cell.style.border = '1px solid rgba(0,0,0,0.06)';
          cell.style.overflow = 'auto';
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
          placeholder.textContent = getLocalizedString(this.host, 'KpiCard_NoData', 'No data');
          grid.appendChild(placeholder);
        }
      }

      this.container.appendChild(grid);
    }

    this.applyAccessibility();
    this.applySelectionHighlight();
    if (allowInteractions(this.host)) {
      this.container.addEventListener('click', this.handleBackgroundClick);
    }
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

    // Pick historical snapshots for additional cells. The primary cell already
    // represents the latest point, so avoid duplicating it when possible.
    const additionalCount = count - 1;
    for (let i = 0; i < additionalCount; i++) {
      const lastHistoricalIndex = Math.max(0, trend.length - 2);
      const trendIdx = additionalCount === 1
        ? 0
        : Math.round((i / (additionalCount - 1)) * lastHistoricalIndex);
      const val = trend[trendIdx];
      if (val === undefined) {
        results.push(undefined);
      } else {
        const pointLabel = primaryData.trendLabels[trendIdx] || `Point ${trendIdx + 1}`;
        const selectionId = primaryData.trendSelectionIds[trendIdx];
        results.push({
          value: val,
          target: primaryData.targetSeries[trendIdx] ?? primaryData.target,
          targetSeries: [],
          label: primaryData.label ? `${primaryData.label} - ${pointLabel}` : pointLabel,
          trend: [], // secondary slots do not get their own sparkline data
          trendLabels: [],
          changeValue: primaryData.changeSeries[trendIdx] ?? primaryData.changeValue,
          changeLabel: primaryData.changeLabel,
          changeSeries: [],
          selectionIds: selectionId ? [selectionId] : [],
          trendSelectionIds: [],
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

    const vAlign = resolveDropdown(s.valueSettings.verticalAlignment) ?? 'top';
    const justifyMap: Record<string, string> = { top: 'flex-start', center: 'center', bottom: 'flex-end' };

    const wrapper = document.createElement('div');
    wrapper.className = 'kpi-cell';
    const selectionId = data.selectionIds[0];
    if (selectionId) {
      wrapper.setAttribute('data-selection-key', selectionId.getKey());
    }
    const contentPadding = Math.max(0, s.cardSettings.contentPadding.value);
    wrapper.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 6px;
      height: 100%;
      justify-content: ${justifyMap[vAlign] || 'flex-start'};
      position: relative;
      z-index: 1;
      box-sizing: border-box;
      padding: ${contentPadding}px;
      cursor: ${allowInteractions(this.host) && selectionId ? 'pointer' : 'default'};
    `;
    wrapper.addEventListener('mouseenter', (event) => this.showKpiTooltip(data, event));
    wrapper.addEventListener('mousemove', (event) => this.moveTooltip(event));
    wrapper.addEventListener('mouseleave', () => this.hideTooltip());
    wrapper.addEventListener('contextmenu', (event) => {
      if (!allowInteractions(this.host)) return;
      event.preventDefault();
      event.stopPropagation();
      if (selectionId) {
        void this.selectionManager.showContextMenu(selectionId, {
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
    valueEl.title = data.value === null ? '' : formatWithSettings(data.value, this.settings.numberFormattingCard);

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
      if (!allowInteractions(this.host)) return;
      event.stopPropagation();
      if (selectionId) {
        void this.selectionManager.select(selectionId, event.ctrlKey || event.metaKey).then(() => {
          this.applySelectionHighlight();
        });
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

    this.renderChangeIndicator(wrapper, data);

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
      this.renderGoalProgressBar(wrapper, data);
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
      wrapper.setAttribute('data-cross-highlight-dimmed', 'true');
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
    const userSeriesColor = s.sparklineSettings.sparklineColor.value?.value;
    const seriesColor = (userSeriesColor && userSeriesColor.length > 0)
      ? userSeriesColor
      : getHostChartColor(this.host.colorPalette, 0, themeName);
    const areaFillColor = s.sparklineSettings.lineColor.value?.value || seriesColor;
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
      .domain([Math.min(0, yMin - yPad), Math.max(0, yMax + yPad)])
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
        .attr('fill', seriesColor)
        .attr('opacity', 0.85);

      bars
        .attr('cursor', 'crosshair')
        .attr('pointer-events', 'all')
        .on('mouseover', function (_event: MouseEvent, d: number) {
          const idx = Number(this.getAttribute('data-index') ?? -1);
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
      bars.attr('data-index', (_, index) => index);
    } else {
      const defs = svg.append('defs');
      const grad = defs.append('linearGradient')
        .attr('id', gradId)
        .attr('x1', '0%').attr('y1', '0%')
        .attr('x2', '0%').attr('y2', '100%');
      grad.append('stop').attr('offset', '0%')
        .attr('stop-color', areaFillColor).attr('stop-opacity', fillOp);
      grad.append('stop').attr('offset', '100%')
        .attr('stop-color', areaFillColor).attr('stop-opacity', 0.05);

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
        .attr('stroke', seriesColor)
        .attr('stroke-width', strokeWidth)
        .attr('stroke-linecap', 'round');

      // Endpoint marker
      if (markerType === 'circle') {
        svg.append('circle')
          .attr('cx', endX)
          .attr('cy', endY)
          .attr('r', 3)
          .attr('fill', seriesColor);
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
          .attr('fill', seriesColor);
      } else if (markerType === 'diamond') {
        const size = 4;
        svg.append('polygon')
          .attr('points', `${endX},${endY - size} ${endX + size},${endY} ${endX},${endY + size} ${endX - size},${endY}`)
          .attr('fill', seriesColor);
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
      const animationFrame = requestAnimationFrame(() => {
        const node = animPathEl.node();
        if (node) {
          const cancel = drawPath(node, s.animationSettings.duration.value, 200);
          this.cancelAnimations.push(cancel);
        }
      });
      this.cancelAnimations.push(() => cancelAnimationFrame(animationFrame));
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
    if (data.changeValue !== null) {
      tooltipData.push({
        displayName: data.changeLabel || 'Change',
        value: this.formatSignedChangeValue(data.changeValue),
      });
    }

    this.host.tooltipService.show({
      dataItems: tooltipData,
      identities: data.selectionIds[0] ? [data.selectionIds[0]] : [],
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

  private renderEmpty(highContrast: ReturnType<typeof getHostHighContrastColors>): void {
    if (this.emptyStateMode === 'noData') {
      renderNoDataState(
        this.container,
        getLocalizedString(this.host, 'KpiCard_NoDataSelection', 'No data for the current selection.'),
        highContrast,
      );
      return;
    }
    renderLandingPage(this.container, {
      title: getLocalizedString(this.host, 'KpiCard_LandingTitle', 'Add data to build a KPI card'),
      description: getLocalizedString(this.host, 'KpiCard_EmptyState', 'Bind a value measure, then optionally add a target, change, and trend axis.'),
      steps: [
        getLocalizedString(this.host, 'KpiCard_LandingStepValue', 'Value'),
        getLocalizedString(this.host, 'KpiCard_LandingStepTarget', 'Optional target or change'),
        getLocalizedString(this.host, 'KpiCard_LandingStepTrend', 'Optional trend axis'),
      ],
    }, highContrast);
  }

  private handleBackgroundClick = (): void => {
    if (!allowInteractions(this.host)) return;
    void this.selectionManager.clear().then(() => {
      this.applySelectionHighlight();
    });
  };

  private applySelectionHighlight(): void {
    const selectedKeys = new Set(
      (this.selectionManager.getSelectionIds() as ISelectionId[]).map((id) => id.getKey()),
    );
    const hasSelection = selectedKeys.size > 0;
    this.container.querySelectorAll<HTMLElement>('.kpi-cell').forEach((cell) => {
      const key = cell.getAttribute('data-selection-key');
      const isSelected = key !== null && selectedKeys.has(key);
      cell.style.opacity = hasSelection
        ? (isSelected ? '' : '0.3')
        : (cell.hasAttribute('data-cross-highlight-dimmed') ? '0.3' : '');
      cell.style.boxShadow = isSelected ? 'inset 0 0 0 2px rgba(37, 99, 235, 0.5)' : '';
    });
  }

  // -- Goal / Target Progress Bar ---------------------------------------------

  private renderGoalProgressBar(wrapper: HTMLElement, data: KpiCardData): void {
    const goalSettings = this.settings.kpiGoalSettings;
    if (!goalSettings.show.value) return;

    const value = data.value;
    if (value === null) return;

    const goal = this.resolveGoal(data);
    if (!goal) return;

    const goalValue = goal.value;
    const warningValue = this.resolveGoalWarningValue(goalValue);
    const colors = {
      met: goalSettings.metColor.value?.value || '#22C55E',
      warning: goalSettings.warningColor.value?.value || '#F59E0B',
      unmet: goalSettings.unmetColor.value?.value || '#EF4444',
    };
    const status = value >= goalValue ? 'met' : value >= warningValue ? 'warning' : 'unmet';
    const statusColor = this.getGoalStatusColor(value, warningValue, goalValue, colors);
    const progress = Math.min(100, Math.max(0, (value / goalValue) * 100));
    const progressBarHeight = Math.max(2, goalSettings.progressBarHeight.value);
    const barScale = this.getGoalBarScale(value, warningValue, goalValue);
    const warningPct = (warningValue / barScale) * 100;
    const goalPct = (goalValue / barScale) * 100;
    const markerPct = Math.min(100, Math.max(0, (value / barScale) * 100));

    const goalBlock = document.createElement('div');
    goalBlock.className = 'kpi-goal-block';
    goalBlock.style.cssText = `
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 3px;
      margin-top: ${Math.max(0, goalSettings.goalBlockPaddingTop.value)}px;
    `;

    const formattedValue = formatWithSettings(value, this.settings.numberFormattingCard);
    const formattedGoal = formatWithSettings(goalValue, this.settings.numberFormattingCard);

    if (goalSettings.showProgressBar.value) {
      const barContainer = document.createElement('div');
      barContainer.className = 'kpi-goal-bar-container';
      barContainer.title = `${formattedValue} of ${goal.label.toLowerCase()} ${formattedGoal}`;
      barContainer.setAttribute('role', 'img');
      barContainer.setAttribute('aria-label', `${formattedValue} of ${goal.label} ${formattedGoal}`);
      barContainer.style.cssText = `
        width: 100%;
        height: ${progressBarHeight}px;
        background: rgba(15, 23, 42, 0.08);
        border-radius: ${Math.round(progressBarHeight / 2)}px;
        overflow: visible;
        position: relative;
        display: flex;
      `;

      if (goalSettings.gradientProgress.value) {
        const gradientTrack = document.createElement('div');
        gradientTrack.className = 'kpi-goal-gradient-track';
        gradientTrack.style.cssText = `
          width: 100%;
          height: 100%;
          border-radius: ${Math.round(progressBarHeight / 2)}px;
          background: linear-gradient(90deg, ${colors.unmet} 0%, ${colors.warning} ${warningPct}%, ${colors.met} ${goalPct}%, ${colors.met} 100%);
          opacity: 0.9;
        `;
        barContainer.appendChild(gradientTrack);
      } else {
        const segments = [
          { className: 'unmet', width: warningPct, color: colors.unmet },
          { className: 'warning', width: Math.max(0, goalPct - warningPct), color: colors.warning },
          { className: 'met', width: Math.max(0, 100 - goalPct), color: colors.met },
        ];

        for (let i = 0; i < segments.length; i++) {
          const segment = segments[i];
          const segmentEl = document.createElement('div');
          segmentEl.className = `kpi-goal-range-segment kpi-goal-range-segment-${segment.className}`;
          segmentEl.style.cssText = `
            width: ${segment.width}%;
            min-width: ${segment.width > 0 ? 2 : 0}px;
            height: 100%;
            background: ${segment.color};
            opacity: 0.9;
          `;
          if (i === 0) {
            segmentEl.style.borderTopLeftRadius = `${Math.round(progressBarHeight / 2)}px`;
            segmentEl.style.borderBottomLeftRadius = `${Math.round(progressBarHeight / 2)}px`;
          }
          if (i === segments.length - 1) {
            segmentEl.style.borderTopRightRadius = `${Math.round(progressBarHeight / 2)}px`;
            segmentEl.style.borderBottomRightRadius = `${Math.round(progressBarHeight / 2)}px`;
          }
          barContainer.appendChild(segmentEl);
        }
      }

      const marker = document.createElement('div');
      marker.className = 'kpi-goal-marker';
      marker.setAttribute('data-status', status);
      marker.setAttribute('data-gradient', String(goalSettings.gradientProgress.value));
      marker.style.cssText = `
        position: absolute;
        left: ${markerPct}%;
        top: 50%;
        width: ${Math.max(6, progressBarHeight + 3)}px;
        height: ${Math.max(6, progressBarHeight + 3)}px;
        border: 2px solid #FFFFFF;
        border-radius: 50%;
        background: ${statusColor};
        box-shadow: 0 1px 4px rgba(15, 23, 42, 0.28);
        transform: translate(-50%, -50%);
        transition: left 0.3s ease;
      `;

      barContainer.appendChild(marker);
      goalBlock.appendChild(barContainer);
    }

    // Goal text
    if (goalSettings.showGoalText.value) {
      const goalText = document.createElement('div');
      goalText.className = 'kpi-goal-text';
      const alignment = resolveDropdown(goalSettings.goalTextAlignment) ?? 'center';
      const goalFontFamily = resolveDropdown(goalSettings.goalTextFontFamily);
      const goalFontWeight = resolveDropdown(goalSettings.goalTextFontWeight) ?? 'normal';
      goalText.style.cssText = `
        width: 100%;
        text-align: ${alignment};
        font-size: ${goalSettings.goalTextFontSize.value}px;
        color: ${goalSettings.goalTextColor.value?.value || '#64748B'};
        margin-top: ${Math.max(0, goalSettings.goalTextPaddingTop.value)}px;
        font-weight: ${goalFontWeight};
      `;
      if (goalFontFamily) {
        goalText.style.fontFamily = goalFontFamily;
      }
      const formattedWarning = formatWithSettings(warningValue, this.settings.numberFormattingCard);
      goalText.textContent = `${Math.round(progress)}% of ${goal.label} | ${goal.label} ${formattedGoal} | Caution ${formattedWarning}`;
      goalBlock.appendChild(goalText);
    }

    if (goalSettings.showProgressBar.value && goalSettings.showGoalLegend.value) {
      goalBlock.appendChild(this.createGoalLegend(warningValue, goalValue, colors));
    }

    if (goalBlock.childElementCount > 0) {
      wrapper.appendChild(goalBlock);
    }
  }

  private resolveGoal(data: KpiCardData): { value: number; label: 'Target' | 'Goal' } | null {
    const manualGoal = this.settings.kpiGoalSettings.goalValue.value;
    if (Number.isFinite(manualGoal) && manualGoal > 0) {
      return { value: manualGoal, label: 'Goal' };
    }

    if (typeof data.target === 'number' && Number.isFinite(data.target) && data.target > 0) {
      return { value: data.target, label: 'Target' };
    }

    return null;
  }

  private resolveGoalWarningValue(goalValue: number): number {
    const configured = this.settings.kpiGoalSettings.goalWarningValue.value;
    if (Number.isFinite(configured) && configured > 0 && configured < goalValue) {
      return configured;
    }

    return Math.max(0, goalValue * 0.67);
  }

  private getGoalBarScale(value: number, warningValue: number, goalValue: number): number {
    const thresholdSpan = Math.max(goalValue - warningValue, goalValue * 0.25, 1);
    return Math.max(value, goalValue + thresholdSpan);
  }

  private getGoalStatusColor(
    value: number,
    warningValue: number,
    goalValue: number,
    colors: { met: string; warning: string; unmet: string },
  ): string {
    if (!this.settings.kpiGoalSettings.gradientProgress.value) {
      if (value >= goalValue) return colors.met;
      if (value >= warningValue) return colors.warning;
      return colors.unmet;
    }

    return d3.scaleLinear<string>()
      .domain([0, warningValue, goalValue])
      .range([colors.unmet, colors.warning, colors.met])
      .clamp(true)(value);
  }

  private createGoalLegend(
    warningValue: number,
    goalValue: number,
    colors: { met: string; warning: string; unmet: string },
  ): HTMLElement {
    const legend = document.createElement('div');
    legend.className = 'kpi-goal-legend';
    legend.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      font-size: 9px;
      line-height: 1.2;
      color: #64748B;
    `;

    const formatLegendValue = (v: number): string => formatWithSettings(v, this.settings.numberFormattingCard);
    const baseItems = [
      { label: `>= ${formatLegendValue(goalValue)}`, color: colors.met },
      { label: `${formatLegendValue(warningValue)} - ${formatLegendValue(goalValue)}`, color: colors.warning },
      { label: `< ${formatLegendValue(warningValue)}`, color: colors.unmet },
    ];
    const items = this.settings.kpiGoalSettings.invertLegendDirection.value
      ? [...baseItems].reverse()
      : baseItems;

    for (const item of items) {
      const legendItem = document.createElement('span');
      legendItem.className = 'kpi-goal-legend-item';
      legendItem.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 3px;
        white-space: nowrap;
      `;

      const swatch = document.createElement('span');
      swatch.className = 'kpi-goal-legend-swatch';
      swatch.style.cssText = `
        width: 6px;
        height: 6px;
        border-radius: 999px;
        background: ${item.color};
        display: inline-block;
      `;

      const text = document.createElement('span');
      text.textContent = item.label;

      legendItem.appendChild(swatch);
      legendItem.appendChild(text);
      legend.appendChild(legendItem);
    }

    return legend;
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
    const comparisonAlignment = resolveDropdown(comparison.alignment) ?? 'left';
    const comparisonFontFamily = resolveDropdown(comparison.fontFamily);
    const comparisonFontWeight = resolveDropdown(comparison.fontWeight) ?? 'normal';
    const comparisonJustify = comparisonAlignment === 'center'
      ? 'center'
      : comparisonAlignment === 'right'
        ? 'flex-end'
        : 'flex-start';
    compEl.style.cssText = `
      display: flex;
      align-items: center;
      gap: 4px;
      width: 100%;
      justify-content: ${comparisonJustify};
      text-align: ${comparisonAlignment};
      margin-top: ${Math.max(0, comparison.paddingTop.value)}px;
    `;
    compEl.style.fontSize = `${comparison.fontSize.value}px`;
    compEl.style.color = comparison.fontColor.value?.value || '#64748B';
    compEl.style.fontWeight = comparisonFontWeight;
    if (comparisonFontFamily) {
      compEl.style.fontFamily = comparisonFontFamily;
    }

    if (comparison.showPercentChange.value && baseValue !== null && baseValue !== 0) {
      const pct = ((delta / Math.abs(baseValue)) * 100).toFixed(1);
      const sign = delta >= 0 ? '+' : '';
      compEl.textContent = `${sign}${pct}% ${vsLabel}`;
    } else {
      compEl.textContent = `Delta: ${formatWithSettings(delta, this.settings.numberFormattingCard)}`;
    }

    wrapper.appendChild(compEl);
  }

  private renderChangeIndicator(wrapper: HTMLElement, data: KpiCardData): void {
    const change = this.settings.kpiChangeIndicatorSettings;
    if (!change.show.value || data.changeValue === null) return;

    const color = this.getChangeColor(data.changeValue);
    const alignment = resolveDropdown(change.alignment) ?? 'left';
    const justify = alignment === 'center'
      ? 'center'
      : alignment === 'right'
        ? 'flex-end'
        : 'flex-start';
    const fontFamily = resolveDropdown(change.fontFamily);
    const fontWeight = resolveDropdown(change.fontWeight) ?? '600';

    const el = document.createElement('div');
    el.className = 'kpi-change-indicator';
    el.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      justify-content: ${justify};
      text-align: ${alignment};
      margin-top: ${Math.max(0, change.paddingTop.value)}px;
      color: ${color};
      font-size: ${change.fontSize.value}px;
      font-weight: ${fontWeight};
    `;
    if (fontFamily) {
      el.style.fontFamily = fontFamily;
    }

    if (change.showIcon.value) {
      el.appendChild(this.createChangeIndicatorIcon(data.changeValue, color, Math.max(8, change.iconSize.value)));
    }

    const valueEl = document.createElement('span');
    valueEl.className = 'kpi-change-indicator-value';
    valueEl.textContent = this.formatSignedChangeValue(data.changeValue);
    el.appendChild(valueEl);

    wrapper.appendChild(el);
  }

  private createChangeIndicatorIcon(value: number, color: string, size: number): SVGSVGElement {
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('width', `${size}`);
    svg.setAttribute('height', `${size}`);
    svg.setAttribute('aria-hidden', 'true');

    const line = document.createElementNS(svgNs, 'path');
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', '1.8');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('stroke-linejoin', 'round');

    if (value > 0) {
      line.setAttribute('d', 'M2 11 L6 7 L9 9 L13 4 M10.5 4 H13 V6.5');
    } else if (value < 0) {
      line.setAttribute('d', 'M2 5 L6 9 L9 7 L13 12 M10.5 12 H13 V9.5');
    } else {
      line.setAttribute('d', 'M2 8 H13');
    }

    svg.appendChild(line);
    return svg;
  }

  private getChangeColor(value: number): string {
    const change = this.settings.kpiChangeIndicatorSettings;
    if (value > 0) return change.positiveColor.value?.value || '#16A34A';
    if (value < 0) return change.negativeColor.value?.value || '#DC2626';
    return change.neutralColor.value?.value || '#64748B';
  }

  private formatSignedChangeValue(value: number): string {
    const magnitude = formatWithSettings(Math.abs(value), this.settings.numberFormattingCard);
    if (value > 0) return `+${magnitude}`;
    if (value < 0) return `-${magnitude}`;
    return magnitude;
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
      dataPointCount: this.currentKpiCells.length,
    });
    const valueRows = this.container.querySelectorAll('.kpi-value-row');
    valueRows.forEach((row, index) => {
      const data = this.currentKpiCells[index];
      if (!data) return;
      applyDataPointAria(
        row,
        data.label || 'KPI',
        data.value === null ? '\u2014' : formatWithSettings(data.value, this.settings.numberFormattingCard),
        index,
        this.currentKpiCells.length,
      );
      row.setAttribute('tabindex', '0');
      row.setAttribute('aria-keyshortcuts', 'Enter Space ArrowLeft ArrowRight ArrowUp ArrowDown Home End');
      row.setAttribute('aria-disabled', allowInteractions(this.host) ? 'false' : 'true');
    });
    const cleanup = attachKeyboardNav({
      container: this.container,
      itemSelector: '.kpi-value-row',
      onActivate: (el) => {
        if (allowInteractions(this.host)) {
          (el as HTMLElement).click?.();
        }
      },
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
  targetSeries: Array<number | null>;
  label: string;
  trend: number[];
  trendLabels: string[];
  changeValue: number | null;
  changeLabel: string;
  changeSeries: Array<number | null>;
  selectionIds: ISelectionId[];
  trendSelectionIds: ISelectionId[];
  /** Whether cross-highlight data is present from another visual/slicer */
  hasHighlights: boolean;
  /** Whether the value is highlighted (non-null highlight on the measure) */
  valueHighlighted: boolean;
}
