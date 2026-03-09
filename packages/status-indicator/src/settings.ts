import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard } from '../../core/src';
class IndicatorSettings extends formattingSettings.SimpleCard {
  shape = new formattingSettings.ItemDropdown({
    name: 'shape', displayName: 'Shape',
    items: [{ value: 'circle', displayName: 'Circle' }, { value: 'square', displayName: 'Square' }, { value: 'diamond', displayName: 'Diamond' }],
    value: { value: 'circle', displayName: 'Circle' },
  });
  size = new formattingSettings.NumUpDown({ name: 'size', displayName: 'Size', value: 16 });
  layout = new formattingSettings.ItemDropdown({
    name: 'layout', displayName: 'Layout',
    items: [{ value: 'vertical', displayName: 'Vertical' }, { value: 'horizontal', displayName: 'Horizontal' }, { value: 'grid', displayName: 'Grid' }],
    value: { value: 'vertical', displayName: 'Vertical' },
  });

  iconSize = new formattingSettings.NumUpDown({
    name: 'iconSize',
    displayName: 'Icon Size',
    value: 24,
  });
  labelColor = new formattingSettings.ColorPicker({
    name: 'labelColor',
    displayName: 'Label Color',
    value: { value: '' },
  });

  name = 'indicatorSettings';
  displayName = 'Indicator';
  slices = [this.shape, this.size, this.layout, this.iconSize, this.labelColor];
}

class ThresholdSettings extends formattingSettings.SimpleCard {
  goodColor = new formattingSettings.ColorPicker({ name: 'goodColor', displayName: 'Good Color', value: { value: '#34D399' } });
  warningColor = new formattingSettings.ColorPicker({ name: 'warningColor', displayName: 'Warning Color', value: { value: '#FBBF24' } });
  criticalColor = new formattingSettings.ColorPicker({ name: 'criticalColor', displayName: 'Critical Color', value: { value: '#EF4444' } });
  direction = new formattingSettings.ItemDropdown({
    name: 'direction', displayName: 'Direction',
    items: [{ value: 'higherIsBetter', displayName: 'Higher is Better' }, { value: 'lowerIsBetter', displayName: 'Lower is Better' }],
    value: { value: 'higherIsBetter', displayName: 'Higher is Better' },
  });
  useCustomThresholds = new formattingSettings.ToggleSwitch({ name: 'useCustomThresholds', displayName: 'Custom Thresholds', value: false });
  threshold1 = new formattingSettings.NumUpDown({ name: 'threshold1', displayName: 'Warning Threshold', value: 33 });
  threshold2 = new formattingSettings.NumUpDown({ name: 'threshold2', displayName: 'Critical Threshold', value: 66 });
  showValue = new formattingSettings.ToggleSwitch({ name: 'showValue', displayName: 'Show Value', value: false });
  valueFontSize = new formattingSettings.NumUpDown({ name: 'valueFontSize', displayName: 'Value Font Size', value: 10 });
  name = 'thresholdSettings';
  displayName = 'Thresholds';
  slices = [this.goodColor, this.warningColor, this.criticalColor, this.direction,
    this.useCustomThresholds, this.threshold1, this.threshold2, this.showValue, this.valueFontSize];
}

class PulseSettings extends formattingSettings.SimpleCard {
  enablePulse = new formattingSettings.ToggleSwitch({ name: 'enablePulse', displayName: 'Pulse Critical', value: true });
  name = 'pulseSettings';
  displayName = 'Pulse';
  slices = [this.enablePulse];
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

class AnimationSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({ name: 'enabled', displayName: 'Enable Animations', value: true });
  duration = new formattingSettings.NumUpDown({ name: 'duration', displayName: 'Duration (ms)', value: 600 });
  name = 'animationSettings';
  displayName = 'Animation';
  slices = [this.enabled, this.duration];
}

// -- Status Display Settings --------------------------------------------------

class StatusDisplaySettings extends formattingSettings.SimpleCard {
  showSparkline = new formattingSettings.ToggleSwitch({
    name: 'showSparkline',
    displayName: 'Show Sparkline',
    value: false,
  });

  showStatusText = new formattingSettings.ToggleSwitch({
    name: 'showStatusText',
    displayName: 'Show Status Text',
    value: false,
  });

  iconSet = new formattingSettings.ItemDropdown({
    name: 'iconSet',
    displayName: 'Icon Set',
    items: [
      { value: 'circle', displayName: 'Circle' },
      { value: 'square', displayName: 'Square' },
      { value: 'triangle', displayName: 'Triangle' },
      { value: 'diamond', displayName: 'Diamond' },
      { value: 'star', displayName: 'Star' },
      { value: 'heart', displayName: 'Heart' },
      { value: 'flag', displayName: 'Flag' },
      { value: 'check', displayName: 'Check' },
    ],
    value: { value: 'circle', displayName: 'Circle' },
  });

  name = 'statusDisplaySettings';
  displayName = 'Status Display';
  slices = [this.showSparkline, this.showStatusText, this.iconSet];
}

// -- Status Level Settings ----------------------------------------------------

class StatusLevelSettings extends formattingSettings.SimpleCard {
  levelCount = new formattingSettings.ItemDropdown({
    name: 'levelCount',
    displayName: 'Level Count',
    items: [
      { value: '3', displayName: '3' },
      { value: '4', displayName: '4' },
      { value: '5', displayName: '5' },
    ],
    value: { value: '3', displayName: '3' },
  });

  level4Color = new formattingSettings.ColorPicker({
    name: 'level4Color',
    displayName: 'Level 4 Color',
    value: { value: '#60A5FA' },
  });

  level5Color = new formattingSettings.ColorPicker({
    name: 'level5Color',
    displayName: 'Level 5 Color',
    value: { value: '#A78BFA' },
  });

  name = 'statusLevelSettings';
  displayName = 'Status Levels';
  slices = [this.levelCount, this.level4Color, this.level5Color];
}

export class StatusIndicatorSettings extends formattingSettings.Model {
  indicatorSettings = new IndicatorSettings();
  thresholdSettings = new ThresholdSettings();
  pulseSettings = new PulseSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();
  statusDisplaySettings = new StatusDisplaySettings();
  statusLevelSettings = new StatusLevelSettings();
  titleFormattingCard = new TitleFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  cards = [
    this.indicatorSettings,
    this.thresholdSettings,
    this.pulseSettings,
    this.cardSettings,
    this.animationSettings,
    this.statusDisplaySettings,
    this.statusLevelSettings,
    this.titleFormattingCard,
    this.conditionalFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
