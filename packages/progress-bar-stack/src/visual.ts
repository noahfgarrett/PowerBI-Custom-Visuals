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
  renderHorizontalReferenceLine,
  computeStatValue,
  type StatType,
  renderTrendLine,
  computeRegression,
  type TrendType,
  renderAnnotations,
  buildAnnotationConfig,
  resolveDropdown,
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

interface ProgressBarRow {
  label: string;
  value: number;
  target: number;
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

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new ProgressBarStackSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('progress-bar-container');
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel any running animations
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Parse settings
    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        ProgressBarStackSettings,
        dataView
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

    // Hide inapplicable shared axis properties — progress-bar-stack only uses axisLabelColor and axisLabelSize

    // Date filter: hide start/end when disabled
    this.settings.dateFilterFormattingCard.startDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value;
    this.settings.dateFilterFormattingCard.endAtCurrentDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value;
    this.settings.dateFilterFormattingCard.endDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value && !this.settings.dateFilterFormattingCard.endAtCurrentDate.value;
    this.settings.axisFormattingCard.showXAxis.visible = false;
    this.settings.axisFormattingCard.showYAxis.visible = false;
    this.settings.axisFormattingCard.xAxisTitle.visible = false;
    this.settings.axisFormattingCard.yAxisTitle.visible = false;
    this.settings.axisFormattingCard.axisLabelFontFamily.visible = false;
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
    this.settings.axisFormattingCard.axisLabelFontWeight.visible = false;
    this.settings.dataLabelFormattingCard.showDataLabels.visible = false;

    // Hide dual-axis-only properties (no combo/dual-axis support)
    this.settings.referenceLineFormattingCard.referenceLineAxis.visible = false;
    this.settings.referenceLineFormattingCard.referenceBandWidth.visible = false;
    this.settings.trendLineFormattingCard.trendLineAxis.visible = false;

    // Hide data label position — position is determined by bar geometry
    this.settings.dataLabelFormattingCard.dataLabelPosition.visible = false;

    // Conditional visibility: hide gradient colors when gradient is disabled
    this.settings.barAppearance.gradientStartColor.visible = this.settings.barAppearance.gradientEnabled.value;
    this.settings.barAppearance.gradientEndColor.visible = this.settings.barAppearance.gradientEnabled.value;

    // Conditional visibility: hide milestone CSV and color when milestones are off
    this.settings.progressMilestone.milestones.visible = this.settings.progressMilestone.show.value;
    this.settings.progressMilestone.milestoneColor.visible = this.settings.progressMilestone.show.value;

    // Conditional visibility: hide target color/lineWidth when target is off
    this.settings.targetSettings.color.visible = this.settings.targetSettings.show.value;
    this.settings.targetSettings.lineWidth.visible = this.settings.targetSettings.show.value;

    // Card Style — hide sub-settings when mode is 'none'
    const cardModeVis = (resolveDropdown(this.settings.cardSettings.cardStyleMode) ?? 'glass') as CardStyleMode;
    this.settings.cardSettings.backgroundOpacity.visible = cardModeVis !== 'none';
    this.settings.cardSettings.backgroundColor.visible = cardModeVis !== 'none';

    // Extract data
    const progressData = this.extractData(dataView);
    this.currentProgressData = progressData;

