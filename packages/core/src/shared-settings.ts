/**
 * Shared formatting settings cards used across multiple Power BI custom visuals.
 * Import these into each visual's settings.ts and add to the Model's cards array.
 *
 * Card names use the 'Formatting' suffix (e.g. 'axisFormatting') to avoid
 * collisions with existing serialized card names (e.g. 'axisSettings').
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';
import { COLOR_THEMES, type ColorThemeName } from './colors';

// ── Font Family Options ──────────────────────────────────────────────

const FONT_WEIGHT_ITEMS = [
  { value: 'normal', displayName: 'Normal', displayNameKey: 'SharedSettings_DisplayName_0020' },
  { value: 'bold', displayName: 'Bold', displayNameKey: 'SharedSettings_DisplayName_0021' },
];

const FONT_FAMILY_ITEMS = [
  { value: '', displayName: 'Default', displayNameKey: 'SharedSettings_DisplayName_0022' },
  { value: 'Arial', displayName: 'Arial', displayNameKey: 'SharedSettings_DisplayName_0023' },
  { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'SharedSettings_DisplayName_0024' },
  { value: 'Cambria', displayName: 'Cambria', displayNameKey: 'SharedSettings_DisplayName_0025' },
  { value: 'Courier New', displayName: 'Courier New', displayNameKey: 'SharedSettings_DisplayName_0026' },
  { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'SharedSettings_DisplayName_0027' },
  { value: 'Helvetica Neue', displayName: 'Helvetica Neue', displayNameKey: 'SharedSettings_DisplayName_0028' },
  { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'SharedSettings_DisplayName_0029' },
  { value: 'Tahoma', displayName: 'Tahoma', displayNameKey: 'SharedSettings_DisplayName_0030' },
  { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'SharedSettings_DisplayName_0031' },
  { value: 'Trebuchet MS', displayName: 'Trebuchet MS', displayNameKey: 'SharedSettings_DisplayName_0032' },
  { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'SharedSettings_DisplayName_0033' },
];

export const CARD_STYLE_MODE_ITEMS = [
  { value: 'none', displayName: 'None', displayNameKey: 'SharedSettings_DisplayName_CardStyleNone' },
  { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'SharedSettings_DisplayName_CardStyleGlass' },
  { value: 'elevated', displayName: 'Raised Panel', displayNameKey: 'SharedSettings_DisplayName_CardStyleElevated' },
  { value: 'neumorphic', displayName: 'Soft Inset', displayNameKey: 'SharedSettings_DisplayName_CardStyleNeumorphic' },
  { value: 'outlined', displayName: 'Border Only', displayNameKey: 'SharedSettings_DisplayName_CardStyleOutlined' },
  { value: 'floating', displayName: 'Floating Shadow', displayNameKey: 'SharedSettings_DisplayName_CardStyleFloating' },
];

// ── Axis Formatting ──────────────────────────────────────────────────

export class AxisFormattingCard extends formattingSettings.SimpleCard {
  showXAxis = new formattingSettings.ToggleSwitch({
    name: 'showXAxis',
    displayName: 'Show X-Axis', displayNameKey: 'SharedSettings_DisplayName_0034',
    value: true,
  });

  showYAxis = new formattingSettings.ToggleSwitch({
    name: 'showYAxis',
    displayName: 'Show Y-Axis', displayNameKey: 'SharedSettings_DisplayName_0035',
    value: true,
  });

  xAxisTitle = new formattingSettings.TextInput({
    name: 'xAxisTitle',
    displayName: 'X-Axis Title', displayNameKey: 'SharedSettings_DisplayName_0036',
    value: '',
    placeholder: 'Auto', placeholderKey: 'SharedSettings_Placeholder_0001',
  });

  yAxisTitle = new formattingSettings.TextInput({
    name: 'yAxisTitle',
    displayName: 'Y-Axis Title', displayNameKey: 'SharedSettings_DisplayName_0037',
    value: '',
    placeholder: 'Auto', placeholderKey: 'SharedSettings_Placeholder_0002',
  });

  axisLabelColor = new formattingSettings.ColorPicker({
    name: 'axisLabelColor',
    displayName: 'Label Color', displayNameKey: 'SharedSettings_DisplayName_0038',
    value: { value: '' },
  });

  axisLabelSize = new formattingSettings.NumUpDown({
    name: 'axisLabelSize',
    displayName: 'Label Font Size', displayNameKey: 'SharedSettings_DisplayName_0039',
    value: 11,
  });

  axisLabelFontFamily = new formattingSettings.ItemDropdown({
    name: 'axisLabelFontFamily',
    displayName: 'Label Font', displayNameKey: 'SharedSettings_DisplayName_0040',
    items: FONT_FAMILY_ITEMS,
    value: { value: '', displayName: 'Default', displayNameKey: 'SharedSettings_DisplayName_0041' },
  });

  axisLabelFontWeight = new formattingSettings.ItemDropdown({
    name: 'axisLabelFontWeight',
    displayName: 'Label Font Weight', displayNameKey: 'SharedSettings_DisplayName_0042',
    items: FONT_WEIGHT_ITEMS,
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'SharedSettings_DisplayName_0043' },
  });

  axisLabelRotation = new formattingSettings.NumUpDown({
    name: 'axisLabelRotation',
    displayName: 'X-Label Rotation (°)', displayNameKey: 'SharedSettings_DisplayName_0044',
    value: 0,
  });

  yAxisMin = new formattingSettings.NumUpDown({
    name: 'yAxisMin',
    displayName: 'Y-Axis Min', displayNameKey: 'SharedSettings_DisplayName_0045',
    value: null as unknown as number,
  });

  yAxisMax = new formattingSettings.NumUpDown({
    name: 'yAxisMax',
    displayName: 'Y-Axis Max', displayNameKey: 'SharedSettings_DisplayName_0046',
    value: null as unknown as number,
  });

  axisLineColor = new formattingSettings.ColorPicker({
    name: 'axisLineColor',
    displayName: 'Axis Line Color', displayNameKey: 'SharedSettings_DisplayName_0047',
    value: { value: '' },
  });

  axisLineWidth = new formattingSettings.NumUpDown({
    name: 'axisLineWidth',
    displayName: 'Axis Line Width', displayNameKey: 'SharedSettings_DisplayName_0048',
    value: 1,
  });

  showGridLines = new formattingSettings.ToggleSwitch({
    name: 'showGridLines',
    displayName: 'Show Grid Lines', displayNameKey: 'SharedSettings_DisplayName_0049',
    value: true,
  });

  gridLineColor = new formattingSettings.ColorPicker({
    name: 'gridLineColor',
    displayName: 'Grid Line Color', displayNameKey: 'SharedSettings_DisplayName_0050',
    value: { value: '' },
  });

  gridLineStyle = new formattingSettings.ItemDropdown({
    name: 'gridLineStyle',
    displayName: 'Grid Line Style', displayNameKey: 'SharedSettings_DisplayName_0051',
    items: [
      { value: 'solid', displayName: 'Solid', displayNameKey: 'SharedSettings_DisplayName_0052' },
      { value: 'dashed', displayName: 'Dashed', displayNameKey: 'SharedSettings_DisplayName_0053' },
    ],
    value: { value: 'dashed', displayName: 'Dashed', displayNameKey: 'SharedSettings_DisplayName_0054' },
  });

  gridLineWidth = new formattingSettings.NumUpDown({
    name: 'gridLineWidth',
    displayName: 'Grid Line Width', displayNameKey: 'SharedSettings_DisplayName_0055',
    value: 1,
  });

  gridLineOpacity = new formattingSettings.NumUpDown({
    name: 'gridLineOpacity',
    displayName: 'Grid Line Opacity (%)', displayNameKey: 'SharedSettings_DisplayName_0056',
    value: 100,
  });

  integerTicks = new formattingSettings.ToggleSwitch({
    name: 'integerTicks',
    displayName: 'Integer Ticks Only', displayNameKey: 'SharedSettings_DisplayName_0057',
    value: false,
  });

  name = 'axisFormatting';
  displayName = 'Axis Formatting';
  displayNameKey = 'SharedSettings_DisplayName_0001';
  slices = [
    this.showXAxis,
    this.showYAxis,
    this.xAxisTitle,
    this.yAxisTitle,
    this.axisLabelColor,
    this.axisLabelSize,
    this.axisLabelFontFamily,
    this.axisLabelFontWeight,
    this.axisLabelRotation,
    this.yAxisMin,
    this.yAxisMax,
    this.integerTicks,
    this.axisLineColor,
    this.axisLineWidth,
    this.showGridLines,
    this.gridLineColor,
    this.gridLineStyle,
    this.gridLineWidth,
    this.gridLineOpacity,
  ];
}

// ── Legend Formatting ─────────────────────────────────────────────────

export class LegendFormattingCard extends formattingSettings.SimpleCard {
  showLegend = new formattingSettings.ToggleSwitch({
    name: 'showLegend',
    displayName: 'Show Legend', displayNameKey: 'SharedSettings_DisplayName_0058',
    value: true,
  });

  legendPosition = new formattingSettings.ItemDropdown({
    name: 'legendPosition',
    displayName: 'Position', displayNameKey: 'SharedSettings_DisplayName_0059',
    items: [
      { value: 'bottom', displayName: 'Bottom', displayNameKey: 'SharedSettings_DisplayName_0060' },
      { value: 'top', displayName: 'Top', displayNameKey: 'SharedSettings_DisplayName_0061' },
      { value: 'left', displayName: 'Left', displayNameKey: 'SharedSettings_DisplayName_0062' },
      { value: 'right', displayName: 'Right', displayNameKey: 'SharedSettings_DisplayName_0063' },
    ],
    value: { value: 'bottom', displayName: 'Bottom', displayNameKey: 'SharedSettings_DisplayName_0064' },
  });

  legendFontSize = new formattingSettings.NumUpDown({
    name: 'legendFontSize',
    displayName: 'Font Size', displayNameKey: 'SharedSettings_DisplayName_0065',
    value: 11,
  });

  legendFontColor = new formattingSettings.ColorPicker({
    name: 'legendFontColor',
    displayName: 'Font Color', displayNameKey: 'SharedSettings_DisplayName_0066',
    value: { value: '' },
  });

  legendFontFamily = new formattingSettings.ItemDropdown({
    name: 'legendFontFamily',
    displayName: 'Font', displayNameKey: 'SharedSettings_DisplayName_0067',
    items: FONT_FAMILY_ITEMS,
    value: { value: '', displayName: 'Default', displayNameKey: 'SharedSettings_DisplayName_0068' },
  });

  legendFontWeight = new formattingSettings.ItemDropdown({
    name: 'legendFontWeight',
    displayName: 'Font Weight', displayNameKey: 'SharedSettings_DisplayName_0069',
    items: FONT_WEIGHT_ITEMS,
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'SharedSettings_DisplayName_0070' },
  });

  legendAliases = new formattingSettings.TextInput({
    name: 'legendAliases',
    displayName: 'Rename Labels', displayNameKey: 'SharedSettings_DisplayName_0071',
    value: '',
    placeholder: 'Label1, Label2, ...', placeholderKey: 'SharedSettings_Placeholder_0003',
  });

  showInlineLabels = new formattingSettings.ToggleSwitch({
    name: 'showInlineLabels',
    displayName: 'Inline End Labels', displayNameKey: 'SharedSettings_DisplayName_0072',
    value: false,
  });

  inlineLabelFontSize = new formattingSettings.NumUpDown({
    name: 'inlineLabelFontSize',
    displayName: 'Inline Label Font Size', displayNameKey: 'SharedSettings_DisplayName_0073',
    value: 11,
  });

  inlineLabelOffset = new formattingSettings.NumUpDown({
    name: 'inlineLabelOffset',
    displayName: 'Inline Label Offset (px)', displayNameKey: 'SharedSettings_DisplayName_0074',
    value: 4,
  });

  name = 'legendFormatting';
  displayName = 'Legend';
  displayNameKey = 'SharedSettings_DisplayName_0002';
  slices = [
    this.showLegend,
    this.legendPosition,
    this.legendFontSize,
    this.legendFontColor,
    this.legendFontFamily,
    this.legendFontWeight,
    this.legendAliases,
    this.showInlineLabels,
    this.inlineLabelFontSize,
    this.inlineLabelOffset,
  ];
}

// ── Data Label Formatting ────────────────────────────────────────────

export class DataLabelFormattingCard extends formattingSettings.SimpleCard {
  showDataLabels = new formattingSettings.ToggleSwitch({
    name: 'showDataLabels',
    displayName: 'Show Data Labels', displayNameKey: 'SharedSettings_DisplayName_0075',
    value: false,
  });

  dataLabelFontSize = new formattingSettings.NumUpDown({
    name: 'dataLabelFontSize',
    displayName: 'Font Size', displayNameKey: 'SharedSettings_DisplayName_0076',
    value: 11,
  });

  dataLabelFontColor = new formattingSettings.ColorPicker({
    name: 'dataLabelFontColor',
    displayName: 'Font Color', displayNameKey: 'SharedSettings_DisplayName_0077',
    value: { value: '' },
  });

  dataLabelFontWeight = new formattingSettings.ItemDropdown({
    name: 'dataLabelFontWeight',
    displayName: 'Font Weight', displayNameKey: 'SharedSettings_DisplayName_0078',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'SharedSettings_DisplayName_0079' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'SharedSettings_DisplayName_0080' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'SharedSettings_DisplayName_0081' },
  });

  dataLabelFontFamily = new formattingSettings.ItemDropdown({
    name: 'dataLabelFontFamily',
    displayName: 'Font', displayNameKey: 'SharedSettings_DisplayName_0082',
    items: FONT_FAMILY_ITEMS,
    value: { value: '', displayName: 'Default', displayNameKey: 'SharedSettings_DisplayName_0083' },
  });

  dataLabelPosition = new formattingSettings.ItemDropdown({
    name: 'dataLabelPosition',
    displayName: 'Position', displayNameKey: 'SharedSettings_DisplayName_0084',
    items: [
      { value: 'auto', displayName: 'Auto', displayNameKey: 'SharedSettings_DisplayName_0085' },
      { value: 'above', displayName: 'Above', displayNameKey: 'SharedSettings_DisplayName_0086' },
      { value: 'below', displayName: 'Below', displayNameKey: 'SharedSettings_DisplayName_0087' },
      { value: 'inside', displayName: 'Inside', displayNameKey: 'SharedSettings_DisplayName_0088' },
      { value: 'outside', displayName: 'Outside', displayNameKey: 'SharedSettings_DisplayName_0089' },
    ],
    value: { value: 'auto', displayName: 'Auto', displayNameKey: 'SharedSettings_DisplayName_0090' },
  });

  name = 'dataLabelFormatting';
  displayName = 'Data Labels';
  displayNameKey = 'SharedSettings_DisplayName_0003';
  slices = [
    this.showDataLabels,
    this.dataLabelFontSize,
    this.dataLabelFontColor,
    this.dataLabelFontWeight,
    this.dataLabelFontFamily,
    this.dataLabelPosition,
  ];
}

// ── Title Formatting ─────────────────────────────────────────────────

export class TitleFormattingCard extends formattingSettings.SimpleCard {
  showTitle = new formattingSettings.ToggleSwitch({
    name: 'showTitle',
    displayName: 'Show Title', displayNameKey: 'SharedSettings_DisplayName_0091',
    value: true,
  });

  titleText = new formattingSettings.TextInput({
    name: 'titleText',
    displayName: 'Title Text', displayNameKey: 'SharedSettings_DisplayName_0092',
    value: '',
    placeholder: 'Chart Title', placeholderKey: 'SharedSettings_Placeholder_0004',
  });

  titleFontSize = new formattingSettings.NumUpDown({
    name: 'titleFontSize',
    displayName: 'Font Size', displayNameKey: 'SharedSettings_DisplayName_0093',
    value: 14,
  });

  titleFontColor = new formattingSettings.ColorPicker({
    name: 'titleFontColor',
    displayName: 'Font Color', displayNameKey: 'SharedSettings_DisplayName_0094',
    value: { value: '' },
  });

  titleAlignment = new formattingSettings.ItemDropdown({
    name: 'titleAlignment',
    displayName: 'Alignment', displayNameKey: 'SharedSettings_DisplayName_0095',
    items: [
      { value: 'left', displayName: 'Left', displayNameKey: 'SharedSettings_DisplayName_0096' },
      { value: 'center', displayName: 'Center', displayNameKey: 'SharedSettings_DisplayName_0097' },
      { value: 'right', displayName: 'Right', displayNameKey: 'SharedSettings_DisplayName_0098' },
    ],
    value: { value: 'center', displayName: 'Center', displayNameKey: 'SharedSettings_DisplayName_0099' },
  });

  titleFontFamily = new formattingSettings.ItemDropdown({
    name: 'titleFontFamily',
    displayName: 'Font', displayNameKey: 'SharedSettings_DisplayName_0100',
    items: FONT_FAMILY_ITEMS,
    value: { value: '', displayName: 'Default', displayNameKey: 'SharedSettings_DisplayName_0101' },
  });

  titleFontWeight = new formattingSettings.ItemDropdown({
    name: 'titleFontWeight',
    displayName: 'Font Weight', displayNameKey: 'SharedSettings_DisplayName_0102',
    items: FONT_WEIGHT_ITEMS,
    value: { value: 'bold', displayName: 'Bold', displayNameKey: 'SharedSettings_DisplayName_0103' },
  });

  subtitleText = new formattingSettings.TextInput({
    name: 'subtitleText',
    displayName: 'Subtitle', displayNameKey: 'SharedSettings_DisplayName_0104',
    value: '',
    placeholder: '', placeholderKey: 'SharedSettings_Placeholder_0005',
  });

  subtitleFontSize = new formattingSettings.NumUpDown({
    name: 'subtitleFontSize',
    displayName: 'Subtitle Font Size', displayNameKey: 'SharedSettings_DisplayName_0105',
    value: 11,
  });

  subtitleFontColor = new formattingSettings.ColorPicker({
    name: 'subtitleFontColor',
    displayName: 'Subtitle Color', displayNameKey: 'SharedSettings_DisplayName_0106',
    value: { value: '' },
  });

  subtitleFontFamily = new formattingSettings.ItemDropdown({
    name: 'subtitleFontFamily',
    displayName: 'Subtitle Font', displayNameKey: 'SharedSettings_DisplayName_0107',
    items: FONT_FAMILY_ITEMS,
    value: { value: '', displayName: 'Default', displayNameKey: 'SharedSettings_DisplayName_0108' },
  });

  subtitleFontWeight = new formattingSettings.ItemDropdown({
    name: 'subtitleFontWeight',
    displayName: 'Subtitle Font Weight', displayNameKey: 'SharedSettings_DisplayName_0109',
    items: FONT_WEIGHT_ITEMS,
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'SharedSettings_DisplayName_0110' },
  });

  name = 'titleFormatting';
  displayName = 'Chart Title';
  displayNameKey = 'SharedSettings_DisplayName_0004';
  slices = [
    this.showTitle,
    this.titleText,
    this.titleFontSize,
    this.titleFontColor,
    this.titleFontFamily,
    this.titleFontWeight,
    this.titleAlignment,
    this.subtitleText,
    this.subtitleFontSize,
    this.subtitleFontColor,
    this.subtitleFontFamily,
    this.subtitleFontWeight,
  ];
}

// ── Scroll Formatting ────────────────────────────────────────────────

export class ScrollFormattingCard extends formattingSettings.SimpleCard {
  enableScroll = new formattingSettings.ToggleSwitch({
    name: 'enableScroll',
    displayName: 'Enable Scroll', displayNameKey: 'SharedSettings_DisplayName_0111',
    value: true,
  });

  minCategoryWidth = new formattingSettings.NumUpDown({
    name: 'minCategoryWidth',
    displayName: 'Min Category Width (px)', displayNameKey: 'SharedSettings_DisplayName_0112',
    value: 40,
  });

  name = 'scrollFormatting';
  displayName = 'Scroll';
  displayNameKey = 'SharedSettings_DisplayName_0005';
  slices = [this.enableScroll, this.minCategoryWidth];
}

// ── Number Formatting ────────────────────────────────────────────────

export class NumberFormattingCard extends formattingSettings.SimpleCard {
  displayUnits = new formattingSettings.ItemDropdown({
    name: 'displayUnits',
    displayName: 'Display Units', displayNameKey: 'SharedSettings_DisplayName_0113',
    items: [
      { value: 'auto', displayName: 'Auto', displayNameKey: 'SharedSettings_DisplayName_0114' },
      { value: 'none', displayName: 'None', displayNameKey: 'SharedSettings_DisplayName_0115' },
      { value: 'thousands', displayName: 'Thousands (K)', displayNameKey: 'SharedSettings_DisplayName_0116' },
      { value: 'millions', displayName: 'Millions (M)', displayNameKey: 'SharedSettings_DisplayName_0117' },
      { value: 'billions', displayName: 'Billions (B)', displayNameKey: 'SharedSettings_DisplayName_0118' },
    ],
    value: { value: 'auto', displayName: 'Auto', displayNameKey: 'SharedSettings_DisplayName_0119' },
  });

  decimalPlaces = new formattingSettings.NumUpDown({
    name: 'decimalPlaces',
    displayName: 'Decimal Places', displayNameKey: 'SharedSettings_DisplayName_0120',
    value: -1,
  });

  valuePrefix = new formattingSettings.TextInput({
    name: 'valuePrefix',
    displayName: 'Prefix', displayNameKey: 'SharedSettings_DisplayName_0121',
    value: '',
    placeholder: 'e.g. $', placeholderKey: 'SharedSettings_Placeholder_0006',
  });

  valueSuffix = new formattingSettings.TextInput({
    name: 'valueSuffix',
    displayName: 'Suffix', displayNameKey: 'SharedSettings_DisplayName_0122',
    value: '',
    placeholder: 'e.g. %', placeholderKey: 'SharedSettings_Placeholder_0007',
  });

  name = 'numberFormatting';
  displayName = 'Number Format';
  displayNameKey = 'SharedSettings_DisplayName_0006';
  slices = [this.displayUnits, this.decimalPlaces, this.valuePrefix, this.valueSuffix];
}

// ── Sort Order ──────────────────────────────────────────────────────

export class SortFormattingCard extends formattingSettings.SimpleCard {
  sortBy = new formattingSettings.ItemDropdown({
    name: 'sortBy',
    displayName: 'Sort By', displayNameKey: 'SharedSettings_DisplayName_0123',
    items: [
      { value: 'dataOrder', displayName: 'Data Order', displayNameKey: 'SharedSettings_DisplayName_0124' },
      { value: 'valueAsc', displayName: 'Value (Ascending)', displayNameKey: 'SharedSettings_DisplayName_0125' },
      { value: 'valueDesc', displayName: 'Value (Descending)', displayNameKey: 'SharedSettings_DisplayName_0126' },
      { value: 'nameAsc', displayName: 'Name (A-Z)', displayNameKey: 'SharedSettings_DisplayName_0127' },
      { value: 'nameDesc', displayName: 'Name (Z-A)', displayNameKey: 'SharedSettings_DisplayName_0128' },
    ],
    value: { value: 'dataOrder', displayName: 'Data Order', displayNameKey: 'SharedSettings_DisplayName_0129' },
  });

  name = 'sortFormatting';
  displayName = 'Sort Order';
  displayNameKey = 'SharedSettings_DisplayName_0007';
  slices = [this.sortBy];
}

// ── Reference Line Formatting ────────────────────────────────────────

export class ReferenceLineFormattingCard extends formattingSettings.SimpleCard {
  showReferenceLine = new formattingSettings.ToggleSwitch({
    name: 'showReferenceLine',
    displayName: 'Show Reference Line', displayNameKey: 'SharedSettings_DisplayName_0130',
    value: false,
  });

  referenceLineType = new formattingSettings.ItemDropdown({
    name: 'referenceLineType',
    displayName: 'Type', displayNameKey: 'SharedSettings_DisplayName_0131',
    items: [
      { value: 'custom', displayName: 'Custom Value', displayNameKey: 'SharedSettings_DisplayName_0132' },
      { value: 'mean', displayName: 'Mean', displayNameKey: 'SharedSettings_DisplayName_0133' },
      { value: 'median', displayName: 'Median', displayNameKey: 'SharedSettings_DisplayName_0134' },
      { value: 'percentile', displayName: 'Percentile', displayNameKey: 'SharedSettings_DisplayName_0135' },
      { value: 'min', displayName: 'Min', displayNameKey: 'SharedSettings_DisplayName_0136' },
      { value: 'max', displayName: 'Max', displayNameKey: 'SharedSettings_DisplayName_0137' },
    ],
    value: { value: 'custom', displayName: 'Custom Value', displayNameKey: 'SharedSettings_DisplayName_0138' },
  });

  referenceLineValue = new formattingSettings.NumUpDown({
    name: 'referenceLineValue',
    displayName: 'Value', displayNameKey: 'SharedSettings_DisplayName_0139',
    value: 0,
  });

  referenceLineColor = new formattingSettings.ColorPicker({
    name: 'referenceLineColor',
    displayName: 'Line Color', displayNameKey: 'SharedSettings_DisplayName_0140',
    value: { value: '#EF4444' },
  });

  referenceLineWidth = new formattingSettings.NumUpDown({
    name: 'referenceLineWidth',
    displayName: 'Line Width', displayNameKey: 'SharedSettings_DisplayName_0141',
    value: 2,
  });

  referenceLineStyle = new formattingSettings.ItemDropdown({
    name: 'referenceLineStyle',
    displayName: 'Line Style', displayNameKey: 'SharedSettings_DisplayName_0142',
    items: [
      { value: 'solid', displayName: 'Solid', displayNameKey: 'SharedSettings_DisplayName_0143' },
      { value: 'dashed', displayName: 'Dashed', displayNameKey: 'SharedSettings_DisplayName_0144' },
      { value: 'dotted', displayName: 'Dotted', displayNameKey: 'SharedSettings_DisplayName_0145' },
    ],
    value: { value: 'dashed', displayName: 'Dashed', displayNameKey: 'SharedSettings_DisplayName_0146' },
  });

  showReferenceLabel = new formattingSettings.ToggleSwitch({
    name: 'showReferenceLabel',
    displayName: 'Show Label', displayNameKey: 'SharedSettings_DisplayName_0147',
    value: true,
  });

  referenceLabelText = new formattingSettings.TextInput({
    name: 'referenceLabelText',
    displayName: 'Label Text', displayNameKey: 'SharedSettings_DisplayName_0148',
    value: '',
    placeholder: 'e.g. Target', placeholderKey: 'SharedSettings_Placeholder_0008',
  });

  showReferenceBand = new formattingSettings.ToggleSwitch({
    name: 'showReferenceBand',
    displayName: 'Show Band', displayNameKey: 'SharedSettings_DisplayName_0149',
    value: false,
  });

  referenceBandOpacity = new formattingSettings.NumUpDown({
    name: 'referenceBandOpacity',
    displayName: 'Band Opacity (%)', displayNameKey: 'SharedSettings_DisplayName_0150',
    value: 10,
  });

  referenceBandWidth = new formattingSettings.NumUpDown({
    name: 'referenceBandWidth',
    displayName: 'Band Width (%)', displayNameKey: 'SharedSettings_DisplayName_0151',
    value: 10,
  });

  referenceLineAxis = new formattingSettings.ItemDropdown({
    name: 'referenceLineAxis',
    displayName: 'Target Axis', displayNameKey: 'SharedSettings_DisplayName_0152',
    items: [
      { value: 'primary', displayName: 'Primary', displayNameKey: 'SharedSettings_DisplayName_0153' },
      { value: 'secondary', displayName: 'Secondary', displayNameKey: 'SharedSettings_DisplayName_0154' },
    ],
    value: { value: 'primary', displayName: 'Primary', displayNameKey: 'SharedSettings_DisplayName_0155' },
  });

  name = 'referenceLineFormatting';
  displayName = 'Reference Line';
  displayNameKey = 'SharedSettings_DisplayName_0008';
  slices = [
    this.showReferenceLine,
    this.referenceLineType,
    this.referenceLineValue,
    this.referenceLineColor,
    this.referenceLineWidth,
    this.referenceLineStyle,
    this.showReferenceLabel,
    this.referenceLabelText,
    this.showReferenceBand,
    this.referenceBandOpacity,
    this.referenceBandWidth,
    this.referenceLineAxis,
  ];
}

// ── Trend Line Formatting ───────────────────────────────────────────

export class TrendLineFormattingCard extends formattingSettings.SimpleCard {
  showTrendLine = new formattingSettings.ToggleSwitch({
    name: 'showTrendLine',
    displayName: 'Show Trend Line', displayNameKey: 'SharedSettings_DisplayName_0156',
    value: false,
  });

  trendLineType = new formattingSettings.ItemDropdown({
    name: 'trendLineType',
    displayName: 'Type', displayNameKey: 'SharedSettings_DisplayName_0157',
    items: [
      { value: 'linear', displayName: 'Linear', displayNameKey: 'SharedSettings_DisplayName_0158' },
      { value: 'polynomial', displayName: 'Polynomial', displayNameKey: 'SharedSettings_DisplayName_0159' },
      { value: 'exponential', displayName: 'Exponential', displayNameKey: 'SharedSettings_DisplayName_0160' },
      { value: 'logarithmic', displayName: 'Logarithmic', displayNameKey: 'SharedSettings_DisplayName_0161' },
      { value: 'power', displayName: 'Power', displayNameKey: 'SharedSettings_DisplayName_0162' },
    ],
    value: { value: 'linear', displayName: 'Linear', displayNameKey: 'SharedSettings_DisplayName_0163' },
  });

  polynomialOrder = new formattingSettings.NumUpDown({
    name: 'polynomialOrder',
    displayName: 'Polynomial Order', displayNameKey: 'SharedSettings_DisplayName_0164',
    value: 2,
  });

  trendLineColor = new formattingSettings.ColorPicker({
    name: 'trendLineColor',
    displayName: 'Line Color', displayNameKey: 'SharedSettings_DisplayName_0165',
    value: { value: '#6366F1' },
  });

  trendLineWidth = new formattingSettings.NumUpDown({
    name: 'trendLineWidth',
    displayName: 'Line Width', displayNameKey: 'SharedSettings_DisplayName_0166',
    value: 2,
  });

  showEquation = new formattingSettings.ToggleSwitch({
    name: 'showEquation',
    displayName: 'Show Equation', displayNameKey: 'SharedSettings_DisplayName_0167',
    value: false,
  });

  showR2 = new formattingSettings.ToggleSwitch({
    name: 'showR2',
    displayName: 'Show R²', displayNameKey: 'SharedSettings_DisplayName_0168',
    value: false,
  });

  trendLineAxis = new formattingSettings.ItemDropdown({
    name: 'trendLineAxis',
    displayName: 'Target Axis', displayNameKey: 'SharedSettings_DisplayName_0169',
    items: [
      { value: 'primary', displayName: 'Primary', displayNameKey: 'SharedSettings_DisplayName_0170' },
      { value: 'secondary', displayName: 'Secondary', displayNameKey: 'SharedSettings_DisplayName_0171' },
    ],
    value: { value: 'primary', displayName: 'Primary', displayNameKey: 'SharedSettings_DisplayName_0172' },
  });

  name = 'trendLineFormatting';
  displayName = 'Trend Line';
  displayNameKey = 'SharedSettings_DisplayName_0009';
  slices = [
    this.showTrendLine,
    this.trendLineType,
    this.polynomialOrder,
    this.trendLineColor,
    this.trendLineWidth,
    this.showEquation,
    this.showR2,
    this.trendLineAxis,
  ];
}

// ── Target Formatting ───────────────────────────────────────────────

export class TargetFormattingCard extends formattingSettings.SimpleCard {
  showTarget = new formattingSettings.ToggleSwitch({
    name: 'showTarget',
    displayName: 'Show Target Line', displayNameKey: 'SharedSettings_DisplayName_0173',
    value: false,
  });

  targetLabel = new formattingSettings.TextInput({
    name: 'targetLabel',
    displayName: 'Label', displayNameKey: 'SharedSettings_DisplayName_0174',
    value: 'Target',
    placeholder: 'Target', placeholderKey: 'SharedSettings_Placeholder_0009',
  });

  targetLineColor = new formattingSettings.ColorPicker({
    name: 'targetLineColor',
    displayName: 'Line Color', displayNameKey: 'SharedSettings_DisplayName_0175',
    value: { value: '#F59E0B' },
  });

  targetLineWidth = new formattingSettings.NumUpDown({
    name: 'targetLineWidth',
    displayName: 'Line Width', displayNameKey: 'SharedSettings_DisplayName_0176',
    value: 2,
  });

  targetLineStyle = new formattingSettings.ItemDropdown({
    name: 'targetLineStyle',
    displayName: 'Line Style', displayNameKey: 'SharedSettings_DisplayName_0177',
    items: [
      { value: 'solid', displayName: 'Solid', displayNameKey: 'SharedSettings_DisplayName_0178' },
      { value: 'dashed', displayName: 'Dashed', displayNameKey: 'SharedSettings_DisplayName_0179' },
      { value: 'dotted', displayName: 'Dotted', displayNameKey: 'SharedSettings_DisplayName_0180' },
    ],
    value: { value: 'dashed', displayName: 'Dashed', displayNameKey: 'SharedSettings_DisplayName_0181' },
  });

  showTargetLabel = new formattingSettings.ToggleSwitch({
    name: 'showTargetLabel',
    displayName: 'Show Label', displayNameKey: 'SharedSettings_DisplayName_0182',
    value: true,
  });

  showTargetBand = new formattingSettings.ToggleSwitch({
    name: 'showTargetBand',
    displayName: 'Show Band', displayNameKey: 'SharedSettings_DisplayName_0183',
    value: false,
  });

  targetBandHalfWidth = new formattingSettings.NumUpDown({
    name: 'targetBandHalfWidth',
    displayName: 'Band Half Width', displayNameKey: 'SharedSettings_DisplayName_0184',
    value: 10,
  });

  targetBandOpacity = new formattingSettings.NumUpDown({
    name: 'targetBandOpacity',
    displayName: 'Band Opacity (%)', displayNameKey: 'SharedSettings_DisplayName_0185',
    value: 8,
  });

  targetLineAxis = new formattingSettings.ItemDropdown({
    name: 'targetLineAxis',
    displayName: 'Target Axis', displayNameKey: 'SharedSettings_DisplayName_0186',
    items: [
      { value: 'primary', displayName: 'Primary', displayNameKey: 'SharedSettings_DisplayName_0187' },
      { value: 'secondary', displayName: 'Secondary', displayNameKey: 'SharedSettings_DisplayName_0188' },
    ],
    value: { value: 'primary', displayName: 'Primary', displayNameKey: 'SharedSettings_DisplayName_0189' },
  });

  name = 'targetFormatting';
  displayName = 'Target Line';
  displayNameKey = 'SharedSettings_DisplayName_0010';
  slices = [
    this.showTarget,
    this.targetLabel,
    this.targetLineColor,
    this.targetLineWidth,
    this.targetLineStyle,
    this.showTargetLabel,
    this.showTargetBand,
    this.targetBandHalfWidth,
    this.targetBandOpacity,
    this.targetLineAxis,
  ];
}

// ── Conditional Formatting ──────────────────────────────────────────

export class ConditionalFormattingCard extends formattingSettings.SimpleCard {
  enableConditional = new formattingSettings.ToggleSwitch({
    name: 'enableConditional',
    displayName: 'Enable Conditional Formatting', displayNameKey: 'SharedSettings_DisplayName_0190',
    value: false,
  });

  conditionalDirection = new formattingSettings.ItemDropdown({
    name: 'conditionalDirection',
    displayName: 'Direction', displayNameKey: 'SharedSettings_DisplayName_0191',
    items: [
      { value: 'ascending', displayName: 'Ascending (Low = Bad)', displayNameKey: 'SharedSettings_DisplayName_0192' },
      { value: 'descending', displayName: 'Descending (Low = Good)', displayNameKey: 'SharedSettings_DisplayName_0193' },
    ],
    value: { value: 'ascending', displayName: 'Ascending (Low = Bad)', displayNameKey: 'SharedSettings_DisplayName_0194' },
  });

  threshold1 = new formattingSettings.NumUpDown({
    name: 'threshold1',
    displayName: 'Threshold 1', displayNameKey: 'SharedSettings_DisplayName_0195',
    value: 30,
  });

  threshold2 = new formattingSettings.NumUpDown({
    name: 'threshold2',
    displayName: 'Threshold 2', displayNameKey: 'SharedSettings_DisplayName_0196',
    value: 70,
  });

  conditionalColor1 = new formattingSettings.ColorPicker({
    name: 'conditionalColor1',
    displayName: 'Color 1 (Bad)', displayNameKey: 'SharedSettings_DisplayName_0197',
    value: { value: '#EF4444' },
  });

  conditionalColor2 = new formattingSettings.ColorPicker({
    name: 'conditionalColor2',
    displayName: 'Color 2 (Warning)', displayNameKey: 'SharedSettings_DisplayName_0198',
    value: { value: '#F59E0B' },
  });

  conditionalColor3 = new formattingSettings.ColorPicker({
    name: 'conditionalColor3',
    displayName: 'Color 3 (Good)', displayNameKey: 'SharedSettings_DisplayName_0199',
    value: { value: '#22C55E' },
  });

  name = 'conditionalFormatting';
  displayName = 'Conditional Formatting';
  displayNameKey = 'SharedSettings_DisplayName_0011';
  slices = [
    this.enableConditional,
    this.conditionalDirection,
    this.threshold1,
    this.threshold2,
    this.conditionalColor1,
    this.conditionalColor2,
    this.conditionalColor3,
  ];
}

// ── Crosshair Formatting ────────────────────────────────────────────

export class CrosshairFormattingCard extends formattingSettings.SimpleCard {
  showCrosshair = new formattingSettings.ToggleSwitch({
    name: 'showCrosshair',
    displayName: 'Show Crosshair', displayNameKey: 'SharedSettings_DisplayName_0200',
    value: true,
  });

  crosshairLineColor = new formattingSettings.ColorPicker({
    name: 'crosshairLineColor',
    displayName: 'Line Color', displayNameKey: 'SharedSettings_DisplayName_0201',
    value: { value: '#94A3B8' },
  });

  crosshairLineWidth = new formattingSettings.NumUpDown({
    name: 'crosshairLineWidth',
    displayName: 'Line Width', displayNameKey: 'SharedSettings_DisplayName_0202',
    value: 1,
  });

  crosshairLineStyle = new formattingSettings.ItemDropdown({
    name: 'crosshairLineStyle',
    displayName: 'Line Style', displayNameKey: 'SharedSettings_DisplayName_0203',
    items: [
      { value: 'solid', displayName: 'Solid', displayNameKey: 'SharedSettings_DisplayName_0204' },
      { value: 'dashed', displayName: 'Dashed', displayNameKey: 'SharedSettings_DisplayName_0205' },
      { value: 'dotted', displayName: 'Dotted', displayNameKey: 'SharedSettings_DisplayName_0206' },
    ],
    value: { value: 'dashed', displayName: 'Dashed', displayNameKey: 'SharedSettings_DisplayName_0207' },
  });

  crosshairOpacity = new formattingSettings.NumUpDown({
    name: 'crosshairOpacity',
    displayName: 'Opacity (%)', displayNameKey: 'SharedSettings_DisplayName_0208',
    value: 60,
  });

  showCrosshairValues = new formattingSettings.ToggleSwitch({
    name: 'showCrosshairValues',
    displayName: 'Show Values', displayNameKey: 'SharedSettings_DisplayName_0209',
    value: true,
  });

  name = 'crosshairFormatting';
  displayName = 'Crosshair';
  displayNameKey = 'SharedSettings_DisplayName_0012';
  slices = [
    this.showCrosshair,
    this.crosshairLineColor,
    this.crosshairLineWidth,
    this.crosshairLineStyle,
    this.crosshairOpacity,
    this.showCrosshairValues,
  ];
}

// ── Accessibility Formatting ────────────────────────────────────────

export class AccessibilityFormattingCard extends formattingSettings.SimpleCard {
  enableKeyboardNav = new formattingSettings.ToggleSwitch({
    name: 'enableKeyboardNav',
    displayName: 'Enable Keyboard Navigation', displayNameKey: 'SharedSettings_DisplayName_0210',
    value: true,
  });

  name = 'accessibilityFormatting';
  displayName = 'Accessibility';
  displayNameKey = 'SharedSettings_DisplayName_0013';
  slices = [
    this.enableKeyboardNav,
  ];
}

// ── Annotation Formatting ───────────────────────────────────────────

export class AnnotationFormattingCard extends formattingSettings.SimpleCard {
  showAnnotations = new formattingSettings.ToggleSwitch({
    name: 'showAnnotations',
    displayName: 'Show Annotations', displayNameKey: 'SharedSettings_DisplayName_0211',
    value: false,
  });

  annotation1Category = new formattingSettings.TextInput({
    name: 'annotation1Category',
    displayName: 'Annotation 1 — Category', displayNameKey: 'SharedSettings_DisplayName_0212',
    value: '',
    placeholder: 'Category name', placeholderKey: 'SharedSettings_Placeholder_0010',
  });

  annotation1Text = new formattingSettings.TextInput({
    name: 'annotation1Text',
    displayName: 'Annotation 1 — Text', displayNameKey: 'SharedSettings_DisplayName_0213',
    value: '',
    placeholder: 'Annotation text', placeholderKey: 'SharedSettings_Placeholder_0011',
  });

  annotation1Position = new formattingSettings.ItemDropdown({
    name: 'annotation1Position',
    displayName: 'Annotation 1 — Position', displayNameKey: 'SharedSettings_DisplayName_0214',
    items: [
      { value: 'above', displayName: 'Above', displayNameKey: 'SharedSettings_DisplayName_0215' },
      { value: 'below', displayName: 'Below', displayNameKey: 'SharedSettings_DisplayName_0216' },
      { value: 'left', displayName: 'Left', displayNameKey: 'SharedSettings_DisplayName_0217' },
      { value: 'right', displayName: 'Right', displayNameKey: 'SharedSettings_DisplayName_0218' },
    ],
    value: { value: 'above', displayName: 'Above', displayNameKey: 'SharedSettings_DisplayName_0219' },
  });

  annotation2Category = new formattingSettings.TextInput({
    name: 'annotation2Category',
    displayName: 'Annotation 2 — Category', displayNameKey: 'SharedSettings_DisplayName_0220',
    value: '',
    placeholder: 'Category name', placeholderKey: 'SharedSettings_Placeholder_0012',
  });

  annotation2Text = new formattingSettings.TextInput({
    name: 'annotation2Text',
    displayName: 'Annotation 2 — Text', displayNameKey: 'SharedSettings_DisplayName_0221',
    value: '',
    placeholder: 'Annotation text', placeholderKey: 'SharedSettings_Placeholder_0013',
  });

  annotation2Position = new formattingSettings.ItemDropdown({
    name: 'annotation2Position',
    displayName: 'Annotation 2 — Position', displayNameKey: 'SharedSettings_DisplayName_0222',
    items: [
      { value: 'above', displayName: 'Above', displayNameKey: 'SharedSettings_DisplayName_0223' },
      { value: 'below', displayName: 'Below', displayNameKey: 'SharedSettings_DisplayName_0224' },
      { value: 'left', displayName: 'Left', displayNameKey: 'SharedSettings_DisplayName_0225' },
      { value: 'right', displayName: 'Right', displayNameKey: 'SharedSettings_DisplayName_0226' },
    ],
    value: { value: 'above', displayName: 'Above', displayNameKey: 'SharedSettings_DisplayName_0227' },
  });

  annotation3Category = new formattingSettings.TextInput({
    name: 'annotation3Category',
    displayName: 'Annotation 3 — Category', displayNameKey: 'SharedSettings_DisplayName_0228',
    value: '',
    placeholder: 'Category name', placeholderKey: 'SharedSettings_Placeholder_0014',
  });

  annotation3Text = new formattingSettings.TextInput({
    name: 'annotation3Text',
    displayName: 'Annotation 3 — Text', displayNameKey: 'SharedSettings_DisplayName_0229',
    value: '',
    placeholder: 'Annotation text', placeholderKey: 'SharedSettings_Placeholder_0015',
  });

  annotation3Position = new formattingSettings.ItemDropdown({
    name: 'annotation3Position',
    displayName: 'Annotation 3 — Position', displayNameKey: 'SharedSettings_DisplayName_0230',
    items: [
      { value: 'above', displayName: 'Above', displayNameKey: 'SharedSettings_DisplayName_0231' },
      { value: 'below', displayName: 'Below', displayNameKey: 'SharedSettings_DisplayName_0232' },
      { value: 'left', displayName: 'Left', displayNameKey: 'SharedSettings_DisplayName_0233' },
      { value: 'right', displayName: 'Right', displayNameKey: 'SharedSettings_DisplayName_0234' },
    ],
    value: { value: 'above', displayName: 'Above', displayNameKey: 'SharedSettings_DisplayName_0235' },
  });

  annotationFontSize = new formattingSettings.NumUpDown({
    name: 'annotationFontSize',
    displayName: 'Font Size', displayNameKey: 'SharedSettings_DisplayName_0236',
    value: 11,
  });

  annotationFontColor = new formattingSettings.ColorPicker({
    name: 'annotationFontColor',
    displayName: 'Font Color', displayNameKey: 'SharedSettings_DisplayName_0237',
    value: { value: '#475569' },
  });

  annotationFontFamily = new formattingSettings.ItemDropdown({
    name: 'annotationFontFamily',
    displayName: 'Font Family', displayNameKey: 'SharedSettings_DisplayName_0238',
    items: FONT_FAMILY_ITEMS,
    value: { value: '', displayName: 'Default', displayNameKey: 'SharedSettings_DisplayName_0239' },
  });

  annotationFontWeight = new formattingSettings.ItemDropdown({
    name: 'annotationFontWeight',
    displayName: 'Font Weight', displayNameKey: 'SharedSettings_DisplayName_0240',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'SharedSettings_DisplayName_0241' },
      { value: '500', displayName: 'Medium', displayNameKey: 'SharedSettings_DisplayName_0242' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'SharedSettings_DisplayName_0243' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'SharedSettings_DisplayName_0244' },
    ],
    value: { value: '500', displayName: 'Medium', displayNameKey: 'SharedSettings_DisplayName_0245' },
  });

  annotationConnectorColor = new formattingSettings.ColorPicker({
    name: 'annotationConnectorColor',
    displayName: 'Connector Color', displayNameKey: 'SharedSettings_DisplayName_0246',
    value: { value: '#94A3B8' },
  });

  annotationOffset = new formattingSettings.NumUpDown({
    name: 'annotationOffset',
    displayName: 'Callout Offset', displayNameKey: 'SharedSettings_DisplayName_0247',
    value: 24,
  });

  annotationPadding = new formattingSettings.NumUpDown({
    name: 'annotationPadding',
    displayName: 'Badge Padding', displayNameKey: 'SharedSettings_DisplayName_0248',
    value: 4,
  });

  annotationBackgroundColor = new formattingSettings.ColorPicker({
    name: 'annotationBackgroundColor',
    displayName: 'Badge Background', displayNameKey: 'SharedSettings_DisplayName_0249',
    value: { value: '#FFFFFF' },
  });

  annotationBackgroundOpacity = new formattingSettings.NumUpDown({
    name: 'annotationBackgroundOpacity',
    displayName: 'Badge Opacity (%)', displayNameKey: 'SharedSettings_DisplayName_0250',
    value: 85,
  });

  annotationCornerRadius = new formattingSettings.NumUpDown({
    name: 'annotationCornerRadius',
    displayName: 'Badge Corner Radius', displayNameKey: 'SharedSettings_DisplayName_0251',
    value: 3,
  });

  name = 'annotationFormatting';
  displayName = 'Annotations';
  displayNameKey = 'SharedSettings_DisplayName_0014';
  slices = [
    this.showAnnotations,
    this.annotation1Category,
    this.annotation1Text,
    this.annotation1Position,
    this.annotation2Category,
    this.annotation2Text,
    this.annotation2Position,
    this.annotation3Category,
    this.annotation3Text,
    this.annotation3Position,
    this.annotationFontSize,
    this.annotationFontColor,
    this.annotationFontFamily,
    this.annotationFontWeight,
    this.annotationConnectorColor,
    this.annotationOffset,
    this.annotationPadding,
    this.annotationBackgroundColor,
    this.annotationBackgroundOpacity,
    this.annotationCornerRadius,
  ];
}

// ── Series Formatting (per-series, data-bound) ──────────────────────

/** Line style type used across per-series and global line formatting. */
export type LineStyleType = 'solid' | 'dashed' | 'dotted';

