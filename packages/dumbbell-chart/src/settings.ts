/**
 * Dumbbell Chart — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ScrollFormattingCard, SortFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard,
  SeriesFormattingCard,
  NumberFormattingCard,
  DateFilterFormattingCard,
  CARD_STYLE_MODE_ITEMS
} from '../../core/src';

// -- Dumbbell Dots --------------------------------------------------------

class DumbbellDotSettings extends formattingSettings.SimpleCard {
  dotRadius = new formattingSettings.NumUpDown({
    name: 'dotRadius',
    displayName: 'Dot Radius', displayNameKey: 'DumbbellChartSettings_DisplayName_0008',
    value: 6,
  });

  dotStrokeColor = new formattingSettings.ColorPicker({
    name: 'dotStrokeColor',
    displayName: 'Dot Stroke Color', displayNameKey: 'DumbbellChartSettings_DisplayName_0009',
    value: { value: '' },
  });

  dotStrokeWidth = new formattingSettings.NumUpDown({
    name: 'dotStrokeWidth',
    displayName: 'Dot Stroke Width', displayNameKey: 'DumbbellChartSettings_DisplayName_0010',
    value: 1.5,
  });

  startColor = new formattingSettings.ColorPicker({
    name: 'startColor',
    displayName: 'Start Color', displayNameKey: 'DumbbellChartSettings_DisplayName_0011',
    value: { value: '' },
  });

  endColor = new formattingSettings.ColorPicker({
    name: 'endColor',
    displayName: 'End Color', displayNameKey: 'DumbbellChartSettings_DisplayName_0012',
    value: { value: '' },
  });

  name = 'dumbbellSettings';
  displayName = 'Dumbbell Dots';
  displayNameKey = 'DumbbellChartSettings_DisplayName_0001';
  slices = [this.dotRadius, this.dotStrokeColor, this.dotStrokeWidth, this.startColor, this.endColor];
}

// -- Connector Line -------------------------------------------------------

class DumbbellConnectorSettings extends formattingSettings.SimpleCard {
  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width', displayNameKey: 'DumbbellChartSettings_DisplayName_0013',
    value: 2,
  });

  lineColor = new formattingSettings.ColorPicker({
    name: 'lineColor',
    displayName: 'Line Color', displayNameKey: 'DumbbellChartSettings_DisplayName_0014',
    value: { value: '' },
  });

  showArrow = new formattingSettings.ToggleSwitch({
    name: 'showArrow',
    displayName: 'Show Connector Arrow', displayNameKey: 'DumbbellChartSettings_DisplayName_0015',
    value: false,
  });

  autoDirectionalColor = new formattingSettings.ToggleSwitch({
    name: 'autoDirectionalColor',
    displayName: 'Color Arrow by Direction', displayNameKey: 'DumbbellChartSettings_DisplayName_0016',
    value: false,
  });

  name = 'dumbbellConnectorSettings';
  displayName = 'Connector Line';
  displayNameKey = 'DumbbellChartSettings_DisplayName_0002';
  slices = [this.lineWidth, this.lineColor, this.showArrow, this.autoDirectionalColor];
}

// -- Delta Label Settings -------------------------------------------------

class DeltaLabelSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Delta Labels', displayNameKey: 'DumbbellChartSettings_DisplayName_0017',
    value: true,
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size', displayNameKey: 'DumbbellChartSettings_DisplayName_0018',
    value: 10,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color', displayNameKey: 'DumbbellChartSettings_DisplayName_0019',
    value: { value: '' },
  });

  format = new formattingSettings.ItemDropdown({
    name: 'format',
    displayName: 'Format', displayNameKey: 'DumbbellChartSettings_DisplayName_0020',
    items: [
      { value: 'absolute', displayName: 'Absolute', displayNameKey: 'DumbbellChartSettings_DisplayName_0021' },
      { value: 'percent', displayName: 'Percent', displayNameKey: 'DumbbellChartSettings_DisplayName_0022' },
      { value: 'both', displayName: 'Both', displayNameKey: 'DumbbellChartSettings_DisplayName_0023' },
    ],
    value: { value: 'absolute', displayName: 'Absolute', displayNameKey: 'DumbbellChartSettings_DisplayName_0024' },
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Font', displayNameKey: 'DumbbellChartSettings_DisplayName_0025',
    items: [
      { value: '', displayName: 'Default', displayNameKey: 'DumbbellChartSettings_DisplayName_0026' },
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'DumbbellChartSettings_DisplayName_0027' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'DumbbellChartSettings_DisplayName_0028' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'DumbbellChartSettings_DisplayName_0029' },
      { value: 'Helvetica Neue', displayName: 'Helvetica Neue', displayNameKey: 'DumbbellChartSettings_DisplayName_0030' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'DumbbellChartSettings_DisplayName_0031' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'DumbbellChartSettings_DisplayName_0032' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'DumbbellChartSettings_DisplayName_0033' },
    ],
    value: { value: '', displayName: 'Default', displayNameKey: 'DumbbellChartSettings_DisplayName_0034' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Font Weight', displayNameKey: 'DumbbellChartSettings_DisplayName_0035',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'DumbbellChartSettings_DisplayName_0036' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'DumbbellChartSettings_DisplayName_0037' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'DumbbellChartSettings_DisplayName_0038' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'DumbbellChartSettings_DisplayName_0039' },
  });

  position = new formattingSettings.ItemDropdown({
    name: 'position',
    displayName: 'Position', displayNameKey: 'DumbbellChartSettings_DisplayName_0040',
    items: [
      { value: 'above', displayName: 'Above', displayNameKey: 'DumbbellChartSettings_DisplayName_0041' },
      { value: 'center', displayName: 'Center', displayNameKey: 'DumbbellChartSettings_DisplayName_0042' },
      { value: 'below', displayName: 'Below', displayNameKey: 'DumbbellChartSettings_DisplayName_0043' },
    ],
    value: { value: 'above', displayName: 'Above', displayNameKey: 'DumbbellChartSettings_DisplayName_0044' },
  });

  name = 'deltaLabelSettings';
  displayName = 'Delta Labels';
  displayNameKey = 'DumbbellChartSettings_DisplayName_0003';
  slices = [this.show, this.fontSize, this.fontColor, this.fontFamily, this.fontWeight, this.format, this.position];
}

// -- Display Options ------------------------------------------------------

class DumbbellDisplaySettingsCard extends formattingSettings.SimpleCard {
  showRanking = new formattingSettings.ToggleSwitch({
    name: 'showRanking',
    displayName: 'Show Change Ranking', displayNameKey: 'DumbbellChartSettings_DisplayName_0045',
    value: false,
  });

  enableGrouping = new formattingSettings.ToggleSwitch({
    name: 'enableGrouping',
    displayName: 'Group by First Letter', displayNameKey: 'DumbbellChartSettings_DisplayName_0046',
    value: false,
  });

  separatorColor = new formattingSettings.ColorPicker({
    name: 'separatorColor',
    displayName: 'Separator Color', displayNameKey: 'DumbbellChartSettings_DisplayName_0047',
    value: { value: '#E2E8F0' },
  });

  separatorWidth = new formattingSettings.NumUpDown({
    name: 'separatorWidth',
    displayName: 'Separator Width', displayNameKey: 'DumbbellChartSettings_DisplayName_0048',
    value: 0.5,
  });

  name = 'dumbbellDisplaySettings';
  displayName = 'Display Options';
  displayNameKey = 'DumbbellChartSettings_DisplayName_0004';
  slices = [this.showRanking, this.enableGrouping, this.separatorColor, this.separatorWidth];
}

// -- Layout Settings ------------------------------------------------------

class LayoutSettingsCard extends formattingSettings.SimpleCard {
  containerPadding = new formattingSettings.NumUpDown({
    name: 'containerPadding',
    displayName: 'Container Padding', displayNameKey: 'DumbbellChartSettings_DisplayName_0049',
    value: 8,
  });

  categoryPaddingInner = new formattingSettings.NumUpDown({
    name: 'categoryPaddingInner',
    displayName: 'Category Padding (Inner)', displayNameKey: 'DumbbellChartSettings_DisplayName_0050',
    value: 0.3,
  });

  categoryPaddingOuter = new formattingSettings.NumUpDown({
    name: 'categoryPaddingOuter',
    displayName: 'Category Padding (Outer)', displayNameKey: 'DumbbellChartSettings_DisplayName_0051',
    value: 0.15,
  });

  name = 'layoutSettings';
  displayName = 'Layout';
  displayNameKey = 'DumbbellChartSettings_DisplayName_0005';
  slices = [this.containerPadding, this.categoryPaddingInner, this.categoryPaddingOuter];
}

// -- Dumbbell Axis Card (extends shared AxisFormattingCard with show/hide) ----

class DumbbellAxisFormattingCard extends AxisFormattingCard {
  showXAxis = new formattingSettings.ToggleSwitch({
    name: 'showXAxis',
    displayName: 'Show X-Axis', displayNameKey: 'DumbbellChartSettings_DisplayName_0052',
    value: true,
  });

  showYAxis = new formattingSettings.ToggleSwitch({
    name: 'showYAxis',
    displayName: 'Show Y-Axis', displayNameKey: 'DumbbellChartSettings_DisplayName_0053',
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
    displayName: 'Card Style', displayNameKey: 'DumbbellChartSettings_DisplayName_0054',
    items: CARD_STYLE_MODE_ITEMS,
    value: { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'DumbbellChartSettings_DisplayName_0059' },
  });

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background Color', displayNameKey: 'DumbbellChartSettings_DisplayName_0060',
    value: { value: '' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Background Opacity (%)', displayNameKey: 'DumbbellChartSettings_DisplayName_0061',
    value: 85,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius', displayNameKey: 'DumbbellChartSettings_DisplayName_0062',
    value: 12,
  });

  contentPadding = new formattingSettings.NumUpDown({
    name: 'contentPadding',
    displayName: 'Content Padding', displayNameKey: 'DumbbellChartSettings_DisplayName_0065',
    value: 8,
  });

  name = 'cardSettings';
  displayName = 'Card Style';
  displayNameKey = 'DumbbellChartSettings_DisplayName_0006';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.contentPadding];
}

class CategoryStylesFormattingCard extends SeriesFormattingCard {
  displayName = 'Category Styles';
  displayNameKey = 'DumbbellChartSettings_DisplayName_0066';
}

// -- Animation Settings ---------------------------------------------------

class AnimationSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Animations', displayNameKey: 'DumbbellChartSettings_DisplayName_0063',
    value: true,
  });

  duration = new formattingSettings.NumUpDown({
    name: 'duration',
    displayName: 'Duration (ms)', displayNameKey: 'DumbbellChartSettings_DisplayName_0064',
    value: 600,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  displayNameKey = 'DumbbellChartSettings_DisplayName_0007';
  slices = [this.enabled, this.duration];
}

// -- Root Model -----------------------------------------------------------

export class DumbbellChartSettings extends formattingSettings.Model {
  dumbbellSettings = new DumbbellDotSettings();
  dumbbellConnectorSettings = new DumbbellConnectorSettings();
  deltaLabelSettings = new DeltaLabelSettings();
  dumbbellDisplaySettings = new DumbbellDisplaySettingsCard();
  layoutSettings = new LayoutSettingsCard();

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
  seriesFormattingCard = new CategoryStylesFormattingCard();
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
    this.layoutSettings,
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
