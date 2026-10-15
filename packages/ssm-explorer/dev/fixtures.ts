import { showroomRows as originalShowroomRows, type SyntheticRow } from '../src/__tests__/fixtures';

export { tableFixture, scalabilityRows, structuralRows, type SyntheticRow } from '../src/__tests__/fixtures';

/** Fictional status/export showcase. Status stays in the existing nodeDetail column. */
export function showroomRows(): SyntheticRow[] {
    const rows = originalShowroomRows().map(row => ({ ...row, status: row.status === 'Ready' ? 'Completed' : row.status === 'In progress' ? 'In Progress' : 'Not Started' }));
    const fan = rows.find(row => row.equipmentId === 'FAN-101')!;
    fan.dependencies = JSON.stringify(['DB-101', 'CWP-101', 'CTRL-ENABLE-101', 'FAT-REVIEW-101']);
    const panel = rows.find(row => row.equipmentId === 'DB-101')!;
    panel.status = 'Completed'; panel.progress = 1; panel.closestParent = 'SWITCHGEAR-101';
    const base = { project: 'East Plant', nodeType: 'equipment', parentMilestone: 'Building ready', owner: 'Synthetic commissioning team', due: '2027-02-15', parentOwner: 'Plant lead' };
    rows.push(
        { ...base, equipmentId: 'SWITCHGEAR-101', equipmentLabel: 'Upstream switchgear', milestone: 'Electrical supply ready', milestoneOwner: 'Electrical coordinator', discipline: 'Electrical', status: 'In Progress', progress: .6, closestParent: 'PRIMARY-SUPPLY-101', closestParentProject: 'Energy Center' },
        { ...base, equipmentId: 'CTRL-ENABLE-101', equipmentLabel: 'Controls enable panel', milestone: 'Controls ready', milestoneOwner: 'Controls coordinator', discipline: 'Controls', status: 'In Progress', progress: .5 },
        { ...base, equipmentId: 'FAT-REVIEW-101', equipmentLabel: 'Fan acceptance review', milestone: 'Inspection ready', milestoneOwner: 'Inspection coordinator', discipline: 'Mechanical', status: 'Not Started', progress: 0 },
        { ...base, project: 'Energy Center', equipmentId: 'PRIMARY-SUPPLY-101', equipmentLabel: 'Primary incoming supply', parentMilestone: 'Utility ready', milestone: 'Utility service ready', milestoneOwner: 'Utility coordinator', discipline: 'Electrical', status: 'Not Started', progress: 0 },
    );
    return rows;
}
