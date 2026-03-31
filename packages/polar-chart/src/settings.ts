/**
 * Polar Nightingale Chart -- Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, DataLabelFormattingCard, LegendFormattingCard, TitleFormattingCard, SortFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard,
  SeriesFormattingCard, NumberFormattingCard,
  DateFilterFormattingCard,
} from '../../core/src';

// ── Segments (merged PolarSettings + PolarDisplaySettings geometry) ───────────

class SegmentSettings extends formattingSettings.SimpleCard {
  innerRadius = new formattingSettings.NumUpDown({
    name: 'innerRadius',
    displayName: 'Inner Radius',
    value: 20,
  });

  startAngle = new formattingSettings.NumUpDown({
    name: 'startAngle',
    displayName: 'Start Angle',
    value: 0,
  });

  endAngle = new formattingSettings.NumUpDown({
    name: 'endAngle',
    displayName: 'End Angle',
    value: 360,
  });

  segmentPadding = new formattingSettings.NumUpDown({
    name: 'segmentPadding',
    displayName: 'Segment Padding',
    value: 2,
  });

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

  name = 'segmentSettings';
  displayName = 'Segments';
  slices = [this.innerRadius, this.startAngle, this.endAngle, this.segmentPadding, this.segmentStrokeColor, this.segmentStrokeWidth];
}

// ── Colors & Fill (merged ColorSettings + PolarGradientSettings) ─────────────

class ColorsAndFillSettings extends formattingSettings.SimpleCard {
  baseColor = new formattingSettings.ColorPicker({
    name: 'baseColor',
    displayName: 'Base Color',
    value: { value: '#3B82F6' },
  });

  enableGradientFill = new formattingSettings.ToggleSwitch({
    name: 'enableGradientFill',
    displayName: 'Enable Gradient Fill',
    value: false,
  });

  name = 'colorsAndFillSettings';
  displayName = 'Colors & Fill';
  slices = [this.baseColor, this.enableGradientFill];
}

// ── Labels (merged PolarSettings label toggles + PolarDisplaySettings label toggles) ──

class LabelSettings extends formattingSettings.SimpleCard {
  showLabels = new formattingSettings.ToggleSwitch({
    name: 'showLabels',
    displayName: 'Show Labels',
    value: true,
  });

  showRadialLabels = new formattingSettings.ToggleSwitch({
    name: 'showRadialLabels',
    displayName: 'Show Radial Labels',
    value: false,
  });

  showInnerLabels = new formattingSettings.ToggleSwitch({
    name: 'showInnerLabels',
    displayName: 'Show Inner Labels',
    value: false,
  });

  labelColor = new formattingSettings.ColorPicker({
    name: 'labelColor',
    displayName: 'Label Color',
    value: { value: '' },
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
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

  name = 'labelSettings';
  displayName = 'Labels';
  slices = [this.showLabels, this.showRadialLabels, this.showInnerLabels, this.labelColor, this.fontSize, this.fontFamily, this.fontWeight];
}

// ── Card Style ───────────────────────────────────────────────────────────────

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

// ── Animation ────────────────────────────────────────────────────────────────

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
    this.labelSettings,
    this.axisFormattingCard,
    this.dataLabelFormattingCard,
    this.legendFormattingCard,
    this.titleFormattingCard,
    this.cardSettings,
    this.animationSettings,
    this.sortFormattingCard,
    this.conditionalFormattingCard,
    this.accessibilityFormattingCard,
    this.seriesFormattingCard,
    this.colorThemeFormattingCard,
    this.numberFormattingCard,
    this.dateFilterFormattingCard,
  ];
}
