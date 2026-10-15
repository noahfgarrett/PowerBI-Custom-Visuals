/**
 * Bar Race — Formatting model (properties pane).
 * Defines all user-configurable options for the animated bar chart race.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, AnnotationFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, NumberFormattingCard,
  DateFilterFormattingCard,
  CARD_STYLE_MODE_ITEMS
} from '../../core/src';
// ── Race Settings ──────────────────────────────────────────────────

class RaceSettings extends formattingSettings.SimpleCard {
  topN = new formattingSettings.NumUpDown({
    name: 'topN',
    displayName: 'Top N Items', displayNameKey: 'BarRaceSettings_DisplayName_0009',
    value: 10,
  });

  playSpeed = new formattingSettings.NumUpDown({
    name: 'playSpeed',
    displayName: 'Play Speed (ms)', displayNameKey: 'BarRaceSettings_DisplayName_0010',
    value: 1500,
  });

  barHeight = new formattingSettings.NumUpDown({
    name: 'barHeight',
    displayName: 'Bar Height', displayNameKey: 'BarRaceSettings_DisplayName_0011',
    value: 30,
  });


  barCornerRadius = new formattingSettings.NumUpDown({

    name: 'barCornerRadius',

    displayName: 'Bar Corner Radius', displayNameKey: 'BarRaceSettings_DisplayName_0012',

    value: 3,

  });

  barOpacity = new formattingSettings.NumUpDown({

    name: 'barOpacity',

    displayName: 'Bar Opacity (%)', displayNameKey: 'BarRaceSettings_DisplayName_0013',

    value: 100,

  });

  name = 'raceSettings';
  displayName = 'Race Settings';
  displayNameKey = 'BarRaceSettings_DisplayName_0001';
  slices = [this.topN, this.playSpeed, this.barHeight, this.barCornerRadius, this.barOpacity];
}

// ── Color Settings ─────────────────────────────────────────────────

class ColorSettings extends formattingSettings.SimpleCard {
  useChartPalette = new formattingSettings.ToggleSwitch({
    name: 'useChartPalette',
    displayName: 'Use Chart Palette', displayNameKey: 'BarRaceSettings_DisplayName_0014',
    value: true,
  });

  name = 'colorSettings';
  displayName = 'Colors';
  displayNameKey = 'BarRaceSettings_DisplayName_0002';
  slices = [this.useChartPalette];
}

// ── Value Settings ─────────────────────────────────────────────────

class ValueSettings extends formattingSettings.SimpleCard {
  showValues = new formattingSettings.ToggleSwitch({
    name: 'showValues',
    displayName: 'Show Values', displayNameKey: 'BarRaceSettings_DisplayName_0015',
    value: true,
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size', displayNameKey: 'BarRaceSettings_DisplayName_0016',
    value: 11,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color', displayNameKey: 'BarRaceSettings_DisplayName_0017',
    value: { value: '' },
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Font Family', displayNameKey: 'BarRaceSettings_DisplayName_0018',
    items: [
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'BarRaceSettings_DisplayName_0019' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'BarRaceSettings_DisplayName_0020' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'BarRaceSettings_DisplayName_0021' },
      { value: 'Helvetica', displayName: 'Helvetica', displayNameKey: 'BarRaceSettings_DisplayName_0022' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'BarRaceSettings_DisplayName_0023' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'BarRaceSettings_DisplayName_0024' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'BarRaceSettings_DisplayName_0025' },
    ],
    value: { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'BarRaceSettings_DisplayName_0026' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Font Weight', displayNameKey: 'BarRaceSettings_DisplayName_0027',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'BarRaceSettings_DisplayName_0028' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'BarRaceSettings_DisplayName_0029' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'BarRaceSettings_DisplayName_0030' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'BarRaceSettings_DisplayName_0031' },
  });

  name = 'valueSettings';
  displayName = 'Values';
  displayNameKey = 'BarRaceSettings_DisplayName_0003';
  slices = [this.showValues, this.fontSize, this.fontColor, this.fontFamily, this.fontWeight];
}

// ── Card Style ─────────────────────────────────────────────────────

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style', displayNameKey: 'BarRaceSettings_DisplayName_0032',
    items: CARD_STYLE_MODE_ITEMS,
    value: { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'BarRaceSettings_DisplayName_0037' },
  });

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background Color', displayNameKey: 'BarRaceSettings_DisplayName_0038',
    value: { value: '' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Background Opacity (%)', displayNameKey: 'BarRaceSettings_DisplayName_0039',
    value: 35,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius', displayNameKey: 'BarRaceSettings_DisplayName_0040',
    value: 12,
  });

  contentPadding = new formattingSettings.NumUpDown({
    name: 'contentPadding',
    displayName: 'Content Padding', displayNameKey: 'BarRaceSettings_DisplayName_0041',
    value: 12,
  });

  name = 'cardSettings';
  displayName = 'Card Style';
  displayNameKey = 'BarRaceSettings_DisplayName_0004';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.contentPadding];
}

// ── Animation Settings ─────────────────────────────────────────────

class AnimationSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Animations', displayNameKey: 'BarRaceSettings_DisplayName_0042',
    value: true,
  });

  duration = new formattingSettings.NumUpDown({
    name: 'duration',
    displayName: 'Duration (ms)', displayNameKey: 'BarRaceSettings_DisplayName_0043',
    value: 600,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  displayNameKey = 'BarRaceSettings_DisplayName_0005';
  slices = [this.enabled, this.duration];
}

// ── Timestamp Settings ─────────────────────────────────────────────

class TimestampSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Timestamp', displayNameKey: 'BarRaceSettings_DisplayName_0044',
    value: true,
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size', displayNameKey: 'BarRaceSettings_DisplayName_0045',
    value: 48,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color', displayNameKey: 'BarRaceSettings_DisplayName_0046',
    value: { value: '' },
  });

  opacity = new formattingSettings.NumUpDown({
    name: 'opacity',
    displayName: 'Opacity (%)', displayNameKey: 'BarRaceSettings_DisplayName_0047',
    value: 20,
  });

  position = new formattingSettings.ItemDropdown({
    name: 'position',
    displayName: 'Position', displayNameKey: 'BarRaceSettings_DisplayName_0048',
    items: [
      { value: 'bottomRight', displayName: 'Bottom Right', displayNameKey: 'BarRaceSettings_DisplayName_0049' },
      { value: 'center', displayName: 'Center', displayNameKey: 'BarRaceSettings_DisplayName_0050' },
      { value: 'topRight', displayName: 'Top Right', displayNameKey: 'BarRaceSettings_DisplayName_0051' },
    ],
    value: { value: 'bottomRight', displayName: 'Bottom Right', displayNameKey: 'BarRaceSettings_DisplayName_0052' },
  });

  name = 'timestampSettings';
  displayName = 'Timestamp Display';
  displayNameKey = 'BarRaceSettings_DisplayName_0006';
  slices = [this.show, this.fontSize, this.fontColor, this.opacity, this.position];
}

// ── Playback Settings ───────────────────────────────────────────────

class PlaybackSettingsCard extends formattingSettings.SimpleCard {
  autoPlay = new formattingSettings.ToggleSwitch({
    name: 'autoPlay',
    displayName: 'Auto-Play on Load', displayNameKey: 'BarRaceSettings_DisplayName_0053',
    value: true,
  });

  showControls = new formattingSettings.ToggleSwitch({
    name: 'showControls',
    displayName: 'Show Controls', displayNameKey: 'BarRaceSettings_DisplayName_0054',
    value: true,
  });

  speed = new formattingSettings.ItemDropdown({
    name: 'speed',
    displayName: 'Playback Speed', displayNameKey: 'BarRaceSettings_DisplayName_0055',
    items: [
      { value: '0.5x', displayName: '0.5x', displayNameKey: 'BarRaceSettings_DisplayName_0056' },
      { value: '1x', displayName: '1x', displayNameKey: 'BarRaceSettings_DisplayName_0057' },
      { value: '1.5x', displayName: '1.5x', displayNameKey: 'BarRaceSettings_DisplayName_0058' },
      { value: '2x', displayName: '2x', displayNameKey: 'BarRaceSettings_DisplayName_0059' },
      { value: '3x', displayName: '3x', displayNameKey: 'BarRaceSettings_DisplayName_0060' },
    ],
    value: { value: '1x', displayName: '1x', displayNameKey: 'BarRaceSettings_DisplayName_0061' },
  });

  loop = new formattingSettings.ToggleSwitch({
    name: 'loop',
    displayName: 'Loop Animation', displayNameKey: 'BarRaceSettings_DisplayName_0062',
    value: true,
  });

  controlPosition = new formattingSettings.ItemDropdown({
    name: 'controlPosition',
    displayName: 'Control Position', displayNameKey: 'BarRaceSettings_DisplayName_0063',
    items: [
      { value: 'bottom', displayName: 'Bottom', displayNameKey: 'BarRaceSettings_DisplayName_0064' },
      { value: 'top', displayName: 'Top', displayNameKey: 'BarRaceSettings_DisplayName_0065' },
    ],
    value: { value: 'bottom', displayName: 'Bottom', displayNameKey: 'BarRaceSettings_DisplayName_0066' },
  });

  pauseDuration = new formattingSettings.NumUpDown({
    name: 'pauseDuration',
    displayName: 'Pause Duration (ms)', displayNameKey: 'BarRaceSettings_DisplayName_0067',
    value: 0,
  });

  name = 'playbackSettings';
  displayName = 'Playback';
  displayNameKey = 'BarRaceSettings_DisplayName_0007';
  slices = [this.autoPlay, this.showControls, this.speed, this.loop, this.controlPosition, this.pauseDuration];
}

// ── Race Display Settings ───────────────────────────────────────────

class RaceDisplaySettings extends formattingSettings.SimpleCard {
  showRankNumbers = new formattingSettings.ToggleSwitch({
    name: 'showRankNumbers',
    displayName: 'Show Rank Numbers', displayNameKey: 'BarRaceSettings_DisplayName_0068',
    value: false,
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size', displayNameKey: 'BarRaceSettings_DisplayName_0086',
    value: 11,
  });

  labelColor = new formattingSettings.ColorPicker({
    name: 'labelColor',
    displayName: 'Font Color', displayNameKey: 'BarRaceSettings_DisplayName_0071',
    value: { value: '' },
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Font Family', displayNameKey: 'BarRaceSettings_DisplayName_0072',
    items: [
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'BarRaceSettings_DisplayName_0073' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'BarRaceSettings_DisplayName_0074' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'BarRaceSettings_DisplayName_0075' },
      { value: 'Helvetica', displayName: 'Helvetica', displayNameKey: 'BarRaceSettings_DisplayName_0076' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'BarRaceSettings_DisplayName_0077' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'BarRaceSettings_DisplayName_0078' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'BarRaceSettings_DisplayName_0079' },
    ],
    value: { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'BarRaceSettings_DisplayName_0080' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Font Weight', displayNameKey: 'BarRaceSettings_DisplayName_0081',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'BarRaceSettings_DisplayName_0082' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'BarRaceSettings_DisplayName_0083' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'BarRaceSettings_DisplayName_0084' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'BarRaceSettings_DisplayName_0085' },
  });

  name = 'raceDisplay';
  displayName = 'Category Labels';
  displayNameKey = 'BarRaceSettings_DisplayName_0008';
  slices = [this.showRankNumbers, this.fontSize, this.labelColor, this.fontFamily, this.fontWeight];
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
