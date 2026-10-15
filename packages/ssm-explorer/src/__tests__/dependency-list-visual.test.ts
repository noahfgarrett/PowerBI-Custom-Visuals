import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SsmExplorerVisual } from '../visual';
import { createHarnessHost } from '../../dev/host';
import { tableFixture, type SyntheticRow } from './fixtures';

let element: HTMLDivElement, visual: SsmExplorerVisual, host: ReturnType<typeof createHarnessHost>;
let frames: Map<number, FrameRequestCallback>, frame = 0;
function flush(): void { for (let i = 0; i < 12 && frames.size; i++) { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(performance.now())); } }
function mount(): void {
  element = document.createElement('div'); document.body.append(element); host = createHarnessHost();
  visual = new SsmExplorerVisual({ element, host: host.host } as never);
  Object.defineProperty(element.querySelector('[data-viewport]'), 'clientWidth', { value: 1280 });
  Object.defineProperty(element.querySelector('[data-viewport]'), 'clientHeight', { value: 600 });
  click('projects-all');
}
function update(rows: SyntheticRow[], partial = false, objects?: Parameters<typeof tableFixture>[1], operationKind = 0): void {
  visual.update({ dataViews: [tableFixture(rows, objects, partial)], viewport: { width: 1280, height: 720 }, operationKind, type: 2 } as never); flush();
}
function button(action: string): HTMLButtonElement { const result = element.querySelector<HTMLButtonElement>(`[data-action="${action}"]`); expect(result, action).toBeTruthy(); return result!; }
function click(action: string): void { button(action).click(); flush(); }
function choose(id: string): void {
  const result = [...element.querySelectorAll<HTMLButtonElement>('.ssm-node')].find(item => JSON.parse(item.dataset.node!)[2] === id);
  expect(result, id).toBeTruthy(); result!.click(); flush();
}
function dependencies(): void { click('tab-dependencies'); }
function articles(): HTMLElement[] { return [...element.querySelectorAll<HTMLElement>('[data-dependency-key]')]; }
function targetIds(): string[] { return articles().map(item => JSON.parse(item.dataset.dependencyKey!)[2]); }
function filter(value: string | null): void {
  const input = element.querySelector<HTMLSelectElement>('[data-dependency-discipline]')!;
  input.value = value === null ? '' : JSON.stringify(value); input.dispatchEvent(new Event('change', { bubbles: true })); flush();
}
function snapshot(): string { return (host.calls.persisted[host.calls.persisted.length - 1] as any).merge[0].properties.snapshot; }
const base = { project: 'Plant', nodeType: 'equipment', discipline: 'Mechanical', parentMilestone: 'Assembly', milestone: 'Airside' };
const supply = { project: 'Plant', nodeType: 'equipment', parentMilestone: 'Supply', milestone: 'Supply ready' };
function scopedRows(): SyntheticRow[] {
  const rows: SyntheticRow[] = [
    { ...base, equipmentId: 'ROOT', owner: 'Root owner', dependencies: JSON.stringify(['SHARED', 'BLANK', 'CONFLICT']) },
    { ...base, equipmentId: 'REGISTER', nodeType: 'header', milestone: 'Other assembly', closestParent: 'ROOT', dependencies: 'SHARED' },
  ];
  for (let index = 1; index <= 12; index++) rows.push({ ...base, equipmentId: `CHILD-${index}`, milestone: 'Other assembly', closestParent: index === 1 ? 'REGISTER' : `CHILD-${index - 1}`, owner: `Child owner ${index}`, ...(index === 12 ? { dependencies: 'DEEP' } : {}) });
  rows.push(
    { ...supply, equipmentId: 'SHARED', discipline: 'Electrical' },
    { ...supply, equipmentId: 'BLANK' },
    { ...supply, equipmentId: 'CONFLICT', discipline: 'Electrical' },
    { ...supply, equipmentId: 'CONFLICT', discipline: 'Controls' },
    { ...supply, equipmentId: 'DEEP', discipline: 'Mechanical', dependencies: 'UNRELATED' },
    { ...supply, equipmentId: 'UNRELATED', discipline: 'Electrical' },
  );
  return rows;
}
function pagedRows(targets = 65, sources = 23): SyntheticRow[] {
  const ids = Array.from({ length: targets }, (_, index) => `TARGET-${String(index + 1).padStart(3, '0')}`);
  return [
    ...Array.from({ length: sources }, (_, index): SyntheticRow => ({ ...base, equipmentId: `SOURCE-${String(index + 1).padStart(3, '0')}`, owner: `Owner ${index + 1}`, dependencies: index ? ids[0] : JSON.stringify(ids) })),
    ...ids.map((equipmentId): SyntheticRow => ({ ...supply, equipmentId, discipline: 'Electrical' })),
  ];
}
beforeEach(() => {
  frames = new Map();
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => { const id = ++frame; frames.set(id, callback); return id; });
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); }); mount();
});
afterEach(() => { visual.destroy(); element.remove(); vi.restoreAllMocks(); });

