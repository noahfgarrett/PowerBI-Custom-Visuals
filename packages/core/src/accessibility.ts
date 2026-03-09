/**
 * Shared accessibility utilities for all Power BI custom visuals.
 * Provides ARIA labels, keyboard navigation, high-contrast detection, and focus rings.
 */

// ── High Contrast Detection ──────────────────────────────────────────

export type ContrastMode = 'none' | 'high-contrast-light' | 'high-contrast-dark';

/**
 * Detects whether the user has high-contrast mode enabled via OS/browser settings.
 * Uses the `forced-colors` media query (widely supported) with a `prefers-contrast` fallback.
 */
export function detectContrastMode(): ContrastMode {
  if (typeof window === 'undefined' || !window.matchMedia) return 'none';

  const forcedColors = window.matchMedia('(forced-colors: active)');
  if (!forcedColors.matches) return 'none';

  // Determine light vs dark by checking the background color
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)');
  return prefersLight.matches ? 'high-contrast-light' : 'high-contrast-dark';
}

/**
 * Returns an accessible color palette for high-contrast modes.
 * Falls back to the provided default palette when not in high contrast.
 */
export function getAccessiblePalette(
  mode: ContrastMode,
  defaultPalette: readonly string[],
): readonly string[] {
  if (mode === 'none') return defaultPalette;

  // High-contrast palettes use maximally distinct, system-safe colors
  if (mode === 'high-contrast-light') {
    return [
      '#000000', '#0000FF', '#008000', '#FF0000',
      '#800080', '#008080', '#800000', '#000080',
    ];
  }

  // high-contrast-dark
  return [
    '#FFFFFF', '#FFFF00', '#00FFFF', '#FF00FF',
    '#00FF00', '#FF8000', '#FF0000', '#80FF80',
  ];
}

// ── ARIA Labels ──────────────────────────────────────────────────────

export interface ChartAriaConfig {
  /** Chart type name (e.g. "bar chart", "line chart"). */
  chartType: string;
  /** Chart title if available. */
  title?: string;
  /** Number of data points. */
  dataPointCount: number;
  /** Summary description (e.g. "Revenue by Region, 5 categories"). */
  summary?: string;
}

/**
 * Applies ARIA attributes to a chart container for screen readers.
 */
export function applyChartAria(
  container: HTMLElement,
  config: ChartAriaConfig,
  verbose?: boolean,
): void {
  container.setAttribute('role', 'img');

  const parts: string[] = [];
  if (verbose) parts.push('Interactive chart.');
  if (config.title) parts.push(config.title);
  parts.push(`${config.chartType} with ${config.dataPointCount} data points`);
  if (config.summary) parts.push(config.summary);
  if (verbose) parts.push('Use arrow keys to navigate data points.');

  container.setAttribute('aria-label', parts.join(' '));
}

/**
 * Applies ARIA attributes to individual data point elements.
 * Elements become focusable (tabindex=0) for keyboard navigation.
 */
export function applyDataPointAria(
  element: Element,
  label: string,
  value: string,
  index: number,
  total: number,
): void {
  element.setAttribute('role', 'listitem');
  element.setAttribute(
    'aria-label',
    `${label}: ${value}. Item ${index + 1} of ${total}.`,
  );
  element.setAttribute('tabindex', '0');
}

// ── Keyboard Navigation ──────────────────────────────────────────────

export interface KeyboardNavConfig {
  /** Container element that holds navigable items. */
  container: HTMLElement;
  /** Selector for focusable data point elements. */
  itemSelector: string;
  /** Called when an item receives focus via keyboard. */
  onFocus?: (element: Element, index: number) => void;
  /** Called when an item is activated (Enter/Space). */
  onActivate?: (element: Element, index: number) => void;
  /** Whether navigation wraps around at boundaries. */
  wrap?: boolean;
}

/**
 * Attaches keyboard navigation (arrow keys, Enter, Escape) to chart data points.
 * Returns a cleanup function to remove event listeners.
 */
export function attachKeyboardNav(config: KeyboardNavConfig): () => void {
  const { container, itemSelector, onFocus, onActivate, wrap = true } = config;

  function getItems(): Element[] {
    return Array.from(container.querySelectorAll(itemSelector));
  }

  function handleKeyDown(event: KeyboardEvent): void {
    const items = getItems();
    if (items.length === 0) return;

    const active = document.activeElement;
    const currentIndex = active ? items.indexOf(active) : -1;

    let nextIndex = -1;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        if (currentIndex < 0) {
          nextIndex = 0;
        } else if (currentIndex < items.length - 1) {
          nextIndex = currentIndex + 1;
        } else if (wrap) {
          nextIndex = 0;
        }
        break;

      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        if (currentIndex < 0) {
          nextIndex = items.length - 1;
        } else if (currentIndex > 0) {
          nextIndex = currentIndex - 1;
        } else if (wrap) {
          nextIndex = items.length - 1;
        }
        break;

      case 'Home':
        event.preventDefault();
        nextIndex = 0;
        break;

      case 'End':
        event.preventDefault();
        nextIndex = items.length - 1;
        break;

      case 'Enter':
      case ' ':
        event.preventDefault();
        if (currentIndex >= 0) {
          onActivate?.(items[currentIndex], currentIndex);
        }
        return;

      case 'Escape':
        (active as HTMLElement)?.blur?.();
        return;

      default:
        return;
    }

    if (nextIndex >= 0 && nextIndex < items.length) {
      const el = items[nextIndex] as HTMLElement;
      el.focus();
      onFocus?.(el, nextIndex);
    }
  }

  container.addEventListener('keydown', handleKeyDown);

  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

// ── Focus Ring Styles ────────────────────────────────────────────────

const FOCUS_STYLE_ID = 'pbi-accessibility-focus-styles';

/**
 * Injects focus-visible ring styles into the document head.
 * Uses :focus-visible to only show rings for keyboard navigation, not mouse clicks.
 */
export function ensureFocusRingStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(FOCUS_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = FOCUS_STYLE_ID;
  style.textContent = `
    [role="listitem"]:focus-visible,
    .pbi-data-point:focus-visible {
      outline: 2px solid #3B82F6;
      outline-offset: 2px;
      z-index: 10;
    }
    [role="listitem"]:focus:not(:focus-visible),
    .pbi-data-point:focus:not(:focus-visible) {
      outline: none;
    }
  `;
  document.head.appendChild(style);
}
