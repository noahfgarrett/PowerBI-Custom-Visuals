# Filter Pane Pro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new standalone `Filter Pane Pro` Power BI custom visual with a glass filter button, blurred overlay pane, Basic and Advanced tabs, Power BI JSON filter application, and bookmark restoration.

**Architecture:** Create a new workspace package under `packages/filter-pane-pro`. Keep filter state/types/payload helpers in `src/filter-model.ts`, formatting settings in `src/settings.ts`, and DOM rendering plus Power BI lifecycle in `src/visual.ts`. Add tests first for extraction, UI tabs, filter payloads, clear behavior, and bookmark restoration.

**Tech Stack:** Power BI custom visuals API 5.3, TypeScript, DOM rendering, `powerbi-visuals-utils-formattingmodel`, Vitest/jsdom, repo sync scripts.

---

## File Structure

- Create `packages/filter-pane-pro/package.json`: workspace package metadata and build scripts.
- Create `packages/filter-pane-pro/pbiviz.json`: visual metadata, GUID, resources, style, capabilities.
- Create `packages/filter-pane-pro/capabilities.json`: data roles, visual filter object, and formatting properties.
- Create `packages/filter-pane-pro/tsconfig.json`: TypeScript config matching existing packages.
- Create `packages/filter-pane-pro/vitest.config.ts`: Vitest config matching existing packages.
- Create `packages/filter-pane-pro/assets/icon.png`: package icon copied from an existing neutral icon for V1.
- Create `packages/filter-pane-pro/stringResources/en-US/resources.resjson`: localization keys for roles and formatting names.
- Create `packages/filter-pane-pro/style/visual.less`: glass button, blurred overlay, pane, tabs, cards, chips, and responsive layout.
- Create `packages/filter-pane-pro/src/settings.ts`: formatting settings model.
- Create `packages/filter-pane-pro/src/filter-model.ts`: data extraction, field metadata, state, filter payload builders, filter restore helpers.
- Create `packages/filter-pane-pro/src/visual.ts`: Power BI visual lifecycle and UI interaction.
- Create `packages/filter-pane-pro/src/__tests__/visual.test.ts`: behavioral tests.
- Create `packages/filter-pane-pro/src/__tests__/formatting-coverage.test.ts`: settings coverage.
- Modify `packages/core/src/__test-utils__/mock-host.ts`: expose applied JSON filter calls for tests.
- Modify `package-lock.json`: add the new workspace package via `npm install --package-lock-only`.

---

### Task 1: Test Host Filter Spy

**Files:**
- Modify: `packages/core/src/__test-utils__/mock-host.ts`

- [ ] **Step 1: Write the failing test expectation in the new visual test file**

Create `packages/filter-pane-pro/src/__tests__/visual.test.ts` with this first test scaffold. The package does not exist yet, so this test will not run until Task 2 creates the package, but it defines the host behavior needed by the visual.

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FilterPaneProVisual } from '../visual';
import {
  createConstructorOptions,
  createUpdateOptions,
  DataViewBuilder,
} from '../../../core/src/__test-utils__';

vi.mock('../../style/visual.less', () => ({}));

vi.mock('powerbi-visuals-utils-formattingmodel', () => {
  class FakeModel { cards: unknown[] = []; }
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
      populateFormattingSettingsModel(ModelClass: new () => unknown) { return new ModelClass(); }
      buildFormattingModel(settings: { cards: unknown[] }) { return { cards: settings.cards ?? [] }; }
    },
  };
});

let visual: FilterPaneProVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

function buildFilterDataView() {
  return new DataViewBuilder()
    .withCategory('Region', ['North', 'South', 'North', 'West'], 'filterCategory')
    .withCategory('Status', ['Open', 'Closed', 'Open', 'Review'], 'filterCategory')
    .withValues('Issue Count', [1, 5, 2, 8], 'filterMeasure')
    .build();
}

function getAppliedJsonFilters() {
  return (constructorOpts.host as Record<string, unknown>).__jsonFilters as Array<{
    filter: unknown;
    objectName: string;
    propertyName: string;
    action: number;
  }>;
}

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new FilterPaneProVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

