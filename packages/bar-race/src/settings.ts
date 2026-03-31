/**
 * Bar Race — Formatting model (properties pane).
 * Defines all user-configurable options for the animated bar chart race.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, AnnotationFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, NumberFormattingCard,
  DateFilterFormattingCard,
} from '../../core/src';
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

  name = 'raceSettings';
  displayName = 'Race Settings';
  slices = [this.topN, this.playSpeed, this.barHeight, this.barCornerRadius, this.barOpacity];
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

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color',
    value: { value: '' },
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Font Family',
    items: [
      { value: 'Segoe UI', displayName: 'Segoe UI' },
      { value: 'Arial', displayName: 'Arial' },
      { value: 'Calibri', displayName: 'Calibri' },
      { value: 'Helvetica', displayName: 'Helvetica' },
      { value: 'Times New Roman', displayName: 'Times New Roman' },
      { value: 'Verdana', displayName: 'Verdana' },
      { value: 'Georgia', displayName: 'Georgia' },
    ],
    value: { value: 'Segoe UI', displayName: 'Segoe UI' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Font Weight',
    items: [
      { value: 'normal', displayName: 'Normal' },
      { value: 'bold', displayName: 'Bold' },
      { value: '600', displayName: 'Semi-Bold' },
    ],
    value: { value: 'normal', displayName: 'Normal' },
  });

  name = 'valueSettings';
  displayName = 'Values';
  slices = [this.showValues, this.fontSize, this.fontColor, this.fontFamily, this.fontWeight];
}

// ── Card Style ─────────────────────────────────────────────────────

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

  pauseDuration = new formattingSettings.NumUpDown({
    name: 'pauseDuration',
    displayName: 'Pause Duration (ms)',
    value: 0,
  });

  name = 'playbackSettings';
  displayName = 'Playback';
  slices = [this.autoPlay, this.showControls, this.speed, this.loop, this.controlPosition, this.pauseDuration];
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

  labelColor = new formattingSettings.ColorPicker({
    name: 'labelColor',
    displayName: 'Label Color',
    value: { value: '' },
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Font Family',
    items: [
      { value: 'Segoe UI', displayName: 'Segoe UI' },
      { value: 'Arial', displayName: 'Arial' },
      { value: 'Calibri', displayName: 'Calibri' },
      { value: 'Helvetica', displayName: 'Helvetica' },
      { value: 'Times New Roman', displayName: 'Times New Roman' },
      { value: 'Verdana', displayName: 'Verdana' },
      { value: 'Georgia', displayName: 'Georgia' },
    ],
    value: { value: 'Segoe UI', displayName: 'Segoe UI' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Font Weight',
    items: [
      { value: 'normal', displayName: 'Normal' },
      { value: 'bold', displayName: 'Bold' },
      { value: '600', displayName: 'Semi-Bold' },
    ],
    value: { value: 'normal', displayName: 'Normal' },
  });

  name = 'raceDisplay';
  displayName = 'Race Display';
  slices = [this.showRankNumbers, this.showPeriodLabel, this.periodLabelSize, this.labelColor, this.fontFamily, this.fontWeight];
}

// ── Root Model ─────────────────────────────────────────────────────

export class BarRaceSettings extends formattingSettings.Model {
  raceSettings = new RaceSettings();
  playbackSettings = new PlaybackSettingsCard();
  raceDisplay = new RaceDisplaySettings();
  colorThemeFormattingCard = new ColorThemeFormattingCard();
  colorSettings = new ColorSettings();
  timestampSettings = new TimestampSettings();
  animationSettings = new AnimationSettingsCard();
  axisFormattingCard = new AxisFormattingCard();
  valueSettings = new ValueSettings();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  numberFormattingCard = new NumberFormattingCard();
  cardSettings = new CardStyleSettings();
  referenceLineFormattingCard = new ReferenceLineFormattingCard();
  trendLineFormattingCard = new TrendLineFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  annotationFormattingCard = new AnnotationFormattingCard();
  legendFormattingCard = new LegendFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  cards = [
    this.raceSettings,
    this.playbackSettings,
    this.raceDisplay,
    this.colorThemeFormattingCard,
    this.colorSettings,
    this.timestampSettings,
    this.animationSettings,
    this.axisFormattingCard,
    this.valueSettings,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.numberFormattingCard,
    this.cardSettings,
    this.referenceLineFormattingCard,
    this.trendLineFormattingCard,
    this.conditionalFormattingCard,
    this.annotationFormattingCard,
    this.legendFormattingCard,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
