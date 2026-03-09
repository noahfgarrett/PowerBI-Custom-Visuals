import { describe, it, expect } from 'vitest';
import {
  COLOR_THEMES,
  getHostChartColor,
  getChartColor,
  getChartColors,
  CHART_PALETTE_EXTENDED,
  type ColorThemeName,
} from '../colors';

describe('COLOR_THEMES', () => {
  const themeNames: ColorThemeName[] = [
    'default', 'ocean', 'sunset', 'forest', 'berry', 'monochrome', 'earth',
  ];

  it('contains all 7 named themes', () => {
    expect(Object.keys(COLOR_THEMES)).toHaveLength(7);
    for (const name of themeNames) {
      expect(COLOR_THEMES[name]).toBeDefined();
    }
  });

  it('each theme has at least 12 colors', () => {
    for (const name of themeNames) {
      expect(COLOR_THEMES[name].length).toBeGreaterThanOrEqual(12);
    }
  });

  it('default theme matches CHART_PALETTE_EXTENDED', () => {
    expect(COLOR_THEMES.default).toBe(CHART_PALETTE_EXTENDED);
  });
});

describe('getHostChartColor with themes', () => {
  it('returns ocean palette color when theme is ocean', () => {
    const color = getHostChartColor(null, 0, 'ocean');
    expect(color).toBe(COLOR_THEMES.ocean[0]);
  });

  it('wraps around the themed palette', () => {
    const theme = COLOR_THEMES.berry;
    const color = getHostChartColor(null, theme.length, 'berry');
    expect(color).toBe(theme[0]);
  });

  it('uses host palette when theme is default', () => {
    const fakePalette = { getColor: (key: string) => ({ value: `#HOST_${key}` }) };
    const color = getHostChartColor(fakePalette, 0, 'default');
    expect(color).toBe('#HOST_0');
  });

  it('uses host palette when no theme is provided', () => {
    const fakePalette = { getColor: (key: string) => ({ value: `#HOST_${key}` }) };
    const color = getHostChartColor(fakePalette, 2);
    expect(color).toBe('#HOST_2');
  });

  it('falls back to CHART_PALETTE_EXTENDED when host palette is null and theme is default', () => {
    const color = getHostChartColor(null, 0, 'default');
    expect(color).toBe(CHART_PALETTE_EXTENDED[0]);
  });

  it('overrides host palette when non-default theme is set', () => {
    const fakePalette = { getColor: (key: string) => ({ value: `#HOST_${key}` }) };
    const color = getHostChartColor(fakePalette, 0, 'ocean');
    expect(color).toBe(COLOR_THEMES.ocean[0]);
  });

  it('falls back to default when invalid theme name is provided', () => {
    const color = getHostChartColor(null, 0, 'nonexistent' as ColorThemeName);
    expect(color).toBe(CHART_PALETTE_EXTENDED[0]);
  });
});

describe('getChartColor with themes', () => {
  it('returns themed color when theme is specified', () => {
    const color = getChartColor(0, 'forest');
    expect(color).toBe(COLOR_THEMES.forest[0]);
  });

  it('returns default palette color when no theme', () => {
    const color = getChartColor(0);
    expect(color).toBe(CHART_PALETTE_EXTENDED[0]);
  });
});

describe('getChartColors with themes', () => {
  it('returns themed colors array', () => {
    const colors = getChartColors(3, 'sunset');
    expect(colors).toEqual([
      COLOR_THEMES.sunset[0],
      COLOR_THEMES.sunset[1],
      COLOR_THEMES.sunset[2],
    ]);
  });
});
