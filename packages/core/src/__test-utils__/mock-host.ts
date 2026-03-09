/**
 * Mock IVisualHost factory for Power BI visual tests.
 */

const PALETTE_COLORS = [
  '#4E79A7', '#F28E2B', '#E15759', '#76B7B2',
  '#59A14F', '#EDC948', '#B07AA1', '#FF9DA7',
];

let colorIndex = 0;

function nextColor(): string {
  return PALETTE_COLORS[colorIndex++ % PALETTE_COLORS.length];
}

function createMockSelectionId(): Record<string, unknown> {
  return {
    equals: () => false,
    includes: () => false,
    getKey: () => JSON.stringify({ key: Math.random() }),
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
  return {
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
    get: (key: string) => key,
  };
}

/**
 * Creates a mock IVisualHost with all required methods and services.
 */
export function createMockHost(): Record<string, unknown> {
  colorIndex = 0;
  return {
    createSelectionIdBuilder: () => createMockSelectionIdBuilder(),
    createSelectionManager: () => createMockSelectionManager(),
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
    applyJsonFilter: () => {},
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
