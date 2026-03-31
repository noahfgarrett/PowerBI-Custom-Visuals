/**
 * Box Plot — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ScrollFormattingCard, NumberFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard,
  SeriesFormattingCard,
  DateFilterFormattingCard,
} from '../../core/src';

// -- Box Settings ----------------------------------------------------------

class BoxSettingsCard extends formattingSettings.SimpleCard {
  boxWidth = new formattingSettings.NumUpDown({
    name: 'boxWidth',
    displayName: 'Box Width',
    value: 40,
  });

  showOutliers = new formattingSettings.ToggleSwitch({
    name: 'showOutliers',
    displayName: 'Show Outliers',
    value: true,
  });

  showMedianLine = new formattingSettings.ToggleSwitch({
    name: 'showMedianLine',
    displayName: 'Show Median Line',
    value: true,
  });

  medianColor = new formattingSettings.ColorPicker({
    name: 'medianColor',
    displayName: 'Median Color',
    value: { value: '#F28C38' },
  });

  medianLineWidth = new formattingSettings.NumUpDown({
    name: 'medianLineWidth',
    displayName: 'Median Line Width',
    value: 2.5,
  });


  boxStrokeColor = new formattingSettings.ColorPicker({

    name: 'boxStrokeColor',

    displayName: 'Box Stroke Color',

    value: { value: '' },

  });

  boxStrokeWidth = new formattingSettings.NumUpDown({

    name: 'boxStrokeWidth',

    displayName: 'Box Stroke Width',

    value: 1,

  });

  whiskerWidth = new formattingSettings.NumUpDown({

    name: 'whiskerWidth',

    displayName: 'Whisker Width',

    value: 1,

  });

  outlierRadius = new formattingSettings.NumUpDown({

    name: 'outlierRadius',

    displayName: 'Outlier Radius',

    value: 3,

  });


  name = 'boxSettings';
  displayName = 'Box Settings';
  slices = [this.boxWidth, this.showOutliers, this.showMedianLine, this.medianColor, this.medianLineWidth, this.boxStrokeColor, this.boxStrokeWidth, this.whiskerWidth, this.outlierRadius];
}

// -- Color Settings --------------------------------------------------------

class ColorSettingsCard extends formattingSettings.SimpleCard {
  boxColor = new formattingSettings.ColorPicker({
    name: 'boxColor',
    displayName: 'Box Color',
    value: { value: '#3B82F6' },
  });

  whiskerColor = new formattingSettings.ColorPicker({
    name: 'whiskerColor',
    displayName: 'Whisker Color',
    value: { value: '#64748B' },
  });

  perCategoryColors = new formattingSettings.ToggleSwitch({
    name: 'perCategoryColors',
    displayName: 'Per-Category Colors',
    value: false,
  });

  name = 'colorSettings';
  displayName = 'Colors';
  slices = [this.boxColor, this.whiskerColor, this.perCategoryColors];
}

// -- Axis Settings ---------------------------------------------------------

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

// -- Card Style ------------------------------------------------------------

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

// -- Animation Settings ----------------------------------------------------

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

  staggerDelay = new formattingSettings.NumUpDown({
    name: 'staggerDelay',
    displayName: 'Stagger Delay (ms)',
    value: 50,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  slices = [this.enabled, this.duration, this.staggerDelay];
}

// -- Mean Marker Settings --------------------------------------------------

class MeanMarkerSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Mean Marker',
    value: true,
  });

  shape = new formattingSettings.ItemDropdown({
    name: 'shape',
    displayName: 'Shape',
    items: [
      { value: 'diamond', displayName: 'Diamond' },
      { value: 'cross', displayName: 'Cross' },
      { value: 'circle', displayName: 'Circle' },
    ],
    value: { value: 'diamond', displayName: 'Diamond' },
  });

  color = new formattingSettings.ColorPicker({
    name: 'color',
    displayName: 'Color',
    value: { value: '#F59E0B' },
  });

  size = new formattingSettings.NumUpDown({
    name: 'size',
    displayName: 'Size',
    value: 8,
  });

  strokeWidth = new formattingSettings.NumUpDown({
    name: 'strokeWidth',
    displayName: 'Stroke Width',
    value: 2,
  });

  name = 'meanMarkerSettings';
  displayName = 'Mean Marker';
  slices = [this.show, this.shape, this.color, this.size, this.strokeWidth];
}

// -- Jitter (Data Points) Settings -----------------------------------------

class JitterSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Data Points',
    value: false,
  });

  opacity = new formattingSettings.NumUpDown({
    name: 'opacity',
    displayName: 'Point Opacity (%)',
    value: 40,
  });

  radius = new formattingSettings.NumUpDown({
    name: 'radius',
    displayName: 'Radius',
    value: 3,
  });

  color = new formattingSettings.ColorPicker({
    name: 'color',
    displayName: 'Point Color',
    value: { value: '' },
  });

  name = 'jitterSettings';
  displayName = 'Data Points';
  slices = [this.show, this.opacity, this.radius, this.color];
}

// -- Box Plot Display Settings ------------------------------------------------

class BoxPlotDisplaySettingsCard extends formattingSettings.SimpleCard {
  showViolin = new formattingSettings.ToggleSwitch({
    name: 'showViolin',
    displayName: 'Violin Overlay',
    value: false,
  });

  showNotches = new formattingSettings.ToggleSwitch({
    name: 'showNotches',
    displayName: 'Show Notches (95% CI)',
    value: false,
  });

  orientation = new formattingSettings.ItemDropdown({
    name: 'orientation',
    displayName: 'Orientation',
    items: [
      { value: 'vertical', displayName: 'Vertical' },
      { value: 'horizontal', displayName: 'Horizontal' },
    ],
    value: { value: 'vertical', displayName: 'Vertical' },
  });

  whiskerCalc = new formattingSettings.ItemDropdown({
    name: 'whiskerCalc',
    displayName: 'Whisker Calculation',
    items: [
      { value: 'iqr', displayName: '1.5x IQR' },
      { value: 'minmax', displayName: 'Min/Max' },
      { value: 'percentile', displayName: 'Percentile (5/95)' },
      { value: 'stddev', displayName: 'Std Dev' },
    ],
    value: { value: 'iqr', displayName: '1.5x IQR' },
  });

  name = 'boxPlotDisplaySettings';
  displayName = 'Box Plot Display';
  slices = [this.showViolin, this.showNotches, this.orientation, this.whiskerCalc];
}

// -- Root Model ------------------------------------------------------------

export class BoxPlotSettings extends formattingSettings.Model {
  boxSettings = new BoxSettingsCard();
  boxPlotDisplaySettings = new BoxPlotDisplaySettingsCard();
  colorSettings = new ColorSettingsCard();
  colorThemeFormattingCard = new ColorThemeFormattingCard();
  meanMarkerSettings = new MeanMarkerSettingsCard();
  jitterSettings = new JitterSettingsCard();
  animationSettings = new AnimationSettingsCard();
  axisFormattingCard = new AxisFormattingCard();
  legendFormattingCard = new LegendFormattingCard();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  numberFormattingCard = new NumberFormattingCard();
  seriesFormattingCard = new SeriesFormattingCard();
  cardSettings = new CardStyleSettings();
  scrollFormattingCard = new ScrollFormattingCard();
  referenceLineFormattingCard = new ReferenceLineFormattingCard();
  trendLineFormattingCard = new TrendLineFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  /** Kept for backward compatibility — local Axes card (hidden from pane, superseded by axisFormattingCard) */
  axisSettings = new AxisSettingsCard();

  constructor() {
    super();
    this.scrollFormattingCard.minCategoryWidth.value = 60;
  }

  cards = [
    this.boxSettings,
    this.boxPlotDisplaySettings,
    this.colorSettings,
    this.colorThemeFormattingCard,
    this.meanMarkerSettings,
    this.jitterSettings,
    this.animationSettings,
    this.axisFormattingCard,
    this.legendFormattingCard,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.numberFormattingCard,
    this.seriesFormattingCard,
    this.cardSettings,
    this.scrollFormattingCard,
    this.referenceLineFormattingCard,
    this.trendLineFormattingCard,
    this.conditionalFormattingCard,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