/** Resolved per-series formatting values. */
export interface SeriesFormatting {
  color: string;
  opacity: number;
  showLabels: boolean;
  lineStyle: LineStyleType;
  lineWidth: number;
}

/** Convert a LineStyleType to an SVG stroke-dasharray value. */
export function lineStyleToDashArray(style: LineStyleType | string): string {
  switch (style) {
    case 'dashed':
      return '6 3';
    case 'dotted':
      return '2 2';
    default:
      return 'none';
  }
}

/**
 * Resolve per-series formatting from a SeriesFormattingCard group.
 * Falls back to sensible defaults if no group exists for the given index.
 */
export function resolveSeriesFormatting(
  card: SeriesFormattingCard,
  seriesIndex: number,
  defaultColor: string,
): SeriesFormatting {
  const group = card.groups[seriesIndex];

  if (!group) {
    return {
      color: defaultColor,
      opacity: 100,
      showLabels: true,
      lineStyle: 'solid',
      lineWidth: 2,
    };
  }

  const colorVal = group.seriesColor.value?.value;
  return {
    color: colorVal && colorVal.length > 0 ? colorVal : defaultColor,
    opacity: group.seriesOpacity.value,
    showLabels: group.showDataLabels.value,
    lineStyle: (group.lineStyle.value?.value ?? 'solid') as LineStyleType,
    lineWidth: group.lineWidth.value,
  };
}

