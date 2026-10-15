/**
 * Radial Gauge Pro -- Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { LegendFormattingCard, TitleFormattingCard, NumberFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard,
  ColorThemeFormattingCard,
  DateFilterFormattingCard,
  CARD_STYLE_MODE_ITEMS
} from '../../core/src';

// -- Arc Shape: all geometry together (merged Arc + Arc Display) ----------------

class ArcShapeSettings extends formattingSettings.SimpleCard {
  thickness = new formattingSettings.ItemDropdown({
    name: 'thickness',
    displayName: 'Thickness', displayNameKey: 'RadialGaugeSettings_DisplayName_0011',
    items: [
      { value: 'thin', displayName: 'Thin', displayNameKey: 'RadialGaugeSettings_DisplayName_0012' },
      { value: 'medium', displayName: 'Medium', displayNameKey: 'RadialGaugeSettings_DisplayName_0013' },
      { value: 'thick', displayName: 'Thick', displayNameKey: 'RadialGaugeSettings_DisplayName_0014' },
    ],
    value: { value: 'medium', displayName: 'Medium', displayNameKey: 'RadialGaugeSettings_DisplayName_0015' },
  });

  roundedCaps = new formattingSettings.ToggleSwitch({
    name: 'roundedCaps',
    displayName: 'Rounded Caps', displayNameKey: 'RadialGaugeSettings_DisplayName_0016',
    value: true,
  });

  startAngle = new formattingSettings.ItemDropdown({
    name: 'startAngle',
    displayName: 'Arc Range Preset', displayNameKey: 'RadialGaugeSettings_DisplayName_0017',
    items: [
      { value: 'custom', displayName: 'Custom', displayNameKey: 'RadialGaugeSettings_DisplayName_0095' },
      { value: 'half', displayName: 'Half Circle', displayNameKey: 'RadialGaugeSettings_DisplayName_0018' },
      { value: 'full', displayName: 'Full Circle', displayNameKey: 'RadialGaugeSettings_DisplayName_0019' },
    ],
    value: { value: 'custom', displayName: 'Custom', displayNameKey: 'RadialGaugeSettings_DisplayName_0095' },
  });

  arcRange = new formattingSettings.NumUpDown({
    name: 'arcRange',
    displayName: 'Custom Arc Range (°)', displayNameKey: 'RadialGaugeSettings_DisplayName_0021',
    value: 270,
  });

  segmented = new formattingSettings.ToggleSwitch({
    name: 'segmented',
    displayName: 'LED-Style Segments', displayNameKey: 'RadialGaugeSettings_DisplayName_0022',
    value: false,
  });

  segmentCount = new formattingSettings.NumUpDown({
    name: 'segmentCount',
    displayName: 'Segment Count', displayNameKey: 'RadialGaugeSettings_DisplayName_0023',
    value: 20,
  });

  name = 'arcSettings';
  displayName = 'Arc Shape';
  displayNameKey = 'RadialGaugeSettings_DisplayName_0001';
  slices = [this.thickness, this.roundedCaps, this.startAngle, this.arcRange, this.segmented, this.segmentCount];
}

// -- Arc Colors: track and zone border appearance -----------------------------

class ArcColorSettings extends formattingSettings.SimpleCard {
  trackColor = new formattingSettings.ColorPicker({
    name: 'trackColor',
    displayName: 'Track Color', displayNameKey: 'RadialGaugeSettings_DisplayName_0024',
    value: { value: '#94A3B8' },
  });

  trackOpacity = new formattingSettings.NumUpDown({
    name: 'trackOpacity',
    displayName: 'Track Opacity (%)', displayNameKey: 'RadialGaugeSettings_DisplayName_0025',
    value: 15,
  });

  zoneBorderWidth = new formattingSettings.NumUpDown({
    name: 'zoneBorderWidth',
    displayName: 'Zone Border Width', displayNameKey: 'RadialGaugeSettings_DisplayName_0026',
    value: 1.5,
  });

  zoneBorderOpacity = new formattingSettings.NumUpDown({
    name: 'zoneBorderOpacity',
    displayName: 'Zone Border Opacity (%)', displayNameKey: 'RadialGaugeSettings_DisplayName_0027',
    value: 30,
  });

  name = 'arcColorSettings';
  displayName = 'Arc Colors';
  displayNameKey = 'RadialGaugeSettings_DisplayName_0002';
  slices = [this.trackColor, this.trackOpacity, this.zoneBorderWidth, this.zoneBorderOpacity];
}

class ZoneSettings extends formattingSettings.SimpleCard {
  zone1Threshold = new formattingSettings.NumUpDown({
    name: 'zone1Threshold',
    displayName: 'Zone 1 Threshold (%)', displayNameKey: 'RadialGaugeSettings_DisplayName_0028',
    value: 33,
  });

  zone1Color = new formattingSettings.ColorPicker({
    name: 'zone1Color',
    displayName: 'Zone 1 Color', displayNameKey: 'RadialGaugeSettings_DisplayName_0029',
    value: { value: '#F87171' }, // red
  });

  zone2Threshold = new formattingSettings.NumUpDown({
    name: 'zone2Threshold',
    displayName: 'Zone 2 Threshold (%)', displayNameKey: 'RadialGaugeSettings_DisplayName_0030',
    value: 66,
  });

  zone2Color = new formattingSettings.ColorPicker({
    name: 'zone2Color',
    displayName: 'Zone 2 Color', displayNameKey: 'RadialGaugeSettings_DisplayName_0031',
    value: { value: '#FBBF24' }, // amber
  });

  zone3Color = new formattingSettings.ColorPicker({
    name: 'zone3Color',
    displayName: 'Zone 3 Color', displayNameKey: 'RadialGaugeSettings_DisplayName_0032',
    value: { value: '#34D399' }, // green
  });

  name = 'zoneSettings';
  displayName = 'Color Zones';
  displayNameKey = 'RadialGaugeSettings_DisplayName_0003';
  slices = [
    this.zone1Threshold,
    this.zone1Color,
    this.zone2Threshold,
    this.zone2Color,
    this.zone3Color,
  ];
}

// -- Center Value: font settings only (delta colors moved to Comparison) ------

class CenterValueSettings extends formattingSettings.SimpleCard {
  displayMode = new formattingSettings.ItemDropdown({
    name: 'displayMode',
    displayName: 'Display Mode', displayNameKey: 'RadialGaugeSettings_DisplayName_0098',
    items: [
      { value: 'value', displayName: 'Value', displayNameKey: 'RadialGaugeSettings_DisplayName_0099' },
      { value: 'target', displayName: 'Target', displayNameKey: 'RadialGaugeSettings_DisplayName_0100' },
      { value: 'delta', displayName: 'Delta vs Target', displayNameKey: 'RadialGaugeSettings_DisplayName_0101' },
      { value: 'custom', displayName: 'Custom Text', displayNameKey: 'RadialGaugeSettings_DisplayName_0102' },
    ],
    value: { value: 'value', displayName: 'Value', displayNameKey: 'RadialGaugeSettings_DisplayName_0103' },
  });

  customText = new formattingSettings.TextInput({
    name: 'customText',
    displayName: 'Custom Text', displayNameKey: 'RadialGaugeSettings_DisplayName_0104',
    value: '',
    placeholder: 'On Track', placeholderKey: 'RadialGaugeSettings_Placeholder_0001',
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size', displayNameKey: 'RadialGaugeSettings_DisplayName_0033',
    value: 28,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color', displayNameKey: 'RadialGaugeSettings_DisplayName_0034',
    value: { value: '' }, // empty = use theme default
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Font Family', displayNameKey: 'RadialGaugeSettings_DisplayName_0035',
    items: [
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'RadialGaugeSettings_DisplayName_0036' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'RadialGaugeSettings_DisplayName_0037' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'RadialGaugeSettings_DisplayName_0038' },
      { value: 'Helvetica', displayName: 'Helvetica', displayNameKey: 'RadialGaugeSettings_DisplayName_0039' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'RadialGaugeSettings_DisplayName_0040' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'RadialGaugeSettings_DisplayName_0041' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'RadialGaugeSettings_DisplayName_0042' },
    ],
    value: { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'RadialGaugeSettings_DisplayName_0043' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Font Weight', displayNameKey: 'RadialGaugeSettings_DisplayName_0044',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'RadialGaugeSettings_DisplayName_0045' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'RadialGaugeSettings_DisplayName_0046' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'RadialGaugeSettings_DisplayName_0047' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'RadialGaugeSettings_DisplayName_0048' },
  });

  captionMode = new formattingSettings.ItemDropdown({
    name: 'captionMode',
    displayName: 'Caption', displayNameKey: 'RadialGaugeSettings_DisplayName_0105',
    items: [
      { value: 'auto', displayName: 'Auto', displayNameKey: 'RadialGaugeSettings_DisplayName_0106' },
      { value: 'none', displayName: 'None', displayNameKey: 'RadialGaugeSettings_DisplayName_0107' },
      { value: 'custom', displayName: 'Custom', displayNameKey: 'RadialGaugeSettings_DisplayName_0108' },
    ],
    value: { value: 'auto', displayName: 'Auto', displayNameKey: 'RadialGaugeSettings_DisplayName_0109' },
  });

  customCaption = new formattingSettings.TextInput({
    name: 'customCaption',
    displayName: 'Custom Caption', displayNameKey: 'RadialGaugeSettings_DisplayName_0110',
    value: '',
    placeholder: 'Current Value', placeholderKey: 'RadialGaugeSettings_Placeholder_0002',
  });

  captionFontSize = new formattingSettings.NumUpDown({
    name: 'captionFontSize',
    displayName: 'Caption Font Size', displayNameKey: 'RadialGaugeSettings_DisplayName_0111',
    value: 11,
  });

  captionFontColor = new formattingSettings.ColorPicker({
    name: 'captionFontColor',
    displayName: 'Caption Font Color', displayNameKey: 'RadialGaugeSettings_DisplayName_0112',
    value: { value: '' },
  });

  name = 'valueSettings';
  displayName = 'Center Value';
  displayNameKey = 'RadialGaugeSettings_DisplayName_0004';
  slices = [
    this.displayMode,
    this.customText,
    this.fontSize,
    this.fontColor,
    this.fontFamily,
    this.fontWeight,
    this.captionMode,
    this.customCaption,
    this.captionFontSize,
    this.captionFontColor,
  ];
}

class TargetSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Target', displayNameKey: 'RadialGaugeSettings_DisplayName_0049',
    value: true,
  });

  color = new formattingSettings.ColorPicker({
    name: 'color',
    displayName: 'Target Color', displayNameKey: 'RadialGaugeSettings_DisplayName_0050',
    value: { value: '#0F172A' },
  });

  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width', displayNameKey: 'RadialGaugeSettings_DisplayName_0051',
    value: 3,
  });

  name = 'targetSettings';
  displayName = 'Target';
  displayNameKey = 'RadialGaugeSettings_DisplayName_0005';
  slices = [this.show, this.color, this.lineWidth];
}

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style', displayNameKey: 'RadialGaugeSettings_DisplayName_0052',
    items: CARD_STYLE_MODE_ITEMS,
    value: { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'RadialGaugeSettings_DisplayName_0057' },
  });

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background Color', displayNameKey: 'RadialGaugeSettings_DisplayName_0058',
    value: { value: '' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Background Opacity (%)', displayNameKey: 'RadialGaugeSettings_DisplayName_0059',
    value: 35,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius', displayNameKey: 'RadialGaugeSettings_DisplayName_0060',
    value: 12,
  });

  contentPadding = new formattingSettings.NumUpDown({
    name: 'contentPadding',
    displayName: 'Content Padding', displayNameKey: 'RadialGaugeSettings_DisplayName_0061',
    value: 12,
  });

  name = 'cardSettings';
  displayName = 'Card Style';
  displayNameKey = 'RadialGaugeSettings_DisplayName_0006';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.contentPadding];
}

class NeedleSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Needle', displayNameKey: 'RadialGaugeSettings_DisplayName_0062',
    value: false,
  });

  color = new formattingSettings.ColorPicker({
    name: 'color',
    displayName: 'Needle Color', displayNameKey: 'RadialGaugeSettings_DisplayName_0063',
    value: { value: '#0F172A' },
  });

  width = new formattingSettings.NumUpDown({
    name: 'width',
    displayName: 'Width (px)', displayNameKey: 'RadialGaugeSettings_DisplayName_0064',
    value: 3,
  });

  showHub = new formattingSettings.ToggleSwitch({
    name: 'showHub',
    displayName: 'Show Hub', displayNameKey: 'RadialGaugeSettings_DisplayName_0065',
    value: true,
  });

  hubRadius = new formattingSettings.NumUpDown({
    name: 'hubRadius',
    displayName: 'Hub Radius', displayNameKey: 'RadialGaugeSettings_DisplayName_0066',
    value: 8,
  });

  name = 'needleSettings';
  displayName = 'Needle';
  displayNameKey = 'RadialGaugeSettings_DisplayName_0007';
  slices = [this.show, this.color, this.width, this.showHub, this.hubRadius];
}

class AnimationSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Animations', displayNameKey: 'RadialGaugeSettings_DisplayName_0067',
    value: true,
  });

  duration = new formattingSettings.NumUpDown({
    name: 'duration',
    displayName: 'Duration (ms)', displayNameKey: 'RadialGaugeSettings_DisplayName_0068',
    value: 600,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  displayNameKey = 'RadialGaugeSettings_DisplayName_0008';
  slices = [this.enabled, this.duration];
}

// ── Gauge Scale Settings ────────────────────────────────────────

class GaugeScaleSettings extends formattingSettings.SimpleCard {
  showTicks = new formattingSettings.ToggleSwitch({
    name: 'showTicks',
    displayName: 'Show Tick Marks', displayNameKey: 'RadialGaugeSettings_DisplayName_0069',
    value: false,
  });

  showLabels = new formattingSettings.ToggleSwitch({
    name: 'showLabels',
    displayName: 'Show Scale Labels', displayNameKey: 'RadialGaugeSettings_DisplayName_0070',
    value: false,
  });

  majorTicks = new formattingSettings.NumUpDown({
    name: 'majorTicks',
    displayName: 'Major Ticks', displayNameKey: 'RadialGaugeSettings_DisplayName_0071',
    value: 5,
  });

  minorTicks = new formattingSettings.NumUpDown({
    name: 'minorTicks',
    displayName: 'Minor Ticks', displayNameKey: 'RadialGaugeSettings_DisplayName_0072',
    value: 2,
  });

  majorTickColor = new formattingSettings.ColorPicker({
    name: 'majorTickColor',
    displayName: 'Major Tick Color', displayNameKey: 'RadialGaugeSettings_DisplayName_0073',
    value: { value: '#64748B' },
  });

  minorTickColor = new formattingSettings.ColorPicker({
    name: 'minorTickColor',
    displayName: 'Minor Tick Color', displayNameKey: 'RadialGaugeSettings_DisplayName_0074',
    value: { value: '#94A3B8' },
  });

  labelFontFamily = new formattingSettings.ItemDropdown({
    name: 'labelFontFamily',
    displayName: 'Label Font Family', displayNameKey: 'RadialGaugeSettings_DisplayName_0075',
    items: [
      { value: '', displayName: 'Default', displayNameKey: 'RadialGaugeSettings_DisplayName_0076' },
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'RadialGaugeSettings_DisplayName_0077' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'RadialGaugeSettings_DisplayName_0078' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'RadialGaugeSettings_DisplayName_0079' },
      { value: 'Helvetica', displayName: 'Helvetica', displayNameKey: 'RadialGaugeSettings_DisplayName_0080' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'RadialGaugeSettings_DisplayName_0081' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'RadialGaugeSettings_DisplayName_0082' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'RadialGaugeSettings_DisplayName_0083' },
    ],
    value: { value: '', displayName: 'Default', displayNameKey: 'RadialGaugeSettings_DisplayName_0084' },
  });

  labelFontWeight = new formattingSettings.ItemDropdown({
    name: 'labelFontWeight',
    displayName: 'Label Font Weight', displayNameKey: 'RadialGaugeSettings_DisplayName_0085',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'RadialGaugeSettings_DisplayName_0086' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'RadialGaugeSettings_DisplayName_0087' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'RadialGaugeSettings_DisplayName_0088' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'RadialGaugeSettings_DisplayName_0089' },
  });

  labelOffset = new formattingSettings.NumUpDown({
    name: 'labelOffset',
    displayName: 'Label Offset', displayNameKey: 'RadialGaugeSettings_DisplayName_0090',
    value: 14,
  });

  labelFontSize = new formattingSettings.NumUpDown({
    name: 'labelFontSize',
    displayName: 'Label Font Size', displayNameKey: 'RadialGaugeSettings_DisplayName_0096',
    value: 11,
  });

  labelFontColor = new formattingSettings.ColorPicker({
    name: 'labelFontColor',
    displayName: 'Label Font Color', displayNameKey: 'RadialGaugeSettings_DisplayName_0097',
    value: { value: '' },
  });

  name = 'gaugeScaleSettings';
  displayName = 'Scale & Ticks';
  displayNameKey = 'RadialGaugeSettings_DisplayName_0009';
  slices = [
    this.showTicks,
    this.showLabels,
    this.majorTicks,
    this.minorTicks,
    this.majorTickColor,
    this.minorTickColor,
    this.labelFontSize,
    this.labelFontColor,
    this.labelFontFamily,
    this.labelFontWeight,
    this.labelOffset,
  ];
}

// ── Gauge Comparison Settings (now includes delta colors) ──────

class GaugeComparisonSettings extends formattingSettings.SimpleCard {
  showDelta = new formattingSettings.ToggleSwitch({
    name: 'showDelta',
    displayName: 'Show Target Delta', displayNameKey: 'RadialGaugeSettings_DisplayName_0091',
    value: false,
  });

  deltaPositiveColor = new formattingSettings.ColorPicker({
    name: 'deltaPositiveColor',
    displayName: 'Increase Color', displayNameKey: 'RadialGaugeSettings_DisplayName_0092',
    value: { value: '#22C55E' },
  });

  deltaNegativeColor = new formattingSettings.ColorPicker({
    name: 'deltaNegativeColor',
    displayName: 'Decrease Color', displayNameKey: 'RadialGaugeSettings_DisplayName_0093',
    value: { value: '#EF4444' },
  });

  showSparkline = new formattingSettings.ToggleSwitch({
    name: 'showSparkline',
    displayName: 'Show Mini Sparkline', displayNameKey: 'RadialGaugeSettings_DisplayName_0094',
    value: false,
  });

  name = 'gaugeComparisonSettings';
  displayName = 'Comparison';
  displayNameKey = 'RadialGaugeSettings_DisplayName_0010';
  slices = [this.showDelta, this.deltaPositiveColor, this.deltaNegativeColor, this.showSparkline];
}

export class RadialGaugeSettings extends formattingSettings.Model {
  arcSettings = new ArcShapeSettings();
  arcColorSettings = new ArcColorSettings();
  zoneSettings = new ZoneSettings();
  valueSettings = new CenterValueSettings();
  targetSettings = new TargetSettings();
  needleSettings = new NeedleSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();
  gaugeScaleSettings = new GaugeScaleSettings();
  gaugeComparisonSettings = new GaugeComparisonSettings();

  titleFormattingCard = new TitleFormattingCard();
  numberFormattingCard = new NumberFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();
  legendFormattingCard = new LegendFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();
  cards = [
    this.titleFormattingCard,
    this.arcSettings,
    this.arcColorSettings,
    this.zoneSettings,
    this.valueSettings,
    this.targetSettings,
    this.needleSettings,
    this.gaugeScaleSettings,
    this.gaugeComparisonSettings,
    this.numberFormattingCard,
    this.conditionalFormattingCard,
    this.legendFormattingCard,
    this.cardSettings,
    this.animationSettings,
    this.colorThemeFormattingCard,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
