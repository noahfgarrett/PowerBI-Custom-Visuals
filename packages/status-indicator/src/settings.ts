import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { LegendFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, NumberFormattingCard,
  ColorThemeFormattingCard,
  DateFilterFormattingCard,
} from '../../core/src';

// ── Indicator Appearance (iconSet moved here, shape removed) ────────

class IndicatorAppearanceSettings extends formattingSettings.SimpleCard {
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

  iconSize = new formattingSettings.NumUpDown({
    name: 'iconSize',
    displayName: 'Icon Size',
    value: 24,
  });
  size = new formattingSettings.NumUpDown({ name: 'size', displayName: 'Size', value: 16 });
  labelColor = new formattingSettings.ColorPicker({
    name: 'labelColor',
    displayName: 'Label Color',
    value: { value: '' },
  });

  name = 'indicatorSettings';
  displayName = 'Indicator Appearance';
  slices = [this.iconSet, this.iconSize, this.size, this.labelColor];
}

// ── Layout ──────────────────────────────────────────────────────────

class LayoutSettings extends formattingSettings.SimpleCard {
  layout = new formattingSettings.ItemDropdown({
    name: 'layout', displayName: 'Layout',
    items: [{ value: 'vertical', displayName: 'Vertical' }, { value: 'horizontal', displayName: 'Horizontal' }, { value: 'grid', displayName: 'Grid' }],
    value: { value: 'vertical', displayName: 'Vertical' },
  });

  name = 'layoutSettings';
  displayName = 'Layout';
  slices = [this.layout];
}

// ── Thresholds & Colors (merged Thresholds + Status Levels) ─────────

class ThresholdsColorsSettings extends formattingSettings.SimpleCard {
  direction = new formattingSettings.ItemDropdown({
    name: 'direction', displayName: 'Direction',
    items: [{ value: 'higherIsBetter', displayName: 'Higher is Better' }, { value: 'lowerIsBetter', displayName: 'Lower is Better' }],
    value: { value: 'higherIsBetter', displayName: 'Higher is Better' },
  });
  useCustomThresholds = new formattingSettings.ToggleSwitch({ name: 'useCustomThresholds', displayName: 'Custom Thresholds', value: false });
  threshold1 = new formattingSettings.NumUpDown({ name: 'threshold1', displayName: 'Warning Threshold', value: 33 });
  threshold2 = new formattingSettings.NumUpDown({ name: 'threshold2', displayName: 'Critical Threshold', value: 66 });
  goodColor = new formattingSettings.ColorPicker({ name: 'goodColor', displayName: 'Good Color', value: { value: '#34D399' } });
  warningColor = new formattingSettings.ColorPicker({ name: 'warningColor', displayName: 'Warning Color', value: { value: '#FBBF24' } });
  criticalColor = new formattingSettings.ColorPicker({ name: 'criticalColor', displayName: 'Critical Color', value: { value: '#EF4444' } });
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

  name = 'thresholdSettings';
  displayName = 'Thresholds & Colors';
  slices = [
    this.direction, this.useCustomThresholds, this.threshold1, this.threshold2,
    this.goodColor, this.warningColor, this.criticalColor,
    this.levelCount, this.level4Color, this.level5Color,
  ];
}

// ── Value Display (extracted from Thresholds + Status Display) ──────

