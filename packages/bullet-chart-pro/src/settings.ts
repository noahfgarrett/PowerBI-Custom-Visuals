/**
 * Bullet Chart Pro — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ScrollFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, AnnotationFormattingCard, AccessibilityFormattingCard, NumberFormattingCard } from '../../core/src';
// ── Bullet Settings ─────────────────────────────────────────────────

class BulletSettings extends formattingSettings.SimpleCard {
  barHeight = new formattingSettings.NumUpDown({
    name: 'barHeight',
    displayName: 'Bar Height',
    value: 20,
  });

  showTarget = new formattingSettings.ToggleSwitch({
    name: 'showTarget',
    displayName: 'Show Target',
    value: true,
  });

  showLabels = new formattingSettings.ToggleSwitch({
    name: 'showLabels',
    displayName: 'Show Labels',
    value: true,
  });


  barCornerRadius = new formattingSettings.NumUpDown({

    name: 'barCornerRadius',

    displayName: 'Bar Corner Radius',

    value: 2,

  });

  rangeOpacity = new formattingSettings.NumUpDown({

    name: 'rangeOpacity',

    displayName: 'Range Opacity (%)',

    value: 15,

  });


  name = 'bulletSettings';
  displayName = 'Bullet Settings';
  slices = [this.barHeight, this.showTarget, this.showLabels, this.barCornerRadius, this.rangeOpacity];
}

// ── Range Colors ────────────────────────────────────────────────────

class RangeSettings extends formattingSettings.SimpleCard {
  poorColor = new formattingSettings.ColorPicker({
    name: 'poorColor',
    displayName: 'Poor Color',
    value: { value: '#FCA5A5' },
  });

  satisfactoryColor = new formattingSettings.ColorPicker({
    name: 'satisfactoryColor',
    displayName: 'Satisfactory Color',
    value: { value: '#FDE68A' },
  });

  goodColor = new formattingSettings.ColorPicker({
    name: 'goodColor',
    displayName: 'Good Color',
    value: { value: '#BBF7D0' },
  });

  barColor = new formattingSettings.ColorPicker({
    name: 'barColor',
    displayName: 'Bar Color',
    value: { value: '#1E293B' },
  });

  name = 'rangeSettings';
  displayName = 'Range Colors';
  slices = [this.poorColor, this.satisfactoryColor, this.goodColor, this.barColor];
}

// ── Card Style ──────────────────────────────────────────────────────

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

// ── Animation Settings ──────────────────────────────────────────────

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

// ── Bullet Layout Settings ──────────────────────────────────────────

class BulletLayoutSettings extends formattingSettings.SimpleCard {
  orientation = new formattingSettings.ItemDropdown({
    name: 'orientation',
    displayName: 'Orientation',
    items: [
      { value: 'horizontal', displayName: 'Horizontal' },
      { value: 'vertical', displayName: 'Vertical' },
    ],
    value: { value: 'horizontal', displayName: 'Horizontal' },
  });

  name = 'bulletLayout';
  displayName = 'Layout';
  slices = [this.orientation];
}

// ── Bullet Forecast Settings ────────────────────────────────────────

class BulletForecastSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Forecast',
    value: false,
  });

  forecastValue = new formattingSettings.NumUpDown({
    name: 'forecastValue',
    displayName: 'Forecast Value',
    value: 0,
  });

  bandWidth = new formattingSettings.NumUpDown({
    name: 'bandWidth',
    displayName: 'Band Width',
    value: 10,
  });

  name = 'bulletForecast';
  displayName = 'Forecast';
  slices = [this.show, this.forecastValue, this.bandWidth];
}

// ── Bullet Comparison Settings ──────────────────────────────────────

class BulletComparisonSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Comparative',
    value: false,
  });

  comparativeColor = new formattingSettings.ColorPicker({
    name: 'comparativeColor',
    displayName: 'Comparative Color',
    value: { value: '#94A3B8' },
  });

  name = 'bulletComparison';
  displayName = 'Comparison';
  slices = [this.show, this.comparativeColor];
}

// ── Root Model ──────────────────────────────────────────────────────

export class BulletChartProSettings extends formattingSettings.Model {
  bulletSettings = new BulletSettings();
  rangeSettings = new RangeSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettingsCard();

  axisFormattingCard = new AxisFormattingCard();

  dataLabelFormattingCard = new DataLabelFormattingCard();

  titleFormattingCard = new TitleFormattingCard();

  scrollFormattingCard = new ScrollFormattingCard();

  constructor() {
    super();
    this.scrollFormattingCard.minCategoryWidth.value = 30;
  }

  referenceLineFormattingCard = new ReferenceLineFormattingCard();
  trendLineFormattingCard = new TrendLineFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  annotationFormattingCard = new AnnotationFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  bulletLayout = new BulletLayoutSettings();
  bulletForecast = new BulletForecastSettings();
  bulletComparison = new BulletComparisonSettings();
  numberFormattingCard = new NumberFormattingCard();

  cards = [
    this.bulletSettings,
    this.rangeSettings,
    this.cardSettings,
    this.animationSettings,
    this.axisFormattingCard,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.scrollFormattingCard,
    this.referenceLineFormattingCard,
    this.trendLineFormattingCard,
    this.conditionalFormattingCard,
    this.annotationFormattingCard,
    this.accessibilityFormattingCard,
    this.bulletLayout,
    this.bulletForecast,
    this.bulletComparison,
    this.numberFormattingCard,
  ];
}
