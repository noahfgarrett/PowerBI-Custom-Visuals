import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard,
  DateFilterFormattingCard, NumberFormattingCard,
  CARD_STYLE_MODE_ITEMS
} from '../../core/src';

// ── Task Bars ────────────────────────────────────────────────────────

class TaskBarSettingsCard extends formattingSettings.SimpleCard {
  barHeight = new formattingSettings.NumUpDown({ name: 'barHeight', displayName: 'Bar Height', displayNameKey: 'GanttChartProSettings_DisplayName_0012', value: 24 });
  barOpacity = new formattingSettings.NumUpDown({ name: 'barOpacity', displayName: 'Bar Opacity (%)', displayNameKey: 'GanttChartProSettings_DisplayName_0013', value: 70 });
  barCornerRadius = new formattingSettings.NumUpDown({ name: 'barCornerRadius', displayName: 'Bar Corner Radius', displayNameKey: 'GanttChartProSettings_DisplayName_0014', value: 4 });
  rowGap = new formattingSettings.NumUpDown({ name: 'rowGap', displayName: 'Row Gap', displayNameKey: 'GanttChartProSettings_DisplayName_0015', value: 4 });
  labelWidth = new formattingSettings.NumUpDown({ name: 'labelWidth', displayName: 'Label Width', displayNameKey: 'GanttChartProSettings_DisplayName_0016', value: 120 });
  showLabels = new formattingSettings.ToggleSwitch({ name: 'showLabels', displayName: 'Show Labels', displayNameKey: 'GanttChartProSettings_DisplayName_0017', value: true });
  showProgress = new formattingSettings.ToggleSwitch({ name: 'showProgress', displayName: 'Show Progress', displayNameKey: 'GanttChartProSettings_DisplayName_0018', value: true });
  taskBorderColor = new formattingSettings.ColorPicker({ name: 'taskBorderColor', displayName: 'Task Border Color', displayNameKey: 'GanttChartProSettings_DisplayName_0019', value: { value: '' } });
  taskBorderWidth = new formattingSettings.NumUpDown({ name: 'taskBorderWidth', displayName: 'Task Border Width', displayNameKey: 'GanttChartProSettings_DisplayName_0020', value: 0 });

  labelFontSize = new formattingSettings.NumUpDown({ name: 'labelFontSize', displayName: 'Label Font Size', displayNameKey: 'GanttChartProSettings_DisplayName_0021', value: 11 });
  labelFontColor = new formattingSettings.ColorPicker({ name: 'labelFontColor', displayName: 'Label Font Color', displayNameKey: 'GanttChartProSettings_DisplayName_0022', value: { value: '' } });
  labelFontFamily = new formattingSettings.ItemDropdown({
    name: 'labelFontFamily',
    displayName: 'Label Font Family', displayNameKey: 'GanttChartProSettings_DisplayName_0023',
    items: [
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'GanttChartProSettings_DisplayName_0024' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'GanttChartProSettings_DisplayName_0025' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'GanttChartProSettings_DisplayName_0026' },
      { value: 'Helvetica', displayName: 'Helvetica', displayNameKey: 'GanttChartProSettings_DisplayName_0027' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'GanttChartProSettings_DisplayName_0028' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'GanttChartProSettings_DisplayName_0029' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'GanttChartProSettings_DisplayName_0030' },
    ],
    value: { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'GanttChartProSettings_DisplayName_0031' },
  });
  labelFontWeight = new formattingSettings.ItemDropdown({
    name: 'labelFontWeight',
    displayName: 'Label Font Weight', displayNameKey: 'GanttChartProSettings_DisplayName_0032',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'GanttChartProSettings_DisplayName_0033' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'GanttChartProSettings_DisplayName_0034' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'GanttChartProSettings_DisplayName_0035' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'GanttChartProSettings_DisplayName_0036' },
  });

  name = 'taskBarSettings';
  displayName = 'Task Bars';
  displayNameKey = 'GanttChartProSettings_DisplayName_0001';
  slices = [this.barHeight, this.barOpacity, this.barCornerRadius, this.rowGap, this.labelWidth, this.showLabels, this.showProgress, this.taskBorderColor, this.taskBorderWidth, this.labelFontSize, this.labelFontColor, this.labelFontFamily, this.labelFontWeight];
}

