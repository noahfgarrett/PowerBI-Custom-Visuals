import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { LegendFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, NumberFormattingCard, SortFormattingCard,
  ColorThemeFormattingCard,
  DateFilterFormattingCard,
  CARD_STYLE_MODE_ITEMS
} from '../../core/src';

// ── Indicator Appearance (iconSet moved here, shape removed) ────────

class IndicatorAppearanceSettings extends formattingSettings.SimpleCard {
  iconSet = new formattingSettings.ItemDropdown({
    name: 'iconSet',
    displayName: 'Icon Set', displayNameKey: 'StatusIndicatorSettings_DisplayName_0007',
    items: [
      { value: 'circle', displayName: 'Circle', displayNameKey: 'StatusIndicatorSettings_DisplayName_0008' },
      { value: 'square', displayName: 'Square', displayNameKey: 'StatusIndicatorSettings_DisplayName_0009' },
      { value: 'triangle', displayName: 'Triangle', displayNameKey: 'StatusIndicatorSettings_DisplayName_0010' },
      { value: 'diamond', displayName: 'Diamond', displayNameKey: 'StatusIndicatorSettings_DisplayName_0011' },
      { value: 'star', displayName: 'Star', displayNameKey: 'StatusIndicatorSettings_DisplayName_0012' },
      { value: 'heart', displayName: 'Heart', displayNameKey: 'StatusIndicatorSettings_DisplayName_0013' },
      { value: 'flag', displayName: 'Flag', displayNameKey: 'StatusIndicatorSettings_DisplayName_0014' },
      { value: 'check', displayName: 'Check', displayNameKey: 'StatusIndicatorSettings_DisplayName_0015' },
    ],
    value: { value: 'circle', displayName: 'Circle', displayNameKey: 'StatusIndicatorSettings_DisplayName_0016' },
  });

  iconSize = new formattingSettings.NumUpDown({
    name: 'iconSize',
    displayName: 'Icon Size', displayNameKey: 'StatusIndicatorSettings_DisplayName_0017',
    value: 24,
  });
  size = new formattingSettings.NumUpDown({ name: 'size', displayName: 'Label Font Size', displayNameKey: 'StatusIndicatorSettings_DisplayName_0018', value: 16 });
  labelColor = new formattingSettings.ColorPicker({
    name: 'labelColor',
    displayName: 'Label Color', displayNameKey: 'StatusIndicatorSettings_DisplayName_0019',
    value: { value: '' },
  });

  labelFontFamily = new formattingSettings.ItemDropdown({
    name: 'labelFontFamily',
    displayName: 'Label Font Family', displayNameKey: 'StatusIndicatorSettings_DisplayName_0020',
    items: [
      { value: '', displayName: 'Default', displayNameKey: 'StatusIndicatorSettings_DisplayName_0021' },
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'StatusIndicatorSettings_DisplayName_0022' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'StatusIndicatorSettings_DisplayName_0023' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'StatusIndicatorSettings_DisplayName_0024' },
      { value: 'Helvetica Neue', displayName: 'Helvetica Neue', displayNameKey: 'StatusIndicatorSettings_DisplayName_0025' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'StatusIndicatorSettings_DisplayName_0026' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'StatusIndicatorSettings_DisplayName_0027' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'StatusIndicatorSettings_DisplayName_0028' },
    ],
    value: { value: '', displayName: 'Default', displayNameKey: 'StatusIndicatorSettings_DisplayName_0029' },
  });

  labelFontWeight = new formattingSettings.ItemDropdown({
    name: 'labelFontWeight',
    displayName: 'Label Font Weight', displayNameKey: 'StatusIndicatorSettings_DisplayName_0030',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'StatusIndicatorSettings_DisplayName_0031' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'StatusIndicatorSettings_DisplayName_0032' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'StatusIndicatorSettings_DisplayName_0033' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'StatusIndicatorSettings_DisplayName_0034' },
  });

  name = 'indicatorSettings';
  displayName = 'Indicator Appearance';
  displayNameKey = 'StatusIndicatorSettings_DisplayName_0001';
  slices = [this.iconSet, this.iconSize, this.size, this.labelColor, this.labelFontFamily, this.labelFontWeight];
}

// ── Layout ──────────────────────────────────────────────────────────

