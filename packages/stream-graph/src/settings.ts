/**
 * Stream Graph — Formatting model (properties pane).
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
  ColorThemeFormattingCard,
  SeriesFormattingCard,
  DateFilterFormattingCard,
  NumberFormattingCard,
} from '../../core/src';

class StreamSettings extends formattingSettings.SimpleCard {
  offset = new formattingSettings.ItemDropdown({
    name: 'offset',
    displayName: 'Stack Offset',
    items: [
      { value: 'wiggle', displayName: 'Wiggle' },
      { value: 'silhouette', displayName: 'Silhouette' },
      { value: 'expand', displayName: 'Expand' },
      { value: 'none', displayName: 'None' },
    ],
    value: { value: 'wiggle', displayName: 'Wiggle' },
  });

  curve = new formattingSettings.ItemDropdown({
    name: 'curve',
    displayName: 'Curve Type',
    items: [
      { value: 'basis', displayName: 'Basis' },
      { value: 'monotoneX', displayName: 'Monotone X' },
      { value: 'cardinal', displayName: 'Cardinal' },
    ],
    value: { value: 'basis', displayName: 'Basis' },
  });


  streamOpacity = new formattingSettings.NumUpDown({

    name: 'streamOpacity',

    displayName: 'Stream Opacity (%)',

    value: 80,

  });

  streamStrokeColor = new formattingSettings.ColorPicker({

    name: 'streamStrokeColor',

    displayName: 'Stream Stroke Color',

    value: { value: '' },

  });

  streamStrokeWidth = new formattingSettings.NumUpDown({

    name: 'streamStrokeWidth',

    displayName: 'Stream Stroke Width',

    value: 0.5,

  });


  useGradient = new formattingSettings.ToggleSwitch({
    name: 'useGradient',
    displayName: 'Gradient Fill',
    value: false,
  });

  useChartPalette = new formattingSettings.ToggleSwitch({
    name: 'useChartPalette',
    displayName: 'Use Chart Palette',
    value: true,
  });

  name = 'streamSettings';
  displayName = 'Stream';
  slices = [this.offset, this.curve, this.streamOpacity, this.streamStrokeColor, this.streamStrokeWidth, this.useGradient, this.useChartPalette];
}

// ── Stream Display (merged: Axis Visibility + Stream Display + Layer Sort) ─
class StreamDisplaySettingsCard extends formattingSettings.SimpleCard {
  showXAxis = new formattingSettings.ToggleSwitch({
    name: 'showXAxis',
    displayName: 'Show X Axis',
    value: true,
  });

  showYAxis = new formattingSettings.ToggleSwitch({
    name: 'showYAxis',
    displayName: 'Show Y-Axis',
    value: false,
  });

  showPercentages = new formattingSettings.ToggleSwitch({
    name: 'showPercentages',
    displayName: 'Show Percentages on Hover',
    value: false,
  });

  showValues = new formattingSettings.ToggleSwitch({
    name: 'showValues',
    displayName: 'Show Layer Values on Hover',
    value: false,
  });

  sortOrder = new formattingSettings.ItemDropdown({
    name: 'sortOrder',
    displayName: 'Layer Sort Order',
    items: [
      { value: 'inside-out', displayName: 'Inside-Out' },
      { value: 'by-peak', displayName: 'By Peak Value' },
      { value: 'appearance', displayName: 'Appearance Order' },
    ],
    value: { value: 'inside-out', displayName: 'Inside-Out' },
  });

  name = 'streamDisplaySettings';
  displayName = 'Stream Display';
  slices = [this.showXAxis, this.showYAxis, this.showPercentages, this.showValues, this.sortOrder];
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

export class StreamGraphSettings extends formattingSettings.Model {
  streamSettings = new StreamSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();

  // Merged display card (was: axisVisibilitySettings + streamDisplaySettings + streamSortSettings)
  streamDisplaySettings = new StreamDisplaySettingsCard();

  // Shared formatting cards from core
  axisFormattingCard = new AxisFormattingCard();
  legendFormattingCard = new LegendFormattingCard();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  lineStrokeFormattingCard = new LineStrokeFormattingCard();
  referenceLineFormattingCard = new ReferenceLineFormattingCard();
  trendLineFormattingCard = new TrendLineFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  crosshairFormattingCard = new CrosshairFormattingCard();
  annotationFormattingCard = new AnnotationFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  seriesFormattingCard = new SeriesFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();
  numberFormattingCard = new NumberFormattingCard();
  cards = [
    this.streamSettings,
    this.streamDisplaySettings,
    this.animationSettings,
    this.titleFormattingCard,
    this.legendFormattingCard,
    this.dataLabelFormattingCard,
    this.seriesFormattingCard,
    this.axisFormattingCard,
    this.lineStrokeFormattingCard,
    this.referenceLineFormattingCard,
    this.trendLineFormattingCard,
    this.conditionalFormattingCard,
    this.crosshairFormattingCard,
    this.annotationFormattingCard,
    this.cardSettings,
    this.numberFormattingCard,
    this.colorThemeFormattingCard,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
