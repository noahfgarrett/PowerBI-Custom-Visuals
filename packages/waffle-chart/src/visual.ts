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
  getGlassStyle,
  renderChartTitle,
  applyDataLabelFormatting,
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
}

// ── Visual class ─────────────────────────────────────────────────────

export class WaffleChartVisual implements IVisual {
  private host: IVisualHost;
  private container: HTMLElement;
  private settings: WaffleChartSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.container = options.element;
    this.settings = new WaffleChartSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('waffle-container');
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel any running animations
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        WaffleChartSettings,
        dataView
      );
    }

    // Extract data
    const data = this.extractData(dataView);

    this.notifyRenderStarted();
    try {
      this.render(data, options.viewport);
      this.notifyRenderFinished();
    } catch (error) {
      this.notifyRenderFailed(error);
      throw error;
    }
  }

  private extractData(dataView: DataView | undefined): WaffleChartData {
    const result: WaffleChartData = {
      value: null,
      maxValue: 100,
      percentage: 0,
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
    // Clear container (no innerHTML)
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);

    const s = this.settings;
    const rows = Math.max(1, s.gridSettings.rows.value);
    const cols = Math.max(1, s.gridSettings.cols.value);
    const gap = Math.max(0, s.gridSettings.gap.value);
    const shapeValue = s.gridSettings.shape.value?.value ?? 'square';
    const cellStrokeColor = s.gridSettings.cellStrokeColor.value?.value;
    const cellCornerRadius = s.gridSettings.cellCornerRadius.value;
    const fillColor = s.colorSettings.fillColor.value?.value ?? '#3B82F6';
    const emptyColor = s.gridSettings.emptyColor.value?.value || s.colorSettings.emptyColor.value?.value || '#E2E8F0';
    const showValue = s.valueSettings.show.value;
    const fontSize = s.valueSettings.fontSize.value;
    const fontColor = s.valueSettings.fontColor.value?.value;
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;

    // Pictogram settings
    const pictogramEnabled = s.pictogramSettings.enabled.value;
    const iconShapeRaw = s.pictogramSettings.iconShape.value?.value ?? 'person';
    const iconShape: PictogramIconShape =
      iconShapeRaw in PICTOGRAM_ICON_PATHS ? (iconShapeRaw as PictogramIconShape) : 'person';
    const iconSizePct = Math.max(80, Math.min(100, s.pictogramSettings.iconSize.value)) / 100;
    const outlineOpacity = Math.max(0, Math.min(100, s.pictogramSettings.outlineOpacity.value)) / 100;

    // Apply glass effect if enabled
    if (s.cardSettings.enableGlass.value) {
      const glass = getGlassStyle({
        mode: 'light',
        opacity: s.cardSettings.backgroundOpacity.value / 100,
        backgroundColor: ((s.cardSettings as any).backgroundColor?.value?.value ?? (s.cardSettings as any).bgColor?.value?.value),
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

    // Wrapper
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';

    // Calculate cell size
    const padding = 12;
    const valueAreaHeight = showValue ? 50 : 0;
    const availW = viewport.width - padding * 2;
    const availH = viewport.height - padding * 2 - valueAreaHeight;
    const cellSize = Math.max(
      4,
      Math.floor(
        Math.min(
          (availW - (cols - 1) * gap) / cols,
          (availH - (rows - 1) * gap) / rows
        )
      )
    );

    // Grid container
    const grid = document.createElement('div');
    grid.className = 'waffle-grid';
    grid.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
    grid.style.gap = `${gap}px`;
    grid.addEventListener('mouseenter', (event) => this.showWaffleTooltip(data, event));
    grid.addEventListener('mousemove', (event) => this.moveTooltip(event));
    grid.addEventListener('mouseleave', () => this.hideTooltip());

    // Calculate filled cells
    const totalCells = rows * cols;
    const filledCells = Math.round((data.percentage / 100) * totalCells);

    // Build cells — fill order: bottom-left to top-right
    // Logical index 0 = bottom-left corner, fills left-to-right then bottom-to-top
    // Grid DOM order is top-left to bottom-right (row 0 = top)
    // So for each DOM cell at (gridRow, gridCol), compute its fill index:
    //   fillIndex = (rows - 1 - gridRow) * cols + gridCol
    // Then: isFilled = fillIndex < filledCells

    const filledElements: HTMLElement[] = [];

    for (let gridRow = 0; gridRow < rows; gridRow++) {
      for (let gridCol = 0; gridCol < cols; gridCol++) {
        const fillIndex = (rows - 1 - gridRow) * cols + gridCol;
        const isFilled = fillIndex < filledCells;

        if (pictogramEnabled) {
          // Pictogram mode: render SVG icon per cell
          const cellEl = this.createPictogramCell(
            cellSize,
            iconShape,
            iconSizePct,
            isFilled,
            fillColor,
            emptyColor,
            outlineOpacity
          );
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

          grid.appendChild(cell);

          if (isFilled) {
            filledElements.push(cell);
          }
        }
      }
    }

    wrapper.appendChild(grid);

    // Percentage display
    if (showValue) {
      const valueEl = document.createElement('div');
      valueEl.className = 'waffle-value';
      valueEl.style.fontSize = `${fontSize}px`;
      if (fontColor) {
        valueEl.style.color = fontColor;
      }

      if (data.value !== null && animEnabled) {
        // Count-up animation
        valueEl.textContent = '0%';
        const cancel = countUp(
          0,
          data.percentage,
          animDuration,
          (v) => {
            valueEl.textContent = `${Math.round(v)}%`;
          },
          () => {
            valueEl.textContent = `${Math.round(data.percentage)}%`;
          }
        );
        this.cancelAnimations.push(cancel);
      } else {
        valueEl.textContent = data.value !== null
          ? `${Math.round(data.percentage)}%`
          : '--';
      }

      wrapper.appendChild(valueEl);
    }

    this.container.appendChild(wrapper);

    // Ripple fill animation for filled cells
    if (animEnabled && filledElements.length > 0) {
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
        const gridRow = Math.floor(i / cols);
        const gridCol = i % cols;
        const fillIndex = (rows - 1 - gridRow) * cols + gridCol;
        if (fillIndex >= filledCells) {
          // Empty cell — ensure it stays visible
          cell.style.opacity = '1';
          cell.style.transform = 'scale(1)';
        }
      });

      // Animate only filled cells using rippleFill on the full grid
      // to get correct Manhattan distance calculation
      const cancel = rippleFill(allCells, cols, animDuration, 25, 'bottom-left');

      // Override: after setting up the ripple, immediately finalize empty cells
      // so they don't animate (rippleFill sets opacity:0 and scale:0 on all)
      requestAnimationFrame(() => {
        allCells.forEach((cell, i) => {
          const gridRow = Math.floor(i / cols);
          const gridCol = i % cols;
          const fillIndex = (rows - 1 - gridRow) * cols + gridCol;
          if (fillIndex >= filledCells) {
            cell.style.opacity = '1';
            cell.style.transform = 'scale(1)';
          }
        });
      });

      this.cancelAnimations.push(cancel);
    }

    // Entrance animation for the wrapper
    if (animEnabled) {
      const cancel = fadeSlideIn(wrapper, 'up', animDuration, 50);
      this.cancelAnimations.push(cancel);
    }

    // ── Legend ────────────────────────────────────────────────────
    if (s.legendFormattingCard.showLegend.value) {
      this.renderLegend(fillColor, emptyColor);
    }

    // Apply shared formatting settings
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.waffle-value');

  }

  // ── Legend Rendering ────────────────────────────────────────

  private renderLegend(fillColor: string, emptyColor: string): void {
    const legendFmtCard = this.settings.legendFormattingCard;
    const rawFontColor = legendFmtCard.legendFontColor.value?.value;
    const legendFontColor = rawFontColor != null && rawFontColor.length > 0 ? rawFontColor : '';
    const legendFontSize = legendFmtCard.legendFontSize.value;
    const position = this.getLegendPosition();

    const legendDiv = document.createElement('div');
    legendDiv.style.display = 'flex';
    legendDiv.style.flexWrap = 'wrap';
    legendDiv.style.gap = '12px';
    legendDiv.style.padding = '6px 0';
    legendDiv.style.justifyContent = 'center';

    if (position === 'left' || position === 'right') {
      legendDiv.style.flexDirection = 'column';
      legendDiv.style.justifyContent = 'flex-start';
    }

    const items = [
      { name: 'Filled', color: fillColor },
      { name: 'Empty', color: emptyColor },
    ];

    items.forEach((item) => {
      const itemEl = document.createElement('div');
      itemEl.style.display = 'flex';
      itemEl.style.alignItems = 'center';
      itemEl.style.gap = '5px';

      const swatch = document.createElement('div');
      swatch.style.width = '10px';
      swatch.style.height = '10px';
      swatch.style.borderRadius = '2px';
      swatch.style.backgroundColor = item.color;
      swatch.style.flexShrink = '0';

      const label = document.createElement('span');
      label.textContent = item.name;
      if (legendFontColor.length > 0) label.style.color = legendFontColor;
      if (legendFontSize !== 11) label.style.fontSize = `${legendFontSize}px`;

      itemEl.appendChild(swatch);
      itemEl.appendChild(label);
      legendDiv.appendChild(itemEl);
    });

    if (position === 'top') {
      // Insert after title but before wrapper
      const wrapper = this.container.querySelector('.waffle-container > div');
      if (wrapper) {
        this.container.insertBefore(legendDiv, wrapper);
      } else {
        this.container.appendChild(legendDiv);
      }
    } else {
      this.container.appendChild(legendDiv);
    }
  }

  private getLegendPosition(): string {
    const val = this.settings.legendFormattingCard.legendPosition.value?.value;
    const validPositions = ['bottom', 'top', 'left', 'right'];
    if (typeof val === 'string' && validPositions.includes(val)) {
      return val;
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

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private showWaffleTooltip(data: WaffleChartData, event: MouseEvent): void {
    const locale = this.getHostLocale();
    const tooltipData: VisualTooltipDataItem[] = [];
    if (data.value !== null) {
      tooltipData.push(
        { displayName: 'Value', value: formatPercentValue(data.value, locale) },
        { displayName: 'Max', value: formatPercentValue(data.maxValue, locale) },
        { displayName: 'Percent', value: `${Math.round(data.percentage)}%` },
      );
    } else {
      tooltipData.push({ displayName: 'Value', value: 'No value' });
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

  public destroy(): void {
    this.hideTooltip();
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
  }
}

function formatPercentValue(value: number, locale?: string): string {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(value));
}
