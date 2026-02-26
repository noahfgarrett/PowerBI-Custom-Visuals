/**
 * Brand palette, chart color scales, semantic colors, and host-palette bridge.
 * Orange is reserved as accent/highlight only in chart data.
 */

export const BRAND = {
  orange: '#F28C38',
  blue: '#3B82F6',
  navy: '#0F172A',
  white: '#FFFFFF',
} as const;

export const SEMANTIC = {
  positive: '#34D399',
  negative: '#F87171',
  neutral: '#94A3B8',
  warning: '#FBBF24',
} as const;

/** Muted chart palette — fallback when host palette is unavailable. */
export const CHART_PALETTE = [
  '#64748B', // slate
  '#7DD3FC', // soft sky blue
  '#94A3B8', // cool gray
  '#5EEAD4', // muted teal
  '#A78BFA', // soft violet
  '#6366F1', // indigo accent
] as const;

/** Extended palette for charts with many series. */
export const CHART_PALETTE_EXTENDED = [
  ...CHART_PALETTE,
  '#FB923C', // soft orange
  '#818CF8', // indigo
  '#2DD4BF', // teal
  '#E879F9', // fuchsia
  '#FCA5A5', // pink-red
  '#A3E635', // lime
] as const;

export type ColorMode = 'light' | 'dark';

/**
 * Returns a chart color from the Power BI host palette, falling back to
 * the built-in extended palette when no host palette is available.
 */
export function getHostChartColor(
  palette: { getColor(key: string): { value: string } } | null | undefined,
  index: number,
): string {
  if (palette) {
    try { return palette.getColor(index.toString()).value; }
    catch { /* fall through to default palette */ }
  }
  return CHART_PALETTE_EXTENDED[index % CHART_PALETTE_EXTENDED.length];
}

/**
 * Returns the chart palette color at a given index, wrapping around.
 * Prefer getHostChartColor() in Power BI visuals for theme-awareness.
 */
export function getChartColor(index: number): string {
  const palette = CHART_PALETTE_EXTENDED;
  return palette[index % palette.length];
}

/**
 * Returns an array of N chart colors, cycling through the palette.
 */
export function getChartColors(count: number): string[] {
  return Array.from({ length: count }, (_, i) => getChartColor(i));
}

/**
 * Returns semantic color for a delta value.
 * positive delta → green, negative → red, zero → neutral gray.
 */
export function getDeltaColor(delta: number): string {
  if (delta > 0) return SEMANTIC.positive;
  if (delta < 0) return SEMANTIC.negative;
  return SEMANTIC.neutral;
}

/**
 * Adjusts a hex color's opacity, returning an rgba string.
 */
export function withOpacity(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
