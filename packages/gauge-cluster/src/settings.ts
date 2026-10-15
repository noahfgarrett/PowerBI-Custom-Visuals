/**
 * Gauge Cluster -- Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, NumberFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard,
  ColorThemeFormattingCard,
  DateFilterFormattingCard,
  CARD_STYLE_MODE_ITEMS
} from '../../core/src';

// ── Grid Layout ─────────────────────────────────────────────────────

class GridLayoutSettingsCard extends formattingSettings.SimpleCard {
  gaugesPerRow = new formattingSettings.NumUpDown({
    name: 'gaugesPerRow',
    displayName: 'Gauges Per Row', displayNameKey: 'GaugeClusterSettings_DisplayName_0009',
    value: 4,
  });

  sortByValue = new formattingSettings.ToggleSwitch({
    name: 'sortByValue',
    displayName: 'Sort by Value', displayNameKey: 'GaugeClusterSettings_DisplayName_0010',
    value: false,
  });

  name = 'gridLayoutSettings';
  displayName = 'Grid Layout';
  displayNameKey = 'GaugeClusterSettings_DisplayName_0001';
  slices = [this.gaugesPerRow, this.sortByValue];
}

// ── Arc Appearance ──────────────────────────────────────────────────

class ArcAppearanceSettingsCard extends formattingSettings.SimpleCard {
  arcRange = new formattingSettings.NumUpDown({
    name: 'arcRange',
    displayName: 'Arc Range (\u00b0)', displayNameKey: 'GaugeClusterSettings_DisplayName_0011',
    value: 240,
  });

  roundedCaps = new formattingSettings.ToggleSwitch({
    name: 'roundedCaps',
    displayName: 'Rounded Caps', displayNameKey: 'GaugeClusterSettings_DisplayName_0012',
    value: true,
  });

  trackOpacity = new formattingSettings.NumUpDown({
    name: 'trackOpacity',
    displayName: 'Track Opacity (%)', displayNameKey: 'GaugeClusterSettings_DisplayName_0013',
    value: 15,
  });

  showNeedle = new formattingSettings.ToggleSwitch({
    name: 'showNeedle',
    displayName: 'Show Needle/Pointer', displayNameKey: 'GaugeClusterSettings_DisplayName_0014',
    value: false,
  });

  arcThickness = new formattingSettings.NumUpDown({
    name: 'arcThickness',
    displayName: 'Arc Thickness (% of radius)', displayNameKey: 'GaugeClusterSettings_DisplayName_0015',
    value: 20,
  });

  trackColor = new formattingSettings.ColorPicker({
    name: 'trackColor',
    displayName: 'Track Color', displayNameKey: 'GaugeClusterSettings_DisplayName_0016',
    value: { value: '#94A3B8' },
  });

  name = 'arcAppearanceSettings';
  displayName = 'Arc Appearance';
  displayNameKey = 'GaugeClusterSettings_DisplayName_0002';
  slices = [this.arcRange, this.roundedCaps, this.trackOpacity, this.trackColor, this.showNeedle, this.arcThickness];
}

// ── Value Range ─────────────────────────────────────────────────────

class ValueRangeSettingsCard extends formattingSettings.SimpleCard {
  minValue = new formattingSettings.NumUpDown({
    name: 'minValue',
    displayName: 'Min Value', displayNameKey: 'GaugeClusterSettings_DisplayName_0017',
    value: 0,
  });

  maxValue = new formattingSettings.NumUpDown({
    name: 'maxValue',
    displayName: 'Max Value', displayNameKey: 'GaugeClusterSettings_DisplayName_0018',
    value: 100,
  });

  name = 'valueRangeSettings';
  displayName = 'Value Range';
  displayNameKey = 'GaugeClusterSettings_DisplayName_0003';
  slices = [this.minValue, this.maxValue];
}

// ── Color Zones ─────────────────────────────────────────────────────

class ZoneSettings extends formattingSettings.SimpleCard {
  lowThreshold = new formattingSettings.NumUpDown({
    name: 'lowThreshold',
    displayName: 'Low Threshold (%)', displayNameKey: 'GaugeClusterSettings_DisplayName_0019',
    value: 33,
  });

  highThreshold = new formattingSettings.NumUpDown({
    name: 'highThreshold',
    displayName: 'High Threshold (%)', displayNameKey: 'GaugeClusterSettings_DisplayName_0020',
    value: 66,
  });

  lowColor = new formattingSettings.ColorPicker({
    name: 'lowColor',
    displayName: 'Low Color', displayNameKey: 'GaugeClusterSettings_DisplayName_0021',
    value: { value: '#F87171' },
  });

  midColor = new formattingSettings.ColorPicker({
    name: 'midColor',
    displayName: 'Mid Color', displayNameKey: 'GaugeClusterSettings_DisplayName_0022',
    value: { value: '#FBBF24' },
  });

  highColor = new formattingSettings.ColorPicker({
    name: 'highColor',
    displayName: 'High Color', displayNameKey: 'GaugeClusterSettings_DisplayName_0023',
    value: { value: '#34D399' },
  });

  name = 'zoneSettings';
  displayName = 'Color Zones';
  displayNameKey = 'GaugeClusterSettings_DisplayName_0004';
  slices = [this.lowThreshold, this.highThreshold, this.lowColor, this.midColor, this.highColor];
}

// ── Target ──────────────────────────────────────────────────────────

class TargetSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Target', displayNameKey: 'GaugeClusterSettings_DisplayName_0024',
    value: true,
  });

  color = new formattingSettings.ColorPicker({
    name: 'color',
    displayName: 'Target Color', displayNameKey: 'GaugeClusterSettings_DisplayName_0025',
    value: { value: '#0F172A' },
  });

  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width', displayNameKey: 'GaugeClusterSettings_DisplayName_0026',
    value: 2,
  });

  name = 'targetSettings';
  displayName = 'Target';
  displayNameKey = 'GaugeClusterSettings_DisplayName_0005';
  slices = [this.show, this.color, this.lineWidth];
}

// ── Labels (merged Cluster Display + Cluster Labels + label props) ──

class LabelsSettingsCard extends formattingSettings.SimpleCard {
  showLabels = new formattingSettings.ToggleSwitch({
    name: 'showLabels',
    displayName: 'Show Labels', displayNameKey: 'GaugeClusterSettings_DisplayName_0027',
    value: true,
  });

  showValues = new formattingSettings.ToggleSwitch({
    name: 'showValues',
    displayName: 'Show Values', displayNameKey: 'GaugeClusterSettings_DisplayName_0028',
    value: true,
  });

  labelFontSize = new formattingSettings.NumUpDown({
    name: 'labelFontSize',
    displayName: 'Label Font Size', displayNameKey: 'GaugeClusterSettings_DisplayName_0029',
    value: 11,
  });

  labelFontColor = new formattingSettings.ColorPicker({
    name: 'labelFontColor',
    displayName: 'Label Font Color', displayNameKey: 'GaugeClusterSettings_DisplayName_0030',
    value: { value: '' },
  });

  labelFontFamily = new formattingSettings.ItemDropdown({
    name: 'labelFontFamily',
    displayName: 'Label Font Family', displayNameKey: 'GaugeClusterSettings_DisplayName_0031',
    items: [
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'GaugeClusterSettings_DisplayName_0032' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'GaugeClusterSettings_DisplayName_0033' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'GaugeClusterSettings_DisplayName_0034' },
      { value: 'Helvetica', displayName: 'Helvetica', displayNameKey: 'GaugeClusterSettings_DisplayName_0035' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'GaugeClusterSettings_DisplayName_0036' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'GaugeClusterSettings_DisplayName_0037' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'GaugeClusterSettings_DisplayName_0038' },
    ],
    value: { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'GaugeClusterSettings_DisplayName_0039' },
  });

  labelFontWeight = new formattingSettings.ItemDropdown({
    name: 'labelFontWeight',
    displayName: 'Label Font Weight', displayNameKey: 'GaugeClusterSettings_DisplayName_0040',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'GaugeClusterSettings_DisplayName_0041' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'GaugeClusterSettings_DisplayName_0042' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'GaugeClusterSettings_DisplayName_0043' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'GaugeClusterSettings_DisplayName_0044' },
  });

  labelPaddingTop = new formattingSettings.NumUpDown({
    name: 'labelPaddingTop',
    displayName: 'Label Padding Top', displayNameKey: 'GaugeClusterSettings_DisplayName_0045',
    value: 6,
  });

  labelPosition = new formattingSettings.ItemDropdown({
    name: 'labelPosition',
    displayName: 'Label Position', displayNameKey: 'GaugeClusterSettings_DisplayName_0080',
    items: [
      { value: 'belowArc', displayName: 'Below Arc', displayNameKey: 'GaugeClusterSettings_DisplayName_0081' },
      { value: 'aboveArc', displayName: 'Above Arc', displayNameKey: 'GaugeClusterSettings_DisplayName_0082' },
      { value: 'insideGauge', displayName: 'Inside Gauge', displayNameKey: 'GaugeClusterSettings_DisplayName_0083' },
    ],
    value: { value: 'belowArc', displayName: 'Below Arc', displayNameKey: 'GaugeClusterSettings_DisplayName_0084' },
  });

  showSubtitle = new formattingSettings.ToggleSwitch({
    name: 'showSubtitle',
    displayName: 'Show Subtitle', displayNameKey: 'GaugeClusterSettings_DisplayName_0046',
    value: false,
  });

  subtitleField = new formattingSettings.TextInput({
    name: 'subtitleField',
    displayName: 'Subtitle Text', displayNameKey: 'GaugeClusterSettings_DisplayName_0047',
    value: '',
    placeholder: 'e.g. Department', placeholderKey: 'GaugeClusterSettings_Placeholder_0001',
  });

  subtitleFontSize = new formattingSettings.NumUpDown({
    name: 'subtitleFontSize',
    displayName: 'Subtitle Font Size', displayNameKey: 'GaugeClusterSettings_DisplayName_0048',
    value: 10,
  });

  subtitleFontColor = new formattingSettings.ColorPicker({
    name: 'subtitleFontColor',
    displayName: 'Subtitle Font Color', displayNameKey: 'GaugeClusterSettings_DisplayName_0049',
    value: { value: '' },
  });

  subtitleFontFamily = new formattingSettings.ItemDropdown({
    name: 'subtitleFontFamily',
    displayName: 'Subtitle Font Family', displayNameKey: 'GaugeClusterSettings_DisplayName_0050',
    items: [
      { value: '', displayName: 'Default', displayNameKey: 'GaugeClusterSettings_DisplayName_0051' },
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'GaugeClusterSettings_DisplayName_0052' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'GaugeClusterSettings_DisplayName_0053' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'GaugeClusterSettings_DisplayName_0054' },
      { value: 'Helvetica', displayName: 'Helvetica', displayNameKey: 'GaugeClusterSettings_DisplayName_0055' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'GaugeClusterSettings_DisplayName_0056' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'GaugeClusterSettings_DisplayName_0057' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'GaugeClusterSettings_DisplayName_0058' },
    ],
    value: { value: '', displayName: 'Default', displayNameKey: 'GaugeClusterSettings_DisplayName_0059' },
  });

  subtitleFontWeight = new formattingSettings.ItemDropdown({
    name: 'subtitleFontWeight',
    displayName: 'Subtitle Font Weight', displayNameKey: 'GaugeClusterSettings_DisplayName_0060',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'GaugeClusterSettings_DisplayName_0061' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'GaugeClusterSettings_DisplayName_0062' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'GaugeClusterSettings_DisplayName_0063' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'GaugeClusterSettings_DisplayName_0064' },
  });

  subtitlePaddingTop = new formattingSettings.NumUpDown({
    name: 'subtitlePaddingTop',
    displayName: 'Subtitle Padding Top', displayNameKey: 'GaugeClusterSettings_DisplayName_0065',
    value: 4,
  });

  showSparklines = new formattingSettings.ToggleSwitch({
    name: 'showSparklines',
    displayName: 'Show Mini Sparklines', displayNameKey: 'GaugeClusterSettings_DisplayName_0066',
    value: false,
  });

  name = 'labelsSettings';
  displayName = 'Labels';
  displayNameKey = 'GaugeClusterSettings_DisplayName_0006';
  slices = [
    this.showLabels,
    this.showValues,
    this.labelFontSize,
    this.labelFontColor,
    this.labelFontFamily,
    this.labelFontWeight,
    this.labelPaddingTop,
    this.labelPosition,
    this.showSubtitle,
    this.subtitleField,
    this.subtitleFontSize,
    this.subtitleFontColor,
    this.subtitleFontFamily,
    this.subtitleFontWeight,
    this.subtitlePaddingTop,
    this.showSparklines,
  ];
}

class SummarySettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Summary', displayNameKey: 'GaugeClusterSettings_DisplayName_0085',
    value: true,
  });

  displayMode = new formattingSettings.ItemDropdown({
    name: 'displayMode',
    displayName: 'Display Mode', displayNameKey: 'GaugeClusterSettings_DisplayName_0086',
    items: [
      { value: 'selectedOrAverage', displayName: 'Selected Gauge or Average', displayNameKey: 'GaugeClusterSettings_DisplayName_0087' },
      { value: 'average', displayName: 'Average', displayNameKey: 'GaugeClusterSettings_DisplayName_0088' },
      { value: 'total', displayName: 'Total', displayNameKey: 'GaugeClusterSettings_DisplayName_0089' },
      { value: 'count', displayName: 'Count', displayNameKey: 'GaugeClusterSettings_DisplayName_0090' },
      { value: 'custom', displayName: 'Custom Text', displayNameKey: 'GaugeClusterSettings_DisplayName_0091' },
    ],
    value: { value: 'selectedOrAverage', displayName: 'Selected Gauge or Average', displayNameKey: 'GaugeClusterSettings_DisplayName_0092' },
  });

  customText = new formattingSettings.TextInput({
    name: 'customText',
    displayName: 'Custom Text', displayNameKey: 'GaugeClusterSettings_DisplayName_0093',
    value: '',
    placeholder: 'Overview', placeholderKey: 'GaugeClusterSettings_Placeholder_0002',
  });

  captionMode = new formattingSettings.ItemDropdown({
    name: 'captionMode',
    displayName: 'Caption', displayNameKey: 'GaugeClusterSettings_DisplayName_0094',
    items: [
      { value: 'auto', displayName: 'Auto', displayNameKey: 'GaugeClusterSettings_DisplayName_0095' },
      { value: 'none', displayName: 'None', displayNameKey: 'GaugeClusterSettings_DisplayName_0096' },
      { value: 'custom', displayName: 'Custom', displayNameKey: 'GaugeClusterSettings_DisplayName_0097' },
    ],
    value: { value: 'auto', displayName: 'Auto', displayNameKey: 'GaugeClusterSettings_DisplayName_0098' },
  });

  customCaption = new formattingSettings.TextInput({
    name: 'customCaption',
    displayName: 'Custom Caption', displayNameKey: 'GaugeClusterSettings_DisplayName_0099',
    value: '',
    placeholder: 'Portfolio Average', placeholderKey: 'GaugeClusterSettings_Placeholder_0003',
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Summary Font Size', displayNameKey: 'GaugeClusterSettings_DisplayName_0100',
    value: 22,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Summary Font Color', displayNameKey: 'GaugeClusterSettings_DisplayName_0101',
    value: { value: '' },
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Summary Font Family', displayNameKey: 'GaugeClusterSettings_DisplayName_0102',
    items: [
      { value: '', displayName: 'Default', displayNameKey: 'GaugeClusterSettings_DisplayName_0103' },
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'GaugeClusterSettings_DisplayName_0104' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'GaugeClusterSettings_DisplayName_0105' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'GaugeClusterSettings_DisplayName_0106' },
      { value: 'Helvetica', displayName: 'Helvetica', displayNameKey: 'GaugeClusterSettings_DisplayName_0107' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'GaugeClusterSettings_DisplayName_0108' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'GaugeClusterSettings_DisplayName_0109' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'GaugeClusterSettings_DisplayName_0110' },
    ],
    value: { value: '', displayName: 'Default', displayNameKey: 'GaugeClusterSettings_DisplayName_0111' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Summary Font Weight', displayNameKey: 'GaugeClusterSettings_DisplayName_0112',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'GaugeClusterSettings_DisplayName_0113' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'GaugeClusterSettings_DisplayName_0114' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'GaugeClusterSettings_DisplayName_0115' },
    ],
    value: { value: '600', displayName: 'Semi-Bold', displayNameKey: 'GaugeClusterSettings_DisplayName_0116' },
  });

  captionFontSize = new formattingSettings.NumUpDown({
    name: 'captionFontSize',
    displayName: 'Caption Font Size', displayNameKey: 'GaugeClusterSettings_DisplayName_0117',
    value: 11,
  });

  captionFontColor = new formattingSettings.ColorPicker({
    name: 'captionFontColor',
    displayName: 'Caption Font Color', displayNameKey: 'GaugeClusterSettings_DisplayName_0118',
    value: { value: '' },
  });

  name = 'summarySettings';
  displayName = 'Summary';
  displayNameKey = 'GaugeClusterSettings_DisplayName_0079';
  slices = [
    this.show,
    this.displayMode,
    this.customText,
    this.captionMode,
    this.customCaption,
    this.fontSize,
    this.fontColor,
    this.fontFamily,
    this.fontWeight,
    this.captionFontSize,
    this.captionFontColor,
  ];
}

// ── Card Style ──────────────────────────────────────────────────────

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style', displayNameKey: 'GaugeClusterSettings_DisplayName_0067',
    items: CARD_STYLE_MODE_ITEMS,
    value: { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'GaugeClusterSettings_DisplayName_0072' },
  });

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background Color', displayNameKey: 'GaugeClusterSettings_DisplayName_0073',
    value: { value: '' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Background Opacity (%)', displayNameKey: 'GaugeClusterSettings_DisplayName_0074',
    value: 85,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius', displayNameKey: 'GaugeClusterSettings_DisplayName_0075',
    value: 12,
  });

  contentPadding = new formattingSettings.NumUpDown({
    name: 'contentPadding',
    displayName: 'Content Padding', displayNameKey: 'GaugeClusterSettings_DisplayName_0076',
    value: 12,
  });

  name = 'cardSettings';
  displayName = 'Card Style';
  displayNameKey = 'GaugeClusterSettings_DisplayName_0007';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.contentPadding];
}

// ── Animation ───────────────────────────────────────────────────────

class AnimationSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Animations', displayNameKey: 'GaugeClusterSettings_DisplayName_0077',
    value: true,
  });

  duration = new formattingSettings.NumUpDown({
    name: 'duration',
    displayName: 'Duration (ms)', displayNameKey: 'GaugeClusterSettings_DisplayName_0078',
    value: 600,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  displayNameKey = 'GaugeClusterSettings_DisplayName_0008';
  slices = [this.enabled, this.duration];
}

// ── Root Model ──────────────────────────────────────────────────────

export class GaugeClusterSettings extends formattingSettings.Model {
  gridLayoutSettings = new GridLayoutSettingsCard();
  arcAppearanceSettings = new ArcAppearanceSettingsCard();
  valueRangeSettings = new ValueRangeSettingsCard();
  zoneSettings = new ZoneSettings();
  targetSettings = new TargetSettings();
  labelsSettings = new LabelsSettingsCard();
  summarySettings = new SummarySettings();

  titleFormattingCard = new TitleFormattingCard();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  numberFormattingCard = new NumberFormattingCard();

  animationSettings = new AnimationSettings();
  cardSettings = new CardStyleSettings();

  legendFormattingCard = new LegendFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  colorThemeFormattingCard = new ColorThemeFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  cards = [
    this.titleFormattingCard,
    this.gridLayoutSettings,
    this.arcAppearanceSettings,
    this.valueRangeSettings,
    this.zoneSettings,
    this.targetSettings,
    this.labelsSettings,
    this.dataLabelFormattingCard,
    this.summarySettings,
    this.numberFormattingCard,
    this.conditionalFormattingCard,
    this.legendFormattingCard,
    this.animationSettings,
    this.cardSettings,
    this.colorThemeFormattingCard,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