describe('Dependencies drawer in the actual visual', () => {
  it('queries collapsed L1/L2 scopes and twelve structural levels without recursively adding prerequisite dependencies', () => {
    update(scopedRows());
    expect(element.querySelectorAll('.ssm-node.equipment')).toHaveLength(0);
    choose('Assembly'); dependencies();
    expect(targetIds().sort()).toEqual(['BLANK', 'CONFLICT', 'DEEP', 'SHARED']);
    expect(element.querySelectorAll('.ssm-node.equipment')).toHaveLength(0);
    choose('Airside'); // Collapses/expands only the canvas; cohort query remains complete.
    choose('Airside'); dependencies();
    expect(targetIds().sort()).toEqual(['BLANK', 'CONFLICT', 'DEEP', 'SHARED']);
    expect(targetIds()).not.toContain('UNRELATED');
  });

  it('includes header descendants and lets a deep Required by source open its real metadata in Overview', () => {
    update(scopedRows()); choose('Assembly'); dependencies();
    const deep = articles().find(item => item.querySelector('.ssm-dependency-title')!.textContent === 'DEEP')!;
    deep.querySelector<HTMLButtonElement>('[data-action="dependency-sources"]')!.click(); flush();
    const source = element.querySelector<HTMLButtonElement>('.ssm-dependency-sources [data-action="dependency-open"]')!;
    expect(source.textContent).toBe('CHILD-12'); source.click(); flush();
    expect(button('tab-overview').getAttribute('aria-selected')).toBe('true');
    expect(element.querySelector('[data-drawer-content]')!.textContent).toContain('Child owner 12');
    expect(element.querySelector('.ssm-node.is-selected')!.getAttribute('aria-label')).toContain('CHILD-12');
    dependencies(); expect(targetIds()).toEqual(['DEEP']);
  });

  it('keeps its discipline filter independent of canvas and matches every original conflicting value plus blank', () => {
    update(scopedRows()); choose('Assembly'); dependencies();
    const canvasFilter = element.querySelector<HTMLSelectElement>('[data-filter="discipline"]')!;
    canvasFilter.value = 'Mechanical'; canvasFilter.dispatchEvent(new Event('change', { bubbles: true })); flush();
    expect(targetIds()).toContain('SHARED');
    filter('Electrical'); expect(targetIds()).toEqual(['CONFLICT', 'SHARED']);
    expect(element.querySelector<HTMLSelectElement>('[data-filter="discipline"]')!.value).toBe('Mechanical');
    filter('Controls'); expect(targetIds()).toEqual(['CONFLICT']);
    filter(''); expect(targetIds()).toEqual(['BLANK']);
    expect(element.querySelector<HTMLSelectElement>('[data-dependency-discipline]')!.selectedOptions[0].textContent).toBe('Unspecified');
    filter(null); expect(targetIds()).toHaveLength(4);
  });

  it('bounds distinct targets to 30 and Required by sources to ten, without duplicate source rows', () => {
    const rows = pagedRows(); update([...rows, { ...rows[0] }]); choose('Assembly'); dependencies();
    expect(articles()).toHaveLength(30); expect(targetIds()[0]).toBe('TARGET-001');
    expect(element.querySelector('.ssm-dependency-summary')!.textContent).toContain('65 dependencies');
    click('dependency-sources');
    expect(element.querySelectorAll('.ssm-dependency-sources [data-action="dependency-open"]')).toHaveLength(10);
    expect(element.querySelector('.ssm-dependency-source-toggle')!.textContent).toContain('23 items');
    click('dependency-sources-next');
    expect(element.querySelector('.ssm-dependency-sources')!.textContent).toContain('SOURCE-011');
    click('dependency-sources-next');
    expect(element.querySelectorAll('.ssm-dependency-sources [data-action="dependency-open"]')).toHaveLength(3);
    expect(button('dependency-sources-next').disabled).toBe(true);
    click('dependency-list-next'); expect(articles()).toHaveLength(30); expect(targetIds()[0]).toBe('TARGET-031');
    expect(element.querySelector('.ssm-dependency-sources')).toBeNull();
    click('dependency-list-next'); expect(articles()).toHaveLength(5); expect(targetIds()[0]).toBe('TARGET-061');
    expect(button('dependency-list-next').disabled).toBe(true);
    click('dependency-list-prev'); expect(targetIds()[0]).toBe('TARGET-031');
  });

  it('opens a dependency target in Overview with its actual supplied metadata', () => {
    const rows = scopedRows(); rows.find(row => row.equipmentId === 'SHARED')!.owner = 'Electrical supply owner';
    update(rows); choose('Assembly'); dependencies();
    articles().find(item => item.querySelector('.ssm-dependency-title')!.textContent === 'SHARED')!.querySelector<HTMLButtonElement>('[data-action="dependency-open"]')!.click(); flush();
    expect(button('tab-overview').getAttribute('aria-selected')).toBe('true');
    expect(element.querySelector('[data-drawer-content]')!.textContent).toContain('Electrical supply owner');
    expect(element.querySelector('.ssm-node.is-selected')!.getAttribute('aria-label')).toContain('SHARED');
    expect(host.calls.selections).toHaveLength(0); // Local navigation does not issue report selection.
  });

  it('scopes selected equipment and headers to themselves and structural descendants', () => {
    update(scopedRows()); choose('Assembly'); choose('Airside'); choose('ROOT'); dependencies();
    expect(targetIds().sort()).toEqual(['BLANK', 'CONFLICT', 'DEEP', 'SHARED']);
    const shared = articles().find(item => item.querySelector('.ssm-dependency-title')!.textContent === 'SHARED')!;
    shared.querySelector<HTMLButtonElement>('[data-action="dependency-sources"]')!.click(); flush();
    const register = [...element.querySelectorAll<HTMLButtonElement>('.ssm-dependency-sources [data-action="dependency-open"]')].find(item => item.textContent === 'REGISTER')!;
    register.click(); flush(); dependencies();
    expect(targetIds()).toEqual(['DEEP', 'SHARED']);
    expect(element.querySelector('.ssm-node.is-selected')!.getAttribute('aria-label')).toContain('REGISTER');
  });

  it('restores tab, filter and target page while keeping source disclosures ephemeral; Start over resets all three', () => {
    const rows = pagedRows(); update(rows); choose('Assembly'); dependencies(); filter('Electrical'); click('dependency-list-next'); click('dependency-sources');
    const saved = snapshot(); const parsed = JSON.parse(saved);
    expect(parsed).toMatchObject({ drawerTab: 'dependencies', dependencyDiscipline: 'Electrical', dependencyOffset: 30 });
    visual.destroy(); element.remove(); mount(); update(rows, false, { viewState: { snapshot: saved } });
    expect(button('tab-dependencies').getAttribute('aria-selected')).toBe('true');
    expect(targetIds()[0]).toBe('TARGET-031');
    expect(element.querySelector<HTMLSelectElement>('[data-dependency-discipline]')!.value).toBe(JSON.stringify('Electrical'));
    expect(element.querySelector('.ssm-dependency-sources')).toBeNull();
    click('reset'); expect(element.querySelector<HTMLElement>('[data-drawer]')!.hidden).toBe(true);
    expect(JSON.parse(snapshot())).toMatchObject({ dependencyDiscipline: null, dependencyOffset: 0, drawerTab: 'overview' });
    click('projects-all'); choose('Assembly'); dependencies();
    expect(targetIds()[0]).toBe('TARGET-001'); expect(element.querySelector<HTMLSelectElement>('[data-dependency-discipline]')!.value).toBe('');
  });

  it('refreshes cached dependencies on partial append and marks completeness truthfully', () => {
    const rows = pagedRows(2, 1); update(rows.slice(0, 2), true); choose('Assembly'); dependencies();
    expect(element.querySelector('.ssm-dependency-scope')!.textContent).toContain('More data available');
    // TARGET-002 exists as an unresolved prerequisite before its real record arrives.
    expect(articles().find(item => item.querySelector('.ssm-dependency-title')!.textContent === 'TARGET-002')!.textContent).toContain('Unavailable record');
    update(rows.slice(2), false, undefined, 2);
    expect(targetIds()).toEqual(['TARGET-001', 'TARGET-002']);
    expect(element.querySelector('.ssm-dependency-scope')!.textContent).not.toContain('More data available');
    expect(articles().every(item => !item.textContent!.includes('Unavailable record'))).toBe(true);
    filter('Electrical'); expect(targetIds()).toHaveLength(2);
  });

  it('preserves a restored late page and discipline while early batches cannot yet supply matching target metadata', () => {
    const rows = pagedRows(); update(rows); choose('Assembly'); dependencies(); filter('Electrical'); click('dependency-list-next'); click('dependency-list-next');
    const saved = snapshot();
    visual.destroy(); element.remove(); mount();
    // The source supplies all references, but target disciplines are not delivered yet.
    update(rows.slice(0, 23), true, { viewState: { snapshot: saved } });
    expect(articles()).toHaveLength(0);
    expect(element.querySelector<HTMLSelectElement>('[data-dependency-discipline]')!.value).toBe(JSON.stringify('Electrical'));
    expect(element.querySelector('.ssm-dependencies')!.textContent).toContain('received so far');
    update(rows.slice(23), false, { viewState: { snapshot: saved } }, 2);
    expect(targetIds()).toEqual(['TARGET-061', 'TARGET-062', 'TARGET-063', 'TARGET-064', 'TARGET-065']);
    expect(element.querySelector('.ssm-dependency-scope')!.textContent).not.toContain('More data available');
    expect(button('dependency-list-next').disabled).toBe(true);
  });

  it('clamps a completed replacement to a valid page and never retains removed targets or source disclosures', () => {
    update(pagedRows()); choose('Assembly'); dependencies(); click('dependency-list-next'); click('dependency-list-next'); click('dependency-sources');
    update(pagedRows(3, 1));
    expect(targetIds()).toEqual(['TARGET-001', 'TARGET-002', 'TARGET-003']);
    expect(element.querySelector('[data-action="dependency-list-next"]')).toBeNull();
    expect(element.querySelector('.ssm-dependency-sources')).toBeNull();
    expect(element.querySelector('.ssm-dependency-summary')!.textContent).toBe('3 dependencies');
  });

  it('pages Previous from the displayed partial page rather than the pending saved late-page offset', () => {
    const rows = pagedRows(); update(rows); choose('Assembly'); dependencies(); filter('Electrical');
    click('dependency-list-next'); click('dependency-list-next');
    const saved = snapshot(); expect(JSON.parse(saved).dependencyOffset).toBe(60);
    visual.destroy(); element.remove(); mount();
    // Only35 real Electrical target records have arrived; saved page61 cannot be shown.
    update(rows.slice(0, 23 + 35), true, { viewState: { snapshot: saved } });
    expect(targetIds()).toEqual(['TARGET-031', 'TARGET-032', 'TARGET-033', 'TARGET-034', 'TARGET-035']);
    expect(button('dependency-list-prev').dataset.offset).toBe('30');
    click('dependency-list-prev');
    expect(targetIds()).toHaveLength(30); expect(targetIds()[0]).toBe('TARGET-001');
    expect(button('dependency-list-prev').disabled).toBe(true);
    const changed = snapshot(); expect(JSON.parse(changed).dependencyOffset).toBe(0);
    update(rows.slice(23 + 35), false, { viewState: { snapshot: changed } }, 2);
    expect(targetIds()).toHaveLength(30); expect(targetIds()[0]).toBe('TARGET-001');
    expect(element.querySelector('.ssm-dependency-summary')!.textContent).toBe('65 dependencies of 65');
  });

  it('starts a new equipment cohort on page one with closed sources when its real quick-dependency control is clicked', () => {
    update(pagedRows()); choose('Assembly'); choose('Airside'); dependencies();
    click('dependency-list-next'); click('dependency-sources');
    expect(targetIds()[0]).toBe('TARGET-031');
    expect(element.querySelector('.ssm-dependency-sources')).not.toBeNull();
    const action = [...element.querySelectorAll<HTMLButtonElement>('[data-action="quick-dependencies"]')]
      .find(item => JSON.parse(item.dataset.target!)[2] === 'SOURCE-001');
    expect(action).toBeTruthy(); action!.click(); flush();
    expect(button('tab-dependencies').getAttribute('aria-selected')).toBe('true');
    expect(element.querySelector('.ssm-node.is-selected')!.getAttribute('aria-label')).toContain('SOURCE-001');
    expect(targetIds()[0]).toBe('TARGET-001');
    expect(element.querySelector('.ssm-dependency-sources')).toBeNull();
    expect(JSON.parse(snapshot())).toMatchObject({ dependencyOffset: 0 });
  });
});
