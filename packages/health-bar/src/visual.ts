/**
 * Health Bar — Vertical bar chart with red-to-green gradient showing health %.
 */

import powerbi from 'powerbi-visuals-api';
import IVisual = powerbi.extensibility.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import DataView = powerbi.DataView;
import ISelectionId = powerbi.visuals.ISelectionId;

import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import * as d3 from 'd3';

import {
  getGlassStyle,
  formatPercent,
  formatNumber,
  growBar,
  countUp,
  fadeSlideIn,
  DURATION,
  renderChartTitle,
  applyDataLabelFormatting,
  applyAxisFormatting,
  applyGridFormatting,
  createScrollableChart,
  applySortOrder,
  resolveDropdown,
} from '../../core/src';

import { HealthBarSettings } from './settings';

// ── Constants ────────────────────────────────────────────────────────

const SVG_NS = 'http://www.w3.org/2000/svg';
const MARGIN = { top: 24, bottom: 28 };
const PADDING = 12;
const Y_AXIS_WIDTH = 40;
const Y_TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

// ── Types ────────────────────────────────────────────────────────────

interface HealthBarItem {
  label: string;
  value: number;
  pct: number; // clamped 0-1
  target: number | null;
  selectionId: ISelectionId;
}

// ── Visual ───────────────────────────────────────────────────────────