class LayoutSettings extends formattingSettings.SimpleCard {
  layout = new formattingSettings.ItemDropdown({
    name: 'layout', displayName: 'Layout', displayNameKey: 'StatusIndicatorSettings_DisplayName_0035',
    items: [{ value: 'vertical', displayName: 'Vertical', displayNameKey: 'StatusIndicatorSettings_DisplayName_0036' }, { value: 'horizontal', displayName: 'Horizontal', displayNameKey: 'StatusIndicatorSettings_DisplayName_0037' }, { value: 'grid', displayName: 'Grid', displayNameKey: 'StatusIndicatorSettings_DisplayName_0038' }],
    value: { value: 'vertical', displayName: 'Vertical', displayNameKey: 'StatusIndicatorSettings_DisplayName_0039' },
  });

  itemGap = new formattingSettings.NumUpDown({
    name: 'itemGap',
    displayName: 'Item Gap', displayNameKey: 'StatusIndicatorSettings_DisplayName_0040',
    value: 8,
  });

  itemPadding = new formattingSettings.NumUpDown({
    name: 'itemPadding',
    displayName: 'Item Padding', displayNameKey: 'StatusIndicatorSettings_DisplayName_0041',
    value: 8,
  });

  name = 'layoutSettings';
  displayName = 'Layout';
  displayNameKey = 'StatusIndicatorSettings_DisplayName_0002';
  slices = [this.layout, this.itemGap, this.itemPadding];
}

// ── Thresholds & Colors (merged Thresholds + Status Levels) ─────────

class ThresholdsColorsSettings extends formattingSettings.SimpleCard {
  direction = new formattingSettings.ItemDropdown({
    name: 'direction', displayName: 'Direction', displayNameKey: 'StatusIndicatorSettings_DisplayName_0042',
    items: [{ value: 'higherIsBetter', displayName: 'Higher is Better', displayNameKey: 'StatusIndicatorSettings_DisplayName_0043' }, { value: 'lowerIsBetter', displayName: 'Lower is Better', displayNameKey: 'StatusIndicatorSettings_DisplayName_0044' }],
    value: { value: 'higherIsBetter', displayName: 'Higher is Better', displayNameKey: 'StatusIndicatorSettings_DisplayName_0045' },
  });
  useCustomThresholds = new formattingSettings.ToggleSwitch({ name: 'useCustomThresholds', displayName: 'Custom Thresholds', displayNameKey: 'StatusIndicatorSettings_DisplayName_0046', value: false });
  threshold1 = new formattingSettings.NumUpDown({ name: 'threshold1', displayName: 'Lower Threshold', displayNameKey: 'StatusIndicatorSettings_DisplayName_0047', value: 33 });
  threshold2 = new formattingSettings.NumUpDown({ name: 'threshold2', displayName: 'Upper Threshold', displayNameKey: 'StatusIndicatorSettings_DisplayName_0048', value: 66 });
  threshold3 = new formattingSettings.NumUpDown({ name: 'threshold3', displayName: 'Level 4 Threshold', displayNameKey: 'StatusIndicatorSettings_DisplayName_0108', value: 80 });
  threshold4 = new formattingSettings.NumUpDown({ name: 'threshold4', displayName: 'Level 5 Threshold', displayNameKey: 'StatusIndicatorSettings_DisplayName_0109', value: 90 });
  goodColor = new formattingSettings.ColorPicker({ name: 'goodColor', displayName: 'Good Color', displayNameKey: 'StatusIndicatorSettings_DisplayName_0049', value: { value: '#34D399' } });
  warningColor = new formattingSettings.ColorPicker({ name: 'warningColor', displayName: 'Warning Color', displayNameKey: 'StatusIndicatorSettings_DisplayName_0050', value: { value: '#FBBF24' } });
  criticalColor = new formattingSettings.ColorPicker({ name: 'criticalColor', displayName: 'Critical Color', displayNameKey: 'StatusIndicatorSettings_DisplayName_0051', value: { value: '#EF4444' } });
  levelCount = new formattingSettings.ItemDropdown({
    name: 'levelCount',
    displayName: 'Level Count', displayNameKey: 'StatusIndicatorSettings_DisplayName_0052',
    items: [
      { value: '3', displayName: '3', displayNameKey: 'StatusIndicatorSettings_DisplayName_0053' },
      { value: '4', displayName: '4', displayNameKey: 'StatusIndicatorSettings_DisplayName_0054' },
      { value: '5', displayName: '5', displayNameKey: 'StatusIndicatorSettings_DisplayName_0055' },
    ],
    value: { value: '3', displayName: '3', displayNameKey: 'StatusIndicatorSettings_DisplayName_0056' },
  });
  level4Color = new formattingSettings.ColorPicker({
    name: 'level4Color',
    displayName: 'Level 4 Color', displayNameKey: 'StatusIndicatorSettings_DisplayName_0057',
    value: { value: '#60A5FA' },
  });
  level5Color = new formattingSettings.ColorPicker({
    name: 'level5Color',
    displayName: 'Level 5 Color', displayNameKey: 'StatusIndicatorSettings_DisplayName_0058',
    value: { value: '#A78BFA' },
  });

