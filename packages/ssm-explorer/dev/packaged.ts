import { createHarnessHost } from './host';
import { tableFixture, scalabilityRows, structuralRows, showroomRows, type SyntheticRow } from './fixtures';
import type powerbi from 'powerbi-visuals-api';
import { runScaleBenchmark } from './benchmark';

/** Smoke the actual pbiviz webpack output; never import src/visual.ts here. */
const element = document.querySelector<HTMLElement>('#visual')!;
const contrastControl = document.querySelector<HTMLInputElement>('#high-contrast')!;
const startButton = document.querySelector<HTMLButtonElement>('#delivery-start')!;
const nextButton = document.querySelector<HTMLButtonElement>('#delivery-next')!;
const deliveryStatus = document.querySelector<HTMLElement>('#delivery-status')!;
const exportAccess = document.querySelector<HTMLSelectElement>('#export-access')!;
const downloadControl = document.querySelector<HTMLInputElement>('#export-download')!;
const exportResult = document.querySelector<HTMLElement>('#export-result')!;
const totalRows = 8000, batchSize = 2000;
type DeliveryDemo = { rows: SyntheticRow[]; delivered: number; waiting: boolean };
let delivery: DeliveryDemo | null = null;
let objects: any;
let onPage = true, ready = false, benchmarking = false, hostGeneration = 0;
let echo: (() => void) | undefined;

function renderControls() {
    startButton.disabled = !ready || !onPage || benchmarking;
    nextButton.disabled = !ready || !onPage || benchmarking || !delivery?.waiting || delivery.delivered >= totalRows;
    for (const id of ['size', 'dataset', 'page', 'high-contrast', 'export-access', 'export-download']) (document.querySelector(`#${id}`) as HTMLInputElement | HTMLButtonElement | HTMLSelectElement).disabled = benchmarking;
    if (!delivery) { deliveryStatus.textContent = '8,000 synthetic rows · 2,000 per batch'; return; }
    const progress = `${delivery.delivered.toLocaleString()}/${totalRows.toLocaleString()} synthetic rows supplied`;
    deliveryStatus.textContent = delivery.delivered === totalRows ? `${progress} · Complete`
        : delivery.waiting ? `${progress} · Waiting for Deliver next batch`
        : `${progress} · Choose projects in the visual; delivery waits for its next request`;
}

