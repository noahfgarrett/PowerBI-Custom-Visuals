/**
 * Status Indicator — Power BI IVisual implementation.
 * Threshold-based colored lights (circle/square/diamond) with pulse animation
 * for critical status. Supports vertical, horizontal, and grid layouts.
 */

import powerbi from 'powerbi-visuals-api';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { StatusIndicatorSettings } from './settings';
import {
  pulseGlow,
  fadeSlideIn,
  formatWithSettings,
  applyCardStyle,
  allowInteractions,
  type CardStyleMode,
  DURATION,
  renderChartTitle,
  applyChartAria,
  applyDataPointAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
  resolveConditionalColor,
  buildConditionalConfig,
  resolveDropdown,
  applySortOrder,
  renderLegend,
  type LegendItem,
  getDateFilterIndices,
  isDateColumn,
  type DateFilterConfig,
  resolveColorTheme,
  getHostChartColor,
  syncLegendFormattingVisibility,
  syncTitleFormattingVisibility,
  syncCardStyleVisibility,
  syncDateFilterFormattingVisibility,
  hideInlineLegendFormatting,
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

// ── Data types ──────────────────────────────────────────────────────

type StatusLevel = 'good' | 'warning' | 'critical' | 'level4' | 'level5' | 'unknown';

interface StatusRow {
  label: string;
  value: number | null;
  warningThreshold: number | null;
  criticalThreshold: number | null;
  status: StatusLevel;
  selectionId: ISelectionId;
  highlighted: boolean;
}

// ── Visual class ────────────────────────────────────────────────────

export class StatusIndicatorVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: StatusIndicatorSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];
  private currentHasHighlights = false;
  private currentRows: StatusRow[] = [];
  private emptyStateMode: 'unconfigured' | 'noData' = 'unconfigured';

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new StatusIndicatorSettings();
    this.formattingSettingsService = new FormattingSettingsService(options.host.createLocalizationManager());
    this.container.classList.add('status-container');
    attachEmptySpaceContextMenu(this.container, this.selectionManager, () =>
      this.host.createSelectionIdBuilder().createSelectionId(),
      () => allowInteractions(this.host),
    );
  }

  public update(options: VisualUpdateOptions): void {
    notifyRenderingStarted(this.host, options);
    try {
      // Cancel running animations
      this.cancelAnimations.forEach((cancel) => cancel());
      this.cancelAnimations = [];

      // Parse settings
      const dataView = options.dataViews?.[0];
      const hasCategoryRole = dataView?.metadata?.columns?.some((column) => column.roles?.['category']) ?? false;
      const hasMeasureRole = dataView?.metadata?.columns?.some((column) => column.roles?.['measure']) ?? false;
      this.emptyStateMode = hasCategoryRole && hasMeasureRole
        ? getVisualEmptyStateMode(dataView)
        : 'unconfigured';
      if (dataView) {
        this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
          StatusIndicatorSettings,
          dataView
        );
      }
      syncTitleFormattingVisibility(this.settings.titleFormattingCard);
      syncLegendFormattingVisibility(this.settings.legendFormattingCard);
      hideInlineLegendFormatting(this.settings.legendFormattingCard);

      // Migrate legacy enableGlass -> cardStyleMode (backward compat)
      const legacyCardObj = dataView?.metadata?.objects?.['cardSettings'];
      const legacyGlass = legacyCardObj?.['enableGlass'];
      if (legacyCardObj?.['cardStyleMode'] === undefined && legacyGlass === false) {
        this.settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
      }

      // ── Conditional Visibility ──────────────────────────────────
      const useCustom = this.settings.thresholdSettings.useCustomThresholds.value;

      const categoryColumn = dataView?.categorical?.categories?.[0];
      const hasDateAxis = Boolean(categoryColumn && isDateColumn(categoryColumn.source));
      this.settings.dateFilterFormattingCard.visible = hasDateAxis;
      syncDateFilterFormattingVisibility(this.settings.dateFilterFormattingCard);
      if (!hasDateAxis) {
        this.settings.dateFilterFormattingCard.startDate.visible = false;
        this.settings.dateFilterFormattingCard.endAtCurrentDate.visible = false;
        this.settings.dateFilterFormattingCard.endDate.visible = false;
      }
      this.settings.thresholdSettings.threshold1.visible = useCustom;
      this.settings.thresholdSettings.threshold2.visible = useCustom;

      const showVal = this.settings.valueDisplaySettings.showValue.value;
      this.settings.valueDisplaySettings.valueFontSize.visible = showVal;
      this.settings.valueDisplaySettings.valueFontFamily.visible = showVal;
      this.settings.valueDisplaySettings.valueFontWeight.visible = showVal;

      const showSt = this.settings.valueDisplaySettings.showStatusText.value;
      this.settings.valueDisplaySettings.statusFontSize.visible = showSt;
      this.settings.valueDisplaySettings.statusFontColor.visible = showSt;
      this.settings.valueDisplaySettings.statusFontFamily.visible = showSt;
      this.settings.valueDisplaySettings.statusFontWeight.visible = showSt;

      const levelCountRaw = this.settings.thresholdSettings.levelCount.value?.value ?? '3';
      const levelCountNum = parseInt(String(levelCountRaw), 10) || 3;
      this.settings.thresholdSettings.levelCount.visible = useCustom;
      this.settings.thresholdSettings.threshold3.visible = useCustom && levelCountNum > 3;
      this.settings.thresholdSettings.threshold4.visible = useCustom && levelCountNum > 4;
      this.settings.thresholdSettings.level4Color.visible = useCustom && levelCountNum > 3;
      this.settings.thresholdSettings.level5Color.visible = useCustom && levelCountNum > 4;
      this.settings.animationSettings.duration.visible = this.settings.animationSettings.enabled.value;
      this.settings.animationSettings.enablePulse.visible = this.settings.animationSettings.enabled.value;

      syncCardStyleVisibility(this.settings.cardSettings);

      // Extract data
      const rows = this.extractData(dataView);
      this.currentRows = rows;

      // Track cross-highlight state
      this.currentHasHighlights = rows.some((r) => r.highlighted);

      const highContrast = getHostHighContrastColors(this.host);
      this.render(rows, highContrast);
      applyBasicHighContrastStyles(this.container, highContrast, {
        textSelectors: ['.status-label', '.status-value', '.status-text', '.status-empty', '.pbi-landing-page-title', '.pbi-landing-page-description', '.pbi-landing-page-hint', '.pbi-landing-page li'],
        fillSelectors: ['.status-shape', '.status-sparkline svg rect', '.pbi-landing-page'],
        strokeSelectors: ['.status-row'],
      });
      if (highContrast.enabled) {
        this.container.querySelectorAll<HTMLElement>('.status-shape').forEach((shape) => {
          shape.style.border = `2px solid ${highContrast.foregroundSelected}`;
          shape.style.boxSizing = 'border-box';
          shape.querySelectorAll<SVGElement>('path, polygon').forEach((iconPart) => {
            iconPart.setAttribute('fill', highContrast.foregroundSelected);
          });
        });
      }
      notifyRenderingFinished(this.host, options);
    } catch (error) {
      notifyRenderingFailed(this.host, options, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private extractData(dataView: DataView | undefined): StatusRow[] {
    const rows: StatusRow[] = [];
    if (!dataView?.categorical) return rows;

    const categorical = dataView.categorical;
    const categories = categorical.categories?.[0];
    const values = categorical.values;
    if (!categories || !values) return rows;

    const direction = this.settings.thresholdSettings.direction.value?.value ?? 'higherIsBetter';
    const useCustom = this.settings.thresholdSettings.useCustomThresholds.value;
    const customThreshold1 = this.settings.thresholdSettings.threshold1.value;
    const customThreshold2 = this.settings.thresholdSettings.threshold2.value;
    const count = categories.values.length;

    // Find columns by role
    let measureCol: powerbi.DataViewValueColumn | undefined;
    let warnCol: powerbi.DataViewValueColumn | undefined;
    let critCol: powerbi.DataViewValueColumn | undefined;

    for (const col of values) {
      const role = col.source.roles;
      if (!role) continue;
      if (role['measure']) measureCol = col;
      if (role['warningThreshold']) warnCol = col;
      if (role['criticalThreshold']) critCol = col;
    }
    if (!measureCol) return rows;

    // Read cross-highlight data from the measure column
    const measureHighlights = measureCol ? (measureCol.highlights as unknown[] | undefined) : undefined;

    const dateConfig: DateFilterConfig = {
      enabled: this.settings.dateFilterFormattingCard.enableDateFilter.value,
      startDate: this.settings.dateFilterFormattingCard.startDate.value,
      endAtCurrentDate: this.settings.dateFilterFormattingCard.endAtCurrentDate.value,
      endDate: this.settings.dateFilterFormattingCard.endDate.value,
    };
    const dateIndices = isDateColumn(categories.source) ? getDateFilterIndices(categories.values, dateConfig) : null;

    for (let i = 0; i < count; i++) {
      if (dateIndices && !dateIndices.has(i)) continue;

      const label = String(categories.values[i] ?? '');
      const value = typeof measureCol?.values[i] === 'number' ? measureCol.values[i] as number : null;

      let warnThresh: number | null;
      let critThresh: number | null;

      if (useCustom) {
        // Custom thresholds: threshold1 is the warning breakpoint, threshold2 is the critical breakpoint
        warnThresh = customThreshold1;
        critThresh = customThreshold2;
      } else {
        warnThresh = typeof warnCol?.values[i] === 'number' ? warnCol.values[i] as number : null;
        critThresh = typeof critCol?.values[i] === 'number' ? critCol.values[i] as number : null;
      }

      const selectionId = this.host.createSelectionIdBuilder()
        .withCategory(categories, i)
        .createSelectionId();

      const status = useCustom
        ? this.computeCustomStatus(
          value,
          customThreshold1,
          customThreshold2,
          this.settings.thresholdSettings.threshold3.value,
          this.settings.thresholdSettings.threshold4.value,
          String(direction),
        )
        : this.computeStatus(value, warnThresh, critThresh, String(direction));

      // A row is highlighted if its highlight value is non-null
      const hlVal = measureHighlights ? measureHighlights[i] : undefined;
      const isHighlighted = hlVal != null;

      rows.push({
        label,
        value,
        warningThreshold: warnThresh,
        criticalThreshold: critThresh,
        status,
        selectionId,
        highlighted: isHighlighted,
      });
    }

    return applySortOrder(
      rows.map((row) => ({
        row,
        name: row.label,
        value: row.value ?? Number.NEGATIVE_INFINITY,
      })),
      this.settings.sortFormattingCard,
    ).map(({ row }) => row);
  }

  private computeStatus(
    value: number | null,
    warnThresh: number | null,
    critThresh: number | null,
    direction: string
  ): StatusLevel {
    if (value === null) return 'unknown';
    if (warnThresh === null && critThresh === null) return 'good';

    if (direction === 'higherIsBetter') {
      // Higher is better: above warning = good, above critical but below warning = warning, below critical = critical
      if (warnThresh !== null && value >= warnThresh) return 'good';
      if (critThresh !== null && value < critThresh) return 'critical';
      return 'warning';
    } else {
      // Lower is better: below warning = good, below critical but above warning = warning, above critical = critical
      if (warnThresh !== null && value <= warnThresh) return 'good';
      if (critThresh !== null && value > critThresh) return 'critical';
      return 'warning';
    }
  }

  /**
   * Compute status using user-configured custom threshold breakpoints.
   * Supports 3, 4, or 5 levels based on levelCount setting.
   * ascending (higherIsBetter): value < t1 = critical, t1 <= value < t2 = warning, value >= t2 = good
   * descending (lowerIsBetter): value < t1 = good, t1 <= value < t2 = warning, value >= t2 = critical
   */
  private computeCustomStatus(
    value: number | null,
    threshold1: number,
    threshold2: number,
    threshold3: number,
    threshold4: number,
    direction: string
  ): StatusLevel {
    if (value === null) return 'unknown';

    const levelCountRaw = this.settings.thresholdSettings.levelCount.value?.value ?? '3';
    const levelCount = parseInt(String(levelCountRaw), 10) || 3;
    const thresholds = [threshold1, threshold2, threshold3, threshold4]
      .slice(0, Math.max(2, levelCount - 1))
      .sort((a, b) => a - b);
    const [t1, t2, t3, t4] = thresholds;

    if (levelCount >= 5 && direction === 'higherIsBetter') {
      if (value >= t4) return 'level5';
      if (value >= t3) return 'level4';
      if (value >= t2) return 'good';
      if (value >= t1) return 'warning';
      return 'critical';
    }

    if (levelCount >= 4 && direction === 'higherIsBetter') {
      if (value >= t3) return 'level4';
      if (value >= t2) return 'good';
      if (value >= t1) return 'warning';
      return 'critical';
    }

    if (levelCount >= 5 && direction === 'lowerIsBetter') {
      if (value >= t4) return 'level5';
      if (value >= t3) return 'level4';
      if (value >= t2) return 'critical';
      if (value >= t1) return 'warning';
      return 'good';
    }

    if (levelCount >= 4 && direction === 'lowerIsBetter') {
      if (value >= t3) return 'level4';
      if (value >= t2) return 'critical';
      if (value >= t1) return 'warning';
      return 'good';
    }

    if (direction === 'higherIsBetter') {
      if (value >= t2) return 'good';
      if (value >= t1) return 'warning';
      return 'critical';
    } else {
      if (value < t1) return 'good';
      if (value < t2) return 'warning';
      return 'critical';
    }
  }

  private render(rows: StatusRow[], highContrast: ReturnType<typeof getHostHighContrastColors>): void {
    // Clear container
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.container.removeEventListener('click', this.handleBackgroundClick);
    if (allowInteractions(this.host)) {
      this.container.addEventListener('click', this.handleBackgroundClick);
    }

    const s = this.settings;
    const size = Math.max(6, s.indicatorSettings.size.value);
    const layout = s.layoutSettings.layout.value?.value ?? 'vertical';
    const iconSize = Math.max(6, s.indicatorSettings.iconSize.value);
    const labelColor = s.indicatorSettings.labelColor.value?.value ?? '';
    const labelFontFamily = resolveDropdown(s.indicatorSettings.labelFontFamily);
    const labelFontWeight = resolveDropdown(s.indicatorSettings.labelFontWeight) ?? 'normal';
    const itemGap = Math.max(0, s.layoutSettings.itemGap.value);
    const itemPadding = Math.max(0, s.layoutSettings.itemPadding.value);
    const themeName = resolveColorTheme(s.colorThemeFormattingCard);
    const goodColor = themeName !== 'default'
      ? getHostChartColor(this.host.colorPalette, 0, themeName)
      : (s.thresholdSettings.goodColor.value?.value ?? '#34D399');
    const warningColor = themeName !== 'default'
      ? getHostChartColor(this.host.colorPalette, 1, themeName)
      : (s.thresholdSettings.warningColor.value?.value ?? '#FBBF24');
    const criticalColor = themeName !== 'default'
      ? getHostChartColor(this.host.colorPalette, 2, themeName)
      : (s.thresholdSettings.criticalColor.value?.value ?? '#EF4444');
    const enablePulse = s.animationSettings.enabled.value && s.animationSettings.enablePulse.value;
    const showValue = s.valueDisplaySettings.showValue.value;
    const valueFontSize = Math.max(6, s.valueDisplaySettings.valueFontSize.value);
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;

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

    // Empty state
    if (rows.length === 0) {
      if (this.emptyStateMode === 'noData') {
        renderNoDataState(
          this.container,
          getLocalizedString(this.host, 'StatusIndicator_NoDataState', 'No data for the current selection.'),
          highContrast,
        );
        return;
      }
      renderLandingPage(this.container, {
        title: getLocalizedString(this.host, 'StatusIndicator_LandingTitle', 'Add data to build status cards'),
        description: getLocalizedString(this.host, 'StatusIndicator_LandingDescription', 'Bind a category and a measure to render each status indicator.'),
        steps: [getLocalizedString(this.host, 'StatusIndicator_LandingStepCategory', 'Category'), getLocalizedString(this.host, 'StatusIndicator_LandingStepMeasure', 'Measure'), getLocalizedString(this.host, 'StatusIndicator_LandingStepOptional', 'Optional thresholds or status text')],
      }, highContrast);
      return;
    }

    // Layout wrapper
    const layoutEl = document.createElement('div');
    if (layout === 'horizontal') {
      layoutEl.className = 'status-layout-horizontal';
    } else if (layout === 'grid') {
      layoutEl.className = 'status-layout-grid';
    } else {
      layoutEl.className = 'status-layout-vertical';
    }

    // Status level settings
    const levelCountRaw = s.thresholdSettings.levelCount.value?.value ?? '3';
    const levelCount = parseInt(String(levelCountRaw), 10) || 3;
    const useCustomThresholds = s.thresholdSettings.useCustomThresholds.value;
    const level4Color = s.thresholdSettings.level4Color.value?.value ?? '#60A5FA';
    const level5Color = s.thresholdSettings.level5Color.value?.value ?? '#A78BFA';

    const colorMap: Record<StatusLevel, string> = {
      good: goodColor,
      warning: warningColor,
      critical: criticalColor,
      level4: level4Color,
      level5: level5Color,
      unknown: highContrast.enabled ? highContrast.foreground : '#94A3B8',
    };

    // Status display settings
    const showSparkline = s.valueDisplaySettings.showSparkline.value;
    const showStatusText = s.valueDisplaySettings.showStatusText.value;
    const iconSet = resolveDropdown(s.indicatorSettings.iconSet) ?? 'circle';

    // Compute max absolute value across all rows for sparkline scaling
    const maxAbsValue = rows.reduce((max, r) => {
      return r.value !== null ? Math.max(max, Math.abs(r.value)) : max;
    }, 0);

    // ── Conditional Formatting Config ───────────────────────────
    const cc = s.conditionalFormattingCard;
    const conditionalConfig = buildConditionalConfig(
      cc.enableConditional.value,
      resolveDropdown(cc.conditionalDirection),
      cc.threshold1.value,
      cc.threshold2.value,
      cc.conditionalColor1.value?.value,
      cc.conditionalColor2.value?.value,
      cc.conditionalColor3.value?.value,
    );

    rows.forEach((row, idx) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'status-row';
      rowEl.style.cursor = allowInteractions(this.host) ? 'pointer' : 'default';
      rowEl.style.gap = `${itemGap}px`;
      rowEl.style.padding = `${Math.max(2, Math.round(itemPadding / 2))}px ${itemPadding}px`;
      rowEl.setAttribute('data-row-index', String(idx));
      rowEl.addEventListener('mouseenter', (event) => this.showStatusTooltip(row, event));
      rowEl.addEventListener('mousemove', (event) => this.moveTooltip(event));
      rowEl.addEventListener('mouseleave', () => this.hideTooltip());
      if (allowInteractions(this.host)) {
        rowEl.addEventListener('click', (event) => {
          event.stopPropagation();
          void this.selectionManager.select(row.selectionId, event.ctrlKey || event.metaKey).then(() => {
            this.applyCrossHighlight(this.currentRows);
          });
        });
        rowEl.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          event.stopPropagation();
          void this.selectionManager.showContextMenu(row.selectionId, {
            x: event.clientX,
            y: event.clientY,
          });
        });
      }

      // Shape indicator
      const statusColor = colorMap[row.status];
      const color = (row.value !== null ? resolveConditionalColor(row.value, conditionalConfig) : undefined) ?? statusColor;

      // Use SVG icon set if a non-CSS shape is selected (triangle, star, heart, flag, check)
      const iconSvg = this.getIconSvg(iconSet, color, iconSize);
      let shapeEl: HTMLElement;
      if (iconSvg) {
        shapeEl = document.createElement('div');
        shapeEl.className = 'status-shape';
        shapeEl.style.width = `${iconSize}px`;
        shapeEl.style.height = `${iconSize}px`;
        shapeEl.style.flexShrink = '0';
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(iconSvg, 'image/svg+xml');
        const svgEl = svgDoc.documentElement;
        shapeEl.appendChild(shapeEl.ownerDocument.importNode(svgEl, true));
      } else {
        shapeEl = document.createElement('div');
        shapeEl.className = 'status-shape';
        shapeEl.style.width = `${iconSize}px`;
        shapeEl.style.height = `${iconSize}px`;
        shapeEl.style.backgroundColor = color;
        shapeEl.style.flexShrink = '0';

        if (iconSet === 'circle') {
          shapeEl.style.borderRadius = '50%';
        } else if (iconSet === 'square') {
          shapeEl.style.borderRadius = '2px';
        } else if (iconSet === 'diamond') {
          shapeEl.style.width = `${iconSize * 0.75}px`;
          shapeEl.style.height = `${iconSize * 0.75}px`;
          shapeEl.style.transform = 'rotate(45deg)';
          shapeEl.style.margin = `${iconSize * 0.125}px`;
        }
      }

      // Pulse animation for critical items
      if (enablePulse && row.status === 'critical') {
        const cancel = pulseGlow(
          shapeEl,
          highContrast.enabled ? highContrast.foregroundSelected : criticalColor,
        );
        this.cancelAnimations.push(cancel);
      }

      rowEl.appendChild(shapeEl);

      // Label
      const labelEl = document.createElement('div');
      labelEl.className = 'status-label';
      labelEl.style.fontSize = `${size}px`;
      if (labelColor) {
        labelEl.style.color = labelColor;
      }
      labelEl.style.fontWeight = labelFontWeight;
      if (labelFontFamily) {
        labelEl.style.fontFamily = labelFontFamily;
      }
      labelEl.textContent = row.label;
      rowEl.appendChild(labelEl);

      // Value (only rendered when showValue is enabled)
      if (showValue) {
        const valueEl = document.createElement('div');
        valueEl.className = 'status-value';
        valueEl.style.fontSize = `${valueFontSize}px`;
        const valueFontFamily = resolveDropdown(s.valueDisplaySettings.valueFontFamily);
        if (valueFontFamily) valueEl.style.fontFamily = valueFontFamily;
        const valueFontWeight = resolveDropdown(s.valueDisplaySettings.valueFontWeight);
        if (valueFontWeight) valueEl.style.fontWeight = valueFontWeight;
        valueEl.textContent = formatWithSettings(row.value, this.settings.numberFormattingCard);
        rowEl.appendChild(valueEl);
      }

      // Status Text label (e.g., "On Track", "At Risk", "Critical")
      if (showStatusText) {
        const statusTextEl = document.createElement('div');
        statusTextEl.className = 'status-text';
        const stFontSize = s.valueDisplaySettings.statusFontSize.value;
        statusTextEl.style.fontSize = `${Math.max(8, stFontSize)}px`;
        const stFontColor = s.valueDisplaySettings.statusFontColor.value?.value;
        statusTextEl.style.color = (stFontColor && stFontColor.length > 0) ? stFontColor : color;
        const stFontWeight = resolveDropdown(s.valueDisplaySettings.statusFontWeight) || '500';
        statusTextEl.style.fontWeight = stFontWeight;
        const stFontFamily = resolveDropdown(s.valueDisplaySettings.statusFontFamily);
        if (stFontFamily) statusTextEl.style.fontFamily = stFontFamily;
        statusTextEl.style.marginLeft = `${Math.max(2, Math.round(itemGap / 2))}px`;
        statusTextEl.textContent = this.getStatusText(row.status);
        rowEl.appendChild(statusTextEl);
      }

      // Mini sparkline
      if (showSparkline && row.value !== null) {
        const sparklineEl = this.createMiniSparkline(row.value, color, maxAbsValue);
        rowEl.appendChild(sparklineEl);
      }

      layoutEl.appendChild(rowEl);

      // Entrance animation — staggered fadeSlideIn
      // Skip animation when cross-highlighting is active to avoid overwriting dimmed opacity
      if (animEnabled && !this.currentHasHighlights) {
        const delay = idx * 60;
        const cancel = fadeSlideIn(rowEl, 'up', animDuration, delay);
        this.cancelAnimations.push(cancel);
      }
    });

    this.container.appendChild(layoutEl);

    // Legend — threshold colors
    const legendCard = this.settings.legendFormattingCard;
    if (legendCard.showLegend.value) {
      const legendPos = resolveDropdown(legendCard.legendPosition) ?? 'bottom';
      const rawFontColor = legendCard.legendFontColor.value?.value;
      const legendItems: LegendItem[] = [
        { label: 'Good', color: goodColor },
        { label: 'Warning', color: warningColor },
        { label: 'Critical', color: criticalColor },
      ];
      if (useCustomThresholds && levelCount > 3) {
        legendItems.push({ label: 'Level 4', color: level4Color });
      }
      if (useCustomThresholds && levelCount > 4) {
        legendItems.push({ label: 'Level 5', color: level5Color });
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

    this.applyAccessibility();

    // Apply cross-highlight dimming
    this.applyCrossHighlight(rows);
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private showStatusTooltip(row: StatusRow, event: MouseEvent): void {
    const tooltipData: VisualTooltipDataItem[] = [
      { displayName: 'Label', value: row.label },
      { displayName: 'Value', value: formatWithSettings(row.value, this.settings.numberFormattingCard) },
      { displayName: 'Status', value: this.getStatusText(row.status) },
    ];
    if (row.warningThreshold !== null) {
      tooltipData.push({
        displayName: 'Warning Threshold',
        value: formatWithSettings(row.warningThreshold, this.settings.numberFormattingCard),
      });
    }
    if (row.criticalThreshold !== null) {
      tooltipData.push({
        displayName: 'Critical Threshold',
        value: formatWithSettings(row.criticalThreshold, this.settings.numberFormattingCard),
      });
    }

    this.host.tooltipService.show({
      dataItems: tooltipData,
      identities: [row.selectionId],
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

  private handleBackgroundClick = (): void => {
    if (!allowInteractions(this.host)) return;
    void this.selectionManager.clear().then(() => {
      this.applyCrossHighlight(this.currentRows);
    });
  };

  // ── Cross-Highlight ───────────────────────────────────────────

  private applyCrossHighlight(rows: StatusRow[]): void {
    const selectedKeys = new Set(
      (this.selectionManager.getSelectionIds() as ISelectionId[]).map((id) => id.getKey()),
    );
    const shouldDim = this.currentHasHighlights || selectedKeys.size > 0;

    const rowElements = this.container.querySelectorAll<HTMLElement>('.status-row');
    for (const el of Array.from(rowElements)) {
      const idxStr = el.getAttribute('data-row-index');
      if (idxStr === null) continue;
      const idx = parseInt(idxStr, 10);
      const row = rows[idx];
      if (!row) continue;
      if (!shouldDim) {
        el.style.opacity = '';
        el.style.boxShadow = '';
        continue;
      }
      const isSelected = selectedKeys.has(row.selectionId.getKey());
      el.style.opacity = (row.highlighted || isSelected) ? '' : '0.3';
      el.style.boxShadow = isSelected
        ? '0 0 0 2px rgba(59, 130, 246, 0.35)'
        : row.highlighted
          ? '0 0 0 1px rgba(59, 130, 246, 0.18)'
          : '';
    }
  }

  // -- Status Text Rendering ---------------------------------------------------

  private getStatusText(status: StatusLevel): string {
    switch (status) {
      case 'good': return 'On Track';
      case 'warning': return 'At Risk';
      case 'critical': return 'Critical';
      case 'level4': return 'Level 4';
      case 'level5': return 'Level 5';
      case 'unknown': return 'No Data';
      default: return '';
    }
  }

  /**
   * Creates a mini sparkline SVG element showing a simple value indicator.
   * Uses the value to render a small bar relative to the max absolute value in the dataset.
   */
  private createMiniSparkline(value: number, color: string, maxAbsValue: number): HTMLElement {
    const width = 48;
    const height = 16;
    const NS = 'http://www.w3.org/2000/svg';

    const wrapper = document.createElement('div');
    wrapper.className = 'status-sparkline';
    wrapper.style.marginLeft = '6px';
    wrapper.style.flexShrink = '0';

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    // Background bar
    const bgRect = document.createElementNS(NS, 'rect');
    bgRect.setAttribute('x', '0');
    bgRect.setAttribute('y', '4');
    bgRect.setAttribute('width', String(width));
    bgRect.setAttribute('height', '8');
    bgRect.setAttribute('rx', '2');
    bgRect.setAttribute('fill', '#E2E8F0');
    svg.appendChild(bgRect);

    // Value bar (scaled to width relative to the max absolute value in the dataset)
    const scale = maxAbsValue > 0 ? maxAbsValue : 1;
    const barWidth = Math.max(2, Math.min(width, (Math.abs(value) / scale) * width));
    const valueRect = document.createElementNS(NS, 'rect');
    valueRect.setAttribute('x', '0');
    valueRect.setAttribute('y', '4');
    valueRect.setAttribute('width', String(barWidth));
    valueRect.setAttribute('height', '8');
    valueRect.setAttribute('rx', '2');
    valueRect.setAttribute('fill', color);
    valueRect.setAttribute('opacity', '0.8');
    svg.appendChild(valueRect);

    wrapper.appendChild(svg);
    return wrapper;
  }

  // -- Icon Set Rendering -----------------------------------------------------

  /**
   * Returns an SVG icon string for the selected icon set shape.
   */
  private getIconSvg(iconSet: string, color: string, size: number): string {
    const s = size;
    const half = s / 2;
    switch (iconSet) {
      case 'triangle':
        return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><polygon points="${half},2 ${s - 2},${s - 2} 2,${s - 2}" fill="${color}"/></svg>`;
      case 'star':
        return `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="${color}"/></svg>`;
      case 'heart':
        return `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="${color}"/></svg>`;
      case 'flag':
        return `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6z" fill="${color}"/></svg>`;
      case 'check':
        return `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="${color}"/></svg>`;
      default:
        return '';
    }
  }

  // -- Accessibility ----------------------------------------------------------

  private applyAccessibility(): void {
    const a11y = this.settings.accessibilityFormattingCard;
    const rows = this.container.querySelectorAll('.status-row');
    if (a11y.enableKeyboardNav.value) {
      ensureFocusRingStyles();

      applyChartAria(this.container, {
        chartType: 'status indicator',
        title: this.settings.titleFormattingCard.titleText.value || undefined,
        dataPointCount: rows.length,
      });

      rows.forEach((rowEl, i) => {
        const label = rowEl.querySelector('.status-label')?.textContent ?? '';
        const row = this.currentRows[i];
        const value = row
          ? `${row.value === null
            ? 'No data'
            : formatWithSettings(row.value, this.settings.numberFormattingCard)}, ${this.getStatusText(row.status)}`
          : (rowEl.querySelector('.status-value')?.textContent ?? '');
        applyDataPointAria(rowEl, label, value, i, rows.length);
        rowEl.setAttribute('tabindex', '0');
        rowEl.setAttribute('aria-keyshortcuts', 'Enter Space ArrowLeft ArrowRight ArrowUp ArrowDown Home End');
        rowEl.setAttribute('aria-disabled', allowInteractions(this.host) ? 'false' : 'true');
      });

      const cleanup = attachKeyboardNav({
        container: this.container,
        itemSelector: '.status-row',
        onActivate: (el: Element) => {
          if (allowInteractions(this.host)) {
            (el as HTMLElement).click();
          }
        },
      });
      this.cancelAnimations.push(cleanup);
    } else {
      applyChartAria(this.container, {
        chartType: 'status indicator',
        dataPointCount: rows.length,
      });
    }
  }

  public destroy(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.hideTooltip();
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
  }
}