describe('FilterPaneProVisual', () => {
  it('records JSON filter calls through the mock host', () => {
    visual.update(createUpdateOptions([buildFilterDataView()]) as never);
    const applyJsonFilter = (constructorOpts.host as Record<string, unknown>).applyJsonFilter as (
      filter: unknown,
      objectName: string,
      propertyName: string,
      action: number,
    ) => void;
    applyJsonFilter({ test: true }, 'general', 'filter', 0);
    expect(getAppliedJsonFilters()).toEqual([
      { filter: { test: true }, objectName: 'general', propertyName: 'filter', action: 0 },
    ]);
  });
});
```

- [ ] **Step 2: Implement the host spy**

In `packages/core/src/__test-utils__/mock-host.ts`, replace the current `applyJsonFilter: () => {},` with stateful recording.

```ts
export function createMockHost(): Record<string, unknown> {
  colorIndex = 0;
  selectionIdIndex = 0;
  const selectionManager = createMockSelectionManager();
  const jsonFilters: Array<{
    filter: unknown;
    objectName: string;
    propertyName: string;
    action: unknown;
  }> = [];
  return {
    createSelectionIdBuilder: () => createMockSelectionIdBuilder(),
    createSelectionManager: () => selectionManager,
    __selectionManager: selectionManager,
    __jsonFilters: jsonFilters,
    colorPalette: createMockColorPalette(),
    tooltipService: createMockTooltipService(),
    eventService: createMockEventService(),
    hostCapabilities: { allowInteractions: true },
    locale: 'en-US',
    telemetry: { trace: () => {} },
    storageService: {
      get: () => Promise.resolve(null),
      set: () => Promise.resolve(),
    },
    persistProperties: () => {},
    applyJsonFilter: (filter: unknown, objectName: string, propertyName: string, action: unknown) => {
      jsonFilters.push({ filter, objectName, propertyName, action });
    },
    launchUrl: () => {},
    createLocalizationManager: () => createMockLocale(),
    fetchMoreData: () => false,
    instanceId: 'test-instance',
    refreshHostData: () => {},
    displayWarningIcon: () => {},
    licenseManager: {
      isLicenseInfoAvailable: false,
      notifyFeatureBlocked: () => {},
    },
  };
}
```

- [ ] **Step 3: Run the existing core-adjacent tests**

Run:

```bash
npx vitest run packages/status-indicator/src/__tests__/visual.test.ts
```

Expected: existing status indicator tests pass, proving the host mock change did not break current visuals.

---

### Task 2: Scaffold The New Package

**Files:**
- Create: `packages/filter-pane-pro/package.json`
- Create: `packages/filter-pane-pro/pbiviz.json`
- Create: `packages/filter-pane-pro/tsconfig.json`
- Create: `packages/filter-pane-pro/vitest.config.ts`
- Create: `packages/filter-pane-pro/capabilities.json`
- Create: `packages/filter-pane-pro/stringResources/en-US/resources.resjson`
- Create: `packages/filter-pane-pro/style/visual.less`
- Create: `packages/filter-pane-pro/src/settings.ts`
- Create: `packages/filter-pane-pro/src/filter-model.ts`
- Create: `packages/filter-pane-pro/src/visual.ts`
- Copy: `packages/filter-pane-pro/assets/icon.png`

- [ ] **Step 1: Create package metadata**

Create `packages/filter-pane-pro/package.json`:

```json
{
  "name": "@pbi/filter-pane-pro",
  "version": "1.0.1",
  "private": true,
  "scripts": {
    "build": "pbiviz package",
    "start": "pbiviz start"
  },
  "dependencies": {
    "d3": "^7.9.0",
    "powerbi-visuals-api": "~5.3.0",
    "powerbi-visuals-utils-formattingmodel": "^6.0.0"
  },
  "devDependencies": {
    "@types/d3": "^7.4.3",
    "powerbi-visuals-tools": "^5.3.0",
    "typescript": "^5.3.3"
  }
}
```

Create `packages/filter-pane-pro/pbiviz.json`:

```json
{
  "visual": {
    "name": "filterPanePro",
    "displayName": "Filter Pane Pro",
    "guid": "filterPanePro_5E9A1C7D3F2B",
    "visualClassName": "FilterPaneProVisual",
    "version": "1.0.1.0",
    "description": "Reusable glass filter pane with basic and advanced filtering.",
    "supportUrl": "https://github.com/noahfgarrett/PowerBI/issues",
    "gitHubUrl": "https://github.com/noahfgarrett/PowerBI"
  },
  "apiVersion": "5.3.0",
  "author": {
    "name": "Visualize Build",
    "email": "contact@visualizebuild.com"
  },
  "assets": {
    "icon": "assets/icon.png"
  },
  "style": "style/visual.less",
  "capabilities": "capabilities.json",
  "stringResources": [
    "stringResources/en-US/resources.resjson"
  ]
}
```

- [ ] **Step 2: Create TypeScript and test config**

Create `packages/filter-pane-pro/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "files": ["src/visual.ts"]
}
```

Create `packages/filter-pane-pro/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    css: false,
    pool: 'forks',
    poolOptions: { forks: { maxForks: 1, minForks: 1 } },
    setupFiles: ['../../packages/core/src/__test-utils__/setup.ts'],
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Create capabilities**

Create `packages/filter-pane-pro/capabilities.json`:

```json
{
  "dataRoles": [
    {
      "displayName": "Filter Fields",
      "name": "filterCategory",
      "kind": "Grouping",
      "description": "Columns to expose in the basic and advanced filter pane"
    },
    {
      "displayName": "Filter Measures",
      "name": "filterMeasure",
      "kind": "Measure",
      "description": "Optional numeric measures for advanced filtering controls"
    }
  ],
  "dataViewMappings": [
    {
      "conditions": [
        {
          "filterCategory": { "max": 8 },
          "filterMeasure": { "max": 4 }
        }
      ],
      "categorical": {
        "categories": {
          "for": { "in": "filterCategory" },
          "dataReductionAlgorithm": { "top": { "count": 5000 } }
        },
        "values": {
          "select": [
            { "for": { "in": "filterMeasure" } }
          ]
        }
      }
    }
  ],
  "objects": {
    "general": {
      "displayName": "General",
      "properties": {
        "filter": {
          "type": {
            "filter": true
          }
        }
      }
    },
    "iconSettings": {
      "displayName": "Filter Button",
      "properties": {
        "position": {
          "displayName": "Position",
          "type": {
            "enumeration": [
              { "value": "topLeft", "displayName": "Top Left" },
              { "value": "topRight", "displayName": "Top Right" },
              { "value": "bottomLeft", "displayName": "Bottom Left" },
              { "value": "bottomRight", "displayName": "Bottom Right" },
              { "value": "center", "displayName": "Center" }
            ]
          }
        },
        "style": {
          "displayName": "Style",
          "type": {
            "enumeration": [
              { "value": "glass", "displayName": "Glass" },
              { "value": "solid", "displayName": "Solid" },
              { "value": "outline", "displayName": "Outline" },
              { "value": "minimal", "displayName": "Minimal" }
            ]
          }
        },
        "size": { "displayName": "Size", "type": { "numeric": true } },
        "accentColor": { "displayName": "Accent Color", "type": { "fill": { "solid": { "color": true } } } }
      }
    },
    "paneSettings": {
      "displayName": "Pane",
      "properties": {
        "paneSide": {
          "displayName": "Pane Side",
          "type": {
            "enumeration": [
              { "value": "right", "displayName": "Right" },
              { "value": "left", "displayName": "Left" },
              { "value": "top", "displayName": "Top" },
              { "value": "bottom", "displayName": "Bottom" },
              { "value": "center", "displayName": "Centered" }
            ]
          }
        },
        "paneWidth": { "displayName": "Pane Width", "type": { "numeric": true } },
        "glassOpacity": { "displayName": "Glass Opacity (%)", "type": { "numeric": true } },
        "borderRadius": { "displayName": "Border Radius", "type": { "numeric": true } },
        "shadowStrength": { "displayName": "Shadow Strength (%)", "type": { "numeric": true } },
        "defaultOpen": { "displayName": "Default Open", "type": { "bool": true } }
      }
    },
    "overlaySettings": {
      "displayName": "Backdrop",
      "properties": {
        "darkness": { "displayName": "Darkness (%)", "type": { "numeric": true } },
        "blur": { "displayName": "Blur", "type": { "numeric": true } }
      }
    },
    "behaviorSettings": {
      "displayName": "Behavior",
      "properties": {
        "applyMode": {
          "displayName": "Apply Mode",
          "type": {
            "enumeration": [
              { "value": "button", "displayName": "Apply Button" },
              { "value": "immediate", "displayName": "Apply Immediately" }
            ]
          }
        },
        "persistenceMode": {
          "displayName": "Persistence",
          "type": {
            "enumeration": [
              { "value": "bookmark", "displayName": "Bookmark Linked" },
              { "value": "manual", "displayName": "Manual Session" }
            ]
          }
        },
        "activeTab": {
          "displayName": "Default Tab",
          "filterState": true,
          "type": {
            "enumeration": [
              { "value": "basic", "displayName": "Basic" },
              { "value": "advanced", "displayName": "Advanced" }
            ]
          }
        }
      }
    }
  }
}
```

