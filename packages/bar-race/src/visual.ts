/**
 * Bar Race — Power BI IVisual implementation.
 * Animated bar chart race showing top N items over time.
 * Bars resize and reorder with smooth CSS transitions as time advances.
 * User-controlled playback with play/pause, scrub, step, and speed controls.
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

/** Parsed speed multiplier from the dropdown string (e.g. '2x' -> 2). */
const SPEED_MULTIPLIER_MAP: Record<string, number> = {
  '0.5x': 0.5,
  '1x': 1,
  '1.5x': 1.5,
  '2x': 2,
  '3x': 3,
};

// ── Constants ───────────────────────────────────────────────────────

const LABEL_AREA_WIDTH = 120;
const VALUE_AREA_WIDTH = 70;
const BAR_GAP = 4;
const CONTROLS_HEIGHT = 28;

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

  /** Whether the animation is currently playing. */
  private isPlaying: boolean = false;

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

  /** Playback control DOM references. */
  private controlsBar: HTMLElement | null = null;
  private playPauseBtn: HTMLButtonElement | null = null;
  private scrubSlider: HTMLInputElement | null = null;
  private speedSelect: HTMLSelectElement | null = null;
  private frameCounter: HTMLElement | null = null;

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

      // Reset time index and playback state
      this.currentTimeIndex = 0;
      this.isPlaying = false;

      // Build DOM structure (bars created once, updated per frame)
      this.buildDom(options.viewport);

      // Build playback controls if enabled
      this.buildControls();

      // Render initial frame
      this.renderFrame();

      // Start auto-play if enabled (uses new playback setting)
      const autoPlay = this.settings.playbackSettings.autoPlay.value;
      if (autoPlay) {
        this.play();
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
        backgroundColor: ((s as unknown as Record<string, { value?: { value?: string } }>)['backgroundColor']?.value?.value ?? (s as unknown as Record<string, { value?: { value?: string } }>)['bgColor']?.value?.value),
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

    // Large timestamp watermark display
    const ts = this.settings.timestampSettings;
    const timeLbl = document.createElement('div');
    timeLbl.className = 'bar-race-time';

    if (ts.show.value) {
      timeLbl.style.display = '';
      timeLbl.style.fontSize = `${ts.fontSize.value}px`;
      timeLbl.style.fontWeight = '700';
      timeLbl.style.opacity = String(Math.max(0, Math.min(100, ts.opacity.value)) / 100);

      const rawColor = ts.fontColor.value?.value;
      timeLbl.style.color =
        rawColor != null && rawColor.length > 0 ? rawColor : '#000000';

      // Position based on dropdown value
      const pos = ts.position.value?.value ?? 'bottomRight';
      // Reset positioning defaults
      timeLbl.style.top = '';
      timeLbl.style.bottom = '';
      timeLbl.style.left = '';
      timeLbl.style.right = '';
      timeLbl.style.transform = '';

      switch (pos) {
        case 'center':
          timeLbl.style.top = '50%';
          timeLbl.style.left = '50%';
          timeLbl.style.transform = 'translate(-50%, -50%)';
          break;
        case 'topRight':
          timeLbl.style.top = '16px';
          timeLbl.style.right = '16px';
          break;
        case 'bottomRight':
        default:
          timeLbl.style.bottom = '16px';
          timeLbl.style.right = '16px';
          break;
      }
    } else {
      timeLbl.style.display = 'none';
    }

    this.container.appendChild(timeLbl);
    this.timeLabel = timeLbl;
  }

  // ── Playback Controls DOM ──────────────────────────────────────────

  /**
   * Builds the playback control bar (play/pause, step, scrub, speed, frame counter).
   * Only builds if showControls is true and there are at least 2 frames.
   */
  private buildControls(): void {
    // Reset control references
    this.controlsBar = null;
    this.playPauseBtn = null;
    this.scrubSlider = null;
    this.speedSelect = null;
    this.frameCounter = null;

    const pb = this.settings.playbackSettings;
    if (!pb.showControls.value) return;

    const totalFrames = this.raceData.timePeriods.length;
    if (totalFrames < 2) return;

    const controlPosition = pb.controlPosition.value?.value ?? 'bottom';

    // Controls container
    const bar = document.createElement('div');
    bar.className = `bar-race-controls bar-race-controls--${controlPosition}`;
    this.controlsBar = bar;

    // Adjust viewport padding so bars don't overlap controls
    if (this.viewport) {
      if (controlPosition === 'top') {
        this.viewport.style.paddingTop = `${CONTROLS_HEIGHT}px`;
      } else {
        this.viewport.style.paddingBottom = `${CONTROLS_HEIGHT}px`;
      }
    }

    // ── Rewind to start ──
    const rewindBtn = this.createControlButton('\u23EE', 'Rewind to start');
    rewindBtn.addEventListener('click', () => this.seekTo(0));
    bar.appendChild(rewindBtn);

    // ── Step back ──
    const stepBackBtn = this.createControlButton('\u23EA', 'Step back one frame');
    stepBackBtn.addEventListener('click', () => this.stepBack());
    bar.appendChild(stepBackBtn);

    // ── Play / Pause ──
    const playPauseBtn = this.createControlButton('\u25B6', 'Play');
    playPauseBtn.addEventListener('click', () => this.togglePlayPause());
    bar.appendChild(playPauseBtn);
    this.playPauseBtn = playPauseBtn;

    // ── Step forward ──
    const stepFwdBtn = this.createControlButton('\u23E9', 'Step forward one frame');
    stepFwdBtn.addEventListener('click', () => this.stepForward());
    bar.appendChild(stepFwdBtn);

    // ── Skip to end ──
    const skipEndBtn = this.createControlButton('\u23ED', 'Skip to end');
    skipEndBtn.addEventListener('click', () => this.seekTo(totalFrames - 1));
    bar.appendChild(skipEndBtn);

    // ── Scrub slider ──
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'bar-race-scrub';
    slider.min = '0';
    slider.max = String(totalFrames - 1);
    slider.value = String(this.currentTimeIndex);
    slider.setAttribute('aria-label', 'Scrub timeline');
    slider.addEventListener('input', () => {
      const idx = parseInt(slider.value, 10);
      if (!isNaN(idx)) {
        this.seekTo(idx);
      }
    });
    bar.appendChild(slider);
    this.scrubSlider = slider;

    // ── Speed dropdown ──
    const speedSel = document.createElement('select');
    speedSel.className = 'bar-race-speed-select';
    speedSel.setAttribute('aria-label', 'Playback speed');
    const speedOptions = ['0.5x', '1x', '1.5x', '2x', '3x'];
    const currentSpeed = pb.speed.value?.value ?? '1x';
    for (const opt of speedOptions) {
      const option = document.createElement('option');
      option.value = opt;
      option.textContent = opt;
      if (opt === currentSpeed) {
        option.selected = true;
      }
      speedSel.appendChild(option);
    }
    speedSel.addEventListener('change', () => {
      // When user changes speed via the dropdown control, restart the
      // interval if currently playing so the new speed takes effect.
      if (this.isPlaying) {
        this.stopInterval();
        this.startInterval();
      }
    });
    bar.appendChild(speedSel);
    this.speedSelect = speedSel;

    // ── Frame counter ──
    const counter = document.createElement('span');
    counter.className = 'bar-race-frame-counter';
    counter.textContent = `${this.currentTimeIndex + 1}/${totalFrames}`;
    bar.appendChild(counter);
    this.frameCounter = counter;

    this.container.appendChild(bar);
  }

  /** Creates a compact control button with the given text content and title. */
  private createControlButton(text: string, title: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'bar-race-ctrl-btn';
    btn.textContent = text;
    btn.title = title;
    btn.setAttribute('aria-label', title);
    return btn;
  }

  // ── Playback Logic ────────────────────────────────────────────────

  /** Returns the effective speed multiplier from the dropdown (UI or settings). */
  private getSpeedMultiplier(): number {
    // Prefer the runtime dropdown value (user may have changed it at runtime)
    if (this.speedSelect) {
      return SPEED_MULTIPLIER_MAP[this.speedSelect.value] ?? 1;
    }
    const settingValue = this.settings.playbackSettings.speed.value?.value ?? '1x';
    return SPEED_MULTIPLIER_MAP[settingValue] ?? 1;
  }

  /** Computes the interval duration in ms for the current speed. */
  private getIntervalMs(): number {
    const baseSpeed = Math.max(100, this.settings.raceSettings.playSpeed.value);
    const multiplier = this.getSpeedMultiplier();
    // Higher multiplier = faster = shorter interval
    return Math.max(50, baseSpeed / multiplier);
  }

  /** Start or resume playback. */
  private play(): void {
    const totalFrames = this.raceData.timePeriods.length;
    if (totalFrames <= 1) return;

    // If we are already at the end and loop is off, restart from 0
    if (this.currentTimeIndex >= totalFrames - 1 && !this.settings.playbackSettings.loop.value) {
      this.currentTimeIndex = 0;
      this.renderFrame();
      this.syncControlsToFrame();
    }

    this.isPlaying = true;
    this.updatePlayPauseIcon();
    this.startInterval();
  }

  /** Pause playback. */
  private pause(): void {
    this.isPlaying = false;
    this.stopInterval();
    this.updatePlayPauseIcon();
  }

  /** Toggle between play and pause. */
  private togglePlayPause(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /** Jump to a specific frame index and render it. */
  private seekTo(frameIndex: number): void {
    const totalFrames = this.raceData.timePeriods.length;
    if (totalFrames === 0) return;

    this.currentTimeIndex = Math.max(0, Math.min(frameIndex, totalFrames - 1));
    this.renderFrame();
    this.syncControlsToFrame();
  }

  /** Advance one frame forward. Pauses playback if at end and loop is off. */
  private stepForward(): void {
    const totalFrames = this.raceData.timePeriods.length;
    if (totalFrames === 0) return;

    // Pause if currently playing (step is manual)
    if (this.isPlaying) {
      this.pause();
    }

    if (this.currentTimeIndex < totalFrames - 1) {
      this.currentTimeIndex++;
    } else if (this.settings.playbackSettings.loop.value) {
      this.currentTimeIndex = 0;
    }

    this.renderFrame();
    this.syncControlsToFrame();
  }

  /** Go back one frame. */
  private stepBack(): void {
    const totalFrames = this.raceData.timePeriods.length;
    if (totalFrames === 0) return;

    // Pause if currently playing (step is manual)
    if (this.isPlaying) {
      this.pause();
    }

    if (this.currentTimeIndex > 0) {
      this.currentTimeIndex--;
    } else if (this.settings.playbackSettings.loop.value) {
      this.currentTimeIndex = totalFrames - 1;
    }

    this.renderFrame();
    this.syncControlsToFrame();
  }

  /** Start the setInterval that drives automatic frame advancement. */
  private startInterval(): void {
    this.stopInterval();
    const intervalMs = this.getIntervalMs();
    const totalFrames = this.raceData.timePeriods.length;

    this.playIntervalId = setInterval(() => {
      this.currentTimeIndex++;
      if (this.currentTimeIndex >= totalFrames) {
        if (this.settings.playbackSettings.loop.value) {
          this.currentTimeIndex = 0;
        } else {
          // Stop at end
          this.currentTimeIndex = totalFrames - 1;
          this.pause();
          return;
        }
      }
      this.renderFrame();
      this.syncControlsToFrame();
    }, intervalMs);
  }

  /** Stop the play interval without changing isPlaying state. */
  private stopInterval(): void {
    if (this.playIntervalId !== null) {
      clearInterval(this.playIntervalId);
      this.playIntervalId = null;
    }
  }

  /** Synchronize scrub slider, frame counter, and play/pause icon to current frame. */
  private syncControlsToFrame(): void {
    const totalFrames = this.raceData.timePeriods.length;
    if (this.scrubSlider) {
      this.scrubSlider.value = String(this.currentTimeIndex);
    }
    if (this.frameCounter) {
      this.frameCounter.textContent = `${this.currentTimeIndex + 1}/${totalFrames}`;
    }
  }

  /** Update the play/pause button icon to reflect current state. */
  private updatePlayPauseIcon(): void {
    if (!this.playPauseBtn) return;
    if (this.isPlaying) {
      this.playPauseBtn.textContent = '\u23F8';
      this.playPauseBtn.title = 'Pause';
      this.playPauseBtn.setAttribute('aria-label', 'Pause');
    } else {
      this.playPauseBtn.textContent = '\u25B6';
      this.playPauseBtn.title = 'Play';
      this.playPauseBtn.setAttribute('aria-label', 'Play');
    }
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

  // ── Cleanup ───────────────────────────────────────────────────────

  private cleanup(): void {
    // Cancel animations
    for (const cancel of this.cancelFns) {
      cancel();
    }
    this.cancelFns = [];

    // Clear auto-play interval
    this.stopInterval();
    this.isPlaying = false;
  }

  private clearContainer(): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    this.viewport = null;
    this.timeLabel = null;
    this.controlsBar = null;
    this.playPauseBtn = null;
    this.scrubSlider = null;
    this.speedSelect = null;
    this.frameCounter = null;
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
