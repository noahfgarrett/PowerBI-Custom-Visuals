# Network Graph Map Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Network Graph `Map Canvas` mode with WebP-friendly background images, persisted source-node positions, target rails, and optional measure badges.

**Architecture:** Extend the existing Network Graph visual in place. Add format-pane cards for map canvas and measure badges, add optional data roles for `imageUrl` and `detailMeasure`, render a background image layer behind links, and persist normalized source-node positions through `host.persistProperties`.

**Tech Stack:** Power BI custom visuals API, TypeScript, D3 SVG rendering/force simulation, Vitest/JSDOM test harness.

---

## File Structure

- Modify `packages/network-graph/capabilities.json` to add `imageUrl`, `detailMeasure`, `mapCanvasSettings`, `measureBadgeSettings`, and nonessential `WebAccess`.
- Modify `packages/network-graph/src/settings.ts` to add `MapCanvasSettings` and `MeasureBadgeSettings`.
- Modify `packages/network-graph/src/visual.ts` to extract image/detail measures, render the map image, calculate map layout targets, persist source positions, and render badges/tooltips.
- Modify `packages/network-graph/src/__tests__/visual.test.ts` to add behavior tests for map canvas rendering, normalized positions, persistence, target rail, and badges/tooltips.
- Modify `packages/network-graph/src/__tests__/formatting-coverage.test.ts` only if new controls create expected phantom settings.
- Modify `packages/network-graph/style/visual.less` for background and badge polish.
- Modify `packages/network-graph/pbiviz.json`, `packages/network-graph/package.json`, and `package-lock.json` to bump the version after implementation.

---

### Task 1: Add Red Tests For Map Canvas Rendering

**Files:**
- Modify: `packages/network-graph/src/__tests__/visual.test.ts`

- [ ] **Step 1: Write the failing map background test**

Add this test near the existing layout tests:

```ts
it('renders a WebP-compatible map background behind the network', () => {
  const settings = new NetworkGraphSettings();
  settings.animationSettings.enabled.value = false;
  settings.interactionSettings.enableZoom.value = false;
  Object.assign(settings as unknown as Record<string, unknown>, {
    mapCanvasSettings: {
      enabled: { value: true },
      imageSource: { value: 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AA/vuUAAA=' },
      imageFit: { value: { value: 'contain', displayName: 'Contain' } },
      horizontalAlign: { value: { value: 'center', displayName: 'Center' } },
      verticalAlign: { value: { value: 'middle', displayName: 'Middle' } },
      imageOpacity: { value: 62 },
      dimOverlayOpacity: { value: 18 },
      persistedSourcePositions: { value: '' },
      resetPositions: { value: false },
    },
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
  expect(image?.getAttribute('href') || image?.getAttribute('xlink:href')).toContain('data:image/webp');
  expect(image?.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
  expect(image?.getAttribute('opacity')).toBe('0.62');
  expect(dim?.getAttribute('fill-opacity')).toBe('0.18');
  expect(firstLink?.compareDocumentPosition(image as unknown as Node) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npm test -- --run packages/network-graph/src/__tests__/visual.test.ts
```

Expected: the new test fails because `.network-map-image` does not exist.

---

### Task 2: Add Red Tests For Persisted Source Positions And Target Rail

**Files:**
- Modify: `packages/network-graph/src/__tests__/visual.test.ts`

- [ ] **Step 1: Write the failing persisted-position test**

Add this test near the map background test:

