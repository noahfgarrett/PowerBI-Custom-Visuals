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
  CARD_STYLE_MODE_ITEMS
} from '../../core/src';

// ── Line & Points (merged LineSettingsCard — line config + dot config) ────────

class LineAndPointsCard extends formattingSettings.SimpleCard {
  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0011',
    value: 2,
  });

  curve = new formattingSettings.ItemDropdown({
    name: 'curve',
    displayName: 'Curve Type', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0012',
    items: [
      { value: 'monotoneX', displayName: 'Smooth (Monotone)', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0013' },
      { value: 'linear', displayName: 'Linear', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0014' },
      { value: 'step', displayName: 'Step', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0015' },
    ],
    value: { value: 'monotoneX', displayName: 'Smooth (Monotone)', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0016' },
  });

  showDots = new formattingSettings.ToggleSwitch({
    name: 'showDots',
    displayName: 'Show Dots', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0017',
    value: true,
  });

  dotRadius = new formattingSettings.NumUpDown({
    name: 'dotRadius',
    displayName: 'Dot Radius', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0018',
    value: 4,
  });

  dotStrokeColor = new formattingSettings.ColorPicker({
    name: 'dotStrokeColor',
    displayName: 'Dot Stroke Color', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0019',
    value: { value: '' },
  });

  dotStrokeWidth = new formattingSettings.NumUpDown({
    name: 'dotStrokeWidth',
    displayName: 'Dot Stroke Width', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0020',
    value: 2,
  });

  name = 'lineSettings';
  displayName = 'Line & Points';
  displayNameKey = 'MorphingAreaChartSettings_DisplayName_0001';
  slices = [this.lineWidth, this.curve, this.showDots, this.dotRadius, this.dotStrokeColor, this.dotStrokeWidth];
}

// ── Area Fill (merged AreaSettingsCard + AreaStackSettingsCard + AreaThresholdSettingsCard) ──

class AreaFillCard extends formattingSettings.SimpleCard {
  showArea = new formattingSettings.ToggleSwitch({
    name: 'showArea',
    displayName: 'Show Area Fill', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0021',
    value: true,
  });

  fillOpacity = new formattingSettings.NumUpDown({
    name: 'fillOpacity',
    displayName: 'Fill Opacity (%)', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0022',
    value: 30,
  });

  useGradient = new formattingSettings.ToggleSwitch({
    name: 'useGradient',
    displayName: 'Gradient Fill', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0023',
    value: true,
  });

  mode = new formattingSettings.ItemDropdown({
    name: 'mode',
    displayName: 'Stack Mode', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0024',
    items: [
      { value: 'normal', displayName: 'Normal (Overlapping)', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0025' },
      { value: 'stacked', displayName: 'Stacked', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0026' },
      { value: 'stacked100', displayName: '100% Stacked', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0027' },
      { value: 'stream', displayName: 'Stream', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0028' },
    ],
    value: { value: 'normal', displayName: 'Normal (Overlapping)', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0029' },
  });

  // Threshold zone sub-section
  showThreshold = new formattingSettings.ToggleSwitch({
    name: 'showThreshold',
    displayName: 'Show Threshold Zone', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0030',
    value: false,
  });

  threshold = new formattingSettings.NumUpDown({
    name: 'threshold',
    displayName: 'Threshold Value', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0031',
    value: 0,
  });

  aboveColor = new formattingSettings.ColorPicker({
    name: 'aboveColor',
    displayName: 'Above Color', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0032',
    value: { value: '#22C55E' },
  });

  belowColor = new formattingSettings.ColorPicker({
    name: 'belowColor',
    displayName: 'Below Color', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0033',
    value: { value: '#EF4444' },
  });

  thresholdLineColor = new formattingSettings.ColorPicker({
    name: 'thresholdLineColor',
    displayName: 'Threshold Line Color', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0034',
    value: { value: '#94A3B8' },
  });

  thresholdLineWidth = new formattingSettings.NumUpDown({
    name: 'thresholdLineWidth',
    displayName: 'Threshold Line Width', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0035',
    value: 1,
  });

  forecastLineOpacity = new formattingSettings.NumUpDown({
    name: 'forecastLineOpacity',
    displayName: 'Forecast Line Opacity (%)', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0036',
    value: 60,
  });

  forecastBandOpacity = new formattingSettings.NumUpDown({
    name: 'forecastBandOpacity',
    displayName: 'Forecast Band Opacity (%)', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0037',
    value: 50,
  });

  thresholdLineOpacity = new formattingSettings.NumUpDown({
    name: 'thresholdLineOpacity',
    displayName: 'Threshold Line Opacity (%)', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0038',
    value: 70,
  });

  name = 'areaFillSettings';
  displayName = 'Area Fill';
  displayNameKey = 'MorphingAreaChartSettings_DisplayName_0002';
  slices = [this.showArea, this.fillOpacity, this.useGradient, this.mode, this.forecastLineOpacity, this.forecastBandOpacity, this.showThreshold, this.threshold, this.aboveColor, this.belowColor, this.thresholdLineColor, this.thresholdLineWidth, this.thresholdLineOpacity];
}

// ── Axes (local toggles — shared AxisFormattingCard handles the rest) ─────────

class AxisSettingsCard extends formattingSettings.SimpleCard {
  showXAxis = new formattingSettings.ToggleSwitch({
    name: 'showXAxis',
    displayName: 'Show X-Axis', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0039',
    value: true,
  });

  showYAxis = new formattingSettings.ToggleSwitch({
    name: 'showYAxis',
    displayName: 'Show Y-Axis', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0040',
    value: true,
  });

  gridLines = new formattingSettings.ToggleSwitch({
    name: 'gridLines',
    displayName: 'Grid Lines', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0041',
    value: true,
  });

  xAxisLabelPadding = new formattingSettings.NumUpDown({
    name: 'xAxisLabelPadding',
    displayName: 'X-Axis Label Padding', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0080',
    value: 14,
  });

  name = 'axisSettings';
  displayName = 'Axes';
  displayNameKey = 'MorphingAreaChartSettings_DisplayName_0003';
  slices = [this.showXAxis, this.showYAxis, this.gridLines, this.xAxisLabelPadding];
}

// ── Card Style ───────────────────────────────────────────────────────

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0042',
    items: CARD_STYLE_MODE_ITEMS,
    value: { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0047' },
  });

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background Color', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0048',
    value: { value: '' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Background Opacity (%)', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0049',
    value: 85,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0050',
    value: 12,
  });

  contentPadding = new formattingSettings.NumUpDown({
    name: 'contentPadding',
    displayName: 'Content Padding', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0051',
    value: 8,
  });

  name = 'cardSettings';
  displayName = 'Card Style';
  displayNameKey = 'MorphingAreaChartSettings_DisplayName_0004';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.contentPadding];
}

// ── Animation Settings ──────────────────────────────────────────────

class AnimationSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Animations', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0052',
    value: true,
  });

  duration = new formattingSettings.NumUpDown({
    name: 'duration',
    displayName: 'Duration (ms)', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0053',
    value: 600,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  displayNameKey = 'MorphingAreaChartSettings_DisplayName_0005';
  slices = [this.enabled, this.duration];
}

// ── Interaction (merged BrushSettingsCard) ──────────────────────────

class InteractionCard extends formattingSettings.SimpleCard {
  brushEnabled = new formattingSettings.ToggleSwitch({
    name: 'brushEnabled',
    displayName: 'Enable Brush/Zoom', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0054',
    value: false,
  });

  contextHeight = new formattingSettings.NumUpDown({
    name: 'contextHeight',
    displayName: 'Context Height (px)', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0055',
    value: 60,
  });

  brushColor = new formattingSettings.ColorPicker({
    name: 'brushColor',
    displayName: 'Brush Color', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0056',
    value: { value: '#3B82F6' },
  });

  brushOpacity = new formattingSettings.NumUpDown({
    name: 'brushOpacity',
    displayName: 'Brush Opacity (%)', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0057',
    value: 30,
  });

  name = 'interactionSettings';
  displayName = 'Interaction';
  displayNameKey = 'MorphingAreaChartSettings_DisplayName_0006';
  slices = [this.brushEnabled, this.contextHeight, this.brushColor, this.brushOpacity];
}

// ── Forecast Settings ──────────────────────────────────────────────

class ForecastSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Forecast Zone', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0058',
    value: false,
  });

  periods = new formattingSettings.NumUpDown({
    name: 'periods',
    displayName: 'Forecast Periods', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0059',
    value: 3,
  });

  opacity = new formattingSettings.NumUpDown({
    name: 'opacity',
    displayName: 'Confidence Band Opacity (%)', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0060',
    value: 20,
  });

  name = 'areaForecastSettings';
  displayName = 'Forecast / Projection';
  displayNameKey = 'MorphingAreaChartSettings_DisplayName_0007';
  slices = [this.show, this.periods, this.opacity];
}

