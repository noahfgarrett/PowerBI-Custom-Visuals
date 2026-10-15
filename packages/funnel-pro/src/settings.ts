/**
 * Funnel Pro — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, NumberFormattingCard,
  DateFilterFormattingCard,
  CARD_STYLE_MODE_ITEMS
} from '../../core/src';

class FunnelGuideFormattingCard extends AxisFormattingCard {
  displayName = 'Guides & Secondary Labels';
  displayNameKey = 'FunnelProSettings_DisplayName_Guides';
}

// ── Funnel Shape ────────────────────────────────────────────────────

class FunnelShapeSettingsCard extends formattingSettings.SimpleCard {
  style = new formattingSettings.ItemDropdown({
    name: 'style',
    displayName: 'Style', displayNameKey: 'FunnelProSettings_DisplayName_0008',
    items: [
      { value: 'symmetric', displayName: 'Symmetric', displayNameKey: 'FunnelProSettings_DisplayName_0009' },
      { value: 'leftAligned', displayName: 'Left Aligned', displayNameKey: 'FunnelProSettings_DisplayName_0010' },
    ],
    value: { value: 'symmetric', displayName: 'Symmetric', displayNameKey: 'FunnelProSettings_DisplayName_0011' },
  });

  pyramidMode = new formattingSettings.ToggleSwitch({
    name: 'pyramidMode',
    displayName: 'Pyramid Mode', displayNameKey: 'FunnelProSettings_DisplayName_0012',
    value: false,
  });

  gap = new formattingSettings.NumUpDown({
    name: 'gap',
    displayName: 'Gap', displayNameKey: 'FunnelProSettings_DisplayName_0013',
    value: 4,
  });

  neckWidth = new formattingSettings.NumUpDown({
    name: 'neckWidth',
    displayName: 'Neck Width (%)', displayNameKey: 'FunnelProSettings_DisplayName_0014',
    value: 20,
  });

  neckHeight = new formattingSettings.NumUpDown({
    name: 'neckHeight',
    displayName: 'Neck Height (%)', displayNameKey: 'FunnelProSettings_DisplayName_0015',
    value: 25,
  });

  dynamicHeight = new formattingSettings.ToggleSwitch({
    name: 'dynamicHeight',
    displayName: 'Dynamic Height per Stage', displayNameKey: 'FunnelProSettings_DisplayName_0016',
    value: false,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius', displayNameKey: 'FunnelProSettings_DisplayName_0017',
    value: 4,
  });

  name = 'funnelShapeSettings';
  displayName = 'Funnel Shape';
  displayNameKey = 'FunnelProSettings_DisplayName_0001';
  slices = [this.style, this.pyramidMode, this.gap, this.neckWidth, this.neckHeight, this.dynamicHeight, this.borderRadius];
}

// ── Stage Appearance ────────────────────────────────────────────────

class StageAppearanceSettingsCard extends formattingSettings.SimpleCard {
  private readonly fontFamilyItems = [
    { value: '', displayName: 'Default', displayNameKey: 'FunnelProSettings_DisplayName_0018' },
    { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'FunnelProSettings_DisplayName_0019' },
    { value: 'Arial', displayName: 'Arial', displayNameKey: 'FunnelProSettings_DisplayName_0020' },
    { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'FunnelProSettings_DisplayName_0021' },
    { value: 'Helvetica', displayName: 'Helvetica', displayNameKey: 'FunnelProSettings_DisplayName_0022' },
    { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'FunnelProSettings_DisplayName_0023' },
    { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'FunnelProSettings_DisplayName_0024' },
    { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'FunnelProSettings_DisplayName_0025' },
  ];

  private readonly fontWeightItems = [
    { value: 'normal', displayName: 'Normal', displayNameKey: 'FunnelProSettings_DisplayName_0026' },
    { value: 'bold', displayName: 'Bold', displayNameKey: 'FunnelProSettings_DisplayName_0027' },
    { value: '600', displayName: 'Semi-Bold', displayNameKey: 'FunnelProSettings_DisplayName_0028' },
  ];

  segmentStrokeColor = new formattingSettings.ColorPicker({
    name: 'segmentStrokeColor',
    displayName: 'Segment Stroke Color', displayNameKey: 'FunnelProSettings_DisplayName_0029',
    value: { value: '' },
  });

  segmentStrokeWidth = new formattingSettings.NumUpDown({
    name: 'segmentStrokeWidth',
    displayName: 'Segment Stroke Width', displayNameKey: 'FunnelProSettings_DisplayName_0030',
    value: 1,
  });

  labelColor = new formattingSettings.ColorPicker({
    name: 'labelColor',
    displayName: 'Label Color', displayNameKey: 'FunnelProSettings_DisplayName_0031',
    value: { value: '' },
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Label Font Size', displayNameKey: 'FunnelProSettings_DisplayName_0032',
    value: 12,
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Font Family', displayNameKey: 'FunnelProSettings_DisplayName_0033',
    items: this.fontFamilyItems,
    value: { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'FunnelProSettings_DisplayName_0034' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Font Weight', displayNameKey: 'FunnelProSettings_DisplayName_0035',
    items: this.fontWeightItems,
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'FunnelProSettings_DisplayName_0036' },
  });

  labelAlignment = new formattingSettings.ItemDropdown({
    name: 'labelAlignment',
    displayName: 'Label Alignment', displayNameKey: 'FunnelProSettings_DisplayName_0037',
    items: [
      { value: 'center', displayName: 'Center', displayNameKey: 'FunnelProSettings_DisplayName_0038' },
      { value: 'start', displayName: 'Start', displayNameKey: 'FunnelProSettings_DisplayName_0039' },
      { value: 'end', displayName: 'End', displayNameKey: 'FunnelProSettings_DisplayName_0040' },
    ],
    value: { value: 'center', displayName: 'Center', displayNameKey: 'FunnelProSettings_DisplayName_0041' },
  });

  labelPadding = new formattingSettings.NumUpDown({
    name: 'labelPadding',
    displayName: 'Label Padding', displayNameKey: 'FunnelProSettings_DisplayName_0042',
    value: 0,
  });

  showValues = new formattingSettings.ToggleSwitch({
    name: 'showValues',
    displayName: 'Show Values', displayNameKey: 'FunnelProSettings_DisplayName_0043',
    value: true,
  });

  showConversionRate = new formattingSettings.ToggleSwitch({
    name: 'showConversionRate',
    displayName: 'Show Conversion Rate', displayNameKey: 'FunnelProSettings_DisplayName_0044',
    value: true,
  });

  showAnnotations = new formattingSettings.ToggleSwitch({
    name: 'showAnnotations',
    displayName: 'Show Annotations', displayNameKey: 'FunnelProSettings_DisplayName_0045',
    value: false,
  });

  secondaryLabelColor = new formattingSettings.ColorPicker({
    name: 'secondaryLabelColor',
    displayName: 'Secondary Label Color', displayNameKey: 'FunnelProSettings_DisplayName_0046',
    value: { value: '' },
  });

  secondaryFontSize = new formattingSettings.NumUpDown({
    name: 'secondaryFontSize',
    displayName: 'Secondary Font Size', displayNameKey: 'FunnelProSettings_DisplayName_0047',
    value: 11,
  });

  secondaryFontFamily = new formattingSettings.ItemDropdown({
    name: 'secondaryFontFamily',
    displayName: 'Secondary Font Family', displayNameKey: 'FunnelProSettings_DisplayName_0048',
    items: this.fontFamilyItems,
    value: { value: '', displayName: 'Default', displayNameKey: 'FunnelProSettings_DisplayName_0049' },
  });

  secondaryFontWeight = new formattingSettings.ItemDropdown({
    name: 'secondaryFontWeight',
    displayName: 'Secondary Font Weight', displayNameKey: 'FunnelProSettings_DisplayName_0050',
    items: this.fontWeightItems,
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'FunnelProSettings_DisplayName_0051' },
  });

  secondaryLabelOffset = new formattingSettings.NumUpDown({
    name: 'secondaryLabelOffset',
    displayName: 'Secondary Label Offset', displayNameKey: 'FunnelProSettings_DisplayName_0052',
    value: 10,
  });

  secondaryLabelPadding = new formattingSettings.NumUpDown({
    name: 'secondaryLabelPadding',
    displayName: 'Secondary Label Padding', displayNameKey: 'FunnelProSettings_DisplayName_0053',
    value: 0,
  });

  name = 'stageAppearanceSettings';
  displayName = 'Stage Appearance';
  displayNameKey = 'FunnelProSettings_DisplayName_0002';
  slices = [
    this.segmentStrokeColor,
    this.segmentStrokeWidth,
    this.labelColor,
    this.fontSize,
    this.fontFamily,
    this.fontWeight,
    this.labelAlignment,
    this.labelPadding,
    this.showValues,
    this.showConversionRate,
    this.showAnnotations,
    this.secondaryLabelColor,
    this.secondaryFontSize,
    this.secondaryFontFamily,
    this.secondaryFontWeight,
    this.secondaryLabelOffset,
    this.secondaryLabelPadding,
  ];
}

// ── Layout Settings ───────────────────────────────────────────────────

class LayoutSettingsCard extends formattingSettings.SimpleCard {
  containerPadding = new formattingSettings.NumUpDown({
    name: 'containerPadding',
    displayName: 'Container Padding', displayNameKey: 'FunnelProSettings_DisplayName_0054',
    value: 12,
  });

  name = 'layoutSettings';
  displayName = 'Layout';
  displayNameKey = 'FunnelProSettings_DisplayName_0003';
  slices = [this.containerPadding];
}

// ── Color Settings ───────────────────────────────────────────────────

class ColorSettingsCard extends formattingSettings.SimpleCard {
  useGradient = new formattingSettings.ToggleSwitch({
    name: 'useGradient',
    displayName: 'Use Gradient', displayNameKey: 'FunnelProSettings_DisplayName_0055',
    value: true,
  });

  baseColor = new formattingSettings.ColorPicker({
    name: 'baseColor',
    displayName: 'Base Color', displayNameKey: 'FunnelProSettings_DisplayName_0056',
    value: { value: '#3B82F6' },
  });

  name = 'colorSettings';
  displayName = 'Color';
  displayNameKey = 'FunnelProSettings_DisplayName_0004';
  slices = [this.useGradient, this.baseColor];
}

// ── Drop-Off Analysis ───────────────────────────────────────────────

class DropOffAnalysisSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Drop-Off Analysis', displayNameKey: 'FunnelProSettings_DisplayName_0057',
    value: false,
  });

  showDropOff = new formattingSettings.ToggleSwitch({
    name: 'showDropOff',
    displayName: 'Show Drop-Off', displayNameKey: 'FunnelProSettings_DisplayName_0058',
    value: false,
  });

  dropOffColor = new formattingSettings.ColorPicker({
    name: 'dropOffColor',
    displayName: 'Drop-Off Color', displayNameKey: 'FunnelProSettings_DisplayName_0059',
    value: { value: '#EF4444' },
  });

  name = 'funnelComparisonSettings';
  displayName = 'Drop-Off Analysis';
  displayNameKey = 'FunnelProSettings_DisplayName_0005';
  slices = [this.enabled, this.showDropOff, this.dropOffColor];
}

// ── Card Style ───────────────────────────────────────────────────────

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style', displayNameKey: 'FunnelProSettings_DisplayName_0060',
    items: CARD_STYLE_MODE_ITEMS,
    value: { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'FunnelProSettings_DisplayName_0065' },
  });

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background Color', displayNameKey: 'FunnelProSettings_DisplayName_0066',
    value: { value: '' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Background Opacity (%)', displayNameKey: 'FunnelProSettings_DisplayName_0067',
    value: 35,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius', displayNameKey: 'FunnelProSettings_DisplayName_0068',
    value: 12,
  });

  contentPadding = new formattingSettings.NumUpDown({
    name: 'contentPadding',
    displayName: 'Content Padding', displayNameKey: 'FunnelProSettings_DisplayName_0071',
    value: 8,
  });

  name = 'cardSettings';
  displayName = 'Card Style';
  displayNameKey = 'FunnelProSettings_DisplayName_0006';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.contentPadding];
}

// ── Animation Settings ───────────────────────────────────────────────

class AnimationSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Animations', displayNameKey: 'FunnelProSettings_DisplayName_0069',
    value: true,
  });

  duration = new formattingSettings.NumUpDown({
    name: 'duration',
    displayName: 'Duration (ms)', displayNameKey: 'FunnelProSettings_DisplayName_0070',
    value: 600,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  displayNameKey = 'FunnelProSettings_DisplayName_0007';
  slices = [this.enabled, this.duration];
}

// ── Root Model ───────────────────────────────────────────────────────

export class FunnelProSettings extends formattingSettings.Model {
  funnelShapeSettings = new FunnelShapeSettingsCard();
  stageAppearanceSettings = new StageAppearanceSettingsCard();
  layoutSettings = new LayoutSettingsCard();
  colorSettings = new ColorSettingsCard();
  funnelComparisonSettings = new DropOffAnalysisSettingsCard();

  titleFormattingCard = new TitleFormattingCard();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  legendFormattingCard = new LegendFormattingCard();
  axisFormattingCard = new FunnelGuideFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  numberFormattingCard = new NumberFormattingCard();
  animationSettings = new AnimationSettingsCard();
  cardSettings = new CardStyleSettings();

  referenceLineFormattingCard = new ReferenceLineFormattingCard();
  trendLineFormattingCard = new TrendLineFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  cards = [
    this.funnelShapeSettings,
    this.stageAppearanceSettings,
    this.layoutSettings,
    this.colorSettings,
    this.funnelComparisonSettings,
    this.titleFormattingCard,
    this.dataLabelFormattingCard,
    this.legendFormattingCard,
    this.axisFormattingCard,
    this.colorThemeFormattingCard,
    this.numberFormattingCard,
    this.animationSettings,
    this.cardSettings,
    this.referenceLineFormattingCard,
    this.trendLineFormattingCard,
    this.conditionalFormattingCard,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
