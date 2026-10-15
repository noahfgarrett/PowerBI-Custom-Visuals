/**
 * Sunburst Chart -- Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, NumberFormattingCard,
  DateFilterFormattingCard,
  CARD_STYLE_MODE_ITEMS
} from '../../core/src';

// ── Segment Appearance (extracted stroke settings from old Sunburst card) ──
class SegmentAppearanceSettings extends formattingSettings.SimpleCard {
  segmentStrokeColor = new formattingSettings.ColorPicker({
    name: 'segmentStrokeColor',
    displayName: 'Segment Stroke Color', displayNameKey: 'SunburstChartSettings_DisplayName_0008',
    value: { value: '' },
  });

  segmentStrokeWidth = new formattingSettings.NumUpDown({
    name: 'segmentStrokeWidth',
    displayName: 'Segment Stroke Width', displayNameKey: 'SunburstChartSettings_DisplayName_0009',
    value: 1,
  });

  useChartPalette = new formattingSettings.ToggleSwitch({
    name: 'useChartPalette',
    displayName: 'Use Chart Palette', displayNameKey: 'SunburstChartSettings_DisplayName_0010',
    value: true,
  });

  segmentOpacity = new formattingSettings.NumUpDown({
    name: 'segmentOpacity',
    displayName: 'Segment Opacity (%)', displayNameKey: 'SunburstChartSettings_DisplayName_0011',
    value: 100,
  });

  name = 'sunburstSettings';
  displayName = 'Segment Appearance';
  displayNameKey = 'SunburstChartSettings_DisplayName_0001';
  slices = [this.segmentStrokeColor, this.segmentStrokeWidth, this.useChartPalette, this.segmentOpacity];
}

// ── Geometry (renamed from Sunburst Display — innerRadius, startAngle, sortOrder) ──
class GeometrySettings extends formattingSettings.SimpleCard {
  innerRadius = new formattingSettings.NumUpDown({
    name: 'innerRadius',
    displayName: 'Inner Radius', displayNameKey: 'SunburstChartSettings_DisplayName_0012',
    value: 0,
  });

  startAngle = new formattingSettings.NumUpDown({
    name: 'startAngle',
    displayName: 'Start Angle', displayNameKey: 'SunburstChartSettings_DisplayName_0013',
    value: 0,
  });

  sortOrder = new formattingSettings.ItemDropdown({
    name: 'sortOrder',
    displayName: 'Sort Order', displayNameKey: 'SunburstChartSettings_DisplayName_0014',
    items: [
      { value: 'descending', displayName: 'Descending (largest first)', displayNameKey: 'SunburstChartSettings_DisplayName_0015' },
      { value: 'ascending', displayName: 'Ascending (smallest first)', displayNameKey: 'SunburstChartSettings_DisplayName_0016' },
      { value: 'none', displayName: 'Data Order', displayNameKey: 'SunburstChartSettings_DisplayName_0017' },
    ],
    value: { value: 'descending', displayName: 'Descending (largest first)', displayNameKey: 'SunburstChartSettings_DisplayName_0018' },
  });

  chartPadding = new formattingSettings.NumUpDown({
    name: 'chartPadding',
    displayName: 'Chart Padding', displayNameKey: 'SunburstChartSettings_DisplayName_0019',
    value: 24,
  });

  name = 'sunburstDisplaySettings';
  displayName = 'Geometry';
  displayNameKey = 'SunburstChartSettings_DisplayName_0002';
  slices = [this.innerRadius, this.startAngle, this.sortOrder, this.chartPadding];
}

// ── Labels & Percentages (consolidated from Sunburst + Sunburst Display) ──
class LabelsAndPercentagesSettings extends formattingSettings.SimpleCard {
  showLabels = new formattingSettings.ToggleSwitch({
    name: 'showLabels',
    displayName: 'Show Labels', displayNameKey: 'SunburstChartSettings_DisplayName_0020',
    value: true,
  });

  labelMinAngle = new formattingSettings.NumUpDown({
    name: 'labelMinAngle',
    displayName: 'Minimum Label Angle (degrees)', displayNameKey: 'SunburstChartSettings_DisplayName_0021',
    value: 5,
  });

  showPercentages = new formattingSettings.ToggleSwitch({
    name: 'showPercentages',
    displayName: 'Show Percentages', displayNameKey: 'SunburstChartSettings_DisplayName_0022',
    value: false,
  });

  percentOf = new formattingSettings.ItemDropdown({
    name: 'percentOf',
    displayName: 'Percentage Basis', displayNameKey: 'SunburstChartSettings_DisplayName_0023',
    items: [
      { value: 'parent', displayName: 'Parent', displayNameKey: 'SunburstChartSettings_DisplayName_0024' },
      { value: 'total', displayName: 'Total', displayNameKey: 'SunburstChartSettings_DisplayName_0025' },
    ],
    value: { value: 'parent', displayName: 'Parent', displayNameKey: 'SunburstChartSettings_DisplayName_0026' },
  });

  name = 'labelsAndPercentagesSettings';
  displayName = 'Labels & Percentages';
  displayNameKey = 'SunburstChartSettings_DisplayName_0003';
  slices = [this.showLabels, this.labelMinAngle, this.showPercentages, this.percentOf];
}

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style', displayNameKey: 'SunburstChartSettings_DisplayName_0027',
    items: CARD_STYLE_MODE_ITEMS,
    value: { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'SunburstChartSettings_DisplayName_0032' },
  });

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background Color', displayNameKey: 'SunburstChartSettings_DisplayName_0033',
    value: { value: '' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Background Opacity (%)', displayNameKey: 'SunburstChartSettings_DisplayName_0034',
    value: 35,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius', displayNameKey: 'SunburstChartSettings_DisplayName_0035',
    value: 12,
  });

  contentPadding = new formattingSettings.NumUpDown({
    name: 'contentPadding',
    displayName: 'Content Padding', displayNameKey: 'SunburstChartSettings_DisplayName_0085',
    value: 8,
  });

  name = 'cardSettings';
  displayName = 'Card Style';
  displayNameKey = 'SunburstChartSettings_DisplayName_0004';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.contentPadding];
}

class CenterContentSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Center Content', displayNameKey: 'SunburstChartSettings_DisplayName_0036',
    value: true,
  });

  displayMode = new formattingSettings.ItemDropdown({
    name: 'displayMode',
    displayName: 'Display Mode', displayNameKey: 'SunburstChartSettings_DisplayName_0037',
    items: [
      { value: 'total', displayName: 'Total', displayNameKey: 'SunburstChartSettings_DisplayName_0038' },
      { value: 'count', displayName: 'Count', displayNameKey: 'SunburstChartSettings_DisplayName_0039' },
      { value: 'average', displayName: 'Average', displayNameKey: 'SunburstChartSettings_DisplayName_0040' },
      { value: 'custom', displayName: 'Custom', displayNameKey: 'SunburstChartSettings_DisplayName_0041' },
    ],
    value: { value: 'total', displayName: 'Total', displayNameKey: 'SunburstChartSettings_DisplayName_0042' },
  });

  customText = new formattingSettings.TextInput({
    name: 'customText',
    displayName: 'Custom Text', displayNameKey: 'SunburstChartSettings_DisplayName_0043',
    value: '',
    placeholder: 'Custom label', placeholderKey: 'SunburstChartSettings_Placeholder_0001',
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size', displayNameKey: 'SunburstChartSettings_DisplayName_0044',
    value: 24,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color', displayNameKey: 'SunburstChartSettings_DisplayName_0045',
    value: { value: '' },
  });

  showLabel = new formattingSettings.ToggleSwitch({
    name: 'showLabel',
    displayName: 'Show Label', displayNameKey: 'SunburstChartSettings_DisplayName_0046',
    value: true,
  });

  labelFontSize = new formattingSettings.NumUpDown({
    name: 'labelFontSize',
    displayName: 'Label Font Size', displayNameKey: 'SunburstChartSettings_DisplayName_0047',
    value: 11,
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Font Family', displayNameKey: 'SunburstChartSettings_DisplayName_0048',
    items: [
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'SunburstChartSettings_DisplayName_0049' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'SunburstChartSettings_DisplayName_0050' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'SunburstChartSettings_DisplayName_0051' },
      { value: 'Helvetica', displayName: 'Helvetica', displayNameKey: 'SunburstChartSettings_DisplayName_0052' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'SunburstChartSettings_DisplayName_0053' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'SunburstChartSettings_DisplayName_0054' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'SunburstChartSettings_DisplayName_0055' },
    ],
    value: { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'SunburstChartSettings_DisplayName_0056' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Font Weight', displayNameKey: 'SunburstChartSettings_DisplayName_0057',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'SunburstChartSettings_DisplayName_0058' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'SunburstChartSettings_DisplayName_0059' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'SunburstChartSettings_DisplayName_0060' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'SunburstChartSettings_DisplayName_0061' },
  });

  name = 'centerContentSettings';
  displayName = 'Center Content';
  displayNameKey = 'SunburstChartSettings_DisplayName_0005';
  slices = [
    this.show,
    this.displayMode,
    this.customText,
    this.fontSize,
    this.fontColor,
    this.fontFamily,
    this.fontWeight,
    this.showLabel,
    this.labelFontSize,
  ];
}

class AnimationSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Animations', displayNameKey: 'SunburstChartSettings_DisplayName_0062',
    value: true,
  });

  duration = new formattingSettings.NumUpDown({
    name: 'duration',
    displayName: 'Duration (ms)', displayNameKey: 'SunburstChartSettings_DisplayName_0063',
    value: 600,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  displayNameKey = 'SunburstChartSettings_DisplayName_0006';
  slices = [this.enabled, this.duration];
}

class DrillDownSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Drill-Down', displayNameKey: 'SunburstChartSettings_DisplayName_0064',
    value: true,
  });

  showBreadcrumb = new formattingSettings.ToggleSwitch({
    name: 'showBreadcrumb',
    displayName: 'Show Breadcrumb', displayNameKey: 'SunburstChartSettings_DisplayName_0065',
    value: true,
  });

  breadcrumbFontSize = new formattingSettings.NumUpDown({
    name: 'breadcrumbFontSize',
    displayName: 'Breadcrumb Font Size', displayNameKey: 'SunburstChartSettings_DisplayName_0066',
    value: 11,
  });

  breadcrumbColor = new formattingSettings.ColorPicker({
    name: 'breadcrumbColor',
    displayName: 'Breadcrumb Color', displayNameKey: 'SunburstChartSettings_DisplayName_0067',
    value: { value: '#64748B' },
  });

  breadcrumbFontFamily = new formattingSettings.ItemDropdown({
    name: 'breadcrumbFontFamily',
    displayName: 'Breadcrumb Font Family', displayNameKey: 'SunburstChartSettings_DisplayName_0068',
    items: [
      { value: '', displayName: 'Default', displayNameKey: 'SunburstChartSettings_DisplayName_0069' },
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'SunburstChartSettings_DisplayName_0070' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'SunburstChartSettings_DisplayName_0071' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'SunburstChartSettings_DisplayName_0072' },
      { value: 'Helvetica Neue', displayName: 'Helvetica Neue', displayNameKey: 'SunburstChartSettings_DisplayName_0073' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'SunburstChartSettings_DisplayName_0074' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'SunburstChartSettings_DisplayName_0075' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'SunburstChartSettings_DisplayName_0076' },
    ],
    value: { value: '', displayName: 'Default', displayNameKey: 'SunburstChartSettings_DisplayName_0077' },
  });

  breadcrumbFontWeight = new formattingSettings.ItemDropdown({
    name: 'breadcrumbFontWeight',
    displayName: 'Breadcrumb Font Weight', displayNameKey: 'SunburstChartSettings_DisplayName_0078',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'SunburstChartSettings_DisplayName_0079' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'SunburstChartSettings_DisplayName_0080' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'SunburstChartSettings_DisplayName_0081' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'SunburstChartSettings_DisplayName_0082' },
  });

  breadcrumbPadding = new formattingSettings.NumUpDown({
    name: 'breadcrumbPadding',
    displayName: 'Breadcrumb Padding', displayNameKey: 'SunburstChartSettings_DisplayName_0083',
    value: 8,
  });

  name = 'drillDownSettings';
  displayName = 'Drill-Down';
  displayNameKey = 'SunburstChartSettings_DisplayName_0007';
  slices = [this.enabled, this.showBreadcrumb, this.breadcrumbFontSize, this.breadcrumbColor, this.breadcrumbFontFamily, this.breadcrumbFontWeight, this.breadcrumbPadding];
}

class InteractionSettings extends formattingSettings.SimpleCard {
  crossHighlightMode = new formattingSettings.ItemDropdown({
    name: 'crossHighlightMode',
    displayName: 'Cross-Highlight Behavior', displayNameKey: 'SunburstChartSettings_DisplayName_0086',
    items: [
      { value: 'focus', displayName: 'Show Highlighted Data Only', displayNameKey: 'SunburstChartSettings_DisplayName_0087' },
      { value: 'dim', displayName: 'Dim Unhighlighted Data', displayNameKey: 'SunburstChartSettings_DisplayName_0088' },
    ],
    value: { value: 'focus', displayName: 'Show Highlighted Data Only', displayNameKey: 'SunburstChartSettings_DisplayName_0089' },
  });

  name = 'interactionSettings';
  displayName = 'Interaction';
  displayNameKey = 'SunburstChartSettings_DisplayName_0084';
  slices = [this.crossHighlightMode];
}

export class SunburstChartSettings extends formattingSettings.Model {
  sunburstSettings = new SegmentAppearanceSettings();
  sunburstDisplaySettings = new GeometrySettings();
  labelsAndPercentagesSettings = new LabelsAndPercentagesSettings();
  centerContentSettings = new CenterContentSettings();
  drillDownSettings = new DrillDownSettingsCard();
  interactionSettings = new InteractionSettings();
  animationSettings = new AnimationSettings();
  cardSettings = new CardStyleSettings();

  legendFormattingCard = new LegendFormattingCard();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  numberFormattingCard = new NumberFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();
  cards = [
    this.sunburstSettings,
    this.sunburstDisplaySettings,
    this.labelsAndPercentagesSettings,
    this.dataLabelFormattingCard,
    this.centerContentSettings,
    this.drillDownSettings,
    this.interactionSettings,
    this.animationSettings,
    this.titleFormattingCard,
    this.legendFormattingCard,
    this.conditionalFormattingCard,
    this.numberFormattingCard,
    this.cardSettings,
    this.colorThemeFormattingCard,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
