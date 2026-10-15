/**
 * Bump Chart — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import {
  AxisFormattingCard,
  LegendFormattingCard,
  DataLabelFormattingCard,
  TitleFormattingCard,
  LineStrokeFormattingCard,
  ScrollFormattingCard,
  NumberFormattingCard,
  ReferenceLineFormattingCard,
  TrendLineFormattingCard,
  ConditionalFormattingCard,
  CrosshairFormattingCard,
  AnnotationFormattingCard,
  AccessibilityFormattingCard,
  ColorThemeFormattingCard,
  SeriesFormattingCard,
  DateFilterFormattingCard,
  CARD_STYLE_MODE_ITEMS
} from '../../core/src';

// ── Bump Lines ──────────────────────────────────────────────────

class BumpSettings extends formattingSettings.SimpleCard {
  dotRadius = new formattingSettings.NumUpDown({
    name: 'dotRadius',
    displayName: 'Dot Radius', displayNameKey: 'BumpChartSettings_DisplayName_0007',
    value: 6,
  });

  showRankNumbers = new formattingSettings.ToggleSwitch({
    name: 'showRankNumbers',
    displayName: 'Show Rank Numbers', displayNameKey: 'BumpChartSettings_DisplayName_0008',
    value: true,
  });

  dotStrokeColor = new formattingSettings.ColorPicker({
    name: 'dotStrokeColor',
    displayName: 'Dot Stroke Color', displayNameKey: 'BumpChartSettings_DisplayName_0009',
    value: { value: '' },
  });

  showArea = new formattingSettings.ToggleSwitch({
    name: 'showArea',
    displayName: 'Show Area Fill', displayNameKey: 'BumpChartSettings_DisplayName_0010',
    value: false,
  });

  areaOpacity = new formattingSettings.NumUpDown({
    name: 'areaOpacity',
    displayName: 'Area Opacity (%)', displayNameKey: 'BumpChartSettings_DisplayName_0011',
    value: 20,
  });

  showXAxis = new formattingSettings.ToggleSwitch({
    name: 'showXAxis',
    displayName: 'Show X-Axis', displayNameKey: 'BumpChartSettings_DisplayName_0012',
    value: true,
  });

  useChartPalette = new formattingSettings.ToggleSwitch({
    name: 'useChartPalette',
    displayName: 'Use Chart Palette', displayNameKey: 'BumpChartSettings_DisplayName_0013',
    value: true,
  });

  name = 'bumpSettings';
  displayName = 'Bump Lines';
  displayNameKey = 'BumpChartSettings_DisplayName_0001';
  slices = [this.dotRadius, this.showRankNumbers, this.dotStrokeColor, this.showArea, this.areaOpacity, this.showXAxis, this.useChartPalette];
}

// ── Highlight & Analysis ────────────────────────────────────────────

class BumpHighlightSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Top N Highlighting', displayNameKey: 'BumpChartSettings_DisplayName_0014',
    value: false,
  });

  topN = new formattingSettings.NumUpDown({
    name: 'topN',
    displayName: 'Top N', displayNameKey: 'BumpChartSettings_DisplayName_0015',
    value: 3,
  });

  showOthers = new formattingSettings.ToggleSwitch({
    name: 'showOthers',
    displayName: 'Show Others (Dimmed)', displayNameKey: 'BumpChartSettings_DisplayName_0016',
    value: true,
  });

  name = 'bumpHighlightSettings';
  displayName = 'Top N Highlighting';
  displayNameKey = 'BumpChartSettings_DisplayName_0002';
  slices = [this.enabled, this.topN, this.showOthers];
}

// ── Rank Change & Comparison ───────────────────────────────────────

class BumpRankChangeSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Rank Change Indicators', displayNameKey: 'BumpChartSettings_DisplayName_0017',
    value: false,
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size', displayNameKey: 'BumpChartSettings_DisplayName_0018',
    value: 9,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color', displayNameKey: 'BumpChartSettings_DisplayName_0019',
    value: { value: '' },
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Font', displayNameKey: 'BumpChartSettings_DisplayName_0020',
    items: [
      { value: '', displayName: 'Default', displayNameKey: 'BumpChartSettings_DisplayName_0021' },
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'BumpChartSettings_DisplayName_0022' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'BumpChartSettings_DisplayName_0023' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'BumpChartSettings_DisplayName_0024' },
      { value: 'Helvetica Neue', displayName: 'Helvetica Neue', displayNameKey: 'BumpChartSettings_DisplayName_0025' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'BumpChartSettings_DisplayName_0026' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'BumpChartSettings_DisplayName_0027' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'BumpChartSettings_DisplayName_0028' },
    ],
    value: { value: '', displayName: 'Default', displayNameKey: 'BumpChartSettings_DisplayName_0029' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Font Weight', displayNameKey: 'BumpChartSettings_DisplayName_0030',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'BumpChartSettings_DisplayName_0031' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'BumpChartSettings_DisplayName_0032' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'BumpChartSettings_DisplayName_0033' },
    ],
    value: { value: 'bold', displayName: 'Bold', displayNameKey: 'BumpChartSettings_DisplayName_0034' },
  });

  offset = new formattingSettings.NumUpDown({
    name: 'offset',
    displayName: 'Label Offset', displayNameKey: 'BumpChartSettings_DisplayName_0035',
    value: 4,
  });

  positiveColor = new formattingSettings.ColorPicker({
    name: 'positiveColor',
    displayName: 'Positive Color', displayNameKey: 'BumpChartSettings_DisplayName_0036',
    value: { value: '#22C55E' },
  });

  negativeColor = new formattingSettings.ColorPicker({
    name: 'negativeColor',
    displayName: 'Negative Color', displayNameKey: 'BumpChartSettings_DisplayName_0037',
    value: { value: '#EF4444' },
  });

  showComparison = new formattingSettings.ToggleSwitch({
    name: 'showComparison',
    displayName: 'Show Period Comparison', displayNameKey: 'BumpChartSettings_DisplayName_0038',
    value: false,
  });

  name = 'bumpRankChangeSettings';
  displayName = 'Rank Change Indicators';
  displayNameKey = 'BumpChartSettings_DisplayName_0003';
  slices = [this.show, this.fontSize, this.fontColor, this.positiveColor, this.negativeColor, this.fontFamily, this.fontWeight, this.offset, this.showComparison];
}

// ── Card Style ──────────────────────────────────────────────────────

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style', displayNameKey: 'BumpChartSettings_DisplayName_0039',
    items: CARD_STYLE_MODE_ITEMS,
    value: { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'BumpChartSettings_DisplayName_0044' },
  });

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background Color', displayNameKey: 'BumpChartSettings_DisplayName_0045',
    value: { value: '' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Background Opacity (%)', displayNameKey: 'BumpChartSettings_DisplayName_0046',
    value: 35,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius', displayNameKey: 'BumpChartSettings_DisplayName_0047',
    value: 12,
  });

  contentPadding = new formattingSettings.NumUpDown({
    name: 'contentPadding',
    displayName: 'Content Padding', displayNameKey: 'BumpChartSettings_DisplayName_0048',
    value: 12,
  });

  name = 'cardSettings';
  displayName = 'Card Style';
  displayNameKey = 'BumpChartSettings_DisplayName_0004';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.contentPadding];
}

// ── Animation Settings ──────────────────────────────────────────────

class AnimationSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Animations', displayNameKey: 'BumpChartSettings_DisplayName_0049',
    value: true,
  });

  duration = new formattingSettings.NumUpDown({
    name: 'duration',
    displayName: 'Duration (ms)', displayNameKey: 'BumpChartSettings_DisplayName_0050',
    value: 600,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  displayNameKey = 'BumpChartSettings_DisplayName_0005';
  slices = [this.enabled, this.duration];
}

// ── Root Model ──────────────────────────────────────────────────────

export class BumpChartSettings extends formattingSettings.Model {
  bumpSettings = new BumpSettings();
  bumpHighlightSettings = new BumpHighlightSettingsCard();
  bumpRankChangeSettings = new BumpRankChangeSettingsCard();

  // Shared formatting cards from core
  axisFormattingCard = new AxisFormattingCard();
  legendFormattingCard = new LegendFormattingCard();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  lineStrokeFormattingCard = new LineStrokeFormattingCard();
  scrollFormattingCard = new ScrollFormattingCard();

  constructor() {
    super();
    this.scrollFormattingCard.minCategoryWidth.value = 20;
  }

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  seriesFormattingCard = new SeriesFormattingCard();
  referenceLineFormattingCard = new ReferenceLineFormattingCard();
  trendLineFormattingCard = new TrendLineFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  crosshairFormattingCard = new CrosshairFormattingCard();
  annotationFormattingCard = new AnnotationFormattingCard();
  animationSettings = new AnimationSettings();
  cardSettings = new CardStyleSettings();
  numberFormattingCard = new NumberFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  cards = [
    this.bumpSettings,
    this.bumpHighlightSettings,
    this.bumpRankChangeSettings,
    this.axisFormattingCard,
    this.legendFormattingCard,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.lineStrokeFormattingCard,
    this.scrollFormattingCard,
    this.colorThemeFormattingCard,
    this.seriesFormattingCard,
    this.referenceLineFormattingCard,
    this.trendLineFormattingCard,
    this.conditionalFormattingCard,
    this.crosshairFormattingCard,
    this.annotationFormattingCard,
    this.animationSettings,
    this.cardSettings,
    this.numberFormattingCard,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
