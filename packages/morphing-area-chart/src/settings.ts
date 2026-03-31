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
  DateFilterFormattingCard,
} from '../../core/src';

// ── Line & Points (merged LineSettingsCard — line config + dot config) ────────

class LineAndPointsCard extends formattingSettings.SimpleCard {
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
  displayName = 'Line & Points';
  slices = [this.lineWidth, this.curve, this.showDots, this.dotRadius, this.dotStrokeColor, this.dotStrokeWidth];
}

// ── Area Fill (merged AreaSettingsCard + AreaStackSettingsCard + AreaThresholdSettingsCard) ──

class AreaFillCard extends formattingSettings.SimpleCard {
  showArea = new formattingSettings.ToggleSwitch({
    name: 'showArea',
    displayName: 'Show Area Fill',
    value: true,
  });

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

  mode = new formattingSettings.ItemDropdown({
    name: 'mode',
    displayName: 'Stack Mode',
    items: [
      { value: 'normal', displayName: 'Normal (Overlapping)' },
      { value: 'stacked', displayName: 'Stacked' },
      { value: 'stacked100', displayName: '100% Stacked' },
      { value: 'stream', displayName: 'Stream' },
    ],
    value: { value: 'normal', displayName: 'Normal (Overlapping)' },
  });

  // Threshold zone sub-section
  showThreshold = new formattingSettings.ToggleSwitch({
    name: 'showThreshold',
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

  thresholdLineColor = new formattingSettings.ColorPicker({
    name: 'thresholdLineColor',
    displayName: 'Threshold Line Color',
    value: { value: '#94A3B8' },
  });

  thresholdLineWidth = new formattingSettings.NumUpDown({
    name: 'thresholdLineWidth',
    displayName: 'Threshold Line Width',
    value: 1,
  });

  forecastLineOpacity = new formattingSettings.NumUpDown({
    name: 'forecastLineOpacity',
    displayName: 'Forecast Line Opacity (%)',
    value: 60,
  });

  forecastBandOpacity = new formattingSettings.NumUpDown({
    name: 'forecastBandOpacity',
    displayName: 'Forecast Band Opacity (%)',
    value: 50,
  });

  thresholdLineOpacity = new formattingSettings.NumUpDown({
    name: 'thresholdLineOpacity',
    displayName: 'Threshold Line Opacity (%)',
    value: 70,
  });

  name = 'areaFillSettings';
  displayName = 'Area Fill';
  slices = [this.showArea, this.fillOpacity, this.useGradient, this.mode, this.showThreshold, this.threshold, this.aboveColor, this.belowColor, this.thresholdLineColor, this.thresholdLineWidth, this.forecastLineOpacity, this.forecastBandOpacity, this.thresholdLineOpacity];
}

// ── Axes (local toggles — shared AxisFormattingCard handles the rest) ─────────

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

// ── Interaction (merged BrushSettingsCard) ──────────────────────────

class InteractionCard extends formattingSettings.SimpleCard {
  brushEnabled = new formattingSettings.ToggleSwitch({
    name: 'brushEnabled',
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

  name = 'interactionSettings';
  displayName = 'Interaction';
  slices = [this.brushEnabled, this.contextHeight, this.brushColor, this.brushOpacity];
}

// ── Forecast Settings ──────────────────────────────────────────────

class ForecastSettingsCard extends formattingSettings.SimpleCard {
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

// ── Data Handling (merged AreaGapSettingsCard) ──────────────────────

class DataHandlingCard extends formattingSettings.SimpleCard {
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

  name = 'dataHandlingSettings';
  displayName = 'Data Handling';
  slices = [this.nullHandling];
}

// ── Vertical Reference Band ──────────────────────────────────────────

class VerticalBandCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Vertical Band',
    value: false,
  });

  startValue = new formattingSettings.TextInput({
    name: 'startValue',
    displayName: 'Start Category',
    value: '',
    placeholder: 'e.g. Jan',
  });

  endValue = new formattingSettings.TextInput({
    name: 'endValue',
    displayName: 'End Category',
    value: '',
    placeholder: 'e.g. Mar',
  });

  bandColor = new formattingSettings.ColorPicker({
    name: 'bandColor',
    displayName: 'Band Color',
    value: { value: '#3B82F6' },
  });

  bandOpacity = new formattingSettings.NumUpDown({
    name: 'bandOpacity',
    displayName: 'Band Opacity (%)',
    value: 20,
  });

  bandLabel = new formattingSettings.TextInput({
    name: 'bandLabel',
    displayName: 'Label',
    value: '',
    placeholder: 'e.g. Phase 1',
  });

  name = 'verticalBandSettings';
  displayName = 'Vertical Reference Band';
  slices = [this.show, this.startValue, this.endValue, this.bandColor, this.bandOpacity, this.bandLabel];
}

// ── Gap / Distance Indicator ───────────────────────────────────────────

class GapIndicatorCard extends formattingSettings.SimpleCard {
  showGapIndicator = new formattingSettings.ToggleSwitch({
    name: 'showGapIndicator',
    displayName: 'Show Gap Indicator',
    value: false,
  });

  gapSeriesA = new formattingSettings.NumUpDown({
    name: 'gapSeriesA',
    displayName: 'Series A (1-indexed)',
    value: 1,
  });

  gapSeriesB = new formattingSettings.NumUpDown({
    name: 'gapSeriesB',
    displayName: 'Series B (1-indexed)',
    value: 2,
  });

  gapInterval = new formattingSettings.NumUpDown({
    name: 'gapInterval',
    displayName: 'Show Every N Points',
    value: 1,
  });

  gapColor = new formattingSettings.ColorPicker({
    name: 'gapColor',
    displayName: 'Gap Line Color',
    value: { value: '#94A3B8' },
  });

  gapLineWidth = new formattingSettings.NumUpDown({
    name: 'gapLineWidth',
    displayName: 'Gap Line Width',
    value: 1,
  });

  showGapValue = new formattingSettings.ToggleSwitch({
    name: 'showGapValue',
    displayName: 'Show Gap Value',
    value: true,
  });

  gapFontSize = new formattingSettings.NumUpDown({
    name: 'gapFontSize',
    displayName: 'Gap Font Size',
    value: 10,
  });

  name = 'gapIndicatorSettings';
  displayName = 'Gap / Distance Indicator';
  slices = [this.showGapIndicator, this.gapSeriesA, this.gapSeriesB, this.gapInterval, this.gapColor, this.gapLineWidth, this.showGapValue, this.gapFontSize];
}

// ── Root Model ───────────────────────────────────────────────────────

export class MorphingAreaChartSettings extends formattingSettings.Model {
  lineSettings = new LineAndPointsCard();
  areaFillSettings = new AreaFillCard();
  axisSettings = new AxisSettingsCard();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettingsCard();
  interactionSettings = new InteractionCard();
  areaForecastSettings = new ForecastSettingsCard();
  dataHandlingSettings = new DataHandlingCard();
  verticalBandSettings = new VerticalBandCard();
  gapIndicatorSettings = new GapIndicatorCard();

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
  dateFilterFormattingCard = new DateFilterFormattingCard();

  cards = [
    this.lineSettings,
    this.areaFillSettings,
    this.axisSettings,
    this.cardSettings,
    this.animationSettings,
    this.interactionSettings,
    this.areaForecastSettings,
    this.dataHandlingSettings,
    this.verticalBandSettings,
    this.gapIndicatorSettings,
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
    this.dateFilterFormattingCard,
  ];
}
