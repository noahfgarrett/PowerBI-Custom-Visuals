import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NetworkGraphVisual } from '../visual';
import { NetworkGraphSettings } from '../settings';
import {
  createConstructorOptions,
  createUpdateOptions,
  DataViewBuilder,
} from '../../../core/src/__test-utils__';

const settingsRef: { current: unknown } = { current: undefined };

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
      ImageUpload: class { constructor(init: Record<string, unknown>) { Object.assign(this, init); } },
      ItemDropdown: class { constructor(init: Record<string, unknown>) { Object.assign(this, init); } },
    },
    FormattingSettingsService: class {
      populateFormattingSettingsModel(ModelClass: new () => unknown, _dv: unknown) {
        if (settingsRef.current) {
          const ref = settingsRef.current;
          settingsRef.current = undefined;
          return ref;
        }
        return new ModelClass();
      }
      buildFormattingModel(settings: { cards: unknown[] }) { return { cards: settings.cards?.map((c: unknown) => ({ displayName: (c as Record<string, unknown>)['displayName'], name: (c as Record<string, unknown>)['name'] })) ?? [] }; }
    },
  };
});

let visual: NetworkGraphVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new NetworkGraphVisual(constructorOpts as never);
});

afterEach(() => {
  settingsRef.current = undefined;
  visual.destroy();
  constructorOpts.element.remove();
});

function getNodePosition(nodeId: string): { x: number; y: number } {
  const node = constructorOpts.element.querySelector<SVGCircleElement>(`.network-node[data-node="${nodeId}"]`);
  expect(node).not.toBeNull();
  return {
    x: Number(node?.getAttribute('cx')),
    y: Number(node?.getAttribute('cy')),
  };
}

function getTargetNodePositionByLabel(label: string): { x: number; y: number } {
  const node = constructorOpts.element.querySelector<SVGCircleElement>(`.network-node[data-role="target"][data-label="${label}"]`);
  expect(node).not.toBeNull();
  return {
    x: Number(node?.getAttribute('cx')),
    y: Number(node?.getAttribute('cy')),
  };
}

function span(values: number[]): number {
  return Math.max(...values) - Math.min(...values);
}

function renderSingleLinkDistance(linkDistance: number): number {
  const settings = new NetworkGraphSettings();
  settings.animationSettings.enabled.value = false;
  settings.interactionSettings.enableZoom.value = false;
  settings.physicsAndLayoutSettings.linkDistance.value = linkDistance;
  settings.physicsAndLayoutSettings.strength.value = 1;
  settings.physicsAndLayoutSettings.chargeStrength.value = 0;
  settings.physicsAndLayoutSettings.enableCollision.value = false;
  settings.physicsAndLayoutSettings.autoCenter.value = false;
  settings.physicsAndLayoutSettings.fitOnLoad.value = false;
  settings.physicsAndLayoutSettings.settleTicks.value = 300;
  settingsRef.current = settings;

  const dv = DataViewBuilder.relational([
    { source: 'Building A', target: 'Spec 1', weight: 125 },
  ]);

  try {
    visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
  } catch {
    // d3-timer may throw in JSDOM; settled node positions are what this test verifies.
  }

  const source = getNodePosition('Building A');
  const target = getNodePosition('Spec 1');
  return Math.hypot(target.x - source.x, target.y - source.y);
}

function applyMapCanvasSettings(settings: NetworkGraphSettings, overrides: Record<string, unknown> = {}): void {
  Object.assign(settings as unknown as Record<string, unknown>, {
    mapCanvasSettings: {
      enabled: { value: true },
      showUploadControl: { value: false },
      imageSource: { value: '' },
      imageFit: { value: { value: 'contain', displayName: 'Contain' } },
      horizontalAlign: { value: { value: 'center', displayName: 'Center' } },
      verticalAlign: { value: { value: 'middle', displayName: 'Middle' } },
      imageOpacity: { value: 100 },
      dimOverlayOpacity: { value: 0 },
      targetLayoutPreset: { value: { value: 'orbit', displayName: 'Orbit Sources' } },
      targetOrbitRadius: { value: 40 },
      targetRailPosition: { value: { value: 'right', displayName: 'Right' } },
      persistedSourcePositions: { value: '' },
      resetPositions: { value: false },
      ...overrides,
    },
  });
}

function applyMeasureBadgeSettings(settings: NetworkGraphSettings, overrides: Record<string, unknown> = {}): void {
  Object.assign(settings as unknown as Record<string, unknown>, {
    measureBadgeSettings: {
      showBadges: { value: true },
      badgeMeasureName: { value: '' },
      badgeDisplayMode: { value: { value: 'value', displayName: 'Value' } },
      badgeFontSize: { value: 11 },
      badgeColor: { value: { value: '#0F172A' } },
      badgeBackgroundColor: { value: { value: '#FFFFFF' } },
      badgeBackgroundOpacity: { value: 90 },
      badgeOffset: { value: 16 },
      ...overrides,
    },
  });
}

function applyNodeInspectorSettings(settings: NetworkGraphSettings, overrides: Record<string, unknown> = {}): void {
  Object.assign(settings as unknown as Record<string, unknown>, {
    nodeInspectorSettings: {
      enabled: { value: true },
      position: { value: { value: 'right', displayName: 'Right' } },
      showCoreMetrics: { value: true },
      showDetailMeasures: { value: true },
      showDetailColumns: { value: true },
      maxDetailValues: { value: 4 },
      focusOnClick: { value: true },
      focusZoomScale: { value: 1.55 },
      ...overrides,
    },
  });
}

