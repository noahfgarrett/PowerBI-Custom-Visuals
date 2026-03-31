/**
 * Sunburst Chart -- Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, NumberFormattingCard,
  DateFilterFormattingCard,
} from '../../core/src';

// ── Segment Appearance (extracted stroke settings from old Sunburst card) ──
class SegmentAppearanceSettings extends formattingSettings.SimpleCard {
  segmentStrokeColor = new formattingSettings.ColorPicker({
    name: 'segmentStrokeColor',
    displayName: 'Segment Stroke Color',
    value: { value: '' },
  });

  segmentStrokeWidth = new formattingSettings.NumUpDown({
    name: 'segmentStrokeWidth',
    displayName: 'Segment Stroke Width',
    value: 1,
  });

  useChartPalette = new formattingSettings.ToggleSwitch({
    name: 'useChartPalette',
    displayName: 'Use Chart Palette',
    value: true,
  });

  segmentOpacity = new formattingSettings.NumUpDown({
    name: 'segmentOpacity',
    displayName: 'Segment Opacity (%)',
    value: 100,
  });

  name = 'sunburstSettings';
  displayName = 'Segment Appearance';
  slices = [this.segmentStrokeColor, this.segmentStrokeWidth, this.useChartPalette, this.segmentOpacity];
}

// ── Geometry (renamed from Sunburst Display — innerRadius, startAngle, sortOrder) ──
class GeometrySettings extends formattingSettings.SimpleCard {
  innerRadius = new formattingSettings.NumUpDown({
    name: 'innerRadius',
    displayName: 'Inner Radius',
    value: 0,
  });

  startAngle = new formattingSettings.NumUpDown({
    name: 'startAngle',
    displayName: 'Start Angle',
    value: 0,
  });

  sortOrder = new formattingSettings.ItemDropdown({
    name: 'sortOrder',
    displayName: 'Sort Order',
    items: [
      { value: 'descending', displayName: 'Descending (largest first)' },
      { value: 'ascending', displayName: 'Ascending (smallest first)' },
      { value: 'none', displayName: 'Data Order' },
    ],
    value: { value: 'descending', displayName: 'Descending (largest first)' },
  });

  name = 'sunburstDisplaySettings';
  displayName = 'Geometry';
  slices = [this.innerRadius, this.startAngle, this.sortOrder];
}

// ── Labels & Percentages (consolidated from Sunburst + Sunburst Display) ──
class LabelsAndPercentagesSettings extends formattingSettings.SimpleCard {
  showLabels = new formattingSettings.ToggleSwitch({
    name: 'showLabels',
    displayName: 'Show Labels',
    value: true,
  });

  labelMinAngle = new formattingSettings.NumUpDown({
    name: 'labelMinAngle',
    displayName: 'Label Min Angle',
    value: 5,
  });

  showPercentages = new formattingSettings.ToggleSwitch({
    name: 'showPercentages',
    displayName: 'Show Percentages',
    value: false,
  });

  percentOf = new formattingSettings.ItemDropdown({
    name: 'percentOf',
    displayName: 'Percent Of',
    items: [
      { value: 'parent', displayName: 'Parent' },
      { value: 'total', displayName: 'Total' },
    ],
    value: { value: 'parent', displayName: 'Parent' },
  });

  name = 'labelsAndPercentagesSettings';
  displayName = 'Labels & Percentages';
  slices = [this.showLabels, this.labelMinAngle, this.showPercentages, this.percentOf];
}

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

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background Color',
    value: { value: '' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Background Opacity (%)',
    value: 35,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius',
    value: 12,
  });

  name = 'cardSettings';
  displayName = 'Card Style';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius];
}

class CenterContentSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Center Content',
    value: true,
  });

  displayMode = new formattingSettings.ItemDropdown({
    name: 'displayMode',
    displayName: 'Display Mode',
    items: [
      { value: 'total', displayName: 'Total' },
      { value: 'count', displayName: 'Count' },
      { value: 'average', displayName: 'Average' },
      { value: 'custom', displayName: 'Custom' },
    ],
    value: { value: 'total', displayName: 'Total' },
  });

  customText = new formattingSettings.TextInput({
    name: 'customText',
    displayName: 'Custom Text',
    value: '',
    placeholder: 'Custom label',
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size',
    value: 24,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color',
    value: { value: '' },
  });

  showLabel = new formattingSettings.ToggleSwitch({
    name: 'showLabel',
    displayName: 'Show Label',
    value: true,
  });

  labelFontSize = new formattingSettings.NumUpDown({
    name: 'labelFontSize',
    displayName: 'Label Font Size',
    value: 11,
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Font Family',
    items: [
      { value: 'Segoe UI', displayName: 'Segoe UI' },
      { value: 'Arial', displayName: 'Arial' },
      { value: 'Calibri', displayName: 'Calibri' },
      { value: 'Helvetica', displayName: 'Helvetica' },
      { value: 'Times New Roman', displayName: 'Times New Roman' },
      { value: 'Verdana', displayName: 'Verdana' },
      { value: 'Georgia', displayName: 'Georgia' },
    ],
    value: { value: 'Segoe UI', displayName: 'Segoe UI' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Font Weight',
    items: [
      { value: 'normal', displayName: 'Normal' },
      { value: 'bold', displayName: 'Bold' },
      { value: '600', displayName: 'Semi-Bold' },
    ],
    value: { value: 'normal', displayName: 'Normal' },
  });

  name = 'centerContentSettings';
  displayName = 'Center Content';
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
    displayName: 'Enable Animations',
    value: true,
  });

  duration = new formattingSettings.NumUpDown({
    name: 'duration',
    displayName: 'Duration (ms)',
    value: 600,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  slices = [this.enabled, this.duration];
}

class DrillDownSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Drill-Down',
    value: true,
  });

  showBreadcrumb = new formattingSettings.ToggleSwitch({
    name: 'showBreadcrumb',
    displayName: 'Show Breadcrumb',
    value: true,
  });

  breadcrumbFontSize = new formattingSettings.NumUpDown({
    name: 'breadcrumbFontSize',
    displayName: 'Breadcrumb Font Size',
    value: 11,
  });

  breadcrumbColor = new formattingSettings.ColorPicker({
    name: 'breadcrumbColor',
    displayName: 'Breadcrumb Color',
    value: { value: '#64748B' },
  });

  name = 'drillDownSettings';
  displayName = 'Drill-Down';
  slices = [this.enabled, this.showBreadcrumb, this.breadcrumbFontSize, this.breadcrumbColor];
}

export class SunburstChartSettings extends formattingSettings.Model {
  sunburstSettings = new SegmentAppearanceSettings();
  sunburstDisplaySettings = new GeometrySettings();
  labelsAndPercentagesSettings = new LabelsAndPercentagesSettings();
  centerContentSettings = new CenterContentSettings();
  drillDownSettings = new DrillDownSettingsCard();
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
    this.centerContentSettings,
    this.drillDownSettings,
    this.animationSettings,
    this.titleFormattingCard,
    this.legendFormattingCard,
    this.dataLabelFormattingCard,
    this.conditionalFormattingCard,
    this.numberFormattingCard,
    this.cardSettings,
    this.colorThemeFormattingCard,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
