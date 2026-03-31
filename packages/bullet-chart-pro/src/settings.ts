/**
 * Bullet Chart Pro — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ScrollFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, AnnotationFormattingCard, AccessibilityFormattingCard, NumberFormattingCard,
  ColorThemeFormattingCard,
  DateFilterFormattingCard,
} from '../../core/src';
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

  orientation = new formattingSettings.ItemDropdown({
    name: 'orientation',
    displayName: 'Orientation',
    items: [
      { value: 'horizontal', displayName: 'Horizontal' },
      { value: 'vertical', displayName: 'Vertical' },
    ],
    value: { value: 'horizontal', displayName: 'Horizontal' },
  });

  name = 'bulletSettings';
  displayName = 'Bullet Settings';
  slices = [this.barHeight, this.showTarget, this.showLabels, this.barCornerRadius, this.rangeOpacity, this.orientation];
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

// ── Markers & Overlays ──────────────────────────────────────────────

class BulletMarkersSettings extends formattingSettings.SimpleCard {
  showForecast = new formattingSettings.ToggleSwitch({
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

  showComparative = new formattingSettings.ToggleSwitch({
    name: 'showComparative',
    displayName: 'Show Comparative',
    value: false,
  });

  comparativeColor = new formattingSettings.ColorPicker({
    name: 'comparativeColor',
    displayName: 'Comparative Color',
    value: { value: '#94A3B8' },
  });

  forecastColor = new formattingSettings.ColorPicker({
    name: 'forecastColor',
    displayName: 'Forecast Color',
    value: { value: '#6366F1' },
  });

  targetMarkerWidth = new formattingSettings.NumUpDown({
    name: 'targetMarkerWidth',
    displayName: 'Target Marker Width',
    value: 2,
  });

  comparativeMarkerWidth = new formattingSettings.NumUpDown({
    name: 'comparativeMarkerWidth',
    displayName: 'Comparative Marker Width',
    value: 3,
  });

  name = 'bulletMarkers';
  displayName = 'Markers & Overlays';
  slices = [this.showForecast, this.forecastValue, this.bandWidth, this.forecastColor, this.showComparative, this.comparativeColor, this.targetMarkerWidth, this.comparativeMarkerWidth];
}

// ── Card Style ──────────────────────────────────────────────────────

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
    value: 85,
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

// ── Root Model ──────────────────────────────────────────────────────

export class BulletChartProSettings extends formattingSettings.Model {
  bulletSettings = new BulletSettings();
  rangeSettings = new RangeSettings();
  bulletMarkers = new BulletMarkersSettings();

  axisFormattingCard = new AxisFormattingCard();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  scrollFormattingCard = new ScrollFormattingCard();

  constructor() {
    super();
    this.scrollFormattingCard.minCategoryWidth.value = 30;
  }

  numberFormattingCard = new NumberFormattingCard();
  referenceLineFormattingCard = new ReferenceLineFormattingCard();
  trendLineFormattingCard = new TrendLineFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  annotationFormattingCard = new AnnotationFormattingCard();
  animationSettings = new AnimationSettingsCard();
  cardSettings = new CardStyleSettings();
  legendFormattingCard = new LegendFormattingCard();
  colorThemeFormattingCard = new ColorThemeFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  cards = [
    this.bulletSettings,
    this.rangeSettings,
    this.bulletMarkers,
    this.axisFormattingCard,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.scrollFormattingCard,
    this.numberFormattingCard,
    this.referenceLineFormattingCard,
    this.trendLineFormattingCard,
    this.conditionalFormattingCard,
    this.annotationFormattingCard,
    this.animationSettings,
    this.cardSettings,
    this.legendFormattingCard,
    this.colorThemeFormattingCard,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