/**
 * Populate a SeriesFormattingCard with groups from dataView columns.
 * Reads persisted per-series objects and sets palette defaults.
 */
export function populateSeriesFormattingGroups(
  card: SeriesFormattingCard,
  dataView: { categorical?: { values?: ReadonlyArray<{
    source: {
      roles?: Record<string, boolean>;
      displayName?: string;
      queryName?: string;
      objects?: Record<string, Record<string, unknown>>;
    };
  }> } } | undefined,
  roleNames: string[],
  colorLookup: Map<string, string>,
  options?: { hideLineProps?: (role: Record<string, boolean>) => boolean },
): void {
  card.groups = [];

  if (!dataView?.categorical?.values) return;

  let groupIdx = 0;

  for (const col of dataView.categorical.values) {
    const role = col.source.roles;
    if (!role) continue;
    if (!roleNames.some((r) => role[r])) continue;

    const group = new SeriesFormattingGroup({
      name: `series_${groupIdx}`,
      displayName: col.source.displayName ?? `Series ${groupIdx + 1}`,
    });

    // Set default color from palette lookup
    const paletteColor = col.source.displayName ? colorLookup.get(col.source.displayName) : undefined;
    if (paletteColor) {
      group.seriesColor.value = { value: paletteColor };
    }

    // Optionally hide line-specific properties (e.g. for bar series)
    if (options?.hideLineProps?.(role)) {
      group.lineStyle.visible = false;
      group.lineWidth.visible = false;
    }

    // Set selector for data-bound persistence
    const selector = col.source.queryName ? { metadata: col.source.queryName } : undefined;
    if (selector) {
      for (const slice of group.slices) {
        (slice as { selector?: unknown }).selector = selector;
      }
    }

    // Read persisted values from objects
    const objects = col.source.objects?.['seriesFormatting'];
    if (objects) {
      const colorObj = objects['seriesColor'] as { solid?: { color?: string } } | undefined;
      if (colorObj?.solid?.color) {
        group.seriesColor.value = { value: colorObj.solid.color };
      }
      if (typeof objects['seriesOpacity'] === 'number') {
        group.seriesOpacity.value = objects['seriesOpacity'] as number;
      }
      if (typeof objects['showDataLabels'] === 'boolean') {
        group.showDataLabels.value = objects['showDataLabels'] as boolean;
      }
      const lineStyleObj = objects['lineStyle'] as { value?: string } | undefined;
      if (lineStyleObj?.value) {
        group.lineStyle.value = { value: lineStyleObj.value, displayName: lineStyleObj.value };
      }
      if (typeof objects['lineWidth'] === 'number') {
        group.lineWidth.value = objects['lineWidth'] as number;
      }
    }

    card.groups.push(group);
    groupIdx++;
  }
}