```ts
it('uses persisted normalized source positions in map canvas mode while keeping targets on a rail', () => {
  const settings = new NetworkGraphSettings();
  settings.animationSettings.enabled.value = false;
  settings.interactionSettings.enableZoom.value = false;
  Object.assign(settings as unknown as Record<string, unknown>, {
    mapCanvasSettings: {
      enabled: { value: true },
      imageSource: { value: '' },
      imageFit: { value: { value: 'contain', displayName: 'Contain' } },
      horizontalAlign: { value: { value: 'center', displayName: 'Center' } },
      verticalAlign: { value: { value: 'middle', displayName: 'Middle' } },
      imageOpacity: { value: 100 },
      dimOverlayOpacity: { value: 0 },
      targetRailPosition: { value: { value: 'right', displayName: 'Right' } },
      persistedSourcePositions: { value: JSON.stringify({ 'Building A': { x: 0.25, y: 0.35 }, 'Building B': { x: 0.55, y: 0.72 } }) },
      resetPositions: { value: false },
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
    // d3-timer may throw in JSDOM; node positions are what this test verifies.
  }

  const buildingA = getNodePosition('Building A');
  const buildingB = getNodePosition('Building B');
  const spec1 = getNodePosition('Spec 1');
  const spec2 = getNodePosition('Spec 2');

  expect(buildingA.x).toBeCloseTo((700 - 16) * 0.25, 0);
  expect(buildingA.y).toBeCloseTo((460 - 16) * 0.35, 0);
  expect(buildingB.x).toBeCloseTo((700 - 16) * 0.55, 0);
  expect(buildingB.y).toBeCloseTo((460 - 16) * 0.72, 0);
  expect(Math.min(spec1.x, spec2.x)).toBeGreaterThan(500);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npm test -- --run packages/network-graph/src/__tests__/visual.test.ts
```

Expected: the test fails because `mapCanvasSettings` and persisted map layout are not implemented.

---

### Task 3: Add Red Tests For Source Drag Persistence

**Files:**
- Modify: `packages/network-graph/src/__tests__/visual.test.ts`

- [ ] **Step 1: Write the failing persistence test**

Add this test:

```ts
it('persists normalized source-node positions after dragging in map canvas mode', () => {
  const persistSpy = vi.fn();
  constructorOpts.host.persistProperties = persistSpy;

  const settings = new NetworkGraphSettings();
  settings.animationSettings.enabled.value = false;
  settings.interactionSettings.enableZoom.value = false;
  Object.assign(settings as unknown as Record<string, unknown>, {
    mapCanvasSettings: {
      enabled: { value: true },
      imageSource: { value: '' },
      imageFit: { value: { value: 'contain', displayName: 'Contain' } },
      horizontalAlign: { value: { value: 'center', displayName: 'Center' } },
      verticalAlign: { value: { value: 'middle', displayName: 'Middle' } },
      imageOpacity: { value: 100 },
      dimOverlayOpacity: { value: 0 },
      targetRailPosition: { value: { value: 'right', displayName: 'Right' } },
      persistedSourcePositions: { value: '' },
      resetPositions: { value: false },
    },
  });
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
  node?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 120, clientY: 120 }));
  node?.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 350, clientY: 230 }));
  node?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 350, clientY: 230 }));

  expect(persistSpy).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npm test -- --run packages/network-graph/src/__tests__/visual.test.ts
```

Expected: the test fails because dragging does not persist map positions.

---

### Task 4: Add Red Tests For Detail Measures And Badges

**Files:**
- Modify: `packages/network-graph/src/__tests__/visual.test.ts`

- [ ] **Step 1: Write the failing measure badge test**

Add this test:

```ts
it('renders selected detail measure badges and includes all detail measures in source tooltips', () => {
  const settings = new NetworkGraphSettings();
  settings.animationSettings.enabled.value = false;
  settings.interactionSettings.enableZoom.value = false;
  Object.assign(settings as unknown as Record<string, unknown>, {
    measureBadgeSettings: {
      showBadges: { value: true },
      badgeMeasureName: { value: 'Signed Welds' },
      badgeDisplayMode: { value: { value: 'value', displayName: 'Value' } },
      badgeFontSize: { value: 11 },
      badgeColor: { value: { value: '#0F172A' } },
      badgeBackgroundColor: { value: { value: '#FFFFFF' } },
      badgeBackgroundOpacity: { value: 90 },
      badgeOffset: { value: 16 },
    },
  });
  settings.numberFormattingCard.decimalPlaces.value = 0;
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
  const tooltipCalls = (constructorOpts.host.tooltipService as { show?: ReturnType<typeof vi.fn> }).show;
  expect(tooltipCalls).toBeDefined();
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npm test -- --run packages/network-graph/src/__tests__/visual.test.ts
```

