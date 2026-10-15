import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SsmExplorerVisual } from '../visual';
import { assignmentKey } from '../model';
import { createHarnessHost } from '../../dev/host';
import { tableFixture, type SyntheticRow } from './fixtures';

let visual: SsmExplorerVisual;
let v: any;
let element: HTMLDivElement;
const project = 'Grid Project';
const key = (id: string) => JSON.stringify(['equipment', project, id]);
const parentKey = JSON.stringify(['l1', project, 'Parent']);
const milestoneKey = JSON.stringify(['l2', project, 'Main']);
const cohort = assignmentKey(parentKey, milestoneKey);
const base = { project, parentMilestone: 'Parent', milestone: 'Main', nodeType: 'equipment' };

beforeEach(() => {
    // Geometry comes from the actual layout. Keep unrelated automatic camera RAFs queued.
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 1);
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => undefined);
    element = document.createElement('div'); document.body.append(element);
    visual = new SsmExplorerVisual({ element, host: createHarnessHost().host } as never); v = visual;
    // These cases exercise a deliberately chosen all-project scope.
    element.querySelector<HTMLButtonElement>('[data-action="projects-all"]')!.click();
});
afterEach(() => { visual.destroy(); element.remove(); vi.restoreAllMocks(); });

function load(rows: SyntheticRow[], width = 1280, cap = 300) {
    visual.update({ dataViews: [tableFixture(rows, { navigation: { maxVisibleNodes: cap } })], viewport: { width, height: 720 }, type: 2, operationKind: 0 } as never);
    v.expandedParents.add(parentKey); v.branchLimits.set(cohort, 30);
    Object.assign(v.camera, { x: -217, y: 83, k: .73 });
    v.layout();
}
function tree(id: string) { return v.occurrences.find((item: any) => item.node.key === key(id) && item.groupKey === cohort && item.role === 'member'); }
function open(id: string) { v.expandedEquipment.add(v.treeOccurrenceId(cohort, key(id))); v.layout(); }
function branchRows(count = 12): SyntheticRow[] {
    return [{ ...base, equipmentId: 'ROOT' }, ...Array.from({ length: count }, (_, index) => ({ ...base, equipmentId: `C-${String(index).padStart(2, '0')}`, closestParent: 'ROOT' }))];
}
function noOverlap(items: any[]) {
    for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) {
        const left = items[a], right = items[b];
        const overlaps = left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y;
        expect(overlaps, `${left.node.id}/${left.role} overlaps ${right.node.id}/${right.role}`).toBe(false);
    }
}