export class SeriesFormattingGroup extends formattingSettings.Group {
  seriesColor = new formattingSettings.ColorPicker({
    name: 'seriesColor',
    displayName: 'Color', displayNameKey: 'SharedSettings_DisplayName_0252',
    value: { value: '' },
  });

  seriesOpacity = new formattingSettings.NumUpDown({
    name: 'seriesOpacity',
    displayName: 'Opacity (%)', displayNameKey: 'SharedSettings_DisplayName_0253',
    value: 100,
  });

  showDataLabels = new formattingSettings.ToggleSwitch({
    name: 'showDataLabels',
    displayName: 'Show Data Labels', displayNameKey: 'SharedSettings_DisplayName_0254',
    value: true,
  });

  lineStyle = new formattingSettings.ItemDropdown({
    name: 'lineStyle',
    displayName: 'Line Style', displayNameKey: 'SharedSettings_DisplayName_0255',
    items: [
      { value: 'solid', displayName: 'Solid', displayNameKey: 'SharedSettings_DisplayName_0256' },
      { value: 'dashed', displayName: 'Dashed', displayNameKey: 'SharedSettings_DisplayName_0257' },
      { value: 'dotted', displayName: 'Dotted', displayNameKey: 'SharedSettings_DisplayName_0258' },
    ],
    value: { value: 'solid', displayName: 'Solid', displayNameKey: 'SharedSettings_DisplayName_0259' },
  });

  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width', displayNameKey: 'SharedSettings_DisplayName_0260',
    value: 2,
  });

  name = 'seriesGroup';
  displayName = 'Series';
  displayNameKey = 'SharedSettings_DisplayName_0015';
  slices = [
    this.seriesColor,
    this.seriesOpacity,
    this.showDataLabels,
    this.lineStyle,
    this.lineWidth,
  ];

  constructor(init?: Partial<Pick<SeriesFormattingGroup, 'name' | 'displayName'>>) {
    super();
    if (init?.name) this.name = init.name;
    if (init?.displayName) this.displayName = init.displayName;
  }
}

