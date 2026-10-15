import { describe, expect, it } from 'vitest';
import { buildMilestoneExport } from '../milestone-export';
import { nodeKey, parseDataView } from '../model';
import { tableFixture, type SyntheticRow } from './fixtures';

const row = (equipmentId: string, values: Partial<SyntheticRow> = {}): SyntheticRow => ({ project: 'Alpha', equipmentId, nodeType: 'equipment', parentMilestone: 'L1', milestone: 'Selected', status: 'Not Started', ...values });
const graphOf = (rows: SyntheticRow[]) => parseDataView(tableFixture(rows));
const selected = (project = 'Alpha') => nodeKey('l2', project, 'Selected');
const exportedTags = (rows: ReturnType<typeof buildMilestoneExport>['rows']) => rows.map(item => item.tag);

describe('full milestone requirement export', () => {
  it('keeps every selected member status and includes headers with review required for missing status', () => {
    const graph = graphOf([row('N'), row('I', { status: 'In Progress' }), row('C', { status: 'Completed' }), row('H', { nodeType: 'header', status: undefined })]);
    const report = buildMilestoneExport(graph, selected());
    expect(exportedTags(report.rows)).toEqual(expect.arrayContaining(['N', 'I', 'C', 'H']));
    expect(report.rowCount).toBe(4); expect(report.counts.inMilestone).toBe(4);
    expect(report.counts).toMatchObject({ notStarted: 1, inProgress: 1, completed: 1, unknown: 1, external: 0 });
    expect(report.rows.find(item => item.tag === 'H')).toMatchObject({ recordType: 'header', reviewRequired: true });
  });

  it('traverses a completed parent to unfinished switchgear without adding the parent’s other circuit', () => {
    const graph = graphOf([
      row('MEMBER', { status: 'Completed', closestParent: 'COMPLETE-PANEL' }),
      row('COMPLETE-PANEL', { milestone: 'Other', status: 'Completed', closestParent: 'SWITCHGEAR' }),
      row('SWITCHGEAR', { milestone: 'Power', status: 'In Progress' }),
      row('SIBLING-CIRCUIT', { milestone: 'Other', closestParent: 'COMPLETE-PANEL' }),
      row('UPSTREAM-DEPENDENCY', { milestone: 'Power' }),
      row('SWITCHGEAR', { milestone: 'Power', status: 'In Progress', dependencies: 'UPSTREAM-DEPENDENCY' }),
    ]);
    const report = buildMilestoneExport(graph, selected());
    expect(exportedTags(report.rows)).toEqual(['MEMBER', 'SWITCHGEAR']);
    expect(report.counts.excludedCompleted).toBe(1);
    const upstream = report.rows.find(item => item.tag === 'SWITCHGEAR')!;
    expect(upstream.reasons).toContain('upstream-parent'); expect(upstream.assignments[0].l2.tag).toBe('Power');
    expect(upstream.notes.join(' ')).toContain('Completed equipment outside this milestone is omitted');
    const displayed = JSON.stringify({ rows: report.rows, relations: report.provenance.relations });
    expect(displayed).not.toContain('COMPLETE-PANEL'); expect(displayed).not.toContain('SIBLING-CIRCUIT');
    expect(exportedTags(report.rows)).not.toContain('UPSTREAM-DEPENDENCY');
  });

  it('continues forward through completed external children and dependencies but never follows Required by', () => {
    const report = buildMilestoneExport(graphOf([
      row('MEMBER', { dependencies: 'DONE-DEP' }),
      row('DONE-CHILD', { milestone: 'Other', status: 'Completed', closestParent: 'MEMBER' }),
      row('UNFINISHED-GRANDCHILD', { milestone: 'Other', status: 'In Progress', closestParent: 'DONE-CHILD' }),
      row('DONE-DEP', { milestone: 'Other', status: 'Completed', dependencies: 'NEXT-DEP' }),
      row('NEXT-DEP', { milestone: 'Other' }),
      row('CONSUMER', { milestone: 'Other', dependencies: 'MEMBER' }),
    ]), selected());
    expect(exportedTags(report.rows)).toEqual(expect.arrayContaining(['MEMBER', 'UNFINISHED-GRANDCHILD', 'NEXT-DEP']));
    expect(exportedTags(report.rows)).not.toContain('CONSUMER'); expect(report.counts.excludedCompleted).toBe(2);
    expect(JSON.stringify(report)).not.toContain('DONE-CHILD'); expect(JSON.stringify(report)).not.toContain('DONE-DEP');
    expect(report.rows.find(item => item.tag === 'UNFINISHED-GRANDCHILD')!.reasons).toContain('structural-child');
    expect(report.rows.find(item => item.tag === 'NEXT-DEP')!.reasons).toContain('dependency');
  });

  it('retains external unknown, conflicting and unresolved records clearly as review-required', () => {
    const report = buildMilestoneExport(graphOf([
      row('MEMBER', { dependencies: 'UNKNOWN; CONFLICT; MISSING', closestParent: 'UNKNOWN-PARENT' }),
      row('UNKNOWN', { milestone: 'Other', status: 'Done-ish' }),
      row('CONFLICT', { milestone: 'Other', status: 'Completed' }),
      row('CONFLICT', { milestone: 'Other', status: 'Not Started' }),
      row('UNKNOWN-PARENT', { milestone: 'Other', status: undefined }),
    ]), selected());
    for (const tag of ['UNKNOWN', 'CONFLICT', 'MISSING', 'UNKNOWN-PARENT']) expect(report.rows.find(item => item.tag === tag)).toMatchObject({ reviewRequired: true });
    expect(report.rows.find(item => item.tag === 'CONFLICT')!.sourceStatus).toEqual(expect.arrayContaining(['Completed', 'Not Started']));
    expect(report.rows.find(item => item.tag === 'MISSING')!.recordType).toBe('unresolved');
    expect(report.reviewCount).toBeGreaterThanOrEqual(4);
  });

  it('terminates cycles and keeps the same tag in different projects distinct', () => {
    const graph = graphOf([
      row('MEMBER', { closestParent: 'PARENT', dependencies: '[{"id":"SAME","project":"Beta"},{"id":"SAME","project":"Alpha"}]' }),
      row('PARENT', { milestone: 'Other', closestParent: 'MEMBER' }),
      row('SAME', { milestone: 'Other', dependencies: 'MEMBER' }),
      row('SAME', { project: 'Beta', milestone: 'Other', dependencies: '[{"id":"MEMBER","project":"Alpha"}]' }),
    ]);
    const report = buildMilestoneExport(graph, selected());
    expect(report.rowCount).toBe(4);
    expect(report.rows.filter(item => item.tag === 'SAME').map(item => item.project)).toEqual(expect.arrayContaining(['Alpha', 'Beta']));
    expect(new Set(report.rows.map(item => item.nodeKey)).size).toBe(report.rowCount);
    expect(report.rows.some(item => item.reviewFlags.some(flag => /cycle/i.test(flag)))).toBe(true);
  });

  it('retains exact L1/L2 row pairs rather than a Cartesian combination of conflicting assignments', () => {
    const graph = graphOf([
      row('MULTI', { parentMilestone: 'Phase A', milestone: 'Selected' }),
      row('MULTI', { parentMilestone: 'Phase B', milestone: 'Other' }),
      row('SECOND', { parentMilestone: 'Phase C', milestone: 'Selected' }),
    ]);
    const report = buildMilestoneExport(graph, selected());
    const multi = report.rows.find(item => item.tag === 'MULTI')!;
    expect(multi.assignments.map(pair => [pair.l1.tag, pair.l2.tag])).toEqual([['Phase A', 'Selected'], ['Phase B', 'Other']]);
    expect(multi.assignments).not.toContainEqual(expect.objectContaining({ l1: expect.objectContaining({ tag: 'Phase C' }) }));
    expect(report.milestone.parentMilestones.map(item => item.tag)).toEqual(expect.arrayContaining(['Phase A', 'Phase C']));
  });

  it('rejects partial/setup/non-L2 exports and does not mutate graph data or apply viewer filters', () => {
    const graph = graphOf([row('M', { notes: 'Original note' })]), before = JSON.stringify([...graph.nodes.values()]);
    expect(() => buildMilestoneExport({ ...graph, partial: true }, selected())).toThrow(/Load all/);
    expect(() => buildMilestoneExport({ ...graph, missingRoles: ['project'] }, selected())).toThrow(/fields are missing/);
    expect(() => buildMilestoneExport(graph, nodeKey('equipment', 'Alpha', 'M'))).toThrow(/L2 milestone/);
    const report = buildMilestoneExport(graph, selected());
    expect(report.provenance).toMatchObject({ allDataReceived: true, sourceRows: 1 });
    expect(report.rows[0].notes).toEqual(['Original note']);
    expect(JSON.stringify([...graph.nodes.values()])).toBe(before);
    const withoutIndex = { ...graph, index: undefined }; buildMilestoneExport(withoutIndex, selected()); expect(withoutIndex.index).toBeUndefined();
  });

  it('preserves formula-looking, control-prefix and Unicode source text for the XLSX text-cell writer and produces a safe filename', () => {
    const project = '../Project\\\\中文', label = '../../=Work:"工程",\n';
    const graph = graphOf([row('=HYPERLINK("https://invalid", "測試")', { project, milestone: label, equipmentLabel: '\t=1+1', notes: '\u0001+SUM(A1:A2)\nquoted "text"' })]);
    const report = buildMilestoneExport(graph, nodeKey('l2', project, label.trim()));
    expect(report.rows[0].tag).toBe('=HYPERLINK("https://invalid", "測試")');
    expect(report.rows[0].label).toBe('=1+1');
    expect(report.rows[0].notes[0]).toContain('+SUM(A1:A2)');
    expect(report.fileName).toMatch(/^SSM_.*\.xlsx$/); expect(report.fileName).not.toMatch(/[<>:"/\\\\|?*\x00-\x1f]/); expect(report.fileName).not.toContain('..');
  });

  it('walks a deep upstream chain iteratively and includes the unfinished ancestor beyond completed intermediates', () => {
    const rows = [row('MEMBER', { closestParent: 'P-0' })];
    for (let i = 0; i < 10000; i++) rows.push(row(`P-${i}`, { milestone: 'External', status: i === 9999 ? 'In Progress' : 'Completed', closestParent: i < 9999 ? `P-${i + 1}` : undefined }));
    const report = buildMilestoneExport(graphOf(rows), selected());
    expect(exportedTags(report.rows)).toEqual(['MEMBER', 'P-9999']);
    expect(report.counts.excludedCompleted).toBe(9999); expect(report.provenance.traversedNodes).toBe(10001);
  });
});
