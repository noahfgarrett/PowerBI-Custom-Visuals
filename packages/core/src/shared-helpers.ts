/**
 * Shared rendering helpers for formatting settings.
 * Used by all visuals to apply axis, grid, data label, and title formatting.
 */

import type { AxisFormattingCard, DataLabelFormattingCard, NumberFormattingCard, ScrollFormattingCard, SortFormattingCard, TitleFormattingCard } from './shared-settings';
import { formatNumber } from './format';
import type { DisplayUnits } from './format';

// ── Default colors (used when user hasn't picked a color) ────────────

const DEFAULT_LABEL_COLOR = '#64748B';
const DEFAULT_DATA_LABEL_COLOR = '#475569';
const DEFAULT_AXIS_LINE_COLOR = '#CBD5E1';
const DEFAULT_GRID_LINE_COLOR = '#E2E8F0';
const DEFAULT_TITLE_COLOR = '#0F172A';

// ── Helpers ──────────────────────────────────────────────────────────

/** Resolve a ColorPicker value — returns the user's pick or a fallback. */
function resolveColor(
  picker: { value?: { value?: string } } | undefined,
  fallback: string,
): string {
  const v = picker?.value?.value;
  return v && v.length > 0 ? v : fallback;
}

/** Resolve an ItemDropdown value to its inner string value. */
export function resolveDropdown(
  dropdown: { value?: unknown } | undefined,
): string | undefined {
  const val = dropdown?.value;
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object' && 'value' in val) {
    return (val as { value?: string }).value;
  }
  return undefined;
}

/** Convert a grid/line style dropdown value to an SVG stroke-dasharray. */
function toDashArray(style: string | undefined): string {
  switch (style) {
    case 'dashed':
      return '4 3';
    case 'dotted':
      return '2 2';
    default:
      return 'none';
  }
}

// ── Chart Title ──────────────────────────────────────────────────────

/**
 * Renders an optional chart title as the first child of the container.
 * Call at the top of update() after clearing.
 */
export function renderChartTitle(
  container: HTMLElement,
  settings: TitleFormattingCard,
): void {
  if (!settings.showTitle.value) return;
  const text = settings.titleText.value;
  if (!text) return;

  const el = document.createElement('div');
  el.className = 'chart-title';
  el.textContent = text;
  el.style.fontSize = `${settings.titleFontSize.value}px`;
  el.style.color = resolveColor(settings.titleFontColor, DEFAULT_TITLE_COLOR);
  el.style.textAlign = resolveDropdown(settings.titleAlignment) ?? 'center';
  el.style.fontWeight = '600';
  el.style.marginBottom = '4px';
  el.style.lineHeight = '1.3';
  el.style.fontFamily = "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";

  container.insertBefore(el, container.firstChild);
}

// ── Data Label Formatting ───────────────────────────────────────────

/**
 * Applies data label font color, size, and weight to elements matching `selector`.
 * Works with both SVG <text> elements (uses fill/font-size attrs) and
 * HTML elements (uses style.color/fontSize).
 *
 * Call after all labels are rendered.
 *
 * @param container - The visual's root container element.
 * @param settings  - DataLabelFormattingCard instance.
 * @param selector  - CSS selector for the label elements (e.g. '.waterfall-value').
 */
export function applyDataLabelFormatting(
  container: HTMLElement,
  settings: DataLabelFormattingCard,
  selector: string,
): void {
  const color = resolveColor(settings.dataLabelFontColor, DEFAULT_DATA_LABEL_COLOR);
  const size = settings.dataLabelFontSize.value;
  const weight = resolveDropdown(settings.dataLabelFontWeight) ?? 'normal';

  const elements = container.querySelectorAll(selector);
  for (const el of elements) {
    if (el instanceof SVGElement) {
      el.style.setProperty('fill', color);
      el.style.setProperty('font-size', `${size}px`);
      el.style.setProperty('font-weight', weight);
    } else if (el instanceof HTMLElement) {
      el.style.color = color;
      el.style.fontSize = `${size}px`;
      el.style.fontWeight = weight;
    }
  }
}

// ── Axis Formatting ─────────────────────────────────────────────────

/**
 * Applies axis label color, size, and line styling to an axis <g> group.
 * Works with both D3 axes (.tick > text, .domain) and raw SVG (direct text/line children).
 *
 * @param axisGroup - The SVGGElement containing axis elements.
 * @param settings  - AxisFormattingCard instance.
 */
