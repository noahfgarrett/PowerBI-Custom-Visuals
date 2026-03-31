import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard,
  DateFilterFormattingCard, NumberFormattingCard,
} from '../../core/src';

// ── Task Bars ────────────────────────────────────────────────────────

class TaskBarSettingsCard extends formattingSettings.SimpleCard {
  barHeight = new formattingSettings.NumUpDown({ name: 'barHeight', displayName: 'Bar Height', value: 24 });
  barOpacity = new formattingSettings.NumUpDown({ name: 'barOpacity', displayName: 'Bar Opacity (%)', value: 70 });
  barCornerRadius = new formattingSettings.NumUpDown({ name: 'barCornerRadius', displayName: 'Bar Corner Radius', value: 4 });
  rowGap = new formattingSettings.NumUpDown({ name: 'rowGap', displayName: 'Row Gap', value: 4 });
  labelWidth = new formattingSettings.NumUpDown({ name: 'labelWidth', displayName: 'Label Width', value: 120 });
  showLabels = new formattingSettings.ToggleSwitch({ name: 'showLabels', displayName: 'Show Labels', value: true });
  showProgress = new formattingSettings.ToggleSwitch({ name: 'showProgress', displayName: 'Show Progress', value: true });
  taskBorderColor = new formattingSettings.ColorPicker({ name: 'taskBorderColor', displayName: 'Task Border Color', value: { value: '' } });
  taskBorderWidth = new formattingSettings.NumUpDown({ name: 'taskBorderWidth', displayName: 'Task Border Width', value: 0 });

  labelFontSize = new formattingSettings.NumUpDown({ name: 'labelFontSize', displayName: 'Label Font Size', value: 11 });
  labelFontColor = new formattingSettings.ColorPicker({ name: 'labelFontColor', displayName: 'Label Font Color', value: { value: '' } });
  labelFontFamily = new formattingSettings.ItemDropdown({
    name: 'labelFontFamily',
    displayName: 'Label Font Family',
    items: [
      { value: 'Segoe UI', displayName: 'Segoe UI' },
      { value: 'Arial', displayName: 'Arial' },
      { value: 'Calibri', displayName: 'Calibri' },
      { value: 'Helvetica', displayName: 'Helvetica' },
      { value: 'Times New Roman', displayName: 'Times New Roman' },
      { value: 'Verdana', displayName: 'Verdana' },
      { value: 'Georgia', displayName: 'Georgia' },
    ],
    value: { value: 'Segoe UI', displayName: 'Segoe UI' },
  });
  labelFontWeight = new formattingSettings.ItemDropdown({
    name: 'labelFontWeight',
    displayName: 'Label Font Weight',
    items: [
      { value: 'normal', displayName: 'Normal' },
      { value: 'bold', displayName: 'Bold' },
      { value: '600', displayName: 'Semi-Bold' },
    ],
    value: { value: 'normal', displayName: 'Normal' },
  });

  name = 'taskBarSettings';
  displayName = 'Task Bars';
  slices = [this.barHeight, this.barOpacity, this.barCornerRadius, this.rowGap, this.labelWidth, this.showLabels, this.showProgress, this.taskBorderColor, this.taskBorderWidth, this.labelFontSize, this.labelFontColor, this.labelFontFamily, this.labelFontWeight];
}

// ── Colors ───────────────────────────────────────────────────────────

class ColorSettings extends formattingSettings.SimpleCard {
  barColor = new formattingSettings.ColorPicker({ name: 'barColor', displayName: 'Bar Color', value: { value: '#3B82F6' } });
  progressColor = new formattingSettings.ColorPicker({ name: 'progressColor', displayName: 'Progress Color', value: { value: '#10B981' } });
  name = 'colorSettings';
  displayName = 'Colors';
  slices = [this.barColor, this.progressColor];
}

// ── Today Marker (consolidated) ─────────────────────────────────────

class TodayMarkerSettingsCard extends formattingSettings.SimpleCard {
  showTodayLine = new formattingSettings.ToggleSwitch({
    name: 'showTodayLine',
    displayName: 'Show Today Line',
    value: true,
  });

  lineColor = new formattingSettings.ColorPicker({
    name: 'lineColor',
    displayName: 'Today Line Color',
    value: { value: '#EF4444' },
  });

  todayLineWidth = new formattingSettings.NumUpDown({
    name: 'todayLineWidth',
    displayName: 'Today Line Width',
    value: 2,
  });

  todayLineStyle = new formattingSettings.ItemDropdown({
    name: 'todayLineStyle',
    displayName: 'Today Line Style',
    items: [{ value: 'solid', displayName: 'Solid' }, { value: 'dashed', displayName: 'Dashed' }],
    value: { value: 'dashed', displayName: 'Dashed' },
  });

  name = 'ganttTodaySettings';
  displayName = 'Today Marker';
  slices = [this.showTodayLine, this.lineColor, this.todayLineWidth, this.todayLineStyle];
}

// ── Dependencies ─────────────────────────────────────────────────────

class DependencySettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({ name: 'show', displayName: 'Show Dependencies', value: true });
  lineColor = new formattingSettings.ColorPicker({ name: 'lineColor', displayName: 'Arrow Color', value: { value: '#94A3B8' } });
  lineWidth = new formattingSettings.NumUpDown({ name: 'lineWidth', displayName: 'Line Width', value: 1.5 });
  arrowSize = new formattingSettings.NumUpDown({ name: 'arrowSize', displayName: 'Arrow Size', value: 6 });
  lineStyle = new formattingSettings.ItemDropdown({
    name: 'lineStyle',
    displayName: 'Line Style',
    items: [{ value: 'solid', displayName: 'Solid' }, { value: 'dashed', displayName: 'Dashed' }],
    value: { value: 'solid', displayName: 'Solid' },
  });

  name = 'dependencySettings';
  displayName = 'Dependencies';
  slices = [this.show, this.lineColor, this.lineWidth, this.arrowSize, this.lineStyle];
}

// ── Milestones ───────────────────────────────────────────────────────

class GanttMilestoneSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({ name: 'show', displayName: 'Show Milestones', value: false });
  shape = new formattingSettings.ItemDropdown({
    name: 'shape',
    displayName: 'Milestone Shape',
    items: [
      { value: 'diamond', displayName: 'Diamond' },
      { value: 'circle', displayName: 'Circle' },
      { value: 'triangle', displayName: 'Triangle' },
    ],
    value: { value: 'diamond', displayName: 'Diamond' },
  });
  color = new formattingSettings.ColorPicker({ name: 'color', displayName: 'Milestone Color', value: { value: '#F59E0B' } });

  name = 'ganttMilestoneSettings';
  displayName = 'Milestones';
  slices = [this.show, this.shape, this.color];
}

// ── Critical Path ────────────────────────────────────────────────────

class GanttCriticalPathSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({ name: 'show', displayName: 'Show Critical Path', value: false });
  color = new formattingSettings.ColorPicker({ name: 'color', displayName: 'Critical Path Color', value: { value: '#EF4444' } });
  lineWidth = new formattingSettings.NumUpDown({ name: 'lineWidth', displayName: 'Line Width', value: 3 });

  name = 'ganttCriticalPathSettings';
  displayName = 'Critical Path';
  slices = [this.show, this.color, this.lineWidth];
}

// ── Baseline ─────────────────────────────────────────────────────────

class GanttBaselineSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({ name: 'show', displayName: 'Show Baseline', value: false });
  color = new formattingSettings.ColorPicker({ name: 'color', displayName: 'Baseline Color', value: { value: '#94A3B8' } });
  opacity = new formattingSettings.NumUpDown({ name: 'opacity', displayName: 'Baseline Opacity (%)', value: 40 });

  name = 'ganttBaselineSettings';
  displayName = 'Baseline';
  slices = [this.show, this.color, this.opacity];
}

// ── Hierarchy & Grouping (merged) ────────────────────────────────────

class HierarchyGroupingSettingsCard extends formattingSettings.SimpleCard {
  enableGrouping = new formattingSettings.ToggleSwitch({ name: 'enableGrouping', displayName: 'Enable Grouping', value: false });
  collapsibleGroups = new formattingSettings.ToggleSwitch({ name: 'collapsibleGroups', displayName: 'Collapsible Groups', value: true });
  indentWidth = new formattingSettings.NumUpDown({ name: 'indentWidth', displayName: 'Indent Width', value: 20 });
  showToggle = new formattingSettings.ToggleSwitch({ name: 'showToggle', displayName: 'Show Toggle', value: true });
  collapseByDefault = new formattingSettings.ToggleSwitch({ name: 'collapseByDefault', displayName: 'Collapse By Default', value: false });

  name = 'hierarchyGroupingSettings';
  displayName = 'Hierarchy & Grouping';
  slices = [this.enableGrouping, this.collapsibleGroups, this.indentWidth, this.showToggle, this.collapseByDefault];
}

// ── Card Style ───────────────────────────────────────────────────────

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style',
    items: [
      { value: 'none', displayName: 'None' },
      { value: 'glass', displayName: 'Glass' },
      { value: 'elevated', displayName: 'Elevated' },
      { value: 'neumorphic', displayName: 'Neumorphic' },
    ],
    value: { value: 'glass', displayName: 'Glass' },
  });
  backgroundColor = new formattingSettings.ColorPicker({ name: 'backgroundColor', displayName: 'Background Color', value: { value: '' } });
  backgroundOpacity = new formattingSettings.NumUpDown({ name: 'backgroundOpacity', displayName: 'Background Opacity (%)', value: 85 });
  borderRadius = new formattingSettings.NumUpDown({ name: 'borderRadius', displayName: 'Border Radius', value: 12 });
  name = 'cardSettings';
  displayName = 'Card Style';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius];
}

// ── Animation ────────────────────────────────────────────────────────

class AnimationSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({ name: 'enabled', displayName: 'Enable Animations', value: true });
  duration = new formattingSettings.NumUpDown({ name: 'duration', displayName: 'Duration (ms)', value: 600 });
  name = 'animationSettings';
  displayName = 'Animation';
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
