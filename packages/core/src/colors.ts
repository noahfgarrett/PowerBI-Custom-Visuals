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

/** Named color theme identifier. */
export type ColorThemeName = 'default' | 'ocean' | 'sunset' | 'forest' | 'berry' | 'monochrome' | 'earth';

/** Named color themes — each is a 12-color readonly palette. */
export const COLOR_THEMES: Record<ColorThemeName, readonly string[]> = {
  default: CHART_PALETTE_EXTENDED,
  ocean: ['#0C4A6E', '#0369A1', '#0284C7', '#0EA5E9', '#38BDF8', '#7DD3FC', '#BAE6FD', '#155E75', '#164E63', '#22D3EE', '#67E8F9', '#0891B2'],
  sunset: ['#9A3412', '#C2410C', '#EA580C', '#F97316', '#FB923C', '#FDBA74', '#FDE68A', '#B91C1C', '#DC2626', '#FBBF24', '#F59E0B', '#FCA5A5'],
  forest: ['#14532D', '#166534', '#15803D', '#22C55E', '#4ADE80', '#6B8E23', '#A3B18A', '#3B5249', '#365314', '#84CC16', '#BEF264', '#4D7C0F'],
  berry: ['#701A75', '#86198F', '#A21CAF', '#C026D3', '#D946EF', '#E879F9', '#F0ABFC', '#9D174D', '#BE185D', '#EC4899', '#F9A8D4', '#7C3AED'],
  monochrome: ['#0F172A', '#1E293B', '#334155', '#475569', '#64748B', '#94A3B8', '#CBD5E1', '#F1F5F9', '#020617', '#1E3A5F', '#374151', '#E2E8F0'],
  earth: ['#78350F', '#92400E', '#A16207', '#B45309', '#CA8A04', '#8B7355', '#6B705C', '#A98467', '#451A03', '#D97706', '#B8860B', '#8B6914'],
} as const;

/**
 * Returns a chart color from the Power BI host palette, falling back to
 * the built-in extended palette when no host palette is available.
 * When a non-default theme is specified, the theme palette takes priority.
 */
export function getHostChartColor(
  palette: { getColor(key: string): { value: string } } | null | undefined,
  index: number,
  themeName?: ColorThemeName,
): string {
  if (themeName && themeName !== 'default') {
    const themed = COLOR_THEMES[themeName];
    if (themed) return themed[index % themed.length];
  }
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
export function getChartColor(index: number, themeName?: ColorThemeName): string {
  const pal = (themeName && themeName !== 'default' && COLOR_THEMES[themeName]) ? COLOR_THEMES[themeName] : CHART_PALETTE_EXTENDED;
  return pal[index % pal.length];
}

/**
 * Returns an array of N chart colors, cycling through the palette.
 */
export function getChartColors(count: number, themeName?: ColorThemeName): string[] {
  return Array.from({ length: count }, (_, i) => getChartColor(i, themeName));
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
