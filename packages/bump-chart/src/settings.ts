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
} from '../../core/src';

// ── Bump Lines ──────────────────────────────────────────────────

class BumpSettings extends formattingSettings.SimpleCard {
  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width',
    value: 3,
  });

  dotRadius = new formattingSettings.NumUpDown({
    name: 'dotRadius',
    displayName: 'Dot Radius',
    value: 6,
  });

  showRankNumbers = new formattingSettings.ToggleSwitch({
    name: 'showRankNumbers',
    displayName: 'Show Rank Numbers',
    value: true,
  });

  dotStrokeColor = new formattingSettings.ColorPicker({
    name: 'dotStrokeColor',
    displayName: 'Dot Stroke Color',
    value: { value: '' },
  });

  showArea = new formattingSettings.ToggleSwitch({
    name: 'showArea',
    displayName: 'Show Area Fill',
    value: false,
  });

  areaOpacity = new formattingSettings.NumUpDown({
    name: 'areaOpacity',
    displayName: 'Area Opacity (%)',
    value: 20,
  });

  showXAxis = new formattingSettings.ToggleSwitch({
    name: 'showXAxis',
    displayName: 'Show X-Axis',
    value: true,
  });

  useChartPalette = new formattingSettings.ToggleSwitch({
    name: 'useChartPalette',
    displayName: 'Use Chart Palette',
    value: true,
  });

  name = 'bumpSettings';
  displayName = 'Bump Lines';
  slices = [this.lineWidth, this.dotRadius, this.showRankNumbers, this.dotStrokeColor, this.showArea, this.areaOpacity, this.showXAxis, this.useChartPalette];
}

// ── Highlight & Analysis ────────────────────────────────────────────

class BumpHighlightSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Highlight Top/Bottom N',
    value: false,
  });

  topN = new formattingSettings.NumUpDown({
    name: 'topN',
    displayName: 'Top N',
    value: 3,
  });

  showOthers = new formattingSettings.ToggleSwitch({
    name: 'showOthers',
    displayName: 'Show Others (Dimmed)',
    value: true,
  });

  name = 'bumpHighlightSettings';
  displayName = 'Highlight Top/Bottom N';
  slices = [this.enabled, this.topN, this.showOthers];
}

// ── Rank Change & Comparison ───────────────────────────────────────

class BumpRankChangeSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Rank Change Indicators',
    value: false,
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size',
    value: 9,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color',
    value: { value: '' },
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Font',
    items: [
      { value: '', displayName: 'Default' },
      { value: 'Segoe UI', displayName: 'Segoe UI' },
      { value: 'Arial', displayName: 'Arial' },
      { value: 'Calibri', displayName: 'Calibri' },
      { value: 'Helvetica Neue', displayName: 'Helvetica Neue' },
      { value: 'Times New Roman', displayName: 'Times New Roman' },
      { value: 'Verdana', displayName: 'Verdana' },
      { value: 'Georgia', displayName: 'Georgia' },
    ],
    value: { value: '', displayName: 'Default' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Font Weight',
    items: [
      { value: 'normal', displayName: 'Normal' },
      { value: 'bold', displayName: 'Bold' },
      { value: '600', displayName: 'Semi-Bold' },
    ],
    value: { value: 'bold', displayName: 'Bold' },
  });

  positiveColor = new formattingSettings.ColorPicker({
    name: 'positiveColor',
    displayName: 'Positive Color',
    value: { value: '#22C55E' },
  });

  negativeColor = new formattingSettings.ColorPicker({
    name: 'negativeColor',
    displayName: 'Negative Color',
    value: { value: '#EF4444' },
  });

  showComparison = new formattingSettings.ToggleSwitch({
    name: 'showComparison',
    displayName: 'Show Period Comparison',
    value: false,
  });

  name = 'bumpRankChangeSettings';
  displayName = 'Rank Change Indicators';
  slices = [this.show, this.fontSize, this.fontColor, this.positiveColor, this.negativeColor, this.fontFamily, this.fontWeight, this.showComparison];
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

// ── Animation Settings ──────────────────────────────────────────────

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