describe('NetworkGraphVisual', () => {
  it('constructs without error', () => {
    expect(visual).toBeDefined();
  });

  it('handles empty data', () => {
    const dv = DataViewBuilder.empty();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  // d3-force simulation uses d3-timer internally which conflicts with
  // synchronous rAF stubs in JSDOM. We catch the timer error gracefully.
  it('renders sample data without fatal crash', () => {
    const dv = DataViewBuilder.relational([{source:'A',target:'B',weight:5},{source:'B',target:'C',weight:10}]);
    try {
      visual.update(createUpdateOptions([dv]) as never);
    } catch {
      // d3-timer may throw in JSDOM — acceptable for smoke test
    }
    // Visual should still have created some DOM structure
    expect(constructorOpts.element.innerHTML.length).toBeGreaterThan(0);
  });

  it('returns formatting model', () => {
    const dv = DataViewBuilder.relational([{source:'A',target:'B',weight:5},{source:'B',target:'C',weight:10}]);
    try { visual.update(createUpdateOptions([dv]) as never); } catch { /* d3-timer */ }
    const model = visual.getFormattingModel();
    expect(model).toBeDefined();
  });

  it('re-renders without fatal crash', () => {
    const dv = DataViewBuilder.relational([{source:'A',target:'B',weight:5},{source:'B',target:'C',weight:10}]);
    try { visual.update(createUpdateOptions([dv]) as never); } catch { /* d3-timer */ }
    try { visual.update(createUpdateOptions([dv]) as never); } catch { /* d3-timer */ }
    expect(constructorOpts.element.innerHTML.length).toBeGreaterThan(0);
  });

  it('supports hover-only label visibility', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.nodeSettings.labelVisibility.value = { value: 'hover', displayName: 'Hover' };
    settingsRef.current = settings;
    const dv = DataViewBuilder.relational([{source:'A',target:'B',weight:5},{source:'B',target:'C',weight:10}]);
    try { visual.update(createUpdateOptions([dv]) as never); } catch { /* d3-timer */ }
    const label = constructorOpts.element.querySelector('.network-label') as SVGTextElement | null;
    expect(label?.style.opacity).toBe('0');
  });

  it('settles and centers the graph on the first render', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    settingsRef.current = settings;

    const dv = DataViewBuilder.relational([
      { source: 'Building A', target: 'Spec 1', weight: 125 },
      { source: 'Building A', target: 'Spec 2', weight: 72 },
      { source: 'Building B', target: 'Spec 1', weight: 44 },
      { source: 'Building C', target: 'Spec 3', weight: 88 },
    ]);

    try {
      visual.update(createUpdateOptions([dv], { width: 640, height: 420 }) as never);
    } catch {
      // d3-timer may throw in JSDOM — the DOM should still represent the first frame.
    }

    const svg = constructorOpts.element.querySelector('svg.network-svg') as SVGSVGElement | null;
    const nodes = Array.from(constructorOpts.element.querySelectorAll<SVGCircleElement>('.network-node'));
    expect(svg).not.toBeNull();
    expect(nodes.length).toBeGreaterThan(0);

    const xs = nodes.map((node) => Number(node.getAttribute('cx')));
    const ys = nodes.map((node) => Number(node.getAttribute('cy')));
    expect(xs.every(Number.isFinite)).toBe(true);
    expect(ys.every(Number.isFinite)).toBe(true);

    const boundsCenterX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const boundsCenterY = (Math.min(...ys) + Math.max(...ys)) / 2;
    const expectedCenterX = (Number(svg?.getAttribute('width')) - 16) / 2;
    const expectedCenterY = (Number(svg?.getAttribute('height')) - 16) / 2;

    expect(Math.abs(boundsCenterX - expectedCenterX)).toBeLessThan(45);
    expect(Math.abs(boundsCenterY - expectedCenterY)).toBeLessThan(45);
  });

  it('uses link distance to pull connected nodes closer in source-target layout', () => {
    const tightDistance = renderSingleLinkDistance(40);
    const looseDistance = renderSingleLinkDistance(240);

    expect(tightDistance).toBeLessThan(looseDistance * 0.65);
  });

  it('does not compress the node layout to fit long outside labels', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    settings.nodeSettings.maxLabelCharacters.value = 220;
    settingsRef.current = settings;
    const longBuildingSuffix = ' '.repeat(1) + 'Long Building Label Segment'.repeat(7);
    const longSpecSuffix = ' '.repeat(1) + 'Long Pipe Specification Segment'.repeat(7);

    const dv = DataViewBuilder.relational([
      { source: `Building Alpha${longBuildingSuffix}`, target: `Pipe Spec Stainless${longSpecSuffix}`, weight: 125 },
      { source: `Building Beta${longBuildingSuffix}`, target: `Pipe Spec Carbon${longSpecSuffix}`, weight: 72 },
      { source: `Building Gamma${longBuildingSuffix}`, target: `Pipe Spec Copper${longSpecSuffix}`, weight: 44 },
      { source: `Building Delta${longBuildingSuffix}`, target: `Pipe Spec PVC${longSpecSuffix}`, weight: 88 },
    ]);

    try {
      visual.update(createUpdateOptions([dv], { width: 640, height: 420 }) as never);
    } catch {
      // d3-timer may throw in JSDOM — the DOM should still represent the first frame.
    }

    const nodes = Array.from(constructorOpts.element.querySelectorAll<SVGCircleElement>('.network-node'));
    const xs = nodes.map((node) => Number(node.getAttribute('cx')));
    const ys = nodes.map((node) => Number(node.getAttribute('cy')));
    const xSpan = Math.max(...xs) - Math.min(...xs);
    const ySpan = Math.max(...ys) - Math.min(...ys);

    expect(Math.max(xSpan, ySpan)).toBeGreaterThan(180);
  });

  it('spreads source buildings and target pipe specs into readable lanes', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    settingsRef.current = settings;

    const dv = DataViewBuilder.relational([
      { source: 'Building A', target: 'Spec Alpha', weight: 125 },
      { source: 'Building A', target: 'Spec Beta', weight: 72 },
      { source: 'Building B', target: 'Spec Alpha', weight: 44 },
      { source: 'Building B', target: 'Spec Gamma', weight: 88 },
      { source: 'Building C', target: 'Spec Beta', weight: 61 },
      { source: 'Building D', target: 'Spec Delta', weight: 39 },
    ]);

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM — the DOM should still represent the settled frame.
    }

    const sources = ['Building A', 'Building B', 'Building C', 'Building D'].map(getNodePosition);
    const targets = ['Spec Alpha', 'Spec Beta', 'Spec Gamma', 'Spec Delta'].map(getNodePosition);
    const sourceCenterX = sources.reduce((sum, point) => sum + point.x, 0) / sources.length;
    const targetCenterX = targets.reduce((sum, point) => sum + point.x, 0) / targets.length;

    expect(targetCenterX - sourceCenterX).toBeGreaterThan(180);
    expect(Math.min(...targets.map((point) => point.x))).toBeGreaterThan(Math.max(...sources.map((point) => point.x)));
    expect(span(sources.map((point) => point.y))).toBeGreaterThan(120);
    expect(span(targets.map((point) => point.y))).toBeGreaterThan(120);
  });

  it('renders every populated target field as a target node connected to the source', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    Object.assign(settings.colorsAndThemeSettings as unknown as Record<string, { value: unknown }>, {
      colorByNodeRole: { value: true },
      targetNodeColor: { value: { value: '#059669' } },
    });
    settingsRef.current = settings;

    const dv = new DataViewBuilder()
      .withCategory('Source', ['Building A'], 'source')
      .withCategory('Pipe Spec', ['Spec Alpha'], 'target')
      .withCategory('Issue Type', ['Weld Issue'], 'target')
      .withValues('Weight', [1], 'weight')
      .build();

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; multi-target DOM is what this test verifies.
    }

    const specTarget = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-role="target"][data-node="Spec Alpha"]');
    const issueTarget = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-role="target"][data-node="Weld Issue"]');
    expect(specTarget).not.toBeNull();
    expect(issueTarget).not.toBeNull();
    expect(specTarget?.getAttribute('fill')).toBe('#059669');
    expect(issueTarget?.getAttribute('fill')).toBe('#059669');
    expect(constructorOpts.element.querySelector('.network-link[data-source="Building A"][data-target="Spec Alpha"]')).not.toBeNull();
    expect(constructorOpts.element.querySelector('.network-link[data-source="Building A"][data-target="Weld Issue"]')).not.toBeNull();
  });

  it('keeps default links visible and fixed width when weight scaling is off', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    settingsRef.current = settings;

    const dv = DataViewBuilder.relational([
      { source: 'Building A', target: 'Spec Alpha', weight: 5 },
      { source: 'Building B', target: 'Spec Beta', weight: 100 },
    ]);

    try {
      visual.update(createUpdateOptions([dv], { width: 620, height: 380 }) as never);
    } catch {
      // d3-timer may throw in JSDOM — link DOM is what this test verifies.
    }

    const links = Array.from(constructorOpts.element.querySelectorAll<SVGLineElement>('.network-link'));
    expect(links).toHaveLength(2);
    expect(links.every((link) => Number(link.getAttribute('stroke-opacity')) >= 0.65)).toBe(true);
    expect(links.every((link) => Number(link.getAttribute('stroke-width')) >= 1.75)).toBe(true);
    expect(new Set(links.map((link) => link.getAttribute('stroke-width'))).size).toBe(1);
  });

  it('renders a WebP-compatible map background behind the network', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    applyMapCanvasSettings(settings, {
      imageSource: { value: 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AA/vuUAAA=' },
      imageOpacity: { value: 62 },
      dimOverlayOpacity: { value: 18 },
    });
    settingsRef.current = settings;

    const dv = DataViewBuilder.relational([
      { source: 'Building A', target: 'Spec 1', weight: 125 },
    ]);

    try {
      visual.update(createUpdateOptions([dv], { width: 640, height: 420 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; the DOM is what this test verifies.
    }

    const image = constructorOpts.element.querySelector<SVGImageElement>('.network-map-image');
    const dim = constructorOpts.element.querySelector<SVGRectElement>('.network-map-dim');
    const firstLink = constructorOpts.element.querySelector<SVGElement>('.network-link');

    expect(image).not.toBeNull();
    expect(firstLink).not.toBeNull();
    expect(image?.getAttribute('href') || image?.getAttribute('xlink:href')).toContain('data:image/webp');
    expect(image?.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
    expect(image?.getAttribute('opacity')).toBe('0.62');
    expect(dim?.getAttribute('fill-opacity')).toBe('0.18');
    expect(firstLink!.compareDocumentPosition(image as unknown as Node) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it('does not show chart upload controls by default in map canvas mode', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    applyMapCanvasSettings(settings, {
      imageSource: { value: 'data:image/png;base64,SAVED_SITE_MAP' },
    });
    settingsRef.current = settings;

    const dv = DataViewBuilder.relational([
      { source: 'Building A', target: 'Spec 1', weight: 125 },
    ]);

    try {
      visual.update(createUpdateOptions([dv], { width: 640, height: 420 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; the image href is what this test verifies.
    }

    const image = constructorOpts.element.querySelector<SVGImageElement>('.network-map-image');
    const href = image?.getAttribute('href') || image?.getAttribute('xlink:href') || '';
    expect(href).toContain('SAVED_SITE_MAP');
    expect(constructorOpts.element.querySelector('.network-map-upload-button')).toBeNull();
  });

  it('uploads a saved map image through the Map Canvas authoring control and hides it after upload', () => {
    const persistSpy = vi.fn();
    constructorOpts.host.persistProperties = persistSpy;
    const OriginalFileReader = window.FileReader;
    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
      readAsDataURL(_file: Blob): void {
        this.result = 'data:image/webp;base64,SNIPPED_SITE_MAP';
        this.onload?.call(this as unknown as FileReader, {} as ProgressEvent<FileReader>);
      }
    }
    Object.defineProperty(window, 'FileReader', {
      configurable: true,
      value: MockFileReader,
    });

    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    applyMapCanvasSettings(settings, {
      showUploadControl: { value: true },
    });
    settingsRef.current = settings;

    const dv = DataViewBuilder.relational([
      { source: 'Building A', target: 'Spec 1', weight: 125 },
    ]);

    try {
      visual.update(createUpdateOptions([dv], { width: 640, height: 420 }) as never);
      const input = constructorOpts.element.querySelector<HTMLInputElement>('.network-map-upload-input');
      const uploadButton = constructorOpts.element.querySelector<HTMLButtonElement>('.network-map-upload-button');
      expect(input).not.toBeNull();
      expect(uploadButton?.textContent).toBe('Upload Map');

      Object.defineProperty(input, 'files', {
        configurable: true,
        value: [new File(['map'], 'site-map.webp', { type: 'image/webp' })],
      });
      input?.dispatchEvent(new Event('change', { bubbles: true }));
    } catch {
      // d3-timer may throw in JSDOM; the upload persistence is what this test verifies.
    } finally {
      Object.defineProperty(window, 'FileReader', {
        configurable: true,
        value: OriginalFileReader,
      });
    }

    expect(persistSpy).toHaveBeenCalled();
    const call = persistSpy.mock.calls[persistSpy.mock.calls.length - 1]?.[0] as { merge?: Array<{ objectName?: string; properties?: Record<string, unknown> }> };
    expect(call.merge?.[0]?.objectName).toBe('mapCanvasSettings');
    expect(call.merge?.[0]?.properties?.imageSource).toContain('SNIPPED_SITE_MAP');
    expect(call.merge?.[0]?.properties?.showUploadControl).toBe(false);

    const image = constructorOpts.element.querySelector<SVGImageElement>('.network-map-image');
    const href = image?.getAttribute('href') || image?.getAttribute('xlink:href') || '';
    expect(href).toContain('SNIPPED_SITE_MAP');
    expect(constructorOpts.element.querySelector('.network-map-upload-button')).toBeNull();
  });

  it('preserves current map-canvas source coordinates when replacing the background image', () => {
    const persistSpy = vi.fn();
    constructorOpts.host.persistProperties = persistSpy;
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    applyMapCanvasSettings(settings, {
      imageSource: { value: 'data:image/png;base64,OLD_SITE_MAP' },
      persistedSourcePositions: {
        value: JSON.stringify({
          'Building A': { x: 0.31, y: 0.42 },
        }),
      },
    });
    settingsRef.current = settings;

    const dv = DataViewBuilder.relational([
      { source: 'Building A', target: 'Spec 1', weight: 125 },
    ]);

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
      const before = getNodePosition('Building A');
      const mapController = visual as unknown as { persistMapImageSource: (imageSource: string) => void };
      mapController.persistMapImageSource('data:image/png;base64,NEW_SITE_MAP');
      const after = getNodePosition('Building A');

      expect(after.x).toBeCloseTo(before.x, 5);
      expect(after.y).toBeCloseTo(before.y, 5);
    } catch {
      // d3-timer may throw in JSDOM; persisted properties are what this test verifies.
    }

    const call = persistSpy.mock.calls[persistSpy.mock.calls.length - 1]?.[0] as { merge?: Array<{ objectName?: string; properties?: Record<string, unknown> }> };
    expect(call.merge?.[0]?.objectName).toBe('mapCanvasSettings');
    expect(call.merge?.[0]?.properties?.imageSource).toContain('NEW_SITE_MAP');
    expect(typeof call.merge?.[0]?.properties?.persistedSourcePositions).toBe('string');
    const persisted = JSON.parse(call.merge?.[0]?.properties?.persistedSourcePositions as string) as Record<string, { x: number; y: number }>;
    expect(persisted['Building A']?.x).toBeCloseTo(0.31, 2);
    expect(persisted['Building A']?.y).toBeCloseTo(0.42, 2);
  });

  it('uses persisted source positions and places map-canvas targets around their source by default', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    applyMapCanvasSettings(settings, {
      persistedSourcePositions: {
        value: JSON.stringify({
          'Building A': { x: 0.25, y: 0.35 },
          'Building B': { x: 0.55, y: 0.72 },
        }),
      },
    });
    settingsRef.current = settings;

    const dv = DataViewBuilder.relational([
      { source: 'Building A', target: 'Spec 1', weight: 125 },
      { source: 'Building A', target: 'Spec 3', weight: 25 },
      { source: 'Building B', target: 'Spec 2', weight: 72 },
    ]);

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; node positions are what this test verifies.
    }

    const buildingA = getNodePosition('Building A');
    const buildingB = getNodePosition('Building B');
    const spec1 = getNodePosition('Building A::Spec 1');
    const spec3 = getNodePosition('Building A::Spec 3');
    const spec2 = getNodePosition('Building B::Spec 2');
    const svg = constructorOpts.element.querySelector<SVGSVGElement>('svg.network-svg');
    const expectedInnerWidth = Number(svg?.getAttribute('width')) - 16;
    const expectedInnerHeight = Number(svg?.getAttribute('height')) - 16;
    const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

    expect(buildingA.x).toBeCloseTo(expectedInnerWidth * 0.25, 0);
    expect(buildingA.y).toBeCloseTo(expectedInnerHeight * 0.35, 0);
    expect(buildingB.x).toBeCloseTo(expectedInnerWidth * 0.55, 0);
    expect(buildingB.y).toBeCloseTo(expectedInnerHeight * 0.72, 0);
    expect(distance(spec1, buildingA)).toBeLessThan(120);
    expect(distance(spec3, buildingA)).toBeLessThan(120);
    expect(distance(spec2, buildingB)).toBeLessThan(120);
    expect(Math.max(spec1.x, spec2.x, spec3.x)).toBeLessThan(expectedInnerWidth - 24);
  });

  it('honors tight target link lengths in map-canvas orbit mode', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    applyMapCanvasSettings(settings, {
      targetOrbitRadius: { value: 8 },
      persistedSourcePositions: {
        value: JSON.stringify({
          'Building A': { x: 0.5, y: 0.5 },
        }),
      },
    });
    settingsRef.current = settings;

    const dv = DataViewBuilder.relational([
      { source: 'Building A', target: 'Spec 1', weight: 125 },
    ]);

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; the locked map-canvas positions are what this test verifies.
    }

    const buildingA = getNodePosition('Building A');
    const spec1 = getNodePosition('Building A::Spec 1');
    const distance = Math.hypot(spec1.x - buildingA.x, spec1.y - buildingA.y);
    expect(distance).toBeLessThanOrEqual(12);
  });

  it('can still place map-canvas targets on a rail when the rail preset is selected', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    applyMapCanvasSettings(settings, {
      targetLayoutPreset: { value: { value: 'rail', displayName: 'Rail' } },
      persistedSourcePositions: {
        value: JSON.stringify({
          'Building A': { x: 0.25, y: 0.35 },
          'Building B': { x: 0.55, y: 0.72 },
        }),
      },
    });
    settingsRef.current = settings;

    const dv = DataViewBuilder.relational([
      { source: 'Building A', target: 'Spec 1', weight: 125 },
      { source: 'Building B', target: 'Spec 2', weight: 72 },
    ]);

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; target rail placement is what this test verifies.
    }

    const spec1 = getNodePosition('Building A::Spec 1');
    const spec2 = getNodePosition('Building B::Spec 2');
    expect(Math.min(spec1.x, spec2.x)).toBeGreaterThan(500);
  });

  it('shows search as a collapsible magnifier control', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    settings.interactionSettings.enableSearch.value = true;
    settingsRef.current = settings;

    const dv = DataViewBuilder.relational([
      { source: 'Building A', target: 'Spec 1', weight: 125 },
      { source: 'Building B', target: 'Spec 2', weight: 72 },
    ]);

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; search DOM behavior is what this test verifies.
    }

    const toggle = constructorOpts.element.querySelector<HTMLButtonElement>('.network-search-toggle');
    expect(toggle).not.toBeNull();
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(constructorOpts.element.querySelector('.network-search-panel')).toBeNull();

    toggle?.click();
    const input = constructorOpts.element.querySelector<HTMLInputElement>('.network-search-input');
    expect(constructorOpts.element.querySelector<HTMLButtonElement>('.network-search-toggle')?.getAttribute('aria-expanded')).toBe('true');
    expect(input).not.toBeNull();

    input!.value = 'Building A';
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    const buildingA = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Building A"]');
    const buildingB = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Building B"]');
    expect(buildingA?.style.opacity).toBe('1');
    expect(buildingB?.style.opacity).toBe('0.15');

    constructorOpts.element.querySelector<HTMLButtonElement>('.network-search-toggle')?.click();
    expect(constructorOpts.element.querySelector('.network-search-panel')).toBeNull();
    expect(constructorOpts.element.querySelector<HTMLButtonElement>('.network-search-toggle')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('renders centered SVG icons for search and detail filter controls', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    settings.interactionSettings.enableSearch.value = true;
    settingsRef.current = settings;

    const dv = new DataViewBuilder()
      .withCategory('Source', ['Building A'], 'source')
      .withCategory('Target', ['Spec 1'], 'target')
      .withValues('Weight', [10], 'weight')
      .withValues('Issues Found', [0], 'detailMeasure')
      .build();

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; control DOM is what this test verifies.
    }

    const searchIcon = constructorOpts.element.querySelector<SVGSVGElement>('.network-search-toggle svg.network-control-icon.network-search-icon');
    const filterIcon = constructorOpts.element.querySelector<SVGSVGElement>('.network-detail-filter-toggle svg.network-control-icon.network-detail-filter-icon');
    expect(searchIcon).not.toBeNull();
    expect(filterIcon).not.toBeNull();
    expect(searchIcon?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(filterIcon?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(searchIcon?.getAttribute('aria-hidden')).toBe('true');
    expect(filterIcon?.getAttribute('aria-hidden')).toBe('true');
  });

  it('repeats shared target labels per source in map canvas mode', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    applyMapCanvasSettings(settings);
    settingsRef.current = settings;

    const dv = DataViewBuilder.relational([
      { source: 'Building A', target: 'Spec Shared', weight: 125 },
      { source: 'Building B', target: 'Spec Shared', weight: 72 },
    ]);

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; duplicated map-canvas targets are what this test verifies.
    }

    const targetLabels = Array.from(constructorOpts.element.querySelectorAll<SVGTextElement>('.network-label[data-role="target"]'))
      .filter((label) => label.textContent === 'Spec Shared');
    const links = Array.from(constructorOpts.element.querySelectorAll<SVGElement>('.network-link'));
    const targetIds = links
      .filter((link) => link.getAttribute('data-target')?.includes('Spec Shared'))
      .map((link) => link.getAttribute('data-target'));

    expect(targetLabels.length).toBe(2);
    expect(new Set(targetIds).size).toBe(2);
  });

  it('persists normalized source-node positions after dragging in map canvas mode', async () => {
    const persistSpy = vi.fn();
    constructorOpts.host.persistProperties = persistSpy;
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    applyMapCanvasSettings(settings);
    settingsRef.current = settings;

    const dv = DataViewBuilder.relational([
      { source: 'Building A', target: 'Spec 1', weight: 125 },
    ]);

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; event behavior is what this test verifies.
    }

    const node = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Building A"]');
    expect(node).not.toBeNull();
    const svg = constructorOpts.element.querySelector<SVGSVGElement>('svg.network-svg');
    Object.defineProperty(window.SVGElement.prototype, 'getScreenCTM', {
      configurable: true,
      value: () => ({ inverse: () => ({}) }),
    });
    Object.assign(svg as unknown as Record<string, unknown>, {
      createSVGPoint: () => ({
        x: 0,
        y: 0,
        matrixTransform() {
          return { x: this.x, y: this.y };
        },
      }),
    });
    const eventView = constructorOpts.element.ownerDocument.defaultView as Window;
    const down = new MouseEvent('mousedown', { bubbles: true, clientX: 120, clientY: 120 });
    const move = new MouseEvent('mousemove', { bubbles: true, clientX: 350, clientY: 230 });
    const up = new MouseEvent('mouseup', { bubbles: true, clientX: 350, clientY: 230 });
    for (const event of [down, move, up]) {
      Object.defineProperty(event, 'view', { configurable: true, value: eventView });
    }
    node?.dispatchEvent(down);
    eventView.dispatchEvent(move);
    eventView.dispatchEvent(up);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(persistSpy).toHaveBeenCalled();
    const call = persistSpy.mock.calls[persistSpy.mock.calls.length - 1]?.[0] as { merge?: Array<{ objectName?: string; properties?: Record<string, unknown> }> };
    expect(call.merge?.[0]?.objectName).toBe('mapCanvasSettings');
    expect(typeof call.merge?.[0]?.properties?.persistedSourcePositions).toBe('string');
  });

  it('renders selected detail measure badges and includes all detail measures in source tooltips', () => {
    const tooltipShow = vi.fn();
    constructorOpts.host.tooltipService = {
      show: tooltipShow,
      move: vi.fn(),
      hide: vi.fn(),
      enabled: () => true,
    };
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    settings.numberFormattingCard.decimalPlaces.value = 0;
    applyMeasureBadgeSettings(settings, {
      badgeMeasureName: { value: 'Signed Welds' },
    });
    settingsRef.current = settings;

    const dv = new DataViewBuilder()
      .withCategory('Source', ['Building A', 'Building A'], 'source')
      .withCategory('Target', ['Spec 1', 'Spec 2'], 'target')
      .withValues('Weight', [10, 20], 'weight')
      .withValues('Total Welds', [100, 50], 'detailMeasure')
      .withValues('Signed Welds', [80, 25], 'detailMeasure')
      .build();

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; badge DOM is what this test verifies.
    }

    const badge = constructorOpts.element.querySelector<SVGTextElement>('.network-measure-badge-text[data-node="Building A"]');
    expect(badge?.textContent).toBe('105');

    const node = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Building A"]');
    node?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 10, clientY: 20 }));
    const tooltipItems = tooltipShow.mock.calls[tooltipShow.mock.calls.length - 1]?.[0]?.dataItems as Array<{ displayName: string; value: string }> | undefined;
    expect(tooltipItems?.map((item) => item.displayName)).toEqual(expect.arrayContaining(['Total Welds', 'Signed Welds']));
  });

  it('shows zero for blank target detail measures in the node inspector', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    settings.numberFormattingCard.decimalPlaces.value = 0;
    applyNodeInspectorSettings(settings, {
      focusOnClick: { value: false },
    });
    settingsRef.current = settings;

    const dv = new DataViewBuilder()
      .withCategory('Source', ['Building A', 'Building B'], 'source')
      .withCategory('Target', ['Spec 1', 'Spec 2'], 'target')
      .withValues('Weight', [10, 20], 'weight')
      .withValues('Issues Found', [3, null], 'detailMeasure')
      .build();

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; inspector DOM is what this test verifies.
    }

    const target = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-role="target"][data-node="Spec 2"]');
    expect(target).not.toBeNull();
    target?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 180, clientY: 120 }));

    const rows = Array.from(constructorOpts.element.querySelectorAll<HTMLElement>('.network-node-inspector-row'));
    const issuesRow = rows.find((row) => row.querySelector('.network-node-inspector-row-label')?.textContent === 'Issues Found');
    expect(issuesRow).not.toBeUndefined();
    expect(issuesRow?.querySelector('.network-node-inspector-row-value')?.textContent).toBe('0');
  });

  it('filters nodes by detail measure zero values from the detail filter button', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    settings.interactionSettings.enableSearch.value = true;
    settings.numberFormattingCard.decimalPlaces.value = 0;
    settingsRef.current = settings;

    const dv = new DataViewBuilder()
      .withCategory('Source', ['Building A', 'Building B'], 'source')
      .withCategory('Target', ['Spec 1', 'Spec 2'], 'target')
      .withValues('Weight', [10, 20], 'weight')
      .withValues('Issues Found', [3, null], 'detailMeasure')
      .build();

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; filter DOM is what this test verifies.
    }

    expect(constructorOpts.element.querySelector('.network-search-toggle')).not.toBeNull();
    const filterToggle = constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-toggle');
    expect(filterToggle).not.toBeNull();

    filterToggle?.click();
    const fieldSelect = constructorOpts.element.querySelector<HTMLSelectElement>('.network-detail-filter-field');
    expect(fieldSelect).not.toBeNull();

    fieldSelect!.value = 'measure:Issues Found';
    fieldSelect!.dispatchEvent(new Event('change', { bubbles: true }));
    constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-zero')?.click();

    const buildingA = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Building A"]');
    const spec1 = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Spec 1"]');
    const buildingB = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Building B"]');
    const spec2 = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Spec 2"]');
    expect(buildingA?.style.opacity).toBe('0.15');
    expect(spec1?.style.opacity).toBe('0.15');
    expect(buildingB?.style.opacity).toBe('1');
    expect(spec2?.style.opacity).toBe('1');
  });

  it('reveals matching results and focus matched controls from the More row', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    settings.interactionSettings.enableSearch.value = true;
    settingsRef.current = settings;

    const dv = DataViewBuilder.relational([
      { source: 'Building A', target: 'Spec 1', weight: 10 },
      { source: 'Building B', target: 'Spec 2', weight: 20 },
    ]);

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; filter DOM is what this test verifies.
    }

    constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-toggle')?.click();
    constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-more-toggle')?.click();

    const results = Array.from(constructorOpts.element.querySelectorAll<HTMLElement>('.network-detail-filter-result'));
    expect(results.map((result) => result.textContent)).toEqual(expect.arrayContaining([
      expect.stringContaining('Building A'),
      expect.stringContaining('Spec 1'),
    ]));
    expect(constructorOpts.element.querySelector('.network-detail-filter-focus-matched')).not.toBeNull();
  });

  it('Focus Matched applies glow to matched nodes without clearing filter dimming', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    settings.interactionSettings.enableSearch.value = true;
    settingsRef.current = settings;

    const dv = DataViewBuilder.relational([
      { source: 'Building A', target: 'Spec 1', weight: 10 },
      { source: 'Building B', target: 'Spec 2', weight: 20 },
    ]);

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; focus filter DOM is what this test verifies.
    }

    constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-toggle')?.click();
    const fieldSelect = constructorOpts.element.querySelector<HTMLSelectElement>('.network-detail-filter-field');
    fieldSelect!.value = 'target:Target';
    fieldSelect!.dispatchEvent(new Event('change', { bubbles: true }));
    const valueSelect = constructorOpts.element.querySelector<HTMLSelectElement>('.network-detail-filter-value');
    valueSelect!.value = 'Spec 1';
    valueSelect!.dispatchEvent(new Event('change', { bubbles: true }));
    constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-add')?.click();

    constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-more-toggle')?.click();
    constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-focus-matched')?.click();

    const matched = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Spec 1"]');
    const connectedSource = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Building A"]');
    const unmatched = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Spec 2"]');
    expect(matched?.style.filter).toContain('node-glow');
    expect(connectedSource?.style.filter).toContain('node-glow');
    expect(unmatched?.style.filter).not.toContain('node-glow');
    expect(unmatched?.style.opacity).toBe('0.15');
  });

  it('keeps filter dimming after clicking a matching result', async () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    settings.interactionSettings.enableSearch.value = true;
    settingsRef.current = settings;

    const dv = DataViewBuilder.relational([
      { source: 'Building A', target: 'Spec 1', weight: 10 },
      { source: 'Building B', target: 'Spec 2', weight: 20 },
    ]);

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; result focus opacity is what this test verifies.
    }

    constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-toggle')?.click();
    const fieldSelect = constructorOpts.element.querySelector<HTMLSelectElement>('.network-detail-filter-field');
    fieldSelect!.value = 'target:Target';
    fieldSelect!.dispatchEvent(new Event('change', { bubbles: true }));
    const valueSelect = constructorOpts.element.querySelector<HTMLSelectElement>('.network-detail-filter-value');
    valueSelect!.value = 'Spec 1';
    valueSelect!.dispatchEvent(new Event('change', { bubbles: true }));
    constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-add')?.click();

    constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-more-toggle')?.click();
    const result = Array.from(constructorOpts.element.querySelectorAll<HTMLButtonElement>('.network-detail-filter-result'))
      .find((button) => button.textContent?.includes('Spec 1'));
    expect(result).not.toBeUndefined();
    result?.click();
    await Promise.resolve();

    const unmatched = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Spec 2"]');
    expect(unmatched?.style.opacity).toBe('0.15');
    expect(constructorOpts.element.querySelector('.network-detail-filter-panel')).not.toBeNull();
    expect(constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-more-toggle')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('filters detail measures with decimal thresholds entered by the user', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    settings.interactionSettings.enableSearch.value = true;
    settingsRef.current = settings;

    const dv = new DataViewBuilder()
      .withCategory('Source', ['Building A', 'Building B'], 'source')
      .withCategory('Target', ['Spec 1', 'Spec 2'], 'target')
      .withValues('Weight', [10, 20], 'weight')
      .withValues('Issues Found', [2.75, 2.25], 'detailMeasure')
      .build();

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; filter DOM is what this test verifies.
    }

    constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-toggle')?.click();
    const fieldSelect = constructorOpts.element.querySelector<HTMLSelectElement>('.network-detail-filter-field');
    fieldSelect!.value = 'measure:Issues Found';
    fieldSelect!.dispatchEvent(new Event('change', { bubbles: true }));
    const operatorSelect = constructorOpts.element.querySelector<HTMLSelectElement>('.network-detail-filter-operator');
    operatorSelect!.value = 'gte';
    operatorSelect!.dispatchEvent(new Event('change', { bubbles: true }));
    const valueInput = constructorOpts.element.querySelector<HTMLInputElement>('.network-detail-filter-number');
    valueInput!.value = '2.5';
    valueInput!.dispatchEvent(new Event('input', { bubbles: true }));
    constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-add')?.click();

    expect(constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Spec 1"]')?.style.opacity).toBe('1');
    expect(constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Spec 2"]')?.style.opacity).toBe('0.15');
  });

  it('disables Add for invalid measure values and supports zero helper rules', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    settings.interactionSettings.enableSearch.value = true;
    settingsRef.current = settings;

    const dv = new DataViewBuilder()
      .withCategory('Source', ['Building A', 'Building B'], 'source')
      .withCategory('Target', ['Spec 1', 'Spec 2'], 'target')
      .withValues('Weight', [10, 20], 'weight')
      .withValues('Issues Found', [0, 3], 'detailMeasure')
      .build();

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; filter DOM is what this test verifies.
    }

    constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-toggle')?.click();
    const fieldSelect = constructorOpts.element.querySelector<HTMLSelectElement>('.network-detail-filter-field');
    fieldSelect!.value = 'measure:Issues Found';
    fieldSelect!.dispatchEvent(new Event('change', { bubbles: true }));
    const valueInput = constructorOpts.element.querySelector<HTMLInputElement>('.network-detail-filter-number');
    valueInput!.value = 'not-a-number';
    valueInput!.dispatchEvent(new Event('input', { bubbles: true }));
    expect(constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-add')?.disabled).toBe(true);

    constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-zero')?.click();
    expect(constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Spec 1"]')?.style.opacity).toBe('1');
    expect(constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Spec 2"]')?.style.opacity).toBe('0.15');
  });

  it('uses OR within the same filter field and AND across different fields', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    settings.interactionSettings.enableSearch.value = true;
    settingsRef.current = settings;

    const dv = new DataViewBuilder()
      .withCategory('Source', ['Building A', 'Building B', 'Building C'], 'source')
      .withCategory('Target', ['Spec Alpha', 'Spec Beta', 'Spec Gamma'], 'target')
      .withCategory('Discipline', ['Electrical', 'Mechanical', 'Electrical'], 'nodeDetail')
      .withValues('Weight', [10, 20, 30], 'weight')
      .build();

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; filter DOM is what this test verifies.
    }

    constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-toggle')?.click();
    const addRule = (field: string, value: string) => {
      const fieldSelect = constructorOpts.element.querySelector<HTMLSelectElement>('.network-detail-filter-field');
      fieldSelect!.value = field;
      fieldSelect!.dispatchEvent(new Event('change', { bubbles: true }));
      if (field === 'measure:Issues Found' && value === 'zero') {
        constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-zero')?.click();
        return;
      }
      const valueSelect = constructorOpts.element.querySelector<HTMLSelectElement>('.network-detail-filter-value');
      valueSelect!.value = value;
      valueSelect!.dispatchEvent(new Event('change', { bubbles: true }));
      constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-add')?.click();
    };

    addRule('target:Target', 'Spec Alpha');
    addRule('target:Target', 'Spec Beta');
    addRule('field:Discipline', 'Electrical');

    const alpha = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Spec Alpha"]');
    const beta = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Spec Beta"]');
    const gamma = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Spec Gamma"]');

    expect(alpha?.style.opacity).toBe('1');
    expect(beta?.style.opacity).toBe('0.15');
    expect(gamma?.style.opacity).toBe('0.15');
  });

  it('shows active filter count badge and removable chips in the filter tray', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    settings.interactionSettings.enableSearch.value = true;
    settingsRef.current = settings;

    const dv = new DataViewBuilder()
      .withCategory('Source', ['Building A'], 'source')
      .withCategory('Target', ['Spec 1'], 'target')
      .withValues('Weight', [10], 'weight')
      .build();

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; filter DOM is what this test verifies.
    }

    constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-toggle')?.click();
    const fieldSelect = constructorOpts.element.querySelector<HTMLSelectElement>('.network-detail-filter-field');
    fieldSelect!.value = 'target:Target';
    fieldSelect!.dispatchEvent(new Event('change', { bubbles: true }));
    const valueSelect = constructorOpts.element.querySelector<HTMLSelectElement>('.network-detail-filter-value');
    valueSelect!.value = 'Spec 1';
    valueSelect!.dispatchEvent(new Event('change', { bubbles: true }));
    constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-add')?.click();

    const badge = constructorOpts.element.querySelector<HTMLElement>('.network-detail-filter-count');
    const chip = constructorOpts.element.querySelector<HTMLElement>('.network-detail-filter-chip');
    expect(badge?.textContent).toBe('1');
    expect(chip?.textContent).toContain('Target');
    expect(chip?.textContent).toContain('Spec 1');

    chip?.querySelector<HTMLButtonElement>('.network-detail-filter-chip-remove')?.click();
    expect(constructorOpts.element.querySelector('.network-detail-filter-count')).toBeNull();
    expect(constructorOpts.element.querySelector('.network-detail-filter-chip')).toBeNull();
  });

  it('sizes detail filter selects to long selected labels with a capped width and title', () => {
    const longMeasure = 'Very Long Issues Found Detail Measure Name';
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    settings.interactionSettings.enableSearch.value = true;
    settingsRef.current = settings;

    const dv = new DataViewBuilder()
      .withCategory('Source', ['Building A'], 'source')
      .withCategory('Target', ['Spec 1'], 'target')
      .withValues('Weight', [10], 'weight')
      .withValues(longMeasure, [0], 'detailMeasure')
      .build();

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; filter select DOM is what this test verifies.
    }

    constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-toggle')?.click();
    const fieldSelect = constructorOpts.element.querySelector<HTMLSelectElement>('.network-detail-filter-field');
    expect(fieldSelect).not.toBeNull();
    fieldSelect!.value = `measure:${longMeasure}`;
    fieldSelect!.dispatchEvent(new Event('change', { bubbles: true }));

    const updatedFieldSelect = constructorOpts.element.querySelector<HTMLSelectElement>('.network-detail-filter-field');
    expect(updatedFieldSelect?.title).toBe(longMeasure);
    expect(updatedFieldSelect?.style.width).toBe('26ch');
    expect(updatedFieldSelect?.style.maxWidth).toBe('26ch');
  });

  it('filters by a specific target value while keeping connected sources visible', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    settings.interactionSettings.enableSearch.value = true;
    settingsRef.current = settings;

    const dv = new DataViewBuilder()
      .withCategory('Source', ['Building A'], 'source')
      .withCategory('Pipe Spec', ['Spec Alpha'], 'target')
      .withCategory('Issue Type', ['Weld Issue'], 'target')
      .withValues('Weight', [1], 'weight')
      .build();

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; filter DOM is what this test verifies.
    }

    const filterToggle = constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-toggle');
    expect(filterToggle).not.toBeNull();
    filterToggle?.click();

    const fieldSelect = constructorOpts.element.querySelector<HTMLSelectElement>('.network-detail-filter-field');
    expect(fieldSelect).not.toBeNull();
    expect(Array.from(fieldSelect!.options).map((option) => option.value)).toContain('target:Target');
    fieldSelect!.value = 'target:Target';
    fieldSelect!.dispatchEvent(new Event('change', { bubbles: true }));

    const valueSelect = constructorOpts.element.querySelector<HTMLSelectElement>('.network-detail-filter-value');
    expect(valueSelect).not.toBeNull();
    expect(Array.from(valueSelect!.options).map((option) => option.value)).toContain('Weld Issue');
    valueSelect!.value = 'Weld Issue';
    valueSelect!.dispatchEvent(new Event('change', { bubbles: true }));
    constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-add')?.click();

    const source = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Building A"]');
    const specTarget = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Spec Alpha"]');
    const issueTarget = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Weld Issue"]');
    expect(source?.style.opacity).toBe('1');
    expect(specTarget?.style.opacity).toBe('0.15');
    expect(issueTarget?.style.opacity).toBe('1');
  });

  it('keeps active filter dimming after hover and background reset paths', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    settings.interactionSettings.enableSearch.value = true;
    settingsRef.current = settings;

    const dv = new DataViewBuilder()
      .withCategory('Source', ['Building A', 'Building B'], 'source')
      .withCategory('Target', ['Spec 1', 'Spec 2'], 'target')
      .withValues('Weight', [10, 20], 'weight')
      .build();

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; filter opacity is what this test verifies.
    }

    constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-toggle')?.click();
    const fieldSelect = constructorOpts.element.querySelector<HTMLSelectElement>('.network-detail-filter-field');
    fieldSelect!.value = 'target:Target';
    fieldSelect!.dispatchEvent(new Event('change', { bubbles: true }));
    const valueSelect = constructorOpts.element.querySelector<HTMLSelectElement>('.network-detail-filter-value');
    valueSelect!.value = 'Spec 1';
    valueSelect!.dispatchEvent(new Event('change', { bubbles: true }));
    constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-add')?.click();

    const match = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Spec 1"]');
    const nonMatch = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Spec 2"]');
    expect(match?.style.opacity).toBe('1');
    expect(nonMatch?.style.opacity).toBe('0.15');

    match?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    match?.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(nonMatch?.style.opacity).toBe('0.15');

    constructorOpts.element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(nonMatch?.style.opacity).toBe('0.15');
  });

  it('keeps unmatched neighbor targets dimmed while hovering a matched source', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    settings.interactionSettings.enableSearch.value = true;
    settings.interactionSettings.highlightNeighbors.value = true;
    settingsRef.current = settings;

    const dv = new DataViewBuilder()
      .withCategory('Source', ['Building A', 'Building A'], 'source')
      .withCategory('Target', ['Spec Match', 'Spec Other'], 'target')
      .withValues('Weight', [10, 20], 'weight')
      .build();

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; hover/filter opacity is what this test verifies.
    }

    constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-toggle')?.click();
    const fieldSelect = constructorOpts.element.querySelector<HTMLSelectElement>('.network-detail-filter-field');
    fieldSelect!.value = 'target:Target';
    fieldSelect!.dispatchEvent(new Event('change', { bubbles: true }));
    const valueSelect = constructorOpts.element.querySelector<HTMLSelectElement>('.network-detail-filter-value');
    valueSelect!.value = 'Spec Match';
    valueSelect!.dispatchEvent(new Event('change', { bubbles: true }));
    constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-add')?.click();

    const source = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Building A"]');
    const matchedTarget = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Spec Match"]');
    const unmatchedTarget = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Spec Other"]');
    const unmatchedLink = constructorOpts.element.querySelector<SVGLineElement>('.network-link[data-source="Building A"][data-target="Spec Other"]');

    expect(source?.style.opacity).toBe('1');
    expect(matchedTarget?.style.opacity).toBe('1');
    expect(unmatchedTarget?.style.opacity).toBe('0.15');

    source?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    expect(source?.style.opacity).toBe('1');
    expect(matchedTarget?.style.opacity).toBe('1');
    expect(unmatchedTarget?.style.opacity).toBe('0.15');
    expect(unmatchedLink?.style.opacity).toBe('0.08');
  });

  it('prunes stale active filter rules after data updates', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    settings.interactionSettings.enableSearch.value = true;
    settingsRef.current = settings;

    const firstData = new DataViewBuilder()
      .withCategory('Source', ['Building A'], 'source')
      .withCategory('Target', ['Spec Old'], 'target')
      .withCategory('Discipline', ['Electrical'], 'nodeDetail')
      .withValues('Weight', [10], 'weight')
      .withValues('Issues Found', [0], 'detailMeasure')
      .build();

    try {
      visual.update(createUpdateOptions([firstData], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; filter DOM is what this test verifies.
    }

    constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-toggle')?.click();
    const addRule = (field: string, value: string) => {
      const fieldSelect = constructorOpts.element.querySelector<HTMLSelectElement>('.network-detail-filter-field');
      fieldSelect!.value = field;
      fieldSelect!.dispatchEvent(new Event('change', { bubbles: true }));
      if (field === 'measure:Issues Found' && value === 'zero') {
        constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-zero')?.click();
        return;
      }
      const valueSelect = constructorOpts.element.querySelector<HTMLSelectElement>('.network-detail-filter-value');
      valueSelect!.value = value;
      valueSelect!.dispatchEvent(new Event('change', { bubbles: true }));
      constructorOpts.element.querySelector<HTMLButtonElement>('.network-detail-filter-add')?.click();
    };
    addRule('target:Target', 'Spec Old');
    addRule('field:Discipline', 'Electrical');
    addRule('measure:Issues Found', 'zero');
    expect(constructorOpts.element.querySelectorAll('.network-detail-filter-chip')).toHaveLength(3);

    const secondData = new DataViewBuilder()
      .withCategory('Source', ['Building B'], 'source')
      .withCategory('Target', ['Spec New'], 'target')
      .withValues('Weight', [20], 'weight')
      .build();
    settingsRef.current = settings;

    try {
      visual.update(createUpdateOptions([secondData], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; stale filter pruning is what this test verifies.
    }

    const newTarget = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Spec New"]');
    expect(newTarget?.style.opacity).toBe('');
    expect(constructorOpts.element.querySelector('.network-detail-filter-count')).toBeNull();
    expect(constructorOpts.element.querySelector('.network-detail-filter-chip')).toBeNull();
  });

  it('dims the rest of the nodes when a target node is selected', async () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    settingsRef.current = settings;

    const dv = DataViewBuilder.relational([
      { source: 'Building A', target: 'Spec 1', weight: 125 },
      { source: 'Building B', target: 'Spec 2', weight: 72 },
    ]);

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; selected-node opacity is what this test verifies.
    }

    const selectedTarget = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-role="target"][data-node="Spec 1"]');
    const source = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-role="source"][data-node="Building A"]');
    const otherTarget = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-role="target"][data-node="Spec 2"]');
    expect(selectedTarget).not.toBeNull();
    expect(source).not.toBeNull();
    expect(otherTarget).not.toBeNull();

    selectedTarget?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 180, clientY: 120 }));
    await Promise.resolve();

    expect(selectedTarget?.style.opacity).toBe('1');
    expect(source?.style.opacity).toBe('0.45');
    expect(otherTarget?.style.opacity).toBe('0.45');

    selectedTarget?.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

    expect(selectedTarget?.style.opacity).toBe('1');
    expect(source?.style.opacity).toBe('0.45');
    expect(otherTarget?.style.opacity).toBe('0.45');
  });

  it('renders readable node labels using node label controls', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.nodeSettings.fontSize.value = 16;
    settings.nodeSettings.fontColor.value = { value: '#123456' };
    settingsRef.current = settings;

    const dv = DataViewBuilder.relational([
      { source: 'Building A', target: 'Pipe Spec Alpha', weight: 125 },
    ]);

    try {
      visual.update(createUpdateOptions([dv]) as never);
    } catch {
      // d3-timer may throw in JSDOM — label DOM is what this test verifies.
    }

    const label = constructorOpts.element.querySelector<SVGTextElement>('.network-label');
    expect(label).not.toBeNull();
    expect(label?.textContent).toBe('Building A');
    expect(label?.style.opacity).toBe('1');
    expect(label?.style.fontSize).toBe('16px');
    expect(label?.style.fill).toBe('#123456');
    expect(label?.getAttribute('paint-order')).toBe('stroke');
    expect(label?.getAttribute('stroke-width')).not.toBe('');
  });

  it('lets source and target node labels use independent font sizes', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    settings.nodeSettings.fontSize.value = 12;
    Object.assign(settings.nodeSettings as unknown as Record<string, { value: unknown }>, {
      useRoleLabelFontSizes: { value: true },
      sourceLabelFontSize: { value: 18 },
      targetLabelFontSize: { value: 10 },
    });
    settingsRef.current = settings;

    const dv = DataViewBuilder.relational([
      { source: 'Building A', target: 'Spec 1', weight: 125 },
    ]);

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; label DOM is what this test verifies.
    }

    const sourceLabel = constructorOpts.element.querySelector<SVGTextElement>('.network-label[data-role="source"]');
    const targetLabel = constructorOpts.element.querySelector<SVGTextElement>('.network-label[data-role="target"]');

    expect(sourceLabel?.style.fontSize).toBe('18px');
    expect(targetLabel?.style.fontSize).toBe('10px');
  });

  it('caps size-by-degree node radii for compact map markers', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    settings.nodeSettings.sizeByDegree.value = true;
    settings.nodeSettings.minRadius.value = 2;
    settings.nodeSettings.maxRadius.value = 6;
    settingsRef.current = settings;

    const dv = DataViewBuilder.relational([
      { source: 'Building A', target: 'Spec 1', weight: 125 },
      { source: 'Building A', target: 'Spec 2', weight: 72 },
      { source: 'Building A', target: 'Spec 3', weight: 25 },
      { source: 'Building A', target: 'Spec 4', weight: 18 },
      { source: 'Building A', target: 'Spec 5', weight: 11 },
    ]);

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; the rendered node radius is what this test verifies.
    }

    const building = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Building A"]');
    const target = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Spec 1"]');
    expect(Number(building?.getAttribute('r'))).toBeLessThanOrEqual(6);
    expect(Number(target?.getAttribute('r'))).toBeGreaterThanOrEqual(2);
  });

  it('scales target node radius by its connection count when size-by-degree is enabled', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    settings.nodeSettings.sizeByDegree.value = true;
    settings.nodeSettings.minRadius.value = 4;
    settings.nodeSettings.maxRadius.value = 20;
    settingsRef.current = settings;

    const dv = DataViewBuilder.relational([
      { source: 'Building A', target: 'Shared Spec', weight: 125 },
      { source: 'Building B', target: 'Shared Spec', weight: 72 },
      { source: 'Building C', target: 'Shared Spec', weight: 25 },
      { source: 'Building D', target: 'Shared Spec', weight: 18 },
      { source: 'Building E', target: 'Shared Spec', weight: 11 },
      { source: 'Building F', target: 'Solo Spec', weight: 8 },
    ]);

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; rendered radii are what this test verifies.
    }

    const sharedTarget = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Shared Spec"]');
    const soloTarget = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Solo Spec"]');
    const sharedRadius = Number(sharedTarget?.getAttribute('r'));
    const soloRadius = Number(soloTarget?.getAttribute('r'));

    expect(sharedRadius).toBeGreaterThan(soloRadius);
    expect(sharedRadius).toBeCloseTo(20, 5);
  });

  it('scales target node radius by total target weight when target size mode is weight', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    settings.nodeSettings.radius.value = 8;
    settings.nodeSettings.minRadius.value = 4;
    settings.nodeSettings.maxRadius.value = 24;
    (settings.nodeSettings as unknown as Record<string, { value: unknown }>).targetSizeMode = {
      value: { value: 'weight', displayName: 'Total Weight' },
    };
    settingsRef.current = settings;

    const dv = DataViewBuilder.relational([
      { source: 'Building A', target: 'High Weight Spec', weight: 200 },
      { source: 'Building B', target: 'High Weight Spec', weight: 100 },
      { source: 'Building C', target: 'Low Weight Spec', weight: 10 },
    ]);

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; rendered radii are what this test verifies.
    }

    const highTarget = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="High Weight Spec"]');
    const lowTarget = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Low Weight Spec"]');
    const source = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Building A"]');

    expect(Number(highTarget?.getAttribute('r'))).toBeGreaterThan(Number(lowTarget?.getAttribute('r')));
    expect(Number(highTarget?.getAttribute('r'))).toBeCloseTo(24, 5);
    expect(Number(source?.getAttribute('r'))).toBe(8);
  });

  it('scales only target node radius by connection count when target size mode is count', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = false;
    settings.nodeSettings.radius.value = 9;
    settings.nodeSettings.minRadius.value = 5;
    settings.nodeSettings.maxRadius.value = 21;
    (settings.nodeSettings as unknown as Record<string, { value: unknown }>).targetSizeMode = {
      value: { value: 'count', displayName: 'Connection Count' },
    };
    settingsRef.current = settings;

    const dv = DataViewBuilder.relational([
      { source: 'Building A', target: 'Shared Spec', weight: 1 },
      { source: 'Building B', target: 'Shared Spec', weight: 1 },
      { source: 'Building C', target: 'Shared Spec', weight: 1 },
      { source: 'Building D', target: 'Solo Spec', weight: 1 },
    ]);

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; rendered radii are what this test verifies.
    }

    const sharedTarget = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Shared Spec"]');
    const soloTarget = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Solo Spec"]');
    const source = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Building A"]');

    expect(Number(sharedTarget?.getAttribute('r'))).toBeGreaterThan(Number(soloTarget?.getAttribute('r')));
    expect(Number(sharedTarget?.getAttribute('r'))).toBeCloseTo(21, 5);
    expect(Number(source?.getAttribute('r'))).toBe(9);
  });

  it('can position node labels inside the nodes', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.nodeSettings.radius.value = 28;
    settings.nodeSettings.fontSize.value = 10;
    (settings.nodeSettings as unknown as Record<string, { value: unknown }>).labelPosition = {
      value: { value: 'inside', displayName: 'Inside' },
    };
    settingsRef.current = settings;

    const dv = DataViewBuilder.relational([
      { source: 'B1', target: 'S1', weight: 125 },
    ]);

    try {
      visual.update(createUpdateOptions([dv]) as never);
    } catch {
      // d3-timer may throw in JSDOM — label placement DOM is what this test verifies.
    }

    const node = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="B1"]');
    const label = constructorOpts.element.querySelector<SVGTextElement>('.network-label[data-node="B1"]');

    expect(label?.getAttribute('text-anchor')).toBe('middle');
    expect(Number(label?.getAttribute('x'))).toBeCloseTo(Number(node?.getAttribute('cx')), 2);
    expect(Number(label?.getAttribute('y'))).toBeCloseTo(Number(node?.getAttribute('cy')), 2);
  });

  it('renders formatted link weight labels when enabled', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    (settings.linkSettings as unknown as Record<string, { value: unknown }>).showWeightLabels = { value: true };
    (settings.linkSettings as unknown as Record<string, { value: unknown }>).weightLabelFontSize = { value: 13 };
    settings.numberFormattingCard.decimalPlaces.value = 0;
    settingsRef.current = settings;

    const dv = DataViewBuilder.relational([
      { source: 'Building A', target: 'Pipe Spec Alpha', weight: 125 },
      { source: 'Building B', target: 'Pipe Spec Beta', weight: 50 },
    ]);

    try {
      visual.update(createUpdateOptions([dv]) as never);
    } catch {
      // d3-timer may throw in JSDOM — link-label DOM is what this test verifies.
    }

    const labels = Array.from(constructorOpts.element.querySelectorAll<SVGTextElement>('.network-link-label-text'));
    expect(labels).toHaveLength(2);
    expect(labels.map((label) => label.textContent)).toEqual(expect.arrayContaining(['125', '50']));
    expect(labels.every((label) => label.style.fontSize === '13px')).toBe(true);
  });

  it('colors nodes by source and target role when enabled', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    Object.assign(settings.colorsAndThemeSettings as unknown as Record<string, { value: unknown }>, {
      colorByNodeRole: { value: true },
      sourceNodeColor: { value: { value: '#1D4ED8' } },
      targetNodeColor: { value: { value: '#B91C1C' } },
      bothRoleNodeColor: { value: { value: '#D97706' } },
    });
    settingsRef.current = settings;

    const dv = DataViewBuilder.relational([
      { source: 'Building A', target: 'Spec 1', weight: 125 },
      { source: 'Spec 1', target: 'Spec 2', weight: 50 },
    ]);

    try {
      visual.update(createUpdateOptions([dv]) as never);
    } catch {
      // d3-timer may throw in JSDOM — node fill attributes are what this test verifies.
    }

    const building = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Building A"]');
    const target = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Spec 2"]');
    const both = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Spec 1"]');

    expect(building?.getAttribute('fill')).toBe('#1D4ED8');
    expect(target?.getAttribute('fill')).toBe('#B91C1C');
    expect(both?.getAttribute('fill')).toBe('#D97706');
  });

  it('smart-loads dense labels by prioritizing sources while zoomed out and revealing targets when zoomed in', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = true;
    settings.nodeSettings.labelVisibility.value = { value: 'smart', displayName: 'Smart Density' };
    settings.nodeSettings.adaptiveZoomThreshold.value = 1.3;
    settings.nodeSettings.maxLabelCharacters.value = 60;
    settings.physicsAndLayoutSettings.settleTicks.value = 0;
    settings.physicsAndLayoutSettings.roleSpread.value = 0;
    settings.physicsAndLayoutSettings.enableCollision.value = false;
    settingsRef.current = settings;

    const dv = DataViewBuilder.relational([
      { source: 'Building A', target: 'Spec Alpha Long Name', weight: 125 },
      { source: 'Building A', target: 'Spec Beta Long Name', weight: 72 },
      { source: 'Building A', target: 'Spec Gamma Long Name', weight: 44 },
      { source: 'Building A', target: 'Spec Delta Long Name', weight: 88 },
    ]);

    try {
      visual.update(createUpdateOptions([dv], { width: 360, height: 240 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; label visibility is what this test verifies.
    }

    const sourceLabel = constructorOpts.element.querySelector<SVGTextElement>('.network-label[data-node="Building A"]');
    const targetLabels = [
      'Spec Alpha Long Name',
      'Spec Beta Long Name',
      'Spec Gamma Long Name',
      'Spec Delta Long Name',
    ].map((nodeId) => constructorOpts.element.querySelector<SVGTextElement>(`.network-label[data-node="${nodeId}"]`));

    expect(sourceLabel?.style.opacity).toBe('1');
    expect(targetLabels.every((label) => label?.style.opacity === '0')).toBe(true);

    const labelController = visual as unknown as { currentZoomScale: number; applyLabelVisibility: () => void };
    labelController.currentZoomScale = 1.45;
    labelController.applyLabelVisibility();

    expect(targetLabels.every((label) => label?.style.opacity === '1')).toBe(true);
  });

  it('hides target labels below the smart zoom threshold even when labels do not overlap', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = true;
    settings.nodeSettings.labelVisibility.value = { value: 'smart', displayName: 'Smart Density' };
    settings.nodeSettings.adaptiveZoomThreshold.value = 1.3;
    settings.physicsAndLayoutSettings.settleTicks.value = 0;
    settingsRef.current = settings;

    const dv = DataViewBuilder.relational([
      { source: 'Building A', target: 'Spec 1', weight: 125 },
    ]);

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; label visibility is what this test verifies.
    }

    const sourceLabel = constructorOpts.element.querySelector<SVGTextElement>('.network-label[data-node="Building A"]');
    const targetLabel = constructorOpts.element.querySelector<SVGTextElement>('.network-label[data-node="Spec 1"]');

    expect(sourceLabel?.style.opacity).toBe('1');
    expect(targetLabel?.style.opacity).toBe('0');

    const labelController = visual as unknown as { currentZoomScale: number; applyLabelVisibility: () => void };
    labelController.currentZoomScale = 1.45;
    labelController.applyLabelVisibility();

    expect(targetLabel?.style.opacity).toBe('1');
  });

  it('uses a configurable softer wheel delta for smaller zoom increments', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    Object.assign(settings.interactionSettings as unknown as Record<string, { value: unknown }>, {
      zoomWheelSensitivity: { value: 50 },
    });
    settingsRef.current = settings;

    const dv = DataViewBuilder.relational([
      { source: 'Building A', target: 'Spec 1', weight: 125 },
    ]);

    try {
      visual.update(createUpdateOptions([dv]) as never);
    } catch {
      // d3-timer may throw in JSDOM; zoom delta calculation is what this test verifies.
    }

    const zoomController = visual as unknown as { getZoomWheelDelta: (event: { deltaY: number; deltaMode: number }) => number };
    const delta = zoomController.getZoomWheelDelta({ deltaY: -120, deltaMode: 0 });

    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThan(0.24);
    expect(delta).toBeCloseTo(0.12, 2);
  });

  it('opens a configurable node inspector with attached details and focus-zooms the clicked node', () => {
    const settings = new NetworkGraphSettings();
    settings.animationSettings.enabled.value = false;
    settings.interactionSettings.enableZoom.value = true;
    settings.numberFormattingCard.decimalPlaces.value = 0;
    applyNodeInspectorSettings(settings);
    settingsRef.current = settings;

    const dv = new DataViewBuilder()
      .withCategory('Source', ['Building A', 'Building A', 'Building B'], 'source')
      .withCategory('Target', ['Spec 1', 'Spec 2', 'Spec 1'], 'target')
      .withCategory('Area', ['North', 'South', 'East'], 'nodeDetail')
      .withCategory('Foreman', ['Kim', 'Lee', 'Pat'], 'nodeDetail')
      .withValues('Weight', [10, 20, 5], 'weight')
      .withValues('Total Welds', [100, 50, 25], 'detailMeasure')
      .withValues('Signed Welds', [80, 25, 20], 'detailMeasure')
      .build();

    try {
      visual.update(createUpdateOptions([dv], { width: 700, height: 460 }) as never);
    } catch {
      // d3-timer may throw in JSDOM; inspector DOM is what this test verifies.
    }

    const node = constructorOpts.element.querySelector<SVGCircleElement>('.network-node[data-node="Building A"]');
    expect(node).not.toBeNull();
    node?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 180, clientY: 120 }));

    const inspector = constructorOpts.element.querySelector<HTMLElement>('.network-node-inspector[data-node="Building A"]');
    expect(inspector).not.toBeNull();
    expect(inspector?.textContent).toContain('Building A');
    expect(inspector?.textContent).toContain('Total Welds');
    expect(inspector?.textContent).toContain('150');
    expect(inspector?.textContent).toContain('Signed Welds');
    expect(inspector?.textContent).toContain('105');
    expect(inspector?.textContent).toContain('Area');
    expect(inspector?.textContent).toContain('North, South');
    expect(inspector?.textContent).toContain('Foreman');
    expect(inspector?.textContent).toContain('Kim, Lee');

    const zoomState = visual as unknown as { currentZoomScale: number };
    expect(zoomState.currentZoomScale).toBeCloseTo(1.55, 2);
    const targetLabels = Array.from(constructorOpts.element.querySelectorAll<SVGTextElement>('.network-label[data-role="target"]'));
    expect(targetLabels.length).toBeGreaterThan(0);
    expect(targetLabels.every((label) => label.style.opacity === '1')).toBe(true);
  });
});
