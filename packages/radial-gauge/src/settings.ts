/**
 * Radial Gauge Pro -- Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { DataLabelFormattingCard, TitleFormattingCard } from '../../core/src';
class ArcSettings extends formattingSettings.SimpleCard {
  thickness = new formattingSettings.ItemDropdown({
    name: 'thickness',
    displayName: 'Thickness',
    items: [
      { value: 'thin', displayName: 'Thin' },
      { value: 'medium', displayName: 'Medium' },
      { value: 'thick', displayName: 'Thick' },
    ],
    value: { value: 'medium', displayName: 'Medium' },
  });

  startAngle = new formattingSettings.ItemDropdown({
    name: 'startAngle',
    displayName: 'Arc Range',
    items: [
      { value: 'half', displayName: 'Half Circle (180\u00b0)' },
      { value: 'full', displayName: 'Three-Quarter (270\u00b0)' },
    ],
    value: { value: 'full', displayName: 'Three-Quarter (270\u00b0)' },
  });


  trackOpacity = new formattingSettings.NumUpDown({

    name: 'trackOpacity',

    displayName: 'Track Opacity (%)',

    value: 15,

  });

  zoneBorderWidth = new formattingSettings.NumUpDown({

    name: 'zoneBorderWidth',

    displayName: 'Zone Border Width',

    value: 1.5,

  });

  zoneBorderOpacity = new formattingSettings.NumUpDown({

    name: 'zoneBorderOpacity',

    displayName: 'Zone Border Opacity (%)',

    value: 30,

  });


  name = 'arcSettings';
  displayName = 'Arc';
  slices = [this.thickness, this.startAngle, this.trackOpacity, this.zoneBorderWidth, this.zoneBorderOpacity];
}

class ZoneSettings extends formattingSettings.SimpleCard {
  zone1Threshold = new formattingSettings.NumUpDown({
    name: 'zone1Threshold',
    displayName: 'Zone 1 Threshold (%)',
    value: 33,
  });

  zone1Color = new formattingSettings.ColorPicker({
    name: 'zone1Color',
    displayName: 'Zone 1 Color',
    value: { value: '#F87171' }, // red
  });

  zone2Threshold = new formattingSettings.NumUpDown({
    name: 'zone2Threshold',
    displayName: 'Zone 2 Threshold (%)',
    value: 66,
  });

  zone2Color = new formattingSettings.ColorPicker({
    name: 'zone2Color',
    displayName: 'Zone 2 Color',
    value: { value: '#FBBF24' }, // amber
  });

  zone3Color = new formattingSettings.ColorPicker({
    name: 'zone3Color',
    displayName: 'Zone 3 Color',
    value: { value: '#34D399' }, // green
  });

  name = 'zoneSettings';
  displayName = 'Color Zones';
  slices = [
    this.zone1Threshold,
    this.zone1Color,
    this.zone2Threshold,
    this.zone2Color,
    this.zone3Color,
  ];
}

class ValueSettings extends formattingSettings.SimpleCard {
  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size',
    value: 28,
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

class TargetSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Target',
    value: true,
  });

  color = new formattingSettings.ColorPicker({
    name: 'color',
    displayName: 'Target Color',
    value: { value: '#0F172A' },
  });

  name = 'targetSettings';
  displayName = 'Target';
  slices = [this.show, this.color];
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

export class RadialGaugeSettings extends formattingSettings.Model {
  arcSettings = new ArcSettings();
  zoneSettings = new ZoneSettings();
  valueSettings = new ValueSettings();
  targetSettings = new TargetSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();

  dataLabelFormattingCard = new DataLabelFormattingCard();

  titleFormattingCard = new TitleFormattingCard();


  cards = [
    this.arcSettings,
    this.zoneSettings,
    this.valueSettings,
    this.targetSettings,
    this.cardSettings,
    this.animationSettings,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,

  ];
}
