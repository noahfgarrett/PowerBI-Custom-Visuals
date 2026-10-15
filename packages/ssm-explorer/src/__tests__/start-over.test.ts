import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type powerbi from 'powerbi-visuals-api';
import { SsmExplorerVisual } from '../visual';
import { nodeKey } from '../model';
import { createHarnessHost } from '../../dev/host';
import { showroomRows, tableFixture, type SyntheticRow } from './fixtures';

let element: HTMLDivElement, visual: SsmExplorerVisual, host: ReturnType<typeof createHarnessHost>;
let frames: Map<number, FrameRequestCallback>, frame = 0;
function flush(): void {
  for (let count = 0; count < 10 && frames.size; count++) {
    const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(performance.now()));
  }
}
function mount(seedAll = true): void {
  element = document.createElement('div'); document.body.append(element); host = createHarnessHost();
  visual = new SsmExplorerVisual({ element, host: host.host } as never);
  const viewport = element.querySelector<HTMLElement>('[data-viewport]')!;
  Object.defineProperty(viewport, 'clientWidth', { get: () => element.querySelector<HTMLElement>('[data-drawer]')!.hidden ? 1280 : 960 });
  Object.defineProperty(viewport, 'clientHeight', { value: 550 });
  if (seedAll) { click('projects-all'); expect(button('projects').textContent).toContain('All projects'); }
}
function update(data: powerbi.DataView, operationKind = 0): void {
  visual.update({ dataViews: [data], viewport: { width: 1280, height: 720 }, operationKind, type: 2 } as never); flush();
}
function button(action: string): HTMLButtonElement {
  const result = element.querySelector<HTMLButtonElement>(`[data-action="${action}"]`); expect(result, action).toBeTruthy(); return result!;
}
function click(action: string): void { button(action).click(); flush(); }
function node(id: string): HTMLButtonElement {
  const result = [...element.querySelectorAll<HTMLButtonElement>('.ssm-node')].find(item => JSON.parse(item.dataset.node!)[2] === id);
  expect(result, id).toBeTruthy(); return result!;
}
function choose(id: string): void { node(id).click(); flush(); }
function children(id: string): void {
  const occurrence = node(id).dataset.occurrence;
  const action = [...element.querySelectorAll<HTMLButtonElement>('[data-action="equipment-children"]')].find(item => item.dataset.source === occurrence);
  expect(action).toBeTruthy(); action!.click(); flush();
}
function changeFilter(role: string, value: string): void {
  const select = element.querySelector<HTMLSelectElement>(`[data-filter="${role}"]`)!;
  select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); flush();
}
function snapshot(): string {
  const calls = host.calls.persisted as { merge: { properties: { snapshot: string } }[] }[];
  expect(calls.length).toBeGreaterThan(0); return calls[calls.length - 1].merge[0].properties.snapshot;
}
function recreate(data: powerbi.DataView): void { visual.destroy(); element.remove(); mount(); update(data); }
function onlyParents(): void {
  expect(element.querySelectorAll('.ssm-node.l1').length).toBeGreaterThan(0);
  expect(element.querySelectorAll('.ssm-node:not(.l1)')).toHaveLength(0);
  expect(element.querySelector('.ssm-node.is-selected')).toBeNull();
  expect(element.querySelector<HTMLElement>('[data-drawer]')!.hidden).toBe(true);
  expect(element.querySelectorAll('[data-dependency-panel]')).toHaveLength(0);
}
function noProjectChosen(): void {
  expect(element.querySelectorAll('.ssm-node')).toHaveLength(0);
  expect(element.querySelector('[data-empty]')!.textContent).toContain('Choose a project');
  expect(element.querySelector<HTMLElement>('[data-drawer]')!.hidden).toBe(true);
  expect(element.querySelectorAll('[data-dependency-panel]')).toHaveLength(0);
}
function chooseProject(project: string): void {
  click('projects');
  const checkbox = element.querySelector<HTMLInputElement>(`[data-project="${project}"]`)!;
  checkbox.checked = true; checkbox.dispatchEvent(new Event('change', { bubbles: true })); flush();
}
function twoProjects(): SyntheticRow[] {
  return [...showroomRows(), { project: 'West Plant', equipmentId: 'WEST-ROOT', equipmentLabel: 'West assembly', discipline: 'Civil', parentMilestone: 'West ready', milestone: 'West systems ready' }];
}

