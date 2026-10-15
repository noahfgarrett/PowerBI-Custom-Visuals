import type powerbi from 'powerbi-visuals-api';

export interface SyntheticRow {
    project: string;
    equipmentId: string;
    equipmentLabel?: string;
    nodeType?: string;
    discipline?: string;
    milestone?: string;
    parentMilestone?: string;
    closestParent?: string;
    closestParentProject?: string;
    dependencies?: string;
    dependencyProject?: string;
    systemName?: string;
    owner?: string;
    progress?: number;
    due?: Date | string;
    notes?: string;
    milestoneOwner?: string;
    parentOwner?: string;
    status?: string;
}

const columns: Array<{ property: keyof SyntheticRow; label: string; role: string; type?: powerbi.ValueTypeDescriptor; format?: string }> = [
    { property: 'project', label: 'Project', role: 'project' },
    { property: 'equipmentId', label: 'Equipment ID', role: 'equipmentId' },
    { property: 'equipmentLabel', label: 'Equipment', role: 'equipmentLabel' },
    { property: 'nodeType', label: 'Node type', role: 'nodeType' },
    { property: 'discipline', label: 'Discipline', role: 'discipline' },
    { property: 'milestone', label: 'Milestone', role: 'milestone' },
    { property: 'parentMilestone', label: 'Parent milestone', role: 'parentMilestone' },
    { property: 'closestParent', label: 'Closest parent', role: 'closestParent' },
    { property: 'closestParentProject', label: 'Parent project', role: 'closestParentProject' },
    { property: 'dependencies', label: 'Dependencies', role: 'dependencies' },
    { property: 'dependencyProject', label: 'Dependency project', role: 'dependencyProject' },
    { property: 'systemName', label: 'System', role: 'systemName' },
    { property: 'owner', label: 'Owner', role: 'nodeDetail' },
    { property: 'progress', label: 'Progress', role: 'nodeDetail', type: { numeric: true }, format: '0.0%' },
    { property: 'due', label: 'Due date', role: 'nodeDetail', type: { dateTime: true } },
    { property: 'notes', label: 'Notes', role: 'nodeDetail' },
    { property: 'milestoneOwner', label: 'Milestone owner', role: 'milestoneDetail' },
    { property: 'parentOwner', label: 'Parent owner', role: 'parentMilestoneDetail' },
    { property: 'status', label: 'Status', role: 'nodeDetail' },
];

export function tableFixture(rows: SyntheticRow[], objects?: powerbi.DataViewObjects, partial = false, rowOffset = 0): powerbi.DataView {
    const metadataColumns: powerbi.DataViewMetadataColumn[] = columns.map((column, index) => ({
        displayName: column.label,
        queryName: `SyntheticRegistry.${column.property}`,
        roles: { [column.role]: true },
        type: column.type ?? { text: true },
        index,
        ...(column.format ? { format: column.format } : {}),
    }));
    return {
        metadata: { columns: metadataColumns, ...(objects ? { objects } : {}), ...(partial ? { segment: {} } : {}) },
        table: {
            columns: metadataColumns,
            rows: rows.map(row => columns.map(column => (row[column.property] ?? null) as powerbi.PrimitiveValue)),
            identity: rows.map((row, index) => ({ key: `${row.project}:${row.equipmentId}:${rowOffset + index}` })) as unknown as powerbi.DataViewTable['identity'],
        },
    };
}

