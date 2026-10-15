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
  CARD_STYLE_MODE_ITEMS
} from '../../core/src';

class StreamSettings extends formattingSettings.SimpleCard {
  offset = new formattingSettings.ItemDropdown({
    name: 'offset',
    displayName: 'Stack Offset', displayNameKey: 'StreamGraphSettings_DisplayName_0005',
    items: [
      { value: 'wiggle', displayName: 'Wiggle', displayNameKey: 'StreamGraphSettings_DisplayName_0006' },
      { value: 'silhouette', displayName: 'Silhouette', displayNameKey: 'StreamGraphSettings_DisplayName_0007' },
      { value: 'expand', displayName: 'Expand', displayNameKey: 'StreamGraphSettings_DisplayName_0008' },
      { value: 'none', displayName: 'None', displayNameKey: 'StreamGraphSettings_DisplayName_0009' },
    ],
    value: { value: 'wiggle', displayName: 'Wiggle', displayNameKey: 'StreamGraphSettings_DisplayName_0010' },
  });

  curve = new formattingSettings.ItemDropdown({
    name: 'curve',
    displayName: 'Curve Type', displayNameKey: 'StreamGraphSettings_DisplayName_0011',
    items: [
      { value: 'basis', displayName: 'Basis', displayNameKey: 'StreamGraphSettings_DisplayName_0012' },
      { value: 'monotoneX', displayName: 'Monotone X', displayNameKey: 'StreamGraphSettings_DisplayName_0013' },
      { value: 'cardinal', displayName: 'Cardinal', displayNameKey: 'StreamGraphSettings_DisplayName_0014' },
    ],
    value: { value: 'basis', displayName: 'Basis', displayNameKey: 'StreamGraphSettings_DisplayName_0015' },
  });


  streamOpacity = new formattingSettings.NumUpDown({

    name: 'streamOpacity',

    displayName: 'Stream Opacity (%)', displayNameKey: 'StreamGraphSettings_DisplayName_0016',

    value: 80,

  });

  streamStrokeColor = new formattingSettings.ColorPicker({

    name: 'streamStrokeColor',

    displayName: 'Stream Stroke Color', displayNameKey: 'StreamGraphSettings_DisplayName_0017',

    value: { value: '' },

  });

  streamStrokeWidth = new formattingSettings.NumUpDown({

    name: 'streamStrokeWidth',

    displayName: 'Stream Stroke Width', displayNameKey: 'StreamGraphSettings_DisplayName_0018',

    value: 0.5,

  });


  useGradient = new formattingSettings.ToggleSwitch({
    name: 'useGradient',
    displayName: 'Gradient Fill', displayNameKey: 'StreamGraphSettings_DisplayName_0019',
    value: false,
  });

  useChartPalette = new formattingSettings.ToggleSwitch({
    name: 'useChartPalette',
    displayName: 'Use Chart Palette', displayNameKey: 'StreamGraphSettings_DisplayName_0020',
    value: true,
  });

  name = 'streamSettings';
  displayName = 'Stream';
  displayNameKey = 'StreamGraphSettings_DisplayName_0001';
  slices = [this.offset, this.curve, this.streamOpacity, this.streamStrokeColor, this.streamStrokeWidth, this.useGradient, this.useChartPalette];
}

// ── Stream Display (merged: Axis Visibility + Stream Display + Layer Sort) ─
class StreamDisplaySettingsCard extends formattingSettings.SimpleCard {
  showXAxis = new formattingSettings.ToggleSwitch({
    name: 'showXAxis',
    displayName: 'Show X-Axis', displayNameKey: 'StreamGraphSettings_DisplayName_0021',
    value: true,
  });

  showYAxis = new formattingSettings.ToggleSwitch({
    name: 'showYAxis',
    displayName: 'Show Y-Axis', displayNameKey: 'StreamGraphSettings_DisplayName_0022',
    value: false,
  });

  showPercentages = new formattingSettings.ToggleSwitch({
    name: 'showPercentages',
    displayName: 'Show Percentages on Hover', displayNameKey: 'StreamGraphSettings_DisplayName_0023',
    value: false,
  });

  showValues = new formattingSettings.ToggleSwitch({
    name: 'showValues',
    displayName: 'Show Layer Values on Hover', displayNameKey: 'StreamGraphSettings_DisplayName_0024',
    value: false,
  });

  sortOrder = new formattingSettings.ItemDropdown({
    name: 'sortOrder',
    displayName: 'Layer Sort Order', displayNameKey: 'StreamGraphSettings_DisplayName_0025',
    items: [
      { value: 'inside-out', displayName: 'Inside-Out', displayNameKey: 'StreamGraphSettings_DisplayName_0026' },
      { value: 'by-peak', displayName: 'By Peak Value', displayNameKey: 'StreamGraphSettings_DisplayName_0027' },
      { value: 'appearance', displayName: 'Appearance Order', displayNameKey: 'StreamGraphSettings_DisplayName_0028' },
    ],
    value: { value: 'inside-out', displayName: 'Inside-Out', displayNameKey: 'StreamGraphSettings_DisplayName_0029' },
  });

  name = 'streamDisplaySettings';
  displayName = 'Stream Display';
  displayNameKey = 'StreamGraphSettings_DisplayName_0002';
  slices = [this.showXAxis, this.showYAxis, this.showPercentages, this.showValues, this.sortOrder];
}

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style', displayNameKey: 'StreamGraphSettings_DisplayName_0030',
    items: CARD_STYLE_MODE_ITEMS,
    value: { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'StreamGraphSettings_DisplayName_0035' },
  });

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background Color', displayNameKey: 'StreamGraphSettings_DisplayName_0036',
    value: { value: '' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Background Opacity (%)', displayNameKey: 'StreamGraphSettings_DisplayName_0037',
    value: 35,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius', displayNameKey: 'StreamGraphSettings_DisplayName_0038',
    value: 12,
  });

  contentPadding = new formattingSettings.NumUpDown({
    name: 'contentPadding',
    displayName: 'Content Padding', displayNameKey: 'StreamGraphSettings_DisplayName_0039',
    value: 12,
  });

  name = 'cardSettings';
  displayName = 'Card Style';
  displayNameKey = 'StreamGraphSettings_DisplayName_0003';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.contentPadding];
}

class AnimationSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Animations', displayNameKey: 'StreamGraphSettings_DisplayName_0040',
    value: true,
  });

  duration = new formattingSettings.NumUpDown({
    name: 'duration',
    displayName: 'Duration (ms)', displayNameKey: 'StreamGraphSettings_DisplayName_0041',
    value: 600,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  displayNameKey = 'StreamGraphSettings_DisplayName_0004';
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
