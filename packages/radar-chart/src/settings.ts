import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard,
  SeriesFormattingCard, NumberFormattingCard,
  DateFilterFormattingCard,
  CARD_STYLE_MODE_ITEMS
} from '../../core/src';

class RadarAxisFormattingCard extends AxisFormattingCard {
  displayName = 'Axes & Grid';
  displayNameKey = 'RadarChartSettings_DisplayName_AxesGrid';
}

// -- Grid & Web: grid configuration and web stroke settings -------------------

class RadarLayoutSettings extends formattingSettings.SimpleCard {
  showGrid = new formattingSettings.ToggleSwitch({ name: 'showGrid', displayName: 'Show Grid', displayNameKey: 'RadarChartSettings_DisplayName_0007', value: true });
  gridLevels = new formattingSettings.NumUpDown({ name: 'gridLevels', displayName: 'Grid Levels', displayNameKey: 'RadarChartSettings_DisplayName_0008', value: 5 });

  gridShape = new formattingSettings.ItemDropdown({
    name: 'gridShape',
    displayName: 'Grid Shape', displayNameKey: 'RadarChartSettings_DisplayName_0009',
    items: [
      { value: 'polygon', displayName: 'Polygon', displayNameKey: 'RadarChartSettings_DisplayName_0010' },
      { value: 'circle', displayName: 'Circle', displayNameKey: 'RadarChartSettings_DisplayName_0011' },
    ],
    value: { value: 'polygon', displayName: 'Polygon', displayNameKey: 'RadarChartSettings_DisplayName_0012' },
  });

  webStrokeColor = new formattingSettings.ColorPicker({
    name: 'webStrokeColor',
    displayName: 'Grid Fill Color', displayNameKey: 'RadarChartSettings_DisplayName_0013',
    value: { value: '' },
  });
  webStrokeWidth = new formattingSettings.NumUpDown({
    name: 'webStrokeWidth',
    displayName: 'Grid Line Width', displayNameKey: 'RadarChartSettings_DisplayName_0014',
    value: 1,
  });
  webFillOpacity = new formattingSettings.NumUpDown({
    name: 'webFillOpacity',
    displayName: 'Grid Fill Opacity (%)', displayNameKey: 'RadarChartSettings_DisplayName_0015',
    value: 15,
  });

  showAxisLabels = new formattingSettings.ToggleSwitch({
    name: 'showAxisLabels',
    displayName: 'Show Axis Labels', displayNameKey: 'RadarChartSettings_DisplayName_0016',
    value: true,
  });

  showAxisValues = new formattingSettings.ToggleSwitch({
    name: 'showAxisValues',
    displayName: 'Show Axis Values', displayNameKey: 'RadarChartSettings_DisplayName_0017',
    value: false,
  });

  startAngle = new formattingSettings.NumUpDown({
    name: 'startAngle',
    displayName: 'Start Angle (degrees)', displayNameKey: 'RadarChartSettings_DisplayName_0018',
    value: 0,
  });

  independentScales = new formattingSettings.ToggleSwitch({
    name: 'independentScales',
    displayName: 'Independent Axis Scales', displayNameKey: 'RadarChartSettings_DisplayName_0019',
    value: false,
  });

  axisLabelCollisionHandling = new formattingSettings.ItemDropdown({
    name: 'axisLabelCollisionHandling',
    displayName: 'Label Collision Handling', displayNameKey: 'RadarChartSettings_DisplayName_0050',
    items: [
      { value: 'auto', displayName: 'Auto', displayNameKey: 'RadarChartSettings_DisplayName_0051' },
      { value: 'hide', displayName: 'Hide Overlaps', displayNameKey: 'RadarChartSettings_DisplayName_0052' },
      { value: 'none', displayName: 'Off', displayNameKey: 'RadarChartSettings_DisplayName_0053' },
    ],
    value: { value: 'auto', displayName: 'Auto', displayNameKey: 'RadarChartSettings_DisplayName_0051' },
  });

  name = 'radarSettings';
  displayName = 'Grid and Axes';
  displayNameKey = 'RadarChartSettings_DisplayName_0001';
  slices = [this.showGrid, this.gridLevels, this.gridShape, this.webStrokeColor, this.webStrokeWidth, this.webFillOpacity, this.showAxisLabels, this.showAxisValues, this.startAngle, this.independentScales, this.axisLabelCollisionHandling];
}

// -- Series Appearance: fill, dots, area, palette -----------------------------

class RadarAppearanceSettings extends formattingSettings.SimpleCard {
  fillOpacity = new formattingSettings.NumUpDown({ name: 'fillOpacity', displayName: 'Fill Opacity (%)', displayNameKey: 'RadarChartSettings_DisplayName_0020', value: 25 });
  areaOpacity = new formattingSettings.NumUpDown({
    name: 'areaOpacity',
    displayName: 'Series Opacity (%)', displayNameKey: 'RadarChartSettings_DisplayName_0021',
    value: 30,
  });
  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width', displayNameKey: 'RadarChartSettings_DisplayName_0022',
    value: 2,
  });
  showDots = new formattingSettings.ToggleSwitch({ name: 'showDots', displayName: 'Show Dots', displayNameKey: 'RadarChartSettings_DisplayName_0023', value: true });
  dotRadius = new formattingSettings.NumUpDown({ name: 'dotRadius', displayName: 'Dot Radius', displayNameKey: 'RadarChartSettings_DisplayName_0024', value: 4 });
  dotBorderColor = new formattingSettings.ColorPicker({
    name: 'dotBorderColor',
    displayName: 'Dot Border Color', displayNameKey: 'RadarChartSettings_DisplayName_0025',
    value: { value: '#FFFFFF' },
  });
  dotBorderWidth = new formattingSettings.NumUpDown({
    name: 'dotBorderWidth',
    displayName: 'Dot Border Width', displayNameKey: 'RadarChartSettings_DisplayName_0026',
    value: 1,
  });
  useChartPalette = new formattingSettings.ToggleSwitch({ name: 'useChartPalette', displayName: 'Use Report Palette', displayNameKey: 'RadarChartSettings_DisplayName_0027', value: true });

  name = 'radarAppearance';
  displayName = 'Series';
  displayNameKey = 'RadarChartSettings_DisplayName_0002';
  slices = [this.fillOpacity, this.areaOpacity, this.lineWidth, this.showDots, this.dotRadius, this.dotBorderColor, this.dotBorderWidth, this.useChartPalette];
}