describe('equipment sibling group layout', () => {
    it('packs desktop siblings into three columns beneath their parent without moving the camera', () => {
        load(branchRows());
        const before = { ...v.camera };
        v.motionAnchor = { id: tree('ROOT').id, key: key('ROOT'), parentKey, x: 890, y: 990 };
        open('ROOT');
        const children = v.occurrences.filter((item: any) => item.structuralParentOccurrenceId === tree('ROOT').id);
        expect(children).toHaveLength(12);
        expect(new Set(children.map((item: any) => item.x)).size).toBe(3);
        expect(new Set(children.map((item: any) => item.y)).size).toBe(4);
        expect(children.every((item: any) => item.y >= tree('ROOT').y + tree('ROOT').height)).toBe(true);
        expect(v.camera).toEqual(before);
        noOverlap(v.occurrences);
    });

    it('reserves both expanded sibling subtrees before placing the next sibling group', () => {
        const rows = branchRows();
        for (const parent of ['C-00', 'C-05']) for (let index = 0; index < 5; index++) rows.push({ ...base, equipmentId: `${parent}-G${index}`, closestParent: parent });
        rows.push({ ...base, equipmentId: 'Z-OTHER-ROOT' });
        load(rows); open('ROOT'); open('C-00'); open('C-05');
        for (const parent of ['C-00', 'C-05']) {
            const children = v.occurrences.filter((item: any) => item.structuralParentOccurrenceId === tree(parent).id);
            expect(children).toHaveLength(5);
            expect(new Set(children.map((item: any) => item.x)).size).toBe(3);
            expect(children.every((item: any) => item.y > tree(parent).y)).toBe(true);
        }
        expect(tree('Z-OTHER-ROOT').y).toBeGreaterThan(Math.max(...v.occurrences.filter((item: any) => item.node.id.startsWith('C-')).map((item: any) => item.y + item.height)));
        noOverlap(v.occurrences);
    });

    it('uses one column at420px while keeping nested controls and card bounds disjoint', () => {
        const rows = branchRows(8); rows.push({ ...base, equipmentId: 'GRANDCHILD', closestParent: 'C-00' });
        load(rows, 420); const before = { ...v.camera }; open('ROOT'); open('C-00');
        const children = v.occurrences.filter((item: any) => item.structuralParentOccurrenceId === tree('ROOT').id);
        expect(new Set(children.map((item: any) => item.x)).size).toBe(1);
        expect(tree('GRANDCHILD').y).toBeGreaterThan(tree('C-00').y + tree('C-00').height);
        expect(v.occurrences.every((item: any) => item.x + item.width <= 420)).toBe(true);
        expect(v.camera).toEqual(before); noOverlap(v.occurrences);
    });

    it('keeps dependency lanes outside the full main grid and grids their expanded structural children', () => {
        const rows = branchRows(8); rows[0].dependencies = JSON.stringify(['DEP-PARENT', 'DEP-CHILD']);
        rows.push({ ...base, milestone: 'Other', equipmentId: 'DEP-PARENT' }, { ...base, milestone: 'Other', equipmentId: 'DEP-CHILD', closestParent: 'DEP-PARENT' });
        for (let index = 0; index < 8; index++) rows.push({ ...base, milestone: 'Other', equipmentId: `SIDE-${index}`, closestParent: 'DEP-PARENT' });
        load(rows); open('ROOT'); const before = { ...v.camera };
        v.quickDependencies = { sourceKey: key('ROOT'), occurrenceId: tree('ROOT').id, groupKey: cohort, direction: 'out', offset: 0 }; v.layout();
        const directParent = v.occurrences.find((item: any) => item.node.key === key('DEP-PARENT') && item.role === 'dependency');
        v.expandedEquipment.add(directParent.id); v.layout();
        const directChild = v.occurrences.find((item: any) => item.node.key === key('DEP-CHILD') && item.role === 'dependency');
        const sideChildren = v.occurrences.filter((item: any) => item.structuralParentOccurrenceId === directParent.id);
        const mainRight = Math.max(...v.occurrences.filter((item: any) => item.groupKey === cohort && !item.origin).map((item: any) => item.x + item.width));
        expect(v.dependencyPanels[0].x).toBeGreaterThan(mainRight);
        expect(v.dependencyPanels[0].y).toBe(tree('ROOT').y);
        expect(sideChildren).toHaveLength(9); expect(new Set(sideChildren.map((item: any) => item.x)).size).toBe(3);
        expect(sideChildren.find((item: any) => item.node.key === key('DEP-CHILD')).id).not.toBe(directChild.id);
        v.quickTrail = [{ sourceKey: key('DEP-CHILD'), occurrenceId: directChild.id, groupKey: cohort, direction: 'in', offset: 0 }]; v.layout();
        expect(v.dependencyPanels[1].x).toBeGreaterThan(Math.max(...v.occurrences.filter((item: any) => item.origin === tree('ROOT').id).map((item: any) => item.x + item.width)));
        expect(v.camera).toEqual(before); noOverlap(v.occurrences);
    });

    it('keeps a1000-deep revealed chain bounded and iterative while reserving expanded milestone bounds', () => {
        const rows: SyntheticRow[] = Array.from({ length: 1000 }, (_, index) => ({ ...base, equipmentId: `CHAIN-${index}`, ...(index ? { closestParent: `CHAIN-${index - 1}` } : {}) }));
        rows.push({ ...base, milestone: 'Z Other milestone', equipmentId: 'OTHER' });
        load(rows, 1280, 25);
        const before = { ...v.camera }, target = v.graph.nodes.get(key('CHAIN-999'));
        v.openNodeAncestors(target); v.layout();
        expect(tree('CHAIN-999')).toBeTruthy(); expect(v.occurrences.length).toBeLessThanOrEqual(25);
        const other = v.occurrences.find((item: any) => item.node.kind === 'l2' && item.node.id === 'Z Other milestone');
        const mainBottom = Math.max(...v.occurrences.filter((item: any) => item.groupKey === cohort).map((item: any) => item.y + item.height));
        expect(other.y).toBeGreaterThan(mainBottom); expect(v.camera).toEqual(before); noOverlap(v.occurrences);
    });
});