// ── Data Handling (merged AreaGapSettingsCard) ──────────────────────

class DataHandlingCard extends formattingSettings.SimpleCard {
  nullHandling = new formattingSettings.ItemDropdown({
    name: 'nullHandling',
    displayName: 'Null / Gap Handling', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0061',
    items: [
      { value: 'skip', displayName: 'Skip (Leave Gap)', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0062' },
      { value: 'connect', displayName: 'Connect Adjacent', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0063' },
      { value: 'interpolate', displayName: 'Interpolate', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0064' },
    ],
    value: { value: 'skip', displayName: 'Skip (Leave Gap)', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0065' },
  });

  name = 'dataHandlingSettings';
  displayName = 'Data Handling';
  displayNameKey = 'MorphingAreaChartSettings_DisplayName_0008';
  slices = [this.nullHandling];
}

// ── Vertical Reference Band ──────────────────────────────────────────

class VerticalBandCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Vertical Band', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0066',
    value: false,
  });

  startValue = new formattingSettings.TextInput({
    name: 'startValue',
    displayName: 'Start Category', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0067',
    value: '',
    placeholder: 'e.g. Jan', placeholderKey: 'MorphingAreaChartSettings_Placeholder_0001',
  });

  endValue = new formattingSettings.TextInput({
    name: 'endValue',
    displayName: 'End Category', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0068',
    value: '',
    placeholder: 'e.g. Mar', placeholderKey: 'MorphingAreaChartSettings_Placeholder_0002',
  });

  bandColor = new formattingSettings.ColorPicker({
    name: 'bandColor',
    displayName: 'Band Color', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0069',
    value: { value: '#3B82F6' },
  });

  bandOpacity = new formattingSettings.NumUpDown({
    name: 'bandOpacity',
    displayName: 'Band Opacity (%)', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0070',
    value: 20,
  });

  bandLabel = new formattingSettings.TextInput({
    name: 'bandLabel',
    displayName: 'Label', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0071',
    value: '',
    placeholder: 'e.g. Phase 1', placeholderKey: 'MorphingAreaChartSettings_Placeholder_0003',
  });

  name = 'verticalBandSettings';
  displayName = 'Vertical Reference Band';
  displayNameKey = 'MorphingAreaChartSettings_DisplayName_0009';
  slices = [this.show, this.startValue, this.endValue, this.bandColor, this.bandOpacity, this.bandLabel];
}

// ── Gap / Distance Indicator ───────────────────────────────────────────

class GapIndicatorCard extends formattingSettings.SimpleCard {
  showGapIndicator = new formattingSettings.ToggleSwitch({
    name: 'showGapIndicator',
    displayName: 'Show Gap Indicator', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0072',
    value: false,
  });

