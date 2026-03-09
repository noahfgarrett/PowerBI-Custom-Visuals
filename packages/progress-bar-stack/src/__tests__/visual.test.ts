import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProgressBarStackVisual } from '../visual';
import {
  createConstructorOptions,
  createUpdateOptions,
  DataViewBuilder,
} from '../../../core/src/__test-utils__';

vi.mock('../../style/visual.less', () => ({}));

vi.mock('powerbi-visuals-utils-formattingmodel', () => {
  class FakeModel {
    cards: unknown[] = [];
  }
  return {
    formattingSettings: {
      Model: FakeModel,
      SimpleCard: class { slices: unknown[] = []; },
      CompositeCard: class { groups: unknown[] = []; },
      Group: class { slices: unknown[] = []; },
      ToggleSwitch: class { constructor(init: Record<string, unknown>) { Object.assign(this, init); } },
      NumUpDown: class { constructor(init: Record<string, unknown>) { Object.assign(this, init); } },
      ColorPicker: class { constructor(init: Record<string, unknown>) { Object.assign(this, init); } },
      TextInput: class { constructor(init: Record<string, unknown>) { Object.assign(this, init); } },
      ItemDropdown: class { constructor(init: Record<string, unknown>) { Object.assign(this, init); } },
    },
    FormattingSettingsService: class {
      populateFormattingSettingsModel(ModelClass: new () => unknown, _dv: unknown) { return new ModelClass(); }
      buildFormattingModel(settings: { cards: unknown[] }) { return { cards: settings.cards?.map((c: unknown) => ({ displayName: (c as Record<string, unknown>)['displayName'], name: (c as Record<string, unknown>)['name'] })) ?? [] }; }
    },
  };
});

let visual: ProgressBarStackVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new ProgressBarStackVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

describe('ProgressBarStackVisual', () => {
  it('constructs without error', () => {
    expect(visual).toBeDefined();
  });

  it('handles empty data', () => {
    const dv = DataViewBuilder.empty();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('renders sample data', () => {
    const dv = new DataViewBuilder().withCategory('Item', ['A','B'], 'category').withValues('Value', [70,45], 'measure').withValues('Target', [100,100], 'target').build();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('returns formatting model', () => {
    const dv = new DataViewBuilder().withCategory('Item', ['A','B'], 'category').withValues('Value', [70,45], 'measure').withValues('Target', [100,100], 'target').build();
    visual.update(createUpdateOptions([dv]) as never);
    const model = visual.getFormattingModel();
    expect(model).toBeDefined();
  });

  it('re-renders without error', () => {
    const dv = new DataViewBuilder().withCategory('Item', ['A','B'], 'category').withValues('Value', [70,45], 'measure').withValues('Target', [100,100], 'target').build();
    visual.update(createUpdateOptions([dv]) as never);
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });
});