export function standardRows(): SyntheticRow[] {
    const rows: SyntheticRow[] = [];
    for (let index = 1; index <= 8; index++) {
        rows.push({
            project: 'Project Alpha', equipmentId: `EQ-${String(index).padStart(3, '0')}`,
            equipmentLabel: ['Air handling unit', 'Supply duct', 'Isolation damper', 'Temperature sensor', 'Control panel', 'Distribution board', 'Cable route', 'Local isolator'][index - 1],
            nodeType: 'equipment', discipline: index < 5 ? 'Mechanical' : 'Electrical',
            milestone: index < 5 ? 'Mechanical completion' : 'Controls commissioning', parentMilestone: 'Building ready',
            ...(index > 1 ? { closestParent: `EQ-${String(index - 1).padStart(3, '0')}` } : {}),
            ...(index === 2 ? { dependencies: 'EQ-005' } : {}),
            ...(index === 8 ? { dependencies: 'EQ-001', dependencyProject: 'Project Beta' } : {}),
            systemName: 'North plant', owner: index < 5 ? 'A. Patel' : 'M. Chen',
            progress: index / 10, due: '2026-11-02', notes: index === 3 ? '<img src=x onerror="window.__unsafe=true">' : 'Synthetic inspection record',
        });
    }
    // Same physical entity has two declared assignments, rather than two counts.
    rows.push({ ...rows[1], milestone: 'Controls commissioning' });
    rows.push({ project: 'Project Alpha', equipmentId: 'EQ-009', equipmentLabel: 'Cooling-water pump', nodeType: 'equipment', discipline: 'Mechanical', milestone: 'Mechanical completion', parentMilestone: 'Building ready', dependencies: 'MISSING-007', dependencyProject: 'Unavailable Project', owner: 'A. Patel', progress: 0, notes: '' });
    rows.push({ project: 'Project Beta', equipmentId: 'EQ-001', equipmentLabel: 'Air handling unit', nodeType: 'equipment', discipline: 'Mechanical', milestone: 'Mechanical completion', parentMilestone: 'Building ready', owner: 'S. Rivera', progress: 0.35, due: '2026-12-15' });
    rows.push({ project: 'Project Beta', equipmentId: 'EQ-002', equipmentLabel: 'Supply duct', nodeType: 'equipment', discipline: 'Mechanical', milestone: 'Mechanical completion', parentMilestone: 'Building ready', closestParent: 'EQ-001', owner: 'S. Rivera', progress: 0.2 });
    rows.push({ project: 'Project Beta', equipmentId: 'REG-001', equipmentLabel: 'Controls register', nodeType: 'header', discipline: 'Electrical', milestone: 'Controls commissioning', parentMilestone: 'Building ready', owner: 'J. Brooks' });
    rows.push({ project: 'Project Beta', equipmentId: 'EQ-003', equipmentLabel: 'Long equipment tag • Local controls distribution assembly with extra context', nodeType: 'equipment', discipline: 'Electrical', milestone: 'Controls commissioning', parentMilestone: 'Building ready', closestParent: 'REG-001', owner: 'J. Brooks', progress: 0.5 });
    rows.push({ project: 'Project Beta', equipmentId: 'EQ-004', equipmentLabel: 'Unassigned flow meter', nodeType: 'equipment', discipline: 'Process', owner: 'T. Allen' });
    return rows.map(row => ({ ...row, milestoneOwner: row.milestone ? 'Milestone coordinator' : undefined, parentOwner: row.parentMilestone ? 'Commissioning lead' : undefined }));
}

export function wideRows(size = 600): SyntheticRow[] {
    return Array.from({ length: size }, (_, index) => ({
        project: index < size / 2 ? 'Project Alpha' : 'Project Beta',
        equipmentId: `WIDE-${String(index % Math.ceil(size / 2)).padStart(4, '0')}`,
        equipmentLabel: `Equipment ${index + 1}`,
        nodeType: 'equipment', discipline: index % 2 ? 'Electrical' : 'Mechanical',
        milestone: `Milestone ${Math.floor(index / 30) % 10 + 1}`, parentMilestone: `Parent ${Math.floor(index / 90) % 4 + 1}`,
        ...(index % 30 ? { closestParent: `WIDE-${String((index % Math.ceil(size / 2)) - 1).padStart(4, '0')}` } : {}),
        owner: 'Synthetic team', progress: (index % 10) / 10,
    }));
}

/** Representative large fixture: wide branches, metadata, bounded dense neighborhoods,
 * 12-deep ancestors, and explicit cross-project prerequisites. Matching tags across
 * projects deliberately exercise scope-safe identity resolution.
 */
