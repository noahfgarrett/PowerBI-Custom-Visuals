/**
 * Polar Nightingale Chart -- Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, DataLabelFormattingCard, LegendFormattingCard, TitleFormattingCard, SortFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard,
  SeriesFormattingCard, NumberFormattingCard,
  DateFilterFormattingCard,
  CARD_STYLE_MODE_ITEMS
} from '../../core/src';

// ── Segments (merged PolarSettings + PolarDisplaySettings geometry) ───────────

class SegmentSettings extends formattingSettings.SimpleCard {
  innerRadius = new formattingSettings.NumUpDown({
    name: 'innerRadius',
    displayName: 'Inner Radius (px)', displayNameKey: 'PolarChartSettings_DisplayName_0006',
    value: 20,
  });

  startAngle = new formattingSettings.NumUpDown({
    name: 'startAngle',
    displayName: 'Start Angle (degrees)', displayNameKey: 'PolarChartSettings_DisplayName_0007',
    value: 0,
  });

  endAngle = new formattingSettings.NumUpDown({
    name: 'endAngle',
    displayName: 'End Angle (degrees)', displayNameKey: 'PolarChartSettings_DisplayName_0008',
    value: 360,
  });

  segmentPadding = new formattingSettings.NumUpDown({
    name: 'segmentPadding',
    displayName: 'Segment Padding (degrees)', displayNameKey: 'PolarChartSettings_DisplayName_0009',
    value: 2,
  });

  segmentStrokeColor = new formattingSettings.ColorPicker({
    name: 'segmentStrokeColor',
    displayName: 'Segment Stroke Color', displayNameKey: 'PolarChartSettings_DisplayName_0010',
    value: { value: '' },
  });

  segmentStrokeWidth = new formattingSettings.NumUpDown({
    name: 'segmentStrokeWidth',
    displayName: 'Segment Stroke Width', displayNameKey: 'PolarChartSettings_DisplayName_0011',
    value: 1,
  });

  name = 'segmentSettings';
  displayName = 'Segments';
  displayNameKey = 'PolarChartSettings_DisplayName_0001';
  slices = [this.innerRadius, this.startAngle, this.endAngle, this.segmentPadding, this.segmentStrokeColor, this.segmentStrokeWidth];
}

// ── Colors & Fill (merged ColorSettings + PolarGradientSettings) ─────────────

class ColorsAndFillSettings extends formattingSettings.SimpleCard {
  baseColor = new formattingSettings.ColorPicker({
    name: 'baseColor',
    displayName: 'Base Color', displayNameKey: 'PolarChartSettings_DisplayName_0012',
    value: { value: '#3B82F6' },
  });

  enableGradientFill = new formattingSettings.ToggleSwitch({
    name: 'enableGradientFill',
    displayName: 'Enable Gradient Fill', displayNameKey: 'PolarChartSettings_DisplayName_0013',
    value: false,
  });

  name = 'colorsAndFillSettings';
  displayName = 'Colors and Fill';
  displayNameKey = 'PolarChartSettings_DisplayName_0002';
  slices = [this.baseColor, this.enableGradientFill];
}

// ── Labels (merged PolarSettings label toggles + PolarDisplaySettings label toggles) ──

class LabelSettings extends formattingSettings.SimpleCard {
  showLabels = new formattingSettings.ToggleSwitch({
    name: 'showLabels',
    displayName: 'Show Category Labels', displayNameKey: 'PolarChartSettings_DisplayName_0014',
    value: true,
  });

  showRadialLabels = new formattingSettings.ToggleSwitch({
    name: 'showRadialLabels',
    displayName: 'Show Outside Labels', displayNameKey: 'PolarChartSettings_DisplayName_0015',
    value: false,
  });

  showInnerLabels = new formattingSettings.ToggleSwitch({
    name: 'showInnerLabels',
    displayName: 'Show Inside Labels', displayNameKey: 'PolarChartSettings_DisplayName_0016',
    value: true,
  });

  labelColor = new formattingSettings.ColorPicker({
    name: 'labelColor',
    displayName: 'Label Color', displayNameKey: 'PolarChartSettings_DisplayName_0017',
    value: { value: '' },
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Label Font Size', displayNameKey: 'PolarChartSettings_DisplayName_0018',
    value: 11,
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Font Family', displayNameKey: 'PolarChartSettings_DisplayName_0019',
    items: [
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'PolarChartSettings_DisplayName_0020' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'PolarChartSettings_DisplayName_0021' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'PolarChartSettings_DisplayName_0022' },
      { value: 'Helvetica', displayName: 'Helvetica', displayNameKey: 'PolarChartSettings_DisplayName_0023' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'PolarChartSettings_DisplayName_0024' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'PolarChartSettings_DisplayName_0025' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'PolarChartSettings_DisplayName_0026' },
    ],
    value: { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'PolarChartSettings_DisplayName_0027' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Font Weight', displayNameKey: 'PolarChartSettings_DisplayName_0028',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'PolarChartSettings_DisplayName_0029' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'PolarChartSettings_DisplayName_0030' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'PolarChartSettings_DisplayName_0031' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'PolarChartSettings_DisplayName_0032' },
  });

  name = 'labelSettings';
  displayName = 'Category Labels';
  displayNameKey = 'PolarChartSettings_DisplayName_0003';
  slices = [this.showLabels, this.showRadialLabels, this.showInnerLabels, this.labelColor, this.fontSize, this.fontFamily, this.fontWeight];
}

// ── Card Style ───────────────────────────────────────────────────────────────

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style', displayNameKey: 'PolarChartSettings_DisplayName_0033',
    items: CARD_STYLE_MODE_ITEMS,
    value: { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'PolarChartSettings_DisplayName_0038' },
  });

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background Color', displayNameKey: 'PolarChartSettings_DisplayName_0039',
    value: { value: '' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Background Opacity (%)', displayNameKey: 'PolarChartSettings_DisplayName_0040',
    value: 35,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius', displayNameKey: 'PolarChartSettings_DisplayName_0041',
    value: 12,
  });

  contentPadding = new formattingSettings.NumUpDown({
    name: 'contentPadding',
    displayName: 'Content Padding', displayNameKey: 'PolarChartSettings_DisplayName_0042',
    value: 24,
  });

  name = 'cardSettings';
  displayName = 'Card Style';
  displayNameKey = 'PolarChartSettings_DisplayName_0004';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.contentPadding];
}

// ── Animation ────────────────────────────────────────────────────────────────

class AnimationSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Animations', displayNameKey: 'PolarChartSettings_DisplayName_0043',
    value: true,
  });

  duration = new formattingSettings.NumUpDown({
    name: 'duration',
    displayName: 'Duration (ms)', displayNameKey: 'PolarChartSettings_DisplayName_0044',
    value: 600,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  displayNameKey = 'PolarChartSettings_DisplayName_0005';
  slices = [this.enabled, this.duration];
}

// ── Root Model ───────────────────────────────────────────────────────────────

export class PolarChartSettings extends formattingSettings.Model {
  segmentSettings = new SegmentSettings();
  colorsAndFillSettings = new ColorsAndFillSettings();
  labelSettings = new LabelSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();

  axisFormattingCard = new AxisFormattingCard();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  legendFormattingCard = new LegendFormattingCard();
  sortFormattingCard = new SortFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();
  colorThemeFormattingCard = new ColorThemeFormattingCard();
  seriesFormattingCard = new SeriesFormattingCard();
  numberFormattingCard = new NumberFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();

  cards = [
    this.segmentSettings,
    this.colorsAndFillSettings,
    this.seriesFormattingCard,
    this.labelSettings,
    this.dataLabelFormattingCard,
    this.axisFormattingCard,
    this.legendFormattingCard,
    this.titleFormattingCard,
    this.sortFormattingCard,
    this.conditionalFormattingCard,
    this.colorThemeFormattingCard,
    this.numberFormattingCard,
    this.animationSettings,
    this.cardSettings,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
