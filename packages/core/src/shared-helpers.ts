/**
 * Shared rendering helpers for formatting settings.
 * Used by all visuals to apply axis, grid, data label, and title formatting.
 */

import type { AxisFormattingCard, DataLabelFormattingCard, NumberFormattingCard, ScrollFormattingCard, SortFormattingCard, TitleFormattingCard, ColorThemeFormattingCard } from './shared-settings';
import { formatNumber } from './format';
import type { DisplayUnits } from './format';
import { COLOR_THEMES, type ColorThemeName } from './colors';

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

/**
 * Resolve the user's selected color theme from a ColorThemeFormattingCard.
 * Returns a validated ColorThemeName, defaulting to 'default' for invalid values.
 */
export function resolveColorTheme(card: ColorThemeFormattingCard): ColorThemeName {
  const raw = resolveDropdown(card.colorTheme) ?? 'default';
  return (raw in COLOR_THEMES) ? raw as ColorThemeName : 'default';
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

  const fontFamily = resolveDropdown(settings.titleFontFamily) || "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";
  const textAlign = resolveDropdown(settings.titleAlignment) ?? 'center';

  const el = document.createElement('div');
  el.className = 'chart-title';
  el.textContent = text;
  el.style.fontSize = `${settings.titleFontSize.value}px`;
  el.style.color = resolveColor(settings.titleFontColor, DEFAULT_TITLE_COLOR);
  el.style.textAlign = textAlign;
  el.style.fontWeight = '600';
  el.style.marginBottom = '4px';
  el.style.lineHeight = '1.3';
  el.style.fontFamily = fontFamily;

  container.insertBefore(el, container.firstChild);

  // Render subtitle after the title if provided
  const subtitleText = settings.subtitleText.value;
  if (subtitleText) {
    const sub = document.createElement('div');
    sub.className = 'chart-subtitle';
    sub.textContent = subtitleText;
    sub.style.fontSize = `${settings.subtitleFontSize.value}px`;
    sub.style.color = resolveColor(settings.subtitleFontColor, '#64748B');
    sub.style.fontFamily = fontFamily;
    sub.style.textAlign = textAlign;
    sub.style.fontWeight = '400';
    sub.style.marginBottom = '4px';
    sub.style.lineHeight = '1.3';

    // Insert subtitle right after the title element
    if (el.nextSibling) {
      container.insertBefore(sub, el.nextSibling);
    } else {
      container.appendChild(sub);
    }
  }
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
  const fontFamily = resolveDropdown(settings.dataLabelFontFamily) || undefined;
  const position = resolveDropdown(settings.dataLabelPosition) || 'auto';

  const elements = container.querySelectorAll(selector);
  for (const el of elements) {
    if (el instanceof SVGElement) {
      el.style.setProperty('fill', color);
      el.style.setProperty('font-size', `${size}px`);
      el.style.setProperty('font-weight', weight);
      if (fontFamily) el.style.setProperty('font-family', fontFamily);
      el.setAttribute('data-label-position', position);

      // Apply simple position offsets for SVG text elements
      if (el instanceof SVGTextElement) {
        if (position === 'above') {
          el.setAttribute('dominant-baseline', 'auto');
          el.setAttribute('dy', '-8');
        } else if (position === 'below') {
          el.setAttribute('dominant-baseline', 'hanging');
          el.setAttribute('dy', '8');
        }
      }
    } else if (el instanceof HTMLElement) {
      el.style.color = color;
      el.style.fontSize = `${size}px`;
      el.style.fontWeight = weight;
      if (fontFamily) el.style.fontFamily = fontFamily;
      el.setAttribute('data-label-position', position);
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

  const labelFontFamily = resolveDropdown(settings.axisLabelFontFamily) || '';

  // Style all text elements (axis labels) — covers D3 .tick text AND raw SVG text
  const texts = axisGroup.querySelectorAll<SVGTextElement>('text');
  for (const text of texts) {
    text.style.setProperty('fill', labelColor);
    text.style.setProperty('font-size', `${labelSize}px`);
    if (labelFontFamily) {
      text.style.setProperty('font-family', labelFontFamily);
    }
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
  const gridWidth = settings.gridLineWidth.value;
  const gridOpacityRaw = settings.gridLineOpacity.value;
  // gridLineOpacity is on a 0-100 scale (default 100); convert to 0-1
  const gridOpacity = typeof gridOpacityRaw === 'number' ? String(gridOpacityRaw / 100) : '0.6';

  const lines = gridGroup.querySelectorAll<SVGElement>('line');
  for (const line of lines) {
    line.style.setProperty('stroke', gridColor);
    line.style.setProperty('stroke-dasharray', gridDash);
    line.style.setProperty('stroke-opacity', gridOpacity);
    if (gridWidth > 0) {
      line.style.setProperty('stroke-width', `${gridWidth}`);
    }
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

// ── Shared Legend Renderer ──────────────────────────────────────────

export interface LegendItem {
  label: string;
  color: string;
  /** Optional: if true, this item is currently filtered out (dimmed). */
  filtered?: boolean;
}

export interface LegendConfig {
  items: LegendItem[];
  position: 'top' | 'bottom' | 'left' | 'right';
  fontSize: number;
  fontColor: string;
  /** Called when a legend item is clicked (for click-to-filter). */
  onItemClick?: (item: LegendItem, index: number) => void;
  /** Called when a legend item is hovered (for hover-dim). */
  onItemHover?: (item: LegendItem | null, index: number) => void;
  /** Optional font family override. Falls back to Segoe UI system stack. */
  fontFamily?: string;
}

/**
 * Renders a shared legend with click-to-filter and hover-dim support.
 * Creates an HTML div-based legend (not SVG) for consistent layout across charts.
 * Returns the legend element for positioning within the container.
 */
export function renderLegend(
  container: HTMLElement,
  config: LegendConfig,
): HTMLElement {
  const existing = container.querySelector('.pbi-shared-legend');
  if (existing) existing.remove();

  const legend = document.createElement('div');
  legend.className = 'pbi-shared-legend';

  const isVertical = config.position === 'left' || config.position === 'right';

  legend.style.display = 'flex';
  legend.style.flexDirection = isVertical ? 'column' : 'row';
  legend.style.flexWrap = 'wrap';
  legend.style.gap = isVertical ? '4px' : '12px';
  legend.style.justifyContent = isVertical ? 'flex-start' : 'center';
  legend.style.alignItems = isVertical ? 'flex-start' : 'center';
  legend.style.padding = '4px 8px';
  legend.style.fontSize = `${config.fontSize}px`;
  legend.style.fontFamily = config.fontFamily || "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";
  legend.style.userSelect = 'none';

  for (let i = 0; i < config.items.length; i++) {
    const item = config.items[i];
    const entry = document.createElement('div');
    entry.className = 'pbi-legend-item';
    entry.style.display = 'flex';
    entry.style.alignItems = 'center';
    entry.style.gap = '4px';
    entry.style.cursor = config.onItemClick ? 'pointer' : 'default';
    entry.style.opacity = item.filtered ? '0.35' : '1';
    entry.style.transition = 'opacity 0.2s ease';

    const swatch = document.createElement('span');
    swatch.style.width = '10px';
    swatch.style.height = '10px';
    swatch.style.borderRadius = '2px';
    swatch.style.backgroundColor = item.color;
    swatch.style.flexShrink = '0';

    const label = document.createElement('span');
    label.style.color = config.fontColor || '#64748B';
    label.style.whiteSpace = 'nowrap';
    label.textContent = item.label;

    entry.appendChild(swatch);
    entry.appendChild(label);

    if (config.onItemClick) {
      const idx = i;
      entry.addEventListener('click', () => config.onItemClick!(item, idx));
    }
    if (config.onItemHover) {
      const idx = i;
      entry.addEventListener('mouseenter', () => config.onItemHover!(item, idx));
      entry.addEventListener('mouseleave', () => config.onItemHover!(null, -1));
    }

    legend.appendChild(entry);
  }

  // Insert legend in correct position relative to SVG/chart
  if (config.position === 'top') {
    container.insertBefore(legend, container.firstChild);
  } else if (config.position === 'bottom') {
    container.appendChild(legend);
  } else if (config.position === 'left') {
    legend.style.position = 'absolute';
    legend.style.left = '0';
    legend.style.top = '0';
    legend.style.height = '100%';
    container.insertBefore(legend, container.firstChild);
  } else {
    legend.style.position = 'absolute';
    legend.style.right = '0';
    legend.style.top = '0';
    legend.style.height = '100%';
    container.appendChild(legend);
  }

  return legend;
}

// ── Hover Dim Utility ──────────────────────────────────────────────

export interface HoverDimConfig {
  /** All elements that participate in hover-dim (e.g. bars, lines, arcs). */
  elements: ArrayLike<Element>;
  /** Opacity for non-hovered ("dimmed") elements. Default: 0.2 */
  dimOpacity?: number;
  /** Opacity for the hovered element. Default: 1 */
  activeOpacity?: number;
  /** CSS transition duration for smooth dim. Default: '0.2s' */
  transition?: string;
}

/**
 * Creates hover-dim behavior: when hovering one element, all others dim.
 * Returns a cleanup function to remove all listeners.
 */
export function createHoverDim(config: HoverDimConfig): () => void {
  const { elements, dimOpacity = 0.2, activeOpacity = 1, transition = '0.2s' } = config;

  const cleanups: Array<() => void> = [];

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i] as HTMLElement | SVGElement;

    const onEnter = (): void => {
      for (let j = 0; j < elements.length; j++) {
        const other = elements[j] as HTMLElement | SVGElement;
        other.style.transition = `opacity ${transition} ease`;
        other.style.opacity = j === i ? String(activeOpacity) : String(dimOpacity);
      }
    };

    const onLeave = (): void => {
      for (let j = 0; j < elements.length; j++) {
        const other = elements[j] as HTMLElement | SVGElement;
        other.style.opacity = String(activeOpacity);
      }
    };

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    cleanups.push(() => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
    });
  }

  return () => cleanups.forEach((fn) => fn());
}

// ── Sparkline Renderer ─────────────────────────────────────────────

export interface SparklineConfig {
  /** Values to plot. */
  values: number[];
  /** Width of the sparkline in px. */
  width: number;
  /** Height of the sparkline in px. */
  height: number;
  /** Line color. */
  lineColor: string;
  /** Line width. Default: 1.5 */
  lineWidth?: number;
  /** Fill color under the line (area chart mode). Null = no fill. */
  fillColor?: string;
  /** Fill opacity. Default: 0.15 */
  fillOpacity?: number;
  /** Whether to show a dot at the last value. Default: true */
  showEndDot?: boolean;
  /** End dot color. Defaults to lineColor. */
  endDotColor?: string;
}

/**
 * Renders a mini sparkline as an SVG element.
 * Returns the SVG element for insertion into a container.
 */
export function renderSparkline(config: SparklineConfig): SVGSVGElement {
  const {
    values,
    width,
    height,
    lineColor,
    lineWidth = 1.5,
    fillColor,
    fillOpacity = 0.15,
    showEndDot = true,
    endDotColor,
  } = config;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.style.display = 'block';
  svg.style.overflow = 'visible';

  if (values.length < 2) return svg;

  const padding = 2;
  const plotW = width - padding * 2;
  const plotH = height - padding * 2;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((v, i) => ({
    x: padding + (i / (values.length - 1)) * plotW,
    y: padding + plotH - ((v - min) / range) * plotH,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // Area fill
  if (fillColor) {
    const areaD = `${pathD} L${points[points.length - 1].x.toFixed(1)},${height} L${points[0].x.toFixed(1)},${height} Z`;
    const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    area.setAttribute('d', areaD);
    area.setAttribute('fill', fillColor);
    area.setAttribute('opacity', String(fillOpacity));
    svg.appendChild(area);
  }

  // Line
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  line.setAttribute('d', pathD);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', lineColor);
  line.setAttribute('stroke-width', String(lineWidth));
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(line);

  // End dot
  if (showEndDot && points.length > 0) {
    const last = points[points.length - 1];
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', String(last.x));
    dot.setAttribute('cy', String(last.y));
    dot.setAttribute('r', '2.5');
    dot.setAttribute('fill', endDotColor ?? lineColor);
    svg.appendChild(dot);
  }

  return svg;
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
  /** Padding between categories (px). Factored into the density check and expanded size. */
  categoryPadding?: number;
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
export function ensureScrollStyles(): void {
  if (document.getElementById(SCROLL_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SCROLL_STYLE_ID;
  style.textContent = `
    .${SCROLL_WRAPPER_CLASS} {
      scroll-behavior: smooth;
      scrollbar-width: thin;
    }
    .${SCROLL_WRAPPER_CLASS} > svg {
      width: auto !important;
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
  const padding = options.categoryPadding ?? 0;

  const isHorizontal = direction === 'horizontal';
  const availableSize = isHorizontal ? availableChartWidth : availableChartHeight;
  const requiredSize = categoryCount * minWidth + Math.max(0, categoryCount - 1) * padding;
  const needsScroll = enabled && categoryCount > 0 && requiredSize > availableSize;

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

  const expandedSize = requiredSize;

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
