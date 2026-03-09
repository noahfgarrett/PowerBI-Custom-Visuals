/**
 * Progress Bar Stack — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, AnnotationFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, NumberFormattingCard } from '../../core/src';
class BarSettings extends formattingSettings.SimpleCard {
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


  barCornerRadius = new formattingSettings.NumUpDown({

    name: 'barCornerRadius',

    displayName: 'Bar Corner Radius',

    value: 6,

  });

  trackColor = new formattingSettings.ColorPicker({

    name: 'trackColor',

    displayName: 'Track Color',

    value: { value: '' },

  });

  labelColor = new formattingSettings.ColorPicker({

    name: 'labelColor',

    displayName: 'Label Color',

    value: { value: '' },

  });


  name = 'barSettings';
  displayName = 'Bar Settings';
  slices = [this.barHeight, this.gap, this.cornerRadius, this.showValue, this.showPercent, this.barCornerRadius, this.trackColor, this.labelColor];
}

class ColorSettings extends formattingSettings.SimpleCard {
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

  name = 'colorSettings';
  displayName = 'Colors';
  slices = [this.barColor, this.trackColor];
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
  enableGlass = new formattingSettings.ToggleSwitch({
    name: 'enableGlass',
    displayName: 'Glass Effect',
    value: true,
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
  slices = [this.enableGlass, this.backgroundColor, this.backgroundOpacity, this.borderRadius];
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

  name = 'progressMilestone';
  displayName = 'Milestones';
  slices = [this.show, this.milestones];
}

// -- Progress Gradient Settings ------------------------------------------------

class ProgressGradientSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Gradient',
    value: false,
  });

  startColor = new formattingSettings.ColorPicker({
    name: 'startColor',
    displayName: 'Start Color',
    value: { value: '#3B82F6' },
  });

  endColor = new formattingSettings.ColorPicker({
    name: 'endColor',
    displayName: 'End Color',
    value: { value: '#8B5CF6' },
  });

  name = 'progressGradient';
  displayName = 'Gradient Fill';
  slices = [this.enabled, this.startColor, this.endColor];
}

export class ProgressBarStackSettings extends formattingSettings.Model {
  barSettings = new BarSettings();
  colorSettings = new ColorSettings();
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
  progressGradient = new ProgressGradientSettings();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  numberFormattingCard = new NumberFormattingCard();
  cards = [
    this.barSettings,
    this.colorSettings,
    this.targetSettings,
    this.cardSettings,
    this.animationSettings,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.axisFormattingCard,
    this.referenceLineFormattingCard,
    this.trendLineFormattingCard,
    this.conditionalFormattingCard,
    this.annotationFormattingCard,
    this.accessibilityFormattingCard,
    this.progressMilestone,
    this.progressGradient,
    this.colorThemeFormattingCard,
    this.numberFormattingCard,
  ];
}
