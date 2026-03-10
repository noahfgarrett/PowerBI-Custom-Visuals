/**
 * Controllable mock for powerbi-visuals-utils-formattingmodel.
 *
 * Usage in test files:
 *   let settingsRef: { current: unknown };
 *   vi.mock('powerbi-visuals-utils-formattingmodel', () => {
 *     settingsRef = { current: undefined };
 *     return createFormattingMock(settingsRef);
 *   });
 *
 * Then before calling visual.update(), set settingsRef.current to a
 * pre-configured settings instance. populateFormattingSettingsModel
 * will return it instead of creating a new default instance.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export function createFormattingMock(settingsRef: { current: unknown }): Record<string, unknown> {
  // Base class that assigns init properties
  class SliceBase {
    name = '';
    displayName = '';
    value: any;
    visible?: boolean;
    items?: any[];
    placeholder?: string;
    constructor(init?: any) {
      if (init) Object.assign(this, init);
    }
  }

  class CardBase {
    name = '';
    displayName = '';
    slices: any[] = [];
    visible?: boolean;
  }

  class GroupBase {
    name = '';
    displayName = '';
    slices: any[] = [];
    visible?: boolean;
    constructor(init?: any) {
      if (init) Object.assign(this, init);
    }
  }

  class CompositeCardBase {
    name = '';
    displayName = '';
    groups: any[] = [];
    visible?: boolean;
  }

  class ModelBase {
    cards: any[] = [];
  }

  return {
    formattingSettings: {
      Model: ModelBase,
      SimpleCard: CardBase,
      CompositeCard: CompositeCardBase,
      Group: GroupBase,
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
      populateFormattingSettingsModel(ModelClass: new () => unknown, _dv: unknown): unknown {
        if (settingsRef.current) return settingsRef.current;
        return new ModelClass();
      }
      buildFormattingModel(settings: { cards: any[] }): { cards: any[] } {
        return { cards: settings.cards ?? [] };
      }
    },
  };
}