// ── Colors ───────────────────────────────────────────────────────────

class ColorSettings extends formattingSettings.SimpleCard {
  barColor = new formattingSettings.ColorPicker({ name: 'barColor', displayName: 'Bar Color', displayNameKey: 'GanttChartProSettings_DisplayName_0037', value: { value: '#3B82F6' } });
  progressColor = new formattingSettings.ColorPicker({ name: 'progressColor', displayName: 'Progress Color', displayNameKey: 'GanttChartProSettings_DisplayName_0038', value: { value: '#10B981' } });
  name = 'colorSettings';
  displayName = 'Colors';
  displayNameKey = 'GanttChartProSettings_DisplayName_0002';
  slices = [this.barColor, this.progressColor];
}

// ── Today Marker (consolidated) ─────────────────────────────────────

class TodayMarkerSettingsCard extends formattingSettings.SimpleCard {
  showTodayLine = new formattingSettings.ToggleSwitch({
    name: 'showTodayLine',
    displayName: 'Show Today Line', displayNameKey: 'GanttChartProSettings_DisplayName_0039',
    value: true,
  });

  lineColor = new formattingSettings.ColorPicker({
    name: 'lineColor',
    displayName: 'Today Line Color', displayNameKey: 'GanttChartProSettings_DisplayName_0040',
    value: { value: '#EF4444' },
  });

  todayLineWidth = new formattingSettings.NumUpDown({
    name: 'todayLineWidth',
    displayName: 'Today Line Width', displayNameKey: 'GanttChartProSettings_DisplayName_0041',
    value: 2,
  });

  todayLineStyle = new formattingSettings.ItemDropdown({
    name: 'todayLineStyle',
    displayName: 'Today Line Style', displayNameKey: 'GanttChartProSettings_DisplayName_0042',
    items: [{ value: 'solid', displayName: 'Solid', displayNameKey: 'GanttChartProSettings_DisplayName_0043' }, { value: 'dashed', displayName: 'Dashed', displayNameKey: 'GanttChartProSettings_DisplayName_0044' }],
    value: { value: 'dashed', displayName: 'Dashed', displayNameKey: 'GanttChartProSettings_DisplayName_0045' },
  });

  name = 'ganttTodaySettings';
  displayName = 'Today Marker';
  displayNameKey = 'GanttChartProSettings_DisplayName_0003';
  slices = [this.showTodayLine, this.lineColor, this.todayLineWidth, this.todayLineStyle];
}

// ── Dependencies ─────────────────────────────────────────────────────

class DependencySettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({ name: 'show', displayName: 'Show Dependencies', displayNameKey: 'GanttChartProSettings_DisplayName_0046', value: true });
  lineColor = new formattingSettings.ColorPicker({ name: 'lineColor', displayName: 'Arrow Color', displayNameKey: 'GanttChartProSettings_DisplayName_0047', value: { value: '#94A3B8' } });
  lineWidth = new formattingSettings.NumUpDown({ name: 'lineWidth', displayName: 'Line Width', displayNameKey: 'GanttChartProSettings_DisplayName_0048', value: 1.5 });
  arrowSize = new formattingSettings.NumUpDown({ name: 'arrowSize', displayName: 'Arrow Size', displayNameKey: 'GanttChartProSettings_DisplayName_0049', value: 6 });
  lineStyle = new formattingSettings.ItemDropdown({
    name: 'lineStyle',
    displayName: 'Line Style', displayNameKey: 'GanttChartProSettings_DisplayName_0050',
    items: [{ value: 'solid', displayName: 'Solid', displayNameKey: 'GanttChartProSettings_DisplayName_0051' }, { value: 'dashed', displayName: 'Dashed', displayNameKey: 'GanttChartProSettings_DisplayName_0052' }],
    value: { value: 'solid', displayName: 'Solid', displayNameKey: 'GanttChartProSettings_DisplayName_0053' },
  });

  name = 'dependencySettings';
  displayName = 'Dependencies';
  displayNameKey = 'GanttChartProSettings_DisplayName_0004';
  slices = [this.show, this.lineColor, this.lineWidth, this.arrowSize, this.lineStyle];
}