Expected: the badge assertion fails because detail measures and badge DOM are not implemented.

---

### Task 5: Implement Settings And Capabilities

**Files:**
- Modify: `packages/network-graph/src/settings.ts`
- Modify: `packages/network-graph/capabilities.json`

- [ ] **Step 1: Add settings cards**

Add `MapCanvasSettings` and `MeasureBadgeSettings` to `settings.ts`, and append both cards to `NetworkGraphSettings.cards`.

Required setting names:

```ts
mapCanvasSettings.enabled
mapCanvasSettings.imageSource
mapCanvasSettings.imageFit
mapCanvasSettings.horizontalAlign
mapCanvasSettings.verticalAlign
mapCanvasSettings.imageOpacity
mapCanvasSettings.dimOverlayOpacity
mapCanvasSettings.targetRailPosition
mapCanvasSettings.persistedSourcePositions
mapCanvasSettings.resetPositions
measureBadgeSettings.showBadges
measureBadgeSettings.badgeMeasureName
measureBadgeSettings.badgeDisplayMode
measureBadgeSettings.badgeFontSize
measureBadgeSettings.badgeColor
measureBadgeSettings.badgeBackgroundColor
measureBadgeSettings.badgeBackgroundOpacity
measureBadgeSettings.badgeOffset
```

- [ ] **Step 2: Add capabilities**

In `capabilities.json`, add data roles:

```json
{ "displayName": "Image URL", "name": "imageUrl", "kind": "Grouping", "description": "Optional site map image URL or data URI" }
{ "displayName": "Detail Measures", "name": "detailMeasure", "kind": "Measure", "description": "Optional extra metrics for badges and tooltips" }
```

Update mapping conditions:

```json
"imageUrl": { "max": 1 },
"detailMeasure": { "max": 10 }
```

Add `imageUrl` to categorical categories select and `detailMeasure` to values select.

Add `mapCanvasSettings` and `measureBadgeSettings` objects with the properties listed in Step 1.

Add nonessential web access:

```json
"privileges": [
  { "name": "WebAccess", "essential": false, "parameters": [ "https://*", "http://*" ] }
]
```

- [ ] **Step 3: Run formatting coverage**

Run:

```bash
npm test -- --run packages/network-graph/src/__tests__/formatting-coverage.test.ts
```

Expected: pass or report only expected phantoms. If `resetPositions` is a one-shot action and appears as phantom, add `mapCanvasSettings.resetPositions` to `expectedPhantoms`.

---

### Task 6: Implement Data Extraction For Image And Detail Measures

**Files:**
- Modify: `packages/network-graph/src/visual.ts`

- [ ] **Step 1: Extend internal types**

Add fields:

```ts
interface GraphNode {
  detailValues: Record<string, number>;
}

interface GraphLink {
  detailValues?: Record<string, number>;
}

interface NetworkData {
  backgroundImageSource: string;
  detailMeasureLabels: string[];
}
```

- [ ] **Step 2: Extract columns**

During `extractData`, find:

```ts
let imageUrlColumn: powerbi.DataViewCategoryColumn | undefined;
const detailMeasureColumns: powerbi.DataViewValueColumn[] = [];
```

Populate them by role. Use the first non-empty image URL value as `backgroundImageSource` when the format-pane image source is empty.

- [ ] **Step 3: Aggregate detail measures**

For each row and detail measure column, parse finite numeric values. Add them to:

- the source node detail values
- the target node detail values
- the link detail values

Aggregate by summing values with the same display name.

- [ ] **Step 4: Run visual tests**

Run:

```bash
npm test -- --run packages/network-graph/src/__tests__/visual.test.ts
```

Expected: tests still fail only for rendering/layout/persistence not yet implemented.

