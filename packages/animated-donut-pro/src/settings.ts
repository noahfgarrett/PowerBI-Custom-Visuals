/**
 * Animated Donut Pro — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, NumberFormattingCard,
  DateFilterFormattingCard,
  CARD_STYLE_MODE_ITEMS
} from '../../core/src';

// ── Top N / Others ──────────────────────────────────────────────────

class TopNSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Top N', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0009',
    value: false,
  });

  topN = new formattingSettings.NumUpDown({
    name: 'topN',
    displayName: 'Top N', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0010',
    value: 10,
  });

  othersLabel = new formattingSettings.TextInput({
    name: 'othersLabel',
    displayName: 'Others Label', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0011',
    value: 'Others',
    placeholder: 'e.g. Others', placeholderKey: 'AnimatedDonutProSettings_Placeholder_0001',
  });

  othersColor = new formattingSettings.ColorPicker({
    name: 'othersColor',
    displayName: 'Others Color', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0012',
    value: { value: '#94A3B8' },
  });

  sortBy = new formattingSettings.ItemDropdown({
    name: 'sortBy',
    displayName: 'Sort By', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0013',
    items: [
      { value: 'value', displayName: 'Value (Highest First)', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0014' },
      { value: 'name', displayName: 'Name (A-Z)', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0015' },
    ],
    value: { value: 'value', displayName: 'Value', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0016' },
  });

  name = 'topNSettings';
  displayName = 'Top N and Others';
  displayNameKey = 'AnimatedDonutProSettings_DisplayName_0001';
  slices = [this.enabled, this.topN, this.othersLabel, this.othersColor, this.sortBy];
}

// ── Donut Settings ──────────────────────────────────────────────────

class DonutSettings extends formattingSettings.SimpleCard {
  innerRadius = new formattingSettings.NumUpDown({
    name: 'innerRadius',
    displayName: 'Inner Radius (%)', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0017',
    value: 55,
  });

  arcShape = new formattingSettings.ItemDropdown({
    name: 'arcShape',
    displayName: 'Arc Shape', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0018',
    items: [
      { value: 'full', displayName: 'Full Circle (360°)', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0019' },
      { value: 'semi', displayName: 'Semi Circle (180°)', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0020' },
      { value: 'threeQuarter', displayName: 'Three Quarter (270°)', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0021' },
    ],
    value: { value: 'full', displayName: 'Full Circle (360°)', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0022' },
  });

  showCenter = new formattingSettings.ToggleSwitch({
    name: 'showCenter',
    displayName: 'Show Center Value', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0023',
    value: true,
  });

  showLabels = new formattingSettings.ToggleSwitch({
    name: 'showLabels',
    displayName: 'Show Labels', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0024',
    value: true,
  });


  segmentStrokeColor = new formattingSettings.ColorPicker({

    name: 'segmentStrokeColor',

    displayName: 'Segment Stroke Color', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0025',

    value: { value: '' },

  });

  segmentStrokeWidth = new formattingSettings.NumUpDown({

    name: 'segmentStrokeWidth',

    displayName: 'Segment Stroke Width', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0026',

    value: 1.5,

  });

  outerPadding = new formattingSettings.NumUpDown({
    name: 'outerPadding',
    displayName: 'Outer Padding', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0029',
    value: 8,
  });


  name = 'donutSettings';
  displayName = 'Donut';
  displayNameKey = 'AnimatedDonutProSettings_DisplayName_0002';
  slices = [this.innerRadius, this.arcShape, this.showCenter, this.showLabels, this.segmentStrokeColor, this.segmentStrokeWidth, this.outerPadding];
}

// ── Value Settings (center display) ─────────────────────────────────

class ValueSettings extends formattingSettings.SimpleCard {
  displayMode = new formattingSettings.ItemDropdown({
    name: 'displayMode',
    displayName: 'Display Mode', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0087',
    items: [
      { value: 'selectedOrTotal', displayName: 'Selected Slice or Total', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0088' },
      { value: 'total', displayName: 'Total', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0089' },
      { value: 'selectedOnly', displayName: 'Selected Slice Only', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0090' },
      { value: 'firstSlice', displayName: 'First Slice', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0091' },
      { value: 'customText', displayName: 'Custom Text', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0092' },
    ],
    value: { value: 'selectedOrTotal', displayName: 'Selected Slice or Total', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0093' },
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0030',
    value: 28,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0031',
    value: { value: '' },
  });

  prefix = new formattingSettings.TextInput({
    name: 'prefix',
    displayName: 'Prefix', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0032',
    value: '',
    placeholder: 'e.g. $', placeholderKey: 'AnimatedDonutProSettings_Placeholder_0002',
  });

  suffix = new formattingSettings.TextInput({
    name: 'suffix',
    displayName: 'Suffix', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0033',
    value: '',
    placeholder: 'e.g. %', placeholderKey: 'AnimatedDonutProSettings_Placeholder_0003',
  });

  decimalPlaces = new formattingSettings.NumUpDown({
    name: 'decimalPlaces',
    displayName: 'Decimal Places', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0034',
    value: 0,
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Font Family', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0035',
    items: [
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0036' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0037' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0038' },
      { value: 'Helvetica', displayName: 'Helvetica', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0039' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0040' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0041' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0042' },
    ],
    value: { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0043' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Font Weight', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0044',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0045' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0046' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0047' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0048' },
  });

  verticalOffset = new formattingSettings.NumUpDown({
    name: 'verticalOffset',
    displayName: 'Vertical Offset', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0049',
    value: 0,
  });

  customText = new formattingSettings.TextInput({
    name: 'customText',
    displayName: 'Custom Text', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0094',
    value: '',
    placeholder: 'e.g. Total Revenue', placeholderKey: 'AnimatedDonutProSettings_Placeholder_0004',
  });

  noSelectionText = new formattingSettings.TextInput({
    name: 'noSelectionText',
    displayName: 'No Selection Text', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0095',
    value: 'Select a slice',
    placeholder: 'e.g. Select a slice', placeholderKey: 'AnimatedDonutProSettings_Placeholder_0005',
  });

  captionMode = new formattingSettings.ItemDropdown({
    name: 'captionMode',
    displayName: 'Caption', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0096',
    items: [
      { value: 'none', displayName: 'None', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0097' },
      { value: 'auto', displayName: 'Auto', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0098' },
      { value: 'custom', displayName: 'Custom', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0099' },
    ],
    value: { value: 'none', displayName: 'None', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0100' },
  });

  customCaption = new formattingSettings.TextInput({
    name: 'customCaption',
    displayName: 'Custom Caption', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0101',
    value: '',
    placeholder: 'e.g. Revenue', placeholderKey: 'AnimatedDonutProSettings_Placeholder_0006',
  });

  captionFontSize = new formattingSettings.NumUpDown({
    name: 'captionFontSize',
    displayName: 'Caption Font Size', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0102',
    value: 12,
  });

  captionColor = new formattingSettings.ColorPicker({
    name: 'captionColor',
    displayName: 'Caption Color', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0103',
    value: { value: '' },
  });

  captionFontFamily = new formattingSettings.ItemDropdown({
    name: 'captionFontFamily',
    displayName: 'Caption Font Family', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0104',
    items: [
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0105' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0106' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0107' },
      { value: 'Helvetica', displayName: 'Helvetica', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0108' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0109' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0110' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0111' },
    ],
    value: { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0112' },
  });

  captionFontWeight = new formattingSettings.ItemDropdown({
    name: 'captionFontWeight',
    displayName: 'Caption Font Weight', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0113',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0114' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0115' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0116' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0117' },
  });

  captionSpacing = new formattingSettings.NumUpDown({
    name: 'captionSpacing',
    displayName: 'Caption Spacing', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0118',
    value: 6,
  });

  name = 'valueSettings';
  displayName = 'Center Value';
  displayNameKey = 'AnimatedDonutProSettings_DisplayName_0003';
  slices = [
    this.displayMode,
    this.fontSize,
    this.fontColor,
    this.fontFamily,
    this.fontWeight,
    this.verticalOffset,
    this.prefix,
    this.suffix,
    this.decimalPlaces,
    this.customText,
    this.noSelectionText,
    this.captionMode,
    this.customCaption,
    this.captionFontSize,
    this.captionColor,
    this.captionFontFamily,
    this.captionFontWeight,
    this.captionSpacing,
  ];
}

// ── Card Style ──────────────────────────────────────────────────────

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0050',
    items: CARD_STYLE_MODE_ITEMS,
    value: { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0055' },
  });

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background Color', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0056',
    value: { value: '' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Background Opacity (%)', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0057',
    value: 85,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0058',
    value: 12,
  });

  contentPadding = new formattingSettings.NumUpDown({
    name: 'contentPadding',
    displayName: 'Content Padding', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0119',
    value: 8,
  });

  name = 'cardSettings';
  displayName = 'Card Style';
  displayNameKey = 'AnimatedDonutProSettings_DisplayName_0004';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.contentPadding];
}

// ── Animation Settings ──────────────────────────────────────────────

class AnimationSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Animations', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0059',
    value: true,
  });

  duration = new formattingSettings.NumUpDown({
    name: 'duration',
    displayName: 'Duration (ms)', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0060',
    value: 600,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  displayNameKey = 'AnimatedDonutProSettings_DisplayName_0005';
  slices = [this.enabled, this.duration];
}

// ── Nested Rings Settings ────────────────────────────────────────

class DonutNestedSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Show Inner Ring', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0061',
    value: false,
  });

  name = 'donutNestedSettings';
  displayName = 'Inner Ring';
  displayNameKey = 'AnimatedDonutProSettings_DisplayName_0006';
  slices = [this.enabled];
}

// ── Exploded Segments Settings ──────────────────────────────────

class DonutExplodeSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Explode Segments', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0063',
    value: false,
  });

  distance = new formattingSettings.NumUpDown({
    name: 'distance',
    displayName: 'Explode Distance (px)', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0064',
    value: 20,
  });

  name = 'donutExplodeSettings';
  displayName = 'Exploded Segments';
  displayNameKey = 'AnimatedDonutProSettings_DisplayName_0007';
  slices = [this.enabled, this.distance];
}

// ── Donut Label Format Settings ─────────────────────────────────

class DonutLabelSettings extends formattingSettings.SimpleCard {
  format = new formattingSettings.ItemDropdown({
    name: 'format',
    displayName: 'Label Format', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0065',
    items: [
      { value: 'category', displayName: 'Category', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0066' },
      { value: 'value', displayName: 'Value', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0067' },
      { value: 'percent', displayName: 'Percentage', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0068' },
      { value: 'both', displayName: 'Category + Value', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0069' },
    ],
    value: { value: 'category', displayName: 'Category', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0070' },
  });

  connectorLines = new formattingSettings.ToggleSwitch({
    name: 'connectorLines',
    displayName: 'Connector Lines', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0071',
    value: false,
  });

  labelOffset = new formattingSettings.NumUpDown({
    name: 'labelOffset',
    displayName: 'Label Offset', displayNameKey: 'AnimatedDonutProSettings_DisplayName_0086',
    value: 0,
  });

  name = 'donutLabelSettings';
  displayName = 'Slice Labels';
  displayNameKey = 'AnimatedDonutProSettings_DisplayName_0008';
  slices = [this.format, this.connectorLines, this.labelOffset];
}

// ── Root Model ──────────────────────────────────────────────────────

export class AnimatedDonutProSettings extends formattingSettings.Model {
  donutSettings = new DonutSettings();
  valueSettings = new ValueSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettingsCard();
  topNSettings = new TopNSettingsCard();
  donutNestedSettings = new DonutNestedSettings();
  donutExplodeSettings = new DonutExplodeSettings();
  donutLabelSettings = new DonutLabelSettings();

  legendFormattingCard = new LegendFormattingCard();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  numberFormattingCard = new NumberFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();
  cards = [
    this.donutSettings,
    this.donutNestedSettings,
    this.donutExplodeSettings,
    this.valueSettings,
    this.donutLabelSettings,
    this.colorThemeFormattingCard,
    this.topNSettings,
    this.animationSettings,
    this.legendFormattingCard,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.numberFormattingCard,
    this.cardSettings,
    this.conditionalFormattingCard,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
