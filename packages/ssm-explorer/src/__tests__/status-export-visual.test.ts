import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type powerbi from 'powerbi-visuals-api';
import { SsmExplorerVisual } from '../visual';
import { createHarnessHost } from '../../dev/host';
import { tableFixture, type SyntheticRow } from './fixtures';
import { createMilestoneWorkbook } from '../milestone-workbook';

vi.mock('../milestone-workbook', () => ({ createMilestoneWorkbook: vi.fn(async () => 'UEsDBA==') }));
let element: HTMLDivElement, visual: SsmExplorerVisual, host: ReturnType<typeof createHarnessHost>;
let frames: Map<number, FrameRequestCallback>, frame = 0;
const rows: SyntheticRow[] = [
  { project: 'Plant', parentMilestone: 'L1', milestone: 'L2', equipmentId: 'NS', status: 'Not Started' },
  { project: 'Plant', parentMilestone: 'L1', milestone: 'L2', equipmentId: 'IP', status: 'In Progress' },
  { project: 'Plant', parentMilestone: 'L1', milestone: 'L2', equipmentId: 'DONE', status: 'Completed' },
  { project: 'Plant', parentMilestone: 'L1', milestone: 'Other', equipmentId: 'HIDDEN', status: 'Completed' },
];
function flush(): void { for (let i = 0; i < 10 && frames.size; i++) { const tasks = [...frames.values()]; frames.clear(); tasks.forEach(task => task(performance.now())); } }
async function settled(): Promise<void> { for (let i = 0; i < 12; i++) { await Promise.resolve(); flush(); } }
function click(action: string): void { element.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click(); flush(); }
function node(id: string): HTMLButtonElement { return [...element.querySelectorAll<HTMLButtonElement>('.ssm-node')].find(item => JSON.parse(item.dataset.node!)[2] === id)!; }
function update(partial = false): void { visual.update({ dataViews: [tableFixture(rows, { navigation: { initialExpanded: true } }, partial)], viewport: { width: 1280, height: 720 }, operationKind: 0, type: 2 } as never); flush(); }
function chooseMilestone(): void { node('L2').click(); flush(); }

beforeEach(() => {
  frames = new Map(); vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => { const id = ++frame; frames.set(id, callback); return id; });
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
  element = document.createElement('div'); document.body.append(element); host = createHarnessHost();
  visual = new SsmExplorerVisual({ element, host: host.host } as never);
  Object.defineProperty(element.querySelector('[data-viewport]'), 'clientWidth', { value: 1280 });
  Object.defineProperty(element.querySelector('[data-viewport]'), 'clientHeight', { value: 600 });
  click('projects-all'); update();
});
afterEach(() => { if (element.querySelector('.ssm-root')) visual.destroy(); element.remove(); vi.clearAllMocks(); vi.restoreAllMocks(); });

