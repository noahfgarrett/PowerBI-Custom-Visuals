import type powerbi from 'powerbi-visuals-api';
import type { DetailField, DetailPresentation, ExplorerOptions, NodeKind } from './types';
import { getHighlightFields, resolveHighlightField } from './ui/highlighting';
import type { HighlightField } from './ui/highlighting';

type Kind = 'toggle' | 'number' | 'color' | 'enum';
interface SettingDefinition {
  property: keyof ExplorerOptions;
  label: string;
  type: Kind;
  value: string | number | boolean;
  min?: number;
  max?: number;
  items?: Array<{ value: string; displayName: string }>;
}

export const SETTING_GROUPS: Record<string, { label: string; fields: SettingDefinition[] }> = {
  appearance: { label: 'Appearance', fields: [
    { property: 'theme', label: 'Theme', type: 'enum', value: 'auto', items: [
      { value: 'auto', displayName: 'Automatic' }, { value: 'light', displayName: 'Light' }, { value: 'dark', displayName: 'Dark' },
    ] },
    { property: 'accent', label: 'Milestones and selection', type: 'color', value: '#087F80' },
    { property: 'parentColor', label: 'Closest parent links', type: 'color', value: '#4475B3' },
    { property: 'dependencyColor', label: 'Dependency links', type: 'color', value: '#9867B5' },
    { property: 'fontSize', label: 'Text size', type: 'number', value: 12, min: 11, max: 20 },
    { property: 'nodeWidth', label: 'Node width', type: 'number', value: 190, min: 150, max: 320 },
  ] },
  navigation: { label: 'Canvas', fields: [
    { property: 'showLegend', label: 'Relationship legend', type: 'toggle', value: true },
    { property: 'showMinimap', label: 'Overview map', type: 'toggle', value: true },
    { property: 'animate', label: 'Transitions', type: 'toggle', value: true },
    { property: 'initialExpanded', label: 'Expand hierarchy on first load', type: 'toggle', value: false },
    { property: 'maxVisibleNodes', label: 'Visible node limit', type: 'number', value: 300, min: 25, max: 2000 },
    { property: 'autoLoad', label: 'Load additional batches automatically', type: 'toggle', value: true },
  ] },
  drawer: { label: 'Node panel', fields: [
    { property: 'drawerWidth', label: 'Panel width', type: 'number', value: 320, min: 240, max: 480 },
    { property: 'showEmptyDetails', label: 'Show empty fields', type: 'toggle', value: false },
    { property: 'showIdentity', label: 'Node identity', type: 'toggle', value: true },
    { property: 'showProject', label: 'Project', type: 'toggle', value: true },
    { property: 'showDiscipline', label: 'Discipline', type: 'toggle', value: true },
    { property: 'showMilestones', label: 'Milestone assignments', type: 'toggle', value: true },
    { property: 'showRelations', label: 'Connections', type: 'toggle', value: true },
  ] },
};

export const DETAIL_OBJECTS: Partial<Record<NodeKind, string>> = {
  equipment: 'detailEquipment', header: 'detailHeader', l1: 'detailL1', l2: 'detailL2',
};
const DETAIL_LABELS: Partial<Record<NodeKind, string>> = {
  equipment: 'Equipment fields', header: 'Header fields', l1: 'Parent milestone fields', l2: 'Milestone fields',
};
const FORMATS: Array<{ value: DetailPresentation['format']; displayName: string }> = [
  { value: 'auto', displayName: 'Model format' }, { value: 'text', displayName: 'Text' },
  { value: 'integer', displayName: 'Whole number' }, { value: 'decimal', displayName: 'Decimal' },
  { value: 'date', displayName: 'Date' },
];

function numeric(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}
function color(value: unknown, fallback: string): string {
  const fill = record(record(value).solid).color;
  const candidate = typeof value === 'string' ? value : fill;
  return typeof candidate === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(candidate) ? candidate : fallback;
}