    // Render
    this.render(progressData.rows, options.viewport);
  }

  private extractData(dataView: DataView | undefined): ProgressBarData {
    const emptyResult: ProgressBarData = { rows: [], hasHighlights: false };

    if (!dataView?.categorical) return emptyResult;

    const categorical = dataView.categorical;
    const categories = categorical.categories;
    const values = categorical.values;

    if (!categories || categories.length === 0 || !values) return emptyResult;

    // Find the category column
    const categoryColumn = categories[0];
    if (!categoryColumn) return emptyResult;

    // Find measure and target columns
    let measureColumn: powerbi.DataViewValueColumn | undefined;
    let targetColumn: powerbi.DataViewValueColumn | undefined;

    for (const col of values) {
      const role = col.source.roles;
      if (!role) continue;
      if (role['measure']) measureColumn = col;
      if (role['target']) targetColumn = col;
    }

    if (!measureColumn) return emptyResult;

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

      let target: number;
      if (targetColumn && typeof targetColumn.values[i] === 'number') {
        target = targetColumn.values[i] as number;
      } else {
        target = globalMax;
      }

      // Guard against zero target
      if (target === 0) target = 1;

      const selectionId = this.host.createSelectionIdBuilder()
        .withCategory(categoryColumn, i)
        .createSelectionId();

      const highlighted = hasHighlights ? (hlRaw !== undefined && hlRaw[i] !== null && hlRaw[i] !== undefined) : false;

      rows.push({ label, value, target, selectionId, highlighted });
    }

    return { rows, hasHighlights };
  }

  private render(rows: ProgressBarRow[], viewport: powerbi.IViewport): void {
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    // Clear container — no innerHTML
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);

    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.container.addEventListener('click', this.handleBackgroundClick);

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

    // Empty data — show placeholder
    if (rows.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;opacity:0.5;font-size:12px;';
      empty.textContent = 'Add a Category and Value to get started';
      this.container.appendChild(empty);
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
      const pct = Math.min(row.value / row.target, 1);

      // Row container
      const rowEl = document.createElement('div');
      rowEl.className = 'progress-row';
      rowEl.style.gap = '10px';
      rowEl.style.cursor = 'pointer';
      rowEl.addEventListener('click', (event) => {
        event.stopPropagation();
        void this.selectionManager.select(row.selectionId, event.ctrlKey || event.metaKey);
      });
      rowEl.addEventListener('contextmenu', (event) => {
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

      if (showLabelsToggle && labelPos === 'above') {
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
        { displayName: '% Complete', value: `${Math.round(pct * 100)}%` },
      ];
      fillEl.addEventListener('mouseover', (event: MouseEvent) => {
        host.tooltipService.show({
          dataItems: tooltipItems,
          identities: [],
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
      if (s.targetSettings.show.value && row.target > 0) {
        const targetColor = s.targetSettings.color.value?.value ?? '#0F172A';
        const targetLineWidth = s.targetSettings.lineWidth.value;

        trackEl.style.position = 'relative';
        trackEl.style.overflow = 'visible';

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
          trackEl.style.position = 'relative';
          trackEl.style.overflow = 'visible';

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

      rowEl.appendChild(trackEl);

      // Value label
      if (s.barSettings.showValue.value || s.barSettings.showPercent.value) {
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
          parts.push(`${Math.round(pct * 100)}%`);
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
                    animParts.push(`${Math.min(animPct, 100)}%`);
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
              const targetPct = Math.round(pct * 100);
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
    const pctValues = rows.map((r) => Math.min(r.value / r.target, 1) * 100);
    this.renderSvgOverlay(rows, pctValues, viewport);

    // ── Cross-Highlight Dimming ──────────────────────────────────────
    this.applyCrossHighlight(rows);

    // ── Accessibility ────────────────────────────────────────────────
    this.applyAccessibility(rows);
  }

  // ── Cross-Highlight Dimming ─────────────────────────────────────

  private applyCrossHighlight(rows: ProgressBarRow[]): void {
    const data = this.currentProgressData;
    if (!data || !data.hasHighlights) return;

    const rowEls = this.container.querySelectorAll<HTMLElement>('.progress-row');
    rowEls.forEach((el, i) => {
      const row = rows[i];
      if (row && !row.highlighted) {
        el.style.opacity = '0.3';
      }
    });
  }

  /**
   * Applies axis label color and font size from the AxisFormattingCard
   * to all `.progress-label` HTML elements in the container.
   */
  private applyAxisLabelFormatting(): void {
    const axis = this.settings.axisFormattingCard;
    const color = axis.axisLabelColor.value?.value || '#64748B';
    const size = axis.axisLabelSize.value;

    const labels = this.container.querySelectorAll<HTMLElement>('.progress-label');
    for (const label of labels) {
      label.style.color = color;
      label.style.fontSize = `${size}px`;
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
  ): void {
    const ref = this.settings.referenceLineFormattingCard;
    const tl = this.settings.trendLineFormattingCard;
    const ann = this.settings.annotationFormattingCard;

    const showRef = ref.showReferenceLine.value;
    const showTrend = tl.showTrendLine.value && pctValues.length >= 2;
    const showAnn = ann.showAnnotations.value;

    if (!showRef && !showTrend && !showAnn) return;

    const width = viewport.width;
    const height = viewport.height;

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

    // y-scale maps percentage values (0–100) to vertical pixel space
    const yScale = d3.scaleLinear().domain([0, 100]).range([height - 20, 20]);

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

      renderHorizontalReferenceLine(g, {
        value: refValue,
        yScale,
        chartWidth: width,
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

    // ── Trend Line ───────────────────────────────────────────────────
    if (showTrend) {
      const trendType = (resolveDropdown(tl.trendLineType) ?? 'linear') as TrendType;
      const result = computeRegression(pctValues, trendType, tl.polynomialOrder.value);
      const trendColor = tl.trendLineColor.value?.value ?? '#6366F1';

      const xStep = pctValues.length > 1 ? width / (pctValues.length - 1) : width / 2;
      const xScale = (index: number): number => index * xStep;

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

      const xStep = rows.length > 1 ? width / (rows.length - 1) : width / 2;

      const resolvePosition = (category: string): { x: number; y: number } | null => {
        const idx = rows.findIndex((r) => r.label === category);
        if (idx < 0) return null;
        const pct = Math.min(rows[idx].value / rows[idx].target, 1) * 100;
        return { x: idx * xStep, y: yScale(pct) };
      };

      const config = buildAnnotationConfig(
        true,
        slots,
        ann.annotationFontSize.value,
        ann.annotationFontColor.value?.value ?? '#475569',
        ann.annotationConnectorColor.value?.value ?? '#94A3B8',
        resolvePosition,
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
        const pct = Math.round(Math.min(row.value / row.target, 1) * 100);
        el.setAttribute(
          'aria-label',
          `${row.label}: ${formatWithSettings(row.value, this.settings.numberFormattingCard)} of ${formatWithSettings(row.target, this.settings.numberFormattingCard)}, ${pct}%. Item ${i + 1} of ${rows.length}.`,
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
    void this.selectionManager.clear();
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