- [ ] **Step 4: Create resources and placeholder files**

Create `packages/filter-pane-pro/stringResources/en-US/resources.resjson`:

```json
{
  "values": {
    "FilterPanePro_EmptyState": "Add fields to the Filter Fields bucket to build a filter pane.",
    "FilterPanePro_NoValues": "No values available.",
    "FilterPanePro_SearchPlaceholder": "Search values",
    "FilterPanePro_AdvancedValuePlaceholder": "Enter value"
  }
}
```

Create minimal placeholder files so the package compiles before real implementation:

`packages/filter-pane-pro/src/settings.ts`

```ts
import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

class IconSettings extends formattingSettings.SimpleCard {
  name = 'iconSettings';
  displayName = 'Filter Button';
  slices: unknown[] = [];
}

export class FilterPaneProSettings extends formattingSettings.Model {
  iconSettings = new IconSettings();
  cards = [this.iconSettings];
}
```

`packages/filter-pane-pro/src/filter-model.ts`

```ts
export type FilterPaneTab = 'basic' | 'advanced';
```

`packages/filter-pane-pro/src/visual.ts`

```ts
import powerbi from 'powerbi-visuals-api';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { FilterPaneProSettings } from './settings';
import '../style/visual.less';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;

export class FilterPaneProVisual implements IVisual {
  private host: IVisualHost;
  private container: HTMLElement;
  private settings = new FilterPaneProSettings();
  private formattingSettingsService: FormattingSettingsService;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.container = options.element;
    this.container.classList.add('filter-pane-pro');
    this.formattingSettingsService = new FormattingSettingsService(options.host.createLocalizationManager());
  }

  public update(options: VisualUpdateOptions): void {
    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(FilterPaneProSettings, dataView);
    }
    this.container.textContent = 'Filter Pane Pro';
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  public destroy(): void {
    while (this.container.firstChild) this.container.removeChild(this.container.firstChild);
  }
}
```

`packages/filter-pane-pro/style/visual.less`

```less
.filter-pane-pro {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
}
```

- [ ] **Step 5: Copy a V1 icon**

Run:

```bash
mkdir -p packages/filter-pane-pro/assets
cp packages/status-indicator/assets/icon.png packages/filter-pane-pro/assets/icon.png
```

- [ ] **Step 6: Run package typecheck**

Run:

```bash
npx tsc --noEmit -p packages/filter-pane-pro/tsconfig.json
```

Expected: package compiles.

---

### Task 3: Formatting Settings Model

**Files:**
- Modify: `packages/filter-pane-pro/src/settings.ts`
- Test: `packages/filter-pane-pro/src/__tests__/formatting-coverage.test.ts`

- [ ] **Step 1: Write formatting coverage test**

Create `packages/filter-pane-pro/src/__tests__/formatting-coverage.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

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
      ToggleSwitch: SliceBase,
      NumUpDown: SliceBase,
      ColorPicker: SliceBase,
      TextInput: SliceBase,
      ItemDropdown: SliceBase,
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

import { FilterPaneProSettings } from '../settings';
import { FilterPaneProVisual } from '../visual';
import {
  createConstructorOptions,
  DataViewBuilder,
  runFormattingCoverage,
  getSettingPaths,
  type HarnessConfig,
} from '../../../core/src/__test-utils__';

const dataView = new DataViewBuilder()
  .withCategory('Region', ['North', 'South'], 'filterCategory')
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
  dataView,
  deps: {},
  skipCards: [],
  expectedPhantoms: [],
};

describe('Filter Pane Pro formatting coverage', () => {
  it('detects settings from the model', () => {
    const settings = new FilterPaneProSettings();
    const paths = getSettingPaths(
      settings as unknown as { cards: Array<Record<string, unknown>> },
      [],
    );
    expect(paths).toEqual(expect.arrayContaining([
      'iconSettings.position',
      'paneSettings.paneSide',
      'overlaySettings.darkness',
      'behaviorSettings.applyMode',
    ]));
  });

  it('every setting affects DOM output', () => {
    const results = runFormattingCoverage(harnessConfig);
    const unexpected = results
      .filter((result) => result.isPhantom)
      .map((result) => `${result.cardName}.${result.sliceName}`);
    expect(unexpected).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx vitest run packages/filter-pane-pro/src/__tests__/formatting-coverage.test.ts
```

Expected: fails because the settings cards and slices are not implemented.

- [ ] **Step 3: Implement settings**

Replace `packages/filter-pane-pro/src/settings.ts` with full settings cards:

```ts
import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

const POSITION_ITEMS = [
  { value: 'topLeft', displayName: 'Top Left' },
  { value: 'topRight', displayName: 'Top Right' },
  { value: 'bottomLeft', displayName: 'Bottom Left' },
  { value: 'bottomRight', displayName: 'Bottom Right' },
  { value: 'center', displayName: 'Center' },
];

const PANE_SIDE_ITEMS = [
  { value: 'right', displayName: 'Right' },
  { value: 'left', displayName: 'Left' },
  { value: 'top', displayName: 'Top' },
  { value: 'bottom', displayName: 'Bottom' },
  { value: 'center', displayName: 'Centered' },
];

class IconSettings extends formattingSettings.SimpleCard {
  position = new formattingSettings.ItemDropdown({
    name: 'position',
    displayName: 'Position',
    items: POSITION_ITEMS,
    value: { value: 'topRight', displayName: 'Top Right' },
  });
  style = new formattingSettings.ItemDropdown({
    name: 'style',
    displayName: 'Style',
    items: [
      { value: 'glass', displayName: 'Glass' },
      { value: 'solid', displayName: 'Solid' },
      { value: 'outline', displayName: 'Outline' },
      { value: 'minimal', displayName: 'Minimal' },
    ],
    value: { value: 'glass', displayName: 'Glass' },
  });
  size = new formattingSettings.NumUpDown({ name: 'size', displayName: 'Size', value: 44 });
  accentColor = new formattingSettings.ColorPicker({
    name: 'accentColor',
    displayName: 'Accent Color',
    value: { value: '#38BDF8' },
  });
  name = 'iconSettings';
  displayName = 'Filter Button';
  slices = [this.position, this.style, this.size, this.accentColor];
}

class PaneSettings extends formattingSettings.SimpleCard {
  paneSide = new formattingSettings.ItemDropdown({
    name: 'paneSide',
    displayName: 'Pane Side',
    items: PANE_SIDE_ITEMS,
    value: { value: 'right', displayName: 'Right' },
  });
  paneWidth = new formattingSettings.NumUpDown({ name: 'paneWidth', displayName: 'Pane Width', value: 520 });
  glassOpacity = new formattingSettings.NumUpDown({ name: 'glassOpacity', displayName: 'Glass Opacity (%)', value: 82 });
  borderRadius = new formattingSettings.NumUpDown({ name: 'borderRadius', displayName: 'Border Radius', value: 18 });
  shadowStrength = new formattingSettings.NumUpDown({ name: 'shadowStrength', displayName: 'Shadow Strength (%)', value: 45 });
  defaultOpen = new formattingSettings.ToggleSwitch({ name: 'defaultOpen', displayName: 'Default Open', value: false });
  name = 'paneSettings';
  displayName = 'Pane';
  slices = [this.paneSide, this.paneWidth, this.glassOpacity, this.borderRadius, this.shadowStrength, this.defaultOpen];
}

class OverlaySettings extends formattingSettings.SimpleCard {
  darkness = new formattingSettings.NumUpDown({ name: 'darkness', displayName: 'Darkness (%)', value: 42 });
  blur = new formattingSettings.NumUpDown({ name: 'blur', displayName: 'Blur', value: 12 });
  name = 'overlaySettings';
  displayName = 'Backdrop';
  slices = [this.darkness, this.blur];
}

class BehaviorSettings extends formattingSettings.SimpleCard {
  applyMode = new formattingSettings.ItemDropdown({
    name: 'applyMode',
    displayName: 'Apply Mode',
    items: [
      { value: 'button', displayName: 'Apply Button' },
      { value: 'immediate', displayName: 'Apply Immediately' },
    ],
    value: { value: 'button', displayName: 'Apply Button' },
  });
  persistenceMode = new formattingSettings.ItemDropdown({
    name: 'persistenceMode',
    displayName: 'Persistence',
    items: [
      { value: 'bookmark', displayName: 'Bookmark Linked' },
      { value: 'manual', displayName: 'Manual Session' },
    ],
    value: { value: 'bookmark', displayName: 'Bookmark Linked' },
  });
  activeTab = new formattingSettings.ItemDropdown({
    name: 'activeTab',
    displayName: 'Default Tab',
    items: [
      { value: 'basic', displayName: 'Basic' },
      { value: 'advanced', displayName: 'Advanced' },
    ],
    value: { value: 'basic', displayName: 'Basic' },
  });
  name = 'behaviorSettings';
  displayName = 'Behavior';
  slices = [this.applyMode, this.persistenceMode, this.activeTab];
}

export class FilterPaneProSettings extends formattingSettings.Model {
  iconSettings = new IconSettings();
  paneSettings = new PaneSettings();
  overlaySettings = new OverlaySettings();
  behaviorSettings = new BehaviorSettings();

  cards = [
    this.iconSettings,
    this.paneSettings,
    this.overlaySettings,
    this.behaviorSettings,
  ];
}
```

- [ ] **Step 4: Run coverage test**

Run:

```bash
npx vitest run packages/filter-pane-pro/src/__tests__/formatting-coverage.test.ts
```

Expected: the model detection assertions pass in this task. The full no-phantom DOM coverage gate is Task 8, after the visual DOM and styling hooks exist.

---

### Task 4: Filter Model And Payload Builders

**Files:**
- Modify: `packages/filter-pane-pro/src/filter-model.ts`
- Test: `packages/filter-pane-pro/src/__tests__/filter-model.test.ts`

- [ ] **Step 1: Write failing model tests**

Create `packages/filter-pane-pro/src/__tests__/filter-model.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildAdvancedFilter,
  buildBasicFilter,
  buildFilterTarget,
  extractFilterFields,
  restoreStateFromFilters,
  type FilterPaneState,
} from '../filter-model';
import { DataViewBuilder } from '../../../core/src/__test-utils__';

function dataView() {
  return new DataViewBuilder()
    .withCategory('Region', ['North', 'South', 'North', 'West'], 'filterCategory')
    .withCategory('Status', ['Open', 'Closed', 'Open', 'Review'], 'filterCategory')
    .withValues('Issue Count', [1, 5, 2, 8], 'filterMeasure')
    .build();
}

describe('filter-model', () => {
  it('extracts bound fields and distinct sorted values', () => {
    const fields = extractFilterFields(dataView() as never);
    expect(fields.map((field) => field.displayName)).toEqual(['Region', 'Status', 'Issue Count']);
    expect(fields[0].values.map((value) => value.display)).toEqual(['North', 'South', 'West']);
  });

  it('builds a Basic In filter for selected categorical values', () => {
    const target = buildFilterTarget({ queryName: 'Sales.Region', displayName: 'Region' });
    expect(buildBasicFilter(target, ['North', 'South'])).toMatchObject({
      $schema: 'https://powerbi.com/product/schema#basic',
      target: { table: 'Sales', column: 'Region' },
      operator: 'In',
      values: ['North', 'South'],
    });
  });

  it('builds an Advanced GreaterThan filter for decimals', () => {
    const target = buildFilterTarget({ queryName: 'Issues.Count', displayName: 'Issue Count' });
    expect(buildAdvancedFilter(target, 'GreaterThan', 2.5)).toMatchObject({
      $schema: 'https://powerbi.com/product/schema#advanced',
      logicalOperator: 'And',
      conditions: [{ operator: 'GreaterThan', value: 2.5 }],
    });
  });

  it('restores basic state from json filters', () => {
    const fields = extractFilterFields(dataView() as never);
    const initial: FilterPaneState = {
      activeTab: 'basic',
      isOpen: false,
      searchText: '',
      fields: {},
      advancedRules: [],
    };
    const restored = restoreStateFromFilters(initial, fields, [
      buildBasicFilter(fields[0].target, ['North']),
    ]);
    expect(restored.fields[fields[0].key].selectedValues).toEqual(['North']);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npx vitest run packages/filter-pane-pro/src/__tests__/filter-model.test.ts
```

Expected: fails because helpers are not implemented.

- [ ] **Step 3: Implement model helpers**

Implement `packages/filter-pane-pro/src/filter-model.ts` with these exported types and functions:

```ts
import powerbi from 'powerbi-visuals-api';

export type FilterPaneTab = 'basic' | 'advanced';
export type FilterFieldType = 'category' | 'numeric' | 'date';
export type AdvancedOperator =
  | 'Is'
  | 'IsNot'
  | 'Contains'
  | 'DoesNotContain'
  | 'StartsWith'
  | 'GreaterThan'
  | 'GreaterThanOrEqual'
  | 'LessThan'
  | 'LessThanOrEqual'
  | 'IsBlank'
  | 'IsNotBlank';

export interface FilterTarget {
  table: string;
  column: string;
}

export interface FilterValueOption {
  value: string | number | boolean;
  display: string;
}

export interface FilterField {
  key: string;
  displayName: string;
  queryName: string;
  type: FilterFieldType;
  target: FilterTarget;
  values: FilterValueOption[];
}

export interface FieldFilterState {
  selectedValues: Array<string | number | boolean>;
  operator: AdvancedOperator | 'Between';
  value: string | number | boolean | null;
  valueTo: string | number | boolean | null;
  isDirty: boolean;
}

export interface AdvancedRuleState {
  id: string;
  fieldKey: string;
  operator: AdvancedOperator | 'Between';
  value: string | number | boolean | null;
  valueTo: string | number | boolean | null;
  display: string;
  isValid: boolean;
}

export interface FilterPaneState {
  activeTab: FilterPaneTab;
  isOpen: boolean;
  searchText: string;
  fields: Record<string, FieldFilterState>;
  advancedRules: AdvancedRuleState[];
}

type DataViewLike = powerbi.DataView;
type FilterLike = Record<string, unknown>;

export function createInitialState(activeTab: FilterPaneTab, isOpen: boolean): FilterPaneState {
  return { activeTab, isOpen, searchText: '', fields: {}, advancedRules: [] };
}

export function buildFilterTarget(source: { queryName?: string; displayName?: string }): FilterTarget {
  const queryName = source.queryName ?? source.displayName ?? 'Field.Field';
  const dotIndex = queryName.indexOf('.');
  return {
    table: dotIndex > 0 ? queryName.slice(0, dotIndex) : queryName,
    column: source.displayName ?? (dotIndex > 0 ? queryName.slice(dotIndex + 1) : queryName),
  };
}

function detectFieldType(source: { type?: Record<string, unknown> }): FilterFieldType {
  if (source.type?.dateTime === true || source.type?.temporal != null) return 'date';
  if (source.type?.numeric === true) return 'numeric';
  return 'category';
}

function normalizeValue(value: unknown): string | number | boolean | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return null;
}

export function extractFilterFields(dataView: DataViewLike | undefined): FilterField[] {
  const fields: FilterField[] = [];
  const categorical = dataView?.categorical;
  if (!categorical) return fields;

  for (const category of categorical.categories ?? []) {
    if (!category.source.roles?.filterCategory) continue;
    const seen = new Map<string, FilterValueOption>();
    for (const rawValue of category.values) {
      const value = normalizeValue(rawValue);
      if (value === null) continue;
      const display = String(rawValue instanceof Date ? rawValue.toLocaleDateString() : value);
      seen.set(String(value), { value, display });
    }
    fields.push({
      key: category.source.queryName,
      displayName: category.source.displayName,
      queryName: category.source.queryName,
      type: detectFieldType(category.source),
      target: buildFilterTarget(category.source),
      values: [...seen.values()].sort((a, b) => a.display.localeCompare(b.display, undefined, { numeric: true })),
    });
  }

  for (const measure of categorical.values ?? []) {
    if (!measure.source.roles?.filterMeasure) continue;
    const seen = new Map<string, FilterValueOption>();
    for (const rawValue of measure.values) {
      const value = normalizeValue(rawValue);
      if (value === null) continue;
      seen.set(String(value), { value, display: String(value) });
    }
    fields.push({
      key: measure.source.queryName,
      displayName: measure.source.displayName,
      queryName: measure.source.queryName,
      type: 'numeric',
      target: buildFilterTarget(measure.source),
      values: [...seen.values()].sort((a, b) => a.display.localeCompare(b.display, undefined, { numeric: true })),
    });
  }

  return fields;
}

export function ensureFieldState(state: FilterPaneState, fields: FilterField[]): FilterPaneState {
  const next: FilterPaneState = { ...state, fields: {} };
  for (const field of fields) {
    next.fields[field.key] = state.fields[field.key] ?? {
      selectedValues: [],
      operator: 'Is',
      value: null,
      valueTo: null,
      isDirty: false,
    };
  }
  return next;
}

export function buildBasicFilter(target: FilterTarget, values: Array<string | number | boolean>): FilterLike {
  return {
    $schema: 'https://powerbi.com/product/schema#basic',
    target,
    operator: values.length > 0 ? 'In' : 'All',
    values,
  };
}

export function buildAdvancedFilter(
  target: FilterTarget,
  operator: AdvancedOperator,
  value?: string | number | boolean | null,
): FilterLike {
  const condition: Record<string, unknown> = { operator };
  if (operator !== 'IsBlank' && operator !== 'IsNotBlank') {
    condition.value = value;
  }
  return {
    $schema: 'https://powerbi.com/product/schema#advanced',
    target,
    logicalOperator: 'And',
    conditions: [condition],
  };
}

export function buildBetweenFilter(
  target: FilterTarget,
  lower: string | number | boolean,
  upper: string | number | boolean,
): FilterLike {
  return {
    $schema: 'https://powerbi.com/product/schema#advanced',
    target,
    logicalOperator: 'And',
    conditions: [
      { operator: 'GreaterThanOrEqual', value: lower },
      { operator: 'LessThanOrEqual', value: upper },
    ],
  };
}

export function buildFiltersFromState(fields: FilterField[], state: FilterPaneState): FilterLike[] {
  const filters: FilterLike[] = [];
  for (const field of fields) {
    const fieldState = state.fields[field.key];
    if (!fieldState) continue;
    if (fieldState.selectedValues.length > 0) {
      filters.push(buildBasicFilter(field.target, fieldState.selectedValues));
    }
  }
  for (const rule of state.advancedRules) {
    const field = fields.find((candidate) => candidate.key === rule.fieldKey);
    if (!field || !rule.isValid) continue;
    if (rule.operator === 'Between' && rule.value !== null && rule.valueTo !== null) {
      filters.push(buildBetweenFilter(field.target, rule.value, rule.valueTo));
    } else if (rule.operator !== 'Between') {
      filters.push(buildAdvancedFilter(field.target, rule.operator, rule.value));
    }
  }
  return filters;
}

export function restoreStateFromFilters(
  state: FilterPaneState,
  fields: FilterField[],
  filters: unknown[] | undefined,
): FilterPaneState {
  const next = ensureFieldState(state, fields);
  if (!filters || filters.length === 0) return next;

  for (const filter of filters as FilterLike[]) {
    const target = filter.target as FilterTarget | undefined;
    if (!target) continue;
    const field = fields.find((candidate) =>
      candidate.target.table === target.table && candidate.target.column === target.column,
    );
    if (!field) continue;
    if (filter.operator === 'In' && Array.isArray(filter.values)) {
      next.fields[field.key] = {
        ...next.fields[field.key],
        selectedValues: filter.values as Array<string | number | boolean>,
        isDirty: false,
      };
    }
  }
  return next;
}

export function getActiveFilterCount(state: FilterPaneState): number {
  const basicCount = Object.values(state.fields).filter((field) => field.selectedValues.length > 0).length;
  const advancedCount = state.advancedRules.filter((rule) => rule.isValid).length;
  return basicCount + advancedCount;
}
```