describe('Status and milestone export in the actual visual', () => {
  it('renders each status with text and keeps it after selection, theme changes, and metadata refresh', () => {
    expect(node('NS').dataset.status).toBe('not-started'); expect(node('IP').dataset.status).toBe('in-progress'); expect(node('DONE').dataset.status).toBe('completed');
    expect(node('IP').getAttribute('aria-label')).toContain('In Progress'); expect(node('L2').hasAttribute('data-status')).toBe(false);
    node('IP').click(); flush(); expect(node('IP').querySelector('.ssm-status-badge')!.textContent).toBe('In Progress');
    expect(element.querySelector('[data-drawer]')!.textContent).toContain('Status');
    click('theme'); expect(node('IP').dataset.status).toBe('in-progress');
    update(); expect(node('IP').dataset.status).toBe('in-progress');
  });
  it('shows export only for L2 and blocks partial delivery', () => {
    node('IP').click(); flush(); expect(element.querySelector('[data-action="export-milestone"]')).toBeNull();
    chooseMilestone(); expect(element.querySelector('[data-action="export-milestone"]')).not.toBeNull();
    update(true); expect(element.querySelector<HTMLButtonElement>('[data-action="export-milestone"]')!.disabled).toBe(true);
    expect(element.querySelector('.ssm-export')!.textContent).toContain('Finish loading');
  });
  it('exports all milestone rows through the host even when the branch is collapsed', async () => {
    chooseMilestone(); click('export-milestone'); await settled();
    expect(createMilestoneWorkbook).toHaveBeenCalledOnce();
    const report = vi.mocked(createMilestoneWorkbook).mock.calls[0][0];
    expect(report.rows.map(row => row.tag).sort()).toEqual(['DONE', 'IP', 'NS']);
    expect(host.calls.downloads).toHaveLength(1); expect(host.calls.downloads[0].fileType).toBe('base64');
    expect(host.calls.downloads[0].fileName).toMatch(/\.xlsx$/);
    expect(element.querySelector('[data-notice]')!.textContent).toContain('Workbook exported');
  });
  it('honors tenant policy before building or downloading a workbook', async () => {
    vi.spyOn(host.host.downloadService, 'exportStatus').mockResolvedValue(3);
    chooseMilestone(); element.querySelector<HTMLButtonElement>('[data-action="export-milestone"]')!.focus(); click('export-milestone'); await settled();
    expect(createMilestoneWorkbook).not.toHaveBeenCalled(); expect(host.calls.downloads).toHaveLength(0);
    expect(element.querySelector('[data-notice]')!.textContent).toContain('administrator');
    expect(element.querySelector<HTMLButtonElement>('[data-action="export-milestone"]')!.disabled).toBe(false);
    expect(document.activeElement).toBe(element.querySelector('[data-action="export-milestone"]'));
  });
  it('rejects a changed query during the permission check', async () => {
    let resolve!: (value: powerbi.PrivilegeStatus) => void;
    vi.spyOn(host.host.downloadService, 'exportStatus').mockImplementation(() => new Promise<powerbi.PrivilegeStatus>(done => { resolve = done; }));
    chooseMilestone(); click('export-milestone'); update(); resolve(0); await settled();
    expect(createMilestoneWorkbook).not.toHaveBeenCalled(); expect(host.calls.downloads).toHaveLength(0);
    expect(element.querySelector('[data-notice]')!.textContent).toContain('data changed');
  });
  it('reports a cancelled download truthfully and allows retry', async () => {
    vi.spyOn(host.host.downloadService, 'exportVisualsContentExtended').mockResolvedValue({ downloadCompleted: false });
    chooseMilestone(); click('export-milestone'); await settled();
    expect(element.querySelector('[data-notice]')!.textContent).toContain('cancelled');
    expect(element.querySelector<HTMLButtonElement>('[data-action="export-milestone"]')!.disabled).toBe(false);
  });
  it('does not export a stale snapshot if a new batch/query arrives while writing', async () => {
    let resolve!: (value: string) => void;
    vi.mocked(createMilestoneWorkbook).mockImplementationOnce(() => new Promise<string>(done => { resolve = done; }));
    chooseMilestone(); click('export-milestone'); await settled();
    update(); resolve('UEsDBA=='); await settled();
    expect(host.calls.downloads).toHaveLength(0);
    expect(element.querySelector('[data-notice]')!.textContent).toContain('data changed');
  });
  it('prevents duplicate work and stops an export when the visual is disposed', async () => {
    let resolve!: (value: string) => void;
    vi.mocked(createMilestoneWorkbook).mockImplementationOnce(() => new Promise<string>(done => { resolve = done; }));
    chooseMilestone(); click('export-milestone'); await settled(); click('export-milestone');
    expect(createMilestoneWorkbook).toHaveBeenCalledOnce();
    visual.destroy(); resolve('UEsDBA=='); await settled(); expect(host.calls.downloads).toHaveLength(0);
  });
});
