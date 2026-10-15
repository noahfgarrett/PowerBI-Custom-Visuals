/**
 * Waffle Chart — Power BI IVisual implementation.
 * 10x10 grid (configurable) that fills cells to represent a percentage,
 * with rippleFill wave animation and countUp percentage display.
 */

import powerbi from 'powerbi-visuals-api';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { WaffleChartSettings } from './settings';
import {
  rippleFill,
  countUp,
  fadeSlideIn,
  applyCardStyle,
  type CardStyleMode,
  renderChartTitle,
  renderLegend,
  getHostChartColor,
  resolveColorTheme,
  buildConditionalConfig,
  resolveConditionalColor,
  resolveDropdown,
  applyChartAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
  allowInteractions,
  applyBasicHighContrastStyles,
  getHostHighContrastColors,
  getLocalizedString,
  getVisualEmptyStateMode,
  notifyRenderingFailed,
  notifyRenderingFinished,
  notifyRenderingStarted,
  syncCardStyleVisibility,
  syncLegendFormattingVisibility,
  syncTitleFormattingVisibility,
  formatWithSettings,
  attachEmptySpaceContextMenu,
  type LegendItem,
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import '../style/visual.less';

// ── Pictogram SVG icon paths ────────────────────────────────────────
// All paths are designed for a 100x100 viewBox.

const PICTOGRAM_ICON_PATHS: Record<string, string> = {
  circle:
    'M 50 5 A 45 45 0 1 0 50 95 A 45 45 0 1 0 50 5 Z',
  person:
    'M 50 10 A 15 15 0 1 0 50 40 A 15 15 0 1 0 50 10 Z ' +
    'M 25 50 Q 25 42 50 42 Q 75 42 75 50 L 75 80 Q 75 90 50 90 Q 25 90 25 80 Z',
  star:
    'M 50 5 L 61 38 L 97 38 L 68 60 L 79 93 L 50 72 L 21 93 L 32 60 L 3 38 L 39 38 Z',
  heart:
    'M 50 88 C 20 65 5 50 5 35 C 5 20 18 8 32 8 C 40 8 47 13 50 20 ' +
    'C 53 13 60 8 68 8 C 82 8 95 20 95 35 C 95 50 80 65 50 88 Z',
  square:
    'M 12 5 L 88 5 Q 95 5 95 12 L 95 88 Q 95 95 88 95 L 12 95 Q 5 95 5 88 L 5 12 Q 5 5 12 5 Z',
  checkmark:
    'M 15 50 L 40 75 L 85 20 L 78 13 L 40 58 L 22 43 Z',
};

type PictogramIconShape = 'circle' | 'person' | 'star' | 'heart' | 'square' | 'checkmark';

// ── Data interface ───────────────────────────────────────────────────

interface WaffleChartData {
  value: number | null;
  maxValue: number;
  percentage: number;
  selectionId: powerbi.visuals.ISelectionId | null;
  /** Whether cross-highlight data is present from another visual/slicer */
  hasHighlights: boolean;
  /** Whether the value is highlighted (non-null highlight on the measure) */
  valueHighlighted: boolean;
}

// ── Visual class ─────────────────────────────────────────────────────

export class WaffleChartVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: WaffleChartSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];
  private currentWaffleData: WaffleChartData | null = null;
  private emptyStateMode: 'unconfigured' | 'noData' = 'unconfigured';
  private detachContextMenu: () => void;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new WaffleChartSettings();
    this.formattingSettingsService = new FormattingSettingsService(options.host.createLocalizationManager());
    this.container.classList.add('waffle-container');
    this.detachContextMenu = attachEmptySpaceContextMenu(
      this.container,
      this.selectionManager,
      () => this.host.createSelectionIdBuilder().createSelectionId(),
      () => allowInteractions(this.host),
    );
  }

  public update(options: VisualUpdateOptions): void {
    notifyRenderingStarted(this.host, options);
    try {
    // Cancel any running animations
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    this.emptyStateMode = getVisualEmptyStateMode(dataView);
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        WaffleChartSettings,
        dataView
      );
    }

    // Migrate legacy enableGlass -> cardStyleMode (backward compat)
    const legacyCardObj = dataView?.metadata?.objects?.['cardSettings'];
    const legacyGlass = legacyCardObj?.['enableGlass'];
    if (legacyCardObj?.['cardStyleMode'] === undefined && legacyGlass === false) {
      this.settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
    }
    syncTitleFormattingVisibility(this.settings.titleFormattingCard);
    syncLegendFormattingVisibility(this.settings.legendFormattingCard);

    this.settings.dataLabelFormattingCard.visible = false;
    this.settings.dateFilterFormattingCard.visible = false;
    this.settings.legendFormattingCard.showInlineLabels.visible = false;
    this.settings.legendFormattingCard.inlineLabelFontSize.visible = false;
    this.settings.legendFormattingCard.inlineLabelOffset.visible = false;

    const conditionalEnabled = this.settings.conditionalFormattingCard.enableConditional.value;
    this.settings.conditionalFormattingCard.conditionalDirection.visible = conditionalEnabled;
    this.settings.conditionalFormattingCard.threshold1.visible = conditionalEnabled;
    this.settings.conditionalFormattingCard.threshold2.visible = conditionalEnabled;
    this.settings.conditionalFormattingCard.conditionalColor1.visible = conditionalEnabled;
    this.settings.conditionalFormattingCard.conditionalColor2.visible = conditionalEnabled;
    this.settings.conditionalFormattingCard.conditionalColor3.visible = conditionalEnabled;

    // Conditional visibility: hide pictogram sub-settings when pictogram is off
    const pictoOn = this.settings.pictogramSettings.enabled.value;
    const iconSet = resolveDropdown(this.settings.pictogramSettings.iconSet) ?? 'default';
    this.settings.pictogramSettings.iconShape.visible = pictoOn && iconSet === 'default';
    this.settings.pictogramSettings.iconSet.visible = pictoOn;
    this.settings.pictogramSettings.iconSize.visible = pictoOn;
    this.settings.pictogramSettings.outlineOpacity.visible = pictoOn;
    this.settings.gridSettings.rows.visible = !this.settings.gridSettings.autoFitCells.value;
    this.settings.gridSettings.cols.visible = !this.settings.gridSettings.autoFitCells.value;
    const shape = resolveDropdown(this.settings.gridSettings.shape) ?? 'square';
    this.settings.gridSettings.shape.visible = !pictoOn;
    this.settings.gridSettings.cellCornerRadius.visible = !pictoOn && shape === 'square';
    this.settings.colorSettings.cellStrokeColor.visible = !pictoOn;

    // Hide animation duration when animations are disabled
    this.settings.animationSettings.duration.visible = this.settings.animationSettings.enabled.value;

    syncCardStyleVisibility(this.settings.cardSettings);

    // Hide value display sub-settings when show is off
    this.settings.valueSettings.fontSize.visible = this.settings.valueSettings.show.value;
    this.settings.valueSettings.displayMode.visible = this.settings.valueSettings.show.value;
    this.settings.valueSettings.fontColor.visible = this.settings.valueSettings.show.value;
    this.settings.valueSettings.fontFamily.visible = this.settings.valueSettings.show.value;
    this.settings.valueSettings.fontWeight.visible = this.settings.valueSettings.show.value;
    this.settings.valueSettings.valueSpacing.visible = this.settings.valueSettings.show.value;

    // Extract data
    const data = this.extractData(dataView);
    this.currentWaffleData = data;

    this.render(data, options.viewport);
    notifyRenderingFinished(this.host, options);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      notifyRenderingFailed(this.host, options, reason);
      while (this.container.firstChild) this.container.removeChild(this.container.firstChild);
      const message = document.createElement('div');
      message.className = 'waffle-empty';
      message.textContent = getLocalizedString(this.host, 'WaffleChart_RenderError', 'Unable to render the waffle chart.');
      this.container.appendChild(message);
    }
  }

  private extractData(dataView: DataView | undefined): WaffleChartData {
    const result: WaffleChartData = {
      value: null,
      maxValue: 100,
      percentage: 0,
      selectionId: null,
      hasHighlights: false,
      valueHighlighted: false,
    };

    if (!dataView?.categorical) return result;

    const categorical = dataView.categorical;

    const values = categorical.values;

    if (!values) return result;

    for (const col of values) {
      const role = col.source.roles;
      if (!role) continue;

      if (role['measure'] && col.values.length > 0) {
        const lastVal = col.values[col.values.length - 1];
        result.value = typeof lastVal === 'number' ? lastVal : null;

        // Cross-highlight detection
        const hlRaw = col.highlights as unknown[] | undefined;
        if (hlRaw) {
          // Power BI sends an all-null highlight array when the measure does
          // not match the active cross-highlight. Presence is the signal.
          result.hasHighlights = true;
          // Check if the last value's highlight is non-null
          if (hlRaw.length > 0) {
            const lastHl = hlRaw[hlRaw.length - 1];
            result.valueHighlighted = lastHl !== null && lastHl !== undefined;
          }
        }

        result.selectionId = this.host.createSelectionIdBuilder()
          .withMeasure(col.source.queryName ?? '')
          .createSelectionId();
      }

      if (role['maxValue'] && col.values.length > 0) {
        const lastVal = col.values[col.values.length - 1];
        if (typeof lastVal === 'number' && lastVal > 0) {
          result.maxValue = lastVal;
        }
      }
    }

    // Calculate percentage, clamped to 0-100
    if (result.value !== null && result.maxValue > 0) {
      result.percentage = Math.max(0, Math.min(100, (result.value / result.maxValue) * 100));
    }

    return result;
  }

  private render(data: WaffleChartData, viewport: powerbi.IViewport): void {
    this.hideTooltip();
    // Clear container (no innerHTML)
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);

    const s = this.settings;
    const highContrast = getHostHighContrastColors(this.host);
    const interactionsEnabled = allowInteractions(this.host);
    const rows = clampInteger(s.gridSettings.rows.value, 1, 50);
    const cols = clampInteger(s.gridSettings.cols.value, 1, 50);
    const gap = Math.max(0, s.gridSettings.gap.value);
    const shapeValue = s.gridSettings.shape.value?.value ?? 'square';
    const cellStrokeColor = highContrast.enabled
      ? highContrast.foreground
      : s.colorSettings.cellStrokeColor.value?.value;
    const cellCornerRadius = s.gridSettings.cellCornerRadius.value;
    // emptyColor: use Colors card (canonical), no longer duplicated in Grid
    const themeName = resolveColorTheme(s.colorThemeFormattingCard);
    const userFillColor = s.colorSettings.fillColor.value?.value;
    const baseFillColor = (userFillColor && userFillColor.length > 0) ? userFillColor : getHostChartColor(this.host.colorPalette, 0, themeName);
    const conditionalColor = !highContrast.enabled && data.value !== null
      ? this.getConditionalColor(data.value)
      : undefined;
    const fillColor = highContrast.enabled
      ? highContrast.foregroundSelected
      : conditionalColor ?? baseFillColor;
    const emptyColor = highContrast.enabled
      ? highContrast.background
      : s.colorSettings.emptyColor.value?.value || '#E2E8F0';
    const showValue = s.valueSettings.show.value;
    const fontSize = s.valueSettings.fontSize.value;
    const fontColor = highContrast.enabled
      ? highContrast.foreground
      : s.valueSettings.fontColor.value?.value;
    const valueSpacing = Math.max(0, s.valueSettings.valueSpacing.value);
    const animEnabled = s.animationSettings.enabled.value && !prefersReducedMotion();
    const animDuration = Math.max(0, s.animationSettings.duration.value);

    // Pictogram settings
    const pictogramEnabled = s.pictogramSettings.enabled.value;
    const iconShapeRaw = s.pictogramSettings.iconShape.value?.value ?? 'person';
    const iconShape: PictogramIconShape =
      iconShapeRaw in PICTOGRAM_ICON_PATHS ? (iconShapeRaw as PictogramIconShape) : 'person';
    const iconSizePct = Math.max(10, Math.min(100, s.pictogramSettings.iconSize.value)) / 100;
    const outlineOpacity = Math.max(0, Math.min(100, s.pictogramSettings.outlineOpacity.value)) / 100;

    // Icon Set (merged from Icon Library into Pictogram) — maps sets to shape overrides
    const iconSetRaw = s.pictogramSettings.iconSet.value;
    const iconSetValue: string = (typeof iconSetRaw === 'string'
      ? iconSetRaw
      : (iconSetRaw as { value?: string } | undefined)?.value) ?? 'default';
    // Map icon set names to pictogram shapes when pictogram is enabled
    const iconSetShapeMap: Record<string, PictogramIconShape> = {
      default: iconShape, // use user's own choice
      weather: 'star',
      arrows: 'checkmark',
      shapes: 'square',
      status: 'circle',
    };
    const effectiveIconShape: PictogramIconShape = pictogramEnabled
      ? (iconSetValue !== 'default' ? (iconSetShapeMap[iconSetValue] ?? iconShape) : iconShape)
      : iconShape;

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
    this.container.style.position = 'relative';
    if (highContrast.enabled) {
      this.container.style.background = highContrast.background;
      this.container.style.boxShadow = 'none';
      this.container.style.border = `1px solid ${highContrast.foreground}`;
      this.container.style.color = highContrast.foreground;
    }

    if (data.value === null) {
      const empty = document.createElement('div');
      empty.className = 'waffle-empty';
      empty.setAttribute('role', 'status');
      empty.textContent = this.emptyStateMode === 'noData'
        ? getLocalizedString(this.host, 'WaffleChart_NoDataState', 'No data for the current selection.')
        : getLocalizedString(this.host, 'WaffleChart_EmptyState', 'Add a value to build a waffle chart.');
      this.container.appendChild(empty);
      applyBasicHighContrastStyles(this.container, highContrast);
      return;
    }

    // Wrapper
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    wrapper.style.gap = `${valueSpacing}px`;
    wrapper.style.width = '100%';
    wrapper.style.flex = '1 1 auto';
    wrapper.style.minHeight = '0';
    wrapper.style.boxSizing = 'border-box';

    // Fill direction setting (merged from Layout into Grid)
    const fillDirRaw = s.gridSettings.fillDirection.value;
    const fillDirection: string = (typeof fillDirRaw === 'string'
      ? fillDirRaw
      : (fillDirRaw as { value?: string } | undefined)?.value) ?? 'bt';

    // Auto-fit cells: override rows/cols to fill viewport (merged from Layout into Grid)
    const autoFitCells = s.gridSettings.autoFitCells.value;

    // Calculate cell size
    const padding = Math.max(0, s.gridSettings.chartPadding.value + contentPadding);
    const valueAreaHeight = showValue ? Math.ceil(fontSize * 1.2) : 0;
    const effectiveValueSpacing = showValue ? valueSpacing : 0;
    const headingHeight = Array.from(this.container.querySelectorAll<HTMLElement>('.chart-title, .chart-subtitle'))
      .reduce((total, element) => total + element.offsetHeight, 0);
    const legendPosition = this.getLegendPosition();
    const showLegend = s.legendFormattingCard.showLegend.value;
    const legendHeight = showLegend && (legendPosition === 'top' || legendPosition === 'bottom')
      ? Math.max(20, s.legendFormattingCard.legendFontSize.value + 12)
      : 0;
    const legendWidth = showLegend && (legendPosition === 'left' || legendPosition === 'right')
      ? Math.min(120, Math.max(0, viewport.width * 0.3))
      : 0;
    if (legendPosition === 'left') wrapper.style.paddingLeft = `${legendWidth}px`;
    if (legendPosition === 'right') wrapper.style.paddingRight = `${legendWidth}px`;
    const availW = Math.max(1, viewport.width - padding * 2 - legendWidth);
    const availH = Math.max(
      1,
      viewport.height - padding * 2 - headingHeight - legendHeight - valueAreaHeight - effectiveValueSpacing,
    );

    let effectiveRows = rows;
    let effectiveCols = cols;

    if (autoFitCells) {
      // Auto-compute: target cell size ~20px, compute how many fit
      const targetCellSize = 20;
      effectiveCols = clampInteger(Math.floor((availW + gap) / (targetCellSize + gap)), 1, 50);
      effectiveRows = clampInteger(Math.floor((availH + gap) / (targetCellSize + gap)), 1, 50);
    }

    const cellSize = Math.max(
      1,
      Math.floor(
        Math.min(
          (availW - (effectiveCols - 1) * gap) / effectiveCols,
          (availH - (effectiveRows - 1) * gap) / effectiveRows
        )
      )
    );

    // Background click clears selection
    this.container.removeEventListener('click', this.handleBackgroundClick);
    if (interactionsEnabled) this.container.addEventListener('click', this.handleBackgroundClick);

    // Grid container
    const grid = document.createElement('div');
    grid.className = 'waffle-grid';
    grid.style.gridTemplateColumns = `repeat(${effectiveCols}, ${cellSize}px)`;
    grid.style.gap = `${gap}px`;
    grid.setAttribute('role', 'group');
    grid.setAttribute(
      'aria-label',
      `${formatPercentValue(data.percentage, this.getHostLocale())}% filled`,
    );
    const onMouseEnter = (event: MouseEvent): void => { this.showWaffleTooltip(data, event); };
    const onMouseMove = (event: MouseEvent): void => { this.moveTooltip(event); };
    const onMouseLeave = (): void => { this.hideTooltip(); };
    grid.addEventListener('mouseenter', onMouseEnter);
    grid.addEventListener('mousemove', onMouseMove);
    grid.addEventListener('mouseleave', onMouseLeave);
    this.cancelAnimations.push(() => {
      grid.removeEventListener('mouseenter', onMouseEnter);
      grid.removeEventListener('mousemove', onMouseMove);
      grid.removeEventListener('mouseleave', onMouseLeave);
    });

    // Calculate filled cells
    const totalCells = effectiveRows * effectiveCols;
    const filledCells = Math.round((data.percentage / 100) * totalCells);

    // Build cells — fill order depends on fillDirection setting
    // Compute a fill index for each (gridRow, gridCol) based on direction
    const computeFillIndex = (gridRow: number, gridCol: number): number => {
      switch (fillDirection) {
        case 'lr':
          // Left to right, top to bottom
          return gridRow * effectiveCols + gridCol;
        case 'bt':
        default:
          // Bottom to top, left to right (default)
          return (effectiveRows - 1 - gridRow) * effectiveCols + gridCol;
        case 'diagonal':
          // Diagonal fill: sum of row+col determines fill order
          return (gridRow + gridCol) * (effectiveRows + effectiveCols) / 2 + gridCol;
        case 'radial': {
          // Radial: distance from center determines fill order
          const centerRow = (effectiveRows - 1) / 2;
          const centerCol = (effectiveCols - 1) / 2;
          const dist = Math.sqrt((gridRow - centerRow) ** 2 + (gridCol - centerCol) ** 2);
          // Invert so center fills first
          const maxDist = Math.sqrt(centerRow ** 2 + centerCol ** 2);
          if (maxDist === 0) return 0;
          return Math.round(dist / maxDist * totalCells);
        }
      }
    };

    // For diagonal and radial, we need to rank cells by computed index
    // Build a sorted mapping
    type CellInfo = { gridRow: number; gridCol: number; rawIndex: number };
    const allCellInfos: CellInfo[] = [];
    for (let r = 0; r < effectiveRows; r++) {
      for (let c = 0; c < effectiveCols; c++) {
        allCellInfos.push({ gridRow: r, gridCol: c, rawIndex: computeFillIndex(r, c) });
      }
    }
    // Sort by rawIndex to assign rank
    const sorted = [...allCellInfos].sort((a, b) => a.rawIndex - b.rawIndex);
    const rankMap = new Map<string, number>();
    sorted.forEach((cell, rank) => {
      rankMap.set(`${cell.gridRow},${cell.gridCol}`, rank);
    });

    const filledElements: HTMLElement[] = [];

    for (let gridRow = 0; gridRow < effectiveRows; gridRow++) {
      for (let gridCol = 0; gridCol < effectiveCols; gridCol++) {
        const fillRank = rankMap.get(`${gridRow},${gridCol}`) ?? 0;
        const isFilled = fillRank < filledCells;

        if (pictogramEnabled) {
          // Pictogram mode: render SVG icon per cell
          const cellEl = this.createPictogramCell(
            cellSize,
            effectiveIconShape,
            iconSizePct,
            isFilled,
            fillColor,
            emptyColor,
            outlineOpacity
          );
          if (isFilled && data.selectionId && interactionsEnabled) {
            cellEl.style.cursor = 'pointer';
            const sid = data.selectionId;
            cellEl.addEventListener('click', (event: MouseEvent) => {
              event.stopPropagation();
              void this.selectionManager.select(sid, event.ctrlKey || event.metaKey);
            });
            cellEl.addEventListener('contextmenu', (event: MouseEvent) => {
              event.preventDefault();
              event.stopPropagation();
              void this.selectionManager.showContextMenu(sid, {
                x: event.clientX,
                y: event.clientY,
              });
            });
          }
          grid.appendChild(cellEl);

          if (isFilled) {
            filledElements.push(cellEl);
          }
        } else {
          // Standard mode: render colored div per cell
          const cell = document.createElement('div');
          cell.className = 'waffle-cell';
          cell.style.width = `${cellSize}px`;
          cell.style.height = `${cellSize}px`;
          cell.style.backgroundColor = isFilled ? fillColor : emptyColor;

          if (cellStrokeColor) {
            cell.style.border = `1px solid ${cellStrokeColor}`;
          }

          if (shapeValue === 'circle') {
            cell.style.borderRadius = '50%';
          } else if (cellCornerRadius > 0) {
            cell.style.borderRadius = `${cellCornerRadius}px`;
          }

          if (isFilled && data.selectionId && interactionsEnabled) {
            cell.style.cursor = 'pointer';
            const sid = data.selectionId;
            cell.addEventListener('click', (event: MouseEvent) => {
              event.stopPropagation();
              void this.selectionManager.select(sid, event.ctrlKey || event.metaKey);
            });
            cell.addEventListener('contextmenu', (event: MouseEvent) => {
              event.preventDefault();
              event.stopPropagation();
              void this.selectionManager.showContextMenu(sid, {
                x: event.clientX,
                y: event.clientY,
              });
            });
          }

          grid.appendChild(cell);

          if (isFilled) {
            filledElements.push(cell);
          }
        }
      }
    }

    wrapper.appendChild(grid);

    // Value display
    if (showValue) {
      const valueEl = document.createElement('div');
      valueEl.className = 'waffle-value';
      valueEl.style.fontSize = `${fontSize}px`;
      if (fontColor) {
        valueEl.style.color = fontColor;
      }
      const waffleFontFamily = resolveDropdown(s.valueSettings.fontFamily);
      if (waffleFontFamily) valueEl.style.fontFamily = waffleFontFamily;
      const waffleFontWeight = resolveDropdown(s.valueSettings.fontWeight);
      valueEl.style.fontWeight = waffleFontWeight || 'normal';

      const displayMode = resolveDropdown(s.valueSettings.displayMode) ?? 'percentage';
      const formattedValue = this.formatDisplayedValue(data, displayMode);
      if (displayMode === 'percentage' && animEnabled) {
        // Count-up animation
        valueEl.textContent = '0%';
        const cancel = countUp(
          0,
          data.percentage,
          animDuration,
          (v) => {
            valueEl.textContent = `${formatPercentValue(v, this.getHostLocale())}%`;
          },
          () => {
            valueEl.textContent = formattedValue;
          }
        );
        this.cancelAnimations.push(cancel);
      } else {
        valueEl.textContent = formattedValue;
      }

      wrapper.appendChild(valueEl);
    }

    this.container.appendChild(wrapper);

    // Ripple fill animation for filled cells
    // Skip animation when cross-highlighting is active to avoid overwriting dimmed opacity
    if (animEnabled && filledElements.length > 0 && !(data.hasHighlights && !data.valueHighlighted)) {
      // rippleFill expects elements in grid order (row-major from top-left).
      // Our filledElements are already in DOM order (top-left to bottom-right),
      // but rippleFill uses its own row/col math from the element index.
      // We pass the filled elements and let rippleFill stagger from bottom-left.
      //
      // However, rippleFill indexes from 0..N sequentially and computes grid
      // positions from that sequential index. For a correct bottom-left ripple
      // on only the filled cells, we need to map them through the grid.
      //
      // Strategy: pass ALL cells (filled + empty) to compute correct positions,
      // but only animate the filled ones by pre-setting empty cells to visible.

      // Collect all cells in DOM order
      const allCells = Array.from(grid.children) as HTMLElement[];

      // Pre-set all empty cells to fully visible (they don't animate)
      allCells.forEach((cell, i) => {
        const gridRow = Math.floor(i / effectiveCols);
        const gridCol = i % effectiveCols;
        const fillRank3 = rankMap.get(`${gridRow},${gridCol}`) ?? 0;
        if (fillRank3 >= filledCells) {
          // Empty cell — ensure it stays visible
          cell.style.opacity = '1';
          cell.style.transform = 'scale(1)';
        }
      });

      // Animate only filled cells using rippleFill on the full grid
      // to get correct Manhattan distance calculation
      const cancel = rippleFill(allCells, effectiveCols, animDuration, 25, 'bottom-left');

      // Override: after setting up the ripple, immediately finalize empty cells
      // so they don't animate (rippleFill sets opacity:0 and scale:0 on all)
      const frameId = requestAnimationFrame(() => {
        allCells.forEach((cell, i) => {
          const gridRow = Math.floor(i / effectiveCols);
          const gridCol = i % effectiveCols;
          const fillRank2 = rankMap.get(`${gridRow},${gridCol}`) ?? 0;
          if (fillRank2 >= filledCells) {
            cell.style.opacity = '1';
            cell.style.transform = 'scale(1)';
          }
        });
      });

      this.cancelAnimations.push(cancel, () => cancelAnimationFrame(frameId));
    }

    // Entrance animation for the wrapper
    // Skip animation when cross-highlighting is active to avoid overwriting dimmed opacity
    if (animEnabled && !(data.hasHighlights && !data.valueHighlighted)) {
      const cancel = fadeSlideIn(wrapper, 'up', animDuration, 50);
      this.cancelAnimations.push(cancel);
    }

    // ── Cross-Highlight Dimming ──────────────────────────────────
    // If another visual is cross-highlighting and this visual's value is not highlighted,
    // dim all filled cells to 0.3 opacity.
    if (data.hasHighlights && !data.valueHighlighted) {
      for (const el of filledElements) {
        el.style.opacity = '0.3';
      }
    }

    // ── Legend ────────────────────────────────────────────────────
    if (s.legendFormattingCard.showLegend.value) {
      this.renderSharedLegend(fillColor, emptyColor, legendWidth, headingHeight);
    }

    // Accessibility
    this.applyAccessibility(data, grid);

    applyBasicHighContrastStyles(this.container, highContrast, {
      textSelectors: [
        '.chart-title',
        '.chart-subtitle',
        '.waffle-value',
        '.pbi-shared-legend span',
      ],
      strokeSelectors: ['.waffle-cell'],
    });
  }

  // ── Legend Rendering ────────────────────────────────────────

  private renderSharedLegend(
    fillColor: string,
    emptyColor: string,
    reservedWidth: number,
    headingHeight: number,
  ): void {
    const legendFmtCard = this.settings.legendFormattingCard;
    const rawFontColor = legendFmtCard.legendFontColor.value?.value;
    const legendFontColor = rawFontColor != null && rawFontColor.length > 0 ? rawFontColor : '';
    const legendFontSize = legendFmtCard.legendFontSize.value;
    const position = this.getLegendPosition();

    const items: LegendItem[] = [
      { label: 'Filled', color: fillColor },
      { label: 'Empty', color: emptyColor },
    ];

    const rawLegendFontFamily = resolveDropdown(legendFmtCard.legendFontFamily) || undefined;
    const rawLegendFontWeight = resolveDropdown(legendFmtCard.legendFontWeight) || undefined;

    const legend = renderLegend(this.container, {
      items,
      position,
      fontSize: legendFontSize,
      fontColor: legendFontColor,
      fontFamily: rawLegendFontFamily,
      fontWeight: rawLegendFontWeight,
      aliases: legendFmtCard.legendAliases.value,
    });
    if (position === 'left' || position === 'right') {
      legend.style.width = `${reservedWidth}px`;
      legend.style.top = `${headingHeight}px`;
      legend.style.height = `calc(100% - ${headingHeight}px)`;
    }
  }

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

  private applyAccessibility(data: WaffleChartData, grid: HTMLElement): void {
    const acc = this.settings.accessibilityFormattingCard;
    applyChartAria(this.container, {
      chartType: 'waffle chart',
      title: this.settings.titleFormattingCard?.titleText?.value || undefined,
      dataPointCount: 1,
    });
    if (!acc.enableKeyboardNav.value || !allowInteractions(this.host) || !data.selectionId) return;

    ensureFocusRingStyles();
    this.container.setAttribute('role', 'group');
    grid.dataset.selectable = 'true';
    grid.classList.add('pbi-data-point');
    grid.tabIndex = 0;
    const highContrast = getHostHighContrastColors(this.host);
    if (highContrast.enabled) grid.style.outlineColor = highContrast.foregroundSelected;
    grid.setAttribute('role', 'button');
    grid.setAttribute(
      'aria-label',
      `Value ${formatWithSettings(data.value ?? 0, this.settings.numberFormattingCard)}, `
        + `${formatPercentValue(data.percentage, this.getHostLocale())}% of maximum`,
    );
    const cleanup = attachKeyboardNav({
      container: this.container,
      itemSelector: '.waffle-grid[data-selectable="true"]',
      onActivate: () => {
        if (!data.selectionId) return;
        void this.selectionManager.select(data.selectionId, false);
      },
    });
    this.cancelAnimations.push(cleanup);
  }

  private getLegendPosition(): 'top' | 'bottom' | 'left' | 'right' {
    const val = this.settings.legendFormattingCard.legendPosition.value?.value;
    const validPositions = ['bottom', 'top', 'left', 'right'] as const;
    if (typeof val === 'string' && (validPositions as readonly string[]).includes(val)) {
      return val as 'top' | 'bottom' | 'left' | 'right';
    }
    return 'bottom';
  }

  // ── Pictogram Cell Rendering ──────────────────────────────────

  private createPictogramCell(
    cellSize: number,
    iconShape: PictogramIconShape,
    iconSizePct: number,
    isFilled: boolean,
    fillColor: string,
    emptyColor: string,
    outlineOpacity: number
  ): HTMLElement {
    const NS = 'http://www.w3.org/2000/svg';
    const wrapper = document.createElement('div');
    wrapper.className = 'waffle-cell';
    wrapper.style.width = `${cellSize}px`;
    wrapper.style.height = `${cellSize}px`;
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';

    const svgSize = Math.round(cellSize * iconSizePct);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', String(svgSize));
    svg.setAttribute('height', String(svgSize));
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.style.display = 'block';

    const pathData = PICTOGRAM_ICON_PATHS[iconShape];
    const pathEl = document.createElementNS(NS, 'path');
    pathEl.setAttribute('d', pathData);

    if (isFilled) {
      // Solid fill for filled cells
      pathEl.setAttribute('fill', fillColor);
      pathEl.setAttribute('stroke', 'none');
    } else {
      // Outline-only for remaining/unfilled cells
      pathEl.setAttribute('fill', 'none');
      pathEl.setAttribute('stroke', emptyColor);
      pathEl.setAttribute('stroke-width', '4');
      pathEl.style.opacity = String(outlineOpacity);
    }

    svg.appendChild(pathEl);
    wrapper.appendChild(svg);
    return wrapper;
  }

  private handleBackgroundClick = (): void => {
    if (!allowInteractions(this.host)) return;
    void this.selectionManager.clear();
  };

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private showWaffleTooltip(data: WaffleChartData, event: MouseEvent): void {
    const locale = this.getHostLocale();
    const tooltipData: VisualTooltipDataItem[] = [];
    if (data.value !== null) {
      tooltipData.push(
        { displayName: 'Value', value: formatWithSettings(data.value, this.settings.numberFormattingCard) },
        { displayName: 'Max', value: formatWithSettings(data.maxValue, this.settings.numberFormattingCard) },
        { displayName: 'Percent', value: `${formatPercentValue(data.percentage, locale)}%` },
      );
    } else {
      tooltipData.push({ displayName: 'Value', value: 'No value' });
    }

    this.host.tooltipService.show({
      dataItems: tooltipData,
      identities: data.selectionId ? [data.selectionId] : [],
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

  private formatDisplayedValue(
    data: WaffleChartData,
    displayMode: string,
  ): string {
    if (data.value === null) return '--';
    const formattedValue = formatWithSettings(data.value, this.settings.numberFormattingCard);
    if (displayMode === 'value') return formattedValue;
    if (displayMode === 'valueAndMax') {
      return `${formattedValue} / ${formatWithSettings(data.maxValue, this.settings.numberFormattingCard)}`;
    }
    return `${formatPercentValue(data.percentage, this.getHostLocale())}%`;
  }

  public destroy(): void {
    this.hideTooltip();
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.detachContextMenu();
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
  }
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function formatPercentValue(value: number, locale?: string): string {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(value));
}
