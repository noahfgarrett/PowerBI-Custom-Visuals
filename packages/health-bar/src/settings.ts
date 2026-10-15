/**
 * Health Bar — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ScrollFormattingCard, SortFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, AnnotationFormattingCard, AccessibilityFormattingCard, NumberFormattingCard,
  ColorThemeFormattingCard,
  DateFilterFormattingCard,
  CARD_STYLE_MODE_ITEMS
} from '../../core/src';

// ── Bar Shape ────────────────────────────────────────────────────────

class BarShapeSettingsCard extends formattingSettings.SimpleCard {
  chartPaddingTop = new formattingSettings.NumUpDown({
    name: 'chartPaddingTop',
    displayName: 'Chart Top Padding', displayNameKey: 'HealthBarSettings_DisplayName_0010',
    value: 24,
  });

  chartPaddingBottom = new formattingSettings.NumUpDown({
    name: 'chartPaddingBottom',
    displayName: 'Chart Bottom Padding', displayNameKey: 'HealthBarSettings_DisplayName_0011',
    value: 28,
  });

  barWidth = new formattingSettings.NumUpDown({
    name: 'barWidth',
    displayName: 'Bar Width', displayNameKey: 'HealthBarSettings_DisplayName_0012',
    value: 40,
  });

  barCornerRadius = new formattingSettings.NumUpDown({
    name: 'barCornerRadius',
    displayName: 'Bar Corner Radius', displayNameKey: 'HealthBarSettings_DisplayName_0013',
    value: 6,
  });

  gap = new formattingSettings.NumUpDown({
    name: 'gap',
    displayName: 'Gap Between Bars', displayNameKey: 'HealthBarSettings_DisplayName_0014',
    value: 16,
  });

  fillMode = new formattingSettings.ItemDropdown({
    name: 'fillMode',
    displayName: 'Fill Mode', displayNameKey: 'HealthBarSettings_DisplayName_0015',
    items: [
      { value: 'gradient', displayName: 'Gradient', displayNameKey: 'HealthBarSettings_DisplayName_0016' },
      { value: 'solid', displayName: 'Solid', displayNameKey: 'HealthBarSettings_DisplayName_0017' },
    ],
    value: { value: 'gradient', displayName: 'Gradient', displayNameKey: 'HealthBarSettings_DisplayName_0018' },
  });

  name = 'barShapeSettings';
  displayName = 'Bar Shape';
  displayNameKey = 'HealthBarSettings_DisplayName_0001';
  slices = [this.chartPaddingTop, this.chartPaddingBottom, this.barWidth, this.barCornerRadius, this.gap, this.fillMode];
}

// ── Scale & Range (merged healthBarSettings.maxValue + healthBarScale.minValue + showYAxis) ──

class ScaleRangeSettingsCard extends formattingSettings.SimpleCard {
  minValue = new formattingSettings.NumUpDown({
    name: 'minValue',
    displayName: 'Min Value', displayNameKey: 'HealthBarSettings_DisplayName_0019',
    value: 0,
  });

  maxValue = new formattingSettings.NumUpDown({
    name: 'maxValue',
    displayName: 'Max Value', displayNameKey: 'HealthBarSettings_DisplayName_0020',
    value: 100,
  });

  showYAxis = new formattingSettings.ToggleSwitch({
    name: 'showYAxis',
    displayName: 'Show Y-Axis Ticks', displayNameKey: 'HealthBarSettings_DisplayName_0021',
    value: true,
  });

  name = 'scaleRangeSettings';
  displayName = 'Scale & Range';
  displayNameKey = 'HealthBarSettings_DisplayName_0002';
  slices = [this.minValue, this.maxValue, this.showYAxis];
}

// ── Colors ───────────────────────────────────────────────────────────

class ColorSettingsCard extends formattingSettings.SimpleCard {
  lowColor = new formattingSettings.ColorPicker({
    name: 'lowColor',
    displayName: 'Low Color (0%)', displayNameKey: 'HealthBarSettings_DisplayName_0022',
    value: { value: '#EF4444' },
  });

  midColor = new formattingSettings.ColorPicker({
    name: 'midColor',
    displayName: 'Mid Color (50%)', displayNameKey: 'HealthBarSettings_DisplayName_0023',
    value: { value: '#F59E0B' },
  });

  highColor = new formattingSettings.ColorPicker({
    name: 'highColor',
    displayName: 'High Color (100%)', displayNameKey: 'HealthBarSettings_DisplayName_0024',
    value: { value: '#22C55E' },
  });

  trackColor = new formattingSettings.ColorPicker({
    name: 'trackColor',
    displayName: 'Track Color', displayNameKey: 'HealthBarSettings_DisplayName_0025',
    value: { value: '#E2E8F0' },
  });

  trackOpacity = new formattingSettings.NumUpDown({
    name: 'trackOpacity',
    displayName: 'Track Opacity (%)', displayNameKey: 'HealthBarSettings_DisplayName_0026',
    value: 15,
  });

  name = 'colorSettings';
  displayName = 'Colors';
  displayNameKey = 'HealthBarSettings_DisplayName_0003';
  slices = [this.lowColor, this.midColor, this.highColor, this.trackColor, this.trackOpacity];
}

// ── Value Labels (merged showValue, showPercent, valuePosition) ──────

class ValueLabelsSettingsCard extends formattingSettings.SimpleCard {
  showValue = new formattingSettings.ToggleSwitch({
    name: 'showValue',
    displayName: 'Show Value', displayNameKey: 'HealthBarSettings_DisplayName_0027',
    value: true,
  });

  showPercent = new formattingSettings.ToggleSwitch({
    name: 'showPercent',
    displayName: 'Display as Percentage', displayNameKey: 'HealthBarSettings_DisplayName_0028',
    value: true,
  });

  position = new formattingSettings.ItemDropdown({
    name: 'position',
    displayName: 'Value Position', displayNameKey: 'HealthBarSettings_DisplayName_0029',
    items: [
      { value: 'above', displayName: 'Above', displayNameKey: 'HealthBarSettings_DisplayName_0030' },
      { value: 'inside', displayName: 'Inside', displayNameKey: 'HealthBarSettings_DisplayName_0031' },
      { value: 'end', displayName: 'End', displayNameKey: 'HealthBarSettings_DisplayName_0032' },
      { value: 'right', displayName: 'Right', displayNameKey: 'HealthBarSettings_DisplayName_0033' },
    ],
    value: { value: 'above', displayName: 'Above', displayNameKey: 'HealthBarSettings_DisplayName_0034' },
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size', displayNameKey: 'HealthBarSettings_DisplayName_0035',
    value: 11,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color', displayNameKey: 'HealthBarSettings_DisplayName_0036',
    value: { value: '' },
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Font Family', displayNameKey: 'HealthBarSettings_DisplayName_0037',
    items: [
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'HealthBarSettings_DisplayName_0038' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'HealthBarSettings_DisplayName_0039' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'HealthBarSettings_DisplayName_0040' },
      { value: 'Helvetica', displayName: 'Helvetica', displayNameKey: 'HealthBarSettings_DisplayName_0041' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'HealthBarSettings_DisplayName_0042' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'HealthBarSettings_DisplayName_0043' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'HealthBarSettings_DisplayName_0044' },
    ],
    value: { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'HealthBarSettings_DisplayName_0045' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Font Weight', displayNameKey: 'HealthBarSettings_DisplayName_0046',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'HealthBarSettings_DisplayName_0047' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'HealthBarSettings_DisplayName_0048' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'HealthBarSettings_DisplayName_0049' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'HealthBarSettings_DisplayName_0050' },
  });

  name = 'valueLabelsSettings';
  displayName = 'Value Labels';
  displayNameKey = 'HealthBarSettings_DisplayName_0004';
  slices = [this.showValue, this.showPercent, this.position, this.fontSize, this.fontColor, this.fontFamily, this.fontWeight];
}

// ── Category Labels ──────────────────────────────────────────────────

class CategoryLabelSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Category Labels', displayNameKey: 'HealthBarSettings_DisplayName_0051',
    value: true,
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size', displayNameKey: 'HealthBarSettings_DisplayName_0052',
    value: 11,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color', displayNameKey: 'HealthBarSettings_DisplayName_0053',
    value: { value: '' },
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Font Family', displayNameKey: 'HealthBarSettings_DisplayName_0054',
    items: [
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'HealthBarSettings_DisplayName_0055' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'HealthBarSettings_DisplayName_0056' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'HealthBarSettings_DisplayName_0057' },
      { value: 'Helvetica', displayName: 'Helvetica', displayNameKey: 'HealthBarSettings_DisplayName_0058' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'HealthBarSettings_DisplayName_0059' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'HealthBarSettings_DisplayName_0060' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'HealthBarSettings_DisplayName_0061' },
    ],
    value: { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'HealthBarSettings_DisplayName_0062' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Font Weight', displayNameKey: 'HealthBarSettings_DisplayName_0063',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'HealthBarSettings_DisplayName_0064' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'HealthBarSettings_DisplayName_0065' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'HealthBarSettings_DisplayName_0066' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'HealthBarSettings_DisplayName_0067' },
  });

  name = 'categoryLabelSettings';
  displayName = 'Category Labels';
  displayNameKey = 'HealthBarSettings_DisplayName_0005';
  slices = [this.show, this.fontSize, this.fontColor, this.fontFamily, this.fontWeight];
}

// ── Target ───────────────────────────────────────────────────────────

class TargetSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Target', displayNameKey: 'HealthBarSettings_DisplayName_0068',
    value: true,
  });

  color = new formattingSettings.ColorPicker({
    name: 'color',
    displayName: 'Target Color', displayNameKey: 'HealthBarSettings_DisplayName_0069',
    value: { value: '#0F172A' },
  });

  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width', displayNameKey: 'HealthBarSettings_DisplayName_0070',
    value: 2,
  });

  markerStyle = new formattingSettings.ItemDropdown({
    name: 'markerStyle',
    displayName: 'Marker Style', displayNameKey: 'HealthBarSettings_DisplayName_0071',
    items: [
      { value: 'line', displayName: 'Line', displayNameKey: 'HealthBarSettings_DisplayName_0072' },
      { value: 'triangle', displayName: 'Triangle', displayNameKey: 'HealthBarSettings_DisplayName_0073' },
      { value: 'diamond', displayName: 'Diamond', displayNameKey: 'HealthBarSettings_DisplayName_0074' },
    ],
    value: { value: 'line', displayName: 'Line', displayNameKey: 'HealthBarSettings_DisplayName_0075' },
  });

  name = 'targetSettings';
  displayName = 'Target';
  displayNameKey = 'HealthBarSettings_DisplayName_0006';
  slices = [this.show, this.color, this.lineWidth, this.markerStyle];
}

// ── Card Style ───────────────────────────────────────────────────────

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style', displayNameKey: 'HealthBarSettings_DisplayName_0076',
    items: CARD_STYLE_MODE_ITEMS,
    value: { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'HealthBarSettings_DisplayName_0081' },
  });

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background Color', displayNameKey: 'HealthBarSettings_DisplayName_0082',
    value: { value: '' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Background Opacity (%)', displayNameKey: 'HealthBarSettings_DisplayName_0083',
    value: 85,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius', displayNameKey: 'HealthBarSettings_DisplayName_0084',
    value: 12,
  });

  contentPadding = new formattingSettings.NumUpDown({
    name: 'contentPadding',
    displayName: 'Content Padding', displayNameKey: 'HealthBarSettings_DisplayName_0085',
    value: 12,
  });

  name = 'cardSettings';
  displayName = 'Card Style';
  displayNameKey = 'HealthBarSettings_DisplayName_0007';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.contentPadding];
}

// ── Animation ────────────────────────────────────────────────────────

class AnimationSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Animations', displayNameKey: 'HealthBarSettings_DisplayName_0086',
    value: true,
  });

  duration = new formattingSettings.NumUpDown({
    name: 'duration',
    displayName: 'Duration (ms)', displayNameKey: 'HealthBarSettings_DisplayName_0087',
    value: 600,
  });

  staggerDelay = new formattingSettings.NumUpDown({
    name: 'staggerDelay',
    displayName: 'Stagger Delay (ms)', displayNameKey: 'HealthBarSettings_DisplayName_0088',
    value: 80,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  displayNameKey = 'HealthBarSettings_DisplayName_0008';
  slices = [this.enabled, this.duration, this.staggerDelay];
}

// ── Zone Background ─────────────────────────────────────────────────

class HealthBarZoneSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Zone Background', displayNameKey: 'HealthBarSettings_DisplayName_0089',
    value: false,
  });

  zoneColors = new formattingSettings.TextInput({
    name: 'zoneColors',
    displayName: 'Zone Colors', displayNameKey: 'HealthBarSettings_DisplayName_0090',
    value: '#EF4444,#F59E0B,#22C55E',
    placeholder: '#EF4444,#F59E0B,#22C55E', placeholderKey: 'HealthBarSettings_Placeholder_0001',
  });

  name = 'healthBarZone';
  displayName = 'Zone Background';
  displayNameKey = 'HealthBarSettings_DisplayName_0009';
  slices = [this.show, this.zoneColors];
}

// ── KPI Toggle ──────────────────────────────────────────────────────

class MetricToggleSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Metric View Button', displayNameKey: 'HealthBarSettings_DisplayName_0092',
    value: true,
  });

  position = new formattingSettings.ItemDropdown({
    name: 'position',
    displayName: 'Position', displayNameKey: 'HealthBarSettings_DisplayName_0093',
    items: [
      { value: 'topLeft', displayName: 'Top Left', displayNameKey: 'HealthBarSettings_DisplayName_0094' },
      { value: 'topRight', displayName: 'Top Right', displayNameKey: 'HealthBarSettings_DisplayName_0095' },
    ],
    value: { value: 'topRight', displayName: 'Top Right', displayNameKey: 'HealthBarSettings_DisplayName_0095' },
  });

  name = 'metricToggleSettings';
  displayName = 'Metric View Button';
  displayNameKey = 'HealthBarSettings_DisplayName_0091';
  slices = [this.show, this.position];
}

// ── Root Model ───────────────────────────────────────────────────────

export class HealthBarSettings extends formattingSettings.Model {
  barShapeSettings = new BarShapeSettingsCard();
  scaleRangeSettings = new ScaleRangeSettingsCard();
  colorSettings = new ColorSettingsCard();
  valueLabelsSettings = new ValueLabelsSettingsCard();
  categoryLabelSettings = new CategoryLabelSettingsCard();
  targetSettings = new TargetSettings();

  titleFormattingCard = new TitleFormattingCard();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettingsCard();

  axisFormattingCard = new AxisFormattingCard();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  scrollFormattingCard = new ScrollFormattingCard();
  sortFormattingCard = new SortFormattingCard();
  numberFormattingCard = new NumberFormattingCard();

  referenceLineFormattingCard = new ReferenceLineFormattingCard();
  trendLineFormattingCard = new TrendLineFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  annotationFormattingCard = new AnnotationFormattingCard();
  healthBarZone = new HealthBarZoneSettings();
  metricToggleSettings = new MetricToggleSettingsCard();
  legendFormattingCard = new LegendFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  cards = [
    this.barShapeSettings,
    this.scaleRangeSettings,
    this.colorSettings,
    this.valueLabelsSettings,
    this.categoryLabelSettings,
    this.targetSettings,
    this.healthBarZone,
    this.metricToggleSettings,
    this.titleFormattingCard,
    this.legendFormattingCard,
    this.cardSettings,
    this.animationSettings,
    this.axisFormattingCard,
    this.dataLabelFormattingCard,
    this.scrollFormattingCard,
    this.sortFormattingCard,
    this.numberFormattingCard,
    this.referenceLineFormattingCard,
    this.trendLineFormattingCard,
    this.conditionalFormattingCard,
    this.annotationFormattingCard,
    this.colorThemeFormattingCard,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