  gapSeriesA = new formattingSettings.NumUpDown({
    name: 'gapSeriesA',
    displayName: 'Series A (1-indexed)', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0073',
    value: 1,
  });

  gapSeriesB = new formattingSettings.NumUpDown({
    name: 'gapSeriesB',
    displayName: 'Series B (1-indexed)', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0074',
    value: 2,
  });

  gapInterval = new formattingSettings.NumUpDown({
    name: 'gapInterval',
    displayName: 'Show Every N Points', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0075',
    value: 1,
  });

  gapColor = new formattingSettings.ColorPicker({
    name: 'gapColor',
    displayName: 'Gap Line Color', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0076',
    value: { value: '#94A3B8' },
  });

  gapLineWidth = new formattingSettings.NumUpDown({
    name: 'gapLineWidth',
    displayName: 'Gap Line Width', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0077',
    value: 1,
  });

  showGapValue = new formattingSettings.ToggleSwitch({
    name: 'showGapValue',
    displayName: 'Show Gap Value', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0078',
    value: true,
  });

  gapFontSize = new formattingSettings.NumUpDown({
    name: 'gapFontSize',
    displayName: 'Gap Font Size', displayNameKey: 'MorphingAreaChartSettings_DisplayName_0079',
    value: 10,
  });

  name = 'gapIndicatorSettings';
  displayName = 'Gap / Distance Indicator';
  displayNameKey = 'MorphingAreaChartSettings_DisplayName_0010';
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
