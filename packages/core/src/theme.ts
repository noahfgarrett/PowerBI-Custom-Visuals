/**
 * Theme engine.
 * In Power BI: reads IVisualHost.colorPalette and merges with user overrides.
 * In preview mode: uses default brand palette.
 */

import { BRAND, SEMANTIC, CHART_PALETTE, type ColorMode } from './colors';

export interface ThemeConfig {
  mode: ColorMode;
  brand: {
    orange: string;
    blue: string;
    navy: string;
  };
  semantic: {
    positive: string;
    negative: string;
    neutral: string;
    warning: string;
  };
  chart: readonly string[];
  text: {
    primary: string;
    secondary: string;
    muted: string;
  };
  surface: {
    background: string;
    card: string;
  };
  fontFamily: string;
}

/** Default light theme. */
export const LIGHT_THEME: ThemeConfig = {
  mode: 'light',
  brand: {
    orange: BRAND.orange,
    blue: BRAND.blue,
    navy: BRAND.navy,
  },
  semantic: { ...SEMANTIC },
  chart: CHART_PALETTE,
  text: {
    primary: '#0F172A',
    secondary: '#475569',
    muted: '#94A3B8',
  },
  surface: {
    background: 'transparent',
    card: 'rgba(255, 255, 255, 0.70)',
  },
  fontFamily:
    "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
};

/** Default dark theme. */
export const DARK_THEME: ThemeConfig = {
  mode: 'dark',
  brand: {
    orange: BRAND.orange,
    blue: BRAND.blue,
    navy: BRAND.navy,
  },
  semantic: { ...SEMANTIC },
  chart: CHART_PALETTE,
  text: {
    primary: '#F1F5F9',
    secondary: '#CBD5E1',
    muted: '#64748B',
  },
  surface: {
    background: 'transparent',
    card: 'rgba(15, 23, 42, 0.60)',
  },
  fontFamily:
    "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
};

/**
 * Returns the theme config for the given mode.
 */
export function getTheme(mode: ColorMode): ThemeConfig {
  return mode === 'light' ? { ...LIGHT_THEME } : { ...DARK_THEME };
}

/**
 * Creates a theme with user overrides merged on top of the base.
 */
export function createTheme(
  mode: ColorMode,
  overrides?: Partial<ThemeConfig>
): ThemeConfig {
  const base = getTheme(mode);
  if (!overrides) return base;

  return {
    ...base,
    ...overrides,
    brand: { ...base.brand, ...overrides.brand },
    semantic: { ...base.semantic, ...overrides.semantic },
    text: { ...base.text, ...overrides.text },
    surface: { ...base.surface, ...overrides.surface },
  };
}