  name = 'thresholdSettings';
  displayName = 'Thresholds & Colors';
  displayNameKey = 'StatusIndicatorSettings_DisplayName_0003';
  slices = [
    this.direction, this.useCustomThresholds, this.levelCount,
    this.threshold1, this.threshold2, this.threshold3, this.threshold4,
    this.goodColor, this.warningColor, this.criticalColor,
    this.level4Color, this.level5Color,
  ];
}

// ── Value Display (extracted from Thresholds + Status Display) ──────

class ValueDisplaySettings extends formattingSettings.SimpleCard {
  showValue = new formattingSettings.ToggleSwitch({ name: 'showValue', displayName: 'Show Value', displayNameKey: 'StatusIndicatorSettings_DisplayName_0059', value: false });
  valueFontSize = new formattingSettings.NumUpDown({ name: 'valueFontSize', displayName: 'Value Font Size', displayNameKey: 'StatusIndicatorSettings_DisplayName_0060', value: 10 });
  valueFontFamily = new formattingSettings.ItemDropdown({
    name: 'valueFontFamily',
    displayName: 'Value Font Family', displayNameKey: 'StatusIndicatorSettings_DisplayName_0061',
    items: [
      { value: '', displayName: 'Default', displayNameKey: 'StatusIndicatorSettings_DisplayName_0062' },
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'StatusIndicatorSettings_DisplayName_0063' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'StatusIndicatorSettings_DisplayName_0064' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'StatusIndicatorSettings_DisplayName_0065' },
      { value: 'Helvetica Neue', displayName: 'Helvetica Neue', displayNameKey: 'StatusIndicatorSettings_DisplayName_0066' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'StatusIndicatorSettings_DisplayName_0067' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'StatusIndicatorSettings_DisplayName_0068' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'StatusIndicatorSettings_DisplayName_0069' },
    ],
    value: { value: '', displayName: 'Default', displayNameKey: 'StatusIndicatorSettings_DisplayName_0070' },
  });
  valueFontWeight = new formattingSettings.ItemDropdown({
    name: 'valueFontWeight',
    displayName: 'Value Font Weight', displayNameKey: 'StatusIndicatorSettings_DisplayName_0071',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'StatusIndicatorSettings_DisplayName_0072' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'StatusIndicatorSettings_DisplayName_0073' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'StatusIndicatorSettings_DisplayName_0074' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'StatusIndicatorSettings_DisplayName_0075' },
  });
  showStatusText = new formattingSettings.ToggleSwitch({
    name: 'showStatusText',
    displayName: 'Show Status Text', displayNameKey: 'StatusIndicatorSettings_DisplayName_0076',
    value: false,
  });
  statusFontSize = new formattingSettings.NumUpDown({ name: 'statusFontSize', displayName: 'Status Font Size', displayNameKey: 'StatusIndicatorSettings_DisplayName_0077', value: 12 });
  statusFontColor = new formattingSettings.ColorPicker({
    name: 'statusFontColor',
    displayName: 'Status Font Color', displayNameKey: 'StatusIndicatorSettings_DisplayName_0078',
    value: { value: '' },
  });
  statusFontFamily = new formattingSettings.ItemDropdown({
    name: 'statusFontFamily',
    displayName: 'Status Font Family', displayNameKey: 'StatusIndicatorSettings_DisplayName_0079',
    items: [
      { value: '', displayName: 'Default', displayNameKey: 'StatusIndicatorSettings_DisplayName_0080' },
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'StatusIndicatorSettings_DisplayName_0081' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'StatusIndicatorSettings_DisplayName_0082' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'StatusIndicatorSettings_DisplayName_0083' },
      { value: 'Helvetica Neue', displayName: 'Helvetica Neue', displayNameKey: 'StatusIndicatorSettings_DisplayName_0084' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'StatusIndicatorSettings_DisplayName_0085' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'StatusIndicatorSettings_DisplayName_0086' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'StatusIndicatorSettings_DisplayName_0087' },
    ],
    value: { value: '', displayName: 'Default', displayNameKey: 'StatusIndicatorSettings_DisplayName_0088' },
  });
  statusFontWeight = new formattingSettings.ItemDropdown({
    name: 'statusFontWeight',
    displayName: 'Status Font Weight', displayNameKey: 'StatusIndicatorSettings_DisplayName_0089',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'StatusIndicatorSettings_DisplayName_0090' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'StatusIndicatorSettings_DisplayName_0091' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'StatusIndicatorSettings_DisplayName_0092' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'StatusIndicatorSettings_DisplayName_0093' },
  });
  showSparkline = new formattingSettings.ToggleSwitch({
    name: 'showSparkline',
    displayName: 'Show Value Bar', displayNameKey: 'StatusIndicatorSettings_DisplayName_0094',
    value: false,
  });

  name = 'valueDisplaySettings';
  displayName = 'Value Display';
  displayNameKey = 'StatusIndicatorSettings_DisplayName_0004';
  slices = [
    this.showValue, this.valueFontSize, this.valueFontFamily, this.valueFontWeight,
    this.showStatusText, this.statusFontSize, this.statusFontColor, this.statusFontFamily, this.statusFontWeight,
    this.showSparkline,
  ];
}

