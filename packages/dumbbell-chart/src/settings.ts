/**
 * Dumbbell Chart — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ScrollFormattingCard, SortFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard,
  SeriesFormattingCard,
  NumberFormattingCard,
  DateFilterFormattingCard,
} from '../../core/src';

// -- Dumbbell Dots --------------------------------------------------------

class DumbbellDotSettings extends formattingSettings.SimpleCard {
  dotRadius = new formattingSettings.NumUpDown({
    name: 'dotRadius',
    displayName: 'Dot Radius',
    value: 6,
  });

  dotStrokeColor = new formattingSettings.ColorPicker({
    name: 'dotStrokeColor',
    displayName: 'Dot Stroke Color',
    value: { value: '' },
  });

  dotStrokeWidth = new formattingSettings.NumUpDown({
    name: 'dotStrokeWidth',
    displayName: 'Dot Stroke Width',
    value: 1.5,
  });

  startColor = new formattingSettings.ColorPicker({
    name: 'startColor',
    displayName: 'Start Color',
    value: { value: '' },
  });

  endColor = new formattingSettings.ColorPicker({
    name: 'endColor',
    displayName: 'End Color',
    value: { value: '' },
  });

  name = 'dumbbellSettings';
  displayName = 'Dumbbell Dots';
  slices = [this.dotRadius, this.dotStrokeColor, this.dotStrokeWidth, this.startColor, this.endColor];
}

// -- Connector Line -------------------------------------------------------

class DumbbellConnectorSettings extends formattingSettings.SimpleCard {
  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width',
    value: 2,
  });

  lineColor = new formattingSettings.ColorPicker({
    name: 'lineColor',
    displayName: 'Line Color',
    value: { value: '' },
  });

  showArrow = new formattingSettings.ToggleSwitch({
    name: 'showArrow',
    displayName: 'Connector Arrow',
    value: false,
  });

  autoDirectionalColor = new formattingSettings.ToggleSwitch({
    name: 'autoDirectionalColor',
    displayName: 'Auto Directional Color',
    value: false,
  });

  name = 'dumbbellConnectorSettings';
  displayName = 'Connector Line';
  slices = [this.lineWidth, this.lineColor, this.showArrow, this.autoDirectionalColor];
}

// -- Delta Label Settings -------------------------------------------------

class DeltaLabelSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Delta Labels',
    value: true,
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size',
    value: 10,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color',
    value: { value: '' },
  });

  format = new formattingSettings.ItemDropdown({
    name: 'format',
    displayName: 'Format',
    items: [
      { value: 'absolute', displayName: 'Absolute' },
      { value: 'percent', displayName: 'Percent' },
      { value: 'both', displayName: 'Both' },
    ],
    value: { value: 'absolute', displayName: 'Absolute' },
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
    value: { value: 'normal', displayName: 'Normal' },
  });

  position = new formattingSettings.ItemDropdown({
    name: 'position',
    displayName: 'Position',
    items: [
      { value: 'above', displayName: 'Above' },
      { value: 'center', displayName: 'Center' },
      { value: 'below', displayName: 'Below' },
    ],
    value: { value: 'above', displayName: 'Above' },
  });

  name = 'deltaLabelSettings';
  displayName = 'Delta Labels';
  slices = [this.show, this.fontSize, this.fontColor, this.fontFamily, this.fontWeight, this.format, this.position];
}

// -- Display Options ------------------------------------------------------

class DumbbellDisplaySettingsCard extends formattingSettings.SimpleCard {
  showRanking = new formattingSettings.ToggleSwitch({
    name: 'showRanking',
    displayName: 'Show Ranking',
    value: false,
  });

  enableGrouping = new formattingSettings.ToggleSwitch({
    name: 'enableGrouping',
    displayName: 'Enable Grouping',
    value: false,
  });

  separatorColor = new formattingSettings.ColorPicker({
    name: 'separatorColor',
    displayName: 'Separator Color',
    value: { value: '#E2E8F0' },
  });

  separatorWidth = new formattingSettings.NumUpDown({
    name: 'separatorWidth',
    displayName: 'Separator Width',
    value: 0.5,
  });

  name = 'dumbbellDisplaySettings';
  displayName = 'Display Options';
  slices = [this.showRanking, this.enableGrouping, this.separatorColor, this.separatorWidth];
}

// -- Dumbbell Axis Card (extends shared AxisFormattingCard with show/hide) ----

class DumbbellAxisFormattingCard extends AxisFormattingCard {
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

  constructor() {
    super();
    // Prepend show/hide toggles before the inherited slices
    this.slices = [this.showXAxis, this.showYAxis, ...this.slices];
  }
}

// -- Card Style -----------------------------------------------------------

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

// -- Animation Settings ---------------------------------------------------

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

// -- Root Model -----------------------------------------------------------

export class DumbbellChartSettings extends formattingSettings.Model {
  dumbbellSettings = new DumbbellDotSettings();
  dumbbellConnectorSettings = new DumbbellConnectorSettings();
  deltaLabelSettings = new DeltaLabelSettings();
  dumbbellDisplaySettings = new DumbbellDisplaySettingsCard();

  axisFormattingCard = new DumbbellAxisFormattingCard();
  legendFormattingCard = new LegendFormattingCard();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  scrollFormattingCard = new ScrollFormattingCard();

  constructor() {
    super();
    this.scrollFormattingCard.minCategoryWidth.value = 30;
  }

  sortFormattingCard = new SortFormattingCard();
  colorThemeFormattingCard = new ColorThemeFormattingCard();
  seriesFormattingCard = new SeriesFormattingCard();
  numberFormattingCard = new NumberFormattingCard();
  referenceLineFormattingCard = new ReferenceLineFormattingCard();
  trendLineFormattingCard = new TrendLineFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  animationSettings = new AnimationSettingsCard();
  cardSettings = new CardStyleSettings();
  dateFilterFormattingCard = new DateFilterFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  cards = [
    this.dumbbellSettings,
    this.dumbbellConnectorSettings,
    this.deltaLabelSettings,
    this.dumbbellDisplaySettings,
    this.axisFormattingCard,
    this.legendFormattingCard,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.scrollFormattingCard,
    this.sortFormattingCard,
    this.colorThemeFormattingCard,
    this.seriesFormattingCard,
    this.numberFormattingCard,
    this.referenceLineFormattingCard,
    this.trendLineFormattingCard,
    this.conditionalFormattingCard,
    this.animationSettings,
    this.cardSettings,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