export class SeriesFormattingCard extends formattingSettings.CompositeCard {
  name = 'seriesFormatting';
  displayName = 'Series Formatting';
  displayNameKey = 'SharedSettings_DisplayName_0016';
  groups: SeriesFormattingGroup[] = [];
}

// ── Line Stroke Formatting ───────────────────────────────────────────

export class LineStrokeFormattingCard extends formattingSettings.SimpleCard {
  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width', displayNameKey: 'SharedSettings_DisplayName_0261',
    value: 2,
  });

  lineStyle = new formattingSettings.ItemDropdown({
    name: 'lineStyle',
    displayName: 'Line Style', displayNameKey: 'SharedSettings_DisplayName_0262',
    items: [
      { value: 'solid', displayName: 'Solid', displayNameKey: 'SharedSettings_DisplayName_0263' },
      { value: 'dashed', displayName: 'Dashed', displayNameKey: 'SharedSettings_DisplayName_0264' },
      { value: 'dotted', displayName: 'Dotted', displayNameKey: 'SharedSettings_DisplayName_0265' },
    ],
    value: { value: 'solid', displayName: 'Solid', displayNameKey: 'SharedSettings_DisplayName_0266' },
  });

  name = 'lineStrokeFormatting';
  displayName = 'Line Stroke';
  displayNameKey = 'SharedSettings_DisplayName_0017';
  slices = [this.lineWidth, this.lineStyle];
}