- [ ] **Step 4: Run model tests**

Run:

```bash
npx vitest run packages/filter-pane-pro/src/__tests__/filter-model.test.ts
```

Expected: all filter model tests pass.

---

### Task 5: Basic Pane UI

**Files:**
- Modify: `packages/filter-pane-pro/src/visual.ts`
- Modify: `packages/filter-pane-pro/style/visual.less`
- Test: `packages/filter-pane-pro/src/__tests__/visual.test.ts`

- [ ] **Step 1: Add failing UI tests**

Extend `visual.test.ts` with:

```ts
it('renders a glass filter button with an active-count aware label', () => {
  visual.update(createUpdateOptions([buildFilterDataView()]) as never);

  const button = constructorOpts.element.querySelector<HTMLButtonElement>('.filter-pane-trigger');
  expect(button).not.toBeNull();
  expect(button!.getAttribute('aria-label')).toBe('Open filters. 0 active filters.');
  expect(button!.querySelector('svg')).not.toBeNull();
});

it('opens a larger pane with Basic selected by default', () => {
  visual.update(createUpdateOptions([buildFilterDataView()]) as never);

  constructorOpts.element
    .querySelector<HTMLButtonElement>('.filter-pane-trigger')!
    .dispatchEvent(new MouseEvent('click', { bubbles: true }));

  expect(constructorOpts.element.querySelector('.filter-pane-backdrop')).not.toBeNull();
  expect(constructorOpts.element.querySelector('.filter-pane-panel')).not.toBeNull();
  expect(constructorOpts.element.querySelector('[data-tab="basic"]')?.getAttribute('aria-selected')).toBe('true');
  expect(constructorOpts.element.querySelector('.filter-basic-card')?.textContent).toContain('Region');
});

it('switches to Advanced and shows a rule composer', () => {
  visual.update(createUpdateOptions([buildFilterDataView()]) as never);
  constructorOpts.element.querySelector<HTMLButtonElement>('.filter-pane-trigger')!.click();
  constructorOpts.element.querySelector<HTMLButtonElement>('[data-tab="advanced"]')!.click();

  expect(constructorOpts.element.querySelector('[data-tab="advanced"]')?.getAttribute('aria-selected')).toBe('true');
  expect(constructorOpts.element.querySelector('.filter-advanced-composer')?.textContent).toContain('Add rule');
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npx vitest run packages/filter-pane-pro/src/__tests__/visual.test.ts
```

Expected: UI tests fail because real render is not implemented.

- [ ] **Step 3: Implement UI render**

Replace `visual.ts` placeholder with a full class that:

- Populates settings.
- Extracts fields.
- Keeps state as a private member.
- Renders button, backdrop, pane, Basic tab, Advanced tab placeholder, and footer.
- Uses `getActiveFilterCount`.
- Handles click, tab switching, checkbox toggles, close, and Escape.

Use these method names so later tasks can build on them:

```ts
private render(fields: FilterField[]): void
private renderTrigger(activeCount: number): HTMLButtonElement
private renderOpenPane(fields: FilterField[], activeCount: number): void
private renderTabs(panel: HTMLElement): void
private renderBasicTab(body: HTMLElement, fields: FilterField[]): void
private renderAdvancedTab(body: HTMLElement, fields: FilterField[]): void
private renderFooter(panel: HTMLElement, fields: FilterField[]): void
private setActiveTab(tab: FilterPaneTab, fields: FilterField[]): void
private setPaneOpen(isOpen: boolean, fields: FilterField[]): void
```

The first advanced tab implementation can render a professional shell with field/operator/value controls and an `Add rule` button; Task 7 wires its payload behavior.

- [ ] **Step 4: Implement LESS**

Add styles for:

- `.filter-pane-pro`
- `.filter-pane-trigger`
- `.filter-pane-trigger--glass`
- `.filter-pane-badge`
- `.filter-pane-backdrop`
- `.filter-pane-panel`
- `.filter-pane-tabs`
- `.filter-pane-tab`
- `.filter-basic-card`
- `.filter-value-row`
- `.filter-advanced-composer`
- `.filter-pane-footer`

The default design should use restrained glass surfaces, a dark blurred backdrop, 8px-or-less inner control radius where appropriate, and no one-note purple/blue palette.

- [ ] **Step 5: Run UI tests**

Run:

```bash
npx vitest run packages/filter-pane-pro/src/__tests__/visual.test.ts
```

Expected: UI tests pass.

---

### Task 6: Apply And Clear Basic Filters

**Files:**
- Modify: `packages/filter-pane-pro/src/visual.ts`
- Test: `packages/filter-pane-pro/src/__tests__/visual.test.ts`

- [ ] **Step 1: Add failing apply/clear tests**

Add:

```ts
it('applies selected basic values as an IFilter array', () => {
  visual.update(createUpdateOptions([buildFilterDataView()]) as never);
  constructorOpts.element.querySelector<HTMLButtonElement>('.filter-pane-trigger')!.click();

  const north = Array.from(constructorOpts.element.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
    .find((input) => input.value === 'North')!;
  north.click();
  constructorOpts.element.querySelector<HTMLButtonElement>('.filter-pane-apply')!.click();

  const applied = getAppliedJsonFilters().at(-1)!;
  expect(applied.objectName).toBe('general');
  expect(applied.propertyName).toBe('filter');
  expect(applied.action).toBe(0);
  expect(applied.filter).toEqual([
    expect.objectContaining({
      operator: 'In',
      values: ['North'],
      target: { table: 'Region', column: 'Region' },
    }),
  ]);
});

it('clears filters with a remove action and resets the badge', () => {
  visual.update(createUpdateOptions([buildFilterDataView()]) as never);
  constructorOpts.element.querySelector<HTMLButtonElement>('.filter-pane-trigger')!.click();
  Array.from(constructorOpts.element.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
    .find((input) => input.value === 'North')!
    .click();
  constructorOpts.element.querySelector<HTMLButtonElement>('.filter-pane-clear')!.click();

  const applied = getAppliedJsonFilters().at(-1)!;
  expect(applied.filter).toBeNull();
  expect(applied.action).toBe(1);
  expect(constructorOpts.element.querySelector('.filter-pane-badge')).toBeNull();
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npx vitest run packages/filter-pane-pro/src/__tests__/visual.test.ts
```