export function scalabilityRows(size: number): SyntheticRow[] {
    const projects = ['Scale Alpha', 'Scale Beta', 'Scale Gamma', 'Scale Delta'];
    const perProject = Math.ceil(size / projects.length);
    const tag = (index: number) => `SCALE-${String(index).padStart(6, '0')}`;
    return Array.from({ length: size }, (_, index): SyntheticRow => {
        const projectIndex = Math.min(projects.length - 1, Math.floor(index / perProject));
        const local = index - projectIndex * perProject;
        const branch = Math.floor(local / 1000);
        const branchStart = branch * 1000;
        const parent = local % 1000 > 0 ? local % 1000 <= 11 ? local - 1 : branchStart : undefined;
        const neighborhood = Math.floor(local / 200) * 200;
        const dependencies: Array<{ id: string; project?: string }> = [];
        for (const distance of [1, 3, 7, 13]) {
            const target = local - distance;
            if (target >= neighborhood) dependencies.push({ id: tag(target) });
        }
        // This explicit cross-project edge never resolves a tag by scanning projects.
        if (local > 0 && local % 2500 === 0 && projectIndex > 0) dependencies.push({ id: tag(local), project: projects[projectIndex - 1] });
        return {
            project: projects[projectIndex], equipmentId: tag(local), equipmentLabel: `Synthetic equipment ${local + 1}`,
            nodeType: 'equipment', discipline: ['Mechanical', 'Electrical', 'Process'][local % 3],
            milestone: `Milestone ${String(branch + 1).padStart(3, '0')}`,
            parentMilestone: `Parent ${Math.floor(branch / 5) + 1}`,
            ...(parent === undefined ? {} : { closestParent: tag(parent) }),
            ...(dependencies.length ? { dependencies: JSON.stringify(dependencies) } : {}),
            systemName: `Synthetic system ${branch + 1}`,
            owner: `Synthetic team ${local % 20 + 1}`, progress: (local % 101) / 100,
            due: `2027-01-${String(local % 28 + 1).padStart(2, '0')}`,
            notes: `Synthetic inspection ${local % 20 + 1}`,
            milestoneOwner: `Coordinator ${branch % 12 + 1}`, parentOwner: `Parent lead ${Math.floor(branch / 5) + 1}`,
            status: ['Ready', 'Awaiting power', 'In progress'][local % 3],
        };
    });
}

/** Hundreds of L2 definitions beneath each L1, with duplicate display tags across projects. */
export function hierarchyRows(milestonesPerParent = 240, equipmentPerMilestone = 3): SyntheticRow[] {
    const rows: SyntheticRow[] = [];
    for (const project of ['Hierarchy Alpha', 'Hierarchy Beta']) {
        for (const parent of ['A', 'B']) {
            for (let milestone = 1; milestone <= milestonesPerParent; milestone++) {
                for (let equipment = 1; equipment <= equipmentPerMilestone; equipment++) {
                    const tag = `EQ-${parent}-${String(milestone).padStart(3, '0')}-${String(equipment).padStart(2, '0')}`;
                    rows.push({
                        project, equipmentId: tag,
                        equipmentLabel: `${parent} ${milestone} equipment ${equipment}`,
                        nodeType: 'equipment', discipline: equipment % 2 ? 'Mechanical' : 'Electrical',
                        parentMilestone: `Parent ${parent}`,
                        milestone: `${parent} / Milestone ${String(milestone).padStart(3, '0')}`,
                        ...(equipment > 1 ? { closestParent: `EQ-${parent}-${String(milestone).padStart(3, '0')}-${String(equipment - 1).padStart(2, '0')}` } : {}),
                        owner: `${project} team ${parent}`, progress: equipment / equipmentPerMilestone,
                        due: '2027-02-15', notes: 'Synthetic nested hierarchy record',
                        milestoneOwner: `Coordinator ${parent}-${milestone}`, parentOwner: `${project} parent lead ${parent}`,
                    });
                }
            }
        }
    }
    return rows;
}