// ── Milestones ───────────────────────────────────────────────────────

class GanttMilestoneSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({ name: 'show', displayName: 'Show Milestones', displayNameKey: 'GanttChartProSettings_DisplayName_0054', value: false });
  shape = new formattingSettings.ItemDropdown({
    name: 'shape',
    displayName: 'Milestone Shape', displayNameKey: 'GanttChartProSettings_DisplayName_0055',
    items: [
      { value: 'diamond', displayName: 'Diamond', displayNameKey: 'GanttChartProSettings_DisplayName_0056' },
      { value: 'circle', displayName: 'Circle', displayNameKey: 'GanttChartProSettings_DisplayName_0057' },
      { value: 'triangle', displayName: 'Triangle', displayNameKey: 'GanttChartProSettings_DisplayName_0058' },
    ],
    value: { value: 'diamond', displayName: 'Diamond', displayNameKey: 'GanttChartProSettings_DisplayName_0059' },
  });
  color = new formattingSettings.ColorPicker({ name: 'color', displayName: 'Milestone Color', displayNameKey: 'GanttChartProSettings_DisplayName_0060', value: { value: '#F59E0B' } });

  name = 'ganttMilestoneSettings';
  displayName = 'Milestones';
  displayNameKey = 'GanttChartProSettings_DisplayName_0005';
  slices = [this.show, this.shape, this.color];
}

// ── Dependent Tasks ──────────────────────────────────────────────────

class GanttCriticalPathSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({ name: 'show', displayName: 'Highlight Dependent Tasks', displayNameKey: 'GanttChartProSettings_DisplayName_0061', value: false });
  color = new formattingSettings.ColorPicker({ name: 'color', displayName: 'Highlight Color', displayNameKey: 'GanttChartProSettings_DisplayName_0062', value: { value: '#EF4444' } });
  lineWidth = new formattingSettings.NumUpDown({ name: 'lineWidth', displayName: 'Outline Width', displayNameKey: 'GanttChartProSettings_DisplayName_0063', value: 3 });

  name = 'ganttCriticalPathSettings';
  displayName = 'Dependent Tasks';
  displayNameKey = 'GanttChartProSettings_DisplayName_0006';
  slices = [this.show, this.color, this.lineWidth];
}

// ── Task Shadow ──────────────────────────────────────────────────────

class GanttBaselineSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({ name: 'show', displayName: 'Show Task Shadow', displayNameKey: 'GanttChartProSettings_DisplayName_0064', value: false });
  color = new formattingSettings.ColorPicker({ name: 'color', displayName: 'Shadow Color', displayNameKey: 'GanttChartProSettings_DisplayName_0065', value: { value: '#94A3B8' } });
  opacity = new formattingSettings.NumUpDown({ name: 'opacity', displayName: 'Shadow Opacity (%)', displayNameKey: 'GanttChartProSettings_DisplayName_0066', value: 40 });

  name = 'ganttBaselineSettings';
  displayName = 'Task Shadow';
  displayNameKey = 'GanttChartProSettings_DisplayName_0007';
  slices = [this.show, this.color, this.opacity];
}

// ── Hierarchy & Grouping (merged) ────────────────────────────────────

