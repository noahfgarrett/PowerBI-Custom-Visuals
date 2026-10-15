/**
 * Progress Bar Stack — Power BI IVisual implementation.
 * Renders horizontal progress bars stacked vertically per category,
 * with growBar animation and countUp labels.
 */

import powerbi from 'powerbi-visuals-api';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { ProgressBarStackSettings } from './settings';
import * as d3 from 'd3';
import {
  growBar,
  countUp,
  fadeSlideIn,
  DURATION,
  formatNumber,
  formatWithSettings,
  applyCardStyle,
  type CardStyleMode,
  getHostChartColor,
  renderChartTitle,
  applyDataLabelFormatting,
  resolveColorTheme,
  buildConditionalConfig,
  resolveConditionalColor,
  applyChartAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
  allowInteractions,
  computeStatValue,
  type StatType,
  computeRegression,
  type TrendType,
  renderAnnotations,
  buildAnnotationConfig,
  resolveDropdown,
  applySortOrder,
  getDateFilterIndices,
  isDateColumn,
  type DateFilterConfig,
  syncCardStyleVisibility,
  syncTitleFormattingVisibility,
  attachEmptySpaceContextMenu,
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
import ISelectionId = powerbi.visuals.ISelectionId;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import '../style/visual.less';

interface ProgressBarRow {
  label: string;
  value: number;
  target: number;
  hasExplicitTarget: boolean;
  selectionId: ISelectionId;
  highlighted: boolean;
}

interface ProgressBarData {
  rows: ProgressBarRow[];
  hasHighlights: boolean;
}

export class ProgressBarStackVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: ProgressBarStackSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];
  private keyboardNavCleanup: (() => void) | null = null;
  private currentProgressData: ProgressBarData | null = null;
  private emptyStateMode: 'unconfigured' | 'noData' = 'unconfigured';

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new ProgressBarStackSettings();
    this.formattingSettingsService = new FormattingSettingsService(options.host.createLocalizationManager());
    this.container.classList.add('progress-bar-container');
    attachEmptySpaceContextMenu(this.container, this.selectionManager, () =>
      this.host.createSelectionIdBuilder().createSelectionId(),
      () => allowInteractions(this.host),
    );
  }

  public update(options: VisualUpdateOptions): void {
    notifyRenderingStarted(this.host, options);
    try {
      // Cancel any running animations
      this.cancelAnimations.forEach((cancel) => cancel());
      this.cancelAnimations = [];

      // Parse settings
      const dataView = options.dataViews?.[0];
      const hasMeasureRole = dataView?.metadata?.columns?.some((column) => column.roles?.['measure']) ?? false;
      this.emptyStateMode = hasMeasureRole ? getVisualEmptyStateMode(dataView) : 'unconfigured';
      if (dataView) {
        this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
          ProgressBarStackSettings,
          dataView
        );
      }
      syncTitleFormattingVisibility(this.settings.titleFormattingCard);

      // Migrate legacy enableGlass -> cardStyleMode (backward compat)
      const legacyCardObj = dataView?.metadata?.objects?.['cardSettings'];
      const legacyGlass = legacyCardObj?.['enableGlass'];
      if (legacyCardObj?.['cardStyleMode'] === undefined && legacyGlass === false) {
        this.settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
      }

      // Hide inapplicable shared axis properties — progress-bar-stack only uses axisLabelColor and axisLabelSize

      const categoryColumn = dataView?.categorical?.categories?.[0];
      const hasDateAxis = Boolean(categoryColumn && isDateColumn(categoryColumn.source));
      const hasTargetRole = dataView?.metadata?.columns?.some((column) => column.roles?.['target']) ?? false;
      this.settings.dateFilterFormattingCard.visible = hasDateAxis;
      this.settings.dateFilterFormattingCard.startDate.visible = hasDateAxis
        && this.settings.dateFilterFormattingCard.enableDateFilter.value;
      this.settings.dateFilterFormattingCard.endAtCurrentDate.visible = hasDateAxis
        && this.settings.dateFilterFormattingCard.enableDateFilter.value;
      this.settings.dateFilterFormattingCard.endDate.visible = hasDateAxis
        && this.settings.dateFilterFormattingCard.enableDateFilter.value
        && !this.settings.dateFilterFormattingCard.endAtCurrentDate.value;
      this.settings.axisFormattingCard.showXAxis.visible = false;
      this.settings.axisFormattingCard.showYAxis.visible = false;
      this.settings.axisFormattingCard.xAxisTitle.visible = false;
      this.settings.axisFormattingCard.yAxisTitle.visible = false;
      this.settings.axisFormattingCard.axisLabelRotation.visible = false;
      this.settings.axisFormattingCard.yAxisMin.visible = false;
      this.settings.axisFormattingCard.yAxisMax.visible = false;
      this.settings.axisFormattingCard.axisLineColor.visible = false;
      this.settings.axisFormattingCard.axisLineWidth.visible = false;
      this.settings.axisFormattingCard.showGridLines.visible = false;
      this.settings.axisFormattingCard.gridLineColor.visible = false;
      this.settings.axisFormattingCard.gridLineStyle.visible = false;
      this.settings.axisFormattingCard.gridLineWidth.visible = false;
      this.settings.axisFormattingCard.gridLineOpacity.visible = false;
      this.settings.dataLabelFormattingCard.showDataLabels.visible = false;

      const referenceSettings = this.settings.referenceLineFormattingCard;
      const showReferenceLine = referenceSettings.showReferenceLine.value;
      const referenceType = resolveDropdown(referenceSettings.referenceLineType) ?? 'custom';
      referenceSettings.referenceLineType.visible = showReferenceLine;
      referenceSettings.referenceLineValue.visible = showReferenceLine && referenceType === 'custom';
      referenceSettings.referenceLineColor.visible = showReferenceLine;
      referenceSettings.referenceLineWidth.visible = showReferenceLine;
      referenceSettings.referenceLineStyle.visible = showReferenceLine;
      referenceSettings.showReferenceLabel.visible = showReferenceLine;
      referenceSettings.referenceLabelText.visible = showReferenceLine
        && referenceSettings.showReferenceLabel.value;
      referenceSettings.showReferenceBand.visible = showReferenceLine;
      referenceSettings.referenceBandOpacity.visible = showReferenceLine
        && referenceSettings.showReferenceBand.value;
      referenceSettings.referenceBandWidth.visible = showReferenceLine
        && referenceSettings.showReferenceBand.value;
      referenceSettings.referenceLineAxis.visible = false;

      const trendSettings = this.settings.trendLineFormattingCard;
      const showTrendLine = trendSettings.showTrendLine.value;
      const trendType = resolveDropdown(trendSettings.trendLineType) ?? 'linear';
      trendSettings.trendLineType.visible = showTrendLine;
      trendSettings.trendLineColor.visible = showTrendLine;
      trendSettings.trendLineWidth.visible = showTrendLine;
      trendSettings.polynomialOrder.visible = showTrendLine && trendType === 'polynomial';
      trendSettings.showEquation.visible = showTrendLine;
      trendSettings.showR2.visible = showTrendLine;
      trendSettings.trendLineAxis.visible = false;

      const annotationSettings = this.settings.annotationFormattingCard;
      const showAnnotations = annotationSettings.showAnnotations.value;
      [
        annotationSettings.annotation1Category,
        annotationSettings.annotation1Text,
        annotationSettings.annotation1Position,
        annotationSettings.annotation2Category,
        annotationSettings.annotation2Text,
        annotationSettings.annotation2Position,
        annotationSettings.annotation3Category,
        annotationSettings.annotation3Text,
        annotationSettings.annotation3Position,
        annotationSettings.annotationFontSize,
        annotationSettings.annotationFontColor,
        annotationSettings.annotationFontFamily,
        annotationSettings.annotationFontWeight,
        annotationSettings.annotationConnectorColor,
        annotationSettings.annotationOffset,
        annotationSettings.annotationPadding,
        annotationSettings.annotationBackgroundColor,
        annotationSettings.annotationBackgroundOpacity,
        annotationSettings.annotationCornerRadius,
      ].forEach((slice) => {
        slice.visible = showAnnotations;
      });

      // Hide data label position — position is determined by bar geometry
      this.settings.dataLabelFormattingCard.dataLabelPosition.visible = false;

      // Conditional visibility: hide gradient colors when gradient is disabled
      this.settings.barAppearance.gradientStartColor.visible = this.settings.barAppearance.gradientEnabled.value;
      this.settings.barAppearance.gradientEndColor.visible = this.settings.barAppearance.gradientEnabled.value;
      this.settings.animationSettings.duration.visible = this.settings.animationSettings.enabled.value;

      const showCategoryLabels = this.settings.barSettings.showLabels.value;
      this.settings.barSettings.labelPosition.visible = showCategoryLabels;
      this.settings.barAppearance.labelColor.visible = showCategoryLabels;
      this.settings.barAppearance.labelFontSize.visible = showCategoryLabels;
      this.settings.barAppearance.labelFontFamily.visible = showCategoryLabels;
      this.settings.barAppearance.labelFontWeight.visible = showCategoryLabels;

      // Conditional visibility: hide milestone CSV and color when milestones are off
      this.settings.progressMilestone.milestones.visible = this.settings.progressMilestone.show.value;
      this.settings.progressMilestone.milestoneColor.visible = this.settings.progressMilestone.show.value;

      // Conditional visibility: hide target color/lineWidth when target is off
      this.settings.targetSettings.visible = hasTargetRole;
      this.settings.targetSettings.color.visible = this.settings.targetSettings.show.value;
      this.settings.targetSettings.lineWidth.visible = this.settings.targetSettings.show.value;

      syncCardStyleVisibility(this.settings.cardSettings);
      const conditionalEnabled = this.settings.conditionalFormattingCard.enableConditional.value;
      this.settings.conditionalFormattingCard.conditionalDirection.visible = conditionalEnabled;
      this.settings.conditionalFormattingCard.threshold1.visible = conditionalEnabled;
      this.settings.conditionalFormattingCard.threshold2.visible = conditionalEnabled;
      this.settings.conditionalFormattingCard.conditionalColor1.visible = conditionalEnabled;
      this.settings.conditionalFormattingCard.conditionalColor2.visible = conditionalEnabled;
      this.settings.conditionalFormattingCard.conditionalColor3.visible = conditionalEnabled;

      // Extract data
      const extractedData = this.extractData(dataView);
      const progressData = extractedData;
      this.currentProgressData = progressData;

      const highContrast = getHostHighContrastColors(this.host);
      this.render(progressData.rows, options.viewport, highContrast);
      applyBasicHighContrastStyles(this.container, highContrast, {
        textSelectors: ['.progress-label', '.progress-value', '.progress-reference-label', '.progress-trend-label', '.progress-empty', '.pbi-landing-page-title', '.pbi-landing-page-description', '.pbi-landing-page-hint', '.pbi-landing-page li'],
        fillSelectors: ['.progress-fill', '.progress-track', '.progress-overlay-svg rect', '.pbi-landing-page'],
        strokeSelectors: ['.progress-overlay-svg line', '.progress-overlay-svg path'],
      });
      notifyRenderingFinished(this.host, options);
    } catch (error) {
      notifyRenderingFailed(this.host, options, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private extractData(dataView: DataView | undefined): ProgressBarData {
    const emptyResult: ProgressBarData = { rows: [], hasHighlights: false };

    if (!dataView?.categorical) return emptyResult;

    const categorical = dataView.categorical;
    const values = categorical.values;
    const categoryColumn = categorical.categories?.[0];
    if (!values) return emptyResult;

    // Find measure and target columns
    const measureColumns = values.filter((col) => col.source.roles?.['measure']);
    const targetColumns = values.filter((col) => col.source.roles?.['target']);
    if (measureColumns.length === 0) return emptyResult;

    if (!categoryColumn) {
      const rows: ProgressBarRow[] = [];
      const populatedMeasureColumns = measureColumns
        .map((column, measureIndex) => ({ column, measureIndex }))
        .filter(({ column }) => column.values.length > 0);
      if (populatedMeasureColumns.length === 0) return emptyResult;
      let globalMax = 0;

      for (const { column: col } of populatedMeasureColumns) {
        const rawValue = col.values?.[0];
        const value = typeof rawValue === 'number' ? rawValue : 0;
        if (value > globalMax) globalMax = value;
      }
      if (globalMax === 0) globalMax = 1;

      for (let i = 0; i < populatedMeasureColumns.length; i++) {
        const { column: measureColumn, measureIndex } = populatedMeasureColumns[i];
        const rawValue = measureColumn.values?.[0];
        const value = typeof rawValue === 'number' ? rawValue : 0;

        const targetColumn = targetColumns.length <= 1 ? targetColumns[0] : targetColumns[measureIndex];
        const rawTarget = targetColumn?.values?.[0];
        const hasExplicitTarget = typeof rawTarget === 'number'
          && Number.isFinite(rawTarget)
          && rawTarget > 0;
        const target = hasExplicitTarget ? rawTarget : globalMax;

        const builder = this.host.createSelectionIdBuilder();
        const queryName = measureColumn.source.queryName;
        const selectionId = queryName
          ? builder.withMeasure(queryName).createSelectionId()
          : builder.createSelectionId();
        const highlighted = measureColumn.highlights?.[0] !== null && measureColumn.highlights?.[0] !== undefined;

        rows.push({
          label: measureColumn.source.displayName ?? `Measure ${i + 1}`,
          value,
          target,
          hasExplicitTarget,
          selectionId,
          highlighted,
        });
      }

      const sortedRows = applySortOrder(
        rows.map((row) => ({ ...row, name: row.label })),
        this.settings.sortFormattingCard,
      ).map(({ name: _name, ...row }) => row);

      return { rows: sortedRows, hasHighlights: rows.some((row) => row.highlighted) };
    }

    const measureColumn = measureColumns[0];
    const targetColumn = targetColumns[0];

    // Cross-highlight detection: read highlights from the measure column
    const hlRaw = measureColumn.highlights as unknown[] | undefined;
    let hasHighlights = false;
    if (hlRaw) {
      for (const h of hlRaw) {
        if (h !== null && h !== undefined) {
          hasHighlights = true;
          break;
        }
      }
    }

    const rows: ProgressBarRow[] = [];

    const dateConfig: DateFilterConfig = {
      enabled: this.settings.dateFilterFormattingCard.enableDateFilter.value,
      startDate: this.settings.dateFilterFormattingCard.startDate.value,
      endAtCurrentDate: this.settings.dateFilterFormattingCard.endAtCurrentDate.value,
      endDate: this.settings.dateFilterFormattingCard.endDate.value,
    };
    const dateIndices = isDateColumn(categoryColumn.source) ? getDateFilterIndices(categoryColumn.values, dateConfig) : null;

    const count = categoryColumn.values.length;

    // First pass: collect all values to compute fallback target (max of all values)
    let globalMax = 0;
    for (let i = 0; i < count; i++) {
      const val = measureColumn.values[i];
      if (typeof val === 'number' && val > globalMax) {
        globalMax = val;
      }
    }

    // If globalMax is 0, avoid division by zero — use 1
    if (globalMax === 0) globalMax = 1;

    // Second pass: build row data
    for (let i = 0; i < count; i++) {
      if (dateIndices && !dateIndices.has(i)) continue;
      const label = String(categoryColumn.values[i] ?? '');
      const value = typeof measureColumn.values[i] === 'number'
        ? (measureColumn.values[i] as number)
        : 0;

      const rawTarget = targetColumn?.values[i];
      const hasExplicitTarget = typeof rawTarget === 'number'
        && Number.isFinite(rawTarget)
        && rawTarget > 0;
      const target = hasExplicitTarget ? rawTarget : globalMax;

      const selectionId = this.host.createSelectionIdBuilder()
        .withCategory(categoryColumn, i)
        .createSelectionId();

      const highlighted = hasHighlights ? (hlRaw !== undefined && hlRaw[i] !== null && hlRaw[i] !== undefined) : false;

      rows.push({ label, value, target, hasExplicitTarget, selectionId, highlighted });
    }

    const sortedRows = applySortOrder(
      rows.map((row) => ({ ...row, name: row.label })),
      this.settings.sortFormattingCard,
    ).map(({ name: _name, ...row }) => row);

    return { rows: sortedRows, hasHighlights };
  }

  private render(rows: ProgressBarRow[], viewport: powerbi.IViewport, highContrast: ReturnType<typeof getHostHighContrastColors>): void {
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    // Clear container — no innerHTML
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);

    this.container.removeEventListener('click', this.handleBackgroundClick);
    if (allowInteractions(this.host)) {
      this.container.addEventListener('click', this.handleBackgroundClick);
    }

    const s = this.settings;

    // Apply card style
    const cardMode = (resolveDropdown(s.cardSettings.cardStyleMode) ?? 'glass') as CardStyleMode;
    applyCardStyle(
      this.container,
      {
        mode: cardMode,
        opacity: s.cardSettings.backgroundOpacity.value / 100,
        backgroundColor: s.cardSettings.backgroundColor.value?.value,
        borderRadius: s.cardSettings.borderRadius.value,
      },
    );
    const contentPadding = Math.max(0, s.cardSettings.contentPadding.value);
    this.container.style.padding = `${contentPadding}px`;
    this.container.style.boxSizing = 'border-box';

    // Empty data — show placeholder
    if (rows.length === 0) {
      if (this.emptyStateMode === 'noData') {
        renderNoDataState(
          this.container,
          getLocalizedString(this.host, 'ProgressBarStack_NoDataState', 'No data for the current selection.'),
          highContrast,
        );
        return;
      }
      renderLandingPage(this.container, {
        title: getLocalizedString(this.host, 'ProgressBarStack_LandingTitle', 'Add data to build progress bars'),
        description: getLocalizedString(this.host, 'ProgressBarStack_LandingDescription', 'Bind a numeric measure to render progress rows. Optionally add a category for row labels, or use multiple measures for one row per measure.'),
        steps: [getLocalizedString(this.host, 'ProgressBarStack_LandingStepCategory', 'Optional category'), getLocalizedString(this.host, 'ProgressBarStack_LandingStepMeasure', 'Measure'), getLocalizedString(this.host, 'ProgressBarStack_LandingStepOptional', 'Optional target')],
      }, highContrast);
      return;
    }

    // Create scrollable wrapper
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: ${s.barSettings.gap.value}px;
      width: 100%;
    `;

    const barHeight = s.barSettings.barHeight.value;
    const cornerRadius = s.barSettings.cornerRadius.value;
    const barCornerRadius = s.barSettings.barCornerRadius.value;
    const barColor = s.barAppearance.barColor.value?.value ?? '#3B82F6';
    const trackColor = s.barAppearance.trackColor.value?.value || '#E2E8F0';
    const labelColor = s.barAppearance.labelColor.value?.value;
    const labelFontSize = s.barAppearance.labelFontSize.value;
    const labelFontFamily = resolveDropdown(s.barAppearance.labelFontFamily);
    const labelFontWeight = resolveDropdown(s.barAppearance.labelFontWeight);
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rawPct = row.target > 0 ? row.value / row.target : 0;
      const pct = Math.max(0, Math.min(rawPct, 1));

      // Row container
      const rowEl = document.createElement('div');
      rowEl.className = 'progress-row';
      rowEl.setAttribute('data-selection-key', row.selectionId.getKey());
      rowEl.style.gap = `${Math.max(0, s.barSettings.contentGap.value)}px`;
      rowEl.style.cursor = allowInteractions(this.host) ? 'pointer' : 'default';
      rowEl.addEventListener('click', (event) => {
        if (!allowInteractions(this.host)) return;
        event.stopPropagation();
        void this.selectionManager.select(row.selectionId, event.ctrlKey || event.metaKey).then(() => {
          this.applySelectionHighlight(rows);
        });
      });
      rowEl.addEventListener('contextmenu', (event) => {
        if (!allowInteractions(this.host)) return;
        event.preventDefault();
        event.stopPropagation();
        void this.selectionManager.showContextMenu(row.selectionId, {
          x: event.clientX,
          y: event.clientY,
        });
      });

      // Label
      const showLabelsToggle = s.barSettings.showLabels.value;
      const labelPos = resolveDropdown(s.barSettings.labelPosition) ?? 'left';
      const renderInsideLabel = showLabelsToggle && (
        labelPos === 'insideStart'
        || labelPos === 'insideEnd'
        || labelPos === 'inline'
      );

      if (showLabelsToggle && labelPos === 'above') {
        rowEl.classList.add('progress-row--label-above');
        const aboveLabelEl = document.createElement('div');
        aboveLabelEl.className = 'progress-label';
        aboveLabelEl.textContent = row.label;
        aboveLabelEl.title = row.label;
        aboveLabelEl.style.width = '100%';
        rowEl.appendChild(aboveLabelEl);
      }

      if (showLabelsToggle && labelPos === 'left') {
        const leftLabelEl = document.createElement('div');
        leftLabelEl.className = 'progress-label';
        leftLabelEl.textContent = row.label;
        leftLabelEl.title = row.label;
        rowEl.appendChild(leftLabelEl);
      }

      // Track (background bar)
      const trackEl = document.createElement('div');
      trackEl.className = 'progress-track';
      trackEl.style.height = `${barHeight}px`;
      trackEl.style.backgroundColor = trackColor;
      trackEl.style.borderRadius = `${cornerRadius}px`;
      trackEl.style.position = 'relative';
      trackEl.style.overflow = 'visible';

      // Fill bar
      const fillEl = document.createElement('div');
      fillEl.className = 'progress-fill';
      fillEl.style.width = `${pct * 100}%`;
      const conditionalColor = this.getConditionalBarColor(pct * 100);
      if (s.barAppearance.gradientEnabled.value) {
        const gStart = s.barAppearance.gradientStartColor.value?.value ?? '#3B82F6';
        const gEnd = s.barAppearance.gradientEndColor.value?.value ?? '#8B5CF6';
        fillEl.style.background = `linear-gradient(to right, ${gStart}, ${gEnd})`;
      } else {
        fillEl.style.backgroundColor = conditionalColor ?? (barColor === '#3B82F6' ? getHostChartColor(this.host.colorPalette, i, themeName) : barColor);
      }
      fillEl.style.borderRadius = `${barCornerRadius}px`;
      fillEl.style.transition = 'filter 0.2s ease, transform 0.2s ease';

      // Hover: brightness boost + subtle scale-up
      fillEl.addEventListener('mouseenter', () => {
        fillEl.style.filter = 'brightness(1.15)';
        fillEl.style.transform = 'scaleY(1.08)';
      });
      fillEl.addEventListener('mouseleave', () => {
        fillEl.style.filter = 'brightness(1)';
        fillEl.style.transform = 'scaleY(1)';
      });

      // Tooltip
      const host = this.host;
      const tooltipItems: VisualTooltipDataItem[] = [
        { displayName: 'Category', value: row.label },
        { displayName: 'Value', value: formatWithSettings(row.value, this.settings.numberFormattingCard) },
        { displayName: 'Target', value: formatWithSettings(row.target, this.settings.numberFormattingCard) },
        { displayName: '% Complete', value: `${Math.round(rawPct * 100)}%` },
      ];
      if (!row.hasExplicitTarget) {
        tooltipItems.splice(2, 1);
      }
      fillEl.addEventListener('mouseover', (event: MouseEvent) => {
        host.tooltipService.show({
          dataItems: tooltipItems,
          identities: [row.selectionId],
          coordinates: [event.clientX, event.clientY],
          isTouchEvent: false,
        });
      });
      fillEl.addEventListener('mousemove', (event: MouseEvent) => {
        host.tooltipService.move({
          dataItems: [],
          identities: [],
          coordinates: [event.clientX, event.clientY],
          isTouchEvent: false,
        });
      });
      fillEl.addEventListener('mouseout', () => {
        host.tooltipService.hide({ immediately: true, isTouchEvent: false });
      });

      trackEl.appendChild(fillEl);

      // ── Target Marker ─────────────────────────────────────────
      // Renders a vertical target line at the target value's position
      // within the track. Since the track represents 0..target, the
      // marker sits at the right edge (100%) as a goal-line indicator.
      if (s.targetSettings.show.value && row.hasExplicitTarget) {
        const targetColor = s.targetSettings.color.value?.value ?? '#0F172A';
        const targetLineWidth = s.targetSettings.lineWidth.value;

        const marker = document.createElement('div');
        marker.className = 'progress-target-marker';
        marker.style.position = 'absolute';
        marker.style.top = '-3px';
        marker.style.bottom = '-3px';
        marker.style.right = '0';
        marker.style.width = `${targetLineWidth}px`;
        marker.style.backgroundColor = targetColor;
        marker.style.borderRadius = `${targetLineWidth}px`;
        marker.style.pointerEvents = 'none';
        trackEl.appendChild(marker);
      }

      // ── Milestone Markers ──────────────────────────────────────
      const milestoneSettings = s.progressMilestone;
      if (milestoneSettings.show.value) {
        const milestoneStr = milestoneSettings.milestones.value ?? '';
        const milestoneValues = milestoneStr
          .split(',')
          .map((v) => parseFloat(v.trim()))
          .filter((v) => !isNaN(v) && v >= 0 && v <= 100);

        if (milestoneValues.length > 0) {
          for (const mPct of milestoneValues) {
            const milestone = document.createElement('div');
            milestone.className = 'progress-milestone-marker';
            milestone.style.position = 'absolute';
            milestone.style.top = '-2px';
            milestone.style.bottom = '-2px';
            milestone.style.left = `${mPct}%`;
            milestone.style.width = '2px';
            milestone.style.backgroundColor = milestoneSettings.milestoneColor.value?.value ?? '#94A3B8';
            milestone.style.borderRadius = '1px';
            milestone.style.pointerEvents = 'none';
            milestone.style.opacity = '0.7';
            milestone.title = `${mPct}%`;
            trackEl.appendChild(milestone);
          }
        }
      }

      if (renderInsideLabel) {
        const insideLabelEl = document.createElement('div');
        insideLabelEl.className = 'progress-label progress-label-inline';
        insideLabelEl.textContent = row.label;
        insideLabelEl.title = row.label;
        insideLabelEl.style.position = 'absolute';
        insideLabelEl.style.top = '50%';
        insideLabelEl.style.transform = 'translateY(-50%)';
        insideLabelEl.style.pointerEvents = 'none';
        insideLabelEl.style.maxWidth = labelPos === 'inline' ? '55%' : '70%';
        insideLabelEl.style.whiteSpace = 'nowrap';
        insideLabelEl.style.overflow = 'hidden';
        insideLabelEl.style.textOverflow = 'ellipsis';
        insideLabelEl.style.color = labelColor || '#FFFFFF';
        insideLabelEl.style.textShadow = '0 1px 2px rgba(15, 23, 42, 0.35)';
        insideLabelEl.style.fontSize = `${labelFontSize}px`;
        if (labelFontFamily) insideLabelEl.style.fontFamily = labelFontFamily;
        insideLabelEl.style.fontWeight = labelFontWeight || '600';
        if (labelPos === 'insideEnd') {
          insideLabelEl.style.right = '10px';
          insideLabelEl.style.textAlign = 'right';
        } else {
          insideLabelEl.style.left = '10px';
        }
        if (labelPos === 'inline') {
          trackEl.appendChild(insideLabelEl);
        } else {
          fillEl.appendChild(insideLabelEl);
        }
      }

      rowEl.appendChild(trackEl);

      // Value label
      if ((s.barSettings.showValue.value || s.barSettings.showPercent.value) && labelPos !== 'inline') {
        const valueEl = document.createElement('div');
        valueEl.className = 'progress-value';
        if (labelColor) {
          valueEl.style.color = labelColor;
        }
        valueEl.style.fontSize = `${labelFontSize}px`;
        if (labelFontFamily) valueEl.style.fontFamily = labelFontFamily;
        valueEl.style.fontWeight = labelFontWeight || 'normal';

        const parts: string[] = [];

        if (s.barSettings.showValue.value) {
          parts.push(formatWithSettings(row.value, this.settings.numberFormattingCard));
        }
        if (s.barSettings.showPercent.value) {
          parts.push(`${Math.round(rawPct * 100)}%`);
        }

        const displayText = parts.join(' / ');

        if (animEnabled) {
          // countUp animation for the value
          valueEl.textContent = s.barSettings.showValue.value ? formatWithSettings(0, this.settings.numberFormattingCard) : '0%';
          const delay = i * DURATION.stagger;

          const cancelTimeout = this.delayedExec(() => {
            if (s.barSettings.showValue.value) {
              const cancel = countUp(
                0,
                row.value,
                animDuration,
                (v) => {
                  const animParts: string[] = [];
                  if (s.barSettings.showValue.value) {
                    animParts.push(formatWithSettings(v, this.settings.numberFormattingCard));
                  }
                  if (s.barSettings.showPercent.value) {
                    const animPct = row.target > 0 ? Math.round((v / row.target) * 100) : 0;
                    animParts.push(`${animPct}%`);
                  }
                  valueEl.textContent = animParts.join(' / ');
                },
                () => {
                  valueEl.textContent = displayText;
                }
              );
              this.cancelAnimations.push(cancel);
            } else {
              // Only showing percent — count from 0% to target%
              const targetPct = Math.round(rawPct * 100);
              const cancel = countUp(
                0,
                targetPct,
                animDuration,
                (v) => {
                  valueEl.textContent = `${Math.round(v)}%`;
                },
                () => {
                  valueEl.textContent = displayText;
                }
              );
              this.cancelAnimations.push(cancel);
            }
          }, delay);
          this.cancelAnimations.push(cancelTimeout);
        } else {
          valueEl.textContent = displayText;
        }

        rowEl.appendChild(valueEl);
      }

      if ((s.barSettings.showValue.value || s.barSettings.showPercent.value) && labelPos === 'inline') {
        const inlineValueEl = document.createElement('div');
        inlineValueEl.className = 'progress-value progress-value-inline';
        inlineValueEl.style.position = 'absolute';
        inlineValueEl.style.top = '50%';
        inlineValueEl.style.right = '10px';
        inlineValueEl.style.transform = 'translateY(-50%)';
        inlineValueEl.style.pointerEvents = 'none';
        inlineValueEl.style.color = labelColor || '#FFFFFF';
        inlineValueEl.style.textShadow = '0 1px 2px rgba(15, 23, 42, 0.35)';
        inlineValueEl.style.fontSize = `${labelFontSize}px`;
        if (labelFontFamily) inlineValueEl.style.fontFamily = labelFontFamily;
        inlineValueEl.style.fontWeight = labelFontWeight || '600';

        const inlineParts: string[] = [];
        if (s.barSettings.showValue.value) {
          inlineParts.push(formatWithSettings(row.value, this.settings.numberFormattingCard));
        }
        if (s.barSettings.showPercent.value) {
          inlineParts.push(`${Math.round(rawPct * 100)}%`);
        }
        inlineValueEl.textContent = inlineParts.join(' / ');
        trackEl.appendChild(inlineValueEl);
      }

      // Right-positioned label (after value)
      if (showLabelsToggle && labelPos === 'right') {
        const rightLabelEl = document.createElement('div');
        rightLabelEl.className = 'progress-label';
        rightLabelEl.textContent = row.label;
        rightLabelEl.title = row.label;
        rowEl.appendChild(rightLabelEl);
      }

      wrapper.appendChild(rowEl);

      // Animate bar growth
      if (animEnabled) {
        const cancel = growBar(
          fillEl,
          i * DURATION.stagger,
          animDuration,
          'horizontal'
        );
        this.cancelAnimations.push(cancel);
      }
    }

    this.container.appendChild(wrapper);

    // Apply shared data label formatting to value labels
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.progress-value');

    // Apply axis formatting to category labels
    this.applyAxisLabelFormatting();

    // Entrance animation for the whole wrapper
    if (animEnabled) {
      const cancel = fadeSlideIn(wrapper, 'up', DURATION.fast, 0);
      this.cancelAnimations.push(cancel);
    }

    // ── SVG Overlay for Reference Line, Trend Line, and Annotations ──
    const pctValues = rows.map((r) => Math.max(0, Math.min(r.value / r.target, 1)) * 100);
    this.renderSvgOverlay(rows, pctValues, viewport, contentPadding);

    // ── Cross-Highlight Dimming ──────────────────────────────────────
    this.applySelectionHighlight(rows);

    // ── Accessibility ────────────────────────────────────────────────
    this.applyAccessibility(rows);
  }

  // ── Cross-Highlight Dimming ─────────────────────────────────────

  private applySelectionHighlight(rows: ProgressBarRow[]): void {
    const data = this.currentProgressData;
    if (!data) return;
    const selectedKeys = new Set(
      (this.selectionManager.getSelectionIds() as ISelectionId[]).map((id) => id.getKey()),
    );
    const shouldDim = data.hasHighlights || selectedKeys.size > 0;

    const rowEls = this.container.querySelectorAll<HTMLElement>('.progress-row');
    rowEls.forEach((el, i) => {
      const row = rows[i];
      if (!row) return;
      const isSelected = selectedKeys.has(row.selectionId.getKey());
      el.style.opacity = shouldDim && !row.highlighted && !isSelected ? '0.3' : '';
      el.style.boxShadow = isSelected ? '0 0 0 2px rgba(37, 99, 235, 0.4)' : '';
    });
  }

  /**
   * Applies axis label color and font size from the AxisFormattingCard
   * to all `.progress-label` HTML elements in the container.
   */
  private applyAxisLabelFormatting(): void {
    const axis = this.settings.axisFormattingCard;
    const appearance = this.settings.barAppearance;
    const color = appearance.labelColor.value?.value || axis.axisLabelColor.value?.value || '#64748B';
    const size = appearance.labelFontSize.value || axis.axisLabelSize.value;
    const fontFamily = resolveDropdown(appearance.labelFontFamily) || resolveDropdown(axis.axisLabelFontFamily);
    const fontWeight = resolveDropdown(appearance.labelFontWeight) || resolveDropdown(axis.axisLabelFontWeight) || 'normal';

    const labels = this.container.querySelectorAll<HTMLElement>('.progress-label');
    for (const label of labels) {
      label.style.color = color;
      label.style.fontSize = `${size}px`;
      label.style.fontWeight = fontWeight;
      if (fontFamily) {
        label.style.fontFamily = fontFamily;
      }
    }
  }

  /**
   * Resolves conditional color for a bar's completion percentage, or returns
   * undefined if conditional formatting is disabled.
   */
  private getConditionalBarColor(pctValue: number): string | undefined {
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
    return resolveConditionalColor(pctValue, config);
  }

  /**
   * Renders an SVG overlay on top of the container for reference line,
   * trend line, and annotations — features that require d3/SVG rendering.
   */
  private renderSvgOverlay(
    rows: ProgressBarRow[],
    pctValues: number[],
    viewport: powerbi.IViewport,
    contentPadding: number,
  ): void {
    const ref = this.settings.referenceLineFormattingCard;
    const tl = this.settings.trendLineFormattingCard;
    const ann = this.settings.annotationFormattingCard;

    const showRef = ref.showReferenceLine.value;
    const showTrend = tl.showTrendLine.value && pctValues.length >= 2;
    const showAnn = ann.showAnnotations.value;

    if (!showRef && !showTrend && !showAnn) return;

    const width = Math.max(0, viewport.width);
    const height = Math.max(0, viewport.height);
    const tracks = Array.from(this.container.querySelectorAll<HTMLElement>('.progress-track'));
    if (tracks.length === 0) return;
    const containerRect = this.container.getBoundingClientRect();
    const fallbackTrackLeft = contentPadding + 126;
    const fallbackTrackWidth = Math.max(40, width - fallbackTrackLeft - contentPadding - 62);
    const fallbackRowHeight = Math.max(24, this.settings.barSettings.barHeight.value + this.settings.barSettings.gap.value);
    const trackGeometry = tracks.map((track, index) => {
      const rect = track.getBoundingClientRect();
      const hasLayout = rect.width > 0 && rect.height > 0;
      const x = hasLayout ? rect.left - containerRect.left : fallbackTrackLeft;
      const y = hasLayout ? rect.top - containerRect.top : contentPadding + 12 + (index * fallbackRowHeight);
      const trackWidth = hasLayout ? rect.width : fallbackTrackWidth;
      const trackHeight = hasLayout ? rect.height : Math.max(4, this.settings.barSettings.barHeight.value);
      return { x, y, width: trackWidth, height: trackHeight, centerY: y + trackHeight / 2 };
    });
    const clampPct = (value: number): number => Math.max(0, Math.min(100, value));
    const pointFor = (index: number, pct: number): { x: number; y: number } => {
      const geometry = trackGeometry[Math.max(0, Math.min(index, trackGeometry.length - 1))];
      return {
        x: geometry.x + (clampPct(pct) / 100) * geometry.width,
        y: geometry.centerY,
      };
    };

    const svg = d3
      .select(this.container)
      .append('svg')
      .attr('class', 'progress-overlay-svg')
      .attr('width', width)
      .attr('height', height)
      .style('position', 'absolute')
      .style('top', '0')
      .style('left', '0')
      .style('pointer-events', 'none');

    const g = svg.append('g') as d3.Selection<SVGGElement, unknown, null, undefined>;

    // ── Reference Line ───────────────────────────────────────────────
    if (showRef) {
      const refType = resolveDropdown(ref.referenceLineType) ?? 'custom';
      let refValue = ref.referenceLineValue.value;

      if (refType !== 'custom' && pctValues.length > 0) {
        refValue = computeStatValue(pctValues, refType as StatType);
      }

      const refColor = ref.referenceLineColor.value?.value ?? '#EF4444';
      const refStyle = resolveDropdown(ref.referenceLineStyle) ?? 'dashed';
      const labelText = (ref.referenceLabelText.value?.length ?? 0) > 0
        ? ref.referenceLabelText.value
        : `${Math.round(refValue)}%`;
      const dashArray = refStyle === 'dashed' ? '6,4' : refStyle === 'dotted' ? '2,3' : null;
      const bandWidth = Math.max(0, ref.referenceBandWidth.value);
      trackGeometry.forEach((geometry) => {
        const refX = geometry.x + (clampPct(refValue) / 100) * geometry.width;
        if (ref.showReferenceBand.value && bandWidth > 0) {
          const bandStart = clampPct(refValue - (bandWidth / 2));
          const bandEnd = clampPct(refValue + (bandWidth / 2));
          g.append('rect')
            .attr('class', 'progress-reference-band')
            .attr('x', geometry.x + (bandStart / 100) * geometry.width)
            .attr('y', geometry.y)
            .attr('width', ((bandEnd - bandStart) / 100) * geometry.width)
            .attr('height', geometry.height)
            .attr('fill', refColor)
            .attr('opacity', ref.referenceBandOpacity.value / 100);
        }
        const line = g.append('line')
          .attr('class', 'progress-reference-line')
          .attr('x1', refX)
          .attr('x2', refX)
          .attr('y1', geometry.y - 2)
          .attr('y2', geometry.y + geometry.height + 2)
          .attr('stroke', refColor)
          .attr('stroke-width', ref.referenceLineWidth.value);
        if (dashArray) line.attr('stroke-dasharray', dashArray);
      });
      if (ref.showReferenceLabel.value && trackGeometry[0]) {
        const point = pointFor(0, refValue);
        g.append('text')
          .attr('class', 'progress-reference-label')
          .attr('x', point.x + 4)
          .attr('y', Math.max(10, trackGeometry[0].y - 4))
          .attr('fill', refColor)
          .attr('font-size', '10px')
          .text(labelText);
      }
    }

    // ── Trend Line ───────────────────────────────────────────────────
    if (showTrend) {
      const trendType = (resolveDropdown(tl.trendLineType) ?? 'linear') as TrendType;
      const result = computeRegression(pctValues, trendType, tl.polynomialOrder.value);
      const trendColor = tl.trendLineColor.value?.value ?? '#6366F1';

      const trendPath = d3.line<number>()
        .x((predicted, index) => pointFor(index, predicted).x)
        .y((_, index) => pointFor(index, 0).y)
        .curve(d3.curveMonotoneY);
      g.append('path')
        .datum(result.predicted)
        .attr('class', 'progress-trend-line')
        .attr('d', trendPath)
        .attr('fill', 'none')
        .attr('stroke', trendColor)
        .attr('stroke-width', tl.trendLineWidth.value)
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round');
      if ((tl.showEquation.value || tl.showR2.value) && trackGeometry[0]) {
        const details = [
          tl.showEquation.value ? result.equation : '',
          tl.showR2.value ? `R\u00B2 ${result.r2.toFixed(2)}` : '',
        ].filter(Boolean).join('  ');
        g.append('text')
          .attr('class', 'progress-trend-label')
          .attr('x', trackGeometry[0].x)
          .attr('y', Math.max(10, trackGeometry[0].y - 4))
          .attr('fill', trendColor)
          .attr('font-size', '10px')
          .text(details);
      }
    }

    // ── Annotations ──────────────────────────────────────────────────
    if (showAnn) {
      const slots = [
        {
          category: ann.annotation1Category.value,
          text: ann.annotation1Text.value,
          position: resolveDropdown(ann.annotation1Position) ?? 'above',
        },
        {
          category: ann.annotation2Category.value,
          text: ann.annotation2Text.value,
          position: resolveDropdown(ann.annotation2Position) ?? 'above',
        },
        {
          category: ann.annotation3Category.value,
          text: ann.annotation3Text.value,
          position: resolveDropdown(ann.annotation3Position) ?? 'above',
        },
      ];

      const resolvePosition = (category: string): { x: number; y: number } | null => {
        const idx = rows.findIndex((r) => r.label === category);
        if (idx < 0) return null;
        const pct = Math.min(rows[idx].value / rows[idx].target, 1) * 100;
        return pointFor(idx, pct);
      };

      const config = buildAnnotationConfig(
        true,
        slots,
        ann.annotationFontSize.value,
        ann.annotationFontColor.value?.value ?? '#475569',
        ann.annotationConnectorColor.value?.value ?? '#94A3B8',
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

      if (config) {
        renderAnnotations(g, config);
      }
    }
  }

  /**
   * Applies ARIA labels, keyboard navigation, and focus ring styles
   * for screen reader and keyboard accessibility.
   */
  private applyAccessibility(rows: ProgressBarRow[]): void {
    const acc = this.settings.accessibilityFormattingCard;
    if (!acc.enableKeyboardNav.value) return;

    // Clean up previous keyboard nav listener
    if (this.keyboardNavCleanup) {
      this.keyboardNavCleanup();
      this.keyboardNavCleanup = null;
    }

    ensureFocusRingStyles();

    applyChartAria(this.container, {
      chartType: 'progress bar chart',
      title: this.settings.titleFormattingCard.titleText.value || undefined,
      dataPointCount: rows.length,
    });

    // Make each progress row focusable for keyboard navigation
    const rowEls = this.container.querySelectorAll<HTMLElement>('.progress-row');
    rowEls.forEach((el, i) => {
      el.setAttribute('role', 'listitem');
      const row = rows[i];
      if (row) {
        const pct = Math.round((row.target > 0 ? row.value / row.target : 0) * 100);
        const valueText = formatWithSettings(row.value, this.settings.numberFormattingCard);
        const progressText = row.hasExplicitTarget
          ? `${valueText} of ${formatWithSettings(row.target, this.settings.numberFormattingCard)}, ${pct}%`
          : `${valueText}, ${pct}% of the displayed scale`;
        el.setAttribute(
          'aria-label',
          `${row.label}: ${progressText}. Item ${i + 1} of ${rows.length}.`,
        );
      }
      el.setAttribute('tabindex', '0');
    });

    this.keyboardNavCleanup = attachKeyboardNav({
      container: this.container,
      itemSelector: '.progress-row',
      onActivate: (el) => {
        (el as HTMLElement).click?.();
      },
    });
  }

  /**
   * Executes a callback after a delay. Returns a cancel function.
   */
  private delayedExec(fn: () => void, delay: number): () => void {
    const timeoutId = setTimeout(fn, delay);
    return () => clearTimeout(timeoutId);
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private handleBackgroundClick = (): void => {
    if (!allowInteractions(this.host)) return;
    void this.selectionManager.clear().then(() => {
      this.applySelectionHighlight(this.currentProgressData?.rows ?? []);
    });
  };

  public destroy(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    if (this.keyboardNavCleanup) {
      this.keyboardNavCleanup();
      this.keyboardNavCleanup = null;
    }
  }
}