export class HealthBarVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: HealthBarSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = this.host.createSelectionManager();
    this.formattingSettingsService = new FormattingSettingsService();

    this.container = document.createElement('div');
    this.container.className = 'health-bar-container';
    options.element.appendChild(this.container);
  }

  // ── Update ──────────────────────────────────────────────────────────

  public update(options: VisualUpdateOptions): void {
    // Cancel running animations
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    const dataView = options.dataViews?.[0];
    this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
      HealthBarSettings,
      dataView,
    );

    // Extract data and apply user-configured sort order
    const items = applySortOrder(
      this.extractData(dataView).map((d) => ({ ...d, name: d.label })),
      this.settings.sortFormattingCard,
    );
    this.render(items, options.viewport);
  }

  // ── Data Extraction ─────────────────────────────────────────────────

  private extractData(dataView: DataView | undefined): HealthBarItem[] {
    if (!dataView?.categorical?.categories?.[0] || !dataView.categorical.values) {
      return [];
    }

    const categories = dataView.categorical.categories[0];
    const allValues = dataView.categorical.values;
    const maxVal = this.settings.healthBarSettings.maxValue.value || 100;
    const items: HealthBarItem[] = [];

    // Find measure and target columns by role
    let measureColumn: powerbi.DataViewValueColumn | null = null;
    let targetColumn: powerbi.DataViewValueColumn | null = null;

    for (const col of allValues) {
      const role = col.source.roles;
      if (!role) continue;
      if (role['measure']) measureColumn = col;
      if (role['target']) targetColumn = col;
    }

    if (!measureColumn) return items;

    for (let i = 0; i < categories.values.length; i++) {
      const label = String(categories.values[i] ?? '');
      const rawValue = Number(measureColumn.values[i] ?? 0);

      if (!Number.isFinite(rawValue)) continue;

      const clamped = Math.max(0, Math.min(rawValue, maxVal));
      const pct = maxVal > 0 ? clamped / maxVal : 0;

      let target: number | null = null;
      if (targetColumn && i < targetColumn.values.length) {
        const raw = targetColumn.values[i];
        target = typeof raw === 'number' ? raw : null;
      }

      const selectionId = this.host
        .createSelectionIdBuilder()
        .withCategory(categories, i)
        .createSelectionId();

      items.push({ label, value: clamped, pct, target, selectionId });
    }

    return items;
  }

  // ── Render ──────────────────────────────────────────────────────────

  private render(items: HealthBarItem[], viewport: powerbi.IViewport): void {
    // Clear
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }

    const s = this.settings;

    // Glass effect
    if (s.cardSettings.enableGlass.value) {
      const glass = getGlassStyle({
        mode: 'light',
        opacity: s.cardSettings.backgroundOpacity.value / 100,
        backgroundColor: s.cardSettings.backgroundColor?.value?.value,
        borderRadius: s.cardSettings.borderRadius.value,
      });
      Object.assign(this.container.style, glass);
    } else {
      this.container.style.background = '';
      this.container.style.backdropFilter = '';
      (this.container.style as unknown as Record<string, string>).WebkitBackdropFilter = '';
      this.container.style.border = '';
      this.container.style.boxShadow = '';
      this.container.style.borderRadius = `${s.cardSettings.borderRadius.value}px`;
    }

    // Title
    renderChartTitle(this.container, s.titleFormattingCard);

    // Empty state
    if (items.length === 0) {
      this.renderEmpty();
      return;
    }

    // Dimensions
    const titleEl = this.container.querySelector('.chart-title') as HTMLElement | null;
    const titleHeight = titleEl ? titleEl.offsetHeight + 4 : 0;
    const svgWidth = viewport.width - 2 * PADDING;
    const svgHeight = viewport.height - titleHeight - 2 * PADDING;

    if (svgWidth <= 0 || svgHeight <= 0) {
      this.renderEmpty();
      return;
    }

    const showCategoryLabels = s.categoryLabelSettings.show.value;
    const bottomMargin = showCategoryLabels ? MARGIN.bottom : 6;
    const chartHeight = svgHeight - MARGIN.top - bottomMargin;
    if (chartHeight <= 0) return;

    // Y-axis
    const showYAxis = s.healthBarSettings.showYAxis.value;
    const leftMargin = showYAxis ? Y_AXIS_WIDTH : 0;
    const barAreaWidth = svgWidth - leftMargin;

    // Bar layout
    const gap = s.healthBarSettings.gap.value;
    const maxBarWidth = s.healthBarSettings.barWidth.value;
    const barCount = items.length;
    const totalGap = Math.max(0, barCount - 1) * gap;
    const availWidth = barAreaWidth - totalGap;

    // Scroll support — expand chart if bars would be too compressed
    const scroll = createScrollableChart({
      container: this.container,
      viewportWidth: svgWidth,
      viewportHeight: svgHeight,
      categoryCount: barCount,
      scrollSettings: s.scrollFormattingCard,
      availableChartWidth: barAreaWidth,
      availableChartHeight: chartHeight,
      direction: 'horizontal',
    });

    const effectiveBarAreaWidth = scroll.isScrolling ? scroll.chartWidth : barAreaWidth;
    const effectiveAvailWidth = effectiveBarAreaWidth - totalGap;
    const barWidth = Math.max(4, Math.min(maxBarWidth, effectiveAvailWidth / barCount));
    const totalBarsWidth = barCount * barWidth + totalGap;
    const effectiveSvgWidth = scroll.isScrolling ? scroll.svgWidth : svgWidth;
    const offsetX = leftMargin + (effectiveBarAreaWidth - totalBarsWidth) / 2;

    // Settings
    const cornerRadius = s.healthBarSettings.barCornerRadius.value;
    const showValue = s.healthBarSettings.showValue.value && s.dataLabelFormattingCard.showDataLabels.value;
    const showPercent = s.healthBarSettings.showPercent.value;
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;
    const staggerDelay = s.animationSettings.staggerDelay.value;

    // Colors
    const lowColor = s.colorSettings.lowColor.value?.value || '#EF4444';
    const midColor = s.colorSettings.midColor.value?.value || '#F59E0B';
    const highColor = s.colorSettings.highColor.value?.value || '#22C55E';
    const trackColor = s.colorSettings.trackColor.value?.value || '#E2E8F0';
    const trackOpacity = s.colorSettings.trackOpacity.value / 100;

    // Fill mode
    const fillModeVal = (s.healthBarSettings.fillMode?.value as unknown as { value?: string })?.value;
    const useGradient = fillModeVal !== 'solid';

    // Create SVG
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'health-bar-svg');
    svg.setAttribute('width', String(effectiveSvgWidth));
    svg.setAttribute('height', String(svgHeight));
    scroll.svgParent.appendChild(svg);

    // Chart group
    const chartGroup = document.createElementNS(SVG_NS, 'g');
    chartGroup.setAttribute('transform', `translate(0, ${MARGIN.top})`);
    svg.appendChild(chartGroup);

    // Gradient definition (only in gradient mode)
    if (useGradient) {
      const defs = document.createElementNS(SVG_NS, 'defs');
      const gradient = document.createElementNS(SVG_NS, 'linearGradient');
      gradient.setAttribute('id', 'health-gradient');
      gradient.setAttribute('gradientUnits', 'userSpaceOnUse');
      gradient.setAttribute('x1', '0');
      gradient.setAttribute('y1', String(chartHeight)); // bottom
      gradient.setAttribute('x2', '0');
      gradient.setAttribute('y2', '0'); // top

      const stop0 = document.createElementNS(SVG_NS, 'stop');
      stop0.setAttribute('offset', '0%');
      stop0.setAttribute('stop-color', lowColor);
      gradient.appendChild(stop0);

      const stop50 = document.createElementNS(SVG_NS, 'stop');
      stop50.setAttribute('offset', '50%');
      stop50.setAttribute('stop-color', midColor);
      gradient.appendChild(stop50);

      const stop100 = document.createElementNS(SVG_NS, 'stop');
      stop100.setAttribute('offset', '100%');
      stop100.setAttribute('stop-color', highColor);
      gradient.appendChild(stop100);

      defs.appendChild(gradient);
      svg.insertBefore(defs, svg.firstChild);
    }

    // Grid lines (rendered independently of Y-axis labels)
    const barsLeft = offsetX;
    const barsRight = offsetX + totalBarsWidth;

    const gridGroup = document.createElementNS(SVG_NS, 'g');
    gridGroup.setAttribute('class', 'health-bar-grid');

    for (const tick of Y_TICKS) {
      const y = chartHeight * (1 - tick);

      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', String(barsLeft));
      line.setAttribute('y1', String(y));
      line.setAttribute('x2', String(barsRight));
      line.setAttribute('y2', String(y));
      gridGroup.appendChild(line);
    }

    chartGroup.appendChild(gridGroup);
    applyGridFormatting(gridGroup as unknown as SVGGElement, s.axisFormattingCard);

    // Y-axis ticks
    if (showYAxis) {
      const yAxisGroup = document.createElementNS(SVG_NS, 'g');
      yAxisGroup.setAttribute('class', 'health-bar-y-axis');

      for (const tick of Y_TICKS) {
        const y = chartHeight * (1 - tick);

        const label = document.createElementNS(SVG_NS, 'text');
        label.setAttribute('x', String(leftMargin - 6));
        label.setAttribute('y', String(y + 4));
        label.setAttribute('text-anchor', 'end');
        label.textContent = `${Math.round(tick * 100)}%`;
        yAxisGroup.appendChild(label);
      }

      chartGroup.appendChild(yAxisGroup);
      applyAxisFormatting(yAxisGroup as unknown as SVGGElement, s.axisFormattingCard);
    }

    // Render bars
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const barX = offsetX + i * (barWidth + gap);
      const fillHeight = Math.max(0, chartHeight * item.pct);
      const fillY = chartHeight - fillHeight;

      // Track (background)
      const track = document.createElementNS(SVG_NS, 'rect');
      track.setAttribute('class', 'health-bar-track');
      track.setAttribute('x', String(barX));
      track.setAttribute('y', '0');
      track.setAttribute('width', String(barWidth));
      track.setAttribute('height', String(chartHeight));
      track.setAttribute('rx', String(cornerRadius));
      track.setAttribute('ry', String(cornerRadius));
      track.style.setProperty('fill', trackColor);
      track.style.setProperty('opacity', String(trackOpacity));
      chartGroup.appendChild(track);

      // Fill bar
      const fill = document.createElementNS(SVG_NS, 'rect');
      fill.setAttribute('class', 'health-bar-fill');
      fill.setAttribute('x', String(barX));
      fill.setAttribute('y', String(fillY));
      fill.setAttribute('width', String(barWidth));
      fill.setAttribute('height', String(fillHeight));
      fill.setAttribute('rx', String(cornerRadius));
      fill.setAttribute('ry', String(cornerRadius));

      if (useGradient) {
        fill.setAttribute('fill', 'url(#health-gradient)');
      } else {
        const solidColor = this.interpolateHealthColor(item.pct, lowColor, midColor, highColor);
        fill.style.setProperty('fill', solidColor);
      }

      chartGroup.appendChild(fill);

      // Click handlers
      fill.style.cursor = 'pointer';
      fill.addEventListener('click', (event: MouseEvent) => {
        event.stopPropagation();
        void this.selectionManager.select(item.selectionId, event.ctrlKey || event.metaKey);
      });
      fill.addEventListener('contextmenu', (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        void this.selectionManager.showContextMenu(item.selectionId, {
          x: event.clientX,
          y: event.clientY,
        });
      });

      // Animate fill bar
      if (animEnabled) {
        const delay = i * staggerDelay;
        const cancel = growBar(fill, delay, animDuration, 'vertical');
        this.cancelAnimations.push(cancel);
      }

      // ── Target Marker ─────────────────────────────────────────
      if (s.targetSettings.show.value && item.target !== null) {
        const maxValue = s.healthBarSettings.maxValue.value || 100;
        const targetPct = maxValue > 0 ? Math.max(0, Math.min(item.target, maxValue)) / maxValue : 0;
        const targetX = barX + barWidth * targetPct;
        const targetColor = s.targetSettings.color.value?.value ?? '#0F172A';
        const targetLineWidth = s.targetSettings.lineWidth.value;
        const markerStyle = resolveDropdown(s.targetSettings.markerStyle) ?? 'line';

        if (markerStyle === 'line') {
          const line = document.createElementNS(SVG_NS, 'line');
          line.setAttribute('class', 'health-bar-target');
          line.setAttribute('x1', String(targetX));
          line.setAttribute('y1', String(-2));
          line.setAttribute('x2', String(targetX));
          line.setAttribute('y2', String(chartHeight + 2));
          line.setAttribute('stroke', targetColor);
          line.setAttribute('stroke-width', String(targetLineWidth));
          line.setAttribute('stroke-linecap', 'round');
          chartGroup.appendChild(line);
        } else if (markerStyle === 'triangle') {
          const markerSize = barWidth * 0.15;
          const triY = fillY - markerSize - 1;
          const triangle = document.createElementNS(SVG_NS, 'polygon');
          triangle.setAttribute('class', 'health-bar-target');
          triangle.setAttribute('points',
            `${targetX},${triY + markerSize} ${targetX - markerSize / 2},${triY} ${targetX + markerSize / 2},${triY}`
          );
          triangle.setAttribute('fill', targetColor);
          chartGroup.appendChild(triangle);
        } else if (markerStyle === 'diamond') {
          const markerSize = barWidth * 0.12;
          const diaY = chartHeight / 2;
          const diamond = document.createElementNS(SVG_NS, 'polygon');
          diamond.setAttribute('class', 'health-bar-target');
          diamond.setAttribute('points',
            `${targetX},${diaY - markerSize} ${targetX + markerSize},${diaY} ${targetX},${diaY + markerSize} ${targetX - markerSize},${diaY}`
          );
          diamond.setAttribute('fill', targetColor);
          chartGroup.appendChild(diamond);
        }
      }

      // Value label
      if (showValue) {
        const pctText = showPercent
          ? formatPercent(item.pct, { decimals: 0 })
          : formatNumber(item.value, { abbreviate: true });
        const labelY = fillY - 6;

        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('class', 'health-bar-value');
        text.setAttribute('x', String(barX + barWidth / 2));
        text.setAttribute('y', String(Math.max(12, labelY)));
        text.setAttribute('text-anchor', 'middle');
        text.textContent = pctText;
        chartGroup.appendChild(text);

        // Animate value label
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

      // Category label (below bar)
      if (showCategoryLabels) {
        const catLabel = document.createElementNS(SVG_NS, 'text');
        catLabel.setAttribute('class', 'health-bar-label');
        catLabel.setAttribute('x', String(barX + barWidth / 2));
        catLabel.setAttribute('y', String(chartHeight + 16));
        catLabel.setAttribute('text-anchor', 'middle');

        // Truncate long text to fit bar width + gap
        const maxTextWidth = barWidth + gap * 0.6;
        catLabel.textContent = item.label;
        chartGroup.appendChild(catLabel);

        // Measure and truncate if needed (after appending to get dimensions)
        const textLen = catLabel.getComputedTextLength?.() ?? 0;
        if (textLen > maxTextWidth && item.label.length > 2) {
          let truncated = item.label;
          while (truncated.length > 1) {
            truncated = truncated.slice(0, -1);
            catLabel.textContent = truncated + '\u2026';
            if ((catLabel.getComputedTextLength?.() ?? 0) <= maxTextWidth) break;
          }
        }
      }
    }

    // Apply shared formatting
    applyDataLabelFormatting(this.container, s.dataLabelFormattingCard, '.health-bar-value');

    // Apply category label formatting
    if (showCategoryLabels) {
      const catColor = s.categoryLabelSettings.fontColor.value?.value || '#64748B';
      const catSize = s.categoryLabelSettings.fontSize.value;
      const catLabels = this.container.querySelectorAll('.health-bar-label');
      for (const el of catLabels) {
        if (el instanceof SVGElement) {
          el.style.setProperty('fill', catColor);
          el.style.setProperty('font-size', `${catSize}px`);
        }
      }
    }

    // Background click clears selection
    this.container.addEventListener('click', this.handleBackgroundClick);
  }

  // ── Color Interpolation ─────────────────────────────────────────────

  private interpolateHealthColor(
    pct: number,
    low: string,
    mid: string,
    high: string,
  ): string {
    if (pct <= 0.5) {
      return d3.interpolateRgb(low, mid)(pct * 2);
    }
    return d3.interpolateRgb(mid, high)((pct - 0.5) * 2);
  }

  // ── Empty State ─────────────────────────────────────────────────────

  private renderEmpty(): void {
    const el = document.createElement('div');
    el.className = 'health-bar-empty';
    el.textContent = 'Add a category and a measure to see health bars.';
    this.container.appendChild(el);
  }

  // ── Background Click ────────────────────────────────────────────────

  private handleBackgroundClick = (): void => {
    void this.selectionManager.clear();
  };

  // ── Formatting Model ────────────────────────────────────────────────

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  // ── Cleanup ─────────────────────────────────────────────────────────

  public destroy(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }
}