// ── Color Theme ─────────────────────────────────────────────────────

/** Display names for each color theme — kept in sync with COLOR_THEMES keys. */
const THEME_DISPLAY_NAMES: Record<ColorThemeName, string> = {
  default: 'Default',
  ocean: 'Ocean',
  sunset: 'Sunset',
  forest: 'Forest',
  berry: 'Berry',
  monochrome: 'Monochrome',
  earth: 'Earth',
};

const COLOR_THEME_ITEMS = (Object.keys(COLOR_THEMES) as ColorThemeName[]).map(k => ({
  value: k,
  displayName: THEME_DISPLAY_NAMES[k],
}));

export class ColorThemeFormattingCard extends formattingSettings.SimpleCard {
  colorTheme = new formattingSettings.ItemDropdown({
    name: 'colorTheme',
    displayName: 'Theme', displayNameKey: 'SharedSettings_DisplayName_0267',
    items: COLOR_THEME_ITEMS,
    value: { value: 'default', displayName: 'Default', displayNameKey: 'SharedSettings_DisplayName_0268' },
  });

  name = 'colorThemeFormatting';
  displayName = 'Color Theme';
  displayNameKey = 'SharedSettings_DisplayName_0018';
  slices = [this.colorTheme];
}

// ── Date Filter ─────────────────────────────────────────────────────

export class DateFilterFormattingCard extends formattingSettings.SimpleCard {
  enableDateFilter = new formattingSettings.ToggleSwitch({
    name: 'enableDateFilter',
    displayName: 'Enable Date Filter', displayNameKey: 'SharedSettings_DisplayName_0269',
    value: false,
  });

  startDate = new formattingSettings.TextInput({
    name: 'startDate',
    displayName: 'Start Date', displayNameKey: 'SharedSettings_DisplayName_0270',
    value: '',
    placeholder: 'YYYY-MM-DD', placeholderKey: 'SharedSettings_Placeholder_0016',
  });

  endAtCurrentDate = new formattingSettings.ToggleSwitch({
    name: 'endAtCurrentDate',
    displayName: 'End at Current Date', displayNameKey: 'SharedSettings_DisplayName_0271',
    value: true,
  });

  endDate = new formattingSettings.TextInput({
    name: 'endDate',
    displayName: 'End Date', displayNameKey: 'SharedSettings_DisplayName_0272',
    value: '',
    placeholder: 'YYYY-MM-DD', placeholderKey: 'SharedSettings_Placeholder_0017',
  });

  name = 'dateFilterFormatting';
  displayName = 'Date Filter';
  displayNameKey = 'SharedSettings_DisplayName_0019';
  slices = [this.enableDateFilter, this.startDate, this.endAtCurrentDate, this.endDate];
}

// ── Capabilities JSON Templates ──────────────────────────────────────

