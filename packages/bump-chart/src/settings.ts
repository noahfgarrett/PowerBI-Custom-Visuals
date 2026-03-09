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
  ReferenceLineFormattingCard,
  TrendLineFormattingCard,
  ConditionalFormattingCard,
  CrosshairFormattingCard,
  AnnotationFormattingCard,
  AccessibilityFormattingCard,
  ColorThemeFormattingCard,
  SeriesFormattingCard,
} from '../../core/src';

// ── Bump Settings ──────────────────────────────────────────────────

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

  name = 'bumpSettings';
  displayName = 'Bump Lines';
  slices = [this.lineWidth, this.dotRadius, this.showRankNumbers, this.dotStrokeColor, this.showArea, this.areaOpacity];
}

// ── Color Settings ──────────────────────────────────────────────────

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


// ── Axis Visibility (unique properties not in shared AxisFormattingCard) ─

class AxisVisibilitySettings extends formattingSettings.SimpleCard {
  showXAxis = new formattingSettings.ToggleSwitch({
    name: 'showXAxis',
    displayName: 'Show X-Axis',
    value: true,
  });

  name = 'axisVisibilitySettings';
  displayName = 'Axis Visibility';
  slices = [this.showXAxis];
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

// ── Bump Highlight Settings ─────────────────────────────────────────

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

// ── Bump Rank Change Settings ───────────────────────────────────────

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

  name = 'bumpRankChangeSettings';
  displayName = 'Rank Change Indicators';
  slices = [this.show, this.fontSize];
}

// ── Bump Comparison Settings ────────────────────────────────────────

class BumpComparisonSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Period Comparison',
    value: false,
  });

  name = 'bumpComparisonSettings';
  displayName = 'Period Comparison';
  slices = [this.show];
}

// ── Root Model ──────────────────────────────────────────────────────

export class BumpChartSettings extends formattingSettings.Model {
  bumpSettings = new BumpSettings();
  colorSettings = new ColorSettings();
  axisVisibilitySettings = new AxisVisibilitySettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();

  // New feature cards
  bumpHighlightSettings = new BumpHighlightSettingsCard();
  bumpRankChangeSettings = new BumpRankChangeSettingsCard();
  bumpComparisonSettings = new BumpComparisonSettingsCard();

  // Shared formatting cards from core
  axisFormattingCard = new AxisFormattingCard();
  legendFormattingCard = new LegendFormattingCard();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  lineStrokeFormattingCard = new LineStrokeFormattingCard();
  scrollFormattingCard = new ScrollFormattingCard();
  referenceLineFormattingCard = new ReferenceLineFormattingCard();
  trendLineFormattingCard = new TrendLineFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  crosshairFormattingCard = new CrosshairFormattingCard();
  annotationFormattingCard = new AnnotationFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  constructor() {
    super();
    this.scrollFormattingCard.minCategoryWidth.value = 20;
  }

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  seriesFormattingCard = new SeriesFormattingCard();
  cards = [
    this.bumpSettings,
    this.colorSettings,
    this.axisVisibilitySettings,
    this.cardSettings,
    this.animationSettings,
    this.bumpHighlightSettings,
    this.bumpRankChangeSettings,
    this.bumpComparisonSettings,
    this.axisFormattingCard,
    this.legendFormattingCard,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.lineStrokeFormattingCard,
    this.scrollFormattingCard,
    this.referenceLineFormattingCard,
    this.trendLineFormattingCard,
    this.conditionalFormattingCard,
    this.crosshairFormattingCard,
    this.annotationFormattingCard,
    this.accessibilityFormattingCard,
    this.seriesFormattingCard,
    this.colorThemeFormattingCard,
  ];
}
