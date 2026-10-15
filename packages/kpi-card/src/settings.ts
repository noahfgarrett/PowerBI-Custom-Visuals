/**
 * KPI Card Pro — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { TitleFormattingCard, NumberFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard,
  DateFilterFormattingCard,
  CARD_STYLE_MODE_ITEMS
} from '../../core/src';
class ValueSettings extends formattingSettings.SimpleCard {
  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size', displayNameKey: 'KpiCardSettings_DisplayName_0010',
    value: 32,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color', displayNameKey: 'KpiCardSettings_DisplayName_0011',
    value: { value: '' }, // empty = use theme default
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Font Family', displayNameKey: 'KpiCardSettings_DisplayName_0012',
    items: [
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'KpiCardSettings_DisplayName_0013' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'KpiCardSettings_DisplayName_0014' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'KpiCardSettings_DisplayName_0015' },
      { value: 'Helvetica', displayName: 'Helvetica', displayNameKey: 'KpiCardSettings_DisplayName_0016' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'KpiCardSettings_DisplayName_0017' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'KpiCardSettings_DisplayName_0018' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'KpiCardSettings_DisplayName_0019' },
    ],
    value: { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'KpiCardSettings_DisplayName_0020' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Font Weight', displayNameKey: 'KpiCardSettings_DisplayName_0021',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'KpiCardSettings_DisplayName_0022' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'KpiCardSettings_DisplayName_0023' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'KpiCardSettings_DisplayName_0024' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'KpiCardSettings_DisplayName_0025' },
  });

  alignment = new formattingSettings.ItemDropdown({
    name: 'alignment',
    displayName: 'Horizontal Alignment', displayNameKey: 'KpiCardSettings_DisplayName_0026',
    items: [
      { value: 'left', displayName: 'Left', displayNameKey: 'KpiCardSettings_DisplayName_0027' },
      { value: 'center', displayName: 'Center', displayNameKey: 'KpiCardSettings_DisplayName_0028' },
      { value: 'right', displayName: 'Right', displayNameKey: 'KpiCardSettings_DisplayName_0029' },
    ],
    value: { value: 'left', displayName: 'Left', displayNameKey: 'KpiCardSettings_DisplayName_0030' },
  });

  verticalAlignment = new formattingSettings.ItemDropdown({
    name: 'verticalAlignment',
    displayName: 'Content Vertical Alignment', displayNameKey: 'KpiCardSettings_DisplayName_0031',
    items: [
      { value: 'top', displayName: 'Top', displayNameKey: 'KpiCardSettings_DisplayName_0032' },
      { value: 'center', displayName: 'Center', displayNameKey: 'KpiCardSettings_DisplayName_0033' },
      { value: 'bottom', displayName: 'Bottom', displayNameKey: 'KpiCardSettings_DisplayName_0034' },
    ],
    value: { value: 'top', displayName: 'Top', displayNameKey: 'KpiCardSettings_DisplayName_0035' },
  });

  name = 'valueSettings';
  displayName = 'Value';
  displayNameKey = 'KpiCardSettings_DisplayName_0001';
  slices = [this.fontSize, this.fontColor, this.fontFamily, this.fontWeight, this.alignment, this.verticalAlignment];
}

class LabelSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Label', displayNameKey: 'KpiCardSettings_DisplayName_0036',
    value: true,
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size', displayNameKey: 'KpiCardSettings_DisplayName_0037',
    value: 11,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color', displayNameKey: 'KpiCardSettings_DisplayName_0038',
    value: { value: '' },
  });

  customText = new formattingSettings.TextInput({
    name: 'text',
    displayName: 'Custom Text', displayNameKey: 'KpiCardSettings_DisplayName_0039',
    value: '',
    placeholder: 'Override label text', placeholderKey: 'KpiCardSettings_Placeholder_0001',
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Font Family', displayNameKey: 'KpiCardSettings_DisplayName_0040',
    items: [
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'KpiCardSettings_DisplayName_0041' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'KpiCardSettings_DisplayName_0042' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'KpiCardSettings_DisplayName_0043' },
      { value: 'Helvetica', displayName: 'Helvetica', displayNameKey: 'KpiCardSettings_DisplayName_0044' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'KpiCardSettings_DisplayName_0045' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'KpiCardSettings_DisplayName_0046' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'KpiCardSettings_DisplayName_0047' },
    ],
    value: { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'KpiCardSettings_DisplayName_0048' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Font Weight', displayNameKey: 'KpiCardSettings_DisplayName_0049',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'KpiCardSettings_DisplayName_0050' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'KpiCardSettings_DisplayName_0051' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'KpiCardSettings_DisplayName_0052' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'KpiCardSettings_DisplayName_0053' },
  });

  position = new formattingSettings.ItemDropdown({
    name: 'position',
    displayName: 'Position', displayNameKey: 'KpiCardSettings_DisplayName_0054',
    items: [
      { value: 'above', displayName: 'Above Value', displayNameKey: 'KpiCardSettings_DisplayName_0055' },
      { value: 'below', displayName: 'Below Value', displayNameKey: 'KpiCardSettings_DisplayName_0056' },
    ],
    value: { value: 'above', displayName: 'Above Value', displayNameKey: 'KpiCardSettings_DisplayName_0057' },
  });

  alignment = new formattingSettings.ItemDropdown({
    name: 'alignment',
    displayName: 'Horizontal Alignment', displayNameKey: 'KpiCardSettings_DisplayName_0058',
    items: [
      { value: 'left', displayName: 'Left', displayNameKey: 'KpiCardSettings_DisplayName_0059' },
      { value: 'center', displayName: 'Center', displayNameKey: 'KpiCardSettings_DisplayName_0060' },
      { value: 'right', displayName: 'Right', displayNameKey: 'KpiCardSettings_DisplayName_0061' },
    ],
    value: { value: 'left', displayName: 'Left', displayNameKey: 'KpiCardSettings_DisplayName_0062' },
  });

  name = 'labelSettings';
  displayName = 'Label';
  displayNameKey = 'KpiCardSettings_DisplayName_0002';
  slices = [this.show, this.position, this.alignment, this.fontSize, this.fontColor, this.fontFamily, this.fontWeight, this.customText];
}

class TrendSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Target Variance', displayNameKey: 'KpiCardSettings_DisplayName_0068',
    value: true,
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size', displayNameKey: 'KpiCardSettings_DisplayName_0069',
    value: 14,
  });

  positiveColor = new formattingSettings.ColorPicker({
    name: 'positiveColor',
    displayName: 'Above Target Color', displayNameKey: 'KpiCardSettings_DisplayName_0070',
    value: { value: '#34D399' },
  });

  negativeColor = new formattingSettings.ColorPicker({
    name: 'negativeColor',
    displayName: 'Below Target Color', displayNameKey: 'KpiCardSettings_DisplayName_0071',
    value: { value: '#F87171' },
  });

  neutralColor = new formattingSettings.ColorPicker({
    name: 'neutralColor',
    displayName: 'At Target Color', displayNameKey: 'KpiCardSettings_DisplayName_0072',
    value: { value: '#94A3B8' },
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Font Family', displayNameKey: 'KpiCardSettings_DisplayName_0073',
    items: [
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'KpiCardSettings_DisplayName_0074' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'KpiCardSettings_DisplayName_0075' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'KpiCardSettings_DisplayName_0076' },
      { value: 'Helvetica', displayName: 'Helvetica', displayNameKey: 'KpiCardSettings_DisplayName_0077' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'KpiCardSettings_DisplayName_0078' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'KpiCardSettings_DisplayName_0079' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'KpiCardSettings_DisplayName_0080' },
    ],
    value: { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'KpiCardSettings_DisplayName_0081' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Font Weight', displayNameKey: 'KpiCardSettings_DisplayName_0082',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'KpiCardSettings_DisplayName_0083' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'KpiCardSettings_DisplayName_0084' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'KpiCardSettings_DisplayName_0085' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'KpiCardSettings_DisplayName_0086' },
  });

  name = 'trendSettings';
  displayName = 'Target Variance';
  displayNameKey = 'KpiCardSettings_DisplayName_0003';
  slices = [this.show, this.fontSize, this.positiveColor, this.negativeColor, this.neutralColor, this.fontFamily, this.fontWeight];
}

class SparklineSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Sparkline', displayNameKey: 'KpiCardSettings_DisplayName_0087',
    value: true,
  });

  sparklineType = new formattingSettings.ItemDropdown({
    name: 'sparklineType',
    displayName: 'Sparkline Type', displayNameKey: 'KpiCardSettings_DisplayName_0088',
    items: [
      { value: 'line', displayName: 'Line', displayNameKey: 'KpiCardSettings_DisplayName_0089' },
      { value: 'area', displayName: 'Area', displayNameKey: 'KpiCardSettings_DisplayName_0090' },
      { value: 'bar', displayName: 'Bar', displayNameKey: 'KpiCardSettings_DisplayName_0091' },
    ],
    value: { value: 'line', displayName: 'Line', displayNameKey: 'KpiCardSettings_DisplayName_0092' },
  });

  lineColor = new formattingSettings.ColorPicker({
    name: 'lineColor',
    displayName: 'Area Fill Color', displayNameKey: 'KpiCardSettings_DisplayName_0093',
    value: { value: '' },
  });

  fillOpacity = new formattingSettings.NumUpDown({
    name: 'fillOpacity',
    displayName: 'Area Fill Opacity (%)', displayNameKey: 'KpiCardSettings_DisplayName_0094',
    value: 45,
  });

  sparklineColor = new formattingSettings.ColorPicker({
    name: 'sparklineColor',
    displayName: 'Series Color', displayNameKey: 'KpiCardSettings_DisplayName_0095',
    value: { value: '' },
  });

  sparklineWidth = new formattingSettings.NumUpDown({
    name: 'sparklineWidth',
    displayName: 'Sparkline Width', displayNameKey: 'KpiCardSettings_DisplayName_0096',
    value: 2,
  });

  dividerColor = new formattingSettings.ColorPicker({
    name: 'dividerColor',
    displayName: 'Divider Color', displayNameKey: 'KpiCardSettings_DisplayName_0097',
    value: { value: '' },
  });

  showMinMax = new formattingSettings.ToggleSwitch({
    name: 'showMinMax',
    displayName: 'Show Min/Max', displayNameKey: 'KpiCardSettings_DisplayName_0098',
    value: false,
  });

  minColor = new formattingSettings.ColorPicker({
    name: 'minColor',
    displayName: 'Min Marker Color', displayNameKey: 'KpiCardSettings_DisplayName_0099',
    value: { value: '#F87171' },
  });

  maxColor = new formattingSettings.ColorPicker({
    name: 'maxColor',
    displayName: 'Max Marker Color', displayNameKey: 'KpiCardSettings_DisplayName_0100',
    value: { value: '#34D399' },
  });

  cumulative = new formattingSettings.ToggleSwitch({
    name: 'cumulative',
    displayName: 'Show Cumulative Total', displayNameKey: 'KpiCardSettings_DisplayName_0101',
    value: false,
  });

  endpointMarker = new formattingSettings.ItemDropdown({
    name: 'endpointMarker',
    displayName: 'Endpoint Marker', displayNameKey: 'KpiCardSettings_DisplayName_0102',
    items: [
      { value: 'circle', displayName: 'Circle', displayNameKey: 'KpiCardSettings_DisplayName_0103' },
      { value: 'triangle', displayName: 'Triangle', displayNameKey: 'KpiCardSettings_DisplayName_0104' },
      { value: 'diamond', displayName: 'Diamond', displayNameKey: 'KpiCardSettings_DisplayName_0105' },
      { value: 'none', displayName: 'None', displayNameKey: 'KpiCardSettings_DisplayName_0106' },
    ],
    value: { value: 'circle', displayName: 'Circle', displayNameKey: 'KpiCardSettings_DisplayName_0107' },
  });

  name = 'sparklineSettings';
  displayName = 'Sparkline';
  displayNameKey = 'KpiCardSettings_DisplayName_0004';
  slices = [this.show, this.sparklineType, this.lineColor, this.fillOpacity, this.sparklineColor, this.sparklineWidth, this.dividerColor, this.showMinMax, this.minColor, this.maxColor, this.cumulative, this.endpointMarker];
}

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style', displayNameKey: 'KpiCardSettings_DisplayName_0108',
    items: CARD_STYLE_MODE_ITEMS,
    value: { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'KpiCardSettings_DisplayName_0113' },
  });

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background Color', displayNameKey: 'KpiCardSettings_DisplayName_0114',
    value: { value: '' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Background Opacity (%)', displayNameKey: 'KpiCardSettings_DisplayName_0115',
    value: 85,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius', displayNameKey: 'KpiCardSettings_DisplayName_0116',
    value: 12,
  });

  kpiCount = new formattingSettings.ItemDropdown({
    name: 'kpiCount',
    displayName: 'KPI Count', displayNameKey: 'KpiCardSettings_DisplayName_0117',
    items: [
      { value: '1', displayName: '1', displayNameKey: 'KpiCardSettings_DisplayName_0118' },
      { value: '2', displayName: '2', displayNameKey: 'KpiCardSettings_DisplayName_0119' },
      { value: '3', displayName: '3', displayNameKey: 'KpiCardSettings_DisplayName_0120' },
      { value: '4', displayName: '4', displayNameKey: 'KpiCardSettings_DisplayName_0121' },
    ],
    value: { value: '1', displayName: '1', displayNameKey: 'KpiCardSettings_DisplayName_0122' },
  });

  contentPadding = new formattingSettings.NumUpDown({
    name: 'contentPadding',
    displayName: 'Content Padding', displayNameKey: 'KpiCardSettings_DisplayName_0123',
    value: 8,
  });

  name = 'cardSettings';
  displayName = 'Card Style';
  displayNameKey = 'KpiCardSettings_DisplayName_0005';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.kpiCount, this.contentPadding];
}

class AnimationSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Animations', displayNameKey: 'KpiCardSettings_DisplayName_0124',
    value: true,
  });

  duration = new formattingSettings.NumUpDown({
    name: 'duration',
    displayName: 'Duration (ms)', displayNameKey: 'KpiCardSettings_DisplayName_0125',
    value: 600,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  displayNameKey = 'KpiCardSettings_DisplayName_0006';
  slices = [this.enabled, this.duration];
}

// -- KPI Comparison Settings --------------------------------------------------

class KpiComparisonSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Comparison', displayNameKey: 'KpiCardSettings_DisplayName_0126',
    value: false,
  });

  showPercentChange = new formattingSettings.ToggleSwitch({
    name: 'showPercentChange',
    displayName: 'Show % Change', displayNameKey: 'KpiCardSettings_DisplayName_0127',
    value: true,
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size', displayNameKey: 'KpiCardSettings_DisplayName_0128',
    value: 11,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color', displayNameKey: 'KpiCardSettings_DisplayName_0129',
    value: { value: '#64748B' },
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Font Family', displayNameKey: 'KpiCardSettings_DisplayName_0130',
    items: [
      { value: '', displayName: 'Default', displayNameKey: 'KpiCardSettings_DisplayName_0131' },
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'KpiCardSettings_DisplayName_0132' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'KpiCardSettings_DisplayName_0133' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'KpiCardSettings_DisplayName_0134' },
      { value: 'Helvetica Neue', displayName: 'Helvetica Neue', displayNameKey: 'KpiCardSettings_DisplayName_0135' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'KpiCardSettings_DisplayName_0136' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'KpiCardSettings_DisplayName_0137' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'KpiCardSettings_DisplayName_0138' },
    ],
    value: { value: '', displayName: 'Default', displayNameKey: 'KpiCardSettings_DisplayName_0139' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Font Weight', displayNameKey: 'KpiCardSettings_DisplayName_0140',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'KpiCardSettings_DisplayName_0141' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'KpiCardSettings_DisplayName_0142' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'KpiCardSettings_DisplayName_0143' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'KpiCardSettings_DisplayName_0144' },
  });

  alignment = new formattingSettings.ItemDropdown({
    name: 'alignment',
    displayName: 'Alignment', displayNameKey: 'KpiCardSettings_DisplayName_0145',
    items: [
      { value: 'left', displayName: 'Left', displayNameKey: 'KpiCardSettings_DisplayName_0146' },
      { value: 'center', displayName: 'Center', displayNameKey: 'KpiCardSettings_DisplayName_0147' },
      { value: 'right', displayName: 'Right', displayNameKey: 'KpiCardSettings_DisplayName_0148' },
    ],
    value: { value: 'left', displayName: 'Left', displayNameKey: 'KpiCardSettings_DisplayName_0149' },
  });

  paddingTop = new formattingSettings.NumUpDown({
    name: 'paddingTop',
    displayName: 'Top Padding', displayNameKey: 'KpiCardSettings_DisplayName_0150',
    value: 2,
  });

  compareMode = new formattingSettings.ItemDropdown({
    name: 'compareMode',
    displayName: 'Compare Against', displayNameKey: 'KpiCardSettings_DisplayName_0151',
    items: [
      { value: 'target', displayName: 'Target', displayNameKey: 'KpiCardSettings_DisplayName_0152' },
      { value: 'previous', displayName: 'Previous Period', displayNameKey: 'KpiCardSettings_DisplayName_0153' },
      { value: 'first', displayName: 'First Period', displayNameKey: 'KpiCardSettings_DisplayName_0154' },
    ],
    value: { value: 'target', displayName: 'Target', displayNameKey: 'KpiCardSettings_DisplayName_0155' },
  });

  name = 'kpiComparisonSettings';
  displayName = 'Comparison';
  displayNameKey = 'KpiCardSettings_DisplayName_0007';
  slices = [this.show, this.compareMode, this.showPercentChange, this.fontSize, this.fontColor, this.fontFamily, this.fontWeight, this.alignment, this.paddingTop];
}

// -- KPI Change Indicator Settings -------------------------------------------

class KpiChangeIndicatorSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Change Indicator', displayNameKey: 'KpiCardSettings_DisplayName_0156',
    value: true,
  });

  showIcon = new formattingSettings.ToggleSwitch({
    name: 'showIcon',
    displayName: 'Show Direction Icon', displayNameKey: 'KpiCardSettings_DisplayName_0157',
    value: true,
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size', displayNameKey: 'KpiCardSettings_DisplayName_0158',
    value: 12,
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Font Family', displayNameKey: 'KpiCardSettings_DisplayName_0159',
    items: [
      { value: '', displayName: 'Default', displayNameKey: 'KpiCardSettings_DisplayName_0160' },
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'KpiCardSettings_DisplayName_0161' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'KpiCardSettings_DisplayName_0162' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'KpiCardSettings_DisplayName_0163' },
      { value: 'Helvetica Neue', displayName: 'Helvetica Neue', displayNameKey: 'KpiCardSettings_DisplayName_0164' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'KpiCardSettings_DisplayName_0165' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'KpiCardSettings_DisplayName_0166' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'KpiCardSettings_DisplayName_0167' },
    ],
    value: { value: '', displayName: 'Default', displayNameKey: 'KpiCardSettings_DisplayName_0168' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Font Weight', displayNameKey: 'KpiCardSettings_DisplayName_0169',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'KpiCardSettings_DisplayName_0170' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'KpiCardSettings_DisplayName_0171' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'KpiCardSettings_DisplayName_0172' },
    ],
    value: { value: '600', displayName: 'Semi-Bold', displayNameKey: 'KpiCardSettings_DisplayName_0173' },
  });

  alignment = new formattingSettings.ItemDropdown({
    name: 'alignment',
    displayName: 'Alignment', displayNameKey: 'KpiCardSettings_DisplayName_0174',
    items: [
      { value: 'left', displayName: 'Left', displayNameKey: 'KpiCardSettings_DisplayName_0175' },
      { value: 'center', displayName: 'Center', displayNameKey: 'KpiCardSettings_DisplayName_0176' },
      { value: 'right', displayName: 'Right', displayNameKey: 'KpiCardSettings_DisplayName_0177' },
    ],
    value: { value: 'left', displayName: 'Left', displayNameKey: 'KpiCardSettings_DisplayName_0178' },
  });

  paddingTop = new formattingSettings.NumUpDown({
    name: 'paddingTop',
    displayName: 'Top Padding', displayNameKey: 'KpiCardSettings_DisplayName_0179',
    value: 4,
  });

  iconSize = new formattingSettings.NumUpDown({
    name: 'iconSize',
    displayName: 'Arrow Size', displayNameKey: 'KpiCardSettings_DisplayName_0180',
    value: 12,
  });

  positiveColor = new formattingSettings.ColorPicker({
    name: 'positiveColor',
    displayName: 'Increase Color', displayNameKey: 'KpiCardSettings_DisplayName_0181',
    value: { value: '#16A34A' },
  });

  negativeColor = new formattingSettings.ColorPicker({
    name: 'negativeColor',
    displayName: 'Decrease Color', displayNameKey: 'KpiCardSettings_DisplayName_0182',
    value: { value: '#DC2626' },
  });

  neutralColor = new formattingSettings.ColorPicker({
    name: 'neutralColor',
    displayName: 'Neutral Color', displayNameKey: 'KpiCardSettings_DisplayName_0183',
    value: { value: '#64748B' },
  });

  name = 'kpiChangeIndicatorSettings';
  displayName = 'Change Indicator';
  displayNameKey = 'KpiCardSettings_DisplayName_0008';
  slices = [
    this.show,
    this.showIcon,
    this.fontSize,
    this.fontFamily,
    this.fontWeight,
    this.alignment,
    this.paddingTop,
    this.iconSize,
    this.positiveColor,
    this.negativeColor,
    this.neutralColor,
  ];
}

// -- KPI Goal Settings --------------------------------------------------------

class KpiGoalSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Goal Progress', displayNameKey: 'KpiCardSettings_DisplayName_0184',
    value: false,
  });

  goalValue = new formattingSettings.NumUpDown({
    name: 'goalValue',
    displayName: 'Goal Override (0 Uses Target)', displayNameKey: 'KpiCardSettings_DisplayName_0185',
    value: 0,
  });

  goalWarningValue = new formattingSettings.NumUpDown({
    name: 'goalWarningValue',
    displayName: 'Caution Value', displayNameKey: 'KpiCardSettings_DisplayName_0215',
    value: 10,
  });

  showProgressBar = new formattingSettings.ToggleSwitch({
    name: 'showProgressBar',
    displayName: 'Show Progress Bar', displayNameKey: 'KpiCardSettings_DisplayName_0186',
    value: true,
  });

  metColor = new formattingSettings.ColorPicker({
    name: 'metColor',
    displayName: 'Goal Met Color', displayNameKey: 'KpiCardSettings_DisplayName_0187',
    value: { value: '#22C55E' },
  });

  unmetColor = new formattingSettings.ColorPicker({
    name: 'unmetColor',
    displayName: 'Goal Unmet Color', displayNameKey: 'KpiCardSettings_DisplayName_0188',
    value: { value: '#EF4444' },
  });

  warningColor = new formattingSettings.ColorPicker({
    name: 'warningColor',
    displayName: 'Caution Color', displayNameKey: 'KpiCardSettings_DisplayName_0216',
    value: { value: '#F59E0B' },
  });

  gradientProgress = new formattingSettings.ToggleSwitch({
    name: 'gradientProgress',
    displayName: 'Use Gradient Colors', displayNameKey: 'KpiCardSettings_DisplayName_0189',
    value: false,
  });

  showGoalText = new formattingSettings.ToggleSwitch({
    name: 'showGoalText',
    displayName: 'Show Goal Text', displayNameKey: 'KpiCardSettings_DisplayName_0190',
    value: true,
  });

  goalTextAlignment = new formattingSettings.ItemDropdown({
    name: 'goalTextAlignment',
    displayName: 'Goal Text Alignment', displayNameKey: 'KpiCardSettings_DisplayName_0191',
    items: [
      { value: 'left', displayName: 'Left', displayNameKey: 'KpiCardSettings_DisplayName_0192' },
      { value: 'center', displayName: 'Center', displayNameKey: 'KpiCardSettings_DisplayName_0193' },
      { value: 'right', displayName: 'Right', displayNameKey: 'KpiCardSettings_DisplayName_0194' },
    ],
    value: { value: 'center', displayName: 'Center', displayNameKey: 'KpiCardSettings_DisplayName_0195' },
  });

  goalTextFontSize = new formattingSettings.NumUpDown({
    name: 'goalTextFontSize',
    displayName: 'Goal Text Font Size', displayNameKey: 'KpiCardSettings_DisplayName_0196',
    value: 11,
  });

  goalTextColor = new formattingSettings.ColorPicker({
    name: 'goalTextColor',
    displayName: 'Goal Text Color', displayNameKey: 'KpiCardSettings_DisplayName_0197',
    value: { value: '#64748B' },
  });

  goalTextFontFamily = new formattingSettings.ItemDropdown({
    name: 'goalTextFontFamily',
    displayName: 'Goal Text Font Family', displayNameKey: 'KpiCardSettings_DisplayName_0198',
    items: [
      { value: '', displayName: 'Default', displayNameKey: 'KpiCardSettings_DisplayName_0199' },
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'KpiCardSettings_DisplayName_0200' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'KpiCardSettings_DisplayName_0201' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'KpiCardSettings_DisplayName_0202' },
      { value: 'Helvetica Neue', displayName: 'Helvetica Neue', displayNameKey: 'KpiCardSettings_DisplayName_0203' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'KpiCardSettings_DisplayName_0204' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'KpiCardSettings_DisplayName_0205' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'KpiCardSettings_DisplayName_0206' },
    ],
    value: { value: '', displayName: 'Default', displayNameKey: 'KpiCardSettings_DisplayName_0207' },
  });

  goalTextFontWeight = new formattingSettings.ItemDropdown({
    name: 'goalTextFontWeight',
    displayName: 'Goal Text Font Weight', displayNameKey: 'KpiCardSettings_DisplayName_0208',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'KpiCardSettings_DisplayName_0209' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'KpiCardSettings_DisplayName_0210' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'KpiCardSettings_DisplayName_0211' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'KpiCardSettings_DisplayName_0212' },
  });

  goalTextPaddingTop = new formattingSettings.NumUpDown({
    name: 'goalTextPaddingTop',
    displayName: 'Goal Text Top Padding', displayNameKey: 'KpiCardSettings_DisplayName_0213',
    value: 2,
  });

  progressBarHeight = new formattingSettings.NumUpDown({
    name: 'progressBarHeight',
    displayName: 'Progress Bar Height', displayNameKey: 'KpiCardSettings_DisplayName_0214',
    value: 6,
  });

  showGoalLegend = new formattingSettings.ToggleSwitch({
    name: 'showGoalLegend',
    displayName: 'Show Goal Legend', displayNameKey: 'KpiCardSettings_DisplayName_0217',
    value: true,
  });

  invertLegendDirection = new formattingSettings.ToggleSwitch({
    name: 'invertLegendDirection',
    displayName: 'Low-to-High Legend Order', displayNameKey: 'KpiCardSettings_DisplayName_0218',
    value: true,
  });

  goalBlockPaddingTop = new formattingSettings.NumUpDown({
    name: 'goalBlockPaddingTop',
    displayName: 'Goal Area Top Padding', displayNameKey: 'KpiCardSettings_DisplayName_0219',
    value: 0,
  });

  name = 'kpiGoalSettings';
  displayName = 'Goal Progress';
  displayNameKey = 'KpiCardSettings_DisplayName_0009';
  slices = [
    this.show,
    this.goalValue,
    this.goalWarningValue,
    this.showProgressBar,
    this.gradientProgress,
    this.metColor,
    this.warningColor,
    this.unmetColor,
    this.progressBarHeight,
    this.showGoalLegend,
    this.invertLegendDirection,
    this.goalBlockPaddingTop,
    this.showGoalText,
    this.goalTextAlignment,
    this.goalTextFontSize,
    this.goalTextColor,
    this.goalTextFontFamily,
    this.goalTextFontWeight,
    this.goalTextPaddingTop,
  ];
}

export class KpiCardSettings extends formattingSettings.Model {
  valueSettings = new ValueSettings();
  labelSettings = new LabelSettings();
  trendSettings = new TrendSettings();
  sparklineSettings = new SparklineSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();
  kpiComparisonSettings = new KpiComparisonSettings();
  kpiChangeIndicatorSettings = new KpiChangeIndicatorSettings();
  kpiGoalSettings = new KpiGoalSettings();

  titleFormattingCard = new TitleFormattingCard();
  numberFormattingCard = new NumberFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();

  dateFilterFormattingCard = new DateFilterFormattingCard();
  cards = [
    this.titleFormattingCard,
    this.valueSettings,
    this.labelSettings,
    this.trendSettings,
    this.kpiComparisonSettings,
    this.kpiChangeIndicatorSettings,
    this.sparklineSettings,
    this.kpiGoalSettings,
    this.numberFormattingCard,
    this.conditionalFormattingCard,
    this.cardSettings,
    this.animationSettings,
    this.colorThemeFormattingCard,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
