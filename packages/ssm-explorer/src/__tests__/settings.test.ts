import { describe, expect, it } from 'vitest';
import type powerbi from 'powerbi-visuals-api';
import capabilities from '../../capabilities.json';
import { ExplorerSettings } from '../settings';
import { DISCIPLINE_HIGHLIGHT_KEY } from '../ui/highlighting';

function view(columns: powerbi.DataViewMetadataColumn[], objects: powerbi.DataViewObjects = {}): powerbi.DataView {
  return { metadata: { columns, objects }, table: { columns, rows: [] } };
}

describe('SSM author formatting', () => {
  it('provides one dynamic author highlight column selector defaulting to Discipline', () => {
    const settings = new ExplorerSettings(view([
      { displayName: 'Status', queryName: 'R.Status', roles: { nodeDetail: true } },
      { displayName: 'Schedule', queryName: 'R.Schedule', roles: { milestoneDetail: true } },
    ]));
    expect(settings.options.highlightField).toBe(DISCIPLINE_HIGHLIGHT_KEY);
    expect(settings.highlightFields.map(field => field.label)).toEqual(['Discipline', 'Status']);
    const card = settings.getFormattingModel().cards.find(entry => 'uid' in entry && entry.uid === 'ssm-highlighting') as powerbi.visuals.FormattingCard;
    const group = card.groups[0] as powerbi.visuals.FormattingGroup;
    const slice = group.slices![0] as powerbi.visuals.FormattingSlice;
    expect(group.slices).toHaveLength(1);
    expect(slice.control.type).toBe('Dropdown');
    expect(slice.control.properties).toMatchObject({ descriptor: { objectName: 'highlighting', propertyName: 'highlightField' }, value: { value: DISCIPLINE_HIGHLIGHT_KEY, displayName: 'Discipline' } });
    expect((slice.control.properties as powerbi.visuals.ItemDropdown).items.map(item => item.displayName)).toEqual(['Discipline', 'Status']);
    expect(card.revertToDefaultDescriptors).toEqual([{ objectName: 'highlighting', propertyName: 'highlightField' }]);
  });

  it('allows deliberate highlighting by hidden metadata, persists by query identity, and safely resets removed fields', () => {
    const status = { displayName: 'Status', queryName: 'R.Status', roles: { nodeDetail: true }, objects: { detailEquipment: { visible: false } } };
    const rating = { displayName: 'Rating', queryName: 'R.Rating', roles: { nodeDetail: true } };
    const key = JSON.stringify(['metadata', 'R.Status']);
    const objects = { highlighting: { highlightField: key } };
    const before = new ExplorerSettings(view([status, rating], objects));
    const after = new ExplorerSettings(view([rating, { ...status, displayName: 'Current status' }], objects));
    expect(before.detailsFor('equipment').find(item => item.field.key === 'R.Status')?.visible).toBe(false);
    expect(before.selectedHighlightField.metadataKey).toBe('R.Status');
    expect(after.options.highlightField).toBe(key);
    expect(after.selectedHighlightField.label).toBe('Current status');
    expect(new ExplorerSettings(view([rating], objects)).options.highlightField).toBe(DISCIPLINE_HIGHLIGHT_KEY);
    expect(new ExplorerSettings(view([status], { highlighting: { highlightField: false } })).options.highlightField).toBe(DISCIPLINE_HIGHLIGHT_KEY);
  });
  it('keeps field configuration attached to query identity after column reorder', () => {
    const alpha = { displayName: 'Owner', queryName: 'Registry.Owner', roles: { nodeDetail: true }, objects: { detailEquipment: { visible: false, label: 'Responsible engineer', order: 0, format: 'text' } } };
    const beta = { displayName: 'Owner', queryName: 'Registry.Supplier', roles: { nodeDetail: true } };
    const before = new ExplorerSettings(view([alpha, beta])).detailsFor('equipment');
    const after = new ExplorerSettings(view([beta, alpha])).detailsFor('equipment');
    expect(before.find(item => item.field.key === 'Registry.Owner')).toMatchObject({ visible: false, label: 'Responsible engineer', order: 0 });
    expect(after.find(item => item.field.key === 'Registry.Owner')).toMatchObject({ visible: false, label: 'Responsible engineer', order: 0 });
    expect(after.find(item => item.field.key === 'Registry.Supplier')?.visible).toBe(true);
  });

  it('keeps milestone fields separate and supports independent header configuration', () => {
    const settings = new ExplorerSettings(view([
      { displayName: 'Owner', queryName: 'R.Owner', roles: { nodeDetail: true }, objects: { detailEquipment: { visible: false }, detailHeader: { visible: true } } },
      { displayName: 'Planned date', queryName: 'R.Planned', roles: { milestoneDetail: true }, objects: { detailL2: { format: 'date' } } },
    ]));
    expect(settings.detailsFor('equipment')).toHaveLength(1);
    expect(settings.detailsFor('header')[0].visible).toBe(true);
    expect(settings.detailsFor('l1')).toEqual([]);
    expect(settings.detailsFor('l2')[0]).toMatchObject({ format: 'date', field: { key: 'R.Planned' } });
    expect(settings.detailsFor('unresolved')).toEqual([]);
  });

  it('uses host column metadata when table columns omit formatting objects', () => {
    const column = { displayName: 'Pressure', queryName: 'R.Pressure', roles: { nodeDetail: true } };
    const dataView = view([column]);
    dataView.metadata.columns = [{ ...column, objects: { detailEquipment: { label: 'Pressure (bar)', format: 'decimal' } } }];
    expect(new ExplorerSettings(dataView).detailsFor('equipment')[0]).toMatchObject({ label: 'Pressure (bar)', format: 'decimal' });
  });

  it('rejects malformed theme, color and numeric settings while preserving false', () => {
    const settings = new ExplorerSettings(view([], {
      appearance: { theme: 'injected', accent: { solid: { color: 'url(https://example.invalid)' } }, fontSize: -40, nodeWidth: Number.NaN },
      navigation: { animate: false, maxVisibleNodes: 100000 },
      drawer: { showEmptyDetails: false },
    }));
    expect(settings.options).toMatchObject({ theme: 'auto', accent: '#087F80', fontSize: 11, nodeWidth: 190, animate: false, maxVisibleNodes: 2000, showEmptyDetails: false });
  });

  it('deduplicates repeated query names while retaining node-specific author settings', () => {
    const settings = new ExplorerSettings(view([
      { displayName: 'Capacity', queryName: 'R.Capacity', roles: { nodeDetail: true }, objects: { detailEquipment: { label: 'Rated capacity' } } },
      { displayName: 'Capacity', queryName: 'R.Capacity', roles: { nodeDetail: true } },
      { displayName: 'Capacity', queryName: 'R.Capacity', roles: { milestoneDetail: true }, objects: { detailL2: { visible: false } } },
    ]));
    expect(settings.fields).toHaveLength(1);
    expect(settings.detailsFor('equipment')[0].label).toBe('Rated capacity');
    expect(settings.detailsFor('l2')[0].visible).toBe(false);
    const equipment = settings.getFormattingModel().cards.find(card => 'uid' in card && card.uid === 'ssm-detailEquipment') as powerbi.visuals.FormattingCard;
    expect(equipment.groups).toHaveLength(1);
  });

  it('returns unique host control descriptors matching capabilities including column selectors', () => {
    const settings = new ExplorerSettings(view([{ displayName: 'Capacity', queryName: 'R.Capacity', roles: { nodeDetail: true, milestoneDetail: true } }]));
    const model = settings.getFormattingModel();
    const uids = new Set<string>();
    let columnScoped = 0;
    for (const entry of model.cards) {
      const card = entry as powerbi.visuals.FormattingCard;
      expect(uids.has(card.uid)).toBe(false); uids.add(card.uid);
      for (const descriptor of card.revertToDefaultDescriptors ?? []) {
        expect((capabilities.objects as Record<string, { properties: Record<string, unknown> }>)[descriptor.objectName]?.properties[descriptor.propertyName]).toBeDefined();
        if (descriptor.selector) { expect((descriptor.selector as { metadata?: string }).metadata).toBe('R.Capacity'); columnScoped++; }
      }
      for (const entry of card.groups) {
        for (const slice of (entry as powerbi.visuals.FormattingGroup).slices ?? []) {
          const control = slice as powerbi.visuals.FormattingSlice;
          expect(uids.has(control.uid)).toBe(false); uids.add(control.uid);
        }
      }
    }
    expect(columnScoped).toBe(12);
  });
});
