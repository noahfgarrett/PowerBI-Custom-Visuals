# Network Graph Filter Tray Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved simple-first Network Graph filter tray with a `More` row, and add target-node dynamic sizing by connection count or total weight.

**Architecture:** Keep the implementation inside the existing Network Graph package and preserve current report behavior by default. Replace the single active detail filter state with a list of filter rules, render a compact tray from that rule state, and compute filtered match sets through reusable helper methods. Add target-specific radius mode on top of the existing degree/weight maps already computed during render.

**Tech Stack:** Power BI custom visual, TypeScript, D3, LESS, Vitest/JSDOM, npm workspaces.

---

## File Structure

- Modify `packages/network-graph/src/visual.ts`
  - Add filter rule types and state.
  - Replace the current two-select detail filter panel with the simple tray.
  - Add multi-rule matching, OR-within-field and AND-across-fields filtering.
  - Add `More` row result/focus controls.
  - Add target-node size mode radius logic.
- Modify `packages/network-graph/style/visual.less`
  - Style the filter tray, active count badge, chips, builder row, zero helpers, More row, and results list.
- Modify `packages/network-graph/src/settings.ts`
  - Add `targetSizeMode` dropdown to Node settings.
  - Rename min/max radius display labels to dynamic radius wording while preserving property names.
- Modify `packages/network-graph/capabilities.json`
  - Add the `targetSizeMode` formatting property.
  - Update min/max radius display labels.
- Modify `packages/network-graph/src/__tests__/visual.test.ts`
  - Add regression tests for target size by count and weight.
  - Add filter tray tests for badges, chips, OR/AND, decimals, zero helpers, and More controls.
- Modify version/package artifacts during the final packaging task:
  - `packages/network-graph/package.json`
  - `packages/network-graph/pbiviz.json`
  - `package-lock.json`
  - `packages/network-graph/dist/*.pbiviz`
  - `Business_Package/networkGraph_4E5F6A7B8C9D.1.0.31.0.pbiviz`
  - `LotusWorks_Package/networkGraph_4E5F6A7B8C9D.1.0.31.0.pbiviz`

---

### Task 1: Target Node Dynamic Size Settings

**Files:**
- Modify: `packages/network-graph/src/__tests__/visual.test.ts`
- Modify: `packages/network-graph/src/settings.ts`
- Modify: `packages/network-graph/capabilities.json`
- Modify: `packages/network-graph/src/visual.ts`

- [ ] **Step 1: Write the failing target size-by-weight test**

Add this test near the existing size-by-degree tests in `packages/network-graph/src/__tests__/visual.test.ts`:

```ts
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
```

- [ ] **Step 2: Write the failing target size-by-count test**

Add this test below the weight test:

```ts
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
```

- [ ] **Step 3: Run target sizing tests and verify they fail**

Run:

```bash
npx vitest run packages/network-graph/src/__tests__/visual.test.ts -t "target node radius"
```

Expected: the two new tests fail because `targetSizeMode` does not exist and all target nodes still use fixed radius unless global `sizeByDegree` is enabled.

- [ ] **Step 4: Add the Node settings dropdown**

In `packages/network-graph/src/settings.ts`, add this control inside `NodeSettings` after `sizeByDegree`:

```ts
  targetSizeMode = new formattingSettings.ItemDropdown({
    name: 'targetSizeMode',
    displayName: 'Target Size Mode',
    items: [
      { value: 'fixed', displayName: 'Fixed' },
      { value: 'count', displayName: 'Connection Count' },
      { value: 'weight', displayName: 'Total Weight' },
    ],
    value: { value: 'fixed', displayName: 'Fixed' },
  });
```

Change the display names for the existing bounds:

```ts
  minRadius = new formattingSettings.NumUpDown({
    name: 'minRadius',
    displayName: 'Min Dynamic Radius',
    value: 4,
  });

  maxRadius = new formattingSettings.NumUpDown({
    name: 'maxRadius',
    displayName: 'Max Dynamic Radius',
    value: 20,
  });
```

Add `this.targetSizeMode` to the `slices` array immediately after `this.sizeByDegree`.

- [ ] **Step 5: Add the capability property**

In `packages/network-graph/capabilities.json`, add `targetSizeMode` under `objects.nodeSettings.properties` after `sizeByDegree`:

```json
        "targetSizeMode": {
          "displayName": "Target Size Mode",
          "type": {
            "enumeration": [
              { "value": "fixed", "displayName": "Fixed" },
              { "value": "count", "displayName": "Connection Count" },
              { "value": "weight", "displayName": "Total Weight" }
            ]
          }
        },
```

