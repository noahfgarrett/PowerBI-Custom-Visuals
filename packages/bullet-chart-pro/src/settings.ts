/**
 * Bullet Chart Pro — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ScrollFormattingCard, SortFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, AnnotationFormattingCard, AccessibilityFormattingCard, NumberFormattingCard,
  ColorThemeFormattingCard,
  DateFilterFormattingCard,
  CARD_STYLE_MODE_ITEMS
} from '../../core/src';
// ── Bullet Settings ─────────────────────────────────────────────────

class BulletSettings extends formattingSettings.SimpleCard {
  barHeight = new formattingSettings.NumUpDown({
    name: 'barHeight',
    displayName: 'Bar Thickness', displayNameKey: 'BulletChartProSettings_DisplayName_0007',
    value: 20,
  });

  showTarget = new formattingSettings.ToggleSwitch({
    name: 'showTarget',
    displayName: 'Show Target', displayNameKey: 'BulletChartProSettings_DisplayName_0008',
    value: true,
  });

  showLabels = new formattingSettings.ToggleSwitch({
    name: 'showLabels',
    displayName: 'Show Category and Value Labels', displayNameKey: 'BulletChartProSettings_DisplayName_0009',
    value: true,
  });

  labelPadding = new formattingSettings.NumUpDown({
    name: 'labelPadding',
    displayName: 'Category Label Spacing', displayNameKey: 'BulletChartProSettings_DisplayName_0010',
    value: 6,
  });

  barCornerRadius = new formattingSettings.NumUpDown({
    name: 'barCornerRadius',
    displayName: 'Bar Corner Radius', displayNameKey: 'BulletChartProSettings_DisplayName_0011',
    value: 2,
  });

  rangeOpacity = new formattingSettings.NumUpDown({
    name: 'rangeOpacity',
    displayName: 'Range Opacity (%)', displayNameKey: 'BulletChartProSettings_DisplayName_0012',
    value: 15,
  });

  orientation = new formattingSettings.ItemDropdown({
    name: 'orientation',
    displayName: 'Orientation', displayNameKey: 'BulletChartProSettings_DisplayName_0013',
    items: [
      { value: 'horizontal', displayName: 'Horizontal', displayNameKey: 'BulletChartProSettings_DisplayName_0014' },
      { value: 'vertical', displayName: 'Vertical', displayNameKey: 'BulletChartProSettings_DisplayName_0015' },
    ],
    value: { value: 'horizontal', displayName: 'Horizontal', displayNameKey: 'BulletChartProSettings_DisplayName_0016' },
  });

  name = 'bulletSettings';
  displayName = 'Bullet Settings';
  displayNameKey = 'BulletChartProSettings_DisplayName_0001';
  slices = [this.orientation, this.barHeight, this.barCornerRadius, this.rangeOpacity, this.showTarget, this.showLabels, this.labelPadding];
}

// ── Layout Settings ─────────────────────────────────────────────────

class LayoutSettingsCard extends formattingSettings.SimpleCard {
  containerPadding = new formattingSettings.NumUpDown({
    name: 'containerPadding',
    displayName: 'Container Padding', displayNameKey: 'BulletChartProSettings_DisplayName_0017',
    value: 12,
  });

  rowGap = new formattingSettings.NumUpDown({
    name: 'rowGap',
    displayName: 'Row Gap', displayNameKey: 'BulletChartProSettings_DisplayName_0018',
    value: 8,
  });

  valueLabelPadding = new formattingSettings.NumUpDown({
    name: 'valueLabelPadding',
    displayName: 'Value Label Spacing', displayNameKey: 'BulletChartProSettings_DisplayName_0019',
    value: 8,
  });

  name = 'layoutSettings';
  displayName = 'Layout';
  displayNameKey = 'BulletChartProSettings_DisplayName_0002';
  slices = [this.containerPadding, this.rowGap, this.valueLabelPadding];
}

// ── Range Colors ────────────────────────────────────────────────────

class RangeSettings extends formattingSettings.SimpleCard {
  poorColor = new formattingSettings.ColorPicker({
    name: 'poorColor',
    displayName: 'Poor Color', displayNameKey: 'BulletChartProSettings_DisplayName_0020',
    value: { value: '#FCA5A5' },
  });

  satisfactoryColor = new formattingSettings.ColorPicker({
    name: 'satisfactoryColor',
    displayName: 'Satisfactory Color', displayNameKey: 'BulletChartProSettings_DisplayName_0021',
    value: { value: '#FDE68A' },
  });

  goodColor = new formattingSettings.ColorPicker({
    name: 'goodColor',
    displayName: 'Good Color', displayNameKey: 'BulletChartProSettings_DisplayName_0022',
    value: { value: '#BBF7D0' },
  });

  barColor = new formattingSettings.ColorPicker({
    name: 'barColor',
    displayName: 'Bar Color', displayNameKey: 'BulletChartProSettings_DisplayName_0023',
    value: { value: '#1E293B' },
  });

  name = 'rangeSettings';
  displayName = 'Range Colors';
  displayNameKey = 'BulletChartProSettings_DisplayName_0003';
  slices = [this.poorColor, this.satisfactoryColor, this.goodColor, this.barColor];
}

// ── Markers & Overlays ──────────────────────────────────────────────

class BulletMarkersSettings extends formattingSettings.SimpleCard {
  showForecast = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Forecast', displayNameKey: 'BulletChartProSettings_DisplayName_0024',
    value: false,
  });

  forecastValue = new formattingSettings.NumUpDown({
    name: 'forecastValue',
    displayName: 'Forecast Value', displayNameKey: 'BulletChartProSettings_DisplayName_0025',
    value: 0,
  });

  bandWidth = new formattingSettings.NumUpDown({
    name: 'bandWidth',
    displayName: 'Band Width', displayNameKey: 'BulletChartProSettings_DisplayName_0026',
    value: 10,
  });

  forecastColor = new formattingSettings.ColorPicker({
    name: 'forecastColor',
    displayName: 'Forecast Color', displayNameKey: 'BulletChartProSettings_DisplayName_0029',
    value: { value: '#6366F1' },
  });

  targetMarkerWidth = new formattingSettings.NumUpDown({
    name: 'targetMarkerWidth',
    displayName: 'Target Marker Width', displayNameKey: 'BulletChartProSettings_DisplayName_0030',
    value: 2,
  });

  name = 'bulletMarkers';
  displayName = 'Markers & Overlays';
  displayNameKey = 'BulletChartProSettings_DisplayName_0004';
  slices = [this.targetMarkerWidth, this.showForecast, this.forecastValue, this.bandWidth, this.forecastColor];
}

// ── Card Style ──────────────────────────────────────────────────────

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style', displayNameKey: 'BulletChartProSettings_DisplayName_0032',
    items: CARD_STYLE_MODE_ITEMS,
    value: { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'BulletChartProSettings_DisplayName_0037' },
  });

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background Color', displayNameKey: 'BulletChartProSettings_DisplayName_0038',
    value: { value: '' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Background Opacity (%)', displayNameKey: 'BulletChartProSettings_DisplayName_0039',
    value: 85,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius', displayNameKey: 'BulletChartProSettings_DisplayName_0040',
    value: 12,
  });

  contentPadding = new formattingSettings.NumUpDown({
    name: 'contentPadding',
    displayName: 'Content Padding', displayNameKey: 'BulletChartProSettings_DisplayName_0043',
    value: 8,
  });

  name = 'cardSettings';
  displayName = 'Card Style';
  displayNameKey = 'BulletChartProSettings_DisplayName_0005';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.contentPadding];
}

// ── Animation Settings ──────────────────────────────────────────────

class AnimationSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Animations', displayNameKey: 'BulletChartProSettings_DisplayName_0041',
    value: true,
  });

  duration = new formattingSettings.NumUpDown({
    name: 'duration',
    displayName: 'Duration (ms)', displayNameKey: 'BulletChartProSettings_DisplayName_0042',
    value: 600,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  displayNameKey = 'BulletChartProSettings_DisplayName_0006';
  slices = [this.enabled, this.duration];
}

// ── Root Model ──────────────────────────────────────────────────────

export class BulletChartProSettings extends formattingSettings.Model {
  bulletSettings = new BulletSettings();
  layoutSettings = new LayoutSettingsCard();
  rangeSettings = new RangeSettings();
  bulletMarkers = new BulletMarkersSettings();

  axisFormattingCard = new AxisFormattingCard();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  scrollFormattingCard = new ScrollFormattingCard();
  sortFormattingCard = new SortFormattingCard();

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
    this.layoutSettings,
    this.rangeSettings,
    this.bulletMarkers,
    this.axisFormattingCard,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.scrollFormattingCard,
    this.sortFormattingCard,
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
