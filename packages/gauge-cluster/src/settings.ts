/**
 * Gauge Cluster -- Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { DataLabelFormattingCard, TitleFormattingCard, NumberFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard } from '../../core/src';
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

  roundedCaps = new formattingSettings.ToggleSwitch({
    name: 'roundedCaps',
    displayName: 'Rounded Caps',
    value: true,
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
    this.roundedCaps,
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

  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width',
    value: 2,
  });

  name = 'targetSettings';
  displayName = 'Target';
  slices = [this.show, this.color, this.lineWidth];
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

// ── Cluster Display Settings ────────────────────────────────────

class ClusterDisplaySettings extends formattingSettings.SimpleCard {
  showSparklines = new formattingSettings.ToggleSwitch({
    name: 'showSparklines',
    displayName: 'Show Mini Sparklines',
    value: false,
  });

  showNeedle = new formattingSettings.ToggleSwitch({
    name: 'showNeedle',
    displayName: 'Show Needle/Pointer',
    value: false,
  });

  sortByValue = new formattingSettings.ToggleSwitch({
    name: 'sortByValue',
    displayName: 'Sort by Value',
    value: false,
  });

  name = 'clusterDisplaySettings';
  displayName = 'Cluster Display';
  slices = [this.showSparklines, this.showNeedle, this.sortByValue];
}

// ── Cluster Label Settings ──────────────────────────────────────

class ClusterLabelSettings extends formattingSettings.SimpleCard {
  showSubtitle = new formattingSettings.ToggleSwitch({
    name: 'showSubtitle',
    displayName: 'Show Subtitle',
    value: false,
  });

  subtitleField = new formattingSettings.TextInput({
    name: 'subtitleField',
    displayName: 'Subtitle Field',
    value: '',
    placeholder: 'e.g. Department',
  });

  name = 'clusterLabelSettings';
  displayName = 'Cluster Labels';
  slices = [this.showSubtitle, this.subtitleField];
}

export class GaugeClusterSettings extends formattingSettings.Model {
  clusterSettings = new ClusterSettings();
  zoneSettings = new ZoneSettings();
  targetSettings = new TargetSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();
  clusterDisplaySettings = new ClusterDisplaySettings();
  clusterLabelSettings = new ClusterLabelSettings();

  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  numberFormattingCard = new NumberFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  cards = [
    this.clusterSettings,
    this.zoneSettings,
    this.targetSettings,
    this.cardSettings,
    this.animationSettings,
    this.clusterDisplaySettings,
    this.clusterLabelSettings,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.numberFormattingCard,
    this.conditionalFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