Update `minRadius` and `maxRadius` display names:

```json
        "minRadius": {
          "displayName": "Min Dynamic Radius",
          "type": { "numeric": true }
        },
        "maxRadius": {
          "displayName": "Max Dynamic Radius",
          "type": { "numeric": true }
        },
```

- [ ] **Step 6: Implement target radius mode in `visual.ts`**

Add a type near the other type aliases:

```ts
type TargetSizeMode = 'fixed' | 'count' | 'weight';
```

Add helpers near the label/layout helper methods:

```ts
  private getTargetSizeMode(): TargetSizeMode {
    const rawMode = resolveDropdown(this.settings.nodeSettings.targetSizeMode) ?? 'fixed';
    return rawMode === 'count' || rawMode === 'weight' ? rawMode : 'fixed';
  }

  private getScaledRadius(value: number, maxValue: number, minRadius: number, maxRadius: number): number {
    if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(maxValue) || maxValue <= 0) {
      return minRadius;
    }
    const ratio = this.clamp(value / maxValue, 0, 1);
    return minRadius + ratio * (maxRadius - minRadius);
  }
```

In `render`, after `totalWeightMap` is populated, compute `maxTargetWeight`:

```ts
    const targetNodesForSizing = simNodes.filter((node) => node.role === 'target' || node.role === 'both');
    const maxTargetWeight = Math.max(
      1,
      ...targetNodesForSizing.map((node) => totalWeightMap.get(node.id) ?? 0),
    );
```

Replace the current `getNodeRadius` body with:

```ts
    const targetSizeMode = this.getTargetSizeMode();
    const getNodeRadius = (d: GraphNode): number => {
      if ((d.role === 'target' || d.role === 'both') && targetSizeMode !== 'fixed') {
        const value = targetSizeMode === 'weight'
          ? totalWeightMap.get(d.id) ?? 0
          : degreeMap.get(d.id) ?? 1;
        const maxValue = targetSizeMode === 'weight' ? maxTargetWeight : maxDegree;
        return this.getScaledRadius(value, maxValue, minDegreeRadius, maxDegreeRadius);
      }

      if (sizeByDegree) {
        const degree = degreeMap.get(d.id) ?? 1;
        return this.getScaledRadius(degree, maxDegree, minDegreeRadius, maxDegreeRadius);
      }

      return nodeRadius;
    };
```

- [ ] **Step 7: Run target sizing tests and verify they pass**

Run:

```bash
npx vitest run packages/network-graph/src/__tests__/visual.test.ts -t "target node radius"
```

Expected: PASS for the existing and new target radius tests.

---

### Task 2: Filter Rule State And Matching Logic

**Files:**
- Modify: `packages/network-graph/src/__tests__/visual.test.ts`
- Modify: `packages/network-graph/src/visual.ts`

- [ ] **Step 1: Add multi-rule OR/AND filter test**

Add this test near the existing detail filter tests:

```ts
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
```

- [ ] **Step 2: Run the OR/AND test and verify it fails**

Run:

```bash
npx vitest run packages/network-graph/src/__tests__/visual.test.ts -t "OR within"
```

Expected: FAIL because `.network-detail-filter-add` and multi-rule state do not exist.

- [ ] **Step 3: Add filter rule types and state**

In `packages/network-graph/src/visual.ts`, add types near the current detail filter types:

```ts
type DetailFilterOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte';

interface DetailFilterRule {
  id: string;
  kind: DetailFilterKind;
  label: string;
  operator: DetailFilterOperator;
  value: string;
  numericValue?: number;
  display: string;
}
```

Replace the current filter state fields:

```ts
  private detailFilterField = '';
  private detailFilterValue = '';
```

with:

```ts
  private detailFilterRules: DetailFilterRule[] = [];
  private pendingDetailFilterField = '';
  private pendingDetailFilterOperator: DetailFilterOperator = 'eq';
  private pendingDetailFilterValue = '';
  private detailFilterMoreOpen = false;
  private nextDetailFilterRuleId = 1;
```

Where the visual currently clears `detailFilterField` and `detailFilterValue`, clear the new pending fields and rule array:

```ts
      this.detailFilterRules = [];
      this.pendingDetailFilterField = '';
      this.pendingDetailFilterValue = '';
      this.pendingDetailFilterOperator = 'eq';
      this.detailFilterMoreOpen = false;
```

