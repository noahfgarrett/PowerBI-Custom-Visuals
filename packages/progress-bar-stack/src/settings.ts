/**
 * Progress Bar Stack — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, DataLabelFormattingCard, TitleFormattingCard, SortFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, AnnotationFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, NumberFormattingCard,
  DateFilterFormattingCard,
  CARD_STYLE_MODE_ITEMS
} from '../../core/src';

// -- Bar Layout: dimensional properties only ----------------------------------

class BarLayoutSettings extends formattingSettings.SimpleCard {
  contentGap = new formattingSettings.NumUpDown({
    name: 'contentGap',
    displayName: 'Row Content Gap', displayNameKey: 'ProgressBarStackSettings_DisplayName_0007',
    value: 10,
  });

  barHeight = new formattingSettings.NumUpDown({
    name: 'barHeight',
    displayName: 'Bar Height', displayNameKey: 'ProgressBarStackSettings_DisplayName_0008',
    value: 28,
  });

  gap = new formattingSettings.NumUpDown({
    name: 'gap',
    displayName: 'Row Gap', displayNameKey: 'ProgressBarStackSettings_DisplayName_0009',
    value: 12,
  });

  cornerRadius = new formattingSettings.NumUpDown({
    name: 'cornerRadius',
    displayName: 'Corner Radius', displayNameKey: 'ProgressBarStackSettings_DisplayName_0010',
    value: 8,
  });

  barCornerRadius = new formattingSettings.NumUpDown({
    name: 'barCornerRadius',
    displayName: 'Bar Corner Radius', displayNameKey: 'ProgressBarStackSettings_DisplayName_0011',
    value: 6,
  });

  showValue = new formattingSettings.ToggleSwitch({
    name: 'showValue',
    displayName: 'Show Value', displayNameKey: 'ProgressBarStackSettings_DisplayName_0012',
    value: true,
  });

  showPercent = new formattingSettings.ToggleSwitch({
    name: 'showPercent',
    displayName: 'Show Percentage', displayNameKey: 'ProgressBarStackSettings_DisplayName_0013',
    value: true,
  });

  showLabels = new formattingSettings.ToggleSwitch({
    name: 'showLabels',
    displayName: 'Show Labels', displayNameKey: 'ProgressBarStackSettings_DisplayName_0014',
    value: true,
  });

  labelPosition = new formattingSettings.ItemDropdown({
    name: 'labelPosition',
    displayName: 'Label Position', displayNameKey: 'ProgressBarStackSettings_DisplayName_0015',
    items: [
      { value: 'left', displayName: 'Left', displayNameKey: 'ProgressBarStackSettings_DisplayName_0059' },
      { value: 'right', displayName: 'Right', displayNameKey: 'ProgressBarStackSettings_DisplayName_0060' },
      { value: 'above', displayName: 'Above', displayNameKey: 'ProgressBarStackSettings_DisplayName_0061' },
      { value: 'insideStart', displayName: 'Inside Start', displayNameKey: 'ProgressBarStackSettings_DisplayName_0062' },
      { value: 'insideEnd', displayName: 'Inside End', displayNameKey: 'ProgressBarStackSettings_DisplayName_0063' },
      { value: 'inline', displayName: 'Inline', displayNameKey: 'ProgressBarStackSettings_DisplayName_0064' },
    ],
    value: { value: 'left', displayName: 'Left', displayNameKey: 'ProgressBarStackSettings_DisplayName_0065' },
  });

  name = 'barSettings';
  displayName = 'Bar Layout';
  displayNameKey = 'ProgressBarStackSettings_DisplayName_0001';
  slices = [this.contentGap, this.barHeight, this.gap, this.cornerRadius, this.barCornerRadius, this.showValue, this.showPercent, this.showLabels, this.labelPosition];
}

// -- Bar Appearance: all color controls consolidated --------------------------

class BarAppearanceSettings extends formattingSettings.SimpleCard {
  barColor = new formattingSettings.ColorPicker({
    name: 'barColor',
    displayName: 'Bar Color', displayNameKey: 'ProgressBarStackSettings_DisplayName_0020',
    value: { value: '#3B82F6' },
  });

  trackColor = new formattingSettings.ColorPicker({
    name: 'trackColor',
    displayName: 'Track Color', displayNameKey: 'ProgressBarStackSettings_DisplayName_0021',
    value: { value: '#E2E8F0' },
  });

  labelColor = new formattingSettings.ColorPicker({
    name: 'labelColor',
    displayName: 'Category Label Color', displayNameKey: 'ProgressBarStackSettings_DisplayName_0022',
    value: { value: '' },
  });

  labelFontSize = new formattingSettings.NumUpDown({
    name: 'labelFontSize',
    displayName: 'Category Label Size', displayNameKey: 'ProgressBarStackSettings_DisplayName_0023',
    value: 12,
  });

  labelFontFamily = new formattingSettings.ItemDropdown({
    name: 'labelFontFamily',
    displayName: 'Category Label Font', displayNameKey: 'ProgressBarStackSettings_DisplayName_0024',
    items: [
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'ProgressBarStackSettings_DisplayName_0025' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'ProgressBarStackSettings_DisplayName_0026' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'ProgressBarStackSettings_DisplayName_0027' },
      { value: 'Helvetica', displayName: 'Helvetica', displayNameKey: 'ProgressBarStackSettings_DisplayName_0028' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'ProgressBarStackSettings_DisplayName_0029' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'ProgressBarStackSettings_DisplayName_0030' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'ProgressBarStackSettings_DisplayName_0031' },
    ],
    value: { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'ProgressBarStackSettings_DisplayName_0032' },
  });

  labelFontWeight = new formattingSettings.ItemDropdown({
    name: 'labelFontWeight',
    displayName: 'Category Label Weight', displayNameKey: 'ProgressBarStackSettings_DisplayName_0033',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'ProgressBarStackSettings_DisplayName_0034' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'ProgressBarStackSettings_DisplayName_0035' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'ProgressBarStackSettings_DisplayName_0036' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'ProgressBarStackSettings_DisplayName_0037' },
  });

  gradientEnabled = new formattingSettings.ToggleSwitch({
    name: 'gradientEnabled',
    displayName: 'Enable Gradient', displayNameKey: 'ProgressBarStackSettings_DisplayName_0038',
    value: false,
  });

  gradientStartColor = new formattingSettings.ColorPicker({
    name: 'gradientStartColor',
    displayName: 'Gradient Start Color', displayNameKey: 'ProgressBarStackSettings_DisplayName_0039',
    value: { value: '#3B82F6' },
  });

  gradientEndColor = new formattingSettings.ColorPicker({
    name: 'gradientEndColor',
    displayName: 'Gradient End Color', displayNameKey: 'ProgressBarStackSettings_DisplayName_0040',
    value: { value: '#8B5CF6' },
  });

  name = 'barAppearance';
  displayName = 'Bar Appearance';
  displayNameKey = 'ProgressBarStackSettings_DisplayName_0002';
  slices = [this.barColor, this.trackColor, this.labelColor, this.labelFontSize, this.labelFontFamily, this.labelFontWeight, this.gradientEnabled, this.gradientStartColor, this.gradientEndColor];
}

class TargetSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Target', displayNameKey: 'ProgressBarStackSettings_DisplayName_0041',
    value: true,
  });

  color = new formattingSettings.ColorPicker({
    name: 'color',
    displayName: 'Target Color', displayNameKey: 'ProgressBarStackSettings_DisplayName_0042',
    value: { value: '#0F172A' },
  });

  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width', displayNameKey: 'ProgressBarStackSettings_DisplayName_0043',
    value: 2,
  });

  name = 'targetSettings';
  displayName = 'Target';
  displayNameKey = 'ProgressBarStackSettings_DisplayName_0003';
  slices = [this.show, this.color, this.lineWidth];
}

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style', displayNameKey: 'ProgressBarStackSettings_DisplayName_0044',
    items: CARD_STYLE_MODE_ITEMS,
    value: { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'ProgressBarStackSettings_DisplayName_0049' },
  });

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background Color', displayNameKey: 'ProgressBarStackSettings_DisplayName_0050',
    value: { value: '' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Background Opacity (%)', displayNameKey: 'ProgressBarStackSettings_DisplayName_0051',
    value: 35,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius', displayNameKey: 'ProgressBarStackSettings_DisplayName_0052',
    value: 12,
  });

  contentPadding = new formattingSettings.NumUpDown({
    name: 'contentPadding',
    displayName: 'Content Padding', displayNameKey: 'ProgressBarStackSettings_DisplayName_0053',
    value: 12,
  });

  name = 'cardSettings';
  displayName = 'Card Style';
  displayNameKey = 'ProgressBarStackSettings_DisplayName_0004';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.contentPadding];
}

class AnimationSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Animations', displayNameKey: 'ProgressBarStackSettings_DisplayName_0054',
    value: true,
  });

  duration = new formattingSettings.NumUpDown({
    name: 'duration',
    displayName: 'Duration (ms)', displayNameKey: 'ProgressBarStackSettings_DisplayName_0055',
    value: 600,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  displayNameKey = 'ProgressBarStackSettings_DisplayName_0005';
  slices = [this.enabled, this.duration];
}

// -- Progress Milestone Settings -----------------------------------------------

class ProgressMilestoneSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Milestones', displayNameKey: 'ProgressBarStackSettings_DisplayName_0056',
    value: false,
  });

  milestones = new formattingSettings.TextInput({
    name: 'milestones',
    displayName: 'Milestone Positions (%)', displayNameKey: 'ProgressBarStackSettings_DisplayName_0057',
    value: '25,50,75',
    placeholder: '25,50,75', placeholderKey: 'ProgressBarStackSettings_Placeholder_0001',
  });

  milestoneColor = new formattingSettings.ColorPicker({
    name: 'milestoneColor',
    displayName: 'Milestone Color', displayNameKey: 'ProgressBarStackSettings_DisplayName_0058',
    value: { value: '#94A3B8' },
  });

  name = 'progressMilestone';
  displayName = 'Milestones';
  displayNameKey = 'ProgressBarStackSettings_DisplayName_0006';
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
  sortFormattingCard = new SortFormattingCard();

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
    this.sortFormattingCard,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
    this.numberFormattingCard,
  ];
}