class HierarchyGroupingSettingsCard extends formattingSettings.SimpleCard {
  enableGrouping = new formattingSettings.ToggleSwitch({ name: 'enableGrouping', displayName: 'Enable Grouping', displayNameKey: 'GanttChartProSettings_DisplayName_0067', value: false });
  collapsibleGroups = new formattingSettings.ToggleSwitch({ name: 'collapsibleGroups', displayName: 'Collapsible Groups', displayNameKey: 'GanttChartProSettings_DisplayName_0068', value: true });
  indentWidth = new formattingSettings.NumUpDown({ name: 'indentWidth', displayName: 'Indent Width', displayNameKey: 'GanttChartProSettings_DisplayName_0069', value: 20 });
  showToggle = new formattingSettings.ToggleSwitch({ name: 'showToggle', displayName: 'Show Toggle', displayNameKey: 'GanttChartProSettings_DisplayName_0070', value: true });
  collapseByDefault = new formattingSettings.ToggleSwitch({ name: 'collapseByDefault', displayName: 'Collapse By Default', displayNameKey: 'GanttChartProSettings_DisplayName_0071', value: false });

  name = 'hierarchyGroupingSettings';
  displayName = 'Hierarchy & Grouping';
  displayNameKey = 'GanttChartProSettings_DisplayName_0008';
  slices = [this.enableGrouping, this.collapsibleGroups, this.indentWidth, this.showToggle, this.collapseByDefault];
}

// ── Drill-Down ───────────────────────────────────────────────────────

class DrillDownSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Drill-Down', displayNameKey: 'GanttChartProSettings_DisplayName_0072',
    value: true,
  });

  showBreadcrumb = new formattingSettings.ToggleSwitch({
    name: 'showBreadcrumb',
    displayName: 'Show Breadcrumb', displayNameKey: 'GanttChartProSettings_DisplayName_0073',
    value: true,
  });

  breadcrumbFontSize = new formattingSettings.NumUpDown({
    name: 'breadcrumbFontSize',
    displayName: 'Breadcrumb Font Size', displayNameKey: 'GanttChartProSettings_DisplayName_0074',
    value: 11,
  });

  breadcrumbColor = new formattingSettings.ColorPicker({
    name: 'breadcrumbColor',
    displayName: 'Breadcrumb Color', displayNameKey: 'GanttChartProSettings_DisplayName_0075',
    value: { value: '#64748B' },
  });

  breadcrumbFontFamily = new formattingSettings.ItemDropdown({
    name: 'breadcrumbFontFamily',
    displayName: 'Breadcrumb Font Family', displayNameKey: 'GanttChartProSettings_DisplayName_0076',
    items: [
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'GanttChartProSettings_DisplayName_0077' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'GanttChartProSettings_DisplayName_0078' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'GanttChartProSettings_DisplayName_0079' },
      { value: 'Helvetica', displayName: 'Helvetica', displayNameKey: 'GanttChartProSettings_DisplayName_0080' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'GanttChartProSettings_DisplayName_0081' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'GanttChartProSettings_DisplayName_0082' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'GanttChartProSettings_DisplayName_0083' },
    ],
    value: { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'GanttChartProSettings_DisplayName_0084' },
  });

  breadcrumbFontWeight = new formattingSettings.ItemDropdown({
    name: 'breadcrumbFontWeight',
    displayName: 'Breadcrumb Font Weight', displayNameKey: 'GanttChartProSettings_DisplayName_0085',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'GanttChartProSettings_DisplayName_0086' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'GanttChartProSettings_DisplayName_0087' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'GanttChartProSettings_DisplayName_0088' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'GanttChartProSettings_DisplayName_0089' },
  });

  breadcrumbPadding = new formattingSettings.NumUpDown({
    name: 'breadcrumbPadding',
    displayName: 'Breadcrumb Padding', displayNameKey: 'GanttChartProSettings_DisplayName_0090',
    value: 8,
  });

  name = 'drillDownSettings';
  displayName = 'Drill-Down';
  displayNameKey = 'GanttChartProSettings_DisplayName_0009';
  slices = [
    this.enabled,
    this.showBreadcrumb,
    this.breadcrumbFontSize,
    this.breadcrumbColor,
    this.breadcrumbFontFamily,
    this.breadcrumbFontWeight,
    this.breadcrumbPadding,
  ];
}