/** Parent-first and direct dependency inspection, including cases where IDs sort
 * children ahead of their parents. All rows are invented for browser/tests.
 */
export function structuralRows(wideChildren = 80): SyntheticRow[] {
    const base = { project: 'Project Alpha', nodeType: 'equipment', discipline: 'Mechanical', milestone: 'Mechanical completion', parentMilestone: 'Building ready', owner: 'Synthetic Alpha team', progress: 0.5 };
    const rows: SyntheticRow[] = [
        { ...base, equipmentId: 'HEADER-90', equipmentLabel: 'Plant register', nodeType: 'header' },
        { ...base, equipmentId: 'Z-ROOT', equipmentLabel: 'Main assembly', closestParent: 'HEADER-90', dependencies: JSON.stringify([{ id: 'P-LOCAL' }, { id: 'D-REMOTE', project: 'Project Beta' }]) },
        { ...base, equipmentId: 'A-CHILD', equipmentLabel: 'First structural child', closestParent: 'Z-ROOT', dependencies: JSON.stringify([{ id: 'MISSING-D', project: 'Absent Project' }]) },
        { ...base, equipmentId: 'B-GRANDCHILD', equipmentLabel: 'Structural grandchild', closestParent: 'A-CHILD' },
        { ...base, equipmentId: 'C-CONSUMER', equipmentLabel: 'Assembly consumer', closestParent: 'Z-ROOT', dependencies: JSON.stringify(['Z-ROOT', 'P-LOCAL']) },
        { ...base, equipmentId: 'E-EXTERNAL', equipmentLabel: 'Child with parent in another milestone', closestParent: 'P-LOCAL' },
        { ...base, equipmentId: 'M-UNAVAILABLE', equipmentLabel: 'Child with unavailable parent', closestParent: 'UNKNOWN-PARENT' },
        { ...base, equipmentId: 'CYCLE-A', equipmentLabel: 'Cycle member A', closestParent: 'CYCLE-B' },
        { ...base, equipmentId: 'CYCLE-B', equipmentLabel: 'Cycle member B', closestParent: 'CYCLE-A' },
    ];
    for (let level = 1; level <= 10; level++) {
        rows.push({ ...base, equipmentId: `D-${String(level).padStart(2, '0')}`, equipmentLabel: `Deep structural level ${level}`, closestParent: level === 1 ? 'Z-ROOT' : `D-${String(level - 1).padStart(2, '0')}`, ...(level === 10 ? { dependencies: JSON.stringify(['P-LOCAL']) } : {}) });
    }
    for (let child = 0; child < wideChildren; child++) {
        rows.push({ ...base, equipmentId: `W-${String(child).padStart(3, '0')}`, equipmentLabel: `Wide structural child ${child + 1}`, closestParent: 'Z-ROOT' });
    }
    rows.push({ ...base, equipmentId: 'S-SHARED', equipmentLabel: 'Equipment with two declared memberships', closestParent: 'Z-ROOT' });
    rows.push({ ...base, equipmentId: 'S-SHARED', equipmentLabel: 'Equipment with two declared memberships', closestParent: 'Z-ROOT', milestone: 'Controls commissioning' });
    rows.push({ ...base, equipmentId: 'P-LOCAL', equipmentLabel: 'Local prerequisite', milestone: 'Controls commissioning' });
    rows.push({ ...base, equipmentId: 'D-REMOTE', equipmentLabel: 'Same tag in the source project, not the declared remote prerequisite' });
    rows.push({ ...base, equipmentId: 'D-REMOTE', equipmentLabel: 'Remote prerequisite', project: 'Project Beta', milestone: 'Controls commissioning', owner: 'Synthetic Beta team' });
    return rows.map(row => ({ ...row, milestoneOwner: 'Synthetic coordinator', parentOwner: 'Synthetic parent lead' }));
}

/** A clean fictional plant for screenshots and highlight examples. The long
 * electrical branch also exercises nested discovery without cluttering startup.
 */
