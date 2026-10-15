import { describe, expect, it, vi } from 'vitest';

const settingsRef: { current: unknown } = { current: undefined };

vi.mock('../../style/visual.less', () => ({}));

vi.mock('powerbi-visuals-utils-formattingmodel', () => {
  class SliceBase {
    constructor(init?: Record<string, unknown>) { if (init) Object.assign(this, init); }
  }
  return {
    formattingSettings: {
      Model: class { cards: unknown[] = []; },
      SimpleCard: class { slices: unknown[] = []; },
      CompositeCard: class { groups: unknown[] = []; },
      Group: class { slices: unknown[] = []; constructor(init?: Record<string, unknown>) { if (init) Object.assign(this, init); } },
      ToggleSwitch: SliceBase,
      NumUpDown: SliceBase,
      ColorPicker: SliceBase,
      TextInput: SliceBase,
      ItemDropdown: SliceBase,
      FontPicker: SliceBase,
      Slider: SliceBase,
      ReadOnlyText: SliceBase,
      AutoDropdown: SliceBase,
    },
    FormattingSettingsService: class {
      populateFormattingSettingsModel(ModelClass: new () => unknown) {
        if (settingsRef.current) {
          const ref = settingsRef.current;
          settingsRef.current = undefined;
          return ref;
        }
        return new ModelClass();
      }
      buildFormattingModel(settings: { cards: unknown[] }) { return { cards: settings.cards ?? [] }; }
    },
  };
});

import { FilterPaneProVisual } from '../visual';
import { FilterPaneProSettings } from '../settings';
import capabilities from '../../capabilities.json';
import {
  createConstructorOptions,
  DataViewBuilder,
  getSettingPaths,
  runFormattingCoverage,
  type HarnessConfig,
} from '../../../core/src/__test-utils__';

const testDV = new DataViewBuilder()
  .withCategory('Region', ['North', 'South', 'North'], 'filterCategory')
  .withCategory('Status', ['Open', 'Closed', 'Open'], 'filterCategory')
  .withCategory('Priority', ['High', 'Low', 'Medium'], 'filterCategory')
  .withValues('Issue Count', [1, 2, 3], 'filterMeasure')
  .build();

function createVisual() {
  const opts = createConstructorOptions();
  const settings = new FilterPaneProSettings();
  settingsRef.current = settings;
  const visual = new FilterPaneProVisual(opts as never);
  return {
    visual,
    settings: settings as unknown as Record<string, unknown> & { cards: Array<Record<string, unknown>> },
    element: opts.element,
  };
}

const harnessConfig: HarnessConfig = {
  createVisual,
  dataView: testDV,
  altValues: {
    'accessibilitySettings.paneAriaLabel': 'Report Filters',
  },
  expectedPhantoms: [],
};

describe('filter-pane-pro formatting coverage', () => {
  it('declares the setup and no-data states it renders', () => {
    expect(capabilities.supportsLandingPage).toBe(true);
    expect(capabilities.supportsEmptyDataView).toBe(true);
  });

  it('detects settings from the model', () => {
    const settings = new FilterPaneProSettings();
    const paths = getSettingPaths(
      settings as unknown as { cards: Array<Record<string, unknown>> },
      [],
    );
    expect(paths.map((path) => `${path.cardName}.${path.sliceName}`)).toEqual([
      'iconSettings.position',
      'iconSettings.style',
      'iconSettings.size',
      'iconSettings.iconColor',
      'iconSettings.glassColor',
      'iconSettings.glassOpacity',
      'paneSettings.side',
      'paneSettings.defaultOpen',
      'paneSettings.columnCount',
      'paneSettings.width',
      'paneSettings.maxHeight',
      'paneSettings.accentColor',
      'paneSettings.textColor',
      'paneSettings.fontSize',
      'behaviorSettings.defaultTab',
      'behaviorSettings.applyMode',
      'behaviorSettings.persistenceMode',
      'behaviorSettings.bookmarkOverlayMode',
      'behaviorSettings.activeTab',
      'overlaySettings.overlayColor',
      'overlaySettings.overlayOpacity',
      'overlaySettings.blurRadius',
      'cardSettings.backgroundColor',
      'cardSettings.backgroundOpacity',
      'cardSettings.borderRadius',
      'cardSettings.contentPadding',
      'animationSettings.enabled',
      'animationSettings.duration',
      'accessibilitySettings.focusPaneOnOpen',
      'accessibilitySettings.announceFilterChanges',
      'accessibilitySettings.paneAriaLabel',
    ]);
  });

  it('declares every formatting setting in capabilities', () => {
    const paths = getSettingPaths(
      new FilterPaneProSettings() as unknown as { cards: Array<Record<string, unknown>> },
      [],
    );
    const objects = capabilities.objects as Record<string, { properties?: Record<string, unknown> }>;

    expect(paths.filter(({ cardName, sliceName }) => !objects[cardName]?.properties?.[sliceName]))
      .toEqual([]);
  });

  it('every setting affects DOM output', () => {
    const results = runFormattingCoverage(harnessConfig);
    const unexpectedPhantoms = results.filter((result) => result.isPhantom);

    expect(unexpectedPhantoms.map((result) => `${result.cardName}.${result.sliceName}`)).toEqual([]);
  });
});
