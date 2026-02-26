/**
 * KPI Card Pro — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { TitleFormattingCard } from '../../core/src';
class ValueSettings extends formattingSettings.SimpleCard {
  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size',
    value: 32,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color',
    value: { value: '' }, // empty = use theme default
  });

  prefix = new formattingSettings.TextInput({
    name: 'prefix',
    displayName: 'Prefix',
    value: '',
    placeholder: 'e.g. $',
  });

  suffix = new formattingSettings.TextInput({
    name: 'suffix',
    displayName: 'Suffix',
    value: '',
    placeholder: 'e.g. %',
  });

  decimalPlaces = new formattingSettings.NumUpDown({
    name: 'decimalPlaces',
    displayName: 'Decimal Places',
    value: 0,
  });

  name = 'valueSettings';
  displayName = 'Value';
  slices = [this.fontSize, this.fontColor, this.prefix, this.suffix, this.decimalPlaces];
}

class LabelSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Label',
    value: true,
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size',
    value: 11,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color',
    value: { value: '' },
  });

  customText = new formattingSettings.TextInput({
    name: 'text',
    displayName: 'Custom Text',
    value: '',
    placeholder: 'Override label text',
  });

  name = 'labelSettings';
  displayName = 'Label';
  slices = [this.show, this.fontSize, this.fontColor, this.customText];
}

class TrendSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Trend',
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

  name = 'trendSettings';
  displayName = 'Trend Arrow';
  slices = [this.show, this.positiveColor, this.negativeColor, this.neutralColor];
}

class SparklineSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Sparkline',
    value: true,
  });

  lineColor = new formattingSettings.ColorPicker({
    name: 'lineColor',
    displayName: 'Line Color',
    value: { value: '#3B82F6' },
  });

  fillOpacity = new formattingSettings.NumUpDown({
    name: 'fillOpacity',
    displayName: 'Fill Opacity (%)',
    value: 45,
  });


  sparklineColor = new formattingSettings.ColorPicker({

    name: 'sparklineColor',

    displayName: 'Sparkline Color',

    value: { value: '' },

  });

  sparklineWidth = new formattingSettings.NumUpDown({

    name: 'sparklineWidth',

    displayName: 'Sparkline Width',

    value: 2,

  });

  dividerColor = new formattingSettings.ColorPicker({

    name: 'dividerColor',

    displayName: 'Divider Color',

    value: { value: '' },

  });


  name = 'sparklineSettings';
  displayName = 'Sparkline';
  slices = [this.show, this.lineColor, this.fillOpacity, this.sparklineColor, this.sparklineWidth, this.dividerColor];
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

export class KpiCardSettings extends formattingSettings.Model {
  valueSettings = new ValueSettings();
  labelSettings = new LabelSettings();
  trendSettings = new TrendSettings();
  sparklineSettings = new SparklineSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();

  titleFormattingCard = new TitleFormattingCard();


  cards = [
    this.valueSettings,
    this.labelSettings,
    this.trendSettings,
    this.sparklineSettings,
    this.cardSettings,
    this.animationSettings,
    this.titleFormattingCard,

  ];
}
