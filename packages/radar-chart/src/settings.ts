import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard,
  SeriesFormattingCard, NumberFormattingCard,
  DateFilterFormattingCard,
} from '../../core/src';

// -- Grid & Web: grid configuration and web stroke settings -------------------

class RadarLayoutSettings extends formattingSettings.SimpleCard {
  showGrid = new formattingSettings.ToggleSwitch({ name: 'showGrid', displayName: 'Show Grid', value: true });
  gridLevels = new formattingSettings.NumUpDown({ name: 'gridLevels', displayName: 'Grid Levels', value: 5 });

  gridShape = new formattingSettings.ItemDropdown({
    name: 'gridShape',
    displayName: 'Grid Shape',
    items: [
      { value: 'polygon', displayName: 'Polygon' },
      { value: 'circle', displayName: 'Circle' },
    ],
    value: { value: 'polygon', displayName: 'Polygon' },
  });

  webStrokeColor = new formattingSettings.ColorPicker({
    name: 'webStrokeColor',
    displayName: 'Web Stroke Color',
    value: { value: '' },
  });
  webStrokeWidth = new formattingSettings.NumUpDown({
    name: 'webStrokeWidth',
    displayName: 'Web Stroke Width',
    value: 1,
  });
  webFillOpacity = new formattingSettings.NumUpDown({
    name: 'webFillOpacity',
    displayName: 'Web Fill Opacity (%)',
    value: 15,
  });

  showAxisLabels = new formattingSettings.ToggleSwitch({
    name: 'showAxisLabels',
    displayName: 'Show Axis Labels',
    value: true,
  });

  showAxisValues = new formattingSettings.ToggleSwitch({
    name: 'showAxisValues',
    displayName: 'Show Axis Values',
    value: false,
  });

  startAngle = new formattingSettings.NumUpDown({
    name: 'startAngle',
    displayName: 'Start Angle (degrees)',
    value: 0,
  });

  independentScales = new formattingSettings.ToggleSwitch({
    name: 'independentScales',
    displayName: 'Independent Axis Scales',
    value: false,
  });

  name = 'radarSettings';
  displayName = 'Grid & Web';
  slices = [this.showGrid, this.gridLevels, this.gridShape, this.webStrokeColor, this.webStrokeWidth, this.webFillOpacity, this.showAxisLabels, this.showAxisValues, this.startAngle, this.independentScales];
}

// -- Series Appearance: fill, dots, area, palette -----------------------------

class RadarAppearanceSettings extends formattingSettings.SimpleCard {
  fillOpacity = new formattingSettings.NumUpDown({ name: 'fillOpacity', displayName: 'Fill Opacity (%)', value: 25 });
  areaOpacity = new formattingSettings.NumUpDown({
    name: 'areaOpacity',
    displayName: 'Area Opacity (%)',
    value: 30,
  });
  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width',
    value: 2,
  });
  showDots = new formattingSettings.ToggleSwitch({ name: 'showDots', displayName: 'Show Dots', value: true });
  dotRadius = new formattingSettings.NumUpDown({ name: 'dotRadius', displayName: 'Dot Radius', value: 4 });
  dotBorderColor = new formattingSettings.ColorPicker({
    name: 'dotBorderColor',
    displayName: 'Dot Border Color',
    value: { value: '#FFFFFF' },
  });
  dotBorderWidth = new formattingSettings.NumUpDown({
    name: 'dotBorderWidth',
    displayName: 'Dot Border Width',
    value: 1,
  });
  useChartPalette = new formattingSettings.ToggleSwitch({ name: 'useChartPalette', displayName: 'Use Chart Palette', value: true });

  name = 'radarAppearance';
  displayName = 'Series Appearance';
  slices = [this.fillOpacity, this.areaOpacity, this.lineWidth, this.showDots, this.dotRadius, this.dotBorderColor, this.dotBorderWidth, this.useChartPalette];
}

// -- Card Style ---------------------------------------------------------------

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

class AnimationSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({ name: 'enabled', displayName: 'Enable Animations', value: true });
  duration = new formattingSettings.NumUpDown({ name: 'duration', displayName: 'Duration (ms)', value: 600 });
  name = 'animationSettings';
  displayName = 'Animation';
  slices = [this.enabled, this.duration];
}

// -- Radar Benchmark Settings -------------------------------------------------

class RadarBenchmarkSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Benchmark',
    value: false,
  });

  dashPattern = new formattingSettings.ItemDropdown({
    name: 'dashPattern',
    displayName: 'Dash Pattern',
    items: [
      { value: 'solid', displayName: 'Solid' },
      { value: 'dashed', displayName: 'Dashed' },
      { value: 'dotted', displayName: 'Dotted' },
    ],
    value: { value: 'dashed', displayName: 'Dashed' },
  });

  color = new formattingSettings.ColorPicker({
    name: 'color',
    displayName: 'Benchmark Color',
    value: { value: '#94A3B8' },
  });

  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width',
    value: 2,
  });

  name = 'radarBenchmarkSettings';
  displayName = 'Benchmark';
  slices = [this.show, this.dashPattern, this.color, this.lineWidth];
}

// -- Radar Interaction Settings -----------------------------------------------

class RadarInteractionSettings extends formattingSettings.SimpleCard {
  hoverDim = new formattingSettings.ToggleSwitch({
    name: 'hoverDim',
    displayName: 'Dim on Hover',
    value: false,
  });

  name = 'radarInteractionSettings';
  displayName = 'Interaction';
  slices = [this.hoverDim];
}

export class RadarChartSettings extends formattingSettings.Model {
  radarSettings = new RadarLayoutSettings();
  radarAppearance = new RadarAppearanceSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();
  radarBenchmarkSettings = new RadarBenchmarkSettings();
  radarInteractionSettings = new RadarInteractionSettings();
  axisFormattingCard = new AxisFormattingCard();
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
    this.axisFormattingCard,
    this.radarBenchmarkSettings,
    this.titleFormattingCard,
    this.legendFormattingCard,
    this.dataLabelFormattingCard,
    this.conditionalFormattingCard,
    this.seriesFormattingCard,
    this.cardSettings,
    this.colorThemeFormattingCard,
    this.animationSettings,
    this.radarInteractionSettings,
    this.numberFormattingCard,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
