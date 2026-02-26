/**
 * Bar Race — Power BI IVisual implementation.
 * Animated bar chart race showing top N items over time.
 * Bars resize and reorder with smooth CSS transitions as time advances.
 * Auto-play with configurable speed. Shows current time period label.
 */

import powerbi from 'powerbi-visuals-api';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { BarRaceSettings } from './settings';
import {
  formatNumber,
  getGlassStyle,
  getHostChartColor,
  renderChartTitle,
  applyDataLabelFormatting,
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import ISelectionId = powerbi.visuals.ISelectionId;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import '../style/visual.less';

// ── Types ───────────────────────────────────────────────────────────

interface RaceItem {
  name: string;
  value: number;
}

interface RaceData {
  /** Sorted list of unique time period strings. */
  timePeriods: string[];
  /** Map from time period to ranked items. */
  frames: Map<string, RaceItem[]>;
  /** Persistent color assignment per category name. */
  colorMap: Map<string, string>;
  /** Selection id for each category name (first row occurrence). */
  selectionMap: Map<string, ISelectionId>;
  isEmpty: boolean;
}

// ── Constants ───────────────────────────────────────────────────────

const LABEL_AREA_WIDTH = 120;
const VALUE_AREA_WIDTH = 70;
const BAR_GAP = 4;

// ── Visual ──────────────────────────────────────────────────────────

export class BarRaceVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: BarRaceSettings;
  private formattingSettingsService: FormattingSettingsService;

  /** Active animation frame or interval handles for cleanup. */
  private cancelFns: Array<() => void> = [];
  private playIntervalId: ReturnType<typeof setInterval> | null = null;

  /** Current time index in the race. */
  private currentTimeIndex: number = 0;

  /** Parsed race data. */
  private raceData: RaceData = {
    timePeriods: [],
    frames: new Map(),
    colorMap: new Map(),
    selectionMap: new Map(),
    isEmpty: true,
  };

  /** DOM references for bar elements keyed by category name. */
  private barElements: Map<string, HTMLElement> = new Map();
  private labelElements: Map<string, HTMLElement> = new Map();
  private valueElements: Map<string, HTMLElement> = new Map();

  /** Viewport element containing the bars. */
  private viewport: HTMLElement | null = null;
  /** Time period label element. */
  private timeLabel: HTMLElement | null = null;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new BarRaceSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('bar-race-container');
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel all running animations and intervals
    this.cleanup();

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        BarRaceSettings,
        dataView,
      );
    }

    // Apply glass card style
    this.applyCardStyle();

    // Extract data
    this.raceData = this.extractData(dataView);

    this.notifyRenderStarted();
    try {
      if (this.raceData.isEmpty) {
        this.renderEmpty();
        this.notifyRenderFinished();
        return;
      }

      // Reset time index
      this.currentTimeIndex = 0;

      // Build DOM structure (bars created once, updated per frame)
      this.buildDom(options.viewport);

      // Render initial frame
      this.renderFrame();

      // Start auto-play if enabled
      if (this.settings.raceSettings.autoPlay.value) {
        this.startAutoPlay();
      }
      this.notifyRenderFinished();
    } catch (error) {
      this.notifyRenderFailed(error);
      throw error;
    }
  }

  // ── Data Extraction ─────────────────────────────────────────────

  private extractData(dataView: DataView | undefined): RaceData {
    const empty: RaceData = {
      timePeriods: [],
      frames: new Map(),
      colorMap: new Map(),
      selectionMap: new Map(),
      isEmpty: true,
    };

    if (!dataView?.categorical) return empty;

    const categorical = dataView.categorical;
    const categories = categorical.categories;
    const values = categorical.values;

    if (!categories || categories.length < 2 || !values || values.length === 0) return empty;

    const categoryColumn = categories[0];
    const timeColumn = categories[1];
    const measureColumn = values[0];

    if (!categoryColumn || !timeColumn || !measureColumn) return empty;

    const rowCount = categoryColumn.values.length;
    if (rowCount === 0) return empty;

    // Build frames: Map<timePeriod, Array<{name, value}>>
    const frames = new Map<string, RaceItem[]>();
    const uniqueCategories = new Set<string>();
    const selectionMap = new Map<string, ISelectionId>();

    for (let i = 0; i < rowCount; i++) {
      const catVal = categoryColumn.values[i];
      const timeVal = timeColumn.values[i];
      const measureVal = measureColumn.values[i];

      const name = catVal !== null && catVal !== undefined ? String(catVal) : '';
      const timePeriod = timeVal !== null && timeVal !== undefined ? String(timeVal) : '';
      const value = typeof measureVal === 'number' ? measureVal : 0;

      if (name === '' || timePeriod === '') continue;

      uniqueCategories.add(name);
      if (!selectionMap.has(name)) {
        const id = this.host.createSelectionIdBuilder()
          .withCategory(categoryColumn, i)
          .createSelectionId();
        selectionMap.set(name, id);
      }

      let frame = frames.get(timePeriod);
      if (!frame) {
        frame = [];
        frames.set(timePeriod, frame);
      }
      frame.push({ name, value });
    }

    if (frames.size === 0) return empty;

    // Sort time periods chronologically (string sort works for most date formats)
    const timePeriods = Array.from(frames.keys()).sort();

    // Sort items within each frame by value descending
    for (const [, items] of frames) {
      items.sort((a, b) => b.value - a.value);
    }

    // Assign persistent colors to each unique category
    const colorMap = new Map<string, string>();
    const sortedCategories = Array.from(uniqueCategories).sort();
    const usePalette = this.settings.colorSettings.useChartPalette.value;
    sortedCategories.forEach((cat, idx) => {
      colorMap.set(
        cat,
        usePalette
          ? getHostChartColor(this.host.colorPalette, idx)
          : BarRaceVisual.DEFAULT_LABEL_COLOR,
      );
    });

    return { timePeriods, frames, colorMap, selectionMap, isEmpty: false };
  }

  // ── Card Style ────────────────────────────────────────────────────

  private applyCardStyle(): void {
    const s = this.settings.cardSettings;
    if (s.enableGlass.value) {
      const glass = getGlassStyle({
        mode: 'light',
        opacity: s.backgroundOpacity.value / 100,
        backgroundColor: ((s as any).backgroundColor?.value?.value ?? (s as any).bgColor?.value?.value),
        borderRadius: s.borderRadius.value,
      });
      Object.assign(this.container.style, glass);
      // WebKit prefix for Safari/older browsers
      (this.container.style as unknown as Record<string, string>)['WebkitBackdropFilter'] = glass.WebkitBackdropFilter;
    } else {
      this.container.style.background = '';
      this.container.style.backdropFilter = '';
      (this.container.style as unknown as Record<string, string>)['WebkitBackdropFilter'] = '';
      this.container.style.border = '';
      this.container.style.boxShadow = '';
      this.container.style.borderRadius = `${s.borderRadius.value}px`;
    }
  }

  // ── Axis Label Formatting ────────────────────────────────────────

  private static readonly DEFAULT_LABEL_COLOR = '#64748B';

  /**
   * Applies axis formatting card settings (label color + font size)
   * to all `.bar-race-label` HTML spans.
   * Bar-race uses HTML elements (not SVG), so the shared SVG-based
   * `applyAxisFormatting` helper does not apply here.
   */
  private applyAxisLabelFormatting(): void {
    const axis = this.settings.axisFormattingCard;
    const rawColor = axis.axisLabelColor.value?.value;
    const labelColor =
      rawColor != null && rawColor.length > 0
        ? rawColor
        : BarRaceVisual.DEFAULT_LABEL_COLOR;
    const labelSize = axis.axisLabelSize.value;

    const labels = this.container.querySelectorAll<HTMLElement>('.bar-race-label');
    for (const el of labels) {
      el.style.color = labelColor;
      el.style.fontSize = `${labelSize}px`;
    }
  }

  // ── Value Settings Override ──────────────────────────────────────

  /**
   * Applies valueSettings.fontSize to all `.bar-race-value` elements,
   * overriding the shared DataLabelFormattingCard font size when the
   * race-specific value font size is set.
   */
  private applyValueSettingsOverrides(): void {
    const vs = this.settings.valueSettings;
    const size = vs.fontSize.value;

    const values = this.container.querySelectorAll<HTMLElement>('.bar-race-value');
    for (const el of values) {
      el.style.fontSize = `${size}px`;
    }
  }

  // ── Label Color Override ───────────────────────────────────────────

  /**
   * Applies raceSettings.labelColor to all `.bar-race-label` elements,
   * overriding the shared AxisFormattingCard label color when the
   * race-specific label color is set by the user.
   */
  private applyLabelColorOverride(): void {
    const rawColor = this.settings.raceSettings.labelColor.value?.value;
    if (rawColor == null || rawColor.length === 0) return;

    const labels = this.container.querySelectorAll<HTMLElement>('.bar-race-label');
    for (const el of labels) {
      el.style.color = rawColor;
    }
  }

  // ── Empty State ───────────────────────────────────────────────────

  private renderEmpty(): void {
    this.clearContainer();
    const emptyEl = document.createElement('div');
    emptyEl.className = 'bar-race-empty';
    emptyEl.textContent = 'Add a Category, Time Axis, and Measure to get started.';
    this.container.appendChild(emptyEl);
  }

  // ── DOM Construction ──────────────────────────────────────────────

  private buildDom(_viewport: powerbi.IViewport): void {
    this.clearContainer();
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.barElements.clear();
    this.labelElements.clear();
    this.valueElements.clear();
    this.container.removeEventListener('click', this.handleBackgroundClick);

    const s = this.settings;
    const topN = Math.max(1, s.raceSettings.topN.value);
    const barHeight = Math.max(10, s.raceSettings.barHeight.value);
    const animDuration = s.animationSettings.enabled.value ? s.animationSettings.duration.value : 0;
    const fontSize = s.valueSettings.fontSize.value;

    // Viewport wrapper
    const vp = document.createElement('div');
    vp.className = 'bar-race-viewport';
    this.viewport = vp;

    // Gather all unique categories that appear in any frame's topN
    const allVisibleCategories = new Set<string>();
    for (const [, items] of this.raceData.frames) {
      const topItems = items.slice(0, topN);
      for (const item of topItems) {
        allVisibleCategories.add(item.name);
      }
    }

    // Pre-create bar elements for each category that could appear
    for (const catName of allVisibleCategories) {
      const barRow = document.createElement('div');
      barRow.className = 'bar-race-bar';
      barRow.style.height = `${barHeight}px`;
      barRow.style.opacity = '0';
      barRow.style.borderRadius = `${s.raceSettings.barCornerRadius.value}px`;

      // Set transition duration from settings
      if (animDuration > 0) {
        const durationSec = animDuration / 1000;
        barRow.style.transition = [
          `top ${durationSec}s cubic-bezier(0.22, 1, 0.36, 1)`,
          `width ${durationSec}s cubic-bezier(0.22, 1, 0.36, 1)`,
          `opacity 0.3s ease`,
        ].join(', ');
      } else {
        barRow.style.transition = 'none';
      }

      barRow.style.backgroundColor = this.raceData.colorMap.get(catName) ?? '#64748B';
      barRow.style.cursor = 'pointer';

      const selectionId = this.raceData.selectionMap.get(catName);
      if (selectionId) {
        barRow.addEventListener('click', (event) => {
          event.stopPropagation();
          void this.selectionManager.select(selectionId, event.ctrlKey || event.metaKey);
        });
        barRow.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          event.stopPropagation();
          void this.selectionManager.showContextMenu(selectionId, {
            x: event.clientX,
            y: event.clientY,
          });
        });
      }
      barRow.addEventListener('mouseenter', (event) => this.showBarTooltip(catName, event));
      barRow.addEventListener('mousemove', (event) => this.moveTooltip(event));
      barRow.addEventListener('mouseleave', () => this.hideTooltip());

      // Category label
      const label = document.createElement('span');
      label.className = 'bar-race-label';
      label.textContent = catName;
      label.style.fontSize = `${fontSize}px`;
      const rawLabelColor = s.raceSettings.labelColor.value?.value;
      if (rawLabelColor != null && rawLabelColor.length > 0) {
        label.style.color = rawLabelColor;
      }
      barRow.appendChild(label);

      // Value label
      const valueEl = document.createElement('span');
      valueEl.className = 'bar-race-value';
      valueEl.style.fontSize = `${fontSize}px`;
      barRow.appendChild(valueEl);

      vp.appendChild(barRow);
      this.barElements.set(catName, barRow);
      this.labelElements.set(catName, label);
      this.valueElements.set(catName, valueEl);
    }

    this.container.appendChild(vp);
    // Apply shared formatting settings (base layer)
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.bar-race-value');
    this.applyAxisLabelFormatting();

    // Apply race-specific overrides on top of shared formatting
    this.applyValueSettingsOverrides();
    this.applyLabelColorOverride();

    this.container.addEventListener('click', this.handleBackgroundClick);

    // Time period label (bottom-right corner)
    const timeLbl = document.createElement('div');
    timeLbl.className = 'bar-race-time';
    this.container.appendChild(timeLbl);
    this.timeLabel = timeLbl;
  }

  // ── Frame Rendering ───────────────────────────────────────────────

  private renderFrame(): void {
    const s = this.settings;
    const topN = Math.max(1, s.raceSettings.topN.value);
    const barHeight = Math.max(10, s.raceSettings.barHeight.value);
    const showValues = s.valueSettings.showValues.value;

    const { timePeriods, frames } = this.raceData;
    if (timePeriods.length === 0) return;

    const currentPeriod = timePeriods[this.currentTimeIndex];
    if (currentPeriod === undefined) return;

    const items = frames.get(currentPeriod);
    if (!items) return;

    const topItems = items.slice(0, topN);

    // Find max value for width scaling
    const maxVal = topItems.length > 0 ? topItems[0].value : 1;
    const safeMax = maxVal > 0 ? maxVal : 1;

    // Compute available bar width
    const containerWidth = this.container.clientWidth;
    const availableBarWidth = Math.max(0, containerWidth - LABEL_AREA_WIDTH - VALUE_AREA_WIDTH - 16);

    // Build set of visible categories in this frame
    const visibleSet = new Set<string>();
    topItems.forEach((item) => visibleSet.add(item.name));

    // Update bar positions and widths for visible items
    topItems.forEach((item, rank) => {
      const barEl = this.barElements.get(item.name);
      const valueEl = this.valueElements.get(item.name);
      if (!barEl) return;

      const topPos = rank * (barHeight + BAR_GAP);
      const widthPx = Math.max(4, (item.value / safeMax) * availableBarWidth);

      barEl.style.top = `${topPos}px`;
      barEl.style.left = `${LABEL_AREA_WIDTH}px`;
      barEl.style.width = `${widthPx}px`;
      barEl.style.opacity = String(s.raceSettings.barOpacity.value / 100);

      if (valueEl && showValues) {
        valueEl.textContent = formatNumber(item.value);
        valueEl.style.display = '';
      } else if (valueEl) {
        valueEl.style.display = 'none';
      }

      (barEl as HTMLElement).dataset['tooltipPeriod'] = currentPeriod;
      (barEl as HTMLElement).dataset['tooltipValue'] = String(item.value);
    });

    // Hide bars not in the current top N
    for (const [catName, barEl] of this.barElements) {
      if (!visibleSet.has(catName)) {
        barEl.style.opacity = '0';
      }
    }

    // Update time period label
    if (this.timeLabel) {
      this.timeLabel.textContent = currentPeriod;
    }
  }

  // ── Auto-Play ─────────────────────────────────────────────────────

  private startAutoPlay(): void {
    const speed = Math.max(100, this.settings.raceSettings.playSpeed.value);
    const totalPeriods = this.raceData.timePeriods.length;

    if (totalPeriods <= 1) return;

    this.playIntervalId = setInterval(() => {
      this.currentTimeIndex++;
      if (this.currentTimeIndex >= totalPeriods) {
        // Loop back to start
        this.currentTimeIndex = 0;
      }
      this.renderFrame();
    }, speed);
  }

  // ── Cleanup ───────────────────────────────────────────────────────

  private cleanup(): void {
    // Cancel animations
    for (const cancel of this.cancelFns) {
      cancel();
    }
    this.cancelFns = [];

    // Clear auto-play interval
    if (this.playIntervalId !== null) {
      clearInterval(this.playIntervalId);
      this.playIntervalId = null;
    }
  }

  private clearContainer(): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    this.viewport = null;
    this.timeLabel = null;
  }

  // ── Formatting Model ──────────────────────────────────────────────

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private showBarTooltip(categoryName: string, event: MouseEvent): void {
    const barEl = this.barElements.get(categoryName);
    if (!barEl) return;
    const period = barEl.dataset['tooltipPeriod'] ?? '';
    const rawValue = Number(barEl.dataset['tooltipValue'] ?? '0');
    const locale = this.getHostLocale();

    const tooltipData: VisualTooltipDataItem[] = [
      { displayName: 'Category', value: categoryName },
      { displayName: 'Value', value: formatNumber(rawValue, { abbreviate: false, locale }) },
      { displayName: 'Period', value: period },
    ];

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

  // ── Destroy ───────────────────────────────────────────────────────

  public destroy(): void {
    this.cleanup();
    this.hideTooltip();
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.clearContainer();
    this.barElements.clear();
    this.labelElements.clear();
    this.valueElements.clear();
  }
}