/** Merge these into a visual's capabilities.json `objects` block. */
export const CAPABILITIES_TEMPLATES: Record<string, Record<string, unknown>> = {
  seriesFormatting: {
    displayName: 'Series Formatting', displayNameKey: 'SharedSettings_DisplayName_0273',
    objectCategory: 2,
    properties: {
      seriesColor: { displayName: 'Color', displayNameKey: 'SharedSettings_DisplayName_0274', type: { fill: { solid: { color: true } } } },
      seriesOpacity: { displayName: 'Opacity (%)', displayNameKey: 'SharedSettings_DisplayName_0275', type: { numeric: true } },
      showDataLabels: { displayName: 'Show Data Labels', displayNameKey: 'SharedSettings_DisplayName_0276', type: { bool: true } },
      lineStyle: { displayName: 'Line Style', displayNameKey: 'SharedSettings_DisplayName_0277', type: { enumeration: [{ value: 'solid', displayName: 'Solid', displayNameKey: 'SharedSettings_DisplayName_0278' }, { value: 'dashed', displayName: 'Dashed', displayNameKey: 'SharedSettings_DisplayName_0279' }, { value: 'dotted', displayName: 'Dotted', displayNameKey: 'SharedSettings_DisplayName_0280' }] } },
      lineWidth: { displayName: 'Line Width', displayNameKey: 'SharedSettings_DisplayName_0281', type: { numeric: true } },
    },
  },
  axisFormatting: {
    displayName: 'Axis Formatting', displayNameKey: 'SharedSettings_DisplayName_0282',
    properties: {
      xAxisTitle: { displayName: 'X-Axis Title', displayNameKey: 'SharedSettings_DisplayName_0283', type: { text: true } },
      yAxisTitle: { displayName: 'Y-Axis Title', displayNameKey: 'SharedSettings_DisplayName_0284', type: { text: true } },
      axisLabelColor: { displayName: 'Label Color', displayNameKey: 'SharedSettings_DisplayName_0285', type: { fill: { solid: { color: true } } } },
      axisLabelSize: { displayName: 'Label Font Size', displayNameKey: 'SharedSettings_DisplayName_0286', type: { numeric: true } },
      axisLabelFontFamily: { displayName: 'Label Font', displayNameKey: 'SharedSettings_DisplayName_0287', type: { enumeration: FONT_FAMILY_ITEMS } },
      axisLabelFontWeight: { displayName: 'Label Font Weight', displayNameKey: 'SharedSettings_DisplayName_0288', type: { enumeration: FONT_WEIGHT_ITEMS } },
      axisLabelRotation: { displayName: 'X-Label Rotation (°)', displayNameKey: 'SharedSettings_DisplayName_0289', type: { numeric: true } },
      yAxisMin: { displayName: 'Y-Axis Min', displayNameKey: 'SharedSettings_DisplayName_0290', type: { numeric: true } },
      yAxisMax: { displayName: 'Y-Axis Max', displayNameKey: 'SharedSettings_DisplayName_0291', type: { numeric: true } },
      axisLineColor: { displayName: 'Axis Line Color', displayNameKey: 'SharedSettings_DisplayName_0292', type: { fill: { solid: { color: true } } } },
      axisLineWidth: { displayName: 'Axis Line Width', displayNameKey: 'SharedSettings_DisplayName_0293', type: { numeric: true } },
      showGridLines: { displayName: 'Show Grid Lines', displayNameKey: 'SharedSettings_DisplayName_0294', type: { bool: true } },
      gridLineColor: { displayName: 'Grid Line Color', displayNameKey: 'SharedSettings_DisplayName_0295', type: { fill: { solid: { color: true } } } },
      gridLineStyle: { displayName: 'Grid Line Style', displayNameKey: 'SharedSettings_DisplayName_0296', type: { enumeration: [{ value: 'solid', displayName: 'Solid', displayNameKey: 'SharedSettings_DisplayName_0297' }, { value: 'dashed', displayName: 'Dashed', displayNameKey: 'SharedSettings_DisplayName_0298' }] } },
      gridLineWidth: { displayName: 'Grid Line Width', displayNameKey: 'SharedSettings_DisplayName_0299', type: { numeric: true } },
      gridLineOpacity: { displayName: 'Grid Line Opacity (%)', displayNameKey: 'SharedSettings_DisplayName_0300', type: { numeric: true } },
    },
  },
  legendFormatting: {
    displayName: 'Legend', displayNameKey: 'SharedSettings_DisplayName_0301',
    properties: {
      showLegend: { displayName: 'Show Legend', displayNameKey: 'SharedSettings_DisplayName_0302', type: { bool: true } },
      legendPosition: { displayName: 'Position', displayNameKey: 'SharedSettings_DisplayName_0303', type: { enumeration: [{ value: 'bottom', displayName: 'Bottom', displayNameKey: 'SharedSettings_DisplayName_0304' }, { value: 'top', displayName: 'Top', displayNameKey: 'SharedSettings_DisplayName_0305' }, { value: 'left', displayName: 'Left', displayNameKey: 'SharedSettings_DisplayName_0306' }, { value: 'right', displayName: 'Right', displayNameKey: 'SharedSettings_DisplayName_0307' }] } },
      legendFontSize: { displayName: 'Font Size', displayNameKey: 'SharedSettings_DisplayName_0308', type: { numeric: true } },
      legendFontColor: { displayName: 'Font Color', displayNameKey: 'SharedSettings_DisplayName_0309', type: { fill: { solid: { color: true } } } },
      legendFontFamily: { displayName: 'Font', displayNameKey: 'SharedSettings_DisplayName_0310', type: { enumeration: FONT_FAMILY_ITEMS } },
      legendFontWeight: { displayName: 'Font Weight', displayNameKey: 'SharedSettings_DisplayName_0311', type: { enumeration: FONT_WEIGHT_ITEMS } },
    },
  },
  dataLabelFormatting: {
    displayName: 'Data Labels', displayNameKey: 'SharedSettings_DisplayName_0312',
    properties: {
      showDataLabels: { displayName: 'Show Data Labels', displayNameKey: 'SharedSettings_DisplayName_0313', type: { bool: true } },
      dataLabelFontSize: { displayName: 'Font Size', displayNameKey: 'SharedSettings_DisplayName_0314', type: { numeric: true } },
      dataLabelFontColor: { displayName: 'Font Color', displayNameKey: 'SharedSettings_DisplayName_0315', type: { fill: { solid: { color: true } } } },
      dataLabelFontWeight: { displayName: 'Font Weight', displayNameKey: 'SharedSettings_DisplayName_0316', type: { enumeration: [{ value: 'normal', displayName: 'Normal', displayNameKey: 'SharedSettings_DisplayName_0317' }, { value: 'bold', displayName: 'Bold', displayNameKey: 'SharedSettings_DisplayName_0318' }] } },
      dataLabelFontFamily: { displayName: 'Font', displayNameKey: 'SharedSettings_DisplayName_0319', type: { enumeration: FONT_FAMILY_ITEMS } },
      dataLabelPosition: { displayName: 'Position', displayNameKey: 'SharedSettings_DisplayName_0320', type: { enumeration: [{ value: 'auto', displayName: 'Auto', displayNameKey: 'SharedSettings_DisplayName_0321' }, { value: 'above', displayName: 'Above', displayNameKey: 'SharedSettings_DisplayName_0322' }, { value: 'below', displayName: 'Below', displayNameKey: 'SharedSettings_DisplayName_0323' }, { value: 'inside', displayName: 'Inside', displayNameKey: 'SharedSettings_DisplayName_0324' }, { value: 'outside', displayName: 'Outside', displayNameKey: 'SharedSettings_DisplayName_0325' }] } },
    },
  },
  titleFormatting: {
    displayName: 'Chart Title', displayNameKey: 'SharedSettings_DisplayName_0326',
    properties: {
      showTitle: { displayName: 'Show Title', displayNameKey: 'SharedSettings_DisplayName_0327', type: { bool: true } },
      titleText: { displayName: 'Title Text', displayNameKey: 'SharedSettings_DisplayName_0328', type: { text: true } },
      titleFontSize: { displayName: 'Font Size', displayNameKey: 'SharedSettings_DisplayName_0329', type: { numeric: true } },
      titleFontColor: { displayName: 'Font Color', displayNameKey: 'SharedSettings_DisplayName_0330', type: { fill: { solid: { color: true } } } },
      titleFontFamily: { displayName: 'Font', displayNameKey: 'SharedSettings_DisplayName_0331', type: { enumeration: FONT_FAMILY_ITEMS } },
      titleFontWeight: { displayName: 'Font Weight', displayNameKey: 'SharedSettings_DisplayName_0332', type: { enumeration: FONT_WEIGHT_ITEMS } },
      titleAlignment: { displayName: 'Alignment', displayNameKey: 'SharedSettings_DisplayName_0333', type: { enumeration: [{ value: 'left', displayName: 'Left', displayNameKey: 'SharedSettings_DisplayName_0334' }, { value: 'center', displayName: 'Center', displayNameKey: 'SharedSettings_DisplayName_0335' }, { value: 'right', displayName: 'Right', displayNameKey: 'SharedSettings_DisplayName_0336' }] } },
      subtitleText: { displayName: 'Subtitle', displayNameKey: 'SharedSettings_DisplayName_0337', type: { text: true } },
      subtitleFontSize: { displayName: 'Subtitle Font Size', displayNameKey: 'SharedSettings_DisplayName_0338', type: { numeric: true } },
      subtitleFontColor: { displayName: 'Subtitle Color', displayNameKey: 'SharedSettings_DisplayName_0339', type: { fill: { solid: { color: true } } } },
      subtitleFontFamily: { displayName: 'Subtitle Font', displayNameKey: 'SharedSettings_DisplayName_0340', type: { enumeration: FONT_FAMILY_ITEMS } },
      subtitleFontWeight: { displayName: 'Subtitle Font Weight', displayNameKey: 'SharedSettings_DisplayName_0341', type: { enumeration: FONT_WEIGHT_ITEMS } },
    },
  },
  numberFormatting: {
    displayName: 'Number Format', displayNameKey: 'SharedSettings_DisplayName_0342',
    properties: {
      displayUnits: { displayName: 'Display Units', displayNameKey: 'SharedSettings_DisplayName_0343', type: { enumeration: [{ value: 'auto', displayName: 'Auto', displayNameKey: 'SharedSettings_DisplayName_0344' }, { value: 'none', displayName: 'None', displayNameKey: 'SharedSettings_DisplayName_0345' }, { value: 'thousands', displayName: 'Thousands (K)', displayNameKey: 'SharedSettings_DisplayName_0346' }, { value: 'millions', displayName: 'Millions (M)', displayNameKey: 'SharedSettings_DisplayName_0347' }, { value: 'billions', displayName: 'Billions (B)', displayNameKey: 'SharedSettings_DisplayName_0348' }] } },
      decimalPlaces: { displayName: 'Decimal Places', displayNameKey: 'SharedSettings_DisplayName_0349', type: { numeric: true } },
      valuePrefix: { displayName: 'Prefix', displayNameKey: 'SharedSettings_DisplayName_0350', type: { text: true } },
      valueSuffix: { displayName: 'Suffix', displayNameKey: 'SharedSettings_DisplayName_0351', type: { text: true } },
    },
  },
  lineStrokeFormatting: {
    displayName: 'Line Stroke', displayNameKey: 'SharedSettings_DisplayName_0352',
    properties: {
      lineWidth: { displayName: 'Line Width', displayNameKey: 'SharedSettings_DisplayName_0353', type: { numeric: true } },
      lineStyle: { displayName: 'Line Style', displayNameKey: 'SharedSettings_DisplayName_0354', type: { enumeration: [{ value: 'solid', displayName: 'Solid', displayNameKey: 'SharedSettings_DisplayName_0355' }, { value: 'dashed', displayName: 'Dashed', displayNameKey: 'SharedSettings_DisplayName_0356' }, { value: 'dotted', displayName: 'Dotted', displayNameKey: 'SharedSettings_DisplayName_0357' }] } },
    },
  },
  scrollFormatting: {
    displayName: 'Scroll', displayNameKey: 'SharedSettings_DisplayName_0358',
    properties: {
      enableScroll: { displayName: 'Enable Scroll', displayNameKey: 'SharedSettings_DisplayName_0359', type: { bool: true } },
      minCategoryWidth: { displayName: 'Min Category Width (px)', displayNameKey: 'SharedSettings_DisplayName_0360', type: { numeric: true } },
    },
  },
  sortFormatting: {
    displayName: 'Sort Order', displayNameKey: 'SharedSettings_DisplayName_0361',
    properties: {
      sortBy: { displayName: 'Sort By', displayNameKey: 'SharedSettings_DisplayName_0362', type: { enumeration: [{ value: 'dataOrder', displayName: 'Data Order', displayNameKey: 'SharedSettings_DisplayName_0363' }, { value: 'valueAsc', displayName: 'Value (Ascending)', displayNameKey: 'SharedSettings_DisplayName_0364' }, { value: 'valueDesc', displayName: 'Value (Descending)', displayNameKey: 'SharedSettings_DisplayName_0365' }, { value: 'nameAsc', displayName: 'Name (A-Z)', displayNameKey: 'SharedSettings_DisplayName_0366' }, { value: 'nameDesc', displayName: 'Name (Z-A)', displayNameKey: 'SharedSettings_DisplayName_0367' }] } },
    },
  },
  referenceLineFormatting: {
    displayName: 'Reference Line', displayNameKey: 'SharedSettings_DisplayName_0368',
    properties: {
      showReferenceLine: { displayName: 'Show Reference Line', displayNameKey: 'SharedSettings_DisplayName_0369', type: { bool: true } },
      referenceLineType: { displayName: 'Type', displayNameKey: 'SharedSettings_DisplayName_0370', type: { enumeration: [{ value: 'custom', displayName: 'Custom Value', displayNameKey: 'SharedSettings_DisplayName_0371' }, { value: 'mean', displayName: 'Mean', displayNameKey: 'SharedSettings_DisplayName_0372' }, { value: 'median', displayName: 'Median', displayNameKey: 'SharedSettings_DisplayName_0373' }, { value: 'percentile', displayName: 'Percentile', displayNameKey: 'SharedSettings_DisplayName_0374' }, { value: 'min', displayName: 'Min', displayNameKey: 'SharedSettings_DisplayName_0375' }, { value: 'max', displayName: 'Max', displayNameKey: 'SharedSettings_DisplayName_0376' }] } },
      referenceLineValue: { displayName: 'Value', displayNameKey: 'SharedSettings_DisplayName_0377', type: { numeric: true } },
      referenceLineColor: { displayName: 'Line Color', displayNameKey: 'SharedSettings_DisplayName_0378', type: { fill: { solid: { color: true } } } },
      referenceLineWidth: { displayName: 'Line Width', displayNameKey: 'SharedSettings_DisplayName_0379', type: { numeric: true } },
      referenceLineStyle: { displayName: 'Line Style', displayNameKey: 'SharedSettings_DisplayName_0380', type: { enumeration: [{ value: 'solid', displayName: 'Solid', displayNameKey: 'SharedSettings_DisplayName_0381' }, { value: 'dashed', displayName: 'Dashed', displayNameKey: 'SharedSettings_DisplayName_0382' }, { value: 'dotted', displayName: 'Dotted', displayNameKey: 'SharedSettings_DisplayName_0383' }] } },
      showReferenceLabel: { displayName: 'Show Label', displayNameKey: 'SharedSettings_DisplayName_0384', type: { bool: true } },
      referenceLabelText: { displayName: 'Label Text', displayNameKey: 'SharedSettings_DisplayName_0385', type: { text: true } },
      showReferenceBand: { displayName: 'Show Band', displayNameKey: 'SharedSettings_DisplayName_0386', type: { bool: true } },
      referenceBandOpacity: { displayName: 'Band Opacity (%)', displayNameKey: 'SharedSettings_DisplayName_0387', type: { numeric: true } },
      referenceBandWidth: { displayName: 'Band Width (%)', displayNameKey: 'SharedSettings_DisplayName_0388', type: { numeric: true } },
      referenceLineAxis: { displayName: 'Target Axis', displayNameKey: 'SharedSettings_DisplayName_0389', type: { enumeration: [{ value: 'primary', displayName: 'Primary', displayNameKey: 'SharedSettings_DisplayName_0390' }, { value: 'secondary', displayName: 'Secondary', displayNameKey: 'SharedSettings_DisplayName_0391' }] } },
    },
  },
  trendLineFormatting: {
    displayName: 'Trend Line', displayNameKey: 'SharedSettings_DisplayName_0392',
    properties: {
      showTrendLine: { displayName: 'Show Trend Line', displayNameKey: 'SharedSettings_DisplayName_0393', type: { bool: true } },
      trendLineType: { displayName: 'Type', displayNameKey: 'SharedSettings_DisplayName_0394', type: { enumeration: [{ value: 'linear', displayName: 'Linear', displayNameKey: 'SharedSettings_DisplayName_0395' }, { value: 'polynomial', displayName: 'Polynomial', displayNameKey: 'SharedSettings_DisplayName_0396' }, { value: 'exponential', displayName: 'Exponential', displayNameKey: 'SharedSettings_DisplayName_0397' }, { value: 'logarithmic', displayName: 'Logarithmic', displayNameKey: 'SharedSettings_DisplayName_0398' }, { value: 'power', displayName: 'Power', displayNameKey: 'SharedSettings_DisplayName_0399' }] } },
      polynomialOrder: { displayName: 'Polynomial Order', displayNameKey: 'SharedSettings_DisplayName_0400', type: { numeric: true } },
      trendLineColor: { displayName: 'Line Color', displayNameKey: 'SharedSettings_DisplayName_0401', type: { fill: { solid: { color: true } } } },
      trendLineWidth: { displayName: 'Line Width', displayNameKey: 'SharedSettings_DisplayName_0402', type: { numeric: true } },
      showEquation: { displayName: 'Show Equation', displayNameKey: 'SharedSettings_DisplayName_0403', type: { bool: true } },
      showR2: { displayName: 'Show R²', displayNameKey: 'SharedSettings_DisplayName_0404', type: { bool: true } },
      trendLineAxis: { displayName: 'Target Axis', displayNameKey: 'SharedSettings_DisplayName_0405', type: { enumeration: [{ value: 'primary', displayName: 'Primary', displayNameKey: 'SharedSettings_DisplayName_0406' }, { value: 'secondary', displayName: 'Secondary', displayNameKey: 'SharedSettings_DisplayName_0407' }] } },
    },
  },
  targetFormatting: {
    displayName: 'Target Line', displayNameKey: 'SharedSettings_DisplayName_0408',
    properties: {
      showTarget: { displayName: 'Show Target Line', displayNameKey: 'SharedSettings_DisplayName_0409', type: { bool: true } },
      targetLabel: { displayName: 'Label', displayNameKey: 'SharedSettings_DisplayName_0410', type: { text: true } },
      targetLineColor: { displayName: 'Line Color', displayNameKey: 'SharedSettings_DisplayName_0411', type: { fill: { solid: { color: true } } } },
      targetLineWidth: { displayName: 'Line Width', displayNameKey: 'SharedSettings_DisplayName_0412', type: { numeric: true } },
      targetLineStyle: { displayName: 'Line Style', displayNameKey: 'SharedSettings_DisplayName_0413', type: { enumeration: [{ value: 'solid', displayName: 'Solid', displayNameKey: 'SharedSettings_DisplayName_0414' }, { value: 'dashed', displayName: 'Dashed', displayNameKey: 'SharedSettings_DisplayName_0415' }, { value: 'dotted', displayName: 'Dotted', displayNameKey: 'SharedSettings_DisplayName_0416' }] } },
      showTargetLabel: { displayName: 'Show Label', displayNameKey: 'SharedSettings_DisplayName_0417', type: { bool: true } },
      showTargetBand: { displayName: 'Show Band', displayNameKey: 'SharedSettings_DisplayName_0418', type: { bool: true } },
      targetBandHalfWidth: { displayName: 'Band Half Width', displayNameKey: 'SharedSettings_DisplayName_0419', type: { numeric: true } },
      targetBandOpacity: { displayName: 'Band Opacity (%)', displayNameKey: 'SharedSettings_DisplayName_0420', type: { numeric: true } },
      targetLineAxis: { displayName: 'Target Axis', displayNameKey: 'SharedSettings_DisplayName_0421', type: { enumeration: [{ value: 'primary', displayName: 'Primary', displayNameKey: 'SharedSettings_DisplayName_0422' }, { value: 'secondary', displayName: 'Secondary', displayNameKey: 'SharedSettings_DisplayName_0423' }] } },
    },
  },
  conditionalFormatting: {
    displayName: 'Conditional Formatting', displayNameKey: 'SharedSettings_DisplayName_0424',
    properties: {
      enableConditional: { displayName: 'Enable Conditional Formatting', displayNameKey: 'SharedSettings_DisplayName_0425', type: { bool: true } },
      conditionalDirection: { displayName: 'Direction', displayNameKey: 'SharedSettings_DisplayName_0426', type: { enumeration: [{ value: 'ascending', displayName: 'Ascending (Low = Bad)', displayNameKey: 'SharedSettings_DisplayName_0427' }, { value: 'descending', displayName: 'Descending (Low = Good)', displayNameKey: 'SharedSettings_DisplayName_0428' }] } },
      threshold1: { displayName: 'Threshold 1', displayNameKey: 'SharedSettings_DisplayName_0429', type: { numeric: true } },
      threshold2: { displayName: 'Threshold 2', displayNameKey: 'SharedSettings_DisplayName_0430', type: { numeric: true } },
      conditionalColor1: { displayName: 'Color 1 (Bad)', displayNameKey: 'SharedSettings_DisplayName_0431', type: { fill: { solid: { color: true } } } },
      conditionalColor2: { displayName: 'Color 2 (Warning)', displayNameKey: 'SharedSettings_DisplayName_0432', type: { fill: { solid: { color: true } } } },
      conditionalColor3: { displayName: 'Color 3 (Good)', displayNameKey: 'SharedSettings_DisplayName_0433', type: { fill: { solid: { color: true } } } },
    },
  },
  crosshairFormatting: {
    displayName: 'Crosshair', displayNameKey: 'SharedSettings_DisplayName_0434',
    properties: {
      showCrosshair: { displayName: 'Show Crosshair', displayNameKey: 'SharedSettings_DisplayName_0435', type: { bool: true } },
      crosshairLineColor: { displayName: 'Line Color', displayNameKey: 'SharedSettings_DisplayName_0436', type: { fill: { solid: { color: true } } } },
      crosshairLineWidth: { displayName: 'Line Width', displayNameKey: 'SharedSettings_DisplayName_0437', type: { numeric: true } },
      crosshairLineStyle: { displayName: 'Line Style', displayNameKey: 'SharedSettings_DisplayName_0438', type: { enumeration: [{ value: 'solid', displayName: 'Solid', displayNameKey: 'SharedSettings_DisplayName_0439' }, { value: 'dashed', displayName: 'Dashed', displayNameKey: 'SharedSettings_DisplayName_0440' }, { value: 'dotted', displayName: 'Dotted', displayNameKey: 'SharedSettings_DisplayName_0441' }] } },
      crosshairOpacity: { displayName: 'Opacity (%)', displayNameKey: 'SharedSettings_DisplayName_0442', type: { numeric: true } },
      showCrosshairValues: { displayName: 'Show Values', displayNameKey: 'SharedSettings_DisplayName_0443', type: { bool: true } },
    },
  },
  accessibilityFormatting: {
    displayName: 'Accessibility', displayNameKey: 'SharedSettings_DisplayName_0444',
    properties: {
      enableKeyboardNav: { displayName: 'Enable Keyboard Navigation', displayNameKey: 'SharedSettings_DisplayName_0445', type: { bool: true } },
    },
  },
  annotationFormatting: {
    displayName: 'Annotations', displayNameKey: 'SharedSettings_DisplayName_0446',
    properties: {
      showAnnotations: { displayName: 'Show Annotations', displayNameKey: 'SharedSettings_DisplayName_0447', type: { bool: true } },
      annotation1Category: { displayName: 'Annotation 1 — Category', displayNameKey: 'SharedSettings_DisplayName_0448', type: { text: true } },
      annotation1Text: { displayName: 'Annotation 1 — Text', displayNameKey: 'SharedSettings_DisplayName_0449', type: { text: true } },
      annotation1Position: { displayName: 'Annotation 1 — Position', displayNameKey: 'SharedSettings_DisplayName_0450', type: { enumeration: [{ value: 'above', displayName: 'Above', displayNameKey: 'SharedSettings_DisplayName_0451' }, { value: 'below', displayName: 'Below', displayNameKey: 'SharedSettings_DisplayName_0452' }, { value: 'left', displayName: 'Left', displayNameKey: 'SharedSettings_DisplayName_0453' }, { value: 'right', displayName: 'Right', displayNameKey: 'SharedSettings_DisplayName_0454' }] } },
      annotation2Category: { displayName: 'Annotation 2 — Category', displayNameKey: 'SharedSettings_DisplayName_0455', type: { text: true } },
      annotation2Text: { displayName: 'Annotation 2 — Text', displayNameKey: 'SharedSettings_DisplayName_0456', type: { text: true } },
      annotation2Position: { displayName: 'Annotation 2 — Position', displayNameKey: 'SharedSettings_DisplayName_0457', type: { enumeration: [{ value: 'above', displayName: 'Above', displayNameKey: 'SharedSettings_DisplayName_0458' }, { value: 'below', displayName: 'Below', displayNameKey: 'SharedSettings_DisplayName_0459' }, { value: 'left', displayName: 'Left', displayNameKey: 'SharedSettings_DisplayName_0460' }, { value: 'right', displayName: 'Right', displayNameKey: 'SharedSettings_DisplayName_0461' }] } },
      annotation3Category: { displayName: 'Annotation 3 — Category', displayNameKey: 'SharedSettings_DisplayName_0462', type: { text: true } },
      annotation3Text: { displayName: 'Annotation 3 — Text', displayNameKey: 'SharedSettings_DisplayName_0463', type: { text: true } },
      annotation3Position: { displayName: 'Annotation 3 — Position', displayNameKey: 'SharedSettings_DisplayName_0464', type: { enumeration: [{ value: 'above', displayName: 'Above', displayNameKey: 'SharedSettings_DisplayName_0465' }, { value: 'below', displayName: 'Below', displayNameKey: 'SharedSettings_DisplayName_0466' }, { value: 'left', displayName: 'Left', displayNameKey: 'SharedSettings_DisplayName_0467' }, { value: 'right', displayName: 'Right', displayNameKey: 'SharedSettings_DisplayName_0468' }] } },
      annotationFontSize: { displayName: 'Font Size', displayNameKey: 'SharedSettings_DisplayName_0469', type: { numeric: true } },
      annotationFontColor: { displayName: 'Font Color', displayNameKey: 'SharedSettings_DisplayName_0470', type: { fill: { solid: { color: true } } } },
      annotationFontFamily: { displayName: 'Font Family', displayNameKey: 'SharedSettings_DisplayName_0471', type: { enumeration: FONT_FAMILY_ITEMS } },
      annotationFontWeight: { displayName: 'Font Weight', displayNameKey: 'SharedSettings_DisplayName_0472', type: { enumeration: [{ value: 'normal', displayName: 'Normal', displayNameKey: 'SharedSettings_DisplayName_0473' }, { value: '500', displayName: 'Medium', displayNameKey: 'SharedSettings_DisplayName_0474' }, { value: '600', displayName: 'Semi-Bold', displayNameKey: 'SharedSettings_DisplayName_0475' }, { value: 'bold', displayName: 'Bold', displayNameKey: 'SharedSettings_DisplayName_0476' }] } },
      annotationConnectorColor: { displayName: 'Connector Color', displayNameKey: 'SharedSettings_DisplayName_0477', type: { fill: { solid: { color: true } } } },
      annotationOffset: { displayName: 'Callout Offset', displayNameKey: 'SharedSettings_DisplayName_0478', type: { numeric: true } },
      annotationPadding: { displayName: 'Badge Padding', displayNameKey: 'SharedSettings_DisplayName_0479', type: { numeric: true } },
      annotationBackgroundColor: { displayName: 'Badge Background', displayNameKey: 'SharedSettings_DisplayName_0480', type: { fill: { solid: { color: true } } } },
      annotationBackgroundOpacity: { displayName: 'Badge Opacity (%)', displayNameKey: 'SharedSettings_DisplayName_0481', type: { numeric: true } },
      annotationCornerRadius: { displayName: 'Badge Corner Radius', displayNameKey: 'SharedSettings_DisplayName_0482', type: { numeric: true } },
    },
  },
  dateFilterFormatting: {
    displayName: 'Date Filter', displayNameKey: 'SharedSettings_DisplayName_0483',
    properties: {
      enableDateFilter: { displayName: 'Enable Date Filter', displayNameKey: 'SharedSettings_DisplayName_0484', type: { bool: true } },
      startDate: { displayName: 'Start Date', displayNameKey: 'SharedSettings_DisplayName_0485', type: { text: true } },
      endAtCurrentDate: { displayName: 'End at Current Date', displayNameKey: 'SharedSettings_DisplayName_0486', type: { bool: true } },
      endDate: { displayName: 'End Date', displayNameKey: 'SharedSettings_DisplayName_0487', type: { text: true } },
    },
  },
  colorThemeFormatting: {
    displayName: 'Color Theme', displayNameKey: 'SharedSettings_DisplayName_0488',
    properties: {
      colorTheme: { displayName: 'Theme', displayNameKey: 'SharedSettings_DisplayName_0489', type: { enumeration: [{ value: 'default', displayName: 'Default', displayNameKey: 'SharedSettings_DisplayName_0490' }, { value: 'ocean', displayName: 'Ocean', displayNameKey: 'SharedSettings_DisplayName_0491' }, { value: 'sunset', displayName: 'Sunset', displayNameKey: 'SharedSettings_DisplayName_0492' }, { value: 'forest', displayName: 'Forest', displayNameKey: 'SharedSettings_DisplayName_0493' }, { value: 'berry', displayName: 'Berry', displayNameKey: 'SharedSettings_DisplayName_0494' }, { value: 'monochrome', displayName: 'Monochrome', displayNameKey: 'SharedSettings_DisplayName_0495' }, { value: 'earth', displayName: 'Earth', displayNameKey: 'SharedSettings_DisplayName_0496' }] } },
    },
  },
};
