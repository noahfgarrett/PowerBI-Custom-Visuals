/**
 * Heatmap Calendar — Power BI IVisual implementation.
 * GitHub-style calendar heatmap with rippleFill wave animation.
 */

import powerbi from 'powerbi-visuals-api';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { HeatmapCalendarSettings } from './settings';
import {
  rippleFill,
  fadeSlideIn,
  DURATION,
  formatNumber,
  getGlassStyle,
  renderChartTitle,
  applyDataLabelFormatting,
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import ISelectionId = powerbi.visuals.ISelectionId;

import '../style/visual.less';

// ── Types ────────────────────────────────────────────────────────────

interface CalendarDatum {
  date: Date;
  value: number;
  selectionId: ISelectionId;
}

// ── Constants ────────────────────────────────────────────────────────

const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Visual ───────────────────────────────────────────────────────────

export class HeatmapCalendarVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: HeatmapCalendarSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new HeatmapCalendarSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('heatmap-container');
  }

  public update(options: VisualUpdateOptions): void {
    this.cancelAllAnimations();

    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        HeatmapCalendarSettings,
        dataView,
      );
    }

    const data = this.extractData(dataView);
    this.applyCardStyle();

    if (data.length === 0) {
      this.renderEmpty();
    } else {
      this.render(data);
    }
  }

  // ── Data Extraction ──────────────────────────────────────────────

  private extractData(dataView: DataView | undefined): CalendarDatum[] {
    if (!dataView?.categorical) return [];

    const categorical = dataView.categorical;
    const categoryColumn = categorical.categories?.[0];
    const valuesColumn = categorical.values?.[0];

    if (!categoryColumn || !valuesColumn) return [];

    const result: CalendarDatum[] = [];

    for (let i = 0; i < categoryColumn.values.length; i++) {
      const rawDate = categoryColumn.values[i];
      const rawVal = valuesColumn.values[i];

      const date = this.parseDate(rawDate);
      if (!date) continue;

      const value = typeof rawVal === 'number' && Number.isFinite(rawVal) ? rawVal : 0;
      const selectionId = this.host.createSelectionIdBuilder()
        .withCategory(categoryColumn, i)
        .createSelectionId();
      result.push({ date, value, selectionId });
    }

    return result;
  }

  private parseDate(raw: unknown): Date | null {
    if (raw instanceof Date) {
      return Number.isNaN(raw.getTime()) ? null : raw;
    }
    if (typeof raw === 'string' || typeof raw === 'number') {
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  // ── Card Style ─────────────────────────────────────────────────

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
    } else {
      this.container.style.background = '';
      this.container.style.backdropFilter = '';
      (this.container.style as unknown as Record<string, string>)['WebkitBackdropFilter'] = '';
      this.container.style.border = '';
      this.container.style.boxShadow = '';
      this.container.style.borderRadius = `${s.borderRadius.value}px`;
    }
  }

  // ── Empty State ────────────────────────────────────────────────

  private renderEmpty(): void {
    this.clearContainer();
    const el = document.createElement('div');
    el.className = 'heatmap-empty';
    el.textContent = 'Add a Date and Measure to get started.';
    this.container.appendChild(el);
  }

  // ── Main Render ────────────────────────────────────────────────

  private render(data: CalendarDatum[]): void {
    this.clearContainer();
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.container.removeEventListener('click', this.handleBackgroundClick);

    const s = this.settings;
    const cellSize = Math.max(4, s.calendarSettings.cellSize.value);
    const cellGap = Math.max(0, s.calendarSettings.cellGap.value);
    const showMonthLabels = s.calendarSettings.showMonthLabels.value;
    const showDayLabels = s.calendarSettings.showDayLabels.value;
    const lowColor = s.colorSettings.lowColor.value?.value ?? '#E2E8F0';
    const highColor = s.colorSettings.highColor.value?.value ?? '#3B82F6';
    const cellStrokeColor = s.calendarSettings.cellStrokeColor.value?.value || '';
    const cellStrokeWidth = s.calendarSettings.cellStrokeWidth.value;
    const cellCornerRadius = s.calendarSettings.cellCornerRadius.value;
    const labelColor = s.calendarSettings.labelColor.value?.value || '';
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;
    const showDataLabels = s.dataLabelFormattingCard.showDataLabels.value;

    // Build date→value map
    const dateMap = new Map<string, number>();
    const selectionMap = new Map<string, ISelectionId>();
    let minVal = Infinity;
    let maxVal = -Infinity;

    for (const d of data) {
      const key = this.dateKey(d.date);
      const existing = dateMap.get(key);
      const val = existing !== undefined ? existing + d.value : d.value;
      dateMap.set(key, val);
      if (!selectionMap.has(key)) {
        selectionMap.set(key, d.selectionId);
      }
      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;
    }

    if (minVal === maxVal) {
      minVal = 0;
      if (maxVal === 0) maxVal = 1;
    }

    // Find year range
    const years = new Set<number>();
    for (const d of data) {
      years.add(d.date.getFullYear());
    }
    const sortedYears = Array.from(years).sort((a, b) => a - b);

    // Parse colors for interpolation
    const lowRgb = this.hexToRgb(lowColor);
    const highRgb = this.hexToRgb(highColor);

    const allCells: HTMLElement[] = [];

    for (const year of sortedYears) {
      // Year label
      const yearLabel = document.createElement('div');
      yearLabel.className = 'heatmap-year-label';
      yearLabel.textContent = String(year);
      this.container.appendChild(yearLabel);

      const gridWrapper = document.createElement('div');
      gridWrapper.className = 'heatmap-grid-wrapper';

      // Day-of-week labels
      if (showDayLabels) {
        const dayCol = document.createElement('div');
        dayCol.className = 'heatmap-day-labels';
        for (const label of DAY_LABELS) {
          const dayEl = document.createElement('div');
          dayEl.style.height = `${cellSize}px`;
          dayEl.style.lineHeight = `${cellSize}px`;
          dayEl.style.marginBottom = `${cellGap}px`;
          dayEl.textContent = label;
          dayCol.appendChild(dayEl);
        }
        gridWrapper.appendChild(dayCol);
      }

      // Build week columns
      const weeksContainer = document.createElement('div');
      weeksContainer.style.display = 'flex';
      weeksContainer.style.gap = `${cellGap}px`;
      weeksContainer.style.position = 'relative';

      // Month labels row
      const monthLabelRow = showMonthLabels ? document.createElement('div') : null;
      if (monthLabelRow) {
        monthLabelRow.style.display = 'flex';
        monthLabelRow.style.gap = `${cellGap}px`;
        monthLabelRow.style.marginBottom = '2px';
      }

      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31);

      // Move start to Monday of the week containing Jan 1
      const startDay = startDate.getDay();
      const mondayOffset = startDay === 0 ? -6 : 1 - startDay;
      const gridStart = new Date(year, 0, 1 + mondayOffset);

      let currentDate = new Date(gridStart);
      let lastMonthLabel = -1;

      while (currentDate <= endDate || currentDate.getDay() !== 1) {
        // Build one week column (7 cells)
        const weekCol = document.createElement('div');
        weekCol.style.display = 'flex';
        weekCol.style.flexDirection = 'column';
        weekCol.style.gap = `${cellGap}px`;

        // Month label for this week
        if (monthLabelRow) {
          const monthLabel = document.createElement('div');
          monthLabel.className = 'heatmap-month-label';
          monthLabel.style.width = `${cellSize}px`;
          monthLabel.style.textAlign = 'center';

          const weekMonth = currentDate.getMonth();
          if (currentDate.getFullYear() === year && weekMonth !== lastMonthLabel && currentDate.getDate() <= 7) {
            monthLabel.textContent = MONTH_NAMES[weekMonth];
            lastMonthLabel = weekMonth;
          }
          monthLabelRow.appendChild(monthLabel);
        }

        for (let dow = 0; dow < 7; dow++) {
          const cell = document.createElement('div');
          cell.className = 'heatmap-cell';
          cell.style.width = `${cellSize}px`;
          cell.style.height = `${cellSize}px`;
          if (cellCornerRadius > 0) {
            cell.style.borderRadius = `${cellCornerRadius}px`;
          }
          if (cellStrokeColor) {
            cell.style.border = `${cellStrokeWidth}px solid ${cellStrokeColor}`;
          }

          if (currentDate.getFullYear() === year) {
            const key = this.dateKey(currentDate);
            const val = dateMap.get(key);

            if (val !== undefined) {
              const t = maxVal !== minVal ? (val - minVal) / (maxVal - minVal) : 0.5;
              const r = Math.round(lowRgb.r + (highRgb.r - lowRgb.r) * t);
              const g = Math.round(lowRgb.g + (highRgb.g - lowRgb.g) * t);
              const b = Math.round(lowRgb.b + (highRgb.b - lowRgb.b) * t);
              cell.style.backgroundColor = `rgb(${r},${g},${b})`;
              cell.title = `${this.formatDateStr(currentDate)}: ${formatNumber(val)}`;
              if (showDataLabels) {
                const labelSpan = document.createElement('span');
                labelSpan.className = 'heatmap-data-label';
                labelSpan.textContent = formatNumber(val);
                cell.appendChild(labelSpan);
              }
              const selectionId = selectionMap.get(key);
              if (selectionId) {
                cell.style.cursor = 'pointer';
                cell.addEventListener('click', (event) => {
                  event.stopPropagation();
                  void this.selectionManager.select(selectionId, event.ctrlKey || event.metaKey);
                });
                cell.addEventListener('contextmenu', (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void this.selectionManager.showContextMenu(selectionId, {
                    x: event.clientX,
                    y: event.clientY,
                  });
                });
              }
            } else {
              cell.style.backgroundColor = lowColor;
              cell.style.opacity = '0.3';
            }
          } else {
            cell.style.backgroundColor = 'transparent';
          }

          weekCol.appendChild(cell);
          allCells.push(cell);

          currentDate = new Date(currentDate.getTime() + 86400000);
        }

        weeksContainer.appendChild(weekCol);

        // Break if we've passed the year
        if (currentDate.getFullYear() > year && currentDate.getDay() === 1) break;
      }

      if (monthLabelRow) {
        this.container.appendChild(monthLabelRow);
      }
      gridWrapper.appendChild(weeksContainer);
      this.container.appendChild(gridWrapper);
    }

    // Animation
    if (animEnabled && allCells.length > 0) {
      // Use rippleFill with 7 columns (days per week) — but our grid is week-based columns
      // We'll use a simple stagger based on column index
      const cols = Math.ceil(allCells.length / 7);
      const cancel = rippleFill(allCells, cols > 0 ? cols : 1, animDuration, 15, 'top-left');
      this.cancelAnimations.push(cancel);
    }
    this.applyAxisLabelFormatting();
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.heatmap-data-label');
    if (labelColor) {
      const labelSelectors = '.heatmap-day-labels, .heatmap-month-label, .heatmap-year-label';
      const labelElements = this.container.querySelectorAll(labelSelectors);
      for (const el of labelElements) {
        if (el instanceof HTMLElement) {
          el.style.color = labelColor;
        }
      }
    }
    this.container.addEventListener('click', this.handleBackgroundClick);
  }

  // ── Axis Label Formatting ─────────────────────────────────────────

  /**
   * Applies axis formatting card settings (label color + font size)
   * to all day-of-week, month, and year label elements.
   * These are HTML elements, not SVG, so we set style.color / style.fontSize directly.
   */
  private applyAxisLabelFormatting(): void {
    const axis = this.settings.axisFormattingCard;
    const rawColor = axis.axisLabelColor.value?.value;
    const color = rawColor && rawColor.length > 0 ? rawColor : '#64748B';
    const size = axis.axisLabelSize.value;

    const selectors = '.heatmap-day-labels, .heatmap-month-label, .heatmap-year-label';
    const elements = this.container.querySelectorAll(selectors);
    for (const el of elements) {
      if (el instanceof HTMLElement) {
        el.style.color = color;
        el.style.fontSize = `${size}px`;
      }
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private dateKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private formatDateStr(d: Date): string {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const clean = hex.replace('#', '');
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }

  // ── Formatting Model ───────────────────────────────────────────

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private handleBackgroundClick = (): void => {
    void this.selectionManager.clear();
  };

  // ── Utilities ──────────────────────────────────────────────────

  private clearContainer(): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }

  private cancelAllAnimations(): void {
    for (const cancel of this.cancelAnimations) {
      cancel();
    }
    this.cancelAnimations = [];
  }

  public destroy(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.cancelAllAnimations();
    this.clearContainer();
  }
}
