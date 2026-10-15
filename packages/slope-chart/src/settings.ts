/**
 * Slope Chart — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import {
  AxisFormattingCard,
  LegendFormattingCard,
  DataLabelFormattingCard,
  TitleFormattingCard,
  LineStrokeFormattingCard,
  ReferenceLineFormattingCard,
  TrendLineFormattingCard,
  ConditionalFormattingCard,
  CrosshairFormattingCard,
  AnnotationFormattingCard,
  AccessibilityFormattingCard,
  SeriesFormattingCard,
  NumberFormattingCard,
  ColorThemeFormattingCard,
  DateFilterFormattingCard,
  CARD_STYLE_MODE_ITEMS
} from '../../core/src';

// ── Slope Lines ─────────────────────────────────────────────────────

class SlopeSettings extends formattingSettings.SimpleCard {
  dotRadius = new formattingSettings.NumUpDown({
    name: 'dotRadius',
    displayName: 'Dot Radius', displayNameKey: 'SlopeChartSettings_DisplayName_0009',
    value: 5,
  });

  dotStrokeColor = new formattingSettings.ColorPicker({
    name: 'dotStrokeColor',
    displayName: 'Dot Stroke Color', displayNameKey: 'SlopeChartSettings_DisplayName_0010',
    value: { value: '' },
  });

  showArea = new formattingSettings.ToggleSwitch({
    name: 'showArea',
    displayName: 'Show Area Fill', displayNameKey: 'SlopeChartSettings_DisplayName_0011',
    value: false,
  });

  fillOpacity = new formattingSettings.NumUpDown({
    name: 'fillOpacity',
    displayName: 'Fill Opacity', displayNameKey: 'SlopeChartSettings_DisplayName_0012',
    value: 30,
  });

  showDots = new formattingSettings.ToggleSwitch({
    name: 'showDots',
    displayName: 'Show Dots', displayNameKey: 'SlopeChartSettings_DisplayName_0013',
    value: true,
  });

  name = 'slopeSettings';
  displayName = 'Slope Appearance';
  displayNameKey = 'SlopeChartSettings_DisplayName_0001';
  slices = [
    this.showDots,
    this.dotRadius,
    this.dotStrokeColor,
    this.showArea,
    this.fillOpacity,
  ];
}

// ── Direction Colors ────────────────────────────────────────────────

class DirectionColorSettings extends formattingSettings.SimpleCard {
  colorByDirection = new formattingSettings.ToggleSwitch({
    name: 'colorByDirection',
    displayName: 'Color by Direction', displayNameKey: 'SlopeChartSettings_DisplayName_0014',
    value: true,
  });

  positiveColor = new formattingSettings.ColorPicker({
    name: 'positiveColor',
    displayName: 'Positive Color', displayNameKey: 'SlopeChartSettings_DisplayName_0015',
    value: { value: '#34D399' },
  });

  negativeColor = new formattingSettings.ColorPicker({
    name: 'negativeColor',
    displayName: 'Negative Color', displayNameKey: 'SlopeChartSettings_DisplayName_0016',
    value: { value: '#F87171' },
  });

  neutralColor = new formattingSettings.ColorPicker({
    name: 'neutralColor',
    displayName: 'Neutral / Default Color', displayNameKey: 'SlopeChartSettings_DisplayName_0017',
    value: { value: '#94A3B8' },
  });

  name = 'directionColorSettings';
  displayName = 'Direction Colors';
  displayNameKey = 'SlopeChartSettings_DisplayName_0002';
  slices = [this.colorByDirection, this.positiveColor, this.negativeColor, this.neutralColor];
}

// ── Labels & Change (merged Columns + Change Labels + labelColor + showPercentChange) ──

class LabelsChangeSettings extends formattingSettings.SimpleCard {
  leftLabel = new formattingSettings.TextInput({
    name: 'leftLabel',
    displayName: 'Left Label', displayNameKey: 'SlopeChartSettings_DisplayName_0018',
    value: 'Before',
    placeholder: 'Before', placeholderKey: 'SlopeChartSettings_Placeholder_0001',
  });

  rightLabel = new formattingSettings.TextInput({
    name: 'rightLabel',
    displayName: 'Right Label', displayNameKey: 'SlopeChartSettings_DisplayName_0019',
    value: 'After',
    placeholder: 'After', placeholderKey: 'SlopeChartSettings_Placeholder_0002',
  });

  labelColor = new formattingSettings.ColorPicker({
    name: 'labelColor',
    displayName: 'Category Label Color', displayNameKey: 'SlopeChartSettings_DisplayName_0020',
    value: { value: '' },
  });

  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Change Labels', displayNameKey: 'SlopeChartSettings_DisplayName_0021',
    value: true,
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size', displayNameKey: 'SlopeChartSettings_DisplayName_0022',
    value: 10,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color', displayNameKey: 'SlopeChartSettings_DisplayName_0023',
    value: { value: '' },
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Font', displayNameKey: 'SlopeChartSettings_DisplayName_0024',
    items: [
      { value: '', displayName: 'Default', displayNameKey: 'SlopeChartSettings_DisplayName_0025' },
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'SlopeChartSettings_DisplayName_0026' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'SlopeChartSettings_DisplayName_0027' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'SlopeChartSettings_DisplayName_0028' },
      { value: 'Helvetica Neue', displayName: 'Helvetica Neue', displayNameKey: 'SlopeChartSettings_DisplayName_0029' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'SlopeChartSettings_DisplayName_0030' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'SlopeChartSettings_DisplayName_0031' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'SlopeChartSettings_DisplayName_0032' },
    ],
    value: { value: '', displayName: 'Default', displayNameKey: 'SlopeChartSettings_DisplayName_0033' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Font Weight', displayNameKey: 'SlopeChartSettings_DisplayName_0034',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'SlopeChartSettings_DisplayName_0035' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'SlopeChartSettings_DisplayName_0036' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'SlopeChartSettings_DisplayName_0037' },
    ],
    value: { value: '600', displayName: 'Semi-Bold', displayNameKey: 'SlopeChartSettings_DisplayName_0038' },
  });

  format = new formattingSettings.ItemDropdown({
    name: 'format',
    displayName: 'Format', displayNameKey: 'SlopeChartSettings_DisplayName_0039',
    items: [
      { value: 'percent', displayName: 'Percent', displayNameKey: 'SlopeChartSettings_DisplayName_0040' },
      { value: 'absolute', displayName: 'Absolute', displayNameKey: 'SlopeChartSettings_DisplayName_0041' },
      { value: 'both', displayName: 'Both', displayNameKey: 'SlopeChartSettings_DisplayName_0042' },
    ],
    value: { value: 'percent', displayName: 'Percent', displayNameKey: 'SlopeChartSettings_DisplayName_0043' },
  });

  position = new formattingSettings.ItemDropdown({
    name: 'position',
    displayName: 'Position', displayNameKey: 'SlopeChartSettings_DisplayName_0044',
    items: [
      { value: 'center', displayName: 'Center', displayNameKey: 'SlopeChartSettings_DisplayName_0045' },
      { value: 'above', displayName: 'Above', displayNameKey: 'SlopeChartSettings_DisplayName_0046' },
      { value: 'below', displayName: 'Below', displayNameKey: 'SlopeChartSettings_DisplayName_0047' },
    ],
    value: { value: 'center', displayName: 'Center', displayNameKey: 'SlopeChartSettings_DisplayName_0048' },
  });

  labelOffset = new formattingSettings.NumUpDown({
    name: 'labelOffset',
    displayName: 'Label Offset', displayNameKey: 'SlopeChartSettings_DisplayName_0049',
    value: 10,
  });

  showPercentChange = new formattingSettings.ToggleSwitch({
    name: 'showPercentChange',
    displayName: 'Show End Percentage Labels', displayNameKey: 'SlopeChartSettings_DisplayName_0050',
    value: false,
  });

  name = 'changeLabelSettings';
  displayName = 'Labels & Change';
  displayNameKey = 'SlopeChartSettings_DisplayName_0003';
  slices = [
    this.leftLabel, this.rightLabel, this.labelColor,
    this.show, this.fontSize, this.fontColor, this.fontFamily, this.fontWeight, this.format, this.position, this.labelOffset,
    this.showPercentChange,
  ];
}

// ── Slope Behavior (remaining from Slope Display) ───────────────────

class SlopeBehaviorSettings extends formattingSettings.SimpleCard {
  sortByMagnitude = new formattingSettings.ToggleSwitch({
    name: 'sortByMagnitude',
    displayName: 'Sort by Change Magnitude', displayNameKey: 'SlopeChartSettings_DisplayName_0051',
    value: false,
  });

  showConfidenceInterval = new formattingSettings.ToggleSwitch({
    name: 'showConfidenceInterval',
    displayName: 'Show Confidence Intervals', displayNameKey: 'SlopeChartSettings_DisplayName_0052',
    value: false,
  });

  name = 'slopeDisplaySettings';
  displayName = 'Slope Behavior';
  displayNameKey = 'SlopeChartSettings_DisplayName_0004';
  slices = [this.sortByMagnitude, this.showConfidenceInterval];
}

// ── Threshold Highlight ─────────────────────────────────────────────

class SlopeThresholdSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Threshold Highlight', displayNameKey: 'SlopeChartSettings_DisplayName_0053',
    value: false,
  });

  threshold = new formattingSettings.NumUpDown({
    name: 'threshold',
    displayName: 'Threshold Value', displayNameKey: 'SlopeChartSettings_DisplayName_0054',
    value: 0,
  });

  glowColor = new formattingSettings.ColorPicker({
    name: 'glowColor',
    displayName: 'Glow Color', displayNameKey: 'SlopeChartSettings_DisplayName_0055',
    value: { value: '#F59E0B' },
  });

  name = 'slopeThresholdSettings';
  displayName = 'Threshold Highlight';
  displayNameKey = 'SlopeChartSettings_DisplayName_0005';
  slices = [this.show, this.threshold, this.glowColor];
}

// ── Card Style ──────────────────────────────────────────────────────

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style', displayNameKey: 'SlopeChartSettings_DisplayName_0056',
    items: CARD_STYLE_MODE_ITEMS,
    value: { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'SlopeChartSettings_DisplayName_0061' },
  });

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background Color', displayNameKey: 'SlopeChartSettings_DisplayName_0062',
    value: { value: '' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Background Opacity (%)', displayNameKey: 'SlopeChartSettings_DisplayName_0063',
    value: 35,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius', displayNameKey: 'SlopeChartSettings_DisplayName_0064',
    value: 12,
  });

  contentPadding = new formattingSettings.NumUpDown({
    name: 'contentPadding',
    displayName: 'Content Padding', displayNameKey: 'SlopeChartSettings_DisplayName_0065',
    value: 12,
  });

  name = 'cardSettings';
  displayName = 'Card Style';
  displayNameKey = 'SlopeChartSettings_DisplayName_0006';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.contentPadding];
}

// ── Animation ───────────────────────────────────────────────────────

class AnimationSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Animations', displayNameKey: 'SlopeChartSettings_DisplayName_0066',
    value: true,
  });

  duration = new formattingSettings.NumUpDown({
    name: 'duration',
    displayName: 'Duration (ms)', displayNameKey: 'SlopeChartSettings_DisplayName_0067',
    value: 600,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  displayNameKey = 'SlopeChartSettings_DisplayName_0007';
  slices = [this.enabled, this.duration];
}

class CategoryStylesFormattingCard extends SeriesFormattingCard {
  displayName = 'Category Styles';
  displayNameKey = 'SlopeChartSettings_DisplayName_0068';
}

// ── Root Model ──────────────────────────────────────────────────────

export class SlopeChartSettings extends formattingSettings.Model {
  slopeSettings = new SlopeSettings();
  directionColorSettings = new DirectionColorSettings();
  changeLabelSettings = new LabelsChangeSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();

  // Feature cards
  slopeDisplaySettings = new SlopeBehaviorSettings();
  slopeThresholdSettings = new SlopeThresholdSettingsCard();

  // Shared formatting cards from core
  seriesFormattingCard = new CategoryStylesFormattingCard();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  lineStrokeFormattingCard = new LineStrokeFormattingCard();
  axisFormattingCard = new AxisFormattingCard();
  referenceLineFormattingCard = new ReferenceLineFormattingCard();
  trendLineFormattingCard = new TrendLineFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  crosshairFormattingCard = new CrosshairFormattingCard();
  annotationFormattingCard = new AnnotationFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();
  numberFormattingCard = new NumberFormattingCard();

  legendFormattingCard = new LegendFormattingCard();
  colorThemeFormattingCard = new ColorThemeFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();
  cards = [
    this.slopeSettings,
    this.lineStrokeFormattingCard,
    this.directionColorSettings,
    this.seriesFormattingCard,
    this.changeLabelSettings,
    this.slopeDisplaySettings,
    this.slopeThresholdSettings,
    this.animationSettings,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.axisFormattingCard,
    this.referenceLineFormattingCard,
    this.trendLineFormattingCard,
    this.conditionalFormattingCard,
    this.crosshairFormattingCard,
    this.annotationFormattingCard,
    this.accessibilityFormattingCard,
    this.numberFormattingCard,
    this.cardSettings,
    this.legendFormattingCard,
    this.colorThemeFormattingCard,
    this.dateFilterFormattingCard,
  ];
}
