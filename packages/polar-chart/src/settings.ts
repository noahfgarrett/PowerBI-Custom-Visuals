/**
 * Polar Nightingale Chart -- Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, DataLabelFormattingCard, LegendFormattingCard, TitleFormattingCard, SortFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard,
  SeriesFormattingCard, NumberFormattingCard, } from '../../core/src';
class PolarSettings extends formattingSettings.SimpleCard {
  innerRadius = new formattingSettings.NumUpDown({
    name: 'innerRadius',
    displayName: 'Inner Radius',
    value: 20,
  });

  showLabels = new formattingSettings.ToggleSwitch({
    name: 'showLabels',
    displayName: 'Show Labels',
    value: true,
  });

  startAngle = new formattingSettings.NumUpDown({
    name: 'startAngle',
    displayName: 'Start Angle',
    value: 0,
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

  labelColor = new formattingSettings.ColorPicker({

    name: 'labelColor',

    displayName: 'Label Color',

    value: { value: '' },

  });


  name = 'polarSettings';
  displayName = 'Polar';
  slices = [this.innerRadius, this.showLabels, this.startAngle, this.segmentStrokeColor, this.segmentStrokeWidth, this.labelColor];
}

class ColorSettings extends formattingSettings.SimpleCard {
  baseColor = new formattingSettings.ColorPicker({
    name: 'baseColor',
    displayName: 'Base Color',
    value: { value: '#3B82F6' },
  });

  name = 'colorSettings';
  displayName = 'Colors';
  slices = [this.baseColor];
}

class CardStyleSettings extends formattingSettings.SimpleCard {
  enableGlass = new formattingSettings.ToggleSwitch({
    name: 'enableGlass',
    displayName: 'Glass Effect',
    value: true,
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
  slices = [this.enableGlass, this.backgroundColor, this.backgroundOpacity, this.borderRadius];
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

// ── Polar Display Settings ──────────────────────────────────────

class PolarDisplaySettings extends formattingSettings.SimpleCard {
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

  segmentPadding = new formattingSettings.NumUpDown({
    name: 'segmentPadding',
    displayName: 'Segment Padding',
    value: 2,
  });

  endAngle = new formattingSettings.NumUpDown({
    name: 'endAngle',
    displayName: 'End Angle',
    value: 360,
  });

  name = 'polarDisplaySettings';
  displayName = 'Polar Display';
  slices = [this.showRadialLabels, this.showInnerLabels, this.segmentPadding, this.endAngle];
}

// ── Polar Gradient Settings ────────────────────────────────────

class PolarGradientSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Gradient Fill',
    value: false,
  });

  name = 'polarGradientSettings';
  displayName = 'Gradient Fill';
  slices = [this.enabled];
}

export class PolarChartSettings extends formattingSettings.Model {
  polarSettings = new PolarSettings();
  colorSettings = new ColorSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();
  polarDisplaySettings = new PolarDisplaySettings();
  polarGradientSettings = new PolarGradientSettings();

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
  cards = [
    this.polarSettings,
    this.colorSettings,
    this.cardSettings,
    this.animationSettings,
    this.polarDisplaySettings,
    this.polarGradientSettings,
    this.axisFormattingCard,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.legendFormattingCard,
    this.sortFormattingCard,
    this.conditionalFormattingCard,
    this.accessibilityFormattingCard,
    this.seriesFormattingCard,
    this.colorThemeFormattingCard,
    this.numberFormattingCard,
  ];
}
