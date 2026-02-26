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

type StatusLevel = 'good' | 'warning' | 'critical';

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
      const warnThresh = typeof warnCol?.values[i] === 'number' ? warnCol.values[i] as number : null;
      const critThresh = typeof critCol?.values[i] === 'number' ? critCol.values[i] as number : null;
      const selectionId = this.host.createSelectionIdBuilder()
        .withCategory(categories, i)
        .createSelectionId();

      const status = this.computeStatus(value, warnThresh, critThresh, String(direction));

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
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;

    // Apply glass style
    if (s.cardSettings.enableGlass.value) {
      const glass = getGlassStyle({
        mode: 'light',
        opacity: s.cardSettings.backgroundOpacity.value / 100,
        backgroundColor: ((s.cardSettings as any).backgroundColor?.value?.value ?? (s.cardSettings as any).bgColor?.value?.value),
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

    const colorMap: Record<StatusLevel, string> = {
      good: goodColor,
      warning: warningColor,
      critical: criticalColor,
    };

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
      const shapeEl = document.createElement('div');
      shapeEl.className = 'status-shape';
      const color = colorMap[row.status];
      shapeEl.style.width = `${iconSize}px`;
      shapeEl.style.height = `${iconSize}px`;
      shapeEl.style.backgroundColor = color;
      shapeEl.style.flexShrink = '0';

      if (shape === 'circle') {
        shapeEl.style.borderRadius = '50%';
      } else if (shape === 'square') {
        shapeEl.style.borderRadius = '2px';
      } else if (shape === 'diamond') {
        shapeEl.style.width = `${iconSize * 0.75}px`;
        shapeEl.style.height = `${iconSize * 0.75}px`;
        shapeEl.style.transform = 'rotate(45deg)';
        shapeEl.style.margin = `${iconSize * 0.125}px`;
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

      // Value
      const valueEl = document.createElement('div');
      valueEl.className = 'status-value';
      valueEl.style.fontSize = `${size}px`;
      valueEl.textContent = formatNumber(row.value);
      rowEl.appendChild(valueEl);

      layoutEl.appendChild(rowEl);

      // Entrance animation — staggered fadeSlideIn
      if (animEnabled) {
        const delay = idx * 60;
        const cancel = fadeSlideIn(rowEl, 'up', animDuration, delay);
        this.cancelAnimations.push(cancel);
      }
    });

    this.container.appendChild(layoutEl);
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

  public destroy(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.hideTooltip();
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
  }
}
