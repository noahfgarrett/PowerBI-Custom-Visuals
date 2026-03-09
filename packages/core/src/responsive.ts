/**
 * Responsive breakpoint detection for Power BI tile resizing.
 * Each visual uses these breakpoints to decide what to show/hide.
 */

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg';

export interface Dimensions {
  width: number;
  height: number;
}

/** Width-based breakpoint thresholds (px). */
const WIDTH_THRESHOLDS: Record<Breakpoint, number> = {
  xs: 0,
  sm: 150,
  md: 300,
  lg: 500,
};

/**
 * Returns the current breakpoint based on container dimensions.
 * Primarily width-driven since PBI tiles are usually wider than tall.
 */
export function getBreakpoint(dimensions: Dimensions): Breakpoint {
  const { width } = dimensions;

  if (width >= WIDTH_THRESHOLDS.lg) return 'lg';
  if (width >= WIDTH_THRESHOLDS.md) return 'md';
  if (width >= WIDTH_THRESHOLDS.sm) return 'sm';
  return 'xs';
}

/**
 * Returns true if the current breakpoint is at least the given minimum.
 * Useful for conditional rendering: `if (isAtLeast(bp, 'md')) showLabels()`
 */
export function isAtLeast(current: Breakpoint, minimum: Breakpoint): boolean {
  const order: Breakpoint[] = ['xs', 'sm', 'md', 'lg'];
  return order.indexOf(current) >= order.indexOf(minimum);
}

/**
 * Calculates appropriate font size based on container dimensions.
 * Returns a clamped value between min and max.
 */
export function responsiveFontSize(
  dimensions: Dimensions,
  options: { min: number; max: number; scale?: number } = { min: 10, max: 48 }
): number {
  const { min, max, scale = 0.08 } = options;
  const baseFontSize = Math.min(dimensions.width, dimensions.height) * scale;
  return Math.max(min, Math.min(max, baseFontSize));
}

/**
 * Returns appropriate padding based on breakpoint.
 */
export function responsivePadding(breakpoint: Breakpoint): number {
  const paddings: Record<Breakpoint, number> = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
  };
  return paddings[breakpoint];
}

// ── Role-Aware Typography ───────────────────────────────────────────

export type TypographyRole = 'title' | 'subtitle' | 'label' | 'value' | 'caption';

/** Base font sizes for each typography role at the 'lg' breakpoint. */
const ROLE_BASE_SIZES: Record<TypographyRole, number> = {
  title: 16,
  subtitle: 13,
  label: 11,
  value: 14,
  caption: 9,
};

/** Scale factors for each breakpoint relative to 'lg'. */
const BREAKPOINT_SCALES: Record<Breakpoint, number> = {
  xs: 0.7,
  sm: 0.8,
  md: 0.9,
  lg: 1.0,
};

/**
 * Returns a role-aware responsive font size based on container dimensions.
 * Different text roles (title, label, value, caption) scale proportionally
 * but maintain hierarchy at all breakpoints.
 */
export function responsiveTypography(
  dimensions: Dimensions,
  role: TypographyRole,
): number {
  const bp = getBreakpoint(dimensions);
  const base = ROLE_BASE_SIZES[role];
  const scale = BREAKPOINT_SCALES[bp];
  return Math.round(base * scale);
}

/**
 * Returns whether labels should be shown at the current dimensions.
 * At very small sizes, labels are hidden to avoid clutter.
 *
 * @param dimensions - Container dimensions.
 * @param minWidth   - Minimum width to show labels (default: 120px).
 * @param minHeight  - Minimum height to show labels (default: 80px).
 */
export function shouldShowLabels(
  dimensions: Dimensions,
  minWidth = 120,
  minHeight = 80,
): boolean {
  return dimensions.width >= minWidth && dimensions.height >= minHeight;
}

/**
 * Truncates text to fit within a given pixel width, adding an ellipsis.
 * Uses a simple character-width estimate (not pixel-perfect but fast and GC-free).
 *
 * @param text     - The text to truncate.
 * @param maxWidth - Maximum width in pixels.
 * @param fontSize - Font size in pixels (for estimating character width).
 * @returns The truncated text with ellipsis if needed, or the original text.
 */
export function truncateText(
  text: string,
  maxWidth: number,
  fontSize: number,
): string {
  if (!text) return '';
  // Estimate: average character width ≈ 0.55 × fontSize for proportional fonts
  const avgCharWidth = fontSize * 0.55;
  const maxChars = Math.floor(maxWidth / avgCharWidth);

  if (text.length <= maxChars) return text;
  if (maxChars <= 3) return text.slice(0, 1) + '…';
  return text.slice(0, maxChars - 1) + '…';
}