export function applyAxisFormatting(
  axisGroup: SVGGElement,
  settings: AxisFormattingCard,
): void {
  const labelColor = resolveColor(settings.axisLabelColor, DEFAULT_LABEL_COLOR);
  const labelSize = settings.axisLabelSize.value;
  const lineColor = resolveColor(settings.axisLineColor, DEFAULT_AXIS_LINE_COLOR);
  const lineWidth = settings.axisLineWidth.value;

  // Style all text elements (axis labels) — covers D3 .tick text AND raw SVG text
  const texts = axisGroup.querySelectorAll<SVGTextElement>('text');
  for (const text of texts) {
    text.style.setProperty('fill', labelColor);
    text.style.setProperty('font-size', `${labelSize}px`);
  }

  // Style axis lines and domain path — covers D3 .domain + .tick line AND raw SVG line
  const lines = axisGroup.querySelectorAll<SVGElement>('line, .domain');
  for (const line of lines) {
    line.style.setProperty('stroke', lineColor);
    line.style.setProperty('stroke-width', `${lineWidth}`);
  }
}

// ── Grid Formatting ─────────────────────────────────────────────────

/**
 * Applies grid line color, style, and visibility.
 * Works with both D3 grid groups (containing .tick line) and raw SVG groups.
 *
 * @param gridGroup - The SVGGElement containing grid lines.
 * @param settings  - AxisFormattingCard instance.
 */
export function applyGridFormatting(
  gridGroup: SVGGElement,
  settings: AxisFormattingCard,
): void {
  if (!settings.showGridLines.value) {
    gridGroup.style.display = 'none';
    return;
  }

  gridGroup.style.display = '';

  const gridColor = resolveColor(settings.gridLineColor, DEFAULT_GRID_LINE_COLOR);
  const gridDash = toDashArray(resolveDropdown(settings.gridLineStyle));

  const lines = gridGroup.querySelectorAll<SVGElement>('line');
  for (const line of lines) {
    line.style.setProperty('stroke', gridColor);
    line.style.setProperty('stroke-dasharray', gridDash);
    line.style.setProperty('stroke-opacity', '0.6');
  }
}

// ── Container-Level Convenience ─────────────────────────────────────

/**
 * Applies axis + grid formatting to ALL matching groups in a container.
 * Convenience wrapper that finds SVG elements by selector and applies formatting.
 *
 * @param container     - The visual's root container element.
 * @param settings      - AxisFormattingCard instance.
 * @param axisSelector  - CSS selector for axis groups (e.g. '.waterfall-axis').
 * @param gridSelector  - CSS selector for grid groups (e.g. '.waterfall-grid'). Optional.
 */
export function applyAllAxisFormatting(
  container: HTMLElement,
  settings: AxisFormattingCard,
  axisSelector: string,
  gridSelector?: string,
): void {
  const svg = container.querySelector('svg');
  if (!svg) return;

  svg.querySelectorAll<SVGGElement>(axisSelector).forEach((el) => {
    applyAxisFormatting(el, settings);
  });

  if (gridSelector) {
    svg.querySelectorAll<SVGGElement>(gridSelector).forEach((el) => {
      applyGridFormatting(el, settings);
    });
  }
}

// ── Sort Order Helper ───────────────────────────────────────────────

/** A sortable item with a name and a numeric value. */
export interface SortableItem {
  name: string;
  value: number;
}

/**
 * Applies the user's sort order to an array of items.
 * Returns a new sorted array (does not mutate the original).
 *
 * @param items    - The array of items to sort. Each must have `name` and `value`.
 * @param settings - SortFormattingCard instance.
 * @returns A new array in the requested sort order.
 */
export function applySortOrder<T extends SortableItem>(
  items: T[],
  settings: SortFormattingCard,
): T[] {
  const sortBy = resolveDropdown(settings.sortBy) ?? 'dataOrder';

  if (sortBy === 'dataOrder') return items;

  const sorted = [...items];
  switch (sortBy) {
    case 'valueAsc':
      sorted.sort((a, b) => a.value - b.value);
      break;
    case 'valueDesc':
      sorted.sort((a, b) => b.value - a.value);
      break;
    case 'nameAsc':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'nameDesc':
      sorted.sort((a, b) => b.name.localeCompare(a.name));
      break;
  }

  return sorted;
}

// ── Number Format Helper ────────────────────────────────────────────

/**
 * Formats a number using the user's NumberFormattingCard settings.
 * Reads displayUnits, decimalPlaces, prefix, and suffix from the card.
 *
 * @param value    - The number to format.
 * @param settings - NumberFormattingCard instance.
 * @returns The formatted string (e.g. "$1.2M", "42K%").
 */