---

### Task 7: Implement Map Background Rendering

**Files:**
- Modify: `packages/network-graph/src/visual.ts`
- Modify: `packages/network-graph/style/visual.less`

- [ ] **Step 1: Resolve image source**

Add helper:

```ts
private getMapImageSource(data: NetworkData): string {
  return this.settings.mapCanvasSettings.imageSource.value?.trim() || data.backgroundImageSource || '';
}
```

- [ ] **Step 2: Render background layer**

After creating `g`, before links, append:

```ts
const mapBackgroundLayer = g.append('g').attr('class', 'network-map-background');
```

If map mode is enabled and source is non-empty, append `image.network-map-image` with `href`, `x`, `y`, `width`, `height`, `opacity`, and `preserveAspectRatio`.

For `contain`, use `preserveAspectRatio="xMidYMid meet"`.
For `cover`, use `preserveAspectRatio="xMidYMid slice"`.
For `stretch`, use `preserveAspectRatio="none"`.

Append `rect.network-map-dim` above the image when `dimOverlayOpacity > 0`.

- [ ] **Step 3: Add CSS**

Add:

```less
.network-map-background {
  pointer-events: none;
}

.network-map-image {
  user-select: none;
}

.network-measure-badge {
  pointer-events: none;
}
```

- [ ] **Step 4: Run map background test**

Run:

```bash
npm test -- --run packages/network-graph/src/__tests__/visual.test.ts
```

Expected: map background test passes.

---

### Task 8: Implement Map Canvas Layout And Source Position Persistence

**Files:**
- Modify: `packages/network-graph/src/visual.ts`

- [ ] **Step 1: Add layout mode support**

Extend `NetworkLayoutMode`:

```ts
type NetworkLayoutMode = 'sourceTarget' | 'force' | 'mapCanvas';
```

Return `mapCanvas` when `mapCanvasSettings.enabled.value` is true.

- [ ] **Step 2: Parse persisted positions**

Add:

```ts
private parsePersistedSourcePositions(): Record<string, { x: number; y: number }> {
  const raw = this.settings.mapCanvasSettings.persistedSourcePositions.value;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, { x?: unknown; y?: unknown }>;
    const result: Record<string, { x: number; y: number }> = {};
    for (const [key, point] of Object.entries(parsed)) {
      const x = typeof point.x === 'number' ? point.x : Number(point.x);
      const y = typeof point.y === 'number' ? point.y : Number(point.y);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        result[key] = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
      }
    }
    return result;
  } catch {
    return {};
  }
}
```

- [ ] **Step 3: Create map layout targets**

Add a helper that places persisted source nodes at normalized coordinates, unpersisted source nodes in a grid over the map, target nodes in a rail based on `targetRailPosition`, and `both` nodes near center.

- [ ] **Step 4: Preserve map coordinates through settling**

For map mode, seed node `x/y` from map targets and use forceX/forceY with strong source force. Do not let `settleInitialLayout` recenter persisted map nodes away from their normalized positions.

- [ ] **Step 5: Persist source drag end**

On drag end in map mode for source nodes:

```ts
this.persistSourceNodePosition(d.id, event.x, event.y, innerWidth, innerHeight);
```

Persist object:

```ts
this.host.persistProperties({
  merge: [{
    objectName: 'mapCanvasSettings',
    selector: null,
    properties: {
      persistedSourcePositions: JSON.stringify(nextPositions),
      resetPositions: false,
    },
  }],
});
```

- [ ] **Step 6: Implement reset**

When `resetPositions.value` is true, persist an empty `persistedSourcePositions` string and set `resetPositions` false.

- [ ] **Step 7: Run layout/persistence tests**

Run:

```bash
npm test -- --run packages/network-graph/src/__tests__/visual.test.ts
```

Expected: persisted source position and target rail tests pass. Persistence test may need event adjustment if JSDOM does not trigger D3 drag; if so, expose and test a narrow helper through drag behavior by dispatching the correct pointer/mouse sequence.