export function showroomRows(): SyntheticRow[] {
    const base = { project: 'East Plant', nodeType: 'equipment', parentMilestone: 'Building ready', milestone: 'Airside ready', owner: 'Commissioning team', due: '2027-02-15', milestoneOwner: 'Airside coordinator', parentOwner: 'Plant lead' };
    const rows: SyntheticRow[] = [
        { ...base, equipmentId: 'AHU-101', equipmentLabel: 'Air handling unit', discipline: 'Mechanical', status: 'In progress', progress: .75 },
        { ...base, equipmentId: 'FAN-101', equipmentLabel: 'Supply fan', closestParent: 'AHU-101', discipline: 'Mechanical', status: 'Awaiting power', progress: .8, dependencies: JSON.stringify(['DB-101', 'CWP-101']) },
        { ...base, equipmentId: 'DUCT-101', equipmentLabel: 'Supply air duct', closestParent: 'AHU-101', discipline: 'Mechanical', status: 'Ready', progress: 1 },
        { ...base, equipmentId: 'DAMPER-101', equipmentLabel: 'Isolation damper', closestParent: 'DUCT-101', discipline: 'Mechanical', status: 'Ready', progress: 1 },
        { ...base, equipmentId: 'COIL-101', equipmentLabel: 'Cooling coil', closestParent: 'AHU-101', discipline: 'Mechanical', status: 'In progress', progress: .65, dependencies: 'CWP-101' },
        { ...base, equipmentId: 'MOTOR-101', equipmentLabel: 'Fan motor', closestParent: 'FAN-101', discipline: 'Electrical', status: 'Awaiting power', progress: .9 },
        { ...base, equipmentId: 'VFD-101', equipmentLabel: 'Variable speed drive', closestParent: 'MOTOR-101', discipline: 'Electrical', status: 'Ready', progress: 1, dependencies: 'DB-101' },
        { ...base, equipmentId: 'ISOLATOR-101', equipmentLabel: 'Local motor isolator', closestParent: 'VFD-101', discipline: 'Electrical', status: 'Ready', progress: 1 },
        { ...base, equipmentId: 'CABLE-101', equipmentLabel: 'Motor power cable', closestParent: 'ISOLATOR-101', discipline: 'Electrical', status: 'Ready', progress: 1 },
        { ...base, equipmentId: 'TERMINAL-101', equipmentLabel: 'Motor terminal box', closestParent: 'CABLE-101', discipline: 'Electrical', status: 'Ready', progress: 1 },
        { ...base, equipmentId: 'CONTROL-101', equipmentLabel: 'Fan control module', closestParent: 'TERMINAL-101', discipline: 'Controls', status: 'In progress', progress: .7 },
        { ...base, equipmentId: 'FEEDBACK-101', equipmentLabel: 'Fan feedback relay', closestParent: 'CONTROL-101', discipline: 'Controls', status: 'In progress', progress: .7 },
        { ...base, equipmentId: 'SENSOR-101', equipmentLabel: 'Fan proof sensor', closestParent: 'FEEDBACK-101', discipline: 'Controls', status: 'Inspection due', progress: .9 },
        { ...base, equipmentId: 'DB-101', equipmentLabel: 'Distribution board', milestone: 'Power ready', discipline: 'Electrical', status: 'Awaiting power', owner: 'Electrical team', progress: .85 },
        { ...base, equipmentId: 'DB-ISOLATOR-101', equipmentLabel: 'Board main isolator', closestParent: 'DB-101', milestone: 'Power ready', discipline: 'Electrical', status: 'Ready', progress: 1 },
        { ...base, equipmentId: 'CWP-101', equipmentLabel: 'Cooling water pump', milestone: 'Utilities ready', discipline: 'Mechanical', status: 'Ready', owner: 'Utilities team', progress: 1 },
        { ...base, equipmentId: 'PIPE-101', equipmentLabel: 'Cooling water supply', closestParent: 'CWP-101', milestone: 'Utilities ready', discipline: 'Mechanical', status: 'Ready', progress: 1 },
    ];
    return rows;
}