/** All configurable metadata is column-scoped in the host Format pane. */
export class ExplorerSettings {
  readonly options: ExplorerOptions;
  readonly fields: DetailField[];
  readonly highlightFields: HighlightField[];
  readonly selectedHighlightField: HighlightField;
  private readonly dataView?: powerbi.DataView;
  private readonly translate: (key: string, fallback: string) => string;

  constructor(dataView?: powerbi.DataView, translate: (key: string, fallback: string) => string = (_key, text) => text) {
    this.dataView = dataView;
    this.translate = translate;
    const options: Record<string, unknown> = {};
    for (const [objectName, group] of Object.entries(SETTING_GROUPS)) {
      const values = record(dataView?.metadata?.objects?.[objectName]);
      for (const item of group.fields) {
        const input = values[item.property];
        options[item.property] = item.type === 'toggle' ? (typeof input === 'boolean' ? input : item.value)
          : item.type === 'number' ? numeric(input, item.value as number, item.min ?? 0, item.max ?? 10000)
          : item.type === 'color' ? color(input, item.value as string)
          : item.items?.some(option => option.value === input) ? input : item.value;
      }
    }
    this.options = options as unknown as ExplorerOptions;
    const columns = dataView?.table?.columns ?? dataView?.metadata?.columns ?? [];
    const fields = new Map<string, DetailField>();
    columns.forEach((column, index) => {
      const kinds: NodeKind[] = [];
      if (column.roles?.nodeDetail || column.roles?.status) kinds.push('equipment', 'header');
      if (column.roles?.milestoneDetail) kinds.push('l2');
      if (column.roles?.parentMilestoneDetail) kinds.push('l1');
      if (!kinds.length) return;
      const key = column.queryName || `${index}:${column.displayName}`;
      const existing = fields.get(key);
      if (existing) {
        existing.kinds = [...new Set([...existing.kinds, ...kinds])];
        existing.column = { ...existing.column, roles: { ...existing.column.roles, ...column.roles }, objects: { ...existing.column.objects, ...column.objects } };
      } else fields.set(key, { key, label: column.displayName, column, kinds });
    });
    this.fields = [...fields.values()];
    this.highlightFields = getHighlightFields(this.fields);
    this.selectedHighlightField = resolveHighlightField(this.highlightFields, record(dataView?.metadata?.objects?.highlighting).highlightField);
    this.options.highlightField = this.selectedHighlightField.key;
  }

  detailsFor(kind: NodeKind): DetailPresentation[] {
    const objectName = DETAIL_OBJECTS[kind];
    if (!objectName) return [];
    return this.fields.filter(field => field.kinds.includes(kind)).map((field, index): DetailPresentation => {
      // Some hosts carry column objects in metadata.columns rather than table.columns.
      const metadata = this.dataView?.metadata?.columns?.find(column => column.queryName && column.queryName === field.column.queryName);
      const values = { ...record(metadata?.objects?.[objectName]), ...record(field.column.objects?.[objectName]) };
      return {
        field,
        visible: typeof values.visible === 'boolean' ? values.visible : true,
        label: typeof values.label === 'string' && values.label.trim() ? values.label.trim().slice(0, 160) : field.label,
        order: numeric(values.order, index * 10, 0, 10000),
        format: FORMATS.some(item => item.value === values.format) ? values.format as DetailPresentation['format'] : 'auto',
      };
    }).sort((a, b) => a.order - b.order || a.field.key.localeCompare(b.field.key));
  }

