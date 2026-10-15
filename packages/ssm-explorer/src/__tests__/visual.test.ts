import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SsmExplorerVisual } from '../visual';
import { createHarnessHost } from '../../dev/host';
import { standardRows, tableFixture, wideRows, hierarchyRows, structuralRows, showroomRows } from './fixtures';

let element: HTMLDivElement;
let visual: SsmExplorerVisual;
let hostState: ReturnType<typeof createHarnessHost>;
let frameQueue: Map<number, FrameRequestCallback>;
let nextFrame = 0;
let reducedMedia: MediaQueryList;
let reducedPreference = false;

beforeEach(() => {
    reducedPreference = false;
    const mediaTarget = new window.EventTarget();
    Object.defineProperties(mediaTarget, { matches: { get: () => reducedPreference }, media: { value: '(prefers-reduced-motion: reduce)' } });
    reducedMedia = mediaTarget as MediaQueryList;
    const originalMatchMedia = window.matchMedia;
    vi.spyOn(window, 'matchMedia').mockImplementation(query => query.includes('prefers-reduced-motion') ? reducedMedia : originalMatchMedia(query));
    frameQueue = new Map();
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => { const id = ++nextFrame; frameQueue.set(id, callback); return id; });
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(id => { frameQueue.delete(id); });
    element = document.createElement('div');
    document.body.append(element);
    hostState = createHarnessHost();
    visual = new SsmExplorerVisual({ element, host: hostState.host } as never);
    // These cases exercise a deliberately chosen all-project scope.
    element.querySelector<HTMLButtonElement>('[data-action="projects-all"]')!.click();
    // JSDOM has no layout. Give the real culling implementation a host viewport,
    // while retaining queued animation frames rather than the shared synchronous stub.
    const viewport = element.querySelector<HTMLElement>('[data-viewport]')!;
    Object.defineProperty(viewport, 'clientWidth', { get: () => {
        const root = element.querySelector<HTMLElement>('.ssm-root')!;
        const width = parseFloat(root.style.width) || 1280;
        const drawer = element.querySelector<HTMLElement>('.ssm-drawer')!;
        return width - (width >= 700 && !drawer.hidden ? parseFloat(drawer.style.width) || 320 : 0);
    } });
    Object.defineProperty(viewport, 'clientHeight', { get: () => Math.max(100, (parseFloat(element.querySelector<HTMLElement>('.ssm-root')!.style.height) || 720) - 180) });
});
afterEach(() => { visual.destroy(); element.remove(); vi.restoreAllMocks(); });

function flushFrames() {
    for (let step = 0; step < 10 && frameQueue.size; step++) {
        const pending = [...frameQueue.values()]; frameQueue.clear();
        pending.forEach(callback => callback(performance.now()));
    }
}
function updateVisual(options: any) { visual.update(options); flushFrames(); }

function render(rows = standardRows(), width = 1280, height = 720, objects?: any) {
    const expanded = { ...objects, navigation: { initialExpanded: true, ...objects?.navigation } };
    updateVisual({ dataViews: [tableFixture(rows, expanded)], viewport: { width, height }, type: 2, operationKind: 0 } as never);
}
function node(project: string, id: string) {
    const found = Array.from(element.querySelectorAll<SVGElement>('.ssm-node')).find(candidate => {
        const key = candidate.getAttribute('data-node') ?? '';
        return (key.includes(project) || key.includes(encodeURIComponent(project))) && key.includes(id);
    });
    expect(found, `${project} / ${id} must be rendered`).toBeTruthy();
    return found!;
}
function clickNode(project = 'Project Alpha', id = 'EQ-002') {
    node(project, id).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    flushFrames();
}
function action(name: string) {
    const button = element.querySelector<HTMLElement>(`[data-action="${name}"]`);
    expect(button, `action ${name} must exist`).toBeTruthy();
    return button!;
}
function hierarchyNode(kind: 'l1' | 'l2', project: string, id: string) {
    const key = JSON.stringify([kind, project, id]);
    const found = Array.from(element.querySelectorAll<HTMLElement>(`.ssm-node.${kind}`)).find(candidate => candidate.dataset.node === key);
    expect(found, `${kind} ${project} / ${id} must be visible`).toBeTruthy();
    return found!;
}
function clickHierarchy(kind: 'l1' | 'l2', project: string, id: string) { hierarchyNode(kind, project, id).click(); flushFrames(); }
function visibleNodes(kind: string, project?: string) {
    return Array.from(element.querySelectorAll<HTMLElement>(`.ssm-node.${kind}`)).filter(candidate => !project || JSON.parse(candidate.dataset.node!)[1] === project);
}
function exactNode(id: string, project = 'Project Alpha', role?: string) {
    const key = JSON.stringify(['equipment', project, id]);
    const found = Array.from(element.querySelectorAll<HTMLElement>('.ssm-node')).find(candidate => candidate.dataset.node === key && (!role || candidate.dataset.role === role));
    expect(found, `${project}/${id} ${role ?? ''} must be mounted`).toBeTruthy();
    return found!;
}
function fitScene() { action('fit').click(); flushFrames(); }
function quickDependencies(id: string, project = 'Project Alpha') {
    const key = JSON.stringify(['equipment', project, id]);
    const found = Array.from(element.querySelectorAll<HTMLButtonElement>('[data-action="quick-dependencies"]')).find(candidate => candidate.dataset.target === key);
    expect(found, `quick dependencies for ${project}/${id} must exist`).toBeTruthy();
    found!.click(); flushFrames(); fitScene();
}
function childrenAction(id: string, project = 'East Plant', role = 'member') {
    const source = exactNode(id, project, role).dataset.occurrence;
    const found = Array.from(element.querySelectorAll<HTMLButtonElement>('[data-action="equipment-children"]')).find(candidate => candidate.dataset.source === source);
    expect(found, `children action for ${project}/${id} must exist`).toBeTruthy();
    return found!;
}
function toggleChildren(id: string, project = 'East Plant', role = 'member') { childrenAction(id, project, role).click(); flushFrames(); fitScene(); }
function highlightValue(value: string, checked = true) {
    const input = Array.from(element.querySelectorAll<HTMLInputElement>('[data-highlight-value]')).find(candidate => candidate.dataset.highlightValue === JSON.stringify(['string', value]));
    expect(input, `highlight value ${value} must be available`).toBeTruthy();
    input!.checked = checked; input!.dispatchEvent(new Event('change', { bubbles: true })); flushFrames();
}