// ── Animation & Effects (merged Animation + Pulse) ──────────────────

class AnimationEffectsSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({ name: 'enabled', displayName: 'Enable Animations', displayNameKey: 'StatusIndicatorSettings_DisplayName_0095', value: true });
  duration = new formattingSettings.NumUpDown({ name: 'duration', displayName: 'Duration (ms)', displayNameKey: 'StatusIndicatorSettings_DisplayName_0096', value: 600 });
  enablePulse = new formattingSettings.ToggleSwitch({ name: 'enablePulse', displayName: 'Pulse Critical', displayNameKey: 'StatusIndicatorSettings_DisplayName_0097', value: true });
  name = 'animationSettings';
  displayName = 'Animation & Effects';
  displayNameKey = 'StatusIndicatorSettings_DisplayName_0005';
  slices = [this.enabled, this.duration, this.enablePulse];
}

// ── Card Style ──────────────────────────────────────────────────────

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style', displayNameKey: 'StatusIndicatorSettings_DisplayName_0098',
    items: CARD_STYLE_MODE_ITEMS,
    value: { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'StatusIndicatorSettings_DisplayName_0103' },
  });
  backgroundColor = new formattingSettings.ColorPicker({ name: 'backgroundColor', displayName: 'Background Color', displayNameKey: 'StatusIndicatorSettings_DisplayName_0104', value: { value: '' } });
  backgroundOpacity = new formattingSettings.NumUpDown({ name: 'backgroundOpacity', displayName: 'Background Opacity (%)', displayNameKey: 'StatusIndicatorSettings_DisplayName_0105', value: 35 });
  borderRadius = new formattingSettings.NumUpDown({ name: 'borderRadius', displayName: 'Border Radius', displayNameKey: 'StatusIndicatorSettings_DisplayName_0106', value: 12 });
  contentPadding = new formattingSettings.NumUpDown({ name: 'contentPadding', displayName: 'Content Padding', displayNameKey: 'StatusIndicatorSettings_DisplayName_0107', value: 12 });
  name = 'cardSettings';
  displayName = 'Card Style';
  displayNameKey = 'StatusIndicatorSettings_DisplayName_0006';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.contentPadding];
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
  sortFormattingCard = new SortFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();
  cards = [
    this.titleFormattingCard,
    this.indicatorSettings,
    this.layoutSettings,
    this.thresholdSettings,
    this.valueDisplaySettings,
    this.numberFormattingCard,
    this.conditionalFormattingCard,
    this.legendFormattingCard,
    this.sortFormattingCard,
    this.animationSettings,
    this.cardSettings,
    this.colorThemeFormattingCard,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
