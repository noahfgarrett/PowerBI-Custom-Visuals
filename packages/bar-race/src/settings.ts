/**
 * Bar Race — Formatting model (properties pane).
 * Defines all user-configurable options for the animated bar chart race.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, AnnotationFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, NumberFormattingCard } from '../../core/src';
// ── Race Settings ──────────────────────────────────────────────────

class RaceSettings extends formattingSettings.SimpleCard {
  topN = new formattingSettings.NumUpDown({
    name: 'topN',
    displayName: 'Top N Items',
    value: 10,
  });

  playSpeed = new formattingSettings.NumUpDown({
    name: 'playSpeed',
    displayName: 'Play Speed (ms)',
    value: 1500,
  });

  barHeight = new formattingSettings.NumUpDown({
    name: 'barHeight',
    displayName: 'Bar Height',
    value: 30,
  });


  barCornerRadius = new formattingSettings.NumUpDown({

    name: 'barCornerRadius',

    displayName: 'Bar Corner Radius',

    value: 3,

  });

  barOpacity = new formattingSettings.NumUpDown({

    name: 'barOpacity',

    displayName: 'Bar Opacity (%)',

    value: 100,

  });

  labelColor = new formattingSettings.ColorPicker({

    name: 'labelColor',

    displayName: 'Label Color',

    value: { value: '' },

  });


  name = 'raceSettings';
  displayName = 'Race Settings';
  slices = [this.topN, this.playSpeed, this.barHeight, this.barCornerRadius, this.barOpacity, this.labelColor];
}

// ── Color Settings ─────────────────────────────────────────────────

class ColorSettings extends formattingSettings.SimpleCard {
  useChartPalette = new formattingSettings.ToggleSwitch({
    name: 'useChartPalette',
    displayName: 'Use Chart Palette',
    value: true,
  });

  name = 'colorSettings';
  displayName = 'Colors';
  slices = [this.useChartPalette];
}

// ── Value Settings ─────────────────────────────────────────────────

class ValueSettings extends formattingSettings.SimpleCard {
  showValues = new formattingSettings.ToggleSwitch({
    name: 'showValues',
    displayName: 'Show Values',
    value: true,
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size',
    value: 11,
  });

  name = 'valueSettings';
  displayName = 'Values';
  slices = [this.showValues, this.fontSize];
}

// ── Card Style ─────────────────────────────────────────────────────

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

// ── Animation Settings ─────────────────────────────────────────────

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

// ── Timestamp Settings ─────────────────────────────────────────────

class TimestampSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Timestamp',
    value: true,
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size',
    value: 48,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color',
    value: { value: '' },
  });

  opacity = new formattingSettings.NumUpDown({
    name: 'opacity',
    displayName: 'Opacity (%)',
    value: 20,
  });

  position = new formattingSettings.ItemDropdown({
    name: 'position',
    displayName: 'Position',
    items: [
      { value: 'bottomRight', displayName: 'Bottom Right' },
      { value: 'center', displayName: 'Center' },
      { value: 'topRight', displayName: 'Top Right' },
    ],
    value: { value: 'bottomRight', displayName: 'Bottom Right' },
  });

  name = 'timestampSettings';
  displayName = 'Timestamp Display';
  slices = [this.show, this.fontSize, this.fontColor, this.opacity, this.position];
}

// ── Playback Settings ───────────────────────────────────────────────

class PlaybackSettingsCard extends formattingSettings.SimpleCard {
  autoPlay = new formattingSettings.ToggleSwitch({
    name: 'autoPlay',
    displayName: 'Auto-Play on Load',
    value: true,
  });

  showControls = new formattingSettings.ToggleSwitch({
    name: 'showControls',
    displayName: 'Show Controls',
    value: true,
  });

  speed = new formattingSettings.ItemDropdown({
    name: 'speed',
    displayName: 'Playback Speed',
    items: [
      { value: '0.5x', displayName: '0.5x' },
      { value: '1x', displayName: '1x' },
      { value: '1.5x', displayName: '1.5x' },
      { value: '2x', displayName: '2x' },
      { value: '3x', displayName: '3x' },
    ],
    value: { value: '1x', displayName: '1x' },
  });

  loop = new formattingSettings.ToggleSwitch({
    name: 'loop',
    displayName: 'Loop Animation',
    value: true,
  });

  controlPosition = new formattingSettings.ItemDropdown({
    name: 'controlPosition',
    displayName: 'Control Position',
    items: [
      { value: 'bottom', displayName: 'Bottom' },
      { value: 'top', displayName: 'Top' },
    ],
    value: { value: 'bottom', displayName: 'Bottom' },
  });

  name = 'playbackSettings';
  displayName = 'Playback';
  slices = [this.autoPlay, this.showControls, this.speed, this.loop, this.controlPosition];
}

// ── Race Display Settings ───────────────────────────────────────────

class RaceDisplaySettings extends formattingSettings.SimpleCard {
  showRankNumbers = new formattingSettings.ToggleSwitch({
    name: 'showRankNumbers',
    displayName: 'Show Rank Numbers',
    value: false,
  });

  showPeriodLabel = new formattingSettings.ToggleSwitch({
    name: 'showPeriodLabel',
    displayName: 'Show Period Label',
    value: true,
  });

  periodLabelSize = new formattingSettings.NumUpDown({
    name: 'periodLabelSize',
    displayName: 'Period Label Size',
    value: 14,
  });

  name = 'raceDisplay';
  displayName = 'Race Display';
  slices = [this.showRankNumbers, this.showPeriodLabel, this.periodLabelSize];
}

// ── Race Playback Settings ──────────────────────────────────────────

class RacePlaybackSettings extends formattingSettings.SimpleCard {
  pauseDuration = new formattingSettings.NumUpDown({
    name: 'pauseDuration',
    displayName: 'Pause Duration (ms)',
    value: 0,
  });

  name = 'racePlayback';
  displayName = 'Race Playback';
  slices = [this.pauseDuration];
}

// ── Root Model ─────────────────────────────────────────────────────

export class BarRaceSettings extends formattingSettings.Model {
  raceSettings = new RaceSettings();
  colorSettings = new ColorSettings();
  valueSettings = new ValueSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettingsCard();
  timestampSettings = new TimestampSettings();
  playbackSettings = new PlaybackSettingsCard();

  dataLabelFormattingCard = new DataLabelFormattingCard();

  titleFormattingCard = new TitleFormattingCard();

  axisFormattingCard = new AxisFormattingCard();

  referenceLineFormattingCard = new ReferenceLineFormattingCard();
  trendLineFormattingCard = new TrendLineFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  annotationFormattingCard = new AnnotationFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  raceDisplay = new RaceDisplaySettings();
  racePlayback = new RacePlaybackSettings();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  numberFormattingCard = new NumberFormattingCard();
  cards = [
    this.raceSettings,
    this.colorSettings,
    this.valueSettings,
    this.cardSettings,
    this.animationSettings,
    this.timestampSettings,
    this.playbackSettings,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.axisFormattingCard,
    this.referenceLineFormattingCard,
    this.trendLineFormattingCard,
    this.conditionalFormattingCard,
    this.annotationFormattingCard,
    this.accessibilityFormattingCard,
    this.raceDisplay,
    this.racePlayback,
    this.colorThemeFormattingCard,
    this.numberFormattingCard,
  ];
}