// -- Card Style ---------------------------------------------------------------

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style', displayNameKey: 'RadarChartSettings_DisplayName_0028',
    items: CARD_STYLE_MODE_ITEMS,
    value: { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'RadarChartSettings_DisplayName_0033' },
  });

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background Color', displayNameKey: 'RadarChartSettings_DisplayName_0034',
    value: { value: '' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Background Opacity (%)', displayNameKey: 'RadarChartSettings_DisplayName_0035',
    value: 85,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius', displayNameKey: 'RadarChartSettings_DisplayName_0036',
    value: 12,
  });

  contentPadding = new formattingSettings.NumUpDown({
    name: 'contentPadding',
    displayName: 'Content Padding', displayNameKey: 'RadarChartSettings_DisplayName_0037',
    value: 40,
  });

  name = 'cardSettings';
  displayName = 'Card Style';
  displayNameKey = 'RadarChartSettings_DisplayName_0003';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.contentPadding];
}

class AnimationSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({ name: 'enabled', displayName: 'Enable Animations', displayNameKey: 'RadarChartSettings_DisplayName_0038', value: true });
  duration = new formattingSettings.NumUpDown({ name: 'duration', displayName: 'Duration (ms)', displayNameKey: 'RadarChartSettings_DisplayName_0039', value: 600 });
  name = 'animationSettings';
  displayName = 'Animation';
  displayNameKey = 'RadarChartSettings_DisplayName_0004';
  slices = [this.enabled, this.duration];
}

// -- Radar Benchmark Settings -------------------------------------------------

class RadarBenchmarkSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Benchmark', displayNameKey: 'RadarChartSettings_DisplayName_0040',
    value: false,
  });

  dashPattern = new formattingSettings.ItemDropdown({
    name: 'dashPattern',
    displayName: 'Dash Pattern', displayNameKey: 'RadarChartSettings_DisplayName_0041',
    items: [
      { value: 'solid', displayName: 'Solid', displayNameKey: 'RadarChartSettings_DisplayName_0042' },
      { value: 'dashed', displayName: 'Dashed', displayNameKey: 'RadarChartSettings_DisplayName_0043' },
      { value: 'dotted', displayName: 'Dotted', displayNameKey: 'RadarChartSettings_DisplayName_0044' },
    ],
    value: { value: 'dashed', displayName: 'Dashed', displayNameKey: 'RadarChartSettings_DisplayName_0045' },
  });

  color = new formattingSettings.ColorPicker({
    name: 'color',
    displayName: 'Benchmark Color', displayNameKey: 'RadarChartSettings_DisplayName_0046',
    value: { value: '#94A3B8' },
  });

  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width', displayNameKey: 'RadarChartSettings_DisplayName_0047',
    value: 2,
  });

  name = 'radarBenchmarkSettings';
  displayName = 'Benchmark';
  displayNameKey = 'RadarChartSettings_DisplayName_0005';
  slices = [this.show, this.dashPattern, this.color, this.lineWidth];
}

// -- Radar Interaction Settings -----------------------------------------------

class RadarInteractionSettings extends formattingSettings.SimpleCard {
  hoverDim = new formattingSettings.ToggleSwitch({
    name: 'hoverDim',
    displayName: 'Dim on Hover', displayNameKey: 'RadarChartSettings_DisplayName_0048',
    value: false,
  });

  name = 'radarInteractionSettings';
  displayName = 'Interaction';
  displayNameKey = 'RadarChartSettings_DisplayName_0006';
  slices = [this.hoverDim];
}

export class RadarChartSettings extends formattingSettings.Model {
  radarSettings = new RadarLayoutSettings();
  radarAppearance = new RadarAppearanceSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();
  radarBenchmarkSettings = new RadarBenchmarkSettings();
  radarInteractionSettings = new RadarInteractionSettings();
  axisFormattingCard = new RadarAxisFormattingCard();
  legendFormattingCard = new LegendFormattingCard();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  seriesFormattingCard = new SeriesFormattingCard();
  numberFormattingCard = new NumberFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();
  cards = [
    this.radarSettings,
    this.radarAppearance,
    this.seriesFormattingCard,
    this.dataLabelFormattingCard,
    this.axisFormattingCard,
    this.radarBenchmarkSettings,
    this.legendFormattingCard,
    this.titleFormattingCard,
    this.conditionalFormattingCard,
    this.colorThemeFormattingCard,
    this.numberFormattingCard,
    this.animationSettings,
    this.radarInteractionSettings,
    this.cardSettings,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