describe('SSM Explorer actual Visual', () => {
    it('switches viewer themes without moving or remounting the selected hierarchy, dependencies, or highlights', () => {
        render(showroomRows()); fitScene(); quickDependencies('FAN-101', 'East Plant');
        clickNode('East Plant', 'FAN-101');
        action('highlight').click(); highlightValue('Electrical'); action('highlight-close').click();
        action('zoom-in').click(); flushFrames();
        const root = element.querySelector<HTMLElement>('.ssm-root')!;
        const world = element.querySelector<HTMLElement>('[data-world]')!;
        const cards = [...element.querySelectorAll('.ssm-node')];
        const camera = world.style.transform;
        const drawer = element.querySelector('[data-drawer]')!.innerHTML;
        const children = [...element.querySelectorAll('[data-action="equipment-children"]')].map(button => button.getAttribute('aria-expanded'));
        const matches = [...element.querySelectorAll('.is-highlight-match')];
        const toggle = action('theme');
        expect(toggle.getAttribute('aria-label')).toBe('Switch to dark mode');
        toggle.focus(); toggle.click();
        expect(root.dataset.theme).toBe('dark');
        expect(root.style.getPropertyValue('--ssm-bg')).toBe('#1b2026');
        expect(toggle.getAttribute('aria-label')).toBe('Switch to light mode');
        expect(document.activeElement).toBe(toggle);
        expect(world.style.transform).toBe(camera);
        expect([...element.querySelectorAll('.ssm-node')]).toEqual(cards);
        expect(element.querySelector('[data-drawer]')!.innerHTML).toBe(drawer);
        expect([...element.querySelectorAll('[data-action="equipment-children"]')].map(button => button.getAttribute('aria-expanded'))).toEqual(children);
        expect([...element.querySelectorAll('.is-highlight-match')]).toEqual(matches);
        expect(hostState.calls.persisted.length).toBeGreaterThan(0);
        expect(hostState.calls.persisted.every((write: any) => write.merge.every((entry: any) => entry.objectName === 'viewState'))).toBe(true);
        toggle.click();
        expect(root.dataset.theme).toBe('light');
        expect(world.style.transform).toBe(camera);
        expect([...element.querySelectorAll('.ssm-node')]).toEqual(cards);
    });

    it('retains the viewer theme through host updates until the author changes the default', () => {
        render(); action('theme').click();
        const root = element.querySelector<HTMLElement>('.ssm-root')!;
        updateVisual({ viewport: { width: 420, height: 640 }, type: 4 });
        expect(root.dataset.theme).toBe('dark');
        render();
        expect(root.dataset.theme).toBe('dark');
        render(standardRows(), 1280, 720, { appearance: { theme: 'light' } });
        expect(root.dataset.theme).toBe('light');
        action('theme').click();
        render(standardRows(), 1280, 720, { appearance: { theme: 'light', fontSize: 14 } });
        expect(root.dataset.theme).toBe('dark');
    });

    it('keeps high contrast authoritative and explains why the theme action is unavailable', () => {
        render(); action('theme').click();
        const root = element.querySelector<HTMLElement>('.ssm-root')!;
        hostState.host.colorPalette.isHighContrast = true;
        updateVisual({ viewport: { width: 1280, height: 720 }, type: 4 });
        const toggle = action('theme');
        const background = root.style.getPropertyValue('--ssm-bg');
        expect(root.dataset.theme).toBe('high-contrast');
        expect(toggle.getAttribute('aria-disabled')).toBe('true');
        toggle.focus();
        expect(element.querySelector('[role="tooltip"]')!.textContent).toBe('Theme follows Power BI high contrast settings.');
        toggle.click();
        expect(root.style.getPropertyValue('--ssm-bg')).toBe(background);
        hostState.host.colorPalette.isHighContrast = false;
        updateVisual({ viewport: { width: 1280, height: 720 }, type: 4 });
        expect(root.dataset.theme).toBe('dark');
        expect(toggle.getAttribute('aria-disabled')).toBe('false');
    });

    it('follows automatic system theme changes until a viewer chooses a mode and removes its listener on disposal', () => {
        let dark = false;
        const media = new window.EventTarget();
        Object.defineProperty(media, 'matches', { get: () => dark });
        const original = window.matchMedia;
        vi.spyOn(window, 'matchMedia').mockImplementation(query => query.includes('prefers-color-scheme') ? media as MediaQueryList : original(query));
        visual.destroy();
        visual = new SsmExplorerVisual({ element, host: hostState.host } as never);
        // These cases exercise a deliberately chosen all-project scope.
        element.querySelector<HTMLButtonElement>('[data-action="projects-all"]')!.click();
        render();
        const root = element.querySelector<HTMLElement>('.ssm-root')!;
        dark = true; media.dispatchEvent(new Event('change'));
        expect(root.dataset.theme).toBe('dark');
        action('theme').click();
        expect(root.dataset.theme).toBe('light');
        dark = false; media.dispatchEvent(new Event('change'));
        dark = true; media.dispatchEvent(new Event('change'));
        expect(root.dataset.theme).toBe('light');
        visual.destroy();
        expect(() => media.dispatchEvent(new Event('change'))).not.toThrow();
    });

    it('shows only equipment roots until each parent opens its direct children, preserving independent collapsed branches', () => {
        updateVisual({ dataViews: [tableFixture(showroomRows())], viewport: { width: 1280, height: 720 }, type: 2, operationKind: 0 });
        clickHierarchy('l1', 'East Plant', 'Building ready');
        clickHierarchy('l2', 'East Plant', 'Airside ready'); fitScene();
        expect(visibleNodes('equipment').map(candidate => JSON.parse(candidate.dataset.node!)[2])).toEqual(['AHU-101']);
        toggleChildren('AHU-101');
        expect(exactNode('FAN-101', 'East Plant')).toBeTruthy();
        expect(exactNode('DUCT-101', 'East Plant')).toBeTruthy();
        expect(element.querySelectorAll('.ssm-node').length).toBeLessThanOrEqual(300);
        expect(visibleNodes('equipment').some(candidate => JSON.parse(candidate.dataset.node!)[2] === 'MOTOR-101')).toBe(false);
        toggleChildren('FAN-101'); toggleChildren('DUCT-101');
        expect(exactNode('MOTOR-101', 'East Plant')).toBeTruthy(); expect(exactNode('DAMPER-101', 'East Plant')).toBeTruthy();
        toggleChildren('FAN-101');
        expect(visibleNodes('equipment').some(candidate => JSON.parse(candidate.dataset.node!)[2] === 'MOTOR-101')).toBe(false);
        expect(exactNode('DAMPER-101', 'East Plant')).toBeTruthy();
        toggleChildren('AHU-101');
        expect(visibleNodes('equipment').map(candidate => JSON.parse(candidate.dataset.node!)[2])).toEqual(['AHU-101']);
        toggleChildren('AHU-101');
        expect(childrenAction('FAN-101').getAttribute('aria-expanded')).toBe('false');
        expect(exactNode('DAMPER-101', 'East Plant')).toBeTruthy();
    });

    it('opens a late sibling page and each ancestor when searching a deep equipment identity', async () => {
        updateVisual({ dataViews: [tableFixture(showroomRows())], viewport: { width: 1280, height: 720 }, type: 2, operationKind: 0 });
        const search = element.querySelector<HTMLInputElement>('[data-search]')!;
        search.value = 'SENSOR-101'; search.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 140));
        element.querySelector<HTMLElement>('.ssm-search-result')!.click(); flushFrames(); fitScene();
        const sensor = exactNode('SENSOR-101', 'East Plant');
        expect(sensor.classList.contains('is-selected')).toBe(true);
        for (const id of ['AHU-101', 'FAN-101', 'MOTOR-101', 'VFD-101', 'ISOLATOR-101', 'CABLE-101', 'TERMINAL-101', 'CONTROL-101', 'FEEDBACK-101']) expect(childrenAction(id).getAttribute('aria-expanded')).toBe('true');
        expect(sensor.dataset.branch).toBe(JSON.stringify(['l2', 'East Plant', 'Airside ready']));
        expect(element.querySelectorAll('.ssm-node').length).toBeLessThanOrEqual(300);
    });

    it('reveals a 100-deep equipment target even when an author caps mounted occurrences at25', async () => {
        const rows = Array.from({ length: 100 }, (_, index) => ({ project: 'Deep cap', equipmentId: `CHAIN-${String(index).padStart(3, '0')}`, milestone: 'Milestone', parentMilestone: 'Parent', ...(index ? { closestParent: `CHAIN-${String(index - 1).padStart(3, '0')}` } : {}) }));
        updateVisual({ dataViews: [tableFixture(rows, { navigation: { maxVisibleNodes: 25 } })], viewport: { width: 1280, height: 720 }, type: 2, operationKind: 0 });
        const search = element.querySelector<HTMLInputElement>('[data-search]')!;
        search.value = 'CHAIN-099'; search.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 140));
        element.querySelector<HTMLElement>('.ssm-search-result')!.click(); flushFrames();
        expect(exactNode('CHAIN-099', 'Deep cap').classList.contains('is-selected')).toBe(true);
        expect(element.querySelectorAll('.ssm-node').length).toBeLessThanOrEqual(25);
        expect(element.querySelector('.ssm-drawer')?.textContent).toContain('CHAIN-099');
    });

    it('places quick prerequisites in a distinct side lane that does not overlap the source or its structural child', () => {
        render(showroomRows()); fitScene(); quickDependencies('FAN-101', 'East Plant');
        const source = exactNode('FAN-101', 'East Plant');
        const motor = exactNode('MOTOR-101', 'East Plant');
        const targets = Array.from(element.querySelectorAll<HTMLElement>('.is-dependency-row'));
        expect(targets.map(target => JSON.parse(target.dataset.node!)[2])).toEqual(expect.arrayContaining(['DB-101', 'CWP-101']));
        for (const target of targets) {
            expect(parseFloat(target.style.left)).toBeGreaterThanOrEqual(parseFloat(source.style.left) + parseFloat(source.style.width));
            expect(parseFloat(target.style.left)).toBeGreaterThanOrEqual(parseFloat(motor.style.left) + parseFloat(motor.style.width));
            expect(target.dataset.sourceOccurrence).toBe(source.dataset.occurrence);
            expect(target.dataset.branch).toBeUndefined();
        }
        expect(parseFloat(motor.style.top)).toBeGreaterThan(parseFloat(source.style.top));
    });

    it('matches every original discipline value without filtering records or selecting the report', () => {
        const base = { project: 'Highlight project', parentMilestone: 'Parent', milestone: 'Milestone' };
        render([
            { ...base, equipmentId: 'MIXED', discipline: 'Mechanical', dependencies: 'TARGET' },
            { ...base, equipmentId: 'MIXED', discipline: 'Electrical', dependencies: 'TARGET' },
            { ...base, equipmentId: 'TARGET', discipline: 'Mechanical' },
            { ...base, equipmentId: 'OTHER', discipline: 'Electrical' },
        ]); fitScene(); quickDependencies('MIXED', 'Highlight project');
        const before = element.querySelectorAll('.ssm-node').length;
        action('highlight').click(); highlightValue('Mechanical');
        expect(exactNode('MIXED', 'Highlight project').classList.contains('is-highlight-match')).toBe(true);
        expect(exactNode('TARGET', 'Highlight project', 'dependency').classList.contains('is-highlight-match')).toBe(true);
        expect(exactNode('OTHER', 'Highlight project').classList.contains('is-highlight-match')).toBe(false);
        highlightValue('Electrical');
        expect(exactNode('OTHER', 'Highlight project').classList.contains('is-highlight-match')).toBe(true);
        expect(element.querySelectorAll('.ssm-node').length).toBe(before);
        expect(hostState.calls.selections).toEqual([]);
        expect(hostState.calls.persisted.length).toBeGreaterThan(0);
        expect(hostState.calls.persisted.every((write: any) => write.merge.every((entry: any) => entry.objectName === 'viewState'))).toBe(true);
        expect(element.querySelector('.ssm-highlight-badge')?.textContent).toBe('Match');
        action('highlight-clear').click(); flushFrames();
        expect(element.querySelector('.is-highlight-match,.is-highlight-muted')).toBeNull();
    });

    it('lets authors highlight a hidden bound Status field and clears values when the chosen field changes', () => {
        const base = { project: 'Field choice', parentMilestone: 'Parent', milestone: 'Milestone' };
        const rows = [
            { ...base, equipmentId: 'STATUS-MATCH', status: 'Electrical', discipline: 'Mechanical' },
            { ...base, equipmentId: 'STATUS-MATCH', status: 'Awaiting power', discipline: 'Mechanical' },
            { ...base, equipmentId: 'DISCIPLINE-MATCH', status: 'Ready', discipline: 'Electrical' },
            { ...base, equipmentId: 'NO-STATUS', discipline: 'Mechanical' },
        ];
        const objects = { navigation: { initialExpanded: true }, highlighting: { highlightField: JSON.stringify(['metadata', 'SyntheticRegistry.status']) } };
        const data = tableFixture(rows, objects);
        data.table!.columns.find(column => column.queryName === 'SyntheticRegistry.status')!.objects = { detailEquipment: { visible: false } };
        updateVisual({ dataViews: [data], viewport: { width: 1280, height: 720 }, type: 2, operationKind: 0 }); fitScene();
        action('highlight').click();
        expect(element.querySelector('[data-highlight-field]')?.textContent).toBe('Status');
        expect(element.querySelector('[data-highlight-popup] select')).toBeNull();
        expect(Array.from(element.querySelectorAll('[data-highlight-value]')).map(input => input.parentElement?.textContent)).toEqual(['Awaiting power', 'Electrical', 'Ready']);
        highlightValue('Electrical');
        expect(exactNode('STATUS-MATCH', 'Field choice').classList.contains('is-highlight-match')).toBe(true);
        expect(exactNode('DISCIPLINE-MATCH', 'Field choice').classList.contains('is-highlight-match')).toBe(false);
        highlightValue('Electrical', false); highlightValue('Awaiting power');
        expect(exactNode('STATUS-MATCH', 'Field choice').classList.contains('is-highlight-match')).toBe(true);
        highlightValue('Awaiting power', false); highlightValue('Electrical');
        const valueSearch = element.querySelector<HTMLInputElement>('[data-highlight-search]')!;
        valueSearch.value = 'Awaiting'; valueSearch.dispatchEvent(new Event('input', { bubbles: true }));
        exactNode('STATUS-MATCH', 'Field choice').click(); flushFrames();
        expect(Array.from(element.querySelectorAll('.ssm-detail-row dt')).map(label => label.textContent)).not.toContain('Status');
        updateVisual({ dataViews: [tableFixture(rows, { navigation: { initialExpanded: true }, highlighting: { highlightField: JSON.stringify(['discipline']) } })], viewport: { width: 1280, height: 720 }, type: 16 });
        expect(element.querySelector('[data-highlight-field]')?.textContent).toBe('Discipline');
        expect(element.querySelector<HTMLInputElement>('[data-highlight-search]')!.value).toBe('');
        expect(element.querySelector('.is-highlight-match')).toBeNull();
        expect(Array.from(element.querySelectorAll<HTMLInputElement>('[data-highlight-value]')).every(input => !input.checked)).toBe(true);
    });

    it('highlights matching Electrical cards in both the asset tree and prerequisite side lane', () => {
        render(showroomRows()); fitScene(); quickDependencies('FAN-101', 'East Plant');
        action('highlight').click(); highlightValue('Electrical');
        expect(exactNode('MOTOR-101', 'East Plant').classList.contains('is-highlight-match')).toBe(true);
        expect(exactNode('DB-101', 'East Plant', 'dependency').classList.contains('is-highlight-match')).toBe(true);
        expect(exactNode('CWP-101', 'East Plant', 'dependency').classList.contains('is-highlight-match')).toBe(false);
        expect(exactNode('FAN-101', 'East Plant').classList.contains('is-selected')).toBe(true);
        expect(element.querySelectorAll('.ssm-node').length).toBeLessThanOrEqual(300);
    });

    it('returns an open late highlight-value page to a valid page when replacement data has three values', () => {
        const objects = { navigation: { initialExpanded: true }, highlighting: { highlightField: JSON.stringify(['metadata', 'SyntheticRegistry.status']) } };
        const base = { project: 'Picker refresh', parentMilestone: 'Parent', milestone: 'Milestone' };
        const rows = Array.from({ length: 100 }, (_, index) => ({ ...base, equipmentId: `EQ-${index}`, status: `Value ${index}` }));
        render(rows, 1280, 720, objects);
        action('highlight').click(); action('highlight-next').click(); action('highlight-next').click();
        expect(element.querySelectorAll('[data-highlight-value]')).toHaveLength(20);
        const replacement = ['Energized', 'Inspection due', 'Ready'].map((status, index) => ({ ...base, equipmentId: `EQ-${index}`, status }));
        updateVisual({ dataViews: [tableFixture(replacement, objects)], viewport: { width: 1280, height: 720 }, type: 2, operationKind: 0 });
        expect(Array.from(element.querySelectorAll('[data-highlight-values] label')).map(label => label.textContent)).toEqual(['Energized', 'Inspection due', 'Ready']);
        expect(element.querySelector('[data-action="highlight-next"]')).toBeNull();
    });

    it('explains children and side-lane controls to pointer and keyboard users without detached hints', () => {
        render(showroomRows()); fitScene();
        const child = childrenAction('FAN-101');
        const childHint = element.querySelector<HTMLElement>(`#${child.getAttribute('aria-describedby')}`)!;
        expect(child.title).toContain('direct structural children');
        expect(childHint.textContent).toContain('direct structural children');
        child.focus();
        const tooltip = element.querySelector<HTMLElement>('[role="tooltip"]')!;
        expect(tooltip.hidden).toBe(false);
        expect(tooltip.textContent).toContain('direct structural children');
        child.click(); flushFrames();
        expect(document.activeElement?.getAttribute('data-action')).toBe('equipment-children');
        const quick = Array.from(element.querySelectorAll<HTMLButtonElement>('[data-action="quick-dependencies"]')).find(button => button.dataset.target === JSON.stringify(['equipment', 'East Plant', 'FAN-101']))!;
        expect(quick.title).toContain('side lane');
        expect(element.querySelector(`#${quick.getAttribute('aria-describedby')}`)?.textContent).toContain('side lane');
        quick.focus();
        expect(element.querySelector<HTMLElement>('[role="tooltip"]')!.hidden).toBe(false);
        expect(element.querySelector('[role="tooltip"]')?.textContent).toContain('side lane');
        quick.click(); flushFrames();
        expect(element.querySelectorAll('[role="tooltip"]')).toHaveLength(1);
        expect(element.contains(document.activeElement)).toBe(true);
        (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); flushFrames();
        expect(element.querySelector<HTMLElement>('[role="tooltip"]')!.hidden).toBe(true);
        expect(element.querySelectorAll(`#${childHint.id}`)).toHaveLength(1);
    });

    it('pages direct siblings without opening their descendants and keeps another equipment branch independent', () => {
        const base = { project: 'Sibling pages', parentMilestone: 'Parent', milestone: 'Milestone' };
        const rows = [{ ...base, equipmentId: 'ROOT' }, { ...base, equipmentId: 'OTHER' }, { ...base, equipmentId: 'OTHER-CHILD', closestParent: 'OTHER' }, ...Array.from({ length: 80 }, (_, index) => ({ ...base, equipmentId: `W-${String(index).padStart(3, '0')}`, closestParent: 'ROOT' }))];
        updateVisual({ dataViews: [tableFixture(rows)], viewport: { width: 1280, height: 720 }, type: 2, operationKind: 0 });
        clickHierarchy('l1', 'Sibling pages', 'Parent'); clickHierarchy('l2', 'Sibling pages', 'Milestone'); fitScene();
        toggleChildren('OTHER', 'Sibling pages'); toggleChildren('ROOT', 'Sibling pages');
        const wide = () => visibleNodes('equipment').map(candidate => JSON.parse(candidate.dataset.node!)[2]).filter(id => id.startsWith('W-')).sort();
        expect(wide()).toEqual(rows.slice(3, 33).map(row => row.equipmentId));
        action('equipment-next').click(); flushFrames(); fitScene();
        expect(wide()).toEqual(rows.slice(33, 63).map(row => row.equipmentId));
        action('equipment-next').click(); flushFrames(); fitScene();
        expect(wide()).toEqual(rows.slice(63).map(row => row.equipmentId));
        toggleChildren('ROOT', 'Sibling pages');
        expect(wide()).toEqual([]); expect(exactNode('OTHER-CHILD', 'Sibling pages')).toBeTruthy();
        toggleChildren('ROOT', 'Sibling pages');
        expect(wide()).toEqual(rows.slice(63).map(row => row.equipmentId));
        action('equipment-prev').click(); flushFrames(); fitScene();
        expect(wide()).toEqual(rows.slice(33, 63).map(row => row.equipmentId));
    });

    it('routes a direct prerequisite arrow to its direct side copy when another prerequisite expands the same physical child', () => {
        const base = { project: 'Lane target', parentMilestone: 'Parent', milestone: 'Milestone' };
        updateVisual({ dataViews: [tableFixture([
            { ...base, equipmentId: 'SOURCE', dependencies: JSON.stringify(['PARENT', 'CHILD']) },
            { ...base, equipmentId: 'PARENT' },
            { ...base, equipmentId: 'CHILD', closestParent: 'PARENT' },
        ])], viewport: { width: 1280, height: 720 }, type: 2, operationKind: 0 });
        clickHierarchy('l1', 'Lane target', 'Parent'); clickHierarchy('l2', 'Lane target', 'Milestone'); fitScene();
        quickDependencies('SOURCE', 'Lane target');
        toggleChildren('PARENT', 'Lane target', 'dependency');
        const direct = exactNode('CHILD', 'Lane target', 'dependency');
        const nested = exactNode('CHILD', 'Lane target', 'related');
        expect(direct.dataset.occurrence).not.toBe(nested.dataset.occurrence);
        const paths = Array.from(element.querySelectorAll<SVGPathElement>('.ssm-links path.dependency'));
        const source = exactNode('SOURCE', 'Lane target');
        expect(paths.some(path => path.dataset.fromOccurrence === source.dataset.occurrence && path.dataset.toOccurrence === direct.dataset.occurrence)).toBe(true);
        expect(paths.some(path => path.dataset.fromOccurrence === source.dataset.occurrence && path.dataset.toOccurrence === nested.dataset.occurrence)).toBe(false);
    });

    it('does not advertise an empty Children expansion for a parent-cycle back edge', () => {
        const base = { project: 'Cycle controls', parentMilestone: 'Parent', milestone: 'Milestone' };
        updateVisual({ dataViews: [tableFixture([{ ...base, equipmentId: 'CYCLE-A', closestParent: 'CYCLE-B' }, { ...base, equipmentId: 'CYCLE-B', closestParent: 'CYCLE-A' }])], viewport: { width: 1280, height: 720 }, type: 2, operationKind: 0 });
        clickHierarchy('l1', 'Cycle controls', 'Parent'); clickHierarchy('l2', 'Cycle controls', 'Milestone'); fitScene();
        toggleChildren('CYCLE-A', 'Cycle controls');
        const child = exactNode('CYCLE-B', 'Cycle controls');
        expect(Array.from(element.querySelectorAll<HTMLButtonElement>('[data-action="equipment-children"]')).some(button => button.dataset.source === child.dataset.occurrence)).toBe(false);
        expect(visibleNodes('equipment', 'Cycle controls')).toHaveLength(2);
    });

    it.each(['equipment', 'l2', 'l1'])('removes unreachable dependency lanes when the source %s ancestor collapses', level => {
        updateVisual({ dataViews: [tableFixture(showroomRows())], viewport: { width: 1280, height: 720 }, type: 2, operationKind: 0 });
        clickHierarchy('l1', 'East Plant', 'Building ready'); clickHierarchy('l2', 'East Plant', 'Airside ready'); fitScene();
        const milestonePositions = () => visibleNodes('l2').map(node => [node.dataset.node, node.style.left, node.style.top]).sort((a, b) => a[0]!.localeCompare(b[0]!));
        let baseline = milestonePositions();
        const baselineWidth = (visual as any).worldWidth;
        toggleChildren('AHU-101');
        // Reopening an organizational ancestor preserves AHU's expanded state.
        // Compare equivalent nested state; compact groups may legitimately
        // reflow when an equipment branch itself is opened or closed.
        if (level !== 'equipment') baseline = milestonePositions();
        quickDependencies('FAN-101', 'East Plant');
        expect(element.querySelector('[data-dependency-panel]')).toBeTruthy();
        if (level === 'equipment') toggleChildren('AHU-101');
        else if (level === 'l2') clickHierarchy('l2', 'East Plant', 'Airside ready');
        else clickHierarchy('l1', 'East Plant', 'Building ready');
        flushFrames(); fitScene();
        expect(element.querySelector('[data-dependency-panel]')).toBeNull();
        expect(element.querySelector('.is-dependency-row,.is-related-row')).toBeNull();
        expect((visual as any).worldWidth).toBe(baselineWidth);
        if (level === 'l1') { clickHierarchy('l1', 'East Plant', 'Building ready'); fitScene(); }
        if (level === 'l2') { clickHierarchy('l2', 'East Plant', 'Airside ready'); fitScene(); }
        expect(milestonePositions()).toEqual(baseline);
    });
    it('places structural parents before children despite lexical IDs, retaining deep and cyclic source records', () => {
        render(structuralRows(4)); fitScene();
        const root = exactNode('Z-ROOT'), child = exactNode('A-CHILD'), grandchild = exactNode('B-GRANDCHILD');
        expect(parseFloat(root.style.top)).toBeLessThan(parseFloat(child.style.top));
        expect(parseFloat(child.style.top)).toBeLessThan(parseFloat(grandchild.style.top));
        const header = Array.from(element.querySelectorAll<HTMLElement>('.ssm-node.header')).find(candidate => JSON.parse(candidate.dataset.node!)[2] === 'HEADER-90')!;
        expect(parseFloat(header.style.top)).toBeLessThan(parseFloat(root.style.top));
        expect(parseFloat(exactNode('D-10').style.top)).toBeGreaterThan(parseFloat(exactNode('D-01').style.top));
        expect(exactNode('CYCLE-A').textContent).toContain('parent issue');
        expect(exactNode('CYCLE-B')).toBeTruthy();
        const graph = (visual as any).graph;
        expect(graph.edges.some((edge: any) => edge.kind === 'parent' && JSON.parse(edge.from)[2] === 'CYCLE-A' && JSON.parse(edge.to)[2] === 'CYCLE-B')).toBe(true);
        expect(graph.edges.some((edge: any) => edge.kind === 'parent' && JSON.parse(edge.from)[2] === 'CYCLE-B' && JSON.parse(edge.to)[2] === 'CYCLE-A')).toBe(true);
    });

    it('carries real ancestor context onto a late member page and reveals search using forest order', async () => {
        render(structuralRows(80)); fitScene();
        const search = element.querySelector<HTMLInputElement>('[data-search]')!;
        search.value = 'W-079'; search.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 140));
        const key = JSON.stringify(['equipment', 'Project Alpha', 'W-079']);
        const result = Array.from(element.querySelectorAll<HTMLElement>('.ssm-search-result')).find(candidate => candidate.dataset.target === key)!;
        expect(result).toBeTruthy(); result.click(); flushFrames(); fitScene();
        const target = exactNode('W-079');
        const root = exactNode('Z-ROOT', 'Project Alpha', 'ancestor');
        expect(target.classList.contains('is-selected')).toBe(true);
        expect(parseFloat(root.style.top)).toBeLessThan(parseFloat(target.style.top));
        expect(target.dataset.branch).toBe(JSON.stringify(['l2', 'Project Alpha', 'Mechanical completion']));
        expect(visibleNodes('equipment').filter(candidate => candidate.dataset.role === 'member' && candidate.dataset.branch === target.dataset.branch).length).toBeLessThanOrEqual(30);
        expect(element.querySelectorAll('.ssm-node').length).toBeLessThanOrEqual(300);
    });

    it('opens only direct prerequisites inline and switches to the correct Required by direction', () => {
        render(structuralRows(4)); fitScene();
        quickDependencies('Z-ROOT');
        const outgoing = Array.from(element.querySelectorAll<HTMLElement>('.is-dependency-row'));
        expect(outgoing.map(candidate => candidate.dataset.node).sort()).toEqual([
            JSON.stringify(['equipment', 'Project Alpha', 'P-LOCAL']), JSON.stringify(['equipment', 'Project Beta', 'D-REMOTE']),
        ].sort());
        expect(action('dependencies-out').textContent).toBe('Dependencies 2');
        expect(action('dependencies-in').textContent).toBe('Required by 1');
        expect(outgoing.every(candidate => parseFloat(candidate.style.top) > parseFloat(exactNode('Z-ROOT').style.top))).toBe(true);
        expect(element.querySelector('button button')).toBeNull();
        action('dependencies-in').click(); flushFrames(); fitScene();
        expect(element.querySelectorAll('.is-dependency-row')).toHaveLength(1);
        expect(exactNode('C-CONSUMER', 'Project Alpha', 'dependency').textContent).toContain('Required by');
        action('dependencies-close').click(); flushFrames();
        expect(element.querySelector('[data-dependency-panel]')).toBeNull();
    });

    it('keeps duplicate inline occurrences distinct and selects the prerequisite source identity', async () => {
        const rows = structuralRows(4);
        render(rows); fitScene(); quickDependencies('Z-ROOT');
        const local = visibleNodes('equipment').filter(candidate => candidate.dataset.node === JSON.stringify(['equipment', 'Project Alpha', 'P-LOCAL']));
        expect(local.length).toBeGreaterThanOrEqual(2);
        expect(new Set(local.map(candidate => candidate.dataset.occurrence)).size).toBe(local.length);
        const remote = exactNode('D-REMOTE', 'Project Beta', 'dependency');
        expect(remote.dataset.branch).toBeUndefined();
        expect(remote.textContent).toContain('Project Beta · Controls commissioning');
        remote.click(); flushFrames(); action('select-report').click(); await Promise.resolve();
        const sourceIndex = rows.findIndex(row => row.project === 'Project Beta' && row.equipmentId === 'D-REMOTE');
        expect(hostState.calls.selections[hostState.calls.selections.length - 1]?.keys).toEqual([`table:Project Beta:D-REMOTE:${sourceIndex}`]);
        expect(element.querySelector('.ssm-drawer')?.textContent).toContain('Synthetic Beta team');
    });

    it('removes an already-open quick dependency block when the author hides relations', () => {
        const rows = structuralRows(4); render(rows); fitScene(); quickDependencies('Z-ROOT');
        expect(element.querySelector('[data-dependency-panel]')).toBeTruthy();
        updateVisual({ dataViews: [tableFixture(rows, { navigation: { initialExpanded: true }, drawer: { showRelations: false } })], viewport: { width: 1280, height: 720 }, type: 16 } as never);
        expect(element.querySelector('[data-action="quick-dependencies"]')).toBeNull();
        expect(element.querySelector('[data-dependency-panel]')).toBeNull();
        expect(element.querySelector('.is-dependency-row')).toBeNull();
    });

    it('retains keyboard focus on a live inline action after opening and changing direction', () => {
        render(structuralRows(4)); fitScene();
        const key = JSON.stringify(['equipment', 'Project Alpha', 'Z-ROOT']);
        const quick = Array.from(element.querySelectorAll<HTMLButtonElement>('[data-action="quick-dependencies"]')).find(button => button.dataset.target === key)!;
        quick.focus(); quick.click(); flushFrames();
        expect(document.activeElement).not.toBe(document.body);
        expect(element.contains(document.activeElement)).toBe(true);
        fitScene();
        const incoming = action('dependencies-in'); incoming.focus(); incoming.click(); flushFrames();
        expect(document.activeElement?.getAttribute('data-action')).toBe('dependencies-in');
        expect(document.activeElement?.getAttribute('aria-pressed')).toBe('true');
    });

    it('shows an off-milestone parent as context without declaring a new membership', () => {
        render(structuralRows(4)); fitScene();
        const parent = exactNode('P-LOCAL', 'Project Alpha', 'ancestor');
        const child = exactNode('E-EXTERNAL', 'Project Alpha', 'member');
        expect(parent.dataset.branch).toBeUndefined();
        expect(parent.textContent).toContain('Controls commissioning');
        expect(parseFloat(parent.style.top)).toBeLessThan(parseFloat(child.style.top));
        const graph = (visual as any).graph;
        const original = graph.nodes.get(JSON.stringify(['equipment', 'Project Alpha', 'P-LOCAL']));
        expect(original.milestoneKeys).toEqual([JSON.stringify(['l2', 'Project Alpha', 'Controls commissioning'])]);
    });

    it('shows unavailable direct prerequisites without inventing a report identity', () => {
        render(structuralRows(4)); fitScene(); quickDependencies('A-CHILD');
        const unavailable = element.querySelector<HTMLElement>('.ssm-node.unresolved.is-dependency-row')!;
        expect(unavailable).toBeTruthy();
        expect(unavailable.textContent).toContain('Absent Project');
        unavailable.click(); flushFrames();
        expect(element.querySelector('.ssm-drawer')?.textContent).toContain('Referenced record unavailable');
        expect(element.querySelector('[data-action="select-report"]')).toBeNull();
    });

    it('pages every assigned member without gaps when the author lowers the occurrence cap', () => {
        const rows = Array.from({ length: 40 }, (_, index) => ({ project: 'Small cap', equipmentId: `EQ-${String(index).padStart(2, '0')}`, milestone: 'Milestone', parentMilestone: 'Parent' }));
        render(rows, 1280, 720, { navigation: { maxVisibleNodes: 25 } }); fitScene();
        const members = () => visibleNodes('equipment').filter(candidate => candidate.dataset.role === 'member').map(candidate => JSON.parse(candidate.dataset.node!)[2]).sort();
        expect(members()).toEqual(rows.slice(0, 13).map(row => row.equipmentId));
        action('equipment-next').click(); flushFrames(); fitScene();
        expect(members()).toEqual(rows.slice(13, 26).map(row => row.equipmentId));
        action('equipment-prev').click(); flushFrames(); fitScene();
        expect(members()).toEqual(rows.slice(0, 13).map(row => row.equipmentId));
        expect(element.querySelectorAll('.ssm-node').length).toBeLessThanOrEqual(25);
    });

    it('pages dense direct consumers five at a time without duplicating physical member counts', () => {
        const base = { project: 'Dense consumers', milestone: 'Milestone', parentMilestone: 'Parent' };
        const rows = [{ ...base, equipmentId: 'HUB' }, ...Array.from({ length: 16 }, (_, index) => ({ ...base, equipmentId: `CONSUMER-${index}`, dependencies: JSON.stringify(['HUB']) }))];
        render(rows); fitScene();
        expect(element.querySelector('.ssm-counts')?.textContent).toMatch(/^17 direct/);
        quickDependencies('HUB', 'Dense consumers');
        expect(action('dependencies-in').textContent).toBe('Required by 16');
        const targets = () => Array.from(element.querySelectorAll<HTMLElement>('.is-dependency-row')).map(candidate => candidate.dataset.node);
        const first = targets(); expect(first).toHaveLength(5);
        action('dependencies-next').click(); flushFrames(); fitScene();
        const next = targets(); expect(next).toHaveLength(5);
        expect(next.some(key => first.includes(key))).toBe(false);
        expect(element.querySelector('.ssm-counts')?.textContent).toMatch(/^17 direct/);
        action('dependencies-prev').click(); flushFrames(); fitScene();
        expect(targets()).toEqual(first);
    });

    it('recomputes cached parent links immediately when All connections includes a cycle edge', () => {
        render(structuralRows(4)); fitScene();
        const cycles = () => Array.from(element.querySelectorAll<SVGPathElement>('.ssm-links path.parent')).filter(path => path.dataset.from?.includes('CYCLE-') && path.dataset.to?.includes('CYCLE-'));
        expect(cycles()).toHaveLength(1);
        const all = element.querySelector<HTMLInputElement>('[data-layer="all"]')!;
        all.checked = true; all.dispatchEvent(new Event('change', { bubbles: true })); flushFrames();
        expect(cycles()).toHaveLength(2);
        all.checked = false; all.dispatchEvent(new Event('change', { bubbles: true })); flushFrames();
        expect(cycles()).toHaveLength(1);
    });

    it('follows the affected omitted member when a deep expanded tree reaches the author budget', () => {
        const rows = Array.from({ length: 100 }, (_, index) => ({ project: 'Deep page', equipmentId: `CHAIN-${String(index).padStart(3, '0')}`, milestone: 'Milestone', parentMilestone: 'Parent', ...(index ? { closestParent: `CHAIN-${String(index - 1).padStart(3, '0')}` } : {}) }));
        render(rows, 1280, 720, { navigation: { maxVisibleNodes: 25 } }); fitScene();
        const notice = action('follow-tree');
        const shown = visibleNodes('equipment', 'Deep page').filter(node => node.dataset.role === 'member').map(node => Number(JSON.parse(node.dataset.node!)[2].slice(-3)));
        const omittedId = `CHAIN-${String(Math.max(...shown) + 1).padStart(3, '0')}`;
        expect(notice.dataset.target).toBe(JSON.stringify(['equipment', 'Deep page', omittedId]));
        notice.click(); flushFrames();
        expect(exactNode(omittedId, 'Deep page').classList.contains('is-selected')).toBe(true);
        expect((visual as any).selectedKey).toBe(notice.dataset.target);
        expect(element.querySelectorAll('.ssm-node').length).toBeLessThanOrEqual(25);
    });

    it('does not leak a prior occurrence forest warning into a newly searched node', async () => {
        const base = { project: 'Warnings', parentMilestone: 'Parent' };
        render([
            { ...base, equipmentId: 'A-BAD', milestone: 'Main', closestParent: 'P-OUTSIDE' },
            { ...base, equipmentId: 'C-GOOD', milestone: 'Main', owner: 'Correct target owner' },
            { ...base, equipmentId: 'P-OUTSIDE', milestone: 'Other' },
        ]); fitScene();
        const context = element.querySelector<HTMLInputElement>('[data-layer="context"]')!;
        context.checked = false; context.dispatchEvent(new Event('change', { bubbles: true })); flushFrames(); fitScene();
        exactNode('A-BAD', 'Warnings').click(); flushFrames();
        expect(element.querySelector('.ssm-drawer')?.textContent).toContain('A closest parent is outside the displayed scope.');
        const search = element.querySelector<HTMLInputElement>('[data-search]')!;
        search.value = 'C-GOOD'; search.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 140));
        element.querySelector<HTMLElement>('.ssm-search-result')!.click(); flushFrames();
        expect(element.querySelector('.ssm-drawer')?.textContent).toContain('Correct target owner');
        expect(element.querySelector('.ssm-drawer')?.textContent).not.toContain('A closest parent is outside the displayed scope.');
    });

    it('renders the visible late inline dependency page beyond the general adjacency scan budget', () => {
        const ids = Array.from({ length: 850 }, (_, index) => `TARGET-${String(index).padStart(3, '0')}`);
        const base = { project: 'Dense edges', parentMilestone: 'Parent' };
        render([{ ...base, equipmentId: 'HUB', milestone: 'A Source', dependencies: JSON.stringify(ids) }, ...ids.map(equipmentId => ({ ...base, equipmentId, milestone: 'B Targets' }))], 1280, 720, { navigation: { maxVisibleNodes: 25 } }); fitScene();
        quickDependencies('HUB', 'Dense edges');
        // Target the late adjacency window directly, then exercise actual Next.
        // Exhaustive pager behaviour is covered by the dense-consumer case;
        //169 full JSDOM reconciliations would obscure this arrow-budget check.
        (visual as any).quickDependencies.offset = 840;
        (visual as any).render(); flushFrames();
        action('dependencies-next').click(); flushFrames();
        fitScene();
        // Retained DOM nodes need not be in source order after viewport culling.
        // The visible grid must still preserve the direct relation page order.
        const targets = Array.from(element.querySelectorAll<HTMLElement>('.is-dependency-row')).sort((a, b) => parseFloat(a.style.top) - parseFloat(b.style.top) || parseFloat(a.style.left) - parseFloat(b.style.left));
        expect(targets.map(target => JSON.parse(target.dataset.node!)[2])).toEqual(ids.slice(845));
        const paths = Array.from(element.querySelectorAll<SVGPathElement>('.ssm-links path.dependency'));
        for (const target of targets) {
            expect(paths.some(path => path.dataset.fromOccurrence === target.dataset.sourceOccurrence && path.dataset.toOccurrence === target.dataset.occurrence), `inline edge for ${target.dataset.node} must survive the adjacency cap`).toBe(true);
        }
        expect(element.querySelectorAll('.ssm-node').length).toBeLessThanOrEqual(25);
        expect(paths.length).toBeLessThanOrEqual(100);
    });
    it('starts with L1 only, reveals its L2 children, then reveals equipment on an L2 click', () => {
        updateVisual({ dataViews: [tableFixture(standardRows())], viewport: { width: 1280, height: 720 }, type: 2, operationKind: 0 } as never);
        expect(element.querySelectorAll('.ssm-node.l1').length).toBeGreaterThan(0);
        expect(element.querySelectorAll('.ssm-node:not(.l1)')).toHaveLength(0);
        clickHierarchy('l1', 'Project Alpha', 'Building ready');
        expect(visibleNodes('l2', 'Project Alpha')).toHaveLength(2);
        expect(visibleNodes('l2', 'Project Beta')).toHaveLength(0);
        expect(element.querySelectorAll('.ssm-node.equipment')).toHaveLength(0);
        expect(element.querySelector('.ssm-drawer')?.textContent).toContain('Commissioning lead');
        clickHierarchy('l2', 'Project Alpha', 'Mechanical completion');
        expect(element.querySelectorAll('.ssm-node.equipment').length).toBeGreaterThan(0);
        expect(element.querySelector('.ssm-drawer')?.textContent).toContain('Milestone coordinator');
        expect(element.querySelector('.ssm-drawer')?.textContent).not.toContain('A. Patel');
        clickHierarchy('l2', 'Project Alpha', 'Mechanical completion');
        expect(element.querySelectorAll('.ssm-node.equipment')).toHaveLength(0);
        expect(visibleNodes('l2', 'Project Alpha')).toHaveLength(2);
    });

    it('collapses each L1 independently and removes its children without collapsing another L1', () => {
        updateVisual({ dataViews: [tableFixture(standardRows())], viewport: { width: 1280, height: 720 }, type: 2, operationKind: 0 } as never);
        clickHierarchy('l1', 'Project Alpha', 'Building ready');
        clickHierarchy('l1', 'Project Beta', 'Building ready');
        expect(visibleNodes('l2', 'Project Alpha').length).toBeGreaterThan(0);
        expect(visibleNodes('l2', 'Project Beta').length).toBeGreaterThan(0);
        clickHierarchy('l1', 'Project Alpha', 'Building ready');
        expect(visibleNodes('l2', 'Project Alpha')).toHaveLength(0);
        expect(visibleNodes('l2', 'Project Beta').length).toBeGreaterThan(0);
        clickHierarchy('l1', 'Project Beta', 'Building ready');
        expect(element.querySelectorAll('.ssm-node.l2')).toHaveLength(0);
        expect(element.querySelectorAll('.ssm-node.equipment')).toHaveLength(0);
    });

    it('collapses one L2 independently while another L2 remains expanded beneath the same L1', () => {
        updateVisual({ dataViews: [tableFixture(standardRows())], viewport: { width: 1280, height: 720 }, type: 2, operationKind: 0 } as never);
        clickHierarchy('l1', 'Project Alpha', 'Building ready');
        clickHierarchy('l2', 'Project Alpha', 'Mechanical completion');
        clickHierarchy('l2', 'Project Alpha', 'Controls commissioning');
        fitScene(); toggleChildren('EQ-001', 'Project Alpha', 'ancestor');
        const mechanical = JSON.stringify(['l2', 'Project Alpha', 'Mechanical completion']);
        const controls = JSON.stringify(['l2', 'Project Alpha', 'Controls commissioning']);
        expect(element.querySelectorAll('.ssm-node.equipment').length).toBeGreaterThan(0);
        clickHierarchy('l2', 'Project Alpha', 'Mechanical completion');
        expect(visibleNodes('equipment').filter(node => node.dataset.branch === mechanical)).toHaveLength(0);
        fitScene();
        expect(visibleNodes('equipment').filter(node => node.dataset.branch === controls).length).toBeGreaterThan(0);
        clickHierarchy('l1', 'Project Alpha', 'Building ready');
        expect(element.querySelectorAll('.ssm-node.l2')).toHaveLength(0);
        expect(element.querySelectorAll('.ssm-node.equipment')).toHaveLength(0);
    });

    it('wraps and pages hundreds of L2s underneath their own L1 and reveals the correct late search path', async () => {
        updateVisual({ dataViews: [tableFixture(hierarchyRows())], viewport: { width: 1280, height: 720 }, type: 2, operationKind: 0 } as never);
        expect(element.querySelectorAll('.ssm-node:not(.l1)')).toHaveLength(0);
        const parentKey = JSON.stringify(['l1', 'Hierarchy Alpha', 'Parent A']);
        clickHierarchy('l1', 'Hierarchy Alpha', 'Parent A');
        const children = visibleNodes('l2');
        expect(children.length).toBeGreaterThan(0);
        expect(children.length).toBeLessThanOrEqual(12);
        expect(children.every(child => child.dataset.parent === parentKey)).toBe(true);
        expect(new Set(children.map(child => child.style.top)).size).toBeGreaterThan(1);
        const search = element.querySelector<HTMLInputElement>('[data-search]')!;
        search.value = 'EQ-B-240-03';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 140));
        const targetKey = JSON.stringify(['equipment', 'Hierarchy Beta', 'EQ-B-240-03']);
        const result = Array.from(element.querySelectorAll<HTMLElement>('.ssm-search-result')).find(candidate => candidate.dataset.target === targetKey)!;
        expect(result).toBeTruthy();
        result.click(); flushFrames();
        const selected = node('Hierarchy Beta', 'EQ-B-240-03') as unknown as HTMLElement;
        expect(selected.classList.contains('is-selected')).toBe(true);
        expect(selected.dataset.parent).toBe(JSON.stringify(['l1', 'Hierarchy Beta', 'Parent B']));
        expect(selected.dataset.branch).toBe(JSON.stringify(['l2', 'Hierarchy Beta', 'B / Milestone 240']));
        action('fit').click(); flushFrames();
        expect(hierarchyNode('l1', 'Hierarchy Beta', 'Parent B').getAttribute('aria-expanded')).toBe('true');
        expect(hierarchyNode('l2', 'Hierarchy Beta', 'B / Milestone 240').getAttribute('aria-expanded')).toBe('true');
        expect(element.querySelector('.ssm-drawer')?.textContent).toContain('Hierarchy Beta team B');
        expect(element.querySelectorAll('.ssm-node').length).toBeLessThanOrEqual(300);
    });

    it('uses each supplied parent/milestone assignment pair without inventing cross-product occurrences', () => {
        const base = { project: 'Paired Project', nodeType: 'equipment', owner: 'Synthetic team' };
        render([
            { ...base, equipmentId: 'EQ-SHARED', parentMilestone: 'Parent A', milestone: 'Milestone X' },
            { ...base, equipmentId: 'EQ-SHARED', parentMilestone: 'Parent B', milestone: 'Milestone Y' },
            { ...base, equipmentId: 'EQ-OTHER', parentMilestone: 'Parent B', milestone: 'Milestone X' },
        ]);
        const shared = visibleNodes('equipment').filter(node => JSON.parse(node.dataset.node!)[2] === 'EQ-SHARED');
        const parentB = JSON.stringify(['l1', 'Paired Project', 'Parent B']);
        const milestoneX = JSON.stringify(['l2', 'Paired Project', 'Milestone X']);
        const milestoneY = JSON.stringify(['l2', 'Paired Project', 'Milestone Y']);
        expect(shared.some(node => node.dataset.parent === parentB && node.dataset.branch === milestoneX)).toBe(false);
        expect(shared.some(node => node.dataset.parent === parentB && node.dataset.branch === milestoneY)).toBe(true);
        expect(Array.from((visual as any).graph.nodes.values()).filter((node: any) => node.kind === 'equipment')).toHaveLength(2);
    });

    it('calculates ancestor pages from the filtered cohort when searching a sparse late milestone', async () => {
        const rows = hierarchyRows(60, 1).map(row => ({ ...row, discipline: Number(row.milestone!.split(' ').pop()) % 5 === 0 ? 'Mechanical' : 'Electrical' }));
        updateVisual({ dataViews: [tableFixture(rows)], viewport: { width: 1280, height: 720 }, type: 2, operationKind: 0 } as never);
        const discipline = element.querySelector<HTMLSelectElement>('[data-filter="discipline"]')!;
        discipline.value = 'Mechanical'; discipline.dispatchEvent(new Event('change', { bubbles: true })); flushFrames();
        const search = element.querySelector<HTMLInputElement>('[data-search]')!;
        search.value = 'EQ-A-060-01'; search.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 140));
        const targetKey = JSON.stringify(['equipment', 'Hierarchy Beta', 'EQ-A-060-01']);
        const result = Array.from(element.querySelectorAll<HTMLElement>('.ssm-search-result')).find(candidate => candidate.dataset.target === targetKey)!;
        expect(result).toBeTruthy(); result.click(); flushFrames();
        const selected = node('Hierarchy Beta', 'EQ-A-060-01') as unknown as HTMLElement;
        expect(selected.classList.contains('is-selected')).toBe(true);
        expect(selected.dataset.parent).toBe(JSON.stringify(['l1', 'Hierarchy Beta', 'Parent A']));
        expect(selected.dataset.branch).toBe(JSON.stringify(['l2', 'Hierarchy Beta', 'A / Milestone 060']));
        expect(element.querySelector<HTMLSelectElement>('[data-filter="discipline"]')!.value).toBe('Mechanical');
        action('fit').click(); flushFrames();
        expect(hierarchyNode('l2', 'Hierarchy Beta', 'A / Milestone 060').getAttribute('aria-expanded')).toBe('true');
        expect(element.querySelectorAll('.ssm-node').length).toBeLessThanOrEqual(300);
    });

    it.each([
        ['l1', 'Controls parent'], ['l2', 'Controls commissioning'],
    ])('reveals a searched %s header whose equipment is outside the active discipline', async (kind, label) => {
        updateVisual({ dataViews: [tableFixture([
            { project: 'Filter Project', equipmentId: 'EQ-M', discipline: 'Mechanical', milestone: 'Mechanical completion', parentMilestone: 'Mechanical parent' },
            { project: 'Filter Project', equipmentId: 'EQ-E', discipline: 'Electrical', milestone: 'Controls commissioning', parentMilestone: 'Controls parent' },
        ])], viewport: { width: 1280, height: 720 }, type: 2, operationKind: 0 } as never);
        const discipline = element.querySelector<HTMLSelectElement>('[data-filter="discipline"]')!;
        discipline.value = 'Mechanical'; discipline.dispatchEvent(new Event('change', { bubbles: true })); flushFrames();
        const targetKey = JSON.stringify([kind, 'Filter Project', label]);
        expect(Array.from(element.querySelectorAll<HTMLElement>('.ssm-node')).some(node => node.dataset.node === targetKey)).toBe(false);
        const search = element.querySelector<HTMLInputElement>('[data-search]')!;
        search.value = label; search.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 140));
        const result = Array.from(element.querySelectorAll<HTMLElement>('.ssm-search-result')).find(node => node.dataset.target === targetKey)!;
        expect(result).toBeTruthy(); result.click(); flushFrames();
        const selected = hierarchyNode(kind as 'l1' | 'l2', 'Filter Project', label);
        expect(selected.classList.contains('is-selected')).toBe(true);
        expect(selected.classList.contains('is-context')).toBe(true);
        expect(element.querySelector<HTMLSelectElement>('[data-filter="discipline"]')!.value).toBe('Mechanical');
        expect(element.querySelector('.ssm-drawer')?.textContent).toContain(label);
        expect(element.querySelectorAll('.ssm-node').length).toBeLessThanOrEqual(300);
    });

    it('keeps compatible details and the camera stable after refreshing an expanded hierarchy', () => {
        const rows = standardRows();
        updateVisual({ dataViews: [tableFixture(rows)], viewport: { width: 1280, height: 720 }, type: 2, operationKind: 0 } as never);
        clickHierarchy('l1', 'Project Alpha', 'Building ready');
        clickHierarchy('l2', 'Project Alpha', 'Mechanical completion');
        toggleChildren('EQ-001', 'Project Alpha');
        clickNode();
        const camera = element.querySelector<HTMLElement>('.ssm-world')?.style.transform;
        updateVisual({ dataViews: [tableFixture(rows.map(row => ({ ...row, owner: 'Refreshed hierarchy team' })))], viewport: { width: 1280, height: 720 }, type: 2, operationKind: 0 } as never);
        expect(element.querySelector<HTMLElement>('.ssm-world')?.style.transform).toBe(camera);
        expect(element.querySelector('.ssm-drawer')?.textContent).toContain('Refreshed hierarchy team');
        expect(element.querySelectorAll('.ssm-node.equipment').length).toBeGreaterThan(0);
    });

    it.each(['format setting', 'reduced motion'])('cancels active hierarchy transitions when %s disables animation', mode => {
        const previous = Object.getOwnPropertyDescriptor(Element.prototype, 'animate');
        const animations: Array<{ cancel: ReturnType<typeof vi.fn> }> = [];
        Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: () => {
            const animation = { cancel: vi.fn() }; animations.push(animation); return animation;
        } });
        try {
            updateVisual({ dataViews: [tableFixture(standardRows())], viewport: { width: 1280, height: 720 }, type: 2, operationKind: 0 } as never);
            clickHierarchy('l1', 'Project Alpha', 'Building ready');
            expect(animations.length).toBeGreaterThan(0);
            if (mode === 'reduced motion') vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: query.includes('prefers-reduced-motion'), media: query } as MediaQueryList));
            const objects = mode === 'format setting' ? { navigation: { animate: false } } : undefined;
            updateVisual({ dataViews: [tableFixture(standardRows(), objects)], viewport: { width: 1280, height: 720 }, type: 16, operationKind: 0 } as never);
            expect(animations.every(animation => animation.cancel.mock.calls.length > 0)).toBe(true);
            expect(element.querySelector('.ssm-root')?.classList.contains('ssm-reduced-motion')).toBe(true);
        } finally {
            if (previous) Object.defineProperty(Element.prototype, 'animate', previous);
            else delete (Element.prototype as any).animate;
        }
    });

    it('cancels an in-flight transition immediately when the system reduced-motion preference changes', () => {
        const previous = Object.getOwnPropertyDescriptor(Element.prototype, 'animate');
        const animations: Array<{ cancel: ReturnType<typeof vi.fn> }> = [];
        Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: () => {
            const animation = { cancel: vi.fn() }; animations.push(animation); return animation;
        } });
        try {
            updateVisual({ dataViews: [tableFixture(standardRows())], viewport: { width: 1280, height: 720 }, type: 2, operationKind: 0 } as never);
            clickHierarchy('l1', 'Project Alpha', 'Building ready');
            expect(animations.length).toBeGreaterThan(0);
            reducedPreference = true;
            const change = new Event('change');
            Object.defineProperty(change, 'matches', { value: true });
            reducedMedia.dispatchEvent(change);
            expect(animations.every(animation => animation.cancel.mock.calls.length > 0)).toBe(true);
            expect(element.querySelector('.ssm-root')?.classList.contains('ssm-reduced-motion')).toBe(true);
        } finally {
            if (previous) Object.defineProperty(Element.prototype, 'animate', previous);
            else delete (Element.prototype as any).animate;
        }
    });

    it.each(['project', 'equipmentId', 'nodeDetail'])('guides incremental binding when %s is dropped first', firstRole => {
        const full = tableFixture(standardRows());
        const updateFields = (roles: string[]) => {
            const indexes = full.table!.columns.flatMap((column, index) => roles.some(role => column.roles?.[role]) ? [index] : []);
            const columns = indexes.map(index => full.table!.columns[index]);
            updateVisual({ dataViews: [{
                metadata: { columns, objects: { navigation: { initialExpanded: true } } },
                table: { ...full.table!, columns, rows: full.table!.rows!.map(row => indexes.map(index => row[index])) },
            }], viewport: { width: 1280, height: 720 }, type: 2 } as never);
        };
        updateFields([firstRole]);
        const empty = element.querySelector<HTMLElement>('[data-empty]')!;
        expect(empty.hidden).toBe(false);
        expect(empty.textContent).toContain(firstRole === 'project' ? 'Add Equipment ID' : 'Add Project');
        expect(element.querySelectorAll('.ssm-node')).toHaveLength(0);
        updateFields([firstRole, 'project', 'equipmentId']);
        expect(empty.hidden).toBe(true);
        expect(node('Project Alpha', 'EQ-001')).toBeTruthy();
        updateFields([firstRole]);
        expect(empty.hidden).toBe(false);
        expect(element.querySelectorAll('.ssm-node')).toHaveLength(0);
        expect(hostState.calls.renderFailures).toEqual([]);
    });

    it('renders project groups and deduplicated physical equipment totals', () => {
        render();
        expect(element.textContent).toContain('Project Alpha');
        expect(element.textContent).toContain('Project Beta');
        expect(element.querySelector('.ssm-counts')?.textContent).toMatch(/13/);
        expect(node('Project Alpha', 'EQ-001').getAttribute('data-node')).not.toBe(node('Project Beta', 'EQ-001').getAttribute('data-node'));
    });

    it('keeps local inspection separate from report selection and passes the model row identity explicitly', async () => {
        render();
        clickNode();
        expect(element.querySelector('.ssm-drawer')?.textContent).toContain('Supply duct');
        expect(hostState.calls.selections).toEqual([]);
        action('select-report').click();
        await Promise.resolve();
        expect(hostState.calls.selections).toHaveLength(1);
        expect(hostState.calls.selections[0].keys.join('|')).toContain('Project Alpha:EQ-002:1');
    });

    it.each(['select-report', 'clear-report'])('does not render detached UI when %s completes after destroy', async actionName => {
        render(); clickNode();
        if (actionName === 'clear-report') { action('select-report').click(); await Promise.resolve(); }
        action(actionName).click();
        visual.destroy();
        await Promise.resolve(); await Promise.resolve();
        expect(element.querySelector('.ssm-root')).toBeNull();
        expect(hostState.calls.renderFailures).toEqual([]);
        reducedPreference = true;
        expect(() => reducedMedia.dispatchEvent(new Event('change'))).not.toThrow();
    });

    it('passes native context-menu the right project equipment identity', () => {
        render();
        node('Project Beta', 'EQ-001').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 124, clientY: 85 }));
        expect(hostState.calls.contexts).toHaveLength(1);
        expect(hostState.calls.contexts[0].key).toContain('Project Beta:EQ-001:10');
        expect(hostState.calls.contexts[0].position).toEqual({ x: 124, y: 85 });
    });

    it('preserves native row identities and the selected physical node across delta segments', async () => {
        const rows = standardRows();
        const objects = { navigation: { initialExpanded: true } };
        updateVisual({ dataViews: [tableFixture(rows.slice(0, 8), objects, true)], viewport: { width: 1280, height: 720 }, type: 2, operationKind: 0 } as never);
        clickNode();
        updateVisual({ dataViews: [tableFixture(rows.slice(8), objects, false, 8)], viewport: { width: 1280, height: 720 }, type: 2, operationKind: 2 } as never);
        expect(element.querySelector('.ssm-drawer')?.textContent).toContain('Supply duct');
        expect(Array.from((visual as any).graph.nodes.values()).filter((node: any) => node.kind === 'equipment')).toHaveLength(13);
        action('select-report').click();
        await Promise.resolve();
        expect(hostState.calls.selections[0].keys).toEqual(expect.arrayContaining(['table:Project Alpha:EQ-002:1', 'table:Project Alpha:EQ-002:8']));
        expect(hostState.calls.selections[0].keys).toHaveLength(2);
        action('fit').click(); flushFrames();
        node('Project Beta', 'EQ-001').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 124, clientY: 85 }));
        expect(hostState.calls.contexts[0].key).toBe('table:Project Beta:EQ-001:10');
        expect(hostState.calls.renderFailures).toEqual([]);
    });

    it('does not double ingestion or native identities when the host appends a cumulative table', async () => {
        const rows = standardRows();
        const objects = { navigation: { initialExpanded: true } };
        updateVisual({ dataViews: [tableFixture(rows.slice(0, 8), objects, true)], viewport: { width: 1280, height: 720 }, type: 2, operationKind: 0 } as never);
        updateVisual({ dataViews: [tableFixture(rows, objects)], viewport: { width: 1280, height: 720 }, type: 2, operationKind: 1 } as never);
        expect(Array.from((visual as any).graph.nodes.values()).filter((node: any) => node.kind === 'equipment')).toHaveLength(13);
        clickNode();
        action('select-report').click();
        await Promise.resolve();
        expect(hostState.calls.selections[0].keys).toHaveLength(2);
        expect(hostState.calls.selections[0].keys).toEqual(expect.arrayContaining(['table:Project Alpha:EQ-002:1', 'table:Project Alpha:EQ-002:8']));
    });

    it('renders author metadata as text and preserves scalar values across repeated membership rows', () => {
        render();
        clickNode('Project Alpha', 'EQ-003');
        const drawer = element.querySelector('.ssm-drawer')!;
        expect(drawer.textContent).toContain('<img src=x');
        expect(drawer.querySelector('img')).toBeNull();
        expect((window as any).__unsafe).toBeUndefined();
        clickNode();
        expect(element.querySelector('.ssm-drawer')?.textContent).toContain('A. Patel');
        expect(element.querySelector('.ssm-drawer')?.textContent).not.toContain('40%');
    });

    it('closes the inspector with Escape and restores node focus', () => {
        render();
        const selected = node('Project Alpha', 'EQ-001');
        selected.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(element.querySelector<HTMLElement>('.ssm-drawer')?.hidden).toBe(false);
        selected.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(element.querySelector<HTMLElement>('.ssm-drawer')?.hidden).toBe(true);
        expect(document.activeElement?.getAttribute('data-node')).toBe(selected.getAttribute('data-node'));
    });

    it('preserves the camera and compatible selection on metadata refresh and clears stale details on removal', () => {
        const rows = standardRows();
        render(rows);
        clickNode();
        const transform = element.querySelector<HTMLElement>('.ssm-world')?.style.transform;
        expect(transform).toBeTruthy();
        render(rows.map(row => ({ ...row, owner: 'Updated coordinator' })));
        expect(element.querySelector<HTMLElement>('.ssm-world')?.style.transform).toBe(transform);
        expect(element.querySelector('.ssm-drawer')?.textContent).toContain('Updated coordinator');
        render(rows.filter(row => !(row.project === 'Project Alpha' && row.equipmentId === 'EQ-002')));
        expect(element.querySelector('.ssm-drawer')?.textContent ?? '').not.toContain('Supply duct');
    });

    it('distinguishes missing bindings, no rows, and an incomplete supplied dataset', () => {
        updateVisual({ dataViews: [], viewport: { width: 600, height: 400 }, type: 2 } as never);
        expect(element.textContent).toMatch(/bind|add|project|field/i);
        render([]);
        expect(element.textContent).toMatch(/no (source )?data|no rows|empty/i);
        updateVisual({ dataViews: [tableFixture(standardRows(), undefined, true)], viewport: { width: 600, height: 400 }, type: 2 } as never);
        expect(element.querySelector('.ssm-loading-phase')?.textContent).toBe('Loading');
        expect(element.querySelector('.ssm-loading-count')?.textContent).toBe('15 rows');
    });

    it('does not advertise native report selection for generated milestone nodes', () => {
        render();
        const milestone = Array.from(element.querySelectorAll<SVGElement>('.ssm-node')).find(candidate => candidate.textContent?.includes('Mechanical completion') && !candidate.getAttribute('data-node')?.includes('EQ-'));
        expect(milestone).toBeTruthy();
        milestone!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(element.querySelector('[data-action="select-report"]')).toBeNull();
        milestone!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
        expect(hostState.calls.contexts).toEqual([]);
    });

    it('honors author field visibility, labels, order, and formatting by stable model identifiers', () => {
        const dataView = tableFixture(standardRows(), { navigation: { initialExpanded: true } });
        const owner = dataView.table!.columns.find(column => column.queryName === 'SyntheticRegistry.owner')!;
        const progress = dataView.table!.columns.find(column => column.queryName === 'SyntheticRegistry.progress')!;
        const notes = dataView.table!.columns.find(column => column.queryName === 'SyntheticRegistry.notes')!;
        owner.objects = { detailEquipment: { label: 'Accountable lead', order: 1 } };
        progress.objects = { detailEquipment: { label: 'Completion fraction', order: 0, format: 'decimal' } };
        notes.objects = { detailEquipment: { visible: false } };
        updateVisual({ dataViews: [dataView], viewport: { width: 1280, height: 720 }, type: 2 } as never);
        clickNode('Project Alpha', 'EQ-003');
        const text = element.querySelector('.ssm-drawer')!.textContent!;
        expect(text).toContain('Accountable lead');
        expect(text).toContain('Completion fraction');
        expect(text.indexOf('Completion fraction')).toBeLessThan(text.indexOf('Accountable lead'));
        expect(text).not.toContain('<img src=x');
        const formatting = JSON.stringify(visual.getFormattingModel());
        expect(formatting).toContain('SyntheticRegistry.owner');
        expect(element.querySelector('.ssm-drawer select')).toBeNull();
    });

    it('clears an incompatible milestone scope before switching projects', () => {
        render();
        const milestone = element.querySelector<HTMLSelectElement>('[data-filter="l1"]')!;
        milestone.value = JSON.stringify(['l1', 'Project Alpha', 'Building ready']);
        milestone.dispatchEvent(new Event('change', { bubbles: true }));
        const project = element.querySelector<HTMLInputElement>('[data-project="Project Alpha"]')!;
        project.checked = false;
        project.dispatchEvent(new Event('change', { bubbles: true }));
        expect(element.querySelector<HTMLSelectElement>('[data-filter="l1"]')!.value).toBe('');
        expect(element.querySelector('.ssm-counts')?.textContent).toMatch(/4 direct/);
        expect(node('Project Beta', 'EQ-001')).toBeTruthy();
    });

    it('reveals a search target beyond the initial rendering limit without losing the graph bounds', async () => {
        render(wideRows());
        expect(element.querySelectorAll('.ssm-node').length).toBeLessThanOrEqual(300);
        const search = element.querySelector<HTMLInputElement>('[data-search]')!;
        search.value = 'WIDE-0299';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 140));
        const result = Array.from(element.querySelectorAll<HTMLElement>('.ssm-search-result')).find(candidate => candidate.textContent?.includes('Project Beta'))!;
        expect(result).toBeTruthy();
        result.click();
        flushFrames();
        expect(node('Project Beta', 'WIDE-0299').classList.contains('is-selected')).toBe(true);
        expect(element.querySelector('.ssm-drawer')?.textContent).toContain('Equipment 600');
        expect(element.querySelectorAll('.ssm-node').length).toBeLessThanOrEqual(300);
        expect(element.querySelector<HTMLElement>('.ssm-world')?.style.transform).toMatch(/scale\(/);
    });

    it('honors hidden connection sections while keeping the node overview available', () => {
        render(standardRows(), 1280, 720, { drawer: { showRelations: false } });
        clickNode();
        expect(element.querySelector('.ssm-drawer')?.textContent).toContain('A. Patel');
        expect(element.querySelector('[data-action="tab-connections"]')).toBeNull();
    });

    it('uses the model percent format and preserves a date-only calendar value', () => {
        render();
        clickNode();
        const rows = Array.from(element.querySelectorAll('.ssm-detail-row'));
        const progress = rows.find(row => row.querySelector('dt')?.textContent === 'Progress');
        const due = rows.find(row => row.querySelector('dt')?.textContent === 'Due date');
        expect(progress?.querySelector('dd')?.textContent).toBe('20.0%');
        expect(due?.querySelector('dd')?.textContent).toBe('11/2/2026');
    });

    it('enables the canvas Focus selected action immediately after local selection', () => {
        render();
        expect((action('focus') as HTMLButtonElement).disabled).toBe(true);
        clickNode();
        expect((action('focus') as HTMLButtonElement).disabled).toBe(false);
        const before = element.querySelector<HTMLElement>('.ssm-world')?.style.transform;
        action('focus').click();
        expect(element.querySelector<HTMLElement>('.ssm-world')?.style.transform).not.toBe(before);
    });

    it('updates the overview highlight when local selection changes without a new layout', () => {
        render();
        action('zoom-in').click(); action('zoom-in').click(); flushFrames();
        clickNode('Project Alpha', 'EQ-002');
        clickNode('Project Alpha', 'EQ-001');
        const selected = node('Project Alpha', 'EQ-001') as unknown as HTMLElement;
        const active = element.querySelector('.ssm-minimap rect.node.active');
        expect(active).toBeTruthy();
        expect(Number(active!.getAttribute('x'))).toBe(parseFloat(selected.style.left));
        expect(Number(active!.getAttribute('y'))).toBe(parseFloat(selected.style.top));
    });

    it('retries a partial replacement dataset after the host stopped a prior request', async () => {
        vi.useFakeTimers();
        try {
        let data = tableFixture(standardRows(), undefined, true);
        const update = (type: number) => updateVisual({ dataViews: [data], viewport: { width: 1280, height: 720 }, type, operationKind: 0 } as never);
        update(2);
        await vi.advanceTimersByTimeAsync(50);
        expect(hostState.calls.fetches).toBe(1);
        expect(element.querySelector('[data-delivery]')?.textContent).toMatch(/Stopped/i);
        update(4); // Resize must not restart a stopped host query.
        await vi.advanceTimersByTimeAsync(50);
        expect(hostState.calls.fetches).toBe(1);
        data = tableFixture(standardRows(), undefined, true);
        update(2); // A new data replacement can make another host request.
        await vi.advanceTimersByTimeAsync(50);
        expect(hostState.calls.fetches).toBe(2);
        } finally { vi.useRealTimers(); }
    });
});
