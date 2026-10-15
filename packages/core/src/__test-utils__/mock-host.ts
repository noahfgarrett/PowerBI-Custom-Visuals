/**
 * Mock IVisualHost factory for Power BI visual tests.
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PALETTE_COLORS = [
  '#4E79A7', '#F28E2B', '#E15759', '#76B7B2',
  '#59A14F', '#EDC948', '#B07AA1', '#FF9DA7',
];

let colorIndex = 0;
let selectionIdIndex = 0;

const LOCALIZATION_VALUES = loadLocalizationValues();

function nextColor(): string {
  return PALETTE_COLORS[colorIndex++ % PALETTE_COLORS.length];
}

function createMockSelectionId(): Record<string, unknown> {
  const key = `selection-${selectionIdIndex++}`;
  return {
    equals: () => false,
    includes: () => false,
    getKey: () => key,
    getSelector: () => ({}),
    getSelectorsByColumn: () => ({}),
    hasIdentity: () => false,
  };
}

function createMockSelectionIdBuilder(): Record<string, unknown> {
  const builder: Record<string, unknown> = {};
  const chainMethods = [
    'withCategory', 'withSeries', 'withMeasure',
    'withMatrixNode', 'withTable',
  ];
  for (const method of chainMethods) {
    builder[method] = () => builder;
  }
  builder.createSelectionId = () => createMockSelectionId();
  return builder;
}

function createMockSelectionManager(): Record<string, unknown> {
  let selection: unknown[] = [];
  const manager: Record<string, unknown> = {
    select: (id: unknown) => {
      selection = Array.isArray(id) ? id : [id];
      return Promise.resolve(selection);
    },
    clear: () => {
      selection = [];
      return Promise.resolve();
    },
    getSelectionIds: () => selection,
    hasSelection: () => selection.length > 0,
    registerOnSelectCallback: () => {},
    showContextMenu: () => Promise.resolve(),
    containsSelection: () => false,
    applySelectionFilter: () => {},
  };
  manager.__selectionState = () => selection;
  return manager;
}

function createMockTooltipService(): Record<string, unknown> {
  return {
    show: () => {},
    move: () => {},
    hide: () => {},
    enabled: () => true,
  };
}

function createMockEventService(): Record<string, unknown> {
  return {
    renderingStarted: () => {},
    renderingFinished: () => {},
    renderingFailed: () => {},
  };
}

function createMockColorPalette(): Record<string, unknown> {
  return {
    getColor: (key: string) => ({ value: nextColor() }),
    reset: () => { colorIndex = 0; },
    isHighContrast: false,
    foreground: { value: '#333333' },
    foregroundSelected: { value: '#333333' },
    foregroundNeutral: { value: '#333333' },
    background: { value: '#FFFFFF' },
    hyperlink: { value: '#0000FF' },
    tableHeader: { value: '#E8E8E8' },
    tableHeaderFont: { value: '#333333' },
  };
}

function createMockLocale(): Record<string, unknown> {
  return {
    get: (key: string) => LOCALIZATION_VALUES[key] ?? key,
    getDisplayName: (key: string) => LOCALIZATION_VALUES[key] ?? key,
  };
}

function loadLocalizationValues(): Record<string, string> {
  try {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../');
    const packagesRoot = path.join(repoRoot, 'packages');
    const result: Record<string, string> = {};
    for (const entry of readdirSync(packagesRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const resourceFile = path.join(packagesRoot, entry.name, 'stringResources', 'en-US', 'resources.resjson');
      try {
        const json = JSON.parse(readFileSync(resourceFile, 'utf8')) as {
          values?: Record<string, string>;
        };
        Object.assign(result, json.values ?? {});
      } catch {
        // Skip packages that don't have generated string resources yet.
      }
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * Creates a mock IVisualHost with all required methods and services.
 */
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
