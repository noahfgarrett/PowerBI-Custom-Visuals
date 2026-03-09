/**
 * Morphing Area Chart — Formatting model (properties pane).
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
  SeriesFormattingCard,
  ColorThemeFormattingCard,
} from '../../core/src';

// ── Line Settings ────────────────────────────────────────────────────

class LineSettingsCard extends formattingSettings.SimpleCard {
  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width',
    value: 2,
  });

  curve = new formattingSettings.ItemDropdown({
    name: 'curve',
    displayName: 'Curve Type',
    items: [
      { value: 'monotoneX', displayName: 'Smooth (Monotone)' },
      { value: 'linear', displayName: 'Linear' },
      { value: 'step', displayName: 'Step' },
    ],
    value: { value: 'monotoneX', displayName: 'Smooth (Monotone)' },
  });

  showDots = new formattingSettings.ToggleSwitch({
    name: 'showDots',
    displayName: 'Show Dots',
    value: true,
  });

  showArea = new formattingSettings.ToggleSwitch({
    name: 'showArea',
    displayName: 'Show Area Fill',
    value: true,
  });


  dotRadius = new formattingSettings.NumUpDown({

    name: 'dotRadius',

    displayName: 'Dot Radius',

    value: 4,

  });

  dotStrokeColor = new formattingSettings.ColorPicker({

    name: 'dotStrokeColor',

    displayName: 'Dot Stroke Color',

    value: { value: '' },

  });

  dotStrokeWidth = new formattingSettings.NumUpDown({

    name: 'dotStrokeWidth',

    displayName: 'Dot Stroke Width',

    value: 2,

  });


  name = 'lineSettings';
  displayName = 'Line Settings';
  slices = [this.lineWidth, this.curve, this.showDots, this.showArea, this.dotRadius, this.dotStrokeColor, this.dotStrokeWidth];
}

// ── Area Settings ────────────────────────────────────────────────────

class AreaSettingsCard extends formattingSettings.SimpleCard {
  fillOpacity = new formattingSettings.NumUpDown({
    name: 'fillOpacity',
    displayName: 'Fill Opacity (%)',
    value: 30,
  });

  useGradient = new formattingSettings.ToggleSwitch({
    name: 'useGradient',
    displayName: 'Gradient Fill',
    value: true,
  });

  name = 'areaSettings';
  displayName = 'Area Settings';
  slices = [this.fillOpacity, this.useGradient];
}

// ── Axis Settings ────────────────────────────────────────────────────

class AxisSettingsCard extends formattingSettings.SimpleCard {
  showXAxis = new formattingSettings.ToggleSwitch({
    name: 'showXAxis',
    displayName: 'Show X-Axis',
    value: true,
  });

  showYAxis = new formattingSettings.ToggleSwitch({
    name: 'showYAxis',
    displayName: 'Show Y-Axis',
    value: true,
  });

  gridLines = new formattingSettings.ToggleSwitch({
    name: 'gridLines',
    displayName: 'Grid Lines',
    value: true,
  });

  name = 'axisSettings';
  displayName = 'Axes';
  slices = [this.showXAxis, this.showYAxis, this.gridLines];
}


// ── Card Style ───────────────────────────────────────────────────────

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

// ── Area Forecast Settings ──────────────────────────────────────────

class AreaForecastSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Forecast Zone',
    value: false,
  });

  periods = new formattingSettings.NumUpDown({
    name: 'periods',
    displayName: 'Forecast Periods',
    value: 3,
  });

  opacity = new formattingSettings.NumUpDown({
    name: 'opacity',
    displayName: 'Confidence Band Opacity (%)',
    value: 20,
  });

  name = 'areaForecastSettings';
  displayName = 'Forecast / Projection';
  slices = [this.show, this.periods, this.opacity];
}

// ── Area Stack Settings ─────────────────────────────────────────────

class AreaStackSettingsCard extends formattingSettings.SimpleCard {
  mode = new formattingSettings.ItemDropdown({
    name: 'mode',
    displayName: 'Stack Mode',
    items: [
      { value: 'normal', displayName: 'Normal (Overlapping)' },
      { value: 'stacked', displayName: 'Stacked' },
      { value: 'stacked100', displayName: '100% Stacked' },
    ],
    value: { value: 'normal', displayName: 'Normal (Overlapping)' },
  });

  name = 'areaStackSettings';
  displayName = 'Area Stacking';
  slices = [this.mode];
}

// ── Area Gap Handling Settings ──────────────────────────────────────

class AreaGapSettingsCard extends formattingSettings.SimpleCard {
  nullHandling = new formattingSettings.ItemDropdown({
    name: 'nullHandling',
    displayName: 'Null / Gap Handling',
    items: [
      { value: 'skip', displayName: 'Skip (Leave Gap)' },
      { value: 'connect', displayName: 'Connect Adjacent' },
      { value: 'interpolate', displayName: 'Interpolate' },
    ],
    value: { value: 'skip', displayName: 'Skip (Leave Gap)' },
  });

  name = 'areaGapSettings';
  displayName = 'Gap Handling';
  slices = [this.nullHandling];
}

// ── Area Threshold Settings ─────────────────────────────────────────

class AreaThresholdSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Threshold Zone',
    value: false,
  });

  threshold = new formattingSettings.NumUpDown({
    name: 'threshold',
    displayName: 'Threshold Value',
    value: 0,
  });

  aboveColor = new formattingSettings.ColorPicker({
    name: 'aboveColor',
    displayName: 'Above Color',
    value: { value: '#22C55E' },
  });

  belowColor = new formattingSettings.ColorPicker({
    name: 'belowColor',
    displayName: 'Below Color',
    value: { value: '#EF4444' },
  });

  name = 'areaThresholdSettings';
  displayName = 'Threshold Zone';
  slices = [this.show, this.threshold, this.aboveColor, this.belowColor];
}

// ── Brush / Zoom Settings ──────────────────────────────────────────

class BrushSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Brush/Zoom',
    value: false,
  });

  contextHeight = new formattingSettings.NumUpDown({
    name: 'contextHeight',
    displayName: 'Context Height (px)',
    value: 60,
  });

  brushColor = new formattingSettings.ColorPicker({
    name: 'brushColor',
    displayName: 'Brush Color',
    value: { value: '#3B82F6' },
  });

  brushOpacity = new formattingSettings.NumUpDown({
    name: 'brushOpacity',
    displayName: 'Brush Opacity (%)',
    value: 30,
  });

  name = 'brushSettings';
  displayName = 'Brush / Zoom';
  slices = [this.enabled, this.contextHeight, this.brushColor, this.brushOpacity];
}

// ── Root Model ───────────────────────────────────────────────────────

export class MorphingAreaChartSettings extends formattingSettings.Model {
  lineSettings = new LineSettingsCard();
  areaSettings = new AreaSettingsCard();
  axisSettings = new AxisSettingsCard();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettingsCard();

  // New feature cards
  areaForecastSettings = new AreaForecastSettingsCard();
  areaStackSettings = new AreaStackSettingsCard();
  areaGapSettings = new AreaGapSettingsCard();
  areaThresholdSettings = new AreaThresholdSettingsCard();
  brushSettings = new BrushSettingsCard();

  // Shared formatting cards from core
  axisFormattingCard = new AxisFormattingCard();
  legendFormattingCard = new LegendFormattingCard();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  lineStrokeFormattingCard = new LineStrokeFormattingCard();
  scrollFormattingCard = new ScrollFormattingCard();
  numberFormattingCard = new NumberFormattingCard();
  referenceLineFormattingCard = new ReferenceLineFormattingCard();
  trendLineFormattingCard = new TrendLineFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  crosshairFormattingCard = new CrosshairFormattingCard();
  annotationFormattingCard = new AnnotationFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();
  seriesFormattingCard = new SeriesFormattingCard();

  constructor() {
    super();
    this.scrollFormattingCard.minCategoryWidth.value = 20;
  }

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  cards = [
    this.lineSettings,
    this.areaSettings,
    this.axisSettings,
    this.cardSettings,
    this.animationSettings,
    this.areaForecastSettings,
    this.areaStackSettings,
    this.areaGapSettings,
    this.areaThresholdSettings,
    this.brushSettings,
    this.axisFormattingCard,
    this.legendFormattingCard,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.lineStrokeFormattingCard,
    this.scrollFormattingCard,
    this.numberFormattingCard,
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