export function formatWithSettings(
  value: number | null | undefined,
  settings: NumberFormattingCard,
): string {
  const units = resolveDropdown(settings.displayUnits) as DisplayUnits | undefined;
  const decimals = settings.decimalPlaces.value;
  const prefix = settings.valuePrefix.value ?? '';
  const suffix = settings.valueSuffix.value ?? '';

  return formatNumber(value, {
    displayUnits: units ?? 'auto',
    decimals: decimals >= 0 ? decimals : undefined, // -1 = auto
    prefix,
    suffix,
    abbreviate: true,
  });
}

// ── Scrollable Chart Helper ─────────────────────────────────────────

export interface ScrollableChartOptions {
  container: HTMLElement;
  viewportWidth: number;
  viewportHeight: number;
  categoryCount: number;
  scrollSettings: ScrollFormattingCard;
  availableChartWidth: number;
  availableChartHeight: number;
  direction: 'horizontal' | 'vertical';
}

export interface ScrollableChartResult {
  svgParent: HTMLElement;
  svgWidth: number;
  svgHeight: number;
  chartWidth: number;
  chartHeight: number;
  isScrolling: boolean;
}

/** CSS class name for the scroll wrapper (used to detect duplicates). */
const SCROLL_WRAPPER_CLASS = 'pbi-scroll-wrapper';

/** Unique ID to ensure scrollbar styles are injected only once. */
const SCROLL_STYLE_ID = 'pbi-scroll-styles';

/**
 * Injects thin-scrollbar CSS into `document.head` if not already present.
 */
function ensureScrollStyles(): void {
  if (document.getElementById(SCROLL_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SCROLL_STYLE_ID;
  style.textContent = `
    .${SCROLL_WRAPPER_CLASS} {
      scroll-behavior: smooth;
      scrollbar-width: thin;
    }
    .${SCROLL_WRAPPER_CLASS}::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    .${SCROLL_WRAPPER_CLASS}::-webkit-scrollbar-track {
      background: transparent;
    }
    .${SCROLL_WRAPPER_CLASS}::-webkit-scrollbar-thumb {
      background: rgba(148, 163, 184, 0.4);
      border-radius: 3px;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Creates a scrollable wrapper around a chart when categories exceed available
 * space at the configured minimum width per category.
 *
 * If scroll is not needed (few categories or disabled), returns the container
 * as-is with the original dimensions — zero overhead.
 */
export function createScrollableChart(options: ScrollableChartOptions): ScrollableChartResult {
  const {
    container,
    viewportWidth,
    viewportHeight,
    categoryCount,
    scrollSettings,
    availableChartWidth,
    availableChartHeight,
    direction,
  } = options;

  const enabled = scrollSettings.enableScroll.value;
  const minWidth = scrollSettings.minCategoryWidth.value;

  const isHorizontal = direction === 'horizontal';
  const availableSize = isHorizontal ? availableChartWidth : availableChartHeight;
  const needsScroll = enabled && categoryCount > 0 && (availableSize / categoryCount) < minWidth;

  if (!needsScroll) {
    return {
      svgParent: container,
      svgWidth: viewportWidth,
      svgHeight: viewportHeight,
      chartWidth: availableChartWidth,
      chartHeight: availableChartHeight,
      isScrolling: false,
    };
  }

  ensureScrollStyles();

  const expandedSize = categoryCount * minWidth;

  const wrapper = document.createElement('div');
  wrapper.className = SCROLL_WRAPPER_CLASS;

  if (isHorizontal) {
    wrapper.style.overflowX = 'auto';
    wrapper.style.overflowY = 'hidden';
    wrapper.style.width = '100%';
    wrapper.style.height = `${viewportHeight}px`;

    const expandedSvgWidth = viewportWidth - availableChartWidth + expandedSize;

    container.appendChild(wrapper);

    return {
      svgParent: wrapper,
      svgWidth: expandedSvgWidth,
      svgHeight: viewportHeight,
      chartWidth: expandedSize,
      chartHeight: availableChartHeight,
      isScrolling: true,
    };
  }

  // Vertical scroll
  wrapper.style.overflowX = 'hidden';
  wrapper.style.overflowY = 'auto';
  wrapper.style.width = `${viewportWidth}px`;
  wrapper.style.height = '100%';

  const expandedSvgHeight = viewportHeight - availableChartHeight + expandedSize;

  container.appendChild(wrapper);

  return {
    svgParent: wrapper,
    svgWidth: viewportWidth,
    svgHeight: expandedSvgHeight,
    chartWidth: availableChartWidth,
    chartHeight: expandedSize,
    isScrolling: true,
  };
}
