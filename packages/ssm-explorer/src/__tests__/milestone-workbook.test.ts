import { afterEach, describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { createMilestoneWorkbook } from '../milestone-workbook';
import { buildMilestoneExport } from '../milestone-export';
import { nodeKey, parseDataView } from '../model';
import { tableFixture, type SyntheticRow } from './fixtures';
import type { MilestoneExportReport, MilestoneExportRow, MilestoneExportReference } from '../milestone-export';

function reference(tag: string, recordType: MilestoneExportReference['recordType'] = 'equipment'): MilestoneExportReference {
  return { nodeKey: JSON.stringify([recordType, 'Alpha', tag]), project: 'Alpha', tag, label: tag, recordType };
}
const l1 = reference('L1-A', 'l1'), l2 = reference('L2-A', 'l2');
function equipment(tag: string, status: MilestoneExportRow['status'] = 'in-progress', inMilestone = true): MilestoneExportRow {
  const labels = { 'not-started': 'Not Started', 'in-progress': 'In Progress', completed: 'Completed', unknown: 'Unknown status', conflict: 'Conflict' };
  return { ...reference(tag), label: `Equipment ${tag}`, inMilestone, status, statusLabel: labels[status], sourceStatus: status === 'unknown' ? ['Awaiting power'] : status === 'conflict' ? ['Completed', 'Not Started'] : [labels[status]],
    assignments: [{ l1, l2 }], reasons: [inMilestone ? 'milestone-equipment' : 'dependency'], relationSources: [{ reason: inMilestone ? 'milestone-equipment' : 'dependency', from: l2 }], immediateParents: [], dependencies: [], notes: [], reviewRequired: status === 'unknown' || status === 'conflict', reviewFlags: status === 'unknown' || status === 'conflict' ? ['Verify source status'] : [] };
}
function report(rows = [equipment('001', 'completed'), equipment('002'), equipment('003', 'unknown'), equipment('EXT-1', 'not-started', false), equipment('EXT-2', 'conflict', false)]): MilestoneExportReport {
  const count = (status: MilestoneExportRow['status']) => rows.filter(row => row.status === status).length;
  return { fileName: 'SSM.xlsx', milestone: { ...l2, label: 'Airside ready', parentMilestones: [l1] }, rows, rowCount: rows.length, reviewCount: rows.filter(row => row.reviewRequired).length,
    counts: { inMilestone: rows.filter(row => row.inMilestone).length, external: rows.filter(row => !row.inMilestone).length, notStarted: count('not-started'), inProgress: count('in-progress'), completed: count('completed'), unknown: count('unknown'), conflict: count('conflict'), excludedCompleted: 1 },
    provenance: { sourceRows: rows.length + 1, traversedNodes: rows.length + 1, allDataReceived: true, relations: [] } };
}
async function document(zip: JSZip, file: string): Promise<XMLDocument> {
  const contents = await zip.file(file)!.async('string'), parsed = new DOMParser().parseFromString(contents, 'application/xml');
  expect(parsed.querySelector('parsererror'), file).toBeNull(); return parsed;
}
const cell = (document: XMLDocument, address: string): string => document.querySelector(`c[r="${address}"]`)!.textContent!;
afterEach(() => vi.restoreAllMocks());

describe('browser-safe milestone XLSX packaging', () => {
  it('creates separate source-context worklists, distinct filters, original text identities and accurate status summaries', async () => {
    const source = report(), before = JSON.stringify(source), base64 = await createMilestoneWorkbook(source), zip = await JSZip.loadAsync(base64, { base64: true });
    const workbook = await document(zip, 'xl/workbook.xml');
    expect([...workbook.querySelectorAll('sheet')].map(sheet => sheet.getAttribute('name'))).toEqual(['Milestone equipment', 'Related equipment']);
    expect(workbook.querySelectorAll('definedName[name="_xlnm.Print_Titles"]')).toHaveLength(2);
    const main = await document(zip, 'xl/worksheets/sheet1.xml'), related = await document(zip, 'xl/worksheets/sheet2.xml');
    expect(cell(main, 'A1')).toBe('L2 milestone · Airside ready'); expect(cell(main, 'A2')).toContain('Project: Alpha · L1: L1-A · L2: L2-A');
    expect(cell(main, 'A3')).toMatch(/Exported \d{4}-\d{2}-\d{2}T.*Static source snapshot/);
    expect(cell(main, 'A6')).toContain('Report/model filters can omit records'); expect(cell(related, 'A7')).toContain('Completed outside records excluded: 1');
    expect(cell(main, 'B10')).toBe('001'); expect(main.querySelector('c[r="B10"]')!.getAttribute('t')).toBe('inlineStr');
    expect(cell(related, 'B10')).toBe('EXT-1'); expect(cell(related, 'B11')).toBe('EXT-2');
    expect([cell(main, 'B5'), cell(main, 'D5'), cell(main, 'F5'), cell(main, 'H5'), cell(main, 'J5')]).toEqual(['0', '1', '1', '1', '0']);
    expect([cell(related, 'B5'), cell(related, 'D5'), cell(related, 'F5'), cell(related, 'H5'), cell(related, 'J5')]).toEqual(['1', '0', '0', '0', '1']);
    expect(cell(main, 'J12')).toContain('Source status: Awaiting power'); expect(cell(related, 'J11')).toContain('Completed · Not Started');
    expect((await document(zip, 'xl/tables/table1.xml')).documentElement.getAttribute('ref')).toBe('A9:J12');
    expect((await document(zip, 'xl/tables/table2.xml')).querySelector('autoFilter')!.getAttribute('ref')).toBe('A9:J11');
    expect(JSON.stringify(source)).toBe(before);
  });

  it('applies restrained status styles, hidden gridlines, frozen identity/header rows and print settings', async () => {
    const zip = await JSZip.loadAsync(await createMilestoneWorkbook(report()), { base64: true });
    const sheet = await document(zip, 'xl/worksheets/sheet1.xml'), styles = await document(zip, 'xl/styles.xml');
    expect(sheet.querySelector('sheetView')!.getAttribute('showGridLines')).toBe('0');
    expect(sheet.querySelector('pane')!.getAttribute('state')).toBe('frozen');
    expect(sheet.querySelector('pane')!.getAttribute('xSplit')).toBe('2'); expect(sheet.querySelector('pane')!.getAttribute('ySplit')).toBe('9');
    expect(sheet.querySelector('pane')!.getAttribute('topLeftCell')).toBe('C10');
    expect(sheet.querySelector('pageSetup')!.getAttribute('orientation')).toBe('landscape');
    expect(sheet.querySelector('pageSetup')!.getAttribute('scale')).toBe('100'); expect(sheet.querySelector('pageSetup')!.hasAttribute('fitToWidth')).toBe(false);
    const workbook = await document(zip, 'xl/workbook.xml');
    expect(workbook.querySelector('definedName')!.textContent).toContain("'Milestone equipment'!$A:$B");
    expect(sheet.querySelectorAll('col')).toHaveLength(10);
    const fills = [...styles.querySelectorAll('fills fill')].map(fill => fill.querySelector('fgColor')?.getAttribute('rgb'));
    expect(fills).toEqual(expect.arrayContaining(['FFE5E7EB', 'FFFEF3C7', 'FFD1FAE5']));
    const formats = [...styles.querySelectorAll('cellXfs > xf')];
    expect(formats[1].getAttribute('fillId')).toBe('0'); expect(formats[1].getAttribute('borderId')).toBe('1');
    expect(styles.querySelectorAll('cellXfs alignment[wrapText="1"]').length).toBeGreaterThan(0);
    expect(sheet.querySelector('c[r="E10"]')!.getAttribute('s')).toBe('10');
  });

  it('keeps formula-looking tags literal and escapes XML controls, Unicode and SpreadsheetML escape literals', async () => {
    const row = equipment('=HYPERLINK("https://example.invalid","click")');
    row.label = 'A & B <tag> "quoted"\u0000\u0001\r\n_x0041_ 😀'; row.notes = ['Unpaired surrogate: \uD800'];
    const zip = await JSZip.loadAsync(await createMilestoneWorkbook(report([row])), { base64: true });
    const sheet = await document(zip, 'xl/worksheets/sheet1.xml'), contents = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    expect(cell(sheet, 'B10')).toBe(row.tag); expect(sheet.querySelector('c[r="B10"]')!.getAttribute('t')).toBe('inlineStr');
    expect(sheet.querySelectorAll('f')).toHaveLength(0); expect(sheet.querySelectorAll('hyperlink')).toHaveLength(0);
    expect(contents).toContain('A &amp; B &lt;tag&gt;'); expect(contents).toContain('_x0000_'); expect(contents).toContain('_x0001_'); expect(contents).toContain('_x000D_');
    expect(contents).toContain('_x005F_x0041_'); expect(contents).toContain('_xD800_'); expect(contents).toContain('😀');
    for (const entry of Object.values(zip.files)) if (!entry.dir && (entry.name.endsWith('.xml') || entry.name.endsWith('.rels'))) await document(zip, entry.name);
    for (const entry of Object.values(zip.files)) if (entry.name.endsWith('.rels')) expect(await entry.async('string')).not.toContain('TargetMode="External"');
    expect(Object.keys(zip.files).some(file => /vba|externalLinks|\.bin$/i.test(file))).toBe(false);
    expect((await document(zip, '_rels/.rels')).querySelector('Relationship[Target="docProps/core.xml"]')!.getAttribute('Type')).toBe('http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties');
  });

  it('keeps empty worklists valid and retains generic reason provenance when completed source references were omitted', async () => {
    const row = equipment('ANCESTOR', 'not-started', false); row.relationSources = []; row.reasons = ['upstream-parent'];
    const zip = await JSZip.loadAsync(await createMilestoneWorkbook(report([row])), { base64: true });
    const main = await document(zip, 'xl/worksheets/sheet1.xml'), related = await document(zip, 'xl/worksheets/sheet2.xml');
    expect(cell(main, 'A10')).toContain('No records in this worklist'); expect(main.querySelectorAll('tablePart')).toHaveLength(0);
    expect(zip.file('xl/tables/table1.xml')).toBeNull(); expect(zip.file('xl/tables/table2.xml')).not.toBeNull();
    expect(cell(related, 'I10')).toBe('Closest parent chain');
  });

  it('grows wrapped rows beyond96 points and refuses unreadable overflow instead of clipping long source notes', async () => {
    const row = equipment('WRAP'); row.label = 'word1234 '.repeat(60);
    const zip = await JSZip.loadAsync(await createMilestoneWorkbook(report([row])), { base64: true });
    const height = Number((await document(zip, 'xl/worksheets/sheet1.xml')).querySelector('row[r="10"]')!.getAttribute('ht'));
    expect(height).toBeGreaterThan(96); expect(height).toBeLessThanOrEqual(409);
    row.label = 'x'.repeat(2000);
    await expect(createMilestoneWorkbook(report([row]))).rejects.toThrow(/readable row-height limit/);
    row.label = 'x'.repeat(32768);
    await expect(createMilestoneWorkbook(report([row]))).rejects.toThrow(/32,767-character limit/);
  });

  it('blocks incomplete delivery, Excel row overflow and files over the host30MB limit', async () => {
    const incomplete = report(); incomplete.provenance.allDataReceived = false as unknown as true;
    await expect(createMilestoneWorkbook(incomplete)).rejects.toThrow(/Finish loading/);
    const excessive = report(); excessive.rows = new Array(1048576 - 9 + 1) as MilestoneExportRow[];
    await expect(createMilestoneWorkbook(excessive)).rejects.toThrow(/row limit/);
    vi.spyOn(JSZip.prototype, 'generateAsync').mockResolvedValue('A'.repeat(30 * 1024 * 1024 * 4 / 3 + 4));
    await expect(createMilestoneWorkbook(report([]))).rejects.toThrow(/30 MB/);
  });

  it('packages10,000 equipment rows in memory without cutting off late records or introducing formula cells', async () => {
    const rows = Array.from({ length: 10000 }, (_, index) => equipment(`EQ-${String(index).padStart(5, '0')}`));
    const zip = await JSZip.loadAsync(await createMilestoneWorkbook(report(rows)), { base64: true });
    const sheet = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    expect(sheet).toContain('r="10009"'); expect(sheet).toContain('EQ-09999'); expect(sheet).not.toContain('<f>');
    expect((await document(zip, 'xl/tables/table1.xml')).documentElement.getAttribute('ref')).toBe('A9:J10009');
  }, 20000);

  it('normalizes a common header with1,000 source children without losing edges or exposing excluded Completed external references', async () => {
    const rows: SyntheticRow[] = Array.from({ length: 1000 }, (_, index) => ({ project: 'Alpha', equipmentId: `EQ-${index}`, parentMilestone: 'L1-A', milestone: 'L2-A', closestParent: index === 0 ? 'EXCLUDED-COMPLETED-ROOT' : 'COMMON-HEADER', status: 'Completed' }));
    rows.push({ project: 'Alpha', equipmentId: 'COMMON-HEADER', nodeType: 'header', parentMilestone: 'L1-B', milestone: 'L2-B', status: 'Not Started' },
      { project: 'Alpha', equipmentId: 'EXCLUDED-COMPLETED-ROOT', parentMilestone: 'L1-B', milestone: 'L2-B', closestParent: 'COMMON-HEADER', status: 'Completed' });
    const graph = parseDataView(tableFixture(rows)), source = buildMilestoneExport(graph, nodeKey('l2', 'Alpha', 'L2-A'));
    expect(source.counts.excludedCompleted).toBe(1);
    const zip = await JSZip.loadAsync(await createMilestoneWorkbook(source), { base64: true });
    const workbook = await document(zip, 'xl/workbook.xml');
    expect([...workbook.querySelectorAll('sheet')].map(sheet => sheet.getAttribute('name'))).toEqual(['Milestone equipment', 'Related equipment', 'Relationships']);
    const external = await document(zip, 'xl/worksheets/sheet2.xml'); expect(cell(external, 'I10')).toContain('See Relationships sheet');
    const links = await document(zip, 'xl/worksheets/sheet3.xml');
    const parents = [...links.querySelectorAll('row')].filter(row => row.querySelector('c')?.textContent === 'Closest parent');
    expect(parents).toHaveLength(999);
    expect(parents.every(row => row.querySelectorAll('c')[5].textContent === 'COMMON-HEADER')).toBe(true);
    for (const entry of Object.values(zip.files)) if (!entry.dir && (entry.name.endsWith('.xml') || entry.name.endsWith('.rels'))) {
      const contents = await entry.async('string'); expect(contents, entry.name).not.toContain('EXCLUDED-COMPLETED-ROOT'); await document(zip, entry.name);
    }
    const relationships = await document(zip, 'xl/_rels/workbook.xml.rels'), ids = [...relationships.querySelectorAll('Relationship')].map(relation => relation.getAttribute('Id'));
    expect(new Set(ids).size).toBe(ids.length);
    expect(relationships.querySelector('Relationship[Target="styles.xml"]')!.getAttribute('Id')).toBe('rId4');
    expect(zip.file('xl/worksheets/_rels/sheet3.xml.rels')).not.toBeNull(); expect(zip.file('xl/tables/table3.xml')).not.toBeNull();
    expect(workbook.querySelector('definedName[localSheetId="2"]')!.textContent).toContain("'Relationships'!$A:$C");
  }, 20000);

  it('retains1,000 genuine dependencies and1,000 exact assignment pairs in the normalized sheet while keeping one worklist row per equipment', async () => {
    const source = equipment('SOURCE'), dependencies = Array.from({ length: 1000 }, (_, index) => equipment(`DEP-${index}`, 'not-started', false));
    dependencies.forEach(dependency => { dependency.relationSources = []; dependency.assignments = [{ l1: reference('L1-B', 'l1'), l2: reference('L2-B', 'l2') }]; });
    source.dependencies = dependencies;
    source.assignments = Array.from({ length: 1000 }, (_, index) => ({ l1: reference(`L1-${index}`, 'l1'), l2: reference(`L2-${index}`, 'l2') }));
    source.relationSources = [];
    const zip = await JSZip.loadAsync(await createMilestoneWorkbook(report([source, ...dependencies])), { base64: true });
    const main = await document(zip, 'xl/worksheets/sheet1.xml');
    expect(cell(main, 'F10')).toContain('1000 declared L1 / L2 assignment pairs'); expect(cell(main, 'H10')).toContain('1000 dependency references');
    expect((await document(zip, 'xl/tables/table1.xml')).documentElement.getAttribute('ref')).toBe('A9:J10');
    const links = await document(zip, 'xl/worksheets/sheet3.xml');
    const rows = [...links.querySelectorAll('row')].filter(row => Number(row.getAttribute('r')) > 9);
    const prerequisites = rows.filter(row => row.querySelector('c')?.textContent === 'Dependency');
    const assignments = rows.filter(row => row.querySelector('c')?.textContent === 'Milestone assignment' && row.querySelectorAll('c')[2].textContent === 'SOURCE');
    expect(prerequisites).toHaveLength(1000); expect(assignments).toHaveLength(1000);
    expect(prerequisites[999].querySelectorAll('c')[5].textContent).toBe('DEP-999');
    expect(assignments[999].querySelectorAll('c')[5].textContent).toBe('L2-999'); expect(assignments[999].querySelectorAll('c')[7].textContent).toContain('L1-999');
  }, 20000);
});