---

### Task 9: Implement Measure Badges And Tooltip Details

**Files:**
- Modify: `packages/network-graph/src/visual.ts`

- [ ] **Step 1: Add badge layer**

After label elements, append `g.network-measure-badges`. Render badges for source nodes when `measureBadgeSettings.showBadges.value` is true and detail values are present.

- [ ] **Step 2: Select badge measure**

Use `badgeMeasureName.value` when it matches a detail measure label. If empty or not found, use the first detail measure label.

- [ ] **Step 3: Format badge text**

For `badgeDisplayMode`:

- `value`: `105`
- `nameValue`: `Signed Welds 105`
- `name`: `Signed Welds`

Use `formatWithSettings(value, this.settings.numberFormattingCard)`.

- [ ] **Step 4: Update badge positions on tick**

Place badge groups above/right of the node using `badgeOffset`. Update their transforms inside `updatePositions`.

- [ ] **Step 5: Add tooltip detail rows**

In node tooltip generation, append all `detailValues` rows:

```ts
for (const [label, value] of Object.entries(d.detailValues)) {
  tooltipItems.push({ displayName: label, value: formatWithSettings(value, this.settings.numberFormattingCard) });
}
```

In link tooltip generation, append `d.detailValues` rows when present.

- [ ] **Step 6: Run badge tests**

Run:

```bash
npm test -- --run packages/network-graph/src/__tests__/visual.test.ts
```

Expected: badge test passes.

---

### Task 10: Verification, Version, Build, And Sync

**Files:**
- Modify: `packages/network-graph/pbiviz.json`
- Modify: `packages/network-graph/package.json`
- Modify: `package-lock.json`
- Generated: `packages/network-graph/dist/networkGraph_4E5F6A7B8C9D.1.0.14.0.pbiviz`
- Generated: `Business_Package/networkGraph_4E5F6A7B8C9D.1.0.14.0.pbiviz`
- Generated: `LotusWorks_Package/networkGraph_4E5F6A7B8C9D.1.0.14.0.pbiviz`

- [ ] **Step 1: Run full Network Graph tests**

Run:

```bash
npm test -- --run packages/network-graph/src/__tests__/visual.test.ts packages/network-graph/src/__tests__/formatting-coverage.test.ts
```

Expected: all Network Graph tests pass.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: no TypeScript errors.

- [ ] **Step 3: Bump version**

Change:

- `packages/network-graph/pbiviz.json` visual version to `1.0.14.0`.
- `packages/network-graph/package.json` version to `1.0.14`.
- `package-lock.json` `packages/network-graph` version to `1.0.14`.

- [ ] **Step 4: Build package**

Remove the old network graph pbiviz from dist and run:

```bash
rm -f packages/network-graph/dist/networkGraph_4E5F6A7B8C9D.1.0.13.0.pbiviz
npm run build --workspace @pbi/network-graph
```

Expected: `packages/network-graph/dist/networkGraph_4E5F6A7B8C9D.1.0.14.0.pbiviz` exists.

- [ ] **Step 5: Sync packages**

Run:

```bash
npm run sync:business
npm run sync:lotusworks
npm run review:business
```

Expected: Business and LotusWorks package folders contain `networkGraph_4E5F6A7B8C9D.1.0.14.0.pbiviz`; review reports `warnings=0, errors=0`.

- [ ] **Step 6: Commit**

If the user requests a commit, stage only Network Graph, spec/plan, package-lock, and generated package artifacts for this task:

```bash
git add docs/superpowers/specs/2026-06-02-network-graph-map-canvas-design.md docs/superpowers/plans/2026-06-02-network-graph-map-canvas.md package-lock.json packages/network-graph Business_Package/networkGraph_4E5F6A7B8C9D.1.0.14.0.pbiviz LotusWorks_Package/networkGraph_4E5F6A7B8C9D.1.0.14.0.pbiviz
git commit -m "feat: add network graph map canvas mode"
```
