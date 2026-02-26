/**
 * Slope Chart — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, DataLabelFormattingCard, TitleFormattingCard, LineStrokeFormattingCard } from '../../core/src';
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


  dotStrokeColor = new formattingSettings.ColorPicker({

    name: 'dotStrokeColor',

    displayName: 'Dot Stroke Color',

    value: { value: '' },

  });

  labelColor = new formattingSettings.ColorPicker({

    name: 'labelColor',

    displayName: 'Label Color',

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


  name = 'slopeSettings';
  displayName = 'Slope Lines';
  slices = [
    this.lineWidth,
    this.dotRadius,
    this.colorByDirection,
    this.positiveColor,
    this.negativeColor,
    this.neutralColor,
    this.dotStrokeColor,
    this.labelColor,
    this.showArea,
    this.fillOpacity,

  ];
}

class ColumnSettings extends formattingSettings.SimpleCard {
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

  name = 'columnSettings';
  displayName = 'Columns';
  slices = [this.leftLabel, this.rightLabel];
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
  slices = [this.backgroundColor, this.backgroundOpacity, this.borderRadius];
}

class ChangeLabelSettings extends formattingSettings.SimpleCard {
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

  name = 'changeLabelSettings';
  displayName = 'Change Labels';
  slices = [this.show, this.fontSize, this.fontColor, this.format, this.position];
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

export class SlopeChartSettings extends formattingSettings.Model {
  slopeSettings = new SlopeSettings();
  columnSettings = new ColumnSettings();
  cardSettings = new CardStyleSettings();
  changeLabelSettings = new ChangeLabelSettings();
  animationSettings = new AnimationSettings();

  dataLabelFormattingCard = new DataLabelFormattingCard();

  titleFormattingCard = new TitleFormattingCard();

  lineStrokeFormattingCard = new LineStrokeFormattingCard();

  axisFormattingCard = new AxisFormattingCard();

  cards = [
    this.slopeSettings,
    this.columnSettings,
    this.changeLabelSettings,
    this.cardSettings,
    this.animationSettings,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.lineStrokeFormattingCard,
    this.axisFormattingCard,
  ];
}
