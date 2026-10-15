import { scalabilityRows, tableFixture } from '../src/__tests__/fixtures';

const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
const ready = async () => { await frame(); await frame(); };
const nodeKey = (kind: string, project: string, id: string) => JSON.stringify([kind, project, id]);
const byKey = (selector: string, key: string) => Array.from(document.querySelectorAll<HTMLElement>(selector)).find(element => element.dataset.node === key || element.dataset.target === key);

/** Runs only on explicit invocation against the actual Visual already created by main.ts.
 * Generation/table construction are timed separately from Visual ingestion. Timings are
 * browser observations, not Power BI Desktop, report security, or cross-machine guarantees.
 */
export async function runScaleBenchmark(size: number) {
    const harness = (window as any).__ssm;
    const timings: Record<string, number> = {};
    const failures: string[] = [];
    const longTasks: number[] = [];
    let observer: PerformanceObserver | undefined;
    const longTaskObserverAvailable = PerformanceObserver.supportedEntryTypes?.includes('longtask') ?? false;
    if (longTaskObserverAvailable) {
        observer = new PerformanceObserver(list => list.getEntries().forEach(entry => longTasks.push(entry.duration)));
        observer.observe({ type: 'longtask', buffered: false });
    }
    const require = (condition: unknown, message: string) => { if (!condition) failures.push(message); };
    let started = performance.now();
    const rows = scalabilityRows(size);
    timings.generationMs = performance.now() - started;
    started = performance.now();
    const dataView = tableFixture(rows);
    timings.tableConstructionMs = performance.now() - started;
    started = performance.now();
    harness.resetVisual?.();
    timings.visualConstructionMs = performance.now() - started;
    const operationStarted = performance.now();
    harness.visual.update({ dataViews: [dataView], viewport: { width: 1280, height: 720 }, type: 2, operationKind: 0 });
    timings.ingestSynchronousMs = performance.now() - operationStarted;
    await ready();
    timings.ingestReadyMs = performance.now() - operationStarted;
    // Startup deliberately waits for a project choice before showing the hierarchy.
    require(!document.querySelector('.ssm-node'), 'Startup displayed nodes before project selection');
    document.querySelector<HTMLButtonElement>('[data-action="projects-all"]')?.click(); await ready();
    const graph = harness.visual.graph;
    const equipmentCount = Array.from(graph.nodes.values()).filter((node: any) => node.kind === 'equipment').length;
    const startupNodes = document.querySelectorAll('.ssm-node').length;
    require(equipmentCount === size, `Expected ${size} loaded equipment, received ${equipmentCount}`);
    require(!document.querySelector('.ssm-node:not(.l1)'), 'Startup rendered L2/equipment/header/reference before an L1 expansion');
    require(startupNodes <= 300, 'Startup exceeds default DOM budget');
    const parent = document.querySelector<HTMLElement>('.ssm-node.l1');
    require(parent, 'No parent milestone is reachable in the startup viewport');
    started = performance.now();
    parent?.click();
    timings.parentExpansionSynchronousMs = performance.now() - started;
    await ready();
    timings.parentExpansionReadyMs = performance.now() - started;
    const parentExpandedNodes = document.querySelectorAll('.ssm-node').length;
    require(!document.querySelector('.ssm-node.equipment'), 'An L1 click exposed equipment before an L2 expansion');
    require(parentExpandedNodes <= 300, 'L1 expansion exceeds default DOM budget');
    // A large overview can legitimately cull off-screen project columns.
    // Expand a visible supplied milestone rather than assuming Alpha is on screen.
    const milestone = document.querySelector<HTMLElement>('.ssm-node.l2');
    require(milestone, 'No milestone is reachable in the startup viewport');
    const milestoneIdentity = milestone?.dataset.node ? JSON.parse(milestone.dataset.node) as string[] : [];
    const expandedBranch = { project: milestoneIdentity[1], milestone: milestoneIdentity[2] };
    started = performance.now();
    milestone?.click();
    timings.expansionSynchronousMs = performance.now() - started;
    await ready();
    timings.expansionReadyMs = performance.now() - started;
    const expansionNodes = document.querySelectorAll('.ssm-node').length;
    require(expansionNodes <= 300, 'Expansion exceeds default DOM budget');
    require(!!document.querySelector('.ssm-node.equipment'), 'Milestone click did not expose equipment');
    const branchStart = (Number(expandedBranch.milestone?.split(' ')[1]) - 1) * 1000;
    const hub = byKey('.ssm-node.equipment', nodeKey('equipment', expandedBranch.project, `SCALE-${String(branchStart).padStart(6, '0')}`));
    if (hub) {
        const children = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action="equipment-children"]')).find(button => button.dataset.source === hub.dataset.occurrence);
        require(children, 'The large equipment root does not expose its direct children');
        started = performance.now(); children?.click();
        timings.equipmentChildrenExpansionSynchronousMs = performance.now() - started; await ready();
        timings.equipmentChildrenExpansionReadyMs = performance.now() - started;
        require(document.querySelectorAll('.ssm-node').length <= 300, 'Equipment child expansion exceeds the occurrence cap');
        started = performance.now();
        hub.click();
        document.querySelector<HTMLButtonElement>('[data-action="tab-connections"]')?.click();
        timings.denseConnectionsSynchronousMs = performance.now() - started;
        await ready();
        timings.denseConnectionsReadyMs = performance.now() - started;
        require(document.querySelectorAll('.ssm-connection').length <= 300, 'Dense hub connections drawer exceeds 300 entries');
        document.querySelector<HTMLButtonElement>('[data-action="tab-overview"]')?.click();
        const quick = byKey('[data-action="quick-dependencies"]', hub.dataset.node!);
        started = performance.now(); quick?.click();
        timings.quickHubDependenciesSynchronousMs = performance.now() - started; await ready();
        require(!!document.querySelector('[data-dependency-panel]'), 'Dense hub quick dependency panel did not open');
        started = performance.now(); document.querySelector<HTMLButtonElement>('[data-action="dependencies-in"]')?.click();
        timings.quickHubRequiredBySynchronousMs = performance.now() - started; await ready();
        timings.quickHubRequiredByReadyMs = performance.now() - started;
        const incoming = document.querySelector('[data-action="dependencies-in"]')?.textContent;
        require(Number(incoming?.match(/\d+/)?.[0]) > 0, 'Dense hub should expose direct consumers in Required by');
        require(document.querySelectorAll('.ssm-node.is-dependency-row').length <= 5, 'Quick dependencies exceeded five inline target rows');
        require(document.querySelectorAll('.ssm-node').length <= 300, 'Quick hub dependencies exceeded the occurrence cap');
        document.querySelector<HTMLButtonElement>('[data-action="dependencies-close"]')?.click(); await ready();
    } else failures.push('Dense hub was not available after first branch expansion');
    const perProject = Math.ceil(size / 4);
    const targetId = `SCALE-${String(size - 3 * perProject - 1).padStart(6, '0')}`;
    const targetKey = nodeKey('equipment', 'Scale Delta', targetId);
    const search = document.querySelector<HTMLInputElement>('[data-search]')!;
    started = performance.now();
    search.value = targetId;
    search.dispatchEvent(new Event('input', { bubbles: true }));
    while (!byKey('.ssm-search-result', targetKey) && performance.now() - started < 2500) await frame();
    timings.searchResultsMs = performance.now() - started;
    const result = byKey('.ssm-search-result', targetKey);
    require(result, 'Search did not distinguish the final Delta equipment');
    started = performance.now();
    result?.click();
    timings.searchRevealSynchronousMs = performance.now() - started;
    await ready();
    timings.searchRevealReadyMs = performance.now() - started;
    const target = byKey('.ssm-node', targetKey);
    require(target?.classList.contains('is-selected'), 'Final Delta equipment is not selected/rendered after search');
    require(document.querySelectorAll('.ssm-node').length <= 300, 'Search reveal exceeds default DOM budget');
    document.querySelector<HTMLButtonElement>('[data-action="highlight"]')?.click();
    const valueKey = JSON.stringify(['string', rows[size - 1].discipline]);
    const highlight = Array.from(document.querySelectorAll<HTMLInputElement>('[data-highlight-value]')).find(input => input.dataset.highlightValue === valueKey);
    require(highlight, 'The final equipment discipline is absent from the viewer highlight values');
    started = performance.now();
    if (highlight) { highlight.checked = true; highlight.dispatchEvent(new Event('change', { bubbles: true })); }
    timings.highlightSelectSynchronousMs = performance.now() - started; await ready();
    timings.highlightSelectReadyMs = performance.now() - started;
    require(byKey('.ssm-node', targetKey)?.classList.contains('is-highlight-match'), 'Highlight does not match the final source equipment');
    require(document.querySelectorAll('.ssm-node').length <= 300, 'Highlight selection exceeds the occurrence cap');
    document.querySelector<HTMLButtonElement>('[data-action="highlight-close"]')?.click();
    const quickTarget = byKey('[data-action="quick-dependencies"]', targetKey);
    started = performance.now(); quickTarget?.click();
    timings.quickDependenciesSynchronousMs = performance.now() - started; await ready();
    timings.quickDependenciesReadyMs = performance.now() - started;
    require(document.querySelector('[data-action="dependencies-out"]')?.textContent === 'Dependencies 4', 'Final equipment direct prerequisite count should be four');
    require(document.querySelectorAll('.ssm-node.is-dependency-row').length <= 5, 'Final target quick prerequisite rows exceeded the page budget');
    require(document.querySelectorAll('.ssm-node').length <= 300, 'Final target quick prerequisites exceeded the occurrence cap');
    document.querySelector<HTMLButtonElement>('[data-action="dependencies-close"]')?.click(); await ready();
    const reportButton = document.querySelector<HTMLButtonElement>('[data-action="select-report"]');
    require(reportButton, 'Supplied final equipment lacks native report action');
    reportButton?.click();
    await Promise.resolve();
    const selection = harness.calls.selections[harness.calls.selections.length - 1];
    require(selection?.keys.some((key: string) => key.includes(`Scale Delta:${targetId}:${size - 1}`)), 'Native selection identity does not belong to the final Delta source row');
    const alternate = Array.from(document.querySelectorAll<HTMLElement>('.ssm-node.equipment')).find(element => element.dataset.node !== targetKey);
    started = performance.now();
    alternate?.click();
    timings.localSelectionSynchronousMs = performance.now() - started;
    await ready();
    timings.localSelectionReadyMs = performance.now() - started;
    const drawer = document.querySelector<HTMLElement>('.ssm-drawer')!;
    const boundsBefore = drawer.getBoundingClientRect().toJSON();
    const viewport = document.querySelector<HTMLElement>('[data-viewport]')!;
    const panSamples: number[] = [];
    for (let step = 0; step < 20; step++) {
        started = performance.now();
        viewport.dispatchEvent(new KeyboardEvent('keydown', { key: step % 2 ? 'ArrowLeft' : 'ArrowRight', bubbles: true }));
        panSamples.push(performance.now() - started);
        await frame();
    }
    timings.panMeanSynchronousMs = panSamples.reduce((total, value) => total + value, 0) / panSamples.length;
    timings.panMaxSynchronousMs = Math.max(...panSamples);
    require(JSON.stringify(boundsBefore) === JSON.stringify(drawer.getBoundingClientRect().toJSON()), 'Pan changed the fixed drawer bounds');
    require(document.querySelectorAll('.ssm-node').length <= 300, 'Pan exceeds default DOM budget');
    observer?.disconnect();
    return {
        size, boundColumns: dataView.table!.columns.length, sourceRows: dataView.table!.rows!.length,
        loadedEquipment: equipmentCount, loadedNodes: graph.nodes.size, loadedEdges: graph.edges.length,
        startupNodes, parentExpandedNodes, expansionNodes, expandedBranch, finalDomNodes: document.querySelectorAll('.ssm-node').length,
        finalSvgPaths: document.querySelectorAll('.ssm-links path').length,
        finalDomElements: document.querySelectorAll('#visual *').length,
        timings, panSamples, longTasks, longTaskObserverAvailable, failures,
        counts: document.querySelector('.ssm-counts')?.textContent,
        environment: { userAgent: navigator.userAgent, viewport: { width: 1280, height: 720 }, devicePixelRatio, hardwareConcurrency: navigator.hardwareConcurrency, powerBiHost: false },
    };
}
