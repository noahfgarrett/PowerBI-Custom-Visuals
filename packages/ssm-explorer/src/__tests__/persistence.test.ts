import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SsmExplorerVisual } from '../visual';
import { createHarnessHost } from '../../dev/host';
import { showroomRows, tableFixture } from './fixtures';

let element: HTMLDivElement, visual: SsmExplorerVisual, host: ReturnType<typeof createHarnessHost>;
let frames: Map<number, FrameRequestCallback>, frame = 0;
function flush() { for (let i = 0; i < 10 && frames.size; i++) { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(performance.now())); } }
function mount() {
    element = document.createElement('div'); document.body.append(element); host = createHarnessHost();
    visual = new SsmExplorerVisual({ element, host: host.host } as never);
    // These cases exercise a deliberately chosen all-project scope.
    element.querySelector<HTMLButtonElement>('[data-action="projects-all"]')!.click();
    const viewport = element.querySelector<HTMLElement>('[data-viewport]')!;
    Object.defineProperty(viewport, 'clientWidth', { get: () => element.querySelector<HTMLElement>('[data-drawer]')!.hidden ? 1280 : 960 });
    Object.defineProperty(viewport, 'clientHeight', { value: 550 });
}
function update(data = tableFixture(showroomRows()), operationKind = 0, type = 2) { visual.update({ dataViews: [data], viewport: { width: 1280, height: 720 }, operationKind, type } as never); flush(); }
function button(action: string) { const result = element.querySelector<HTMLButtonElement>(`[data-action="${action}"]`); expect(result, action).toBeTruthy(); return result!; }
function click(action: string) { button(action).click(); flush(); }
function node(id: string) { const result = [...element.querySelectorAll<HTMLButtonElement>('.ssm-node')].find(node => JSON.parse(node.dataset.node!)[2] === id); expect(result, id).toBeTruthy(); return result!; }
function choose(id: string) { node(id).click(); flush(); }
function children(id: string) { const occurrence = node(id).dataset.occurrence; const action = [...element.querySelectorAll<HTMLButtonElement>('[data-action="equipment-children"]')].find(button => button.dataset.source === occurrence); expect(action).toBeTruthy(); action!.click(); flush(); }
function raw() { const calls = host.calls.persisted as any[]; expect(calls.length).toBeGreaterThan(0); return calls[calls.length - 1].merge[0].properties.snapshot as string; }
function recreate(data: ReturnType<typeof tableFixture>) { visual.destroy(); element.remove(); mount(); update(data); }
function camera() { return element.querySelector<HTMLElement>('[data-world]')!.style.transform; }

beforeEach(() => {
    frames = new Map();
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => { const id = ++frame; frames.set(id, callback); return id; });
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); }); mount();
});
afterEach(() => { visual.destroy(); element.remove(); vi.restoreAllMocks(); });

