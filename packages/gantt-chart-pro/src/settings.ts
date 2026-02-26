import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, DataLabelFormattingCard, TitleFormattingCard } from '../../core/src';
class GanttSettings extends formattingSettings.SimpleCard {
  barHeight = new formattingSettings.NumUpDown({ name: 'barHeight', displayName: 'Bar Height', value: 24 });
  showProgress = new formattingSettings.ToggleSwitch({ name: 'showProgress', displayName: 'Show Progress', value: true });
  showToday = new formattingSettings.ToggleSwitch({ name: 'showToday', displayName: 'Show Today Line', value: true });
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
  slices = [this.barHeight, this.showProgress, this.showToday, this.showLabels, this.barOpacity, this.barCornerRadius, this.rowGap, this.labelWidth, this.todayLineWidth, this.todayLineStyle];
}

class ColorSettings extends formattingSettings.SimpleCard {
  barColor = new formattingSettings.ColorPicker({ name: 'barColor', displayName: 'Bar Color', value: { value: '#3B82F6' } });
  progressColor = new formattingSettings.ColorPicker({ name: 'progressColor', displayName: 'Progress Color', value: { value: '#10B981' } });
  todayColor = new formattingSettings.ColorPicker({ name: 'todayColor', displayName: 'Today Line Color', value: { value: '#EF4444' } });
  name = 'colorSettings';
  displayName = 'Colors';
  slices = [this.barColor, this.progressColor, this.todayColor];
}

class CardStyleSettings extends formattingSettings.SimpleCard {
  enableGlass = new formattingSettings.ToggleSwitch({ name: 'enableGlass', displayName: 'Glass Effect', value: true });
  backgroundOpacity = new formattingSettings.NumUpDown({ name: 'backgroundOpacity', displayName: 'Background Opacity (%)', value: 35 });
  borderRadius = new formattingSettings.NumUpDown({ name: 'borderRadius', displayName: 'Border Radius', value: 12 });
  name = 'cardSettings';
  displayName = 'Card Style';
  slices = [this.backgroundOpacity, this.borderRadius];
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

export class GanttChartProSettings extends formattingSettings.Model {
  ganttSettings = new GanttSettings();
  colorSettings = new ColorSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();
  dependencySettings = new DependencySettingsCard();
  hierarchySettings = new HierarchySettingsCard();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  axisFormattingCard = new AxisFormattingCard();

  cards = [this.ganttSettings, this.colorSettings,
 this.cardSettings,
    this.animationSettings, this.dependencySettings, this.hierarchySettings, this.dataLabelFormattingCard, this.titleFormattingCard, this.axisFormattingCard];
}