// ── Card Style ───────────────────────────────────────────────────────

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style', displayNameKey: 'GanttChartProSettings_DisplayName_0091',
    items: CARD_STYLE_MODE_ITEMS,
    value: { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'GanttChartProSettings_DisplayName_0096' },
  });
  backgroundColor = new formattingSettings.ColorPicker({ name: 'backgroundColor', displayName: 'Background Color', displayNameKey: 'GanttChartProSettings_DisplayName_0097', value: { value: '' } });
  backgroundOpacity = new formattingSettings.NumUpDown({ name: 'backgroundOpacity', displayName: 'Background Opacity (%)', displayNameKey: 'GanttChartProSettings_DisplayName_0098', value: 85 });
  borderRadius = new formattingSettings.NumUpDown({ name: 'borderRadius', displayName: 'Border Radius', displayNameKey: 'GanttChartProSettings_DisplayName_0099', value: 12 });
  contentPadding = new formattingSettings.NumUpDown({ name: 'contentPadding', displayName: 'Content Padding', displayNameKey: 'GanttChartProSettings_DisplayName_0100', value: 8 });
  name = 'cardSettings';
  displayName = 'Card Style';
  displayNameKey = 'GanttChartProSettings_DisplayName_0010';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.contentPadding];
}

// ── Animation ────────────────────────────────────────────────────────

class AnimationSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({ name: 'enabled', displayName: 'Enable Animations', displayNameKey: 'GanttChartProSettings_DisplayName_0101', value: true });
  duration = new formattingSettings.NumUpDown({ name: 'duration', displayName: 'Duration (ms)', displayNameKey: 'GanttChartProSettings_DisplayName_0102', value: 600 });
  name = 'animationSettings';
  displayName = 'Animation';
  displayNameKey = 'GanttChartProSettings_DisplayName_0011';
  slices = [this.enabled, this.duration];
}

// ── Root Model ───────────────────────────────────────────────────────

export class GanttChartProSettings extends formattingSettings.Model {
  taskBarSettings = new TaskBarSettingsCard();
  colorSettings = new ColorSettings();
  ganttTodaySettings = new TodayMarkerSettingsCard();
  dependencySettings = new DependencySettingsCard();
  ganttMilestoneSettings = new GanttMilestoneSettings();
  ganttCriticalPathSettings = new GanttCriticalPathSettings();
  ganttBaselineSettings = new GanttBaselineSettings();
  hierarchyGroupingSettings = new HierarchyGroupingSettingsCard();
  drillDownSettings = new DrillDownSettingsCard();

  titleFormattingCard = new TitleFormattingCard();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  legendFormattingCard = new LegendFormattingCard();
  axisFormattingCard = new AxisFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  animationSettings = new AnimationSettings();
  cardSettings = new CardStyleSettings();

  numberFormattingCard = new NumberFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  cards = [
    this.taskBarSettings,
    this.colorSettings,
    this.ganttTodaySettings,
    this.dependencySettings,
    this.ganttMilestoneSettings,
    this.ganttCriticalPathSettings,
    this.ganttBaselineSettings,
    this.hierarchyGroupingSettings,
    this.drillDownSettings,
    this.titleFormattingCard,
    this.dataLabelFormattingCard,
    this.legendFormattingCard,
    this.axisFormattingCard,
    this.colorThemeFormattingCard,
    this.animationSettings,
    this.cardSettings,
    this.numberFormattingCard,
    this.conditionalFormattingCard,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