describe('SSM view persistence and navigation', () => {
    it('restores the complete view after the host destroys and recreates the visual', () => {
        update(); choose('Building ready'); choose('Airside ready'); click('fit'); children('AHU-101'); click('fit'); children('FAN-101'); click('fit'); choose('FAN-101');
        const source = node('FAN-101').dataset.occurrence;
        [...element.querySelectorAll<HTMLButtonElement>('[data-action="quick-dependencies"]')].find(button => button.dataset.source === source)!.click(); flush(); click('fit');
        click('theme'); click('tab-connections'); click('highlight');
        const value = [...element.querySelectorAll<HTMLInputElement>('[data-highlight-value]')].find(input => input.parentElement!.textContent === 'Electrical')!;
        value.checked = true; value.dispatchEvent(new Event('change', { bubbles: true })); flush(); click('highlight-close');
        const layer = element.querySelector<HTMLInputElement>('[data-layer="all"]')!; layer.checked = true; layer.dispatchEvent(new Event('change', { bubbles: true })); flush();
        click('zoom-in');
        const saved = raw(), beforeCamera = camera(), before = JSON.parse(saved);
        recreate(tableFixture(showroomRows(), { viewState: { snapshot: saved } }));
        expect(camera()).toBe(beforeCamera);
        expect(element.querySelector('.ssm-node.is-selected')?.getAttribute('data-node')).toBe(before.selectedKey);
        expect(element.querySelector<HTMLElement>('[data-drawer]')!.hidden).toBe(false);
        expect(button('tab-connections').getAttribute('aria-selected')).toBe('true');
        expect(element.querySelector<HTMLInputElement>('[data-layer="all"]')!.checked).toBe(true);
        expect(element.querySelector('.ssm-root')!.getAttribute('data-theme')).toBe(before.viewerTheme);
        expect(element.querySelectorAll('.is-highlight-match').length).toBeGreaterThan(0);
        expect(element.querySelectorAll('[data-dependency-panel]').length).toBe(1);
        expect(node('MOTOR-101')).toBeTruthy();
        expect(host.calls.persisted).toHaveLength(0);
        expect(host.calls.selections).toHaveLength(0);
    });

    it('keeps the camera fixed on milestone, equipment and dependency expansion', () => {
        update(); const first = camera(); choose('Building ready'); expect(camera()).toBe(first);
        choose('Airside ready'); expect(camera()).toBe(first);
        click('fit'); const equipmentCamera = camera(); children('AHU-101'); expect(camera()).toBe(equipmentCamera);
        click('fit'); const fanCamera = camera(); children('FAN-101'); expect(camera()).toBe(fanCamera);
        click('fit'); const dependencyCamera = camera();
        const source = node('FAN-101').dataset.occurrence;
        [...element.querySelectorAll<HTMLButtonElement>('[data-action="quick-dependencies"]')].find(button => button.dataset.source === source)!.click(); flush();
        expect(camera()).toBe(dependencyCamera);
    });

    it.each(['empty canvas', 'Escape', 'panel close'])('clears selection via %s while preserving the camera', action => {
        update(); choose('Building ready'); const before = camera();
        if (action === 'panel close') click('close');
        else if (action === 'Escape') element.querySelector('.ssm-root')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        else element.querySelector<HTMLElement>('[data-viewport]')!.click();
        flush();
        expect(element.querySelector('.ssm-node.is-selected')).toBeNull();
        expect(element.querySelector('.ssm-node.is-dimmed')).toBeNull();
        expect(element.querySelector<HTMLElement>('[data-drawer]')!.hidden).toBe(true);
        expect(camera()).toBe(before);
        expect(JSON.parse(raw()).selectedKey).toBeNull();
    });

    it('does not drop accumulated segments or write again when the host echoes a save', () => {
        const rows = showroomRows(); const initial = tableFixture(rows.slice(0, 3), undefined, true);
        update(initial); click('theme'); const saved = raw();
        update(tableFixture(rows.slice(3)), 2);
        const count = element.querySelector('[data-counts]')!.textContent, writes = host.calls.persisted.length;
        update(tableFixture(rows.slice(0, 3), { viewState: { snapshot: saved } }, true));
        expect(element.querySelector('[data-counts]')!.textContent).toBe(count);
        expect(host.calls.persisted).toHaveLength(writes);
        expect(host.calls.renderFailures).toHaveLength(0);
    });

    it('processes real Create changes even when the host reuses mutated rows with a saved snapshot', () => {
        const data = tableFixture(showroomRows()); update(data); click('theme'); const saved = raw();
        data.metadata.objects = { viewState: { snapshot: saved } }; update(data);
        const labelColumn = data.table!.columns.findIndex(column => column.roles?.equipmentLabel);
        data.table!.rows![0][labelColumn] = 'Updated assembly';
        update(data);
        choose('Building ready'); choose('Airside ready'); click('fit');
        expect(node('AHU-101').textContent).toContain('Updated assembly');
    });

    it('retains deferred state across Resume while saved equipment arrives in later segments', () => {
        update(); choose('Building ready'); choose('Airside ready'); click('fit'); children('AHU-101'); click('fit'); choose('FAN-101');
        const saved = JSON.parse(raw()); saved.loadingPaused = true;
        recreate(tableFixture(showroomRows().slice(0, 1), { viewState: { snapshot: JSON.stringify(saved) } }, true));
        click('resume-loading');
        update(tableFixture(showroomRows().slice(1), { viewState: { snapshot: raw() } }), 2);
        expect(element.querySelector('.ssm-node.is-selected')?.getAttribute('data-node')).toBe(saved.selectedKey);
        expect(element.querySelector('[data-drawer]')!.textContent).toContain('Supply fan');
    });

    it('preserves deferred late-node state while Tab and Enter focus and activate Resume', () => {
        update(); choose('Building ready'); choose('Airside ready'); click('fit'); children('AHU-101'); click('fit'); choose('FAN-101');
        const saved = JSON.parse(raw()); saved.loadingPaused = true;
        recreate(tableFixture(showroomRows().slice(0, 1), { viewState: { snapshot: JSON.stringify(saved) } }, true));
        const resume = button('resume-loading'); resume.focus();
        resume.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })); flush();
        resume.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); flush();
        // jsdom does not perform a button's native keyboard click activation.
        // The ignored keydowns must not persist or discard pending restoration.
        expect(host.calls.persisted).toHaveLength(0);
        resume.click(); flush();
        const resumed = JSON.parse(raw());
        expect(resumed.selectedKey).toBe(saved.selectedKey);
        expect(resumed.expandedEquipment).toEqual(saved.expandedEquipment);
        expect(resumed.loadingPaused).toBe(false);
        update(tableFixture(showroomRows().slice(1), { viewState: { snapshot: raw() } }), 2);
        expect(element.querySelector('.ssm-node.is-selected')?.getAttribute('data-node')).toBe(saved.selectedKey);
        expect(element.querySelector('[data-drawer]')!.textContent).toContain('Supply fan');
    });

    it('honors host bookmark replacement and clearing without carrying state to another bound schema', () => {
        update(); choose('Building ready'); const expanded = raw();
        choose('Building ready'); const collapsed = raw();
        update(tableFixture(showroomRows(), { viewState: { snapshot: expanded } })); // acknowledged older own write, no rollback
        expect(element.querySelectorAll('.ssm-node.l2')).toHaveLength(0);
        update(tableFixture(showroomRows(), { viewState: { snapshot: collapsed } }));
        update(tableFixture(showroomRows(), { viewState: { snapshot: expanded } }));
        expect(element.querySelectorAll('.ssm-node.l2').length).toBeGreaterThan(0);
        update(tableFixture(showroomRows(), {}));
        expect(element.querySelectorAll('.ssm-node.l2')).toHaveLength(0);
        const changed = tableFixture(showroomRows(), { viewState: { snapshot: expanded } });
        changed.table!.columns[0].queryName = 'AnotherRegistry.project';
        update(changed);
        expect(element.querySelectorAll('.ssm-node.l2')).toHaveLength(0);
    });
});
