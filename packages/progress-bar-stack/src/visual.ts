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
  getGlassStyle,
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
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import ISelectionId = powerbi.visuals.ISelectionId;

import '../style/visual.less';

interface ProgressBarRow {
  label: string;
  value: number;
  target: number;
  selectionId: ISelectionId;
}

export class ProgressBarStackVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: ProgressBarStackSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];
  private keyboardNavCleanup: (() => void) | null = null;

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

    // Hide inapplicable shared axis properties — progress-bar-stack only uses axisLabelColor and axisLabelSize
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

    // Extract data
    const rows = this.extractData(dataView);

    // Render
    this.render(rows, options.viewport);
  }

  private extractData(dataView: DataView | undefined): ProgressBarRow[] {
    const rows: ProgressBarRow[] = [];

    if (!dataView?.categorical) return rows;

    const categorical = dataView.categorical;
    const categories = categorical.categories;
    const values = categorical.values;

    if (!categories || categories.length === 0 || !values) return rows;

    // Find the category column
    const categoryColumn = categories[0];
    if (!categoryColumn) return rows;

    // Find measure and target columns
    let measureColumn: powerbi.DataViewValueColumn | undefined;
    let targetColumn: powerbi.DataViewValueColumn | undefined;

    for (const col of values) {
      const role = col.source.roles;
      if (!role) continue;
      if (role['measure']) measureColumn = col;
      if (role['target']) targetColumn = col;
    }

    if (!measureColumn) return rows;

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

      rows.push({ label, value, target, selectionId });
    }

    return rows;
  }

  private render(rows: ProgressBarRow[], viewport: powerbi.IViewport): void {
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    // Clear container — no innerHTML
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);

    this.container.addEventListener('click', this.handleBackgroundClick);

    const s = this.settings;

    // Apply glass effect if enabled
    if (s.cardSettings.enableGlass.value) {
      const glass = getGlassStyle({
        mode: 'light',
        opacity: s.cardSettings.backgroundOpacity.value / 100,
        backgroundColor: s.cardSettings.backgroundColor.value?.value,
        borderRadius: s.cardSettings.borderRadius.value,
      });
      Object.assign(this.container.style, glass);
    } else {
      // Reset glass styles when disabled
      this.container.style.background = '';
      this.container.style.backdropFilter = '';
      (this.container.style as unknown as Record<string, string>)['WebkitBackdropFilter'] = '';
      this.container.style.border = '';
      this.container.style.boxShadow = '';
      this.container.style.borderRadius = '';
    }

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
    const barColor = s.colorSettings.barColor.value?.value ?? '#3B82F6';
    const trackColor = s.barSettings.trackColor.value?.value || s.colorSettings.trackColor.value?.value || '#E2E8F0';
    const labelColor = s.barSettings.labelColor.value?.value;
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
      const labelEl = document.createElement('div');
      labelEl.className = 'progress-label';
      labelEl.textContent = row.label;
      labelEl.title = row.label; // tooltip for truncated text
      rowEl.appendChild(labelEl);

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
      const gradientSettings = s.progressGradient;
      if (gradientSettings.enabled.value) {
        const gStart = gradientSettings.startColor.value?.value ?? '#3B82F6';
        const gEnd = gradientSettings.endColor.value?.value ?? '#8B5CF6';
        fillEl.style.background = `linear-gradient(to right, ${gStart}, ${gEnd})`;
      } else {
        fillEl.style.backgroundColor = conditionalColor ?? (barColor === '#3B82F6' ? getHostChartColor(this.host.colorPalette, i, themeName) : barColor);
      }
      fillEl.style.borderRadius = `${barCornerRadius}px`;
      fillEl.style.transition = 'opacity 0.15s ease';

      // Hover: increase opacity slightly
      fillEl.addEventListener('mouseenter', () => {
        fillEl.style.opacity = '0.85';
      });
      fillEl.addEventListener('mouseleave', () => {
        fillEl.style.opacity = '1';
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
            milestone.style.backgroundColor = '#94A3B8';
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

        const parts: string[] = [];

        if (s.barSettings.showValue.value) {
          parts.push(formatNumber(row.value));
        }
        if (s.barSettings.showPercent.value) {
          parts.push(`${Math.round(pct * 100)}%`);
        }

        const displayText = parts.join(' / ');

        if (animEnabled) {
          // countUp animation for the value
          valueEl.textContent = s.barSettings.showValue.value ? formatNumber(0) : '0%';
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
                    animParts.push(formatNumber(v));
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

    // ── Accessibility ────────────────────────────────────────────────
    this.applyAccessibility(rows);
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
      const labelText = ref.referenceLabelText.value.length > 0
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
          `${row.label}: ${formatNumber(row.value)} of ${formatNumber(row.target)}, ${pct}%. Item ${i + 1} of ${rows.length}.`,
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