Expected: fails until Apply/Clear call `host.applyJsonFilter`.

- [ ] **Step 3: Implement basic apply/clear**

In `visual.ts` add:

```ts
private applyFilters(fields: FilterField[]): void {
  const filters = buildFiltersFromState(fields, this.state);
  this.host.applyJsonFilter(
    filters.length > 0 ? filters as powerbi.IFilter[] : null as unknown as powerbi.IFilter,
    'general',
    'filter',
    filters.length > 0 ? powerbi.FilterAction.merge : powerbi.FilterAction.remove,
  );
}

private clearFilters(fields: FilterField[]): void {
  this.state = createInitialState(this.state.activeTab, this.state.isOpen);
  this.state = ensureFieldState(this.state, fields);
  this.host.applyJsonFilter(null as unknown as powerbi.IFilter, 'general', 'filter', powerbi.FilterAction.remove);
  this.render(fields);
}
```

Wire `.filter-pane-apply` to `applyFilters(fields)` and `.filter-pane-clear` to `clearFilters(fields)`. When `applyMode` is `immediate`, call `applyFilters(fields)` after a checkbox change.

- [ ] **Step 4: Run apply/clear tests**

Run:

```bash
npx vitest run packages/filter-pane-pro/src/__tests__/visual.test.ts
```

Expected: basic apply and clear tests pass.

---

### Task 7: Advanced Rule Builder

**Files:**
- Modify: `packages/filter-pane-pro/src/filter-model.ts`
- Modify: `packages/filter-pane-pro/src/visual.ts`
- Test: `packages/filter-pane-pro/src/__tests__/visual.test.ts`
- Test: `packages/filter-pane-pro/src/__tests__/filter-model.test.ts`

- [ ] **Step 1: Add failing advanced tests**

Add to `filter-model.test.ts`:

```ts
it('builds a readable advanced rule display', () => {
  const fields = extractFilterFields(dataView() as never);
  const field = fields.find((candidate) => candidate.displayName === 'Status')!;
  expect(createAdvancedRule('rule-1', field, 'Contains', 'Open')).toMatchObject({
    display: 'Status contains Open',
    isValid: true,
  });
});
```

Add to `visual.test.ts`:

```ts
it('adds an advanced text rule and applies it as an advanced filter', () => {
  visual.update(createUpdateOptions([buildFilterDataView()]) as never);
  constructorOpts.element.querySelector<HTMLButtonElement>('.filter-pane-trigger')!.click();
  constructorOpts.element.querySelector<HTMLButtonElement>('[data-tab="advanced"]')!.click();

  const field = constructorOpts.element.querySelector<HTMLSelectElement>('.filter-advanced-field')!;
  field.value = 'Status.Status';
  field.dispatchEvent(new Event('change', { bubbles: true }));

  const operator = constructorOpts.element.querySelector<HTMLSelectElement>('.filter-advanced-operator')!;
  operator.value = 'Contains';
  operator.dispatchEvent(new Event('change', { bubbles: true }));

  const value = constructorOpts.element.querySelector<HTMLInputElement>('.filter-advanced-value')!;
  value.value = 'Open';
  value.dispatchEvent(new Event('input', { bubbles: true }));

  constructorOpts.element.querySelector<HTMLButtonElement>('.filter-advanced-add')!.click();
  expect(constructorOpts.element.querySelector('.filter-rule-row')?.textContent).toContain('Status contains Open');

  constructorOpts.element.querySelector<HTMLButtonElement>('.filter-pane-apply')!.click();
  expect(getAppliedJsonFilters().at(-1)!.filter).toEqual([
    expect.objectContaining({
      $schema: 'https://powerbi.com/product/schema#advanced',
      conditions: [{ operator: 'Contains', value: 'Open' }],
    }),
  ]);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npx vitest run packages/filter-pane-pro/src/__tests__/filter-model.test.ts packages/filter-pane-pro/src/__tests__/visual.test.ts
```

Expected: advanced tests fail.

- [ ] **Step 3: Implement advanced rule helper**

Add to `filter-model.ts`:

```ts
const OPERATOR_LABELS: Record<string, string> = {
  Is: 'equals',
  IsNot: 'does not equal',
  Contains: 'contains',
  DoesNotContain: 'does not contain',
  StartsWith: 'starts with',
  GreaterThan: 'is greater than',
  GreaterThanOrEqual: 'is greater than or equal to',
  LessThan: 'is less than',
  LessThanOrEqual: 'is less than or equal to',
  Between: 'is between',
  IsBlank: 'is blank',
  IsNotBlank: 'is not blank',
};

export function createAdvancedRule(
  id: string,
  field: FilterField,
  operator: AdvancedRuleState['operator'],
  value: string | number | boolean | null,
  valueTo: string | number | boolean | null = null,
): AdvancedRuleState {
  const needsValue = operator !== 'IsBlank' && operator !== 'IsNotBlank';
  const isBetween = operator === 'Between';
  const isValid = isBetween
    ? value !== null && valueTo !== null
    : (!needsValue || value !== null);
  const valueText = isBetween ? `${value} and ${valueTo}` : value;
  return {
    id,
    fieldKey: field.key,
    operator,
    value,
    valueTo,
    isValid,
    display: needsValue
      ? `${field.displayName} ${OPERATOR_LABELS[operator]} ${valueText}`
      : `${field.displayName} ${OPERATOR_LABELS[operator]}`,
  };
}
```

- [ ] **Step 4: Implement advanced composer UI**

In `visual.ts`, make `renderAdvancedTab` render:

- `<select class="filter-advanced-field">`
- `<select class="filter-advanced-operator">`
- `<input class="filter-advanced-value">`
- `<input class="filter-advanced-value-to">` shown only for Between
- `<button class="filter-advanced-add">Add rule</button>`
- `.filter-rule-row` list with remove buttons

Use `createAdvancedRule` and append to `this.state.advancedRules`.

