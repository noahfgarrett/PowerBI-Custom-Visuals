/**
 * Animated Waterfall Chart — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ScrollFormattingCard, NumberFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, AnnotationFormattingCard, AccessibilityFormattingCard,
  ColorThemeFormattingCard,
  DateFilterFormattingCard,
} from '../../core/src';
// -- Waterfall Settings -------------------------------------------------------

class WaterfallSettingsCard extends formattingSettings.SimpleCard {
  showConnectors = new formattingSettings.ToggleSwitch({
    name: 'showConnectors',
    displayName: 'Show Connectors',
    value: true,
  });

  barWidth = new formattingSettings.NumUpDown({
    name: 'barWidth',
    displayName: 'Bar Width',
    value: 60,
  });


  barCornerRadius = new formattingSettings.NumUpDown({

    name: 'barCornerRadius',

    displayName: 'Bar Corner Radius',

    value: 3,

  });

  barBorderColor = new formattingSettings.ColorPicker({

    name: 'barBorderColor',

    displayName: 'Bar Border Color',

    value: { value: '' },

  });

  barBorderWidth = new formattingSettings.NumUpDown({

    name: 'barBorderWidth',

    displayName: 'Bar Border Width',

    value: 0,

  });


  name = 'waterfallSettings';
  displayName = 'Waterfall Settings';
  slices = [this.showConnectors, this.barWidth, this.barCornerRadius, this.barBorderColor, this.barBorderWidth];
}

// -- Color Settings -----------------------------------------------------------

class ColorSettingsCard extends formattingSettings.SimpleCard {
  positiveColor = new formattingSettings.ColorPicker({
    name: 'positiveColor',
    displayName: 'Positive Color',
    value: { value: '#34D399' },
  });

  negativeColor = new formattingSettings.ColorPicker({
    name: 'negativeColor',
    displayName: 'Negative Color',
    value: { value: '#F87171' },
  });

  totalColor = new formattingSettings.ColorPicker({
    name: 'totalColor',
    displayName: 'Total Color',
    value: { value: '#3B82F6' },
  });

  name = 'colorSettings';
  displayName = 'Colors';
  slices = [this.positiveColor, this.negativeColor, this.totalColor];
}

// -- Value Labels -------------------------------------------------------------

class ValueSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Values',
    value: true,
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size',
    value: 11,
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Font Family',
    items: [
      { value: 'Segoe UI', displayName: 'Segoe UI' },
      { value: 'Arial', displayName: 'Arial' },
      { value: 'Calibri', displayName: 'Calibri' },
      { value: 'Helvetica', displayName: 'Helvetica' },
      { value: 'Times New Roman', displayName: 'Times New Roman' },
      { value: 'Verdana', displayName: 'Verdana' },
      { value: 'Georgia', displayName: 'Georgia' },
    ],
    value: { value: 'Segoe UI', displayName: 'Segoe UI' },
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

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color',
    value: { value: '' },
  });

  name = 'valueSettings';
  displayName = 'Value Labels';
  slices = [this.show, this.fontSize, this.fontColor, this.fontFamily, this.fontWeight];
}

// -- Axis Settings ------------------------------------------------------------

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

  name = 'axisSettings';
  displayName = 'Axes';
  slices = [this.showXAxis, this.showYAxis];
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
    value: 35,
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

// -- Animation Settings -------------------------------------------------------

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

// -- Subtotal Settings --------------------------------------------------------

class SubtotalSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Subtotals',
    value: false,
  });

  subtotalColor = new formattingSettings.ColorPicker({
    name: 'subtotalColor',
    displayName: 'Subtotal Color',
    value: { value: '#6366F1' },
  });

  subtotalLabel = new formattingSettings.TextInput({
    name: 'subtotalLabel',
    displayName: 'Subtotal Label',
    value: 'Subtotal',
    placeholder: 'Subtotal',
  });

  indices = new formattingSettings.TextInput({
    name: 'indices',
    displayName: 'Subtotal After Positions',
    value: '',
    placeholder: 'e.g. 3,7,12',
  });

  name = 'subtotalSettings';
  displayName = 'Subtotals';
  slices = [this.enabled, this.subtotalColor, this.subtotalLabel, this.indices];
}

// -- Drill-Down Settings ------------------------------------------------------

class DrillDownSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Drill-Down',
    value: true,
  });

  showBreadcrumb = new formattingSettings.ToggleSwitch({
    name: 'showBreadcrumb',
    displayName: 'Show Breadcrumb',
    value: true,
  });

  breadcrumbFontSize = new formattingSettings.NumUpDown({
    name: 'breadcrumbFontSize',
    displayName: 'Breadcrumb Font Size',
    value: 11,
  });

  breadcrumbColor = new formattingSettings.ColorPicker({
    name: 'breadcrumbColor',
    displayName: 'Breadcrumb Color',
    value: { value: '#64748B' },
  });

  name = 'drillDownSettings';
  displayName = 'Drill-Down';
  slices = [this.enabled, this.showBreadcrumb, this.breadcrumbFontSize, this.breadcrumbColor];
}

// -- Waterfall Total Bar Settings ---------------------------------------------

class WaterfallTotalBarSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Total Bar',
    value: true,
  });

  label = new formattingSettings.TextInput({
    name: 'label',
    displayName: 'Total Label',
    value: 'Total',
    placeholder: 'Total',
  });

  color = new formattingSettings.ColorPicker({
    name: 'color',
    displayName: 'Total Bar Color',
    value: { value: '#3B82F6' },
  });

  name = 'waterfallTotalBar';
  displayName = 'Total Bar';
  slices = [this.show, this.label, this.color];
}

// -- Waterfall Summary Settings -----------------------------------------------

class WaterfallSummarySettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Summary Banner',
    value: false,
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size',
    value: 11,
  });

  name = 'waterfallSummary';
  displayName = 'Summary Metrics';
  slices = [this.show, this.fontSize];
}

// -- Waterfall Sort Settings --------------------------------------------------

class WaterfallSortSettings extends formattingSettings.SimpleCard {
  sortByContribution = new formattingSettings.ToggleSwitch({
    name: 'sortByContribution',
    displayName: 'Sort by Contribution',
    value: false,
  });

  name = 'waterfallSort';
  displayName = 'Sort';
  slices = [this.sortByContribution];
}

// -- Root Model ---------------------------------------------------------------


class ConnectorSettings extends formattingSettings.SimpleCard {
  connectorColor = new formattingSettings.ColorPicker({
    name: 'connectorColor',
    displayName: 'Connector Color',
    value: { value: '' },
  });

  connectorWidth = new formattingSettings.NumUpDown({
    name: 'connectorWidth',
    displayName: 'Connector Width',
    value: 1,
  });

  connectorStyle = new formattingSettings.ItemDropdown({
    name: 'connectorStyle',
    displayName: 'Connector Style',
    items: [{ value: 'solid', displayName: 'Solid' }, { value: 'dashed', displayName: 'Dashed' }],
    value: { value: 'dashed', displayName: 'Dashed' },
  });

  name = 'connectorFormatting';
  displayName = 'Connector';
  slices = [this.connectorColor, this.connectorWidth, this.connectorStyle];
}

export class AnimatedWaterfallSettings extends formattingSettings.Model {
  waterfallSettings = new WaterfallSettingsCard();
  colorSettings = new ColorSettingsCard();
  valueSettings = new ValueSettingsCard();
  axisSettings = new AxisSettingsCard();
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