- [ ] **Step 4: Add rule grouping and matching helpers**

Replace `isDetailFilterActive` and `nodeMatchesDetailFilter` with:

```ts
  private isDetailFilterActive(): boolean {
    return this.detailFilterRules.length > 0;
  }

  private nodeMatchesDetailFilterRules(node: GraphNode): boolean {
    if (!this.isDetailFilterActive()) return true;

    const groups = new Map<string, DetailFilterRule[]>();
    for (const rule of this.detailFilterRules) {
      const key = `${rule.kind}:${rule.label}`;
      const group = groups.get(key) ?? [];
      group.push(rule);
      groups.set(key, group);
    }

    for (const group of groups.values()) {
      if (!group.some((rule) => this.nodeMatchesDetailFilterRule(node, rule))) {
        return false;
      }
    }
    return true;
  }

  private nodeMatchesDetailFilterRule(node: GraphNode, rule: DetailFilterRule): boolean {
    if (rule.kind === 'target') {
      return (node.role === 'target' || node.role === 'both') && node.displayLabel === rule.value;
    }

    if (rule.kind === 'field') {
      return (node.detailFields[rule.label] ?? []).includes(rule.value);
    }

    const value = node.detailValues[rule.label] ?? 0;
    const comparison = rule.numericValue ?? Number(rule.value);
    if (!Number.isFinite(comparison)) return false;
    switch (rule.operator) {
      case 'eq':
        return value === comparison;
      case 'ne':
        return value !== comparison;
      case 'gt':
        return value > comparison;
      case 'gte':
        return value >= comparison;
      case 'lt':
        return value < comparison;
      case 'lte':
        return value <= comparison;
      default:
        return true;
    }
  }
```

Update `applyInteractiveFilters` to call `nodeMatchesDetailFilterRules(node)` instead of `nodeMatchesDetailFilter(node)`. Replace the single parsed target filter check with:

```ts
    if (this.detailFilterRules.some((rule) => rule.kind === 'target')) {
      const connectedSourceIds = this.getConnectedSourceIdsForMatchedTargets(data, matchedIds);
      for (const sourceId of connectedSourceIds) {
        matchedIds.add(sourceId);
      }
    }
```

- [ ] **Step 5: Run OR/AND test and verify it still fails on UI only**

Run:

```bash
npx vitest run packages/network-graph/src/__tests__/visual.test.ts -t "OR within"
```

Expected: FAIL only because the new tray controls are not rendered yet.

---

### Task 3: Simple Filter Tray UI

**Files:**
- Modify: `packages/network-graph/src/__tests__/visual.test.ts`
- Modify: `packages/network-graph/src/visual.ts`
- Modify: `packages/network-graph/style/visual.less`

- [ ] **Step 1: Add active count and chip rendering test**

Add this test near the filter tests:

```ts
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
```

- [ ] **Step 2: Run tray UI tests and verify they fail**

Run:

```bash
npx vitest run packages/network-graph/src/__tests__/visual.test.ts -t "active filter count"
```

Expected: FAIL because badge, chips, and add button are missing.

- [ ] **Step 3: Update filter button count badge**

In `renderSearchInput`, after appending the filter icon:

```ts
      const activeFilterCount = this.detailFilterRules.length;
      filterToggle.setAttribute(
        'aria-label',
        activeFilterCount > 0
          ? `${this.detailFilterOpen ? 'Hide' : 'Show'} detail filter, ${activeFilterCount} active`
          : `${this.detailFilterOpen ? 'Hide' : 'Show'} detail filter`,
      );
      if (activeFilterCount > 0) {
        const countBadge = document.createElement('span');
        countBadge.className = 'network-detail-filter-count';
        countBadge.textContent = String(activeFilterCount);
        filterToggle.appendChild(countBadge);
      }
```

Remove the earlier filter aria-label line so the label is not set twice.

- [ ] **Step 4: Replace the panel with tray sections**

Refactor `createDetailFilterPanel` so it appends these parts in order:

```ts
    panel.appendChild(this.createDetailFilterHeader(data));
    panel.appendChild(this.createDetailFilterChips(data));
    panel.appendChild(this.createDetailFilterBuilder(data, detailFields));
    panel.appendChild(this.createDetailFilterMoreRow(data));
    panel.appendChild(this.createDetailFilterFooter(data));
```

Add these helper methods:

```ts
  private createDetailFilterHeader(data: NetworkData): HTMLDivElement {
    const header = document.createElement('div');
    header.className = 'network-detail-filter-header';
    const title = document.createElement('div');
    title.className = 'network-detail-filter-title';
    title.textContent = 'Filters';
    const count = document.createElement('div');
    count.className = 'network-detail-filter-match-count';
    count.textContent = `${this.getMatchedNodeIds(data).size} of ${data.nodes.length} nodes`;
    header.appendChild(title);
    header.appendChild(count);
    return header;
  }

  private createDetailFilterChips(data: NetworkData): HTMLDivElement {
    const chips = document.createElement('div');
    chips.className = 'network-detail-filter-chips';
    for (const rule of this.detailFilterRules) {
      const chip = document.createElement('span');
      chip.className = 'network-detail-filter-chip';
      chip.title = rule.display;
      chip.textContent = rule.display;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'network-detail-filter-chip-remove';
      remove.setAttribute('aria-label', `Remove ${rule.display}`);
      remove.textContent = 'x';
      remove.addEventListener('click', (event) => {
        event.stopPropagation();
        this.detailFilterRules = this.detailFilterRules.filter((candidate) => candidate.id !== rule.id);
        this.renderSearchInput(data);
        this.applyInteractiveFilters(data);
      });
      chip.appendChild(remove);
      chips.appendChild(chip);
    }
    return chips;
  }
```

Add `getMatchedNodeIds`:

```ts
  private getMatchedNodeIds(data: NetworkData): Set<string> {
    const query = this.searchQuery.toLowerCase().trim();
    const matchedIds = new Set<string>();
    for (const node of data.nodes) {
      const matchesSearch = query.length === 0
        || node.id.toLowerCase().includes(query)
        || node.displayLabel.toLowerCase().includes(query);
      if (matchesSearch && this.nodeMatchesDetailFilterRules(node)) {
        matchedIds.add(node.id);
      }
    }
    if (this.detailFilterRules.some((rule) => rule.kind === 'target')) {
      for (const sourceId of this.getConnectedSourceIdsForMatchedTargets(data, matchedIds)) {
        matchedIds.add(sourceId);
      }
    }
    return matchedIds;
  }
```

Then update `applyInteractiveFilters` to use `const matchedIds = this.getMatchedNodeIds(data);`.

- [ ] **Step 5: Add the builder row and footer**

Add these helpers:

```ts
  private createDetailFilterBuilder(data: NetworkData, detailFields: DetailFilterFieldOption[]): HTMLDivElement {
    const builder = document.createElement('div');
    builder.className = 'network-detail-filter-builder';

    const fieldSelect = document.createElement('select');
    fieldSelect.className = 'network-detail-filter-field';
    fieldSelect.setAttribute('aria-label', 'Detail filter field');
    fieldSelect.appendChild(this.createOption('', 'Field'));
    for (const field of detailFields) {
      fieldSelect.appendChild(this.createOption(field.key, field.label));
    }
    fieldSelect.value = this.pendingDetailFilterField;
    this.applyDetailFilterSelectSizing(fieldSelect, 'Field', 10, 26);
    fieldSelect.addEventListener('change', () => {
      this.pendingDetailFilterField = fieldSelect.value;
      this.pendingDetailFilterValue = '';
      this.pendingDetailFilterOperator = 'eq';
      this.renderSearchInput(data);
    });

    builder.appendChild(fieldSelect);
    const parsed = this.parseDetailFilterKey(this.pendingDetailFilterField);
    if (parsed?.kind === 'measure') {
      builder.appendChild(this.createMeasureOperatorSelect(data));
      builder.appendChild(this.createMeasureValueInput());
      builder.appendChild(this.createZeroHelperRow(data));
    } else {
      builder.appendChild(this.createCategoricalValueSelect(data));
    }

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'network-detail-filter-add';
    add.textContent = 'Add';
    add.disabled = !this.canAddPendingDetailFilter();
    add.addEventListener('click', (event) => {
      event.stopPropagation();
      this.addPendingDetailFilterRule(data);
    });
    builder.appendChild(add);
    return builder;
  }

  private createDetailFilterFooter(data: NetworkData): HTMLDivElement {
    const footer = document.createElement('div');
    footer.className = 'network-detail-filter-footer';
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'network-detail-filter-clear';
    clear.textContent = 'Clear';
    clear.disabled = !this.isDetailFilterActive();
    clear.addEventListener('click', (event) => {
      event.stopPropagation();
      this.detailFilterRules = [];
      this.pendingDetailFilterField = '';
      this.pendingDetailFilterValue = '';
      this.pendingDetailFilterOperator = 'eq';
      this.detailFilterMoreOpen = false;
      this.renderSearchInput(data);
      this.applyInteractiveFilters(data);
    });

    const done = document.createElement('button');
    done.type = 'button';
    done.className = 'network-detail-filter-done';
    done.textContent = 'Done';
    done.addEventListener('click', (event) => {
      event.stopPropagation();
      this.detailFilterOpen = false;
      this.renderSearchInput(data);
    });

    footer.appendChild(clear);
    footer.appendChild(done);
    return footer;
  }
```

