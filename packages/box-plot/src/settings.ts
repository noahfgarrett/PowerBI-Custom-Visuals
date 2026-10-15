/**
 * Box Plot — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ScrollFormattingCard, SortFormattingCard, NumberFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard,
  SeriesFormattingCard,
  DateFilterFormattingCard,
  CARD_STYLE_MODE_ITEMS
} from '../../core/src';

// -- Box Settings ----------------------------------------------------------

class BoxSettingsCard extends formattingSettings.SimpleCard {
  boxWidth = new formattingSettings.NumUpDown({
    name: 'boxWidth',
    displayName: 'Box Width (px)', displayNameKey: 'BoxPlotSettings_DisplayName_0010',
    value: 40,
  });

  showOutliers = new formattingSettings.ToggleSwitch({
    name: 'showOutliers',
    displayName: 'Show Outliers', displayNameKey: 'BoxPlotSettings_DisplayName_0011',
    value: true,
  });

  showMedianLine = new formattingSettings.ToggleSwitch({
    name: 'showMedianLine',
    displayName: 'Show Median Line', displayNameKey: 'BoxPlotSettings_DisplayName_0012',
    value: true,
  });

  medianColor = new formattingSettings.ColorPicker({
    name: 'medianColor',
    displayName: 'Median Color', displayNameKey: 'BoxPlotSettings_DisplayName_0013',
    value: { value: '#F28C38' },
  });

  medianLineWidth = new formattingSettings.NumUpDown({
    name: 'medianLineWidth',
    displayName: 'Median Line Width', displayNameKey: 'BoxPlotSettings_DisplayName_0014',
    value: 2.5,
  });


  boxStrokeColor = new formattingSettings.ColorPicker({

    name: 'boxStrokeColor',

    displayName: 'Box Border Color', displayNameKey: 'BoxPlotSettings_DisplayName_0015',

    value: { value: '' },

  });

  boxStrokeWidth = new formattingSettings.NumUpDown({

    name: 'boxStrokeWidth',

    displayName: 'Box Border Width', displayNameKey: 'BoxPlotSettings_DisplayName_0016',

    value: 1,

  });

  whiskerWidth = new formattingSettings.NumUpDown({

    name: 'whiskerWidth',

    displayName: 'Whisker Line Width', displayNameKey: 'BoxPlotSettings_DisplayName_0017',

    value: 1,

  });

  outlierRadius = new formattingSettings.NumUpDown({

    name: 'outlierRadius',

    displayName: 'Outlier Size', displayNameKey: 'BoxPlotSettings_DisplayName_0018',

    value: 3,

  });


  name = 'boxSettings';
  displayName = 'Box and Whiskers';
  displayNameKey = 'BoxPlotSettings_DisplayName_0001';
  slices = [this.boxWidth, this.showOutliers, this.showMedianLine, this.medianColor, this.medianLineWidth, this.boxStrokeColor, this.boxStrokeWidth, this.whiskerWidth, this.outlierRadius];
}

// -- Layout Settings -------------------------------------------------------

class LayoutSettingsCard extends formattingSettings.SimpleCard {
  containerPadding = new formattingSettings.NumUpDown({
    name: 'containerPadding',
    displayName: 'Container Padding', displayNameKey: 'BoxPlotSettings_DisplayName_0019',
    value: 12,
  });

  labelPadding = new formattingSettings.NumUpDown({
    name: 'labelPadding',
    displayName: 'Data Label Offset', displayNameKey: 'BoxPlotSettings_DisplayName_0020',
    value: 6,
  });

  categoryPaddingInner = new formattingSettings.NumUpDown({
    name: 'categoryPaddingInner',
    displayName: 'Category Padding (Inner)', displayNameKey: 'BoxPlotSettings_DisplayName_0021',
    value: 0.2,
  });

  categoryPaddingOuter = new formattingSettings.NumUpDown({
    name: 'categoryPaddingOuter',
    displayName: 'Category Padding (Outer)', displayNameKey: 'BoxPlotSettings_DisplayName_0022',
    value: 0.1,
  });

  name = 'layoutSettings';
  displayName = 'Layout';
  displayNameKey = 'BoxPlotSettings_DisplayName_0002';
  slices = [this.containerPadding, this.labelPadding, this.categoryPaddingInner, this.categoryPaddingOuter];
}

// -- Color Settings --------------------------------------------------------

class ColorSettingsCard extends formattingSettings.SimpleCard {
  boxColor = new formattingSettings.ColorPicker({
    name: 'boxColor',
    displayName: 'Box Color', displayNameKey: 'BoxPlotSettings_DisplayName_0023',
    value: { value: '#3B82F6' },
  });

  whiskerColor = new formattingSettings.ColorPicker({
    name: 'whiskerColor',
    displayName: 'Whisker Color', displayNameKey: 'BoxPlotSettings_DisplayName_0024',
    value: { value: '#64748B' },
  });

  perCategoryColors = new formattingSettings.ToggleSwitch({
    name: 'perCategoryColors',
    displayName: 'Per-Category Colors', displayNameKey: 'BoxPlotSettings_DisplayName_0025',
    value: false,
  });

  name = 'colorSettings';
  displayName = 'Colors';
  displayNameKey = 'BoxPlotSettings_DisplayName_0003';
  slices = [this.boxColor, this.whiskerColor, this.perCategoryColors];
}

// -- Card Style ------------------------------------------------------------

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style', displayNameKey: 'BoxPlotSettings_DisplayName_0029',
    items: CARD_STYLE_MODE_ITEMS,
    value: { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'BoxPlotSettings_DisplayName_0034' },
  });

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background Color', displayNameKey: 'BoxPlotSettings_DisplayName_0035',
    value: { value: '' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Background Opacity (%)', displayNameKey: 'BoxPlotSettings_DisplayName_0036',
    value: 85,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius', displayNameKey: 'BoxPlotSettings_DisplayName_0037',
    value: 12,
  });

  contentPadding = new formattingSettings.NumUpDown({
    name: 'contentPadding',
    displayName: 'Content Padding', displayNameKey: 'BoxPlotSettings_DisplayName_0066',
    value: 8,
  });

  name = 'cardSettings';
  displayName = 'Card Style';
  displayNameKey = 'BoxPlotSettings_DisplayName_0005';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.contentPadding];
}

// -- Animation Settings ----------------------------------------------------

class AnimationSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Animations', displayNameKey: 'BoxPlotSettings_DisplayName_0038',
    value: true,
  });

  duration = new formattingSettings.NumUpDown({
    name: 'duration',
    displayName: 'Duration (ms)', displayNameKey: 'BoxPlotSettings_DisplayName_0039',
    value: 600,
  });

  staggerDelay = new formattingSettings.NumUpDown({
    name: 'staggerDelay',
    displayName: 'Stagger Delay (ms)', displayNameKey: 'BoxPlotSettings_DisplayName_0040',
    value: 50,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  displayNameKey = 'BoxPlotSettings_DisplayName_0006';
  slices = [this.enabled, this.duration, this.staggerDelay];
}

// -- Mean Marker Settings --------------------------------------------------

class MeanMarkerSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Mean Marker', displayNameKey: 'BoxPlotSettings_DisplayName_0041',
    value: true,
  });

  shape = new formattingSettings.ItemDropdown({
    name: 'shape',
    displayName: 'Shape', displayNameKey: 'BoxPlotSettings_DisplayName_0042',
    items: [
      { value: 'diamond', displayName: 'Diamond', displayNameKey: 'BoxPlotSettings_DisplayName_0043' },
      { value: 'cross', displayName: 'Cross', displayNameKey: 'BoxPlotSettings_DisplayName_0044' },
      { value: 'circle', displayName: 'Circle', displayNameKey: 'BoxPlotSettings_DisplayName_0045' },
    ],
    value: { value: 'diamond', displayName: 'Diamond', displayNameKey: 'BoxPlotSettings_DisplayName_0046' },
  });

  color = new formattingSettings.ColorPicker({
    name: 'color',
    displayName: 'Color', displayNameKey: 'BoxPlotSettings_DisplayName_0047',
    value: { value: '#F59E0B' },
  });

  size = new formattingSettings.NumUpDown({
    name: 'size',
    displayName: 'Size', displayNameKey: 'BoxPlotSettings_DisplayName_0048',
    value: 8,
  });

  strokeWidth = new formattingSettings.NumUpDown({
    name: 'strokeWidth',
    displayName: 'Stroke Width', displayNameKey: 'BoxPlotSettings_DisplayName_0049',
    value: 2,
  });

  name = 'meanMarkerSettings';
  displayName = 'Mean Marker';
  displayNameKey = 'BoxPlotSettings_DisplayName_0007';
  slices = [this.show, this.shape, this.color, this.size, this.strokeWidth];
}

// -- Jitter (Data Points) Settings -----------------------------------------

class JitterSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Data Points', displayNameKey: 'BoxPlotSettings_DisplayName_0050',
    value: false,
  });

  opacity = new formattingSettings.NumUpDown({
    name: 'opacity',
    displayName: 'Point Opacity (%)', displayNameKey: 'BoxPlotSettings_DisplayName_0051',
    value: 40,
  });

  radius = new formattingSettings.NumUpDown({
    name: 'radius',
    displayName: 'Radius', displayNameKey: 'BoxPlotSettings_DisplayName_0052',
    value: 3,
  });

  color = new formattingSettings.ColorPicker({
    name: 'color',
    displayName: 'Point Color', displayNameKey: 'BoxPlotSettings_DisplayName_0053',
    value: { value: '' },
  });

  name = 'jitterSettings';
  displayName = 'Data Points';
  displayNameKey = 'BoxPlotSettings_DisplayName_0008';
  slices = [this.show, this.opacity, this.radius, this.color];
}

// -- Box Plot Display Settings ------------------------------------------------

class BoxPlotDisplaySettingsCard extends formattingSettings.SimpleCard {
  showViolin = new formattingSettings.ToggleSwitch({
    name: 'showViolin',
    displayName: 'Show Violin Overlay', displayNameKey: 'BoxPlotSettings_DisplayName_0054',
    value: false,
  });

  showNotches = new formattingSettings.ToggleSwitch({
    name: 'showNotches',
    displayName: 'Show Notches (95% CI)', displayNameKey: 'BoxPlotSettings_DisplayName_0055',
    value: false,
  });

  orientation = new formattingSettings.ItemDropdown({
    name: 'orientation',
    displayName: 'Orientation', displayNameKey: 'BoxPlotSettings_DisplayName_0056',
    items: [
      { value: 'vertical', displayName: 'Vertical', displayNameKey: 'BoxPlotSettings_DisplayName_0057' },
      { value: 'horizontal', displayName: 'Horizontal', displayNameKey: 'BoxPlotSettings_DisplayName_0058' },
    ],
    value: { value: 'vertical', displayName: 'Vertical', displayNameKey: 'BoxPlotSettings_DisplayName_0059' },
  });

  whiskerCalc = new formattingSettings.ItemDropdown({
    name: 'whiskerCalc',
    displayName: 'Whisker Calculation', displayNameKey: 'BoxPlotSettings_DisplayName_0060',
    items: [
      { value: 'iqr', displayName: '1.5x IQR', displayNameKey: 'BoxPlotSettings_DisplayName_0061' },
      { value: 'minmax', displayName: 'Min/Max', displayNameKey: 'BoxPlotSettings_DisplayName_0062' },
      { value: 'percentile', displayName: '5th-95th Percentile', displayNameKey: 'BoxPlotSettings_DisplayName_0063' },
      { value: 'stddev', displayName: 'Standard Deviation', displayNameKey: 'BoxPlotSettings_DisplayName_0064' },
    ],
    value: { value: 'iqr', displayName: '1.5x IQR', displayNameKey: 'BoxPlotSettings_DisplayName_0065' },
  });

  name = 'boxPlotDisplaySettings';
  displayName = 'Plot Options';
  displayNameKey = 'BoxPlotSettings_DisplayName_0009';
  slices = [this.showViolin, this.showNotches, this.orientation, this.whiskerCalc];
}

// -- Root Model ------------------------------------------------------------

export class BoxPlotSettings extends formattingSettings.Model {
  boxSettings = new BoxSettingsCard();
  layoutSettings = new LayoutSettingsCard();
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
  sortFormattingCard = new SortFormattingCard();
  cardSettings = new CardStyleSettings();
  scrollFormattingCard = new ScrollFormattingCard();
  referenceLineFormattingCard = new ReferenceLineFormattingCard();
  trendLineFormattingCard = new TrendLineFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  constructor() {
    super();
    this.scrollFormattingCard.minCategoryWidth.value = 60;
  }

  cards = [
    this.boxSettings,
    this.layoutSettings,
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
    this.sortFormattingCard,
    this.cardSettings,
    this.scrollFormattingCard,
    this.referenceLineFormattingCard,
    this.trendLineFormattingCard,
    this.conditionalFormattingCard,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