  getFormattingModel(): powerbi.visuals.FormattingModel {
    const cards: powerbi.visuals.FormattingCard[] = Object.entries(SETTING_GROUPS).map(([name, group]) => {
      const slices = group.fields.map(item => this.optionSlice(name, item));
      return { uid: `ssm-${name}`, displayName: this.t(name, group.label), groups: [{ uid: `ssm-${name}-group`, displayName: this.t(name, group.label), slices }], revertToDefaultDescriptors: group.fields.map(item => ({ objectName: name, propertyName: item.property })) };
    });
    // ItemDropdown's items are supplied at runtime. Its capabilities enumeration
    // is intentionally empty, per the SDK's dynamic dropdown contract.
    const highlightItems = this.highlightFields.map(field => ({ value: field.key, displayName: field.source === 'discipline' ? this.t('highlightDiscipline', field.label) : field.label }));
    const highlightDescriptor = { objectName: 'highlighting', propertyName: 'highlightField' };
    cards.push({ uid: 'ssm-highlighting', displayName: this.t('highlighting', 'Highlighting'), groups: [{
      uid: 'ssm-highlighting-group', displayName: this.t('highlighting', 'Highlighting'), slices: [{
        uid: 'ssm-highlighting-highlightField', displayName: this.t('highlightField', 'Highlight column'),
        description: this.t('highlightField_description', 'Viewers choose values from this column. Hidden equipment fields remain available.'),
        control: { type: 'Dropdown', properties: { descriptor: highlightDescriptor, value: highlightItems.find(item => item.value === this.selectedHighlightField.key)!, items: highlightItems } },
      }],
    }], revertToDefaultDescriptors: [highlightDescriptor] });
    for (const kind of ['equipment', 'l1', 'l2', 'header'] as NodeKind[]) {
      const fields = this.detailsFor(kind);
      if (!fields.length) continue;
      const objectName = DETAIL_OBJECTS[kind]!;
      const descriptors: powerbi.visuals.FormattingDescriptor[] = [];
      const groups: powerbi.visuals.FormattingGroup[] = fields.map(presentation => {
        const uid = `${objectName}-${encodeURIComponent(presentation.field.key)}`;
        const descriptor = (propertyName: string): powerbi.visuals.FormattingDescriptor => {
          const result: powerbi.visuals.FormattingDescriptor = { objectName, propertyName, selector: { metadata: presentation.field.column.queryName || presentation.field.key } };
          descriptors.push(result);
          return result;
        };
        return {
          uid, displayName: presentation.field.label,
          slices: [
            { uid: `${uid}-visible`, displayName: this.t('visible', 'Show field'), control: { type: 'ToggleSwitch', properties: { descriptor: descriptor('visible'), value: presentation.visible } } },
            { uid: `${uid}-label`, displayName: this.t('label', 'Display label'), control: { type: 'TextInput', properties: { descriptor: descriptor('label'), value: presentation.label, placeholder: presentation.field.label } } },
            { uid: `${uid}-order`, displayName: this.t('order', 'Order'), control: { type: 'NumUpDown', properties: { descriptor: descriptor('order'), value: presentation.order, options: { minValue: { type: 0, value: 0 }, maxValue: { type: 1, value: 10000 } } } } },
            { uid: `${uid}-format`, displayName: this.t('format', 'Display format'), control: { type: 'Dropdown', properties: { descriptor: descriptor('format'), value: FORMATS.find(item => item.value === presentation.format)!, items: FORMATS } } },
          ],
        };
      });
      cards.push({ uid: `ssm-${objectName}`, displayName: this.t(objectName, DETAIL_LABELS[kind]!), groups, revertToDefaultDescriptors: descriptors });
    }
    return { cards };
  }

  private t(key: string, fallback: string): string { return this.translate(`Ssm_${key}`, fallback); }

  private optionSlice(objectName: string, setting: SettingDefinition): powerbi.visuals.FormattingSlice {
    const base = { uid: `ssm-${objectName}-${setting.property}`, displayName: this.t(setting.property, setting.label) };
    const descriptor = { objectName, propertyName: setting.property };
    const value = this.options[setting.property];
    if (setting.type === 'toggle') return { ...base, control: { type: 'ToggleSwitch', properties: { descriptor, value: value as boolean } } };
    if (setting.type === 'color') return { ...base, control: { type: 'ColorPicker', properties: { descriptor, value: { value: value as string } } } };
    if (setting.type === 'number') return { ...base, control: { type: 'NumUpDown', properties: { descriptor, value: value as number, options: { minValue: { type: 0, value: setting.min ?? 0 }, maxValue: { type: 1, value: setting.max ?? 10000 } } } } };
    return { ...base, control: { type: 'Dropdown', properties: { descriptor, value: setting.items!.find(item => item.value === value)!, items: setting.items! } } };
  }
}
