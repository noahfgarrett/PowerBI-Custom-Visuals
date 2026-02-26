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