beforeEach(() => {
  frames = new Map();
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => { const id = ++frame; frames.set(id, callback); return id; });
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); }); mount();
});
afterEach(() => { visual.destroy(); element.remove(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Start over exploration reset', () => {
  it('honors an explicit All choice before the first binding arrives without reusing an empty cached projection', () => {
    expect(button('projects').textContent).toContain('All projects');
    update(tableFixture(twoProjects())); onlyParents();
    expect(element.querySelectorAll('.ssm-node.l1')).toHaveLength(2);
    expect(host.calls.renderFailures).toHaveLength(0);
  });
  it('starts without projects and queues no automatic fetch until a project is chosen', async () => {
    visual.destroy(); element.remove(); vi.useFakeTimers(); mount(false);
    update(tableFixture(twoProjects(), undefined, true)); noProjectChosen();
    await vi.advanceTimersByTimeAsync(200); flush();
    expect(host.calls.fetches).toBe(0);
    chooseProject('East Plant'); onlyParents();
    await vi.advanceTimersByTimeAsync(100); flush();
    expect(host.calls.fetches).toBeGreaterThan(0);
    expect([...element.querySelectorAll<HTMLButtonElement>('.ssm-node.l1')].every(item => JSON.parse(item.dataset.node!)[1] === 'East Plant')).toBe(true);
  });
  it('cancels queued delivery on Start over and accepts an in-flight batch without requesting another', async () => {
    visual.destroy(); element.remove(); vi.useFakeTimers(); mount(false);
    const fetch = vi.spyOn(host.host, 'fetchMoreData').mockReturnValue(true);
    update(tableFixture(twoProjects(), undefined, true));
    chooseProject('East Plant'); click('reset');
    await vi.advanceTimersByTimeAsync(100); flush(); expect(fetch).not.toHaveBeenCalled();
    chooseProject('East Plant'); await vi.advanceTimersByTimeAsync(50); flush();
    expect(fetch).toHaveBeenCalledTimes(1); click('reset');
    update(tableFixture([{ project: 'Late project', parentMilestone: 'Late parent', milestone: 'Late milestone', equipmentId: 'LATE-1' }], undefined, true), 2);
    await vi.advanceTimersByTimeAsync(200); flush();
    expect(fetch).toHaveBeenCalledTimes(1); noProjectChosen();
    expect(element.querySelector('.ssm-loading-count')?.textContent).toContain('rows');
  });
  it('starts delivery when a search result explicitly opens a project from the empty scope', async () => {
    visual.destroy(); element.remove(); vi.useFakeTimers(); mount(false);
    update(tableFixture(twoProjects(), undefined, true));
    const search = element.querySelector<HTMLInputElement>('[data-search]')!;
    search.value = 'AHU-101'; search.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(125); flush();
    expect(host.calls.fetches).toBe(0);
    const result = element.querySelector<HTMLButtonElement>('[data-action="search-result"]')!;
    expect(result).toBeTruthy(); result.click(); flush();
    await vi.advanceTimersByTimeAsync(50); flush();
    expect(host.calls.fetches).toBeGreaterThan(0);
    expect(JSON.parse(snapshot()).filters.projects).toHaveLength(1);
  });
  it('clears navigation, scope, lanes, search and highlights while preserving source, author settings, viewer theme, paused loading and native selection', async () => {
    const author: powerbi.DataViewObjects = { appearance: { theme: 'light', fontSize: 16 }, navigation: { initialExpanded: false }, drawer: { showDiscipline: false } };
    const data = tableFixture(twoProjects(), author, true), sourceBefore = JSON.stringify(data);
    update(data); click('pause-loading'); click('theme');
    changeFilter('l1', nodeKey('l1', 'East Plant', 'Building ready'));
    changeFilter('l2', nodeKey('l2', 'East Plant', 'Airside ready'));
    changeFilter('discipline', 'Mechanical');
    click('projects');
    const west = element.querySelector<HTMLInputElement>('[data-project="West Plant"]')!;
    west.checked = false; west.dispatchEvent(new Event('change', { bubbles: true })); flush();
    click('fit'); children('AHU-101'); click('fit'); choose('FAN-101');
    click('select-report'); await Promise.resolve(); flush();
    const nativeKeys = host.selectionManager.getSelectionIds().map(item => item.getKey());
    expect(nativeKeys.length).toBeGreaterThan(0);
    const clearReport = vi.spyOn(host.selectionManager, 'clear');
    const occurrence = node('FAN-101').dataset.occurrence;
    [...element.querySelectorAll<HTMLButtonElement>('[data-action="quick-dependencies"]')].find(item => item.dataset.source === occurrence)!.click(); flush(); click('fit');
    click('highlight');
    const value = [...element.querySelectorAll<HTMLInputElement>('[data-highlight-value]')].find(item => item.parentElement!.textContent === 'Electrical')!;
    value.checked = true; value.dispatchEvent(new Event('change', { bubbles: true })); flush();
    const all = element.querySelector<HTMLInputElement>('[data-layer="all"]')!;
    all.checked = true; all.dispatchEvent(new Event('change', { bubbles: true })); flush();
    const search = element.querySelector<HTMLInputElement>('[data-search]')!;
    search.value = 'fan'; search.dispatchEvent(new Event('input', { bubbles: true }));
    click('filters'); click('help'); click('projects');
    expect(button('reset').textContent).toBe('Start over'); click('reset');
    noProjectChosen();
    const reset = JSON.parse(snapshot());
    expect(reset).toMatchObject({ startCollapsed: true, filters: { projects: [], discipline: null, l1Key: null, l2Key: null, includeContext: true, showParents: true, showDependencies: true }, selectedKey: null, selectedOccurrenceId: null, drawerOpen: false, drawerTab: 'overview', connectionOffset: 0, allConnections: false, quickStates: [], trail: null, highlightedValues: [], search: '', loadingPaused: true, viewerTheme: 'dark' });
    for (const field of ['collapsed', 'expandedParents', 'collapsedParents', 'expandedEquipment', 'collapsedEquipment', 'forcedKeys', 'parentOffsets', 'branchLimits', 'branchOffsets', 'siblingOffsets', 'treeFocus']) expect(reset[field], field).toEqual([]);
    expect(element.querySelectorAll('.is-highlight-match')).toHaveLength(0);
    expect(element.querySelector<HTMLInputElement>('[data-search]')!.value).toBe('');
    expect(element.querySelector<HTMLElement>('[data-project-popup]')!.hidden).toBe(true);
    expect(element.querySelector<HTMLElement>('[data-highlight-popup]')!.hidden).toBe(true);
    expect(element.querySelector<HTMLElement>('[data-search-results]')!.hidden).toBe(true);
    expect(element.querySelector<HTMLElement>('[data-help]')!.hidden).toBe(true);
    expect(button('filters').getAttribute('aria-expanded')).toBe('false');
    expect(host.selectionManager.getSelectionIds().map(item => item.getKey())).toEqual(nativeKeys);
    expect(clearReport).not.toHaveBeenCalled();
    expect(JSON.stringify(data)).toBe(sourceBefore);
    expect(element.querySelector<HTMLElement>('.ssm-root')!.style.fontSize).toBe('16px');
    expect(element.querySelector('.ssm-root')!.getAttribute('data-theme')).toBe('dark');
    const camera = element.querySelector<HTMLElement>('[data-world]')!.style.transform;
    click('fit'); expect(element.querySelector<HTMLElement>('[data-world]')!.style.transform).toBe(camera);
    chooseProject('East Plant'); onlyParents();
    expect(button('resume-loading')).toBeTruthy();
    expect(clearReport).not.toHaveBeenCalled();
    expect(host.selectionManager.getSelectionIds().map(item => item.getKey())).toEqual(nativeKeys);
  });

  it('persists L1-only over author-expanded defaults, including appended parents, and opens only the chosen branches', () => {
    const author: powerbi.DataViewObjects = { navigation: { initialExpanded: true } };
    update(tableFixture(twoProjects(), author, true)); click('pause-loading');
    expect(element.querySelectorAll('.ssm-node.l2').length).toBeGreaterThan(0);
    click('reset'); noProjectChosen();
    const saved = snapshot(); expect(JSON.parse(saved).startCollapsed).toBe(true);
    recreate(tableFixture(twoProjects(), { ...author, viewState: { snapshot: saved } }, true)); noProjectChosen();
    expect(host.calls.persisted).toHaveLength(0);
    chooseProject('East Plant'); onlyParents();
    click('projects-all'); onlyParents();
    const added: SyntheticRow = { project: 'North Plant', equipmentId: 'NORTH-ROOT', parentMilestone: 'North ready', milestone: 'North systems ready' };
    update(tableFixture([added], { ...author, viewState: { snapshot: saved } }, false, twoProjects().length), 2);
    onlyParents(); expect(node('North ready').getAttribute('aria-expanded')).toBe('false');
    choose('Building ready'); click('fit');
    expect(node('West ready').getAttribute('aria-expanded')).toBe('false'); expect(node('North ready').getAttribute('aria-expanded')).toBe('false');
    expect(element.querySelectorAll('.ssm-node.equipment')).toHaveLength(0);
    choose('Airside ready'); click('fit'); expect(node('AHU-101')).toBeTruthy();
    expect([...element.querySelectorAll<HTMLButtonElement>('.ssm-node')].some(item => JSON.parse(item.dataset.node!)[2] === 'FAN-101')).toBe(false);
    children('AHU-101'); click('fit'); expect(node('FAN-101')).toBeTruthy();
    expect([...element.querySelectorAll<HTMLButtonElement>('.ssm-node')].some(item => JSON.parse(item.dataset.node!)[2] === 'MOTOR-101')).toBe(false);
    expect(node('Power ready').getAttribute('aria-expanded')).toBe('false');
  });

  it('cancels deferred restoration so late segments never resurrect the previous selected node or lanes', () => {
    update(tableFixture(showroomRows())); choose('Building ready'); choose('Airside ready'); click('fit'); children('AHU-101'); click('fit'); choose('FAN-101');
    const before = JSON.parse(snapshot()); before.loadingPaused = true;
    recreate(tableFixture(showroomRows().slice(0, 1), { viewState: { snapshot: JSON.stringify(before) } }, true));
    click('reset'); noProjectChosen();
    const reset = snapshot();
    expect(JSON.parse(reset).selectedKey).toBeNull(); expect(JSON.parse(reset).startCollapsed).toBe(true);
    update(tableFixture(showroomRows().slice(1), { viewState: { snapshot: reset } }, false, 1), 2);
    noProjectChosen(); expect(element.querySelectorAll('.ssm-node.is-selected')).toHaveLength(0);
    recreate(tableFixture(showroomRows(), { viewState: { snapshot: reset } })); noProjectChosen();
  });
});
