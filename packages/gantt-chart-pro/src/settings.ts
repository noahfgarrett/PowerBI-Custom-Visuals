import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard } from '../../core/src';
class GanttSettings extends formattingSettings.SimpleCard {
  barHeight = new formattingSettings.NumUpDown({ name: 'barHeight', displayName: 'Bar Height', value: 24 });
  showProgress = new formattingSettings.ToggleSwitch({ name: 'showProgress', displayName: 'Show Progress', value: true });
  showLabels = new formattingSettings.ToggleSwitch({ name: 'showLabels', displayName: 'Show Labels', value: true });

  barOpacity = new formattingSettings.NumUpDown({
    name: 'barOpacity',
    displayName: 'Bar Opacity (%)',
    value: 70,
  });
  barCornerRadius = new formattingSettings.NumUpDown({
    name: 'barCornerRadius',
    displayName: 'Bar Corner Radius',
    value: 4,
  });
  rowGap = new formattingSettings.NumUpDown({
    name: 'rowGap',
    displayName: 'Row Gap',
    value: 4,
  });
  labelWidth = new formattingSettings.NumUpDown({
    name: 'labelWidth',
    displayName: 'Label Width',
    value: 120,
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

  name = 'ganttSettings';
  displayName = 'Gantt';
  slices = [this.barHeight, this.showProgress, this.showLabels, this.barOpacity, this.barCornerRadius, this.rowGap, this.labelWidth, this.todayLineWidth, this.todayLineStyle];
}

class ColorSettings extends formattingSettings.SimpleCard {
  barColor = new formattingSettings.ColorPicker({ name: 'barColor', displayName: 'Bar Color', value: { value: '#3B82F6' } });
  progressColor = new formattingSettings.ColorPicker({ name: 'progressColor', displayName: 'Progress Color', value: { value: '#10B981' } });
  name = 'colorSettings';
  displayName = 'Colors';
  slices = [this.barColor, this.progressColor];
}

class CardStyleSettings extends formattingSettings.SimpleCard {
  enableGlass = new formattingSettings.ToggleSwitch({ name: 'enableGlass', displayName: 'Glass Effect', value: true });
  backgroundColor = new formattingSettings.ColorPicker({ name: 'backgroundColor', displayName: 'Background Color', value: { value: '' } });
  backgroundOpacity = new formattingSettings.NumUpDown({ name: 'backgroundOpacity', displayName: 'Background Opacity (%)', value: 35 });
  borderRadius = new formattingSettings.NumUpDown({ name: 'borderRadius', displayName: 'Border Radius', value: 12 });
  name = 'cardSettings';
  displayName = 'Card Style';
  slices = [this.enableGlass, this.backgroundColor, this.backgroundOpacity, this.borderRadius];
}

class HierarchySettingsCard extends formattingSettings.SimpleCard {
  indentWidth = new formattingSettings.NumUpDown({ name: 'indentWidth', displayName: 'Indent Width', value: 20 });
  showToggle = new formattingSettings.ToggleSwitch({ name: 'showToggle', displayName: 'Show Toggle', value: true });
  collapseByDefault = new formattingSettings.ToggleSwitch({ name: 'collapseByDefault', displayName: 'Collapse By Default', value: false });

  name = 'hierarchySettings';
  displayName = 'Hierarchy';
  slices = [this.indentWidth, this.showToggle, this.collapseByDefault];
}

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

class AnimationSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({ name: 'enabled', displayName: 'Enable Animations', value: true });
  duration = new formattingSettings.NumUpDown({ name: 'duration', displayName: 'Duration (ms)', value: 600 });
  name = 'animationSettings';
  displayName = 'Animation';
  slices = [this.enabled, this.duration];
}

// -- Gantt Milestone Settings -------------------------------------------------

class GanttMilestoneSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Milestones',
    value: false,
  });

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

  color = new formattingSettings.ColorPicker({
    name: 'color',
    displayName: 'Milestone Color',
    value: { value: '#F59E0B' },
  });

  name = 'ganttMilestoneSettings';
  displayName = 'Milestones';
  slices = [this.show, this.shape, this.color];
}

// -- Gantt Critical Path Settings ---------------------------------------------

class GanttCriticalPathSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Critical Path',
    value: false,
  });

  color = new formattingSettings.ColorPicker({
    name: 'color',
    displayName: 'Critical Path Color',
    value: { value: '#EF4444' },
  });

  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width',
    value: 3,
  });

  name = 'ganttCriticalPathSettings';
  displayName = 'Critical Path';
  slices = [this.show, this.color, this.lineWidth];
}

// -- Gantt Baseline Settings --------------------------------------------------

class GanttBaselineSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Baseline',
    value: false,
  });

  color = new formattingSettings.ColorPicker({
    name: 'color',
    displayName: 'Baseline Color',
    value: { value: '#94A3B8' },
  });

  opacity = new formattingSettings.NumUpDown({
    name: 'opacity',
    displayName: 'Baseline Opacity (%)',
    value: 40,
  });

  name = 'ganttBaselineSettings';
  displayName = 'Baseline';
  slices = [this.show, this.color, this.opacity];
}

// -- Gantt Group Settings -----------------------------------------------------

class GanttGroupSettings extends formattingSettings.SimpleCard {
  enableGrouping = new formattingSettings.ToggleSwitch({
    name: 'enableGrouping',
    displayName: 'Enable Grouping',
    value: false,
  });

  collapsibleGroups = new formattingSettings.ToggleSwitch({
    name: 'collapsibleGroups',
    displayName: 'Collapsible Groups',
    value: true,
  });

  name = 'ganttGroupSettings';
  displayName = 'Task Grouping';
  slices = [this.enableGrouping, this.collapsibleGroups];
}

// -- Gantt Today Settings -----------------------------------------------------

class GanttTodaySettings extends formattingSettings.SimpleCard {
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

  name = 'ganttTodaySettings';
  displayName = 'Today Marker';
  slices = [this.showTodayLine, this.lineColor];
}

export class GanttChartProSettings extends formattingSettings.Model {
  ganttSettings = new GanttSettings();
  colorSettings = new ColorSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();
  dependencySettings = new DependencySettingsCard();
  hierarchySettings = new HierarchySettingsCard();
  ganttMilestoneSettings = new GanttMilestoneSettings();
  ganttCriticalPathSettings = new GanttCriticalPathSettings();
  ganttBaselineSettings = new GanttBaselineSettings();
  ganttGroupSettings = new GanttGroupSettings();
  ganttTodaySettings = new GanttTodaySettings();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  axisFormattingCard = new AxisFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  cards = [
    this.ganttSettings,
    this.colorSettings,
    this.cardSettings,
    this.animationSettings,
    this.dependencySettings,
    this.hierarchySettings,
    this.ganttMilestoneSettings,
    this.ganttCriticalPathSettings,
    this.ganttBaselineSettings,
    this.ganttGroupSettings,
    this.ganttTodaySettings,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.axisFormattingCard,
    this.conditionalFormattingCard,
    this.accessibilityFormattingCard,
    this.colorThemeFormattingCard,
  ];
}