Add the small option helper:

```ts
  private createOption(value: string, label: string): HTMLOptionElement {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    return option;
  }
```

- [ ] **Step 6: Run tray and OR/AND tests**

Run:

```bash
npx vitest run packages/network-graph/src/__tests__/visual.test.ts -t "active filter count|OR within"
```

Expected: PASS.

---

### Task 4: Numeric Measure Rules And Zero Helpers

**Files:**
- Modify: `packages/network-graph/src/__tests__/visual.test.ts`
- Modify: `packages/network-graph/src/visual.ts`

- [ ] **Step 1: Add decimal threshold test**

Add this test near the detail measure filter tests:

```ts
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
```

- [ ] **Step 2: Add invalid numeric input and zero helper tests**

Add:

```ts
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
```

- [ ] **Step 3: Run numeric tests and verify they fail**

Run:

```bash
npx vitest run packages/network-graph/src/__tests__/visual.test.ts -t "decimal thresholds|invalid measure values"
```

Expected: FAIL because numeric operator/value controls are not implemented.

- [ ] **Step 4: Add measure controls and rule creation**

Add these helpers:

```ts
  private createMeasureOperatorSelect(data: NetworkData): HTMLSelectElement {
    const select = document.createElement('select');
    select.className = 'network-detail-filter-operator';
    select.setAttribute('aria-label', 'Detail measure operator');
    const operators: Array<[DetailFilterOperator, string]> = [
      ['eq', '='],
      ['ne', '!='],
      ['gt', '>'],
      ['gte', '>='],
      ['lt', '<'],
      ['lte', '<='],
    ];
    for (const [value, label] of operators) {
      select.appendChild(this.createOption(value, label));
    }
    select.value = this.pendingDetailFilterOperator;
    select.addEventListener('change', () => {
      this.pendingDetailFilterOperator = select.value as DetailFilterOperator;
      this.renderSearchInput(data);
    });
    return select;
  }

  private createMeasureValueInput(): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'number';
    input.step = 'any';
    input.className = 'network-detail-filter-number';
    input.setAttribute('aria-label', 'Detail measure value');
    input.placeholder = 'Value';
    input.value = this.pendingDetailFilterValue;
    input.addEventListener('input', () => {
      this.pendingDetailFilterValue = input.value;
      const add = this.container.querySelector<HTMLButtonElement>('.network-detail-filter-add');
      if (add) add.disabled = !this.canAddPendingDetailFilter();
    });
    return input;
  }

  private createZeroHelperRow(data: NetworkData): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'network-detail-filter-zero-helpers';
    const zero = document.createElement('button');
    zero.type = 'button';
    zero.className = 'network-detail-filter-zero';
    zero.textContent = '= 0';
    zero.addEventListener('click', (event) => {
      event.stopPropagation();
      this.addMeasureHelperRule(data, 'eq', 0);
    });
    const positive = document.createElement('button');
    positive.type = 'button';
    positive.className = 'network-detail-filter-positive';
    positive.textContent = '> 0';
    positive.addEventListener('click', (event) => {
      event.stopPropagation();
      this.addMeasureHelperRule(data, 'gt', 0);
    });
    row.appendChild(zero);
    row.appendChild(positive);
    return row;
  }
```

Add:

```ts
  private canAddPendingDetailFilter(): boolean {
    const parsed = this.parseDetailFilterKey(this.pendingDetailFilterField);
    if (!parsed) return false;
    if (parsed.kind === 'measure') {
      return Number.isFinite(Number(this.pendingDetailFilterValue));
    }
    return this.pendingDetailFilterValue.length > 0;
  }

  private addPendingDetailFilterRule(data: NetworkData): void {
    const parsed = this.parseDetailFilterKey(this.pendingDetailFilterField);
    if (!parsed || !this.canAddPendingDetailFilter()) return;
    if (parsed.kind === 'measure') {
      this.addDetailFilterRule(data, parsed.kind, parsed.label, this.pendingDetailFilterOperator, this.pendingDetailFilterValue);
    } else {
      this.addDetailFilterRule(data, parsed.kind, parsed.label, 'eq', this.pendingDetailFilterValue);
    }
  }

  private addMeasureHelperRule(data: NetworkData, operator: DetailFilterOperator, value: number): void {
    const parsed = this.parseDetailFilterKey(this.pendingDetailFilterField);
    if (!parsed || parsed.kind !== 'measure') return;
    this.addDetailFilterRule(data, 'measure', parsed.label, operator, String(value));
  }

  private addDetailFilterRule(
    data: NetworkData,
    kind: DetailFilterKind,
    label: string,
    operator: DetailFilterOperator,
    value: string,
  ): void {
    const numericValue = kind === 'measure' ? Number(value) : undefined;
    if (kind === 'measure' && !Number.isFinite(numericValue)) return;
    const display = this.getDetailFilterRuleDisplay(kind, label, operator, value);
    this.detailFilterRules = [
      ...this.detailFilterRules,
      {
        id: `filter-${this.nextDetailFilterRuleId++}`,
        kind,
        label,
        operator,
        value,
        numericValue,
        display,
      },
    ];
    this.pendingDetailFilterValue = '';
    this.renderSearchInput(data);
    this.applyInteractiveFilters(data);
  }

  private getDetailFilterRuleDisplay(
    kind: DetailFilterKind,
    label: string,
    operator: DetailFilterOperator,
    value: string,
  ): string {
    if (kind === 'target') return `Target: ${value}`;
    if (kind === 'field') return `${label}: ${value}`;
    const operatorLabel = this.getDetailFilterOperatorLabel(operator);
    return `${label} ${operatorLabel} ${value}`;
  }

  private getDetailFilterOperatorLabel(operator: DetailFilterOperator): string {
    switch (operator) {
      case 'eq': return '=';
      case 'ne': return '!=';
      case 'gt': return '>';
      case 'gte': return '>=';
      case 'lt': return '<';
      case 'lte': return '<=';
      default: return '=';
    }
  }
```

Implement `createCategoricalValueSelect` with the existing `getDetailFilterValueOptions`:

```ts
  private createCategoricalValueSelect(data: NetworkData): HTMLSelectElement {
    const select = document.createElement('select');
    select.className = 'network-detail-filter-value';
    select.setAttribute('aria-label', 'Detail filter value');
    select.appendChild(this.createOption('', 'Value'));
    for (const filterValue of this.getDetailFilterValueOptions(data, this.pendingDetailFilterField)) {
      select.appendChild(this.createOption(filterValue.value, filterValue.label));
    }
    select.value = this.pendingDetailFilterValue;
    select.disabled = this.pendingDetailFilterField.length === 0;
    this.applyDetailFilterSelectSizing(select, 'Value', 8, 22);
    select.addEventListener('change', () => {
      this.pendingDetailFilterValue = select.value;
      const add = this.container.querySelector<HTMLButtonElement>('.network-detail-filter-add');
      if (add) add.disabled = !this.canAddPendingDetailFilter();
    });
    return select;
  }
```

- [ ] **Step 5: Run numeric tests**

Run:

```bash
npx vitest run packages/network-graph/src/__tests__/visual.test.ts -t "decimal thresholds|invalid measure values"
```

Expected: PASS.

---

### Task 5: More Row, Results, And Focus Matched

**Files:**
- Modify: `packages/network-graph/src/__tests__/visual.test.ts`
- Modify: `packages/network-graph/src/visual.ts`

- [ ] **Step 1: Add More row test**

Add:

```ts
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
```

- [ ] **Step 2: Run More row test and verify it fails**

Run:

```bash
npx vitest run packages/network-graph/src/__tests__/visual.test.ts -t "More row"
```

Expected: FAIL because the More row is not implemented.

- [ ] **Step 3: Add More row rendering**

Implement `createDetailFilterMoreRow`:

```ts
  private createDetailFilterMoreRow(data: NetworkData): HTMLDivElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'network-detail-filter-more';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'network-detail-filter-more-toggle';
    toggle.setAttribute('aria-expanded', this.detailFilterMoreOpen ? 'true' : 'false');
    toggle.textContent = this.detailFilterMoreOpen ? 'Hide results' : 'More';
    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      this.detailFilterMoreOpen = !this.detailFilterMoreOpen;
      this.renderSearchInput(data);
    });
    wrapper.appendChild(toggle);

    if (this.detailFilterMoreOpen) {
      const results = document.createElement('div');
      results.className = 'network-detail-filter-results';
      const matchedIds = this.getMatchedNodeIds(data);
      const matchedNodes = data.nodes
        .filter((node) => matchedIds.has(node.id))
        .slice(0, 8);
      for (const node of matchedNodes) {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'network-detail-filter-result';
        row.textContent = node.displayLabel;
        row.addEventListener('click', (event) => {
          event.stopPropagation();
          this.focusNodeById(node.id);
        });
        results.appendChild(row);
      }
      const focusMatched = document.createElement('button');
      focusMatched.type = 'button';
      focusMatched.className = 'network-detail-filter-focus-matched';
      focusMatched.textContent = 'Focus Matched';
      focusMatched.addEventListener('click', (event) => {
        event.stopPropagation();
        this.focusMatchedNodes(data);
      });
      wrapper.appendChild(results);
      wrapper.appendChild(focusMatched);
    }

    return wrapper;
  }
```

- [ ] **Step 4: Implement focus helpers**

Add lightweight focus helpers that work even when zoom is disabled by clicking/focusing nodes without requiring a new D3 zoom dependency outside render:

```ts
  private focusNodeById(nodeId: string): void {
    const node = this.container.querySelector<SVGCircleElement>(`.network-node[data-node="${CSS.escape(nodeId)}"]`);
    node?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  private focusMatchedNodes(data: NetworkData): void {
    const matchedIds = this.getMatchedNodeIds(data);
    const svgEl = this.container.querySelector('svg.network-svg');
    if (!svgEl) return;
    svgEl.querySelectorAll<SVGCircleElement>('.network-node').forEach((node) => {
      const nodeId = node.getAttribute('data-node') ?? '';
      if (matchedIds.has(nodeId)) {
        node.style.filter = 'url(#node-glow)';
      } else {
        node.style.filter = '';
      }
    });
  }
```

If `CSS.escape` is not available in JSDOM, use a safe loop instead:

```ts
  private focusNodeById(nodeId: string): void {
    const nodes = this.container.querySelectorAll<SVGCircleElement>('.network-node');
    for (const node of Array.from(nodes)) {
      if (node.getAttribute('data-node') === nodeId) {
        node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return;
      }
    }
  }
```

Use the safe loop implementation.

- [ ] **Step 5: Run More row test**

Run:

```bash
npx vitest run packages/network-graph/src/__tests__/visual.test.ts -t "More row"
```

Expected: PASS.

---

### Task 6: Filter Tray Styling

**Files:**
- Modify: `packages/network-graph/style/visual.less`

- [ ] **Step 1: Add tray styles**

Replace the current `.network-detail-filter-panel`, `.network-detail-filter-field`, `.network-detail-filter-value`, and `.network-detail-filter-clear` block with styles that support the tray:

