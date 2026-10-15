import { describe, expect, it } from 'vitest';
import capabilities from '../../capabilities.json';

type Range = { min?: number; max?: number };
const conditions = capabilities.dataViewMappings.flatMap(mapping => mapping.conditions) as Array<Record<string, Range>>;
const accepts = (fields: Record<string, number>): boolean => conditions.some(condition =>
  Object.entries(condition).every(([role, range]) => (fields[role] ?? 0) >= (range.min ?? 0) && (fields[role] ?? 0) <= (range.max ?? Infinity)));

describe('Power BI field-assignment contract', () => {
  it('declares a dynamic ItemDropdown author setting without adding a data role or viewer values property', () => {
    // Microsoft's ItemDropdown contract declares enumeration: [] and supplies
    // items at runtime from getFormattingModel; no static field names persist.
    expect(capabilities.objects.highlighting.properties.highlightField.type).toEqual({ enumeration: [] });
    expect(Object.keys(capabilities.objects.highlighting.properties)).toEqual(['highlightField']);
    expect(capabilities.dataRoles.some(role => role.name === 'highlightField')).toBe(false);
  });
  it('obeys the host rule allowing at most one mandatory role per mapping condition', () => {
    // The JSON schema accepts multiple positive minima, but Power BI does not.
    // https://learn.microsoft.com/power-bi/developer/visuals/dataview-mappings#conditions
    for (const condition of conditions) expect(Object.values(condition).filter(range => (range.min ?? 0) >= 1).length).toBeLessThanOrEqual(1);
  });

  it.each(capabilities.dataRoles.map(role => role.name))('accepts %s as the first dropped field and subsequent identity fields', role => {
    expect(accepts({ [role]: 1 })).toBe(true);
    expect(accepts({ [role]: 1, project: 1 })).toBe(true);
    expect(accepts({ [role]: 1, equipmentId: 1 })).toBe(true);
    expect(accepts({ [role]: 1, project: 1, equipmentId: 1 })).toBe(true);
  });

  it('retains scalar identity limits and maps every field well into table rows', () => {
    expect(accepts({ project: 2, equipmentId: 1 })).toBe(false);
    expect(accepts({ project: 1, equipmentId: 2 })).toBe(false);
    expect(accepts({ project: 1, equipmentId: 1, nodeDetail: 32 })).toBe(true);
    expect(accepts({ project: 1, equipmentId: 1, nodeDetail: 33 })).toBe(false);
    const mapped = capabilities.dataViewMappings.flatMap(mapping => mapping.table.rows.select.map(selection => selection.for.in));
    expect(mapped.sort()).toEqual(capabilities.dataRoles.map(role => role.name).sort());
  });
});
