import { describe, it, expect } from 'vitest';
import {
  lineStyleToDashArray,
  resolveSeriesFormatting,
  populateSeriesFormattingGroups,
  CARD_STYLE_MODE_ITEMS,
  SeriesFormattingCard,
  SeriesFormattingGroup,
} from '../shared-settings';
import {
  COLOR_THEMES,
  getHostChartColor,
  getChartColor,
  type ColorThemeName,
} from '../colors';

describe('card style labels', () => {
  it('describes the visible result in plain language', () => {
    expect(CARD_STYLE_MODE_ITEMS.map(({ value, displayName }) => ({ value, displayName }))).toEqual([
      { value: 'none', displayName: 'None' },
      { value: 'glass', displayName: 'Frosted Glass' },
      { value: 'elevated', displayName: 'Raised Panel' },
      { value: 'neumorphic', displayName: 'Soft Inset' },
      { value: 'outlined', displayName: 'Border Only' },
      { value: 'floating', displayName: 'Floating Shadow' },
    ]);
  });
});

// ── lineStyleToDashArray ─────────────────────────────────────────────

describe('lineStyleToDashArray', () => {
  it('returns "6 3" for dashed', () => {
    expect(lineStyleToDashArray('dashed')).toBe('6 3');
  });

  it('returns "2 2" for dotted', () => {
    expect(lineStyleToDashArray('dotted')).toBe('2 2');
  });

  it('returns "none" for solid', () => {
    expect(lineStyleToDashArray('solid')).toBe('none');
  });

  it('returns "none" for unknown strings', () => {
    expect(lineStyleToDashArray('unknown')).toBe('none');
  });

  it('returns "none" for empty string', () => {
    expect(lineStyleToDashArray('')).toBe('none');
  });
});

// ── resolveSeriesFormatting ──────────────────────────────────────────

describe('resolveSeriesFormatting', () => {
  function makeCard(groups: SeriesFormattingGroup[] = []): SeriesFormattingCard {
    const card = new SeriesFormattingCard();
    card.groups = groups;
    return card;
  }

  it('returns defaults when no group exists for the index', () => {
    const card = makeCard();
    const result = resolveSeriesFormatting(card, 0, '#FF0000');
    expect(result).toEqual({
      color: '#FF0000',
      opacity: 100,
      showLabels: true,
      lineStyle: 'solid',
      lineWidth: 2,
    });
  });

  it('uses default color when group has empty color value', () => {
    const group = new SeriesFormattingGroup({ name: 'series_0', displayName: 'S1' });
    group.seriesColor.value = { value: '' };
    const card = makeCard([group]);
    const result = resolveSeriesFormatting(card, 0, '#00FF00');
    expect(result.color).toBe('#00FF00');
  });

  it('uses custom color from group when set', () => {
    const group = new SeriesFormattingGroup({ name: 'series_0', displayName: 'S1' });
    group.seriesColor.value = { value: '#ABCDEF' };
    const card = makeCard([group]);
    const result = resolveSeriesFormatting(card, 0, '#00FF00');
    expect(result.color).toBe('#ABCDEF');
  });

  it('reads opacity from group', () => {
    const group = new SeriesFormattingGroup({ name: 'series_0', displayName: 'S1' });
    group.seriesOpacity.value = 75;
    const card = makeCard([group]);
    const result = resolveSeriesFormatting(card, 0, '#000');
    expect(result.opacity).toBe(75);
  });

  it('reads lineStyle from group', () => {
    const group = new SeriesFormattingGroup({ name: 'series_0', displayName: 'S1' });
    group.lineStyle.value = { value: 'dashed', displayName: 'Dashed' };
    const card = makeCard([group]);
    const result = resolveSeriesFormatting(card, 0, '#000');
    expect(result.lineStyle).toBe('dashed');
  });

  it('reads lineWidth from group', () => {
    const group = new SeriesFormattingGroup({ name: 'series_0', displayName: 'S1' });
    group.lineWidth.value = 4;
    const card = makeCard([group]);
    const result = resolveSeriesFormatting(card, 0, '#000');
    expect(result.lineWidth).toBe(4);
  });

  it('reads showLabels from group', () => {
    const group = new SeriesFormattingGroup({ name: 'series_0', displayName: 'S1' });
    group.showDataLabels.value = false;
    const card = makeCard([group]);
    const result = resolveSeriesFormatting(card, 0, '#000');
    expect(result.showLabels).toBe(false);
  });
});

// ── populateSeriesFormattingGroups ────────────────────────────────────

