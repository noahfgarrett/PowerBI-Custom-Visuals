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
  formatNumber,
  getGlassStyle,
  DURATION,
  renderChartTitle,
  applyChartAria,
  applyDataPointAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
  resolveConditionalColor,
  buildConditionalConfig,
  resolveDropdown,
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

type StatusLevel = 'good' | 'warning' | 'critical' | 'level4' | 'level5';

interface StatusRow {
  label: string;
  value: number | null;
  warningThreshold: number | null;
  criticalThreshold: number | null;
  status: StatusLevel;
  selectionId: ISelectionId;
}

// ── Visual class ────────────────────────────────────────────────────

export class StatusIndicatorVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: StatusIndicatorSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new StatusIndicatorSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('status-container');
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel running animations
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Parse settings
    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        StatusIndicatorSettings,
        dataView
      );
    }

    // Extract data
    const rows = this.extractData(dataView);

    this.notifyRenderStarted();
    try {
      this.render(rows);
      this.notifyRenderFinished();
    } catch (error) {
      this.notifyRenderFailed(error);
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

    for (let i = 0; i < count; i++) {
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
        ? this.computeCustomStatus(value, customThreshold1, customThreshold2, String(direction))
        : this.computeStatus(value, warnThresh, critThresh, String(direction));

      rows.push({
        label,
        value,
        warningThreshold: warnThresh,
        criticalThreshold: critThresh,
        status,
        selectionId,
      });
    }

    return rows;
  }

  private computeStatus(
    value: number | null,
    warnThresh: number | null,
    critThresh: number | null,
    direction: string
  ): StatusLevel {
    if (value === null) return 'warning';
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
    direction: string
  ): StatusLevel {
    if (value === null) return 'warning';

    const levelCountRaw = this.settings.statusLevelSettings.levelCount.value?.value ?? '3';
    const levelCount = parseInt(String(levelCountRaw), 10) || 3;

    if (levelCount >= 5 && direction === 'higherIsBetter') {
      const range = threshold2 - threshold1;
      const t3 = threshold2 + range * 0.5;
      const t4 = threshold2 + range;
      if (value >= t4) return 'level5';
      if (value >= t3) return 'level4';
      if (value >= threshold2) return 'good';
      if (value >= threshold1) return 'warning';
      return 'critical';
    }

    if (levelCount >= 4 && direction === 'higherIsBetter') {
      const t3 = threshold2 + (threshold2 - threshold1) * 0.5;
      if (value >= t3) return 'level4';
      if (value >= threshold2) return 'good';
      if (value >= threshold1) return 'warning';
      return 'critical';
    }

    if (levelCount >= 5 && direction === 'lowerIsBetter') {
      const range = threshold2 - threshold1;
      const t3 = threshold2 + range * 0.5;
      const t4 = threshold2 + range;
      if (value >= t4) return 'level5';
      if (value >= t3) return 'level4';
      if (value >= threshold2) return 'critical';
      if (value >= threshold1) return 'warning';
      return 'good';
    }

    if (levelCount >= 4 && direction === 'lowerIsBetter') {
      const t3 = threshold2 + (threshold2 - threshold1) * 0.5;
      if (value >= t3) return 'level4';
      if (value >= threshold2) return 'critical';
      if (value >= threshold1) return 'warning';
      return 'good';
    }

    if (direction === 'higherIsBetter') {
      if (value >= threshold2) return 'good';
      if (value >= threshold1) return 'warning';
      return 'critical';
    } else {
      if (value < threshold1) return 'good';
      if (value < threshold2) return 'warning';
      return 'critical';
    }
  }

  private render(rows: StatusRow[]): void {
    // Clear container
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.container.addEventListener('click', this.handleBackgroundClick);

    const s = this.settings;
    const shape = s.indicatorSettings.shape.value?.value ?? 'circle';
    const size = Math.max(6, s.indicatorSettings.size.value);
    const layout = s.indicatorSettings.layout.value?.value ?? 'vertical';
    const iconSize = Math.max(6, s.indicatorSettings.iconSize.value);
    const labelColor = s.indicatorSettings.labelColor.value?.value ?? '';
    const goodColor = s.thresholdSettings.goodColor.value?.value ?? '#34D399';
    const warningColor = s.thresholdSettings.warningColor.value?.value ?? '#FBBF24';
    const criticalColor = s.thresholdSettings.criticalColor.value?.value ?? '#EF4444';
    const enablePulse = s.pulseSettings.enablePulse.value;
    const showValue = s.thresholdSettings.showValue.value;
    const valueFontSize = Math.max(6, s.thresholdSettings.valueFontSize.value);
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;

    // Apply glass style
    if (s.cardSettings.enableGlass.value) {
      const glass = getGlassStyle({
        mode: 'light',
        opacity: s.cardSettings.backgroundOpacity.value / 100,
        backgroundColor: s.cardSettings.backgroundColor.value?.value,
        borderRadius: s.cardSettings.borderRadius.value,
      });
      Object.assign(this.container.style, glass);
    } else {
      this.container.style.background = '';
      this.container.style.backdropFilter = '';
      (this.container.style as unknown as Record<string, string>)['WebkitBackdropFilter'] = '';
      this.container.style.border = '';
      this.container.style.boxShadow = '';
      this.container.style.borderRadius = '';
    }

    // Empty state
    if (rows.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'status-empty';
      empty.textContent = 'Add Category and Value fields';
      this.container.appendChild(empty);
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
    const levelCountRaw = s.statusLevelSettings.levelCount.value?.value ?? '3';
    const levelCount = parseInt(String(levelCountRaw), 10) || 3;
    const level4Color = s.statusLevelSettings.level4Color.value?.value ?? '#60A5FA';
    const level5Color = s.statusLevelSettings.level5Color.value?.value ?? '#A78BFA';

    const colorMap: Record<StatusLevel, string> = {
      good: goodColor,
      warning: warningColor,
      critical: criticalColor,
      level4: level4Color,
      level5: level5Color,
    };

    // Status display settings
    const showSparkline = s.statusDisplaySettings.showSparkline.value;
    const showStatusText = s.statusDisplaySettings.showStatusText.value;
    const iconSet = resolveDropdown(s.statusDisplaySettings.iconSet) ?? 'circle';

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
      rowEl.style.cursor = 'pointer';
      rowEl.addEventListener('mouseenter', (event) => this.showStatusTooltip(row, event));
      rowEl.addEventListener('mousemove', (event) => this.moveTooltip(event));
      rowEl.addEventListener('mouseleave', () => this.hideTooltip());
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
        shapeEl.innerHTML = iconSvg;
      } else {
        shapeEl = document.createElement('div');
        shapeEl.className = 'status-shape';
        shapeEl.style.width = `${iconSize}px`;
        shapeEl.style.height = `${iconSize}px`;
        shapeEl.style.backgroundColor = color;
        shapeEl.style.flexShrink = '0';

        if (iconSet === 'circle' || shape === 'circle') {
          shapeEl.style.borderRadius = '50%';
        } else if (iconSet === 'square' || shape === 'square') {
          shapeEl.style.borderRadius = '2px';
        } else if (iconSet === 'diamond' || shape === 'diamond') {
          shapeEl.style.width = `${iconSize * 0.75}px`;
          shapeEl.style.height = `${iconSize * 0.75}px`;
          shapeEl.style.transform = 'rotate(45deg)';
          shapeEl.style.margin = `${iconSize * 0.125}px`;
        }
      }

      // Pulse animation for critical items
      if (enablePulse && row.status === 'critical') {
        const cancel = pulseGlow(shapeEl, criticalColor);
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
      labelEl.textContent = row.label;
      rowEl.appendChild(labelEl);

      // Value (only rendered when showValue is enabled)
      if (showValue) {
        const valueEl = document.createElement('div');
        valueEl.className = 'status-value';
        valueEl.style.fontSize = `${valueFontSize}px`;
        valueEl.textContent = formatNumber(row.value);
        rowEl.appendChild(valueEl);
      }

      // Status Text label (e.g., "On Track", "At Risk", "Critical")
      if (showStatusText) {
        const statusTextEl = document.createElement('div');
        statusTextEl.className = 'status-text';
        statusTextEl.style.fontSize = `${Math.max(8, size - 2)}px`;
        statusTextEl.style.color = color;
        statusTextEl.style.fontWeight = '500';
        statusTextEl.style.marginLeft = '4px';
        statusTextEl.textContent = this.getStatusText(row.status);
        rowEl.appendChild(statusTextEl);
      }

      // Mini sparkline
      if (showSparkline && row.value !== null) {
        const sparklineEl = this.createMiniSparkline(row.value, color);
        rowEl.appendChild(sparklineEl);
      }

      layoutEl.appendChild(rowEl);

      // Entrance animation — staggered fadeSlideIn
      if (animEnabled) {
        const delay = idx * 60;
        const cancel = fadeSlideIn(rowEl, 'up', animDuration, delay);
        this.cancelAnimations.push(cancel);
      }
    });

    this.container.appendChild(layoutEl);
    this.applyAccessibility();
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private showStatusTooltip(row: StatusRow, event: MouseEvent): void {
    const locale = this.getHostLocale();
    const tooltipData: VisualTooltipDataItem[] = [
      { displayName: 'Label', value: row.label },
      { displayName: 'Value', value: formatNumber(row.value, { abbreviate: false, locale }) },
      { displayName: 'Status', value: row.status },
    ];
    if (row.warningThreshold !== null) {
      tooltipData.push({
        displayName: 'Warning Threshold',
        value: formatNumber(row.warningThreshold, { abbreviate: false, locale }),
      });
    }
    if (row.criticalThreshold !== null) {
      tooltipData.push({
        displayName: 'Critical Threshold',
        value: formatNumber(row.criticalThreshold, { abbreviate: false, locale }),
      });
    }

    this.host.tooltipService.show({
      dataItems: tooltipData,
      identities: [],
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

  private getHostLocale(): string | undefined {
    const locale = (this.host as unknown as { locale?: unknown }).locale;
    return typeof locale === 'string' && locale.length > 0 ? locale : undefined;
  }

  private notifyRenderStarted(): void {
    const eventService = (this.host as unknown as {
      eventService?: { renderingStarted?: () => void };
    }).eventService;
    eventService?.renderingStarted?.();
  }

  private notifyRenderFinished(): void {
    const eventService = (this.host as unknown as {
      eventService?: { renderingFinished?: () => void };
    }).eventService;
    eventService?.renderingFinished?.();
  }

  private notifyRenderFailed(error: unknown): void {
    const eventService = (this.host as unknown as {
      eventService?: { renderingFailed?: (reason: string) => void };
    }).eventService;
    const reason = error instanceof Error ? error.message : 'render failure';
    eventService?.renderingFailed?.(reason);
  }

  private handleBackgroundClick = (): void => {
    void this.selectionManager.clear();
  };

  // -- Status Text Rendering ---------------------------------------------------

  private getStatusText(status: StatusLevel): string {
    switch (status) {
      case 'good': return 'On Track';
      case 'warning': return 'At Risk';
      case 'critical': return 'Critical';
      case 'level4': return 'Level 4';
      case 'level5': return 'Level 5';
      default: return '';
    }
  }

  /**
   * Creates a mini sparkline SVG element showing a simple value indicator.
   * Uses the value to render a small bar relative to 100.
   */
  private createMiniSparkline(value: number, color: string): HTMLElement {
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

    // Value bar (scaled to width, clamped 0-100 range for visual)
    const barWidth = Math.max(2, Math.min(width, (Math.abs(value) / 100) * width));
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
        const value = rowEl.querySelector('.status-value')?.textContent ?? '';
        applyDataPointAria(rowEl, label, value, i, rows.length);
      });

      const cleanup = attachKeyboardNav({
        container: this.container,
        itemSelector: '.status-row',
        onActivate: (el: Element) => {
          (el as HTMLElement).click();
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
