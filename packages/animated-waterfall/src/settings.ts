/**
 * Animated Waterfall Chart — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ScrollFormattingCard, NumberFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, AnnotationFormattingCard, AccessibilityFormattingCard,
  ColorThemeFormattingCard,
  DateFilterFormattingCard,
  CARD_STYLE_MODE_ITEMS
} from '../../core/src';
// -- Waterfall Settings -------------------------------------------------------

class WaterfallSettingsCard extends formattingSettings.SimpleCard {
  showConnectors = new formattingSettings.ToggleSwitch({
    name: 'showConnectors',
    displayName: 'Show Connectors', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0013',
    value: true,
  });

  barWidth = new formattingSettings.NumUpDown({
    name: 'barWidth',
    displayName: 'Bar Width', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0014',
    value: 60,
  });

  outerPadding = new formattingSettings.NumUpDown({
    name: 'outerPadding',
    displayName: 'Outer Padding', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0015',
    value: 8,
  });


  barCornerRadius = new formattingSettings.NumUpDown({

    name: 'barCornerRadius',

    displayName: 'Bar Corner Radius', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0016',

    value: 3,

  });

  barBorderColor = new formattingSettings.ColorPicker({

    name: 'barBorderColor',

    displayName: 'Bar Border Color', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0017',

    value: { value: '' },

  });

  barBorderWidth = new formattingSettings.NumUpDown({

    name: 'barBorderWidth',

    displayName: 'Bar Border Width', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0018',

    value: 0,

  });


  name = 'waterfallSettings';
  displayName = 'Waterfall Settings';
  displayNameKey = 'AnimatedWaterfallSettings_DisplayName_0001';
  slices = [this.showConnectors, this.barWidth, this.outerPadding, this.barCornerRadius, this.barBorderColor, this.barBorderWidth];
}

// -- Color Settings -----------------------------------------------------------

class ColorSettingsCard extends formattingSettings.SimpleCard {
  positiveColor = new formattingSettings.ColorPicker({
    name: 'positiveColor',
    displayName: 'Positive Color', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0019',
    value: { value: '#34D399' },
  });

  negativeColor = new formattingSettings.ColorPicker({
    name: 'negativeColor',
    displayName: 'Negative Color', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0020',
    value: { value: '#F87171' },
  });

  name = 'colorSettings';
  displayName = 'Colors';
  displayNameKey = 'AnimatedWaterfallSettings_DisplayName_0002';
  slices = [this.positiveColor, this.negativeColor];
}

// -- Value Labels -------------------------------------------------------------

class ValueSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Values', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0022',
    value: true,
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0023',
    value: 11,
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Font Family', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0024',
    items: [
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0025' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0026' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0027' },
      { value: 'Helvetica', displayName: 'Helvetica', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0028' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0029' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0030' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0031' },
    ],
    value: { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0032' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Font Weight', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0033',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0034' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0035' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0036' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0037' },
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0038',
    value: { value: '' },
  });

  name = 'valueSettings';
  displayName = 'Value Labels';
  displayNameKey = 'AnimatedWaterfallSettings_DisplayName_0003';
  slices = [this.show, this.fontSize, this.fontColor, this.fontFamily, this.fontWeight];
}

// -- Card Style ---------------------------------------------------------------

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0041',
    items: CARD_STYLE_MODE_ITEMS,
    value: { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0046' },
  });

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background Color', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0047',
    value: { value: '' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Background Opacity (%)', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0048',
    value: 35,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0049',
    value: 12,
  });

  contentPadding = new formattingSettings.NumUpDown({
    name: 'contentPadding',
    displayName: 'Content Padding', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0111',
    value: 8,
  });

  name = 'cardSettings';
  displayName = 'Card Style';
  displayNameKey = 'AnimatedWaterfallSettings_DisplayName_0005';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.contentPadding];
}

// -- Animation Settings -------------------------------------------------------

class AnimationSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Animations', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0050',
    value: true,
  });

  duration = new formattingSettings.NumUpDown({
    name: 'duration',
    displayName: 'Duration (ms)', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0051',
    value: 600,
  });

  staggerDelay = new formattingSettings.NumUpDown({
    name: 'staggerDelay',
    displayName: 'Stagger Delay (ms)', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0052',
    value: 50,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  displayNameKey = 'AnimatedWaterfallSettings_DisplayName_0006';
  slices = [this.enabled, this.duration, this.staggerDelay];
}

// -- Subtotal Settings --------------------------------------------------------

class SubtotalSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Subtotals', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0053',
    value: false,
  });

  subtotalColor = new formattingSettings.ColorPicker({
    name: 'subtotalColor',
    displayName: 'Subtotal Color', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0054',
    value: { value: '#6366F1' },
  });

  subtotalLabel = new formattingSettings.TextInput({
    name: 'subtotalLabel',
    displayName: 'Subtotal Label', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0055',
    value: 'Subtotal',
    placeholder: 'Subtotal', placeholderKey: 'AnimatedWaterfallSettings_Placeholder_0001',
  });

  indices = new formattingSettings.TextInput({
    name: 'indices',
    displayName: 'Subtotal After Positions', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0056',
    value: '',
    placeholder: 'e.g. 3,7,12', placeholderKey: 'AnimatedWaterfallSettings_Placeholder_0002',
  });

  name = 'subtotalSettings';
  displayName = 'Subtotals';
  displayNameKey = 'AnimatedWaterfallSettings_DisplayName_0007';
  slices = [this.enabled, this.subtotalColor, this.subtotalLabel, this.indices];
}

// -- Drill-Down Settings ------------------------------------------------------

class DrillDownSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Drill-Down', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0057',
    value: true,
  });

  showBreadcrumb = new formattingSettings.ToggleSwitch({
    name: 'showBreadcrumb',
    displayName: 'Show Breadcrumb', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0058',
    value: true,
  });

  breadcrumbFontSize = new formattingSettings.NumUpDown({
    name: 'breadcrumbFontSize',
    displayName: 'Breadcrumb Font Size', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0059',
    value: 11,
  });

  breadcrumbColor = new formattingSettings.ColorPicker({
    name: 'breadcrumbColor',
    displayName: 'Breadcrumb Color', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0060',
    value: { value: '#64748B' },
  });

  breadcrumbFontFamily = new formattingSettings.ItemDropdown({
    name: 'breadcrumbFontFamily',
    displayName: 'Breadcrumb Font Family', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0061',
    items: [
      { value: '', displayName: 'Default', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0062' },
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0063' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0064' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0065' },
      { value: 'Helvetica Neue', displayName: 'Helvetica Neue', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0066' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0067' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0068' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0069' },
    ],
    value: { value: '', displayName: 'Default', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0070' },
  });

  breadcrumbFontWeight = new formattingSettings.ItemDropdown({
    name: 'breadcrumbFontWeight',
    displayName: 'Breadcrumb Font Weight', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0071',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0072' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0073' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0074' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0075' },
  });

  breadcrumbPadding = new formattingSettings.NumUpDown({
    name: 'breadcrumbPadding',
    displayName: 'Breadcrumb Padding', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0076',
    value: 8,
  });

  name = 'drillDownSettings';
  displayName = 'Drill-Down';
  displayNameKey = 'AnimatedWaterfallSettings_DisplayName_0008';
  slices = [
    this.enabled,
    this.showBreadcrumb,
    this.breadcrumbFontSize,
    this.breadcrumbColor,
    this.breadcrumbFontFamily,
    this.breadcrumbFontWeight,
    this.breadcrumbPadding,
  ];
}

// -- Waterfall Total Bar Settings ---------------------------------------------

class WaterfallTotalBarSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Total Bar', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0077',
    value: true,
  });

  label = new formattingSettings.TextInput({
    name: 'label',
    displayName: 'Total Label', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0078',
    value: 'Total',
    placeholder: 'Total', placeholderKey: 'AnimatedWaterfallSettings_Placeholder_0003',
  });

  color = new formattingSettings.ColorPicker({
    name: 'color',
    displayName: 'Total Bar Color', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0079',
    value: { value: '#3B82F6' },
  });

  name = 'waterfallTotalBar';
  displayName = 'Total Bar';
  displayNameKey = 'AnimatedWaterfallSettings_DisplayName_0009';
  slices = [this.show, this.label, this.color];
}

// -- Waterfall Summary Settings -----------------------------------------------

class WaterfallSummarySettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Summary Banner', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0080',
    value: false,
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0081',
    value: 11,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0082',
    value: { value: '' },
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Font Family', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0083',
    items: [
      { value: '', displayName: 'Default', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0084' },
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0085' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0086' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0087' },
      { value: 'Helvetica Neue', displayName: 'Helvetica Neue', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0088' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0089' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0090' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0091' },
    ],
    value: { value: '', displayName: 'Default', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0092' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Font Weight', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0093',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0094' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0095' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0096' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0097' },
  });

  alignment = new formattingSettings.ItemDropdown({
    name: 'alignment',
    displayName: 'Alignment', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0098',
    items: [
      { value: 'left', displayName: 'Left', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0099' },
      { value: 'center', displayName: 'Center', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0100' },
      { value: 'right', displayName: 'Right', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0101' },
    ],
    value: { value: 'center', displayName: 'Center', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0102' },
  });

  paddingTop = new formattingSettings.NumUpDown({
    name: 'paddingTop',
    displayName: 'Top Padding', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0103',
    value: 4,
  });

  name = 'waterfallSummary';
  displayName = 'Summary Metrics';
  displayNameKey = 'AnimatedWaterfallSettings_DisplayName_0010';
  slices = [this.show, this.fontSize, this.fontColor, this.fontFamily, this.fontWeight, this.alignment, this.paddingTop];
}

// -- Waterfall Sort Settings --------------------------------------------------

class WaterfallSortSettings extends formattingSettings.SimpleCard {
  sortByContribution = new formattingSettings.ToggleSwitch({
    name: 'sortByContribution',
    displayName: 'Sort by Contribution', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0104',
    value: false,
  });

  name = 'waterfallSort';
  displayName = 'Sort';
  displayNameKey = 'AnimatedWaterfallSettings_DisplayName_0011';
  slices = [this.sortByContribution];
}

// -- Root Model ---------------------------------------------------------------


class ConnectorSettings extends formattingSettings.SimpleCard {
  connectorColor = new formattingSettings.ColorPicker({
    name: 'connectorColor',
    displayName: 'Connector Color', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0105',
    value: { value: '' },
  });

  connectorWidth = new formattingSettings.NumUpDown({
    name: 'connectorWidth',
    displayName: 'Connector Width', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0106',
    value: 1,
  });

  connectorStyle = new formattingSettings.ItemDropdown({
    name: 'connectorStyle',
    displayName: 'Connector Style', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0107',
    items: [{ value: 'solid', displayName: 'Solid', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0108' }, { value: 'dashed', displayName: 'Dashed', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0109' }],
    value: { value: 'dashed', displayName: 'Dashed', displayNameKey: 'AnimatedWaterfallSettings_DisplayName_0110' },
  });

  name = 'connectorFormatting';
  displayName = 'Connector';
  displayNameKey = 'AnimatedWaterfallSettings_DisplayName_0012';
  slices = [this.connectorColor, this.connectorWidth, this.connectorStyle];
}

export class AnimatedWaterfallSettings extends formattingSettings.Model {
  waterfallSettings = new WaterfallSettingsCard();
  colorSettings = new ColorSettingsCard();
  valueSettings = new ValueSettingsCard();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettingsCard();
  drillDownSettings = new DrillDownSettingsCard();

  axisFormattingCard = new AxisFormattingCard();

  dataLabelFormattingCard = new DataLabelFormattingCard();

  titleFormattingCard = new TitleFormattingCard();

  connectorSettings = new ConnectorSettings();

  subtotalSettings = new SubtotalSettingsCard();

  scrollFormattingCard = new ScrollFormattingCard();

  constructor() {
    super();
    this.scrollFormattingCard.minCategoryWidth.value = 50;
  }

  numberFormattingCard = new NumberFormattingCard();

  referenceLineFormattingCard = new ReferenceLineFormattingCard();
  trendLineFormattingCard = new TrendLineFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  annotationFormattingCard = new AnnotationFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  waterfallTotalBar = new WaterfallTotalBarSettings();
  waterfallSummary = new WaterfallSummarySettings();
  waterfallSort = new WaterfallSortSettings();

  legendFormattingCard = new LegendFormattingCard();
  colorThemeFormattingCard = new ColorThemeFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();
  cards = [
    this.waterfallSettings,
    this.colorSettings,
    this.connectorSettings,
    this.waterfallTotalBar,
    this.subtotalSettings,
    this.animationSettings,
    this.axisFormattingCard,
    this.valueSettings,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.numberFormattingCard,
    this.waterfallSort,
    this.waterfallSummary,
    this.drillDownSettings,
    this.cardSettings,
    this.scrollFormattingCard,
    this.referenceLineFormattingCard,
    this.trendLineFormattingCard,
    this.conditionalFormattingCard,
    this.annotationFormattingCard,
    this.legendFormattingCard,
    this.colorThemeFormattingCard,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