class ValueDisplaySettings extends formattingSettings.SimpleCard {
  showValue = new formattingSettings.ToggleSwitch({ name: 'showValue', displayName: 'Show Value', value: false });
  valueFontSize = new formattingSettings.NumUpDown({ name: 'valueFontSize', displayName: 'Value Font Size', value: 10 });
  valueFontFamily = new formattingSettings.ItemDropdown({
    name: 'valueFontFamily',
    displayName: 'Value Font Family',
    items: [
      { value: '', displayName: 'Default' },
      { value: 'Segoe UI', displayName: 'Segoe UI' },
      { value: 'Arial', displayName: 'Arial' },
      { value: 'Calibri', displayName: 'Calibri' },
      { value: 'Helvetica Neue', displayName: 'Helvetica Neue' },
      { value: 'Times New Roman', displayName: 'Times New Roman' },
      { value: 'Verdana', displayName: 'Verdana' },
      { value: 'Georgia', displayName: 'Georgia' },
    ],
    value: { value: '', displayName: 'Default' },
  });
  valueFontWeight = new formattingSettings.ItemDropdown({
    name: 'valueFontWeight',
    displayName: 'Value Font Weight',
    items: [
      { value: 'normal', displayName: 'Normal' },
      { value: 'bold', displayName: 'Bold' },
      { value: '600', displayName: 'Semi-Bold' },
    ],
    value: { value: 'normal', displayName: 'Normal' },
  });
  showStatusText = new formattingSettings.ToggleSwitch({
    name: 'showStatusText',
    displayName: 'Show Status Text',
    value: false,
  });
  statusFontSize = new formattingSettings.NumUpDown({ name: 'statusFontSize', displayName: 'Status Font Size', value: 12 });
  statusFontColor = new formattingSettings.ColorPicker({
    name: 'statusFontColor',
    displayName: 'Status Font Color',
    value: { value: '' },
  });
  statusFontFamily = new formattingSettings.ItemDropdown({
    name: 'statusFontFamily',
    displayName: 'Status Font Family',
    items: [
      { value: '', displayName: 'Default' },
      { value: 'Segoe UI', displayName: 'Segoe UI' },
      { value: 'Arial', displayName: 'Arial' },
      { value: 'Calibri', displayName: 'Calibri' },
      { value: 'Helvetica Neue', displayName: 'Helvetica Neue' },
      { value: 'Times New Roman', displayName: 'Times New Roman' },
      { value: 'Verdana', displayName: 'Verdana' },
      { value: 'Georgia', displayName: 'Georgia' },
    ],
    value: { value: '', displayName: 'Default' },
  });
  statusFontWeight = new formattingSettings.ItemDropdown({
    name: 'statusFontWeight',
    displayName: 'Status Font Weight',
    items: [
      { value: 'normal', displayName: 'Normal' },
      { value: 'bold', displayName: 'Bold' },
      { value: '600', displayName: 'Semi-Bold' },
    ],
    value: { value: 'normal', displayName: 'Normal' },
  });
  showSparkline = new formattingSettings.ToggleSwitch({
    name: 'showSparkline',
    displayName: 'Show Sparkline',
    value: false,
  });

  name = 'valueDisplaySettings';
  displayName = 'Value Display';
  slices = [
    this.showValue, this.valueFontSize, this.valueFontFamily, this.valueFontWeight,
    this.showStatusText, this.statusFontSize, this.statusFontColor, this.statusFontFamily, this.statusFontWeight,
    this.showSparkline,
  ];
}

// ── Animation & Effects (merged Animation + Pulse) ──────────────────

class AnimationEffectsSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({ name: 'enabled', displayName: 'Enable Animations', value: true });
  duration = new formattingSettings.NumUpDown({ name: 'duration', displayName: 'Duration (ms)', value: 600 });
  enablePulse = new formattingSettings.ToggleSwitch({ name: 'enablePulse', displayName: 'Pulse Critical', value: true });
  name = 'animationSettings';
  displayName = 'Animation & Effects';
  slices = [this.enabled, this.duration, this.enablePulse];
}

// ── Card Style ──────────────────────────────────────────────────────

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
  backgroundOpacity = new formattingSettings.NumUpDown({ name: 'backgroundOpacity', displayName: 'Background Opacity (%)', value: 35 });
  borderRadius = new formattingSettings.NumUpDown({ name: 'borderRadius', displayName: 'Border Radius', value: 12 });
  name = 'cardSettings';
  displayName = 'Card Style';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius];
}

// ── Root Model ──────────────────────────────────────────────────────

export class StatusIndicatorSettings extends formattingSettings.Model {
  indicatorSettings = new IndicatorAppearanceSettings();
  layoutSettings = new LayoutSettings();
  thresholdSettings = new ThresholdsColorsSettings();
  valueDisplaySettings = new ValueDisplaySettings();
  animationSettings = new AnimationEffectsSettings();
  cardSettings = new CardStyleSettings();
  titleFormattingCard = new TitleFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();
  numberFormattingCard = new NumberFormattingCard();
  legendFormattingCard = new LegendFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();
  cards = [
    this.indicatorSettings,
    this.layoutSettings,
    this.thresholdSettings,
    this.valueDisplaySettings,
    this.animationSettings,
    this.cardSettings,
    this.titleFormattingCard,
    this.conditionalFormattingCard,
    this.numberFormattingCard,
    this.legendFormattingCard,
    this.colorThemeFormattingCard,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