```less
.network-detail-filter-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: max-content;
  max-width: min(380px, calc(100vw - 76px));
  padding: 10px;
  border: 1px solid rgba(148, 163, 184, 0.34);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(10px);
}

.network-detail-filter-count {
  position: absolute;
  top: -6px;
  right: -5px;
  min-width: 16px;
  height: 16px;
  display: grid;
  place-items: center;
  border: 2px solid #ffffff;
  border-radius: 999px;
  background: #2563eb;
  color: #ffffff;
  font-size: 9px;
  font-weight: 800;
  line-height: 1;
}

.network-detail-filter-header,
.network-detail-filter-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.network-detail-filter-title {
  color: #0f172a;
  font-size: 13px;
  font-weight: 800;
}

.network-detail-filter-match-count {
  color: #64748b;
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
}

.network-detail-filter-chips,
.network-detail-filter-zero-helpers {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.network-detail-filter-chip {
  max-width: 150px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border-radius: 999px;
  padding: 5px 7px;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 10px;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.network-detail-filter-chip-remove,
.network-detail-filter-zero,
.network-detail-filter-positive,
.network-detail-filter-more-toggle,
.network-detail-filter-focus-matched,
.network-detail-filter-add,
.network-detail-filter-clear,
.network-detail-filter-done {
  border: 0;
  border-radius: 999px;
  padding: 6px 9px;
  background: #e2e8f0;
  color: #334155;
  cursor: pointer;
  font: inherit;
  font-size: 10px;
  font-weight: 800;
}

.network-detail-filter-done,
.network-detail-filter-add,
.network-detail-filter-focus-matched {
  background: #2563eb;
  color: #ffffff;
}

.network-detail-filter-add:disabled,
.network-detail-filter-clear:disabled {
  cursor: default;
  opacity: 0.48;
}

.network-detail-filter-builder {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: 6px;
}

.network-detail-filter-field,
.network-detail-filter-value,
.network-detail-filter-operator,
.network-detail-filter-number {
  min-width: 0;
  border: 0;
  border-radius: 999px;
  padding: 6px 8px;
  outline: none;
  background: rgba(241, 245, 249, 0.9);
  color: #0f172a;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.network-detail-filter-number {
  width: 72px;
}

.network-detail-filter-more {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.network-detail-filter-results {
  display: grid;
  gap: 5px;
}

.network-detail-filter-result {
  border: 0;
  border-radius: 8px;
  padding: 7px 8px;
  background: #f8fafc;
  color: #334155;
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 2: Run focused filter DOM tests**

Run:

```bash
npx vitest run packages/network-graph/src/__tests__/visual.test.ts -t "filter"
```

Expected: PASS for filter-related tests.

---

### Task 7: Version, Package, And Verification

**Files:**
- Modify: `packages/network-graph/package.json`
- Modify: `packages/network-graph/pbiviz.json`
- Modify: `package-lock.json`
- Generated: `packages/network-graph/dist/networkGraph_4E5F6A7B8C9D.1.0.31.0.pbiviz`
- Generated: `Business_Package/networkGraph_4E5F6A7B8C9D.1.0.31.0.pbiviz`
- Generated: `LotusWorks_Package/networkGraph_4E5F6A7B8C9D.1.0.31.0.pbiviz`

- [ ] **Step 1: Run the full Network Graph test file**

Run:

```bash
npx vitest run packages/network-graph/src/__tests__/visual.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Bump Network Graph version to `1.0.31`**

Update `packages/network-graph/package.json`:

```json
  "version": "1.0.31",
```

Update `packages/network-graph/pbiviz.json`:

```json
    "version": "1.0.31.0",
```

Update the `packages/network-graph` package entry in `package-lock.json` to:

```json
      "version": "1.0.31",
```

- [ ] **Step 4: Rebuild only Network Graph**

Run:

```bash
rm -f packages/network-graph/dist/*.pbiviz
npm run build -w @pbi/network-graph
```

Expected: `packages/network-graph/dist/networkGraph_4E5F6A7B8C9D.1.0.31.0.pbiviz` exists.

- [ ] **Step 5: Sync package folders**

Run:

```bash
npm run sync:business
npm run sync:lotusworks
```

Expected: Business and LotusWorks package folders contain `networkGraph_4E5F6A7B8C9D.1.0.31.0.pbiviz`.

- [ ] **Step 6: Review package inventory**

Run:

```bash
npm run review:business
```

Expected: review completes with warnings 0 and errors 0.

- [ ] **Step 7: Commit the implementation**

Stage only files touched by this plan:

```bash
git add \
  packages/network-graph/src/visual.ts \
  packages/network-graph/style/visual.less \
  packages/network-graph/src/settings.ts \
  packages/network-graph/capabilities.json \
  packages/network-graph/src/__tests__/visual.test.ts \
  packages/network-graph/package.json \
  packages/network-graph/pbiviz.json \
  package-lock.json \
  packages/network-graph/dist/networkGraph_4E5F6A7B8C9D.1.0.31.0.pbiviz \
  Business_Package/networkGraph_4E5F6A7B8C9D.1.0.31.0.pbiviz \
  LotusWorks_Package/networkGraph_4E5F6A7B8C9D.1.0.31.0.pbiviz
git commit -m "feat: expand network graph filter tray"
```

Expected: one commit containing only Network Graph filter tray, target sizing, version, and package artifacts.

---

## Self-Review

Spec coverage:

- Active count badge: Task 3.
- Simple tray with chips and add row: Task 3.
- Decimal measure thresholds: Task 4.
- Zero-only helpers: Task 4.
- OR within field and AND across fields: Task 2.
- Dim instead of hide: Task 2 through `applyInteractiveFilters`.
- More row with results/focus: Task 5.
- Target node dynamic size by count/weight: Task 1.
- Version/build/sync/review: Task 7.

The plan has no placeholder steps. Type names are introduced before they are used. All tests have exact commands and expected outcomes.