describe('populateSeriesFormattingGroups', () => {
  function makeCard(): SeriesFormattingCard {
    return new SeriesFormattingCard();
  }

  it('results in empty groups for undefined dataView', () => {
    const card = makeCard();
    populateSeriesFormattingGroups(card, undefined, ['values'], new Map());
    expect(card.groups).toHaveLength(0);
  });

  it('results in empty groups when no categorical values', () => {
    const card = makeCard();
    populateSeriesFormattingGroups(card, { categorical: {} }, ['values'], new Map());
    expect(card.groups).toHaveLength(0);
  });

  it('creates one group per matching value column', () => {
    const card = makeCard();
    const dataView = {
      categorical: {
        values: [
          { source: { displayName: 'Sales', queryName: 'Sales.Sales', roles: { values: true } } },
          { source: { displayName: 'Profit', queryName: 'Profit.Profit', roles: { values: true } } },
        ],
      },
    };
    populateSeriesFormattingGroups(card, dataView, ['values'], new Map());
    expect(card.groups).toHaveLength(2);
    expect(card.groups[0].displayName).toBe('Sales');
    expect(card.groups[1].displayName).toBe('Profit');
  });

  it('filters columns by role name', () => {
    const card = makeCard();
    const dataView = {
      categorical: {
        values: [
          { source: { displayName: 'Sales', queryName: 'Sales.Sales', roles: { values: true } as Record<string, boolean> } },
          { source: { displayName: 'Target', queryName: 'Target.Target', roles: { target: true } as Record<string, boolean> } },
        ],
      },
    };
    populateSeriesFormattingGroups(card, dataView, ['values'], new Map());
    expect(card.groups).toHaveLength(1);
    expect(card.groups[0].displayName).toBe('Sales');
  });

  it('sets palette color from colorLookup', () => {
    const card = makeCard();
    const dataView = {
      categorical: {
        values: [
          { source: { displayName: 'Sales', queryName: 'Sales.Sales', roles: { values: true } } },
        ],
      },
    };
    const lookup = new Map([['Sales', '#FF6600']]);
    populateSeriesFormattingGroups(card, dataView, ['values'], lookup);
    expect(card.groups[0].seriesColor.value.value).toBe('#FF6600');
  });

  it('reads persisted objects for color', () => {
    const card = makeCard();
    const dataView = {
      categorical: {
        values: [
          {
            source: {
              displayName: 'Sales',
              queryName: 'Sales.Sales',
              roles: { values: true },
              objects: {
                seriesFormatting: {
                  seriesColor: { solid: { color: '#112233' } },
                },
              },
            },
          },
        ],
      },
    };
    populateSeriesFormattingGroups(card, dataView, ['values'], new Map());
    expect(card.groups[0].seriesColor.value.value).toBe('#112233');
  });

  it('hides line props when hideLineProps returns true', () => {
    const card = makeCard();
    const dataView = {
      categorical: {
        values: [
          { source: { displayName: 'Sales', queryName: 'Sales.Sales', roles: { values: true } } },
        ],
      },
    };
    populateSeriesFormattingGroups(card, dataView, ['values'], new Map(), {
      hideLineProps: () => true,
    });
    expect(card.groups[0].lineStyle.visible).toBe(false);
    expect(card.groups[0].lineWidth.visible).toBe(false);
  });

  it('skips columns with no roles', () => {
    const card = makeCard();
    const dataView = {
      categorical: {
        values: [
          { source: { displayName: 'NoRole', queryName: 'NoRole.NoRole' } },
        ],
      },
    };
    populateSeriesFormattingGroups(card, dataView, ['values'], new Map());
    expect(card.groups).toHaveLength(0);
  });
});

// ── COLOR_THEMES ─────────────────────────────────────────────────────

describe('COLOR_THEMES', () => {
  const themeNames: ColorThemeName[] = ['default', 'ocean', 'sunset', 'forest', 'berry', 'monochrome', 'earth'];

  it('contains all 7 named themes', () => {
    for (const name of themeNames) {
      expect(COLOR_THEMES[name]).toBeDefined();
    }
  });

  it('each theme has at least 8 colors', () => {
    for (const name of themeNames) {
      expect(COLOR_THEMES[name].length).toBeGreaterThanOrEqual(8);
    }
  });

  it('all theme colors are valid hex strings', () => {
    for (const name of themeNames) {
      for (const color of COLOR_THEMES[name]) {
        expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });
});

// ── getHostChartColor with themes ────────────────────────────────────

describe('getHostChartColor with themes', () => {
  it('returns ocean palette color when theme is ocean', () => {
    const color = getHostChartColor(null, 0, 'ocean');
    expect(color).toBe(COLOR_THEMES.ocean[0]);
  });

  it('returns sunset palette color when theme is sunset', () => {
    const color = getHostChartColor(null, 2, 'sunset');
    expect(color).toBe(COLOR_THEMES.sunset[2]);
  });

  it('cycles through themed palette', () => {
    const palette = COLOR_THEMES.forest;
    const color = getHostChartColor(null, palette.length, 'forest');
    expect(color).toBe(palette[0]);
  });

  it('skips host palette when non-default theme is set', () => {
    const mockPalette = { getColor: () => ({ value: '#FF0000' }) };
    const color = getHostChartColor(mockPalette, 0, 'berry');
    expect(color).toBe(COLOR_THEMES.berry[0]);
    expect(color).not.toBe('#FF0000');
  });

  it('uses host palette when theme is default', () => {
    const mockPalette = { getColor: () => ({ value: '#FF0000' }) };
    const color = getHostChartColor(mockPalette, 0, 'default');
    expect(color).toBe('#FF0000');
  });

  it('uses host palette when theme is undefined', () => {
    const mockPalette = { getColor: () => ({ value: '#00FF00' }) };
    const color = getHostChartColor(mockPalette, 0);
    expect(color).toBe('#00FF00');
  });
});

// ── getChartColor with themes ────────────────────────────────────────

describe('getChartColor with themes', () => {
  it('returns themed color', () => {
    const color = getChartColor(0, 'monochrome');
    expect(color).toBe(COLOR_THEMES.monochrome[0]);
  });

  it('returns default palette when theme is undefined', () => {
    const color = getChartColor(0);
    expect(color).toBe(COLOR_THEMES.default[0]);
  });
});
