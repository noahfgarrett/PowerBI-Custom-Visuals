/**
 * Progress Bar Stack — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, AnnotationFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, NumberFormattingCard,
  DateFilterFormattingCard,
} from '../../core/src';

// -- Bar Layout: dimensional properties only ----------------------------------

class BarLayoutSettings extends formattingSettings.SimpleCard {
  barHeight = new formattingSettings.NumUpDown({
    name: 'barHeight',
    displayName: 'Bar Height',
    value: 28,
  });

  gap = new formattingSettings.NumUpDown({
    name: 'gap',
    displayName: 'Row Gap',
    value: 12,
  });

  cornerRadius = new formattingSettings.NumUpDown({
    name: 'cornerRadius',
    displayName: 'Corner Radius',
    value: 8,
  });

  barCornerRadius = new formattingSettings.NumUpDown({
    name: 'barCornerRadius',
    displayName: 'Bar Corner Radius',
    value: 6,
  });

  showValue = new formattingSettings.ToggleSwitch({
    name: 'showValue',
    displayName: 'Show Value',
    value: true,
  });

  showPercent = new formattingSettings.ToggleSwitch({
    name: 'showPercent',
    displayName: 'Show Percentage',
    value: true,
  });

  showLabels = new formattingSettings.ToggleSwitch({
    name: 'showLabels',
    displayName: 'Show Labels',
    value: true,
  });

  labelPosition = new formattingSettings.ItemDropdown({
    name: 'labelPosition',
    displayName: 'Label Position',
    items: [
      { value: 'left', displayName: 'Left' },
      { value: 'right', displayName: 'Right' },
      { value: 'above', displayName: 'Above' },
    ],
    value: { value: 'left', displayName: 'Left' },
  });

  name = 'barSettings';
  displayName = 'Bar Layout';
  slices = [this.barHeight, this.gap, this.cornerRadius, this.barCornerRadius, this.showValue, this.showPercent, this.showLabels, this.labelPosition];
}

// -- Bar Appearance: all color controls consolidated --------------------------

class BarAppearanceSettings extends formattingSettings.SimpleCard {
  barColor = new formattingSettings.ColorPicker({
    name: 'barColor',
    displayName: 'Bar Color',
    value: { value: '#3B82F6' },
  });

  trackColor = new formattingSettings.ColorPicker({
    name: 'trackColor',
    displayName: 'Track Color',
    value: { value: '#E2E8F0' },
  });

  labelColor = new formattingSettings.ColorPicker({
    name: 'labelColor',
    displayName: 'Label Color',
    value: { value: '' },
  });

  labelFontSize = new formattingSettings.NumUpDown({
    name: 'labelFontSize',
    displayName: 'Label Font Size',
    value: 12,
  });

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

  gradientEnabled = new formattingSettings.ToggleSwitch({
    name: 'gradientEnabled',
    displayName: 'Enable Gradient',
    value: false,
  });

  gradientStartColor = new formattingSettings.ColorPicker({
    name: 'gradientStartColor',
    displayName: 'Gradient Start Color',
    value: { value: '#3B82F6' },
  });

  gradientEndColor = new formattingSettings.ColorPicker({
    name: 'gradientEndColor',
    displayName: 'Gradient End Color',
    value: { value: '#8B5CF6' },
  });

  name = 'barAppearance';
  displayName = 'Bar Appearance';
  slices = [this.barColor, this.trackColor, this.labelColor, this.labelFontSize, this.labelFontFamily, this.labelFontWeight, this.gradientEnabled, this.gradientStartColor, this.gradientEndColor];
}

class TargetSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Target',
    value: true,
  });

  color = new formattingSettings.ColorPicker({
    name: 'color',
    displayName: 'Target Color',
    value: { value: '#0F172A' },
  });

  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width',
    value: 2,
  });

  name = 'targetSettings';
  displayName = 'Target';
  slices = [this.show, this.color, this.lineWidth];
}

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

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background Color',
    value: { value: '' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Background Opacity (%)',
    value: 35,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius',
    value: 12,
  });

  name = 'cardSettings';
  displayName = 'Card Style';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius];
}

class AnimationSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Animations',
    value: true,
  });

  duration = new formattingSettings.NumUpDown({
    name: 'duration',
    displayName: 'Duration (ms)',
    value: 600,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  slices = [this.enabled, this.duration];
}

// -- Progress Milestone Settings -----------------------------------------------

class ProgressMilestoneSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Milestones',
    value: false,
  });

  milestones = new formattingSettings.TextInput({
    name: 'milestones',
    displayName: 'Milestone Positions (CSV %)',
    value: '25,50,75',
    placeholder: '25,50,75',
  });

  milestoneColor = new formattingSettings.ColorPicker({
    name: 'milestoneColor',
    displayName: 'Milestone Color',
    value: { value: '#94A3B8' },
  });

  name = 'progressMilestone';
  displayName = 'Milestones';
  slices = [this.show, this.milestones, this.milestoneColor];
}

export class ProgressBarStackSettings extends formattingSettings.Model {
  barSettings = new BarLayoutSettings();
  barAppearance = new BarAppearanceSettings();
  targetSettings = new TargetSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();

  dataLabelFormattingCard = new DataLabelFormattingCard();

  titleFormattingCard = new TitleFormattingCard();

  axisFormattingCard = new AxisFormattingCard();

  referenceLineFormattingCard = new ReferenceLineFormattingCard();
  trendLineFormattingCard = new TrendLineFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  annotationFormattingCard = new AnnotationFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  progressMilestone = new ProgressMilestoneSettings();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  numberFormattingCard = new NumberFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();
  cards = [
    this.barSettings,
    this.barAppearance,
    this.targetSettings,
    this.progressMilestone,
    this.titleFormattingCard,
    this.conditionalFormattingCard,
    this.cardSettings,
    this.colorThemeFormattingCard,
    this.animationSettings,
    this.referenceLineFormattingCard,
    this.trendLineFormattingCard,
    this.annotationFormattingCard,
    this.axisFormattingCard,
    this.dataLabelFormattingCard,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
    this.numberFormattingCard,
  ];
}
