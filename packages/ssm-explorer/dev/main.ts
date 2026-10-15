import { SsmExplorerVisual } from '../src/visual';
import { standardRows, tableFixture, wideRows, scalabilityRows, hierarchyRows, structuralRows, showroomRows, type SyntheticRow } from '../src/__tests__/fixtures';
import { createHarnessHost } from './host';
import { runScaleBenchmark } from './benchmark';

const element = document.querySelector<HTMLElement>('#visual')!;
const sizeControl = document.querySelector<HTMLSelectElement>('#size')!;
const datasetControl = document.querySelector<HTMLSelectElement>('#dataset')!;
const contrastControl = document.querySelector<HTMLInputElement>('#high-contrast')!;
let hostState = createHarnessHost();
let visual = new SsmExplorerVisual({ element, host: hostState.host } as never);
let rows: SyntheticRow[] = standardRows();
let metadataRefresh = 0;
let objects: any;

function update() {
    const [width, height] = sizeControl.value.split('x').map(Number);
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    const start = performance.now();
    visual.update({
        dataViews: [tableFixture(rows, objects, datasetControl.value === 'partial')],
        viewport: { width, height }, type: 2, operationKind: 0,
    } as never);
    (window as any).__ssm.lastUpdateMs = performance.now() - start;
}

(window as any).__ssm = {
    get visual() { return visual; },
    get element() { return element; },
    get calls() { return hostState.calls; },
    get rows() { return rows; },
    setRows(next: SyntheticRow[]) { rows = next; update(); },
    setScale(size: number) { rows = scalabilityRows(size); update(); },
    setHierarchy(milestones = 240, equipment = 3) { rows = hierarchyRows(milestones, equipment); update(); },
    setStructural(wide = 80) { rows = structuralRows(wide); update(); },
    setShowroom() { rows = showroomRows(); update(); },
    setObjects(next: any) { objects = next; update(); },
    resetVisual() {
        visual.destroy();
        hostState = createHarnessHost(contrastControl.checked);
        visual = new SsmExplorerVisual({ element, host: hostState.host } as never);
    },
    refresh() {
        metadataRefresh++;
        rows = rows.map(row => ({ ...row, owner: `${row.owner ?? 'Team'} · refresh ${metadataRefresh}` }));
        update();
    },
    update,
    benchmark: runScaleBenchmark,
};
sizeControl.addEventListener('change', update);
datasetControl.addEventListener('change', () => {
    rows = datasetControl.value === 'empty' ? [] : datasetControl.value === 'wide' ? wideRows() : datasetControl.value === 'hierarchy' ? hierarchyRows() : datasetControl.value === 'structural' ? structuralRows() : datasetControl.value === 'showroom' ? showroomRows() : /^scale-/.test(datasetControl.value) ? scalabilityRows(Number(datasetControl.value.slice(6))) : standardRows();
    update();
});
contrastControl.addEventListener('change', () => {
    visual.destroy();
    hostState = createHarnessHost(contrastControl.checked);
    visual = new SsmExplorerVisual({ element, host: hostState.host } as never);
    update();
});
document.querySelector('#refresh')!.addEventListener('click', () => (window as any).__ssm.refresh());
update();
