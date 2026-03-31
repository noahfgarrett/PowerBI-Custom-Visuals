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
} from '../../core/src';

// ── Slope Lines ─────────────────────────────────────────────────────

class SlopeSettings extends formattingSettings.SimpleCard {
  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width',
    value: 2,
  });

  dotRadius = new formattingSettings.NumUpDown({
    name: 'dotRadius',
    displayName: 'Dot Radius',
    value: 5,
  });

  dotStrokeColor = new formattingSettings.ColorPicker({
    name: 'dotStrokeColor',
    displayName: 'Dot Stroke Color',
    value: { value: '' },
  });

  showArea = new formattingSettings.ToggleSwitch({
    name: 'showArea',
    displayName: 'Show Area Fill',
    value: false,
  });

  fillOpacity = new formattingSettings.NumUpDown({
    name: 'fillOpacity',
    displayName: 'Fill Opacity',
    value: 30,
  });

  showDots = new formattingSettings.ToggleSwitch({
    name: 'showDots',
    displayName: 'Show Dots',
    value: true,
  });

  name = 'slopeSettings';
  displayName = 'Slope Lines';
  slices = [
    this.lineWidth,
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
    displayName: 'Color by Direction',
    value: true,
  });

  positiveColor = new formattingSettings.ColorPicker({
    name: 'positiveColor',
    displayName: 'Positive Color',
    value: { value: '#34D399' },
  });

  negativeColor = new formattingSettings.ColorPicker({
    name: 'negativeColor',
    displayName: 'Negative Color',
    value: { value: '#F87171' },
  });

  neutralColor = new formattingSettings.ColorPicker({
    name: 'neutralColor',
    displayName: 'Neutral Color',
    value: { value: '#94A3B8' },
  });

  name = 'directionColorSettings';
  displayName = 'Direction Colors';
  slices = [this.colorByDirection, this.positiveColor, this.negativeColor, this.neutralColor];
}

// ── Labels & Change (merged Columns + Change Labels + labelColor + showPercentChange) ──

class LabelsChangeSettings extends formattingSettings.SimpleCard {
  leftLabel = new formattingSettings.TextInput({
    name: 'leftLabel',
    displayName: 'Left Label',
    value: 'Before',
    placeholder: 'Before',
  });

  rightLabel = new formattingSettings.TextInput({
    name: 'rightLabel',
    displayName: 'Right Label',
    value: 'After',
    placeholder: 'After',
  });

  labelColor = new formattingSettings.ColorPicker({
    name: 'labelColor',
    displayName: 'Label Color',
    value: { value: '' },
  });

  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Change Labels',
    value: true,
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size',
    value: 10,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color',
    value: { value: '' },
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Font',
    items: [
      { value: '', displayName: 'Default' },
      { value: 'Segoe UI', displayName: 'Segoe UI' },
      { value: 'Arial', displayName: 'Arial' },
      { value: 'Calibri', displayName: 'Calibri' },
      { value: 'Helvetica Neue', displayName: 'Helvetica Neue' },
      { value: 'Times New Roman', displayName: 'Times New Roman' },
      { value: 'Verdana', displayName: 'Verdana' },
      { value: 'Georgia', displayName: 'Georgia' },
    ],
    value: { value: '', displayName: 'Default' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Font Weight',
    items: [
      { value: 'normal', displayName: 'Normal' },
      { value: 'bold', displayName: 'Bold' },
      { value: '600', displayName: 'Semi-Bold' },
    ],
    value: { value: '600', displayName: 'Semi-Bold' },
  });

  format = new formattingSettings.ItemDropdown({
    name: 'format',
    displayName: 'Format',
    items: [
      { value: 'percent', displayName: 'Percent' },
      { value: 'absolute', displayName: 'Absolute' },
      { value: 'both', displayName: 'Both' },
    ],
    value: { value: 'percent', displayName: 'Percent' },
  });

  position = new formattingSettings.ItemDropdown({
    name: 'position',
    displayName: 'Position',
    items: [
      { value: 'center', displayName: 'Center' },
      { value: 'above', displayName: 'Above' },
      { value: 'below', displayName: 'Below' },
    ],
    value: { value: 'center', displayName: 'Center' },
  });

  showPercentChange = new formattingSettings.ToggleSwitch({
    name: 'showPercentChange',
    displayName: 'Show Percentage Change Labels',
    value: false,
  });

  name = 'changeLabelSettings';
  displayName = 'Labels & Change';
  slices = [
    this.leftLabel, this.rightLabel, this.labelColor,
    this.show, this.fontSize, this.fontColor, this.fontFamily, this.fontWeight, this.format, this.position,
    this.showPercentChange,
  ];
}

// ── Slope Behavior (remaining from Slope Display) ───────────────────

class SlopeBehaviorSettings extends formattingSettings.SimpleCard {
  sortByMagnitude = new formattingSettings.ToggleSwitch({
    name: 'sortByMagnitude',
    displayName: 'Sort by Change Magnitude',
    value: false,
  });

  showConfidenceInterval = new formattingSettings.ToggleSwitch({
    name: 'showConfidenceInterval',
    displayName: 'Show Confidence Intervals',
    value: false,
  });

  name = 'slopeDisplaySettings';
  displayName = 'Slope Behavior';
  slices = [this.sortByMagnitude, this.showConfidenceInterval];
}

// ── Threshold Highlight ─────────────────────────────────────────────

class SlopeThresholdSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Threshold Highlight',
    value: false,
  });

  threshold = new formattingSettings.NumUpDown({
    name: 'threshold',
    displayName: 'Threshold Value',
    value: 0,
  });

  glowColor = new formattingSettings.ColorPicker({
    name: 'glowColor',
    displayName: 'Glow Color',
    value: { value: '#F59E0B' },
  });

  name = 'slopeThresholdSettings';
  displayName = 'Threshold Highlight';
  slices = [this.show, this.threshold, this.glowColor];
}

// ── Card Style ──────────────────────────────────────────────────────

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

// ── Animation ───────────────────────────────────────────────────────

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
  seriesFormattingCard = new SeriesFormattingCard();
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
    this.directionColorSettings,
    this.changeLabelSettings,
    this.slopeDisplaySettings,
    this.slopeThresholdSettings,
    this.animationSettings,
    this.seriesFormattingCard,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.lineStrokeFormattingCard,
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
