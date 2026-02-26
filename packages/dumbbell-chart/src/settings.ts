/**
 * Dumbbell Chart — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ScrollFormattingCard, SortFormattingCard} from '../../core/src';
// -- Dumbbell Settings --------------------------------------------------------

class DumbbellSettings extends formattingSettings.SimpleCard {
  dotRadius = new formattingSettings.NumUpDown({
    name: 'dotRadius',
    displayName: 'Dot Radius',
    value: 6,
  });

  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width',
    value: 2,
  });

  startColor = new formattingSettings.ColorPicker({
    name: 'startColor',
    displayName: 'Start Color',
    value: { value: '#94A3B8' },
  });

  endColor = new formattingSettings.ColorPicker({
    name: 'endColor',
    displayName: 'End Color',
    value: { value: '#3B82F6' },
  });


  dotStrokeColor = new formattingSettings.ColorPicker({

    name: 'dotStrokeColor',

    displayName: 'Dot Stroke Color',

    value: { value: '' },

  });

  dotStrokeWidth = new formattingSettings.NumUpDown({

    name: 'dotStrokeWidth',

    displayName: 'Dot Stroke Width',

    value: 1.5,

  });

  lineColor = new formattingSettings.ColorPicker({

    name: 'lineColor',

    displayName: 'Line Color',

    value: { value: '' },

  });


  name = 'dumbbellSettings';
  displayName = 'Dumbbell Settings';
  slices = [this.dotRadius, this.lineWidth, this.startColor, this.endColor, this.dotStrokeColor, this.dotStrokeWidth, this.lineColor];
}

// -- Axis Settings ------------------------------------------------------------

class AxisSettings extends formattingSettings.SimpleCard {
  showXAxis = new formattingSettings.ToggleSwitch({
    name: 'showXAxis',
    displayName: 'Show X-Axis',
    value: true,
  });

  showYAxis = new formattingSettings.ToggleSwitch({
    name: 'showYAxis',
    displayName: 'Show Y-Axis',
    value: true,
  });

  name = 'axisSettings';
  displayName = 'Axes';
  slices = [this.showXAxis, this.showYAxis];
}

// -- Card Style ---------------------------------------------------------------

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
  slices = [this.backgroundColor, this.backgroundOpacity, this.borderRadius];
}

// -- Delta Label Settings -----------------------------------------------------

class DeltaLabelSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Delta Labels',
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

  format = new formattingSettings.ItemDropdown({
    name: 'format',
    displayName: 'Format',
    items: [
      { value: 'absolute', displayName: 'Absolute' },
      { value: 'percent', displayName: 'Percent' },
      { value: 'both', displayName: 'Both' },
    ],
    value: { value: 'absolute', displayName: 'Absolute' },
  });

  position = new formattingSettings.ItemDropdown({
    name: 'position',
    displayName: 'Position',
    items: [
      { value: 'above', displayName: 'Above' },
      { value: 'center', displayName: 'Center' },
      { value: 'below', displayName: 'Below' },
    ],
    value: { value: 'above', displayName: 'Above' },
  });

  name = 'deltaLabelSettings';
  displayName = 'Delta Labels';
  slices = [this.show, this.fontSize, this.fontColor, this.format, this.position];
}

// -- Animation Settings -------------------------------------------------------

class AnimationSettingsCard extends formattingSettings.SimpleCard {
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

// -- Root Model ---------------------------------------------------------------

export class DumbbellChartSettings extends formattingSettings.Model {
  dumbbellSettings = new DumbbellSettings();
  axisSettings = new AxisSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettingsCard();
  deltaLabelSettings = new DeltaLabelSettings();

  axisFormattingCard = new AxisFormattingCard();

  legendFormattingCard = new LegendFormattingCard();

  dataLabelFormattingCard = new DataLabelFormattingCard();

  titleFormattingCard = new TitleFormattingCard();

  scrollFormattingCard = new ScrollFormattingCard();

  constructor() {
    super();
    this.scrollFormattingCard.minCategoryWidth.value = 30;
  }

  sortFormattingCard = new SortFormattingCard();

  cards = [
    this.dumbbellSettings,
    this.axisSettings,
    this.cardSettings,
    this.animationSettings,
    this.deltaLabelSettings,
    this.axisFormattingCard,
    this.legendFormattingCard,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.scrollFormattingCard,
    this.sortFormattingCard,
  ];
}
