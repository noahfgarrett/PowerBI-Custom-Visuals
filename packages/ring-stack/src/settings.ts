/**
 * Ring Stack -- Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, SortFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, NumberFormattingCard,
  DateFilterFormattingCard,
  CARD_STYLE_MODE_ITEMS
} from '../../core/src';

// -- Ring Settings: layout + gradient toggle (absorbed from RingGradient) ------

class RingSettings extends formattingSettings.SimpleCard {
  thickness = new formattingSettings.NumUpDown({
    name: 'thickness',
    displayName: 'Thickness (px)', displayNameKey: 'RingStackSettings_DisplayName_0008',
    value: 16,
  });

  gap = new formattingSettings.NumUpDown({
    name: 'gap',
    displayName: 'Gap (px)', displayNameKey: 'RingStackSettings_DisplayName_0009',
    value: 8,
  });

  chartPadding = new formattingSettings.NumUpDown({
    name: 'chartPadding',
    displayName: 'Chart Padding (px)', displayNameKey: 'RingStackSettings_DisplayName_0010',
    value: 8,
  });

  maxValue = new formattingSettings.NumUpDown({
    name: 'maxValue',
    displayName: 'Max Value', displayNameKey: 'RingStackSettings_DisplayName_0011',
    value: 100,
  });

  showLabels = new formattingSettings.ToggleSwitch({
    name: 'showLabels',
    displayName: 'Show Side Labels', displayNameKey: 'RingStackSettings_DisplayName_0012',
    value: true,
  });

  trackColor = new formattingSettings.ColorPicker({
    name: 'trackColor',
    displayName: 'Track Color', displayNameKey: 'RingStackSettings_DisplayName_0013',
    value: { value: '' },
  });

  trackOpacity = new formattingSettings.NumUpDown({
    name: 'trackOpacity',
    displayName: 'Track Opacity (%)', displayNameKey: 'RingStackSettings_DisplayName_0014',
    value: 15,
  });

  ringStrokeColor = new formattingSettings.ColorPicker({
    name: 'ringStrokeColor',
    displayName: 'Ring Stroke Color', displayNameKey: 'RingStackSettings_DisplayName_0015',
    value: { value: '' },
  });

  roundedCaps = new formattingSettings.ToggleSwitch({
    name: 'roundedCaps',
    displayName: 'Rounded Caps', displayNameKey: 'RingStackSettings_DisplayName_0016',
    value: true,
  });

  gradientEnabled = new formattingSettings.ToggleSwitch({
    name: 'gradientEnabled',
    displayName: 'Enable Gradient Fill', displayNameKey: 'RingStackSettings_DisplayName_0017',
    value: false,
  });

  showArcLabels = new formattingSettings.ToggleSwitch({
    name: 'showArcLabels',
    displayName: 'Show Labels on Rings', displayNameKey: 'RingStackSettings_DisplayName_0018',
    value: false,
  });

  showOverflow = new formattingSettings.ToggleSwitch({
    name: 'showOverflow',
    displayName: 'Show Values Above 100%', displayNameKey: 'RingStackSettings_DisplayName_0019',
    value: false,
  });

  name = 'ringSettings';
  displayName = 'Ring';
  displayNameKey = 'RingStackSettings_DisplayName_0001';
  slices = [this.thickness, this.gap, this.chartPadding, this.maxValue, this.showLabels, this.trackColor, this.trackOpacity, this.ringStrokeColor, this.roundedCaps, this.gradientEnabled, this.showArcLabels, this.showOverflow];
}

class ColorSettings extends formattingSettings.SimpleCard {
  ring1Color = new formattingSettings.ColorPicker({
    name: 'ring1Color',
    displayName: 'Ring 1 Color', displayNameKey: 'RingStackSettings_DisplayName_0020',
    value: { value: '' },
  });

  ring2Color = new formattingSettings.ColorPicker({
    name: 'ring2Color',
    displayName: 'Ring 2 Color', displayNameKey: 'RingStackSettings_DisplayName_0021',
    value: { value: '' },
  });

  ring3Color = new formattingSettings.ColorPicker({
    name: 'ring3Color',
    displayName: 'Ring 3 Color', displayNameKey: 'RingStackSettings_DisplayName_0022',
    value: { value: '' },
  });

  ring4Color = new formattingSettings.ColorPicker({
    name: 'ring4Color',
    displayName: 'Ring 4 Color', displayNameKey: 'RingStackSettings_DisplayName_0023',
    value: { value: '' },
  });

  ring5Color = new formattingSettings.ColorPicker({
    name: 'ring5Color',
    displayName: 'Ring 5 Color', displayNameKey: 'RingStackSettings_DisplayName_0024',
    value: { value: '' },
  });

  ring6Color = new formattingSettings.ColorPicker({
    name: 'ring6Color',
    displayName: 'Ring 6 Color', displayNameKey: 'RingStackSettings_DisplayName_0025',
    value: { value: '' },
  });

  name = 'colorSettings';
  displayName = 'Ring Colors';
  displayNameKey = 'RingStackSettings_DisplayName_0002';
  slices = [
    this.ring1Color,
    this.ring2Color,
    this.ring3Color,
    this.ring4Color,
    this.ring5Color,
    this.ring6Color,
  ];
}

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style', displayNameKey: 'RingStackSettings_DisplayName_0026',
    items: CARD_STYLE_MODE_ITEMS,
    value: { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'RingStackSettings_DisplayName_0031' },
  });

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background Color', displayNameKey: 'RingStackSettings_DisplayName_0032',
    value: { value: '' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Background Opacity (%)', displayNameKey: 'RingStackSettings_DisplayName_0033',
    value: 35,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius', displayNameKey: 'RingStackSettings_DisplayName_0034',
    value: 12,
  });

  contentPadding = new formattingSettings.NumUpDown({
    name: 'contentPadding',
    displayName: 'Content Padding', displayNameKey: 'RingStackSettings_DisplayName_0085',
    value: 8,
  });

  name = 'cardSettings';
  displayName = 'Card Style';
  displayNameKey = 'RingStackSettings_DisplayName_0003';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.contentPadding];
}

class CenterContentSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Center Content', displayNameKey: 'RingStackSettings_DisplayName_0035',
    value: true,
  });

  displayMode = new formattingSettings.ItemDropdown({
    name: 'displayMode',
    displayName: 'Display Mode', displayNameKey: 'RingStackSettings_DisplayName_0036',
    items: [
      { value: 'total', displayName: 'Total', displayNameKey: 'RingStackSettings_DisplayName_0037' },
      { value: 'count', displayName: 'Count', displayNameKey: 'RingStackSettings_DisplayName_0038' },
      { value: 'average', displayName: 'Average', displayNameKey: 'RingStackSettings_DisplayName_0039' },
      { value: 'custom', displayName: 'Custom', displayNameKey: 'RingStackSettings_DisplayName_0040' },
    ],
    value: { value: 'total', displayName: 'Total', displayNameKey: 'RingStackSettings_DisplayName_0041' },
  });

  customText = new formattingSettings.TextInput({
    name: 'customText',
    displayName: 'Custom Text', displayNameKey: 'RingStackSettings_DisplayName_0042',
    value: '',
    placeholder: 'Custom label', placeholderKey: 'RingStackSettings_Placeholder_0001',
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size', displayNameKey: 'RingStackSettings_DisplayName_0043',
    value: 24,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color', displayNameKey: 'RingStackSettings_DisplayName_0044',
    value: { value: '' },
  });

  showLabel = new formattingSettings.ToggleSwitch({
    name: 'showLabel',
    displayName: 'Show Label', displayNameKey: 'RingStackSettings_DisplayName_0045',
    value: true,
  });

  labelFontSize = new formattingSettings.NumUpDown({
    name: 'labelFontSize',
    displayName: 'Label Font Size', displayNameKey: 'RingStackSettings_DisplayName_0046',
    value: 11,
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Font Family', displayNameKey: 'RingStackSettings_DisplayName_0047',
    items: [
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'RingStackSettings_DisplayName_0048' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'RingStackSettings_DisplayName_0049' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'RingStackSettings_DisplayName_0050' },
      { value: 'Helvetica', displayName: 'Helvetica', displayNameKey: 'RingStackSettings_DisplayName_0051' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'RingStackSettings_DisplayName_0052' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'RingStackSettings_DisplayName_0053' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'RingStackSettings_DisplayName_0054' },
    ],
    value: { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'RingStackSettings_DisplayName_0055' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Font Weight', displayNameKey: 'RingStackSettings_DisplayName_0056',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'RingStackSettings_DisplayName_0057' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'RingStackSettings_DisplayName_0058' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'RingStackSettings_DisplayName_0059' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'RingStackSettings_DisplayName_0060' },
  });

  contentPadding = new formattingSettings.NumUpDown({
    name: 'contentPadding',
    displayName: 'Content Padding', displayNameKey: 'RingStackSettings_DisplayName_0061',
    value: 6,
  });

  name = 'centerContentSettings';
  displayName = 'Center Content';
  displayNameKey = 'RingStackSettings_DisplayName_0004';
  slices = [
    this.show,
    this.displayMode,
    this.customText,
    this.fontSize,
    this.fontColor,
    this.fontFamily,
    this.fontWeight,
    this.contentPadding,
    this.showLabel,
    this.labelFontSize,
  ];
}

class PerRingMaxSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Per-Ring Scale', displayNameKey: 'RingStackSettings_DisplayName_0062',
    value: false,
  });

  maxValues = new formattingSettings.TextInput({
    name: 'maxValues',
    displayName: 'Maximum Values', displayNameKey: 'RingStackSettings_DisplayName_0063',
    value: '',
    placeholder: '100,500,1000', placeholderKey: 'RingStackSettings_Placeholder_0002',
  });

  showPercentage = new formattingSettings.ToggleSwitch({
    name: 'showPercentage',
    displayName: 'Show Percentage', displayNameKey: 'RingStackSettings_DisplayName_0064',
    value: true,
  });

  name = 'perRingMaxSettings';
  displayName = 'Per-Ring Scale';
  displayNameKey = 'RingStackSettings_DisplayName_0005';
  slices = [this.enabled, this.maxValues, this.showPercentage];
}

// ── Side Label Settings ────────────────────────────────────────────────

class SideLabelSettings extends formattingSettings.SimpleCard {
  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size', displayNameKey: 'RingStackSettings_DisplayName_0065',
    value: 12,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color', displayNameKey: 'RingStackSettings_DisplayName_0066',
    value: { value: '' },
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Font Family', displayNameKey: 'RingStackSettings_DisplayName_0067',
    items: [
      { value: '', displayName: 'Default', displayNameKey: 'RingStackSettings_DisplayName_0068' },
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'RingStackSettings_DisplayName_0069' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'RingStackSettings_DisplayName_0070' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'RingStackSettings_DisplayName_0071' },
      { value: 'Helvetica Neue', displayName: 'Helvetica Neue', displayNameKey: 'RingStackSettings_DisplayName_0072' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'RingStackSettings_DisplayName_0073' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'RingStackSettings_DisplayName_0074' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'RingStackSettings_DisplayName_0075' },
    ],
    value: { value: '', displayName: 'Default', displayNameKey: 'RingStackSettings_DisplayName_0076' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Font Weight', displayNameKey: 'RingStackSettings_DisplayName_0077',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'RingStackSettings_DisplayName_0078' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'RingStackSettings_DisplayName_0079' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'RingStackSettings_DisplayName_0080' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'RingStackSettings_DisplayName_0081' },
  });

  labelPadding = new formattingSettings.NumUpDown({
    name: 'labelPadding',
    displayName: 'Label Spacing', displayNameKey: 'RingStackSettings_DisplayName_0082',
    value: 6,
  });

  name = 'sideLabelSettings';
  displayName = 'Side Labels';
  displayNameKey = 'RingStackSettings_DisplayName_0006';
  slices = [this.fontSize, this.fontColor, this.fontFamily, this.fontWeight, this.labelPadding];
}

class AnimationSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Animations', displayNameKey: 'RingStackSettings_DisplayName_0083',
    value: true,
  });

  duration = new formattingSettings.NumUpDown({
    name: 'duration',
    displayName: 'Duration (ms)', displayNameKey: 'RingStackSettings_DisplayName_0084',
    value: 600,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  displayNameKey = 'RingStackSettings_DisplayName_0007';
  slices = [this.enabled, this.duration];
}

export class RingStackSettings extends formattingSettings.Model {
  ringSettings = new RingSettings();
  colorSettings = new ColorSettings();
  centerContentSettings = new CenterContentSettings();
  cardSettings = new CardStyleSettings();
  sideLabelSettings = new SideLabelSettings();
  animationSettings = new AnimationSettings();
  perRingMaxSettings = new PerRingMaxSettingsCard();

  legendFormattingCard = new LegendFormattingCard();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  sortFormattingCard = new SortFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  numberFormattingCard = new NumberFormattingCard();

  dateFilterFormattingCard = new DateFilterFormattingCard();
  cards = [
    this.ringSettings,
    this.colorSettings,
    this.perRingMaxSettings,
    this.centerContentSettings,
    this.sideLabelSettings,
    this.titleFormattingCard,
    this.legendFormattingCard,
    this.conditionalFormattingCard,
    this.cardSettings,
    this.colorThemeFormattingCard,
    this.sortFormattingCard,
    this.animationSettings,
    this.numberFormattingCard,
    this.dataLabelFormattingCard,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