const makeHost = () => {
    const generation = ++hostGeneration;
    const mock = createHarnessHost(contrastControl.checked, value => {
        if (generation !== hostGeneration) return;
        for (const merge of value.merge ?? []) objects = { ...objects, [merge.objectName]: { ...objects?.[merge.objectName], ...merge.properties } };
        queueMicrotask(() => { if (generation === hostGeneration && onPage && !benchmarking) echo?.(); });
    }, {
        downloadStatus: Number(exportAccess.value) as powerbi.PrivilegeStatus,
        browserDownloads: () => downloadControl.checked,
        onDownload: download => {
            if (generation !== hostGeneration) return;
            exportResult.textContent = download.downloadCompleted
                ? `${download.fileName} · ${download.browserDownload ? 'Download requested' : 'Captured without download'} · ${download.content.length.toLocaleString()} payload characters`
                : `Export did not complete${download.error ? `: ${download.error}` : ''}`;
        },
    });
    mock.host.fetchMoreData = () => {
        mock.calls.fetches++;
        if (generation !== hostGeneration || !onPage || !delivery || delivery.delivered >= totalRows) return false;
        delivery.waiting = true; renderControls();
        return true; // The accepted host request finishes only when the user delivers a batch.
    };
    return mock;
};
let state = makeHost();
const script = document.createElement('script');
script.src = '/visual.js';
script.onload = () => {
    try {
        const plugin = (window as any).ssmExplorer_91E8C42DA6B7.default;
        let latest: any;
        const createVisual = () => {
            const instance = plugin.create({ element, host: state.host });
            const updateCompiled = instance.update.bind(instance);
            // Capture actual incoming windows, including benchmark calls made directly to Visual.update.
            // This does not replace the renderer or transform its rows.
            instance.update = (options: any) => {
                if (options.dataViews?.[0]) latest = { ...options, dataViews: [options.dataViews[0]], operationKind: options.operationKind ?? 0 };
                updateCompiled(options);
            };
            return instance;
        };
        let visual = createVisual();
        let rows = showroomRows();
        const viewport = (dimensions: number[] = []) => {
            const [width, height] = dimensions.length ? dimensions : document.querySelector<HTMLSelectElement>('#size')!.value.split('x').map(Number);
            element.style.width = `${width}px`; element.style.height = `${height}px`;
            return { width, height };
        };
        const replayLatest = (type: number, dimensions: number[] = []) => {
            if (!onPage || !latest) return;
            const data = latest.dataViews[0];
            visual.update({ ...latest, dataViews: [{ ...data, metadata: { ...data.metadata, objects } }], viewport: viewport(dimensions), type });
        };
        const update = (...dimensions: number[]) => {
            if (!onPage) return;
            if (latest) replayLatest(dimensions.length ? 4 : 16, dimensions);
            else visual.update({ dataViews: [tableFixture(rows, objects)], viewport: viewport(dimensions), type: 2, operationKind: 0 });
        };
        const leaveDelivery = () => { delivery = null; renderControls(); };
        const bindRows = (next: SyntheticRow[], nextObjects: any) => {
            leaveDelivery(); rows = next; objects = nextObjects; latest = undefined; update();
        };
        const recreate = () => {
            visual.destroy(); state = makeHost(); visual = createVisual();
        };
        const selectedRows = () => document.querySelector<HTMLSelectElement>('#dataset')!.value === 'structural' ? structuralRows() : showroomRows();
        const deliverBatch = (first = false) => {
            if (!onPage || !delivery || delivery.delivered >= totalRows || (!first && !delivery.waiting)) return;
            const offset = delivery.delivered, end = Math.min(totalRows, offset + batchSize);
            rows = delivery.rows.slice(offset, end);
            delivery.delivered = end; delivery.waiting = false;
            const data = tableFixture(rows, objects, end < totalRows, offset);
            // Delta-only window: omit lastMergeIndex because no row overlaps.
            visual.update({ dataViews: [data], viewport: viewport(), type: 2, operationKind: first ? 0 : 2 });
            renderControls();
        };
        const startDelivery = () => {
            if (!ready || !onPage || benchmarking) return;
            objects = undefined; latest = undefined;
            delivery = { rows: scalabilityRows(totalRows), delivered: 0, waiting: false };
            recreate(); deliverBatch(true);
        };
        const setHighContrast = (enabled: boolean) => {
            contrastControl.checked = enabled;
            if (delivery) { startDelivery(); return; }
            if (!onPage) { state = makeHost(); return; }
            recreate();
            // A new instance needs Create, even when the old instance's latest payload was a segment.
            if (latest) replayLatest(2); else update();
        };
        const benchmark = async (size: number) => {
            leaveDelivery(); benchmarking = true; renderControls();
            try { return await runScaleBenchmark(size); }
            finally { benchmarking = false; renderControls(); }
        };
        (window as any).__ssm = {
            get visual() { return visual; }, get calls() { return state.calls; }, update,
            get delivery() { return delivery ? { total: totalRows, batchSize, delivered: delivery.delivered, waiting: delivery.waiting } : null; },
            get latestOperationKind() { return latest?.operationKind; },
            setScale: (size: number) => bindRows(scalabilityRows(size), objects),
            setStructural: (wide = 80) => bindRows(structuralRows(wide), objects),
            setShowroom: () => bindRows(showroomRows(), objects),
            setRows: (next: SyntheticRow[], nextObjects?: any) => bindRows(next, nextObjects),
            setObjects: (next: any) => { objects = next; update(); },
            setHighContrast,
            setDownloadStatus: (status: powerbi.PrivilegeStatus) => { exportAccess.value = String(status); state.setDownloadStatus(status); },
            resetVisual: () => {
                if (delivery) { leaveDelivery(); rows = selectedRows(); objects = undefined; }
                latest = undefined; recreate();
            },
            startDelivery, deliverNextBatch: () => deliverBatch(),
            benchmark, productionBundle: script.src,
        };
        // Power BI property echoes resend the latest real window with new metadata objects.
        // In delivery mode this remains the last2k segment, never the accumulated table.
        echo = () => replayLatest(2);
        document.querySelector('#size')!.addEventListener('change', () => update(...document.querySelector<HTMLSelectElement>('#size')!.value.split('x').map(Number)));
        document.querySelector('#dataset')!.addEventListener('change', () => {
            leaveDelivery(); rows = selectedRows(); objects = undefined; latest = undefined; recreate(); update();
        });
        contrastControl.addEventListener('change', () => setHighContrast(contrastControl.checked));
        exportAccess.addEventListener('change', () => {
            state.setDownloadStatus(Number(exportAccess.value) as powerbi.PrivilegeStatus);
            exportResult.textContent = 'Mock export access changed; use Export workbook in an L2 details drawer.';
        });
        startButton.addEventListener('click', startDelivery);
        nextButton.addEventListener('click', () => deliverBatch());
        document.querySelector('#page')!.addEventListener('click', event => {
            if (onPage) {
                if (delivery) { leaveDelivery(); rows = selectedRows(); objects = undefined; latest = undefined; }
                visual.destroy(); onPage = false; element.hidden = true;
            } else { onPage = true; element.hidden = false; recreate(); if (latest) replayLatest(2); else update(); }
            (event.target as HTMLButtonElement).textContent = onPage ? 'Leave report page' : 'Return to report page'; renderControls();
        });
        document.querySelector('#benchmark')!.addEventListener('click', async event => {
            const button = event.target as HTMLButtonElement, output = document.querySelector<HTMLElement>('#benchmark-result')!;
            button.disabled = true; output.hidden = false; output.textContent = 'Running synthetic scale benchmark…';
            try { output.textContent = JSON.stringify(await benchmark(100000), null, 2); }
            catch (error) { output.textContent = String(error); }
            finally { button.disabled = false; }
        });
        ready = true; update(); renderControls();
        document.querySelector('#status')!.textContent = 'Compiled production bundle · synthetic data';
    } catch (error) {
        document.querySelector('#status')!.textContent = `Bundle smoke failed: ${String(error)}`;
    }
};
script.onerror = () => { document.querySelector('#status')!.textContent = 'Build the pbiviz package before loading this harness.'; };
document.head.append(script);