- [ ] **Step 5: Run advanced tests**

Run:

```bash
npx vitest run packages/filter-pane-pro/src/__tests__/filter-model.test.ts packages/filter-pane-pro/src/__tests__/visual.test.ts
```

Expected: advanced rule tests pass.

---

### Task 8: Bookmark Restore And Accessibility Polish

**Files:**
- Modify: `packages/filter-pane-pro/src/visual.ts`
- Modify: `packages/filter-pane-pro/src/__tests__/visual.test.ts`
- Modify: `packages/filter-pane-pro/style/visual.less`

- [ ] **Step 1: Add failing restore/accessibility tests**

Add:

```ts
it('restores bookmark-linked basic filters from jsonFilters', () => {
  const dv = buildFilterDataView();
  const options = createUpdateOptions([dv]) as Record<string, unknown>;
  options.jsonFilters = [{
    $schema: 'https://powerbi.com/product/schema#basic',
    target: { table: 'Region', column: 'Region' },
    operator: 'In',
    values: ['West'],
  }];

  visual.update(options as never);
  constructorOpts.element.querySelector<HTMLButtonElement>('.filter-pane-trigger')!.click();

  const west = Array.from(constructorOpts.element.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
    .find((input) => input.value === 'West')!;
  expect(west.checked).toBe(true);
  expect(constructorOpts.element.querySelector('.filter-pane-badge')?.textContent).toBe('1');
});

it('closes the pane on Escape', () => {
  visual.update(createUpdateOptions([buildFilterDataView()]) as never);
  constructorOpts.element.querySelector<HTMLButtonElement>('.filter-pane-trigger')!.click();
  constructorOpts.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(constructorOpts.element.querySelector('.filter-pane-panel')).toBeNull();
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npx vitest run packages/filter-pane-pro/src/__tests__/visual.test.ts
```

Expected: restore/Escape tests fail.

- [ ] **Step 3: Implement restore and Escape**

In `visual.update`:

```ts
const fields = extractFilterFields(dataView);
this.state = ensureFieldState(this.state, fields);
if (resolveDropdown(this.settings.behaviorSettings.persistenceMode) === 'bookmark') {
  this.state = restoreStateFromFilters(this.state, fields, (options as VisualUpdateOptions & { jsonFilters?: unknown[] }).jsonFilters);
}
this.render(fields);
```

In constructor or render root:

```ts
this.container.addEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape' && this.lastFields.length > 0) {
    this.setPaneOpen(false, this.lastFields);
  }
});
```

Make the container focusable with `tabIndex = 0` and add button aria labels.

- [ ] **Step 4: Polish CSS**

Ensure:

- Backdrop uses `backdrop-filter: blur(...)`.
- Panel width respects `min(100%, configuredWidth)`.
- Text truncates cleanly.
- Buttons have hover and focus-visible states.
- The palette uses dark glass, neutral whites, cyan accent, and warning amber sparingly.

- [ ] **Step 5: Run restore/accessibility tests**

Run:

```bash
npx vitest run packages/filter-pane-pro/src/__tests__/visual.test.ts
```

Expected: all visual tests pass.

---

### Task 9: Final Coverage, Lockfile, Build, And Sync

**Files:**
- Modify: `package-lock.json`
- Generated: `packages/filter-pane-pro/dist/*.pbiviz`
- Generated: `Business_Package/filterPanePro_5E9A1C7D3F2B.1.0.1.0.pbiviz`
- Generated: `LotusWorks_Package/filterPanePro_5E9A1C7D3F2B.1.0.1.0.pbiviz`

- [ ] **Step 1: Update package-lock for the new workspace**

Run:

```bash
npm install --package-lock-only
```

Expected: `package-lock.json` gains `node_modules/@pbi/filter-pane-pro` and `packages/filter-pane-pro` entries with version `1.0.1`.

- [ ] **Step 2: Run focused tests**

Run:

```bash
npx vitest run packages/filter-pane-pro/src/__tests__/filter-model.test.ts packages/filter-pane-pro/src/__tests__/visual.test.ts packages/filter-pane-pro/src/__tests__/formatting-coverage.test.ts
```

Expected: all Filter Pane Pro tests pass.

- [ ] **Step 3: Run full typecheck**

Run:

```bash
npm run typecheck
```

Expected: `tsc --noEmit -p tsconfig.base.json` exits 0.

- [ ] **Step 4: Build the package**

Run:

```bash
rm -f packages/filter-pane-pro/dist/*.pbiviz
npm run build -w @pbi/filter-pane-pro
```

Expected: `packages/filter-pane-pro/dist/filterPanePro_5E9A1C7D3F2B.1.0.1.0.pbiviz` exists.

- [ ] **Step 5: Sync package folders and review**

Run:

```bash
npm run sync:business
npm run sync:lotusworks
npm run review:business
```

Expected:

- `Business_Package/filterPanePro_5E9A1C7D3F2B.1.0.1.0.pbiviz` exists.
- `LotusWorks_Package/filterPanePro_5E9A1C7D3F2B.1.0.1.0.pbiviz` exists.
- Business package review reports `warnings=0, errors=0`.

- [ ] **Step 6: Final verification**

Run:

```bash
npx vitest run packages/filter-pane-pro/src/__tests__/filter-model.test.ts packages/filter-pane-pro/src/__tests__/visual.test.ts packages/filter-pane-pro/src/__tests__/formatting-coverage.test.ts && npm run typecheck && test -f packages/filter-pane-pro/dist/filterPanePro_5E9A1C7D3F2B.1.0.1.0.pbiviz && test -f Business_Package/filterPanePro_5E9A1C7D3F2B.1.0.1.0.pbiviz && test -f LotusWorks_Package/filterPanePro_5E9A1C7D3F2B.1.0.1.0.pbiviz
```

Expected: command exits 0.

---

## Self-Review

Spec coverage:

- Standalone package: Task 2 and Task 9.
- Glass icon and blurred stained-glass backdrop: Task 5 and Task 8.
- Larger premium pane: Task 5 CSS and Task 8 polish.
- Basic tab normal filters: Task 5 and Task 6.
- Advanced tab rule builder: Task 7.
- Apply/Clear through Power BI filter API: Task 6.
- Bookmark-linked restore from `jsonFilters`: Task 8.
- Manual session avoids cross-tab sync: Task 3 settings and Task 8 update behavior.
- Formatting settings: Task 3 and Task 9 coverage.
- Build/sync/review: Task 9.

No placeholder tasks remain. The only deliberate V1 limitation is measure filtering being best-effort through available filter targets, matching the approved spec.
