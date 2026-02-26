/**
 * Gauge Cluster -- Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { DataLabelFormattingCard, TitleFormattingCard } from '../../core/src';
class ClusterSettings extends formattingSettings.SimpleCard {
  gaugesPerRow = new formattingSettings.NumUpDown({
    name: 'gaugesPerRow',
    displayName: 'Gauges Per Row',
    value: 4,
  });

  arcRange = new formattingSettings.NumUpDown({
    name: 'arcRange',
    displayName: 'Arc Range (\u00b0)',
    value: 240,
  });

  minValue = new formattingSettings.NumUpDown({
    name: 'minValue',
    displayName: 'Min Value',
    value: 0,
  });

  maxValue = new formattingSettings.NumUpDown({
    name: 'maxValue',
    displayName: 'Max Value',
    value: 100,
  });

  showLabels = new formattingSettings.ToggleSwitch({
    name: 'showLabels',
    displayName: 'Show Labels',
    value: true,
  });

  showValues = new formattingSettings.ToggleSwitch({
    name: 'showValues',
    displayName: 'Show Values',
    value: true,
  });


  trackOpacity = new formattingSettings.NumUpDown({

    name: 'trackOpacity',

    displayName: 'Track Opacity (%)',

    value: 15,

  });


  name = 'clusterSettings';
  displayName = 'Cluster Layout';
  slices = [
    this.gaugesPerRow,
    this.arcRange,
    this.minValue,
    this.maxValue,
    this.showLabels,
    this.showValues,
    this.trackOpacity,

  ];
}

class ZoneSettings extends formattingSettings.SimpleCard {
  lowColor = new formattingSettings.ColorPicker({
    name: 'lowColor',
    displayName: 'Low Color',
    value: { value: '#F87171' },
  });

  midColor = new formattingSettings.ColorPicker({
    name: 'midColor',
    displayName: 'Mid Color',
    value: { value: '#FBBF24' },
  });

  highColor = new formattingSettings.ColorPicker({
    name: 'highColor',
    displayName: 'High Color',
    value: { value: '#34D399' },
  });

  lowThreshold = new formattingSettings.NumUpDown({
    name: 'lowThreshold',
    displayName: 'Low Threshold (%)',
    value: 33,
  });

  highThreshold = new formattingSettings.NumUpDown({
    name: 'highThreshold',
    displayName: 'High Threshold (%)',
    value: 66,
  });

  name = 'zoneSettings';
  displayName = 'Color Zones';
  slices = [
    this.lowColor,
    this.midColor,
    this.highColor,
    this.lowThreshold,
    this.highThreshold,
  ];
}

class CardStyleSettings extends formattingSettings.SimpleCard {
  enableGlass = new formattingSettings.ToggleSwitch({
    name: 'enableGlass',
    displayName: 'Glass Effect',
    value: true,
  });

  bgColor = new formattingSettings.ColorPicker({
    name: 'bgColor',
    displayName: 'Background Color',
    value: { value: '' },
  });

  bgOpacity = new formattingSettings.NumUpDown({
    name: 'bgOpacity',
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
  slices = [this.bgColor, this.bgOpacity, this.borderRadius];
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

export class GaugeClusterSettings extends formattingSettings.Model {
  clusterSettings = new ClusterSettings();
  zoneSettings = new ZoneSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();

  dataLabelFormattingCard = new DataLabelFormattingCard();

  titleFormattingCard = new TitleFormattingCard();


  cards = [
    this.clusterSettings,
    this.zoneSettings,
    this.cardSettings,
    this.animationSettings,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,

  ];
}
