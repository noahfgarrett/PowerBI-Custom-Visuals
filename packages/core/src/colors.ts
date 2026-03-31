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
  ocean: [
    '#2563EB', // vivid blue
    '#60A5FA', // bright sky
    '#93C5FD', // light powder
    '#3B82F6', // true blue
    '#7CB9F7', // clean sky
    '#BFDBFE', // soft pastel
    '#1D4ED8', // bold cobalt
    '#6DAFFA', // open water
    '#A5C8FC', // baby blue
    '#2E72E8', // electric blue
    '#85BDF8', // clear horizon
    '#D0E4FE', // ice blue
    '#4B8DF3', // ocean mid
    '#74B4F9', // daylight blue
    '#9EC3FC', // cloud blue
    '#3478F0', // punchy blue
    '#5A9BF6', // lagoon
    '#B3D4FD', // whisper blue
    '#2268E5', // deep swim
    '#68AAF8', // reef bright
    '#88BEF9', // bay shimmer
    '#4186F2', // sailing blue
    '#A8CDFC', // morning sky
    '#538FF4', // wave blue
  ],
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

// ── HSL helpers ──────────────────────────────────────────────────────

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (v: number): string => {
    const hex = Math.round(v * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Generates N visually distinct variations of a base color.
 * Spreads across lightness (30%–85%) and slightly varies saturation,
 * producing a range from vibrant/dark to light pastel.
 */
export function generateColorVariations(baseHex: string, count: number): string[] {
  if (count <= 0) return [];
  const [h, s] = hexToHsl(baseHex);
  if (count === 1) return [baseHex];

  const variations: string[] = [];
  // Lightness range from rich/dark to light pastel
  const lMin = 0.30;
  const lMax = 0.82;
  // Saturation varies: darker shades get full sat, lighter get softer
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const l = lMin + t * (lMax - lMin);
    // Saturation: taper from full down to ~45% at the pastel end
    const sMod = s * (1 - t * 0.55);
    // Tiny hue jitter (±3%) to add life without leaving the color family
    const hJitter = ((i % 3) - 1) * 0.008;
    const hFinal = ((h + hJitter) % 1 + 1) % 1;
    variations.push(hslToHex(hFinal, Math.max(0.2, sMod), l));
  }

  // Shuffle deterministically so adjacent nodes aren't just a gradient
  // Fisher-Yates with a fixed seed derived from the hue
  const seed = Math.round(h * 10000);
  let rng = seed;
  const next = (): number => {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff;
    return rng / 0x7fffffff;
  };
  for (let i = variations.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [variations[i], variations[j]] = [variations[j], variations[i]];
  }

  return variations;
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
