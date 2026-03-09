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

const FONT_FAMILY_ITEMS = [
  { value: '', displayName: 'Default' },
  { value: 'Arial', displayName: 'Arial' },
  { value: 'Calibri', displayName: 'Calibri' },
  { value: 'Cambria', displayName: 'Cambria' },
  { value: 'Courier New', displayName: 'Courier New' },
  { value: 'Georgia', displayName: 'Georgia' },
  { value: 'Helvetica Neue', displayName: 'Helvetica Neue' },
  { value: 'Segoe UI', displayName: 'Segoe UI' },
  { value: 'Tahoma', displayName: 'Tahoma' },
  { value: 'Times New Roman', displayName: 'Times New Roman' },
  { value: 'Trebuchet MS', displayName: 'Trebuchet MS' },
  { value: 'Verdana', displayName: 'Verdana' },
];

// ── Axis Formatting ──────────────────────────────────────────────────

export class AxisFormattingCard extends formattingSettings.SimpleCard {
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

  xAxisTitle = new formattingSettings.TextInput({
    name: 'xAxisTitle',
    displayName: 'X-Axis Title',
    value: '',
    placeholder: 'Auto',
  });

  yAxisTitle = new formattingSettings.TextInput({
    name: 'yAxisTitle',
    displayName: 'Y-Axis Title',
    value: '',
    placeholder: 'Auto',
  });

  axisLabelColor = new formattingSettings.ColorPicker({
    name: 'axisLabelColor',
    displayName: 'Label Color',
    value: { value: '' },
  });

  axisLabelSize = new formattingSettings.NumUpDown({
    name: 'axisLabelSize',
    displayName: 'Label Font Size',
    value: 11,
  });

  axisLabelFontFamily = new formattingSettings.ItemDropdown({
    name: 'axisLabelFontFamily',
    displayName: 'Label Font',
    items: FONT_FAMILY_ITEMS,
    value: { value: '', displayName: 'Default' },
  });

  axisLabelRotation = new formattingSettings.NumUpDown({
    name: 'axisLabelRotation',
    displayName: 'X-Label Rotation (°)',
    value: 0,
  });

  yAxisMin = new formattingSettings.NumUpDown({
    name: 'yAxisMin',
    displayName: 'Y-Axis Min',
    value: null as unknown as number,
  });

  yAxisMax = new formattingSettings.NumUpDown({
    name: 'yAxisMax',
    displayName: 'Y-Axis Max',
    value: null as unknown as number,
  });

  axisLineColor = new formattingSettings.ColorPicker({
    name: 'axisLineColor',
    displayName: 'Axis Line Color',
    value: { value: '' },
  });

  axisLineWidth = new formattingSettings.NumUpDown({
    name: 'axisLineWidth',
    displayName: 'Axis Line Width',
    value: 1,
  });

  showGridLines = new formattingSettings.ToggleSwitch({
    name: 'showGridLines',
    displayName: 'Show Grid Lines',
    value: true,
  });

  gridLineColor = new formattingSettings.ColorPicker({
    name: 'gridLineColor',
    displayName: 'Grid Line Color',
    value: { value: '' },
  });

  gridLineStyle = new formattingSettings.ItemDropdown({
    name: 'gridLineStyle',
    displayName: 'Grid Line Style',
    items: [
      { value: 'solid', displayName: 'Solid' },
      { value: 'dashed', displayName: 'Dashed' },
    ],
    value: { value: 'dashed', displayName: 'Dashed' },
  });

  gridLineWidth = new formattingSettings.NumUpDown({
    name: 'gridLineWidth',
    displayName: 'Grid Line Width',
    value: 1,
  });

  gridLineOpacity = new formattingSettings.NumUpDown({
    name: 'gridLineOpacity',
    displayName: 'Grid Line Opacity (%)',
    value: 100,
  });

  name = 'axisFormatting';
  displayName = 'Axis Formatting';
  slices = [
    this.showXAxis,
    this.showYAxis,
    this.xAxisTitle,
    this.yAxisTitle,
    this.axisLabelColor,
    this.axisLabelSize,
    this.axisLabelFontFamily,
    this.axisLabelRotation,
    this.yAxisMin,
    this.yAxisMax,
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
    displayName: 'Show Legend',
    value: true,
  });

  legendPosition = new formattingSettings.ItemDropdown({
    name: 'legendPosition',
    displayName: 'Position',
    items: [
      { value: 'bottom', displayName: 'Bottom' },
      { value: 'top', displayName: 'Top' },
      { value: 'left', displayName: 'Left' },
      { value: 'right', displayName: 'Right' },
    ],
    value: { value: 'bottom', displayName: 'Bottom' },
  });

  legendFontSize = new formattingSettings.NumUpDown({
    name: 'legendFontSize',
    displayName: 'Font Size',
    value: 11,
  });

  legendFontColor = new formattingSettings.ColorPicker({
    name: 'legendFontColor',
    displayName: 'Font Color',
    value: { value: '' },
  });

  legendFontFamily = new formattingSettings.ItemDropdown({
    name: 'legendFontFamily',
    displayName: 'Font',
    items: FONT_FAMILY_ITEMS,
    value: { value: '', displayName: 'Default' },
  });

  name = 'legendFormatting';
  displayName = 'Legend';
  slices = [
    this.showLegend,
    this.legendPosition,
    this.legendFontSize,
    this.legendFontColor,
    this.legendFontFamily,
  ];
}

// ── Data Label Formatting ────────────────────────────────────────────

export class DataLabelFormattingCard extends formattingSettings.SimpleCard {
  showDataLabels = new formattingSettings.ToggleSwitch({
    name: 'showDataLabels',
    displayName: 'Show Data Labels',
    value: false,
  });

  dataLabelFontSize = new formattingSettings.NumUpDown({
    name: 'dataLabelFontSize',
    displayName: 'Font Size',
    value: 11,
  });

  dataLabelFontColor = new formattingSettings.ColorPicker({
    name: 'dataLabelFontColor',
    displayName: 'Font Color',
    value: { value: '' },
  });

  dataLabelFontWeight = new formattingSettings.ItemDropdown({
    name: 'dataLabelFontWeight',
    displayName: 'Font Weight',
    items: [
      { value: 'normal', displayName: 'Normal' },
      { value: 'bold', displayName: 'Bold' },
    ],
    value: { value: 'normal', displayName: 'Normal' },
  });

  dataLabelFontFamily = new formattingSettings.ItemDropdown({
    name: 'dataLabelFontFamily',
    displayName: 'Font',
    items: FONT_FAMILY_ITEMS,
    value: { value: '', displayName: 'Default' },
  });

  dataLabelPosition = new formattingSettings.ItemDropdown({
    name: 'dataLabelPosition',
    displayName: 'Position',
    items: [
      { value: 'auto', displayName: 'Auto' },
      { value: 'above', displayName: 'Above' },
      { value: 'below', displayName: 'Below' },
      { value: 'inside', displayName: 'Inside' },
      { value: 'outside', displayName: 'Outside' },
    ],
    value: { value: 'auto', displayName: 'Auto' },
  });

  name = 'dataLabelFormatting';
  displayName = 'Data Labels';
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
    displayName: 'Show Title',
    value: true,
  });

  titleText = new formattingSettings.TextInput({
    name: 'titleText',
    displayName: 'Title Text',
    value: '',
    placeholder: 'Chart Title',
  });

  titleFontSize = new formattingSettings.NumUpDown({
    name: 'titleFontSize',
    displayName: 'Font Size',
    value: 14,
  });

  titleFontColor = new formattingSettings.ColorPicker({
    name: 'titleFontColor',
    displayName: 'Font Color',
    value: { value: '' },
  });

  titleAlignment = new formattingSettings.ItemDropdown({
    name: 'titleAlignment',
    displayName: 'Alignment',
    items: [
      { value: 'left', displayName: 'Left' },
      { value: 'center', displayName: 'Center' },
      { value: 'right', displayName: 'Right' },
    ],
    value: { value: 'center', displayName: 'Center' },
  });

  titleFontFamily = new formattingSettings.ItemDropdown({
    name: 'titleFontFamily',
    displayName: 'Font',
    items: FONT_FAMILY_ITEMS,
    value: { value: '', displayName: 'Default' },
  });

  subtitleText = new formattingSettings.TextInput({
    name: 'subtitleText',
    displayName: 'Subtitle',
    value: '',
    placeholder: '',
  });

  subtitleFontSize = new formattingSettings.NumUpDown({
    name: 'subtitleFontSize',
    displayName: 'Subtitle Font Size',
    value: 11,
  });

  subtitleFontColor = new formattingSettings.ColorPicker({
    name: 'subtitleFontColor',
    displayName: 'Subtitle Color',
    value: { value: '' },
  });

  name = 'titleFormatting';
  displayName = 'Chart Title';
  slices = [
    this.showTitle,
    this.titleText,
    this.titleFontSize,
    this.titleFontColor,
    this.titleFontFamily,
    this.titleAlignment,
    this.subtitleText,
    this.subtitleFontSize,
    this.subtitleFontColor,
  ];
}

// ── Scroll Formatting ────────────────────────────────────────────────

export class ScrollFormattingCard extends formattingSettings.SimpleCard {
  enableScroll = new formattingSettings.ToggleSwitch({
    name: 'enableScroll',
    displayName: 'Enable Scroll',
    value: true,
  });

  minCategoryWidth = new formattingSettings.NumUpDown({
    name: 'minCategoryWidth',
    displayName: 'Min Category Width (px)',
    value: 40,
  });

  name = 'scrollFormatting';
  displayName = 'Scroll';
  slices = [this.enableScroll, this.minCategoryWidth];
}

// ── Number Formatting ────────────────────────────────────────────────

export class NumberFormattingCard extends formattingSettings.SimpleCard {
  displayUnits = new formattingSettings.ItemDropdown({
    name: 'displayUnits',
    displayName: 'Display Units',
    items: [
      { value: 'auto', displayName: 'Auto' },
      { value: 'none', displayName: 'None' },
      { value: 'thousands', displayName: 'Thousands (K)' },
      { value: 'millions', displayName: 'Millions (M)' },
      { value: 'billions', displayName: 'Billions (B)' },
    ],
    value: { value: 'auto', displayName: 'Auto' },
  });

  decimalPlaces = new formattingSettings.NumUpDown({
    name: 'decimalPlaces',
    displayName: 'Decimal Places',
    value: -1,
  });

  valuePrefix = new formattingSettings.TextInput({
    name: 'valuePrefix',
    displayName: 'Prefix',
    value: '',
    placeholder: 'e.g. $',
  });

  valueSuffix = new formattingSettings.TextInput({
    name: 'valueSuffix',
    displayName: 'Suffix',
    value: '',
    placeholder: 'e.g. %',
  });

  name = 'numberFormatting';
  displayName = 'Number Format';
  slices = [this.displayUnits, this.decimalPlaces, this.valuePrefix, this.valueSuffix];
}

// ── Sort Order ──────────────────────────────────────────────────────

export class SortFormattingCard extends formattingSettings.SimpleCard {
  sortBy = new formattingSettings.ItemDropdown({
    name: 'sortBy',
    displayName: 'Sort By',
    items: [
      { value: 'dataOrder', displayName: 'Data Order' },
      { value: 'valueAsc', displayName: 'Value (Ascending)' },
      { value: 'valueDesc', displayName: 'Value (Descending)' },
      { value: 'nameAsc', displayName: 'Name (A-Z)' },
      { value: 'nameDesc', displayName: 'Name (Z-A)' },
    ],
    value: { value: 'dataOrder', displayName: 'Data Order' },
  });

  name = 'sortFormatting';
  displayName = 'Sort Order';
  slices = [this.sortBy];
}

// ── Reference Line Formatting ────────────────────────────────────────

export class ReferenceLineFormattingCard extends formattingSettings.SimpleCard {
  showReferenceLine = new formattingSettings.ToggleSwitch({
    name: 'showReferenceLine',
    displayName: 'Show Reference Line',
    value: false,
  });

  referenceLineType = new formattingSettings.ItemDropdown({
    name: 'referenceLineType',
    displayName: 'Type',
    items: [
      { value: 'custom', displayName: 'Custom Value' },
      { value: 'mean', displayName: 'Mean' },
      { value: 'median', displayName: 'Median' },
      { value: 'percentile', displayName: 'Percentile' },
      { value: 'min', displayName: 'Min' },
      { value: 'max', displayName: 'Max' },
    ],
    value: { value: 'custom', displayName: 'Custom Value' },
  });

  referenceLineValue = new formattingSettings.NumUpDown({
    name: 'referenceLineValue',
    displayName: 'Value',
    value: 0,
  });

  referenceLineColor = new formattingSettings.ColorPicker({
    name: 'referenceLineColor',
    displayName: 'Line Color',
    value: { value: '#EF4444' },
  });

  referenceLineWidth = new formattingSettings.NumUpDown({
    name: 'referenceLineWidth',
    displayName: 'Line Width',
    value: 2,
  });

  referenceLineStyle = new formattingSettings.ItemDropdown({
    name: 'referenceLineStyle',
    displayName: 'Line Style',
    items: [
      { value: 'solid', displayName: 'Solid' },
      { value: 'dashed', displayName: 'Dashed' },
      { value: 'dotted', displayName: 'Dotted' },
    ],
    value: { value: 'dashed', displayName: 'Dashed' },
  });

  showReferenceLabel = new formattingSettings.ToggleSwitch({
    name: 'showReferenceLabel',
    displayName: 'Show Label',
    value: true,
  });

  referenceLabelText = new formattingSettings.TextInput({
    name: 'referenceLabelText',
    displayName: 'Label Text',
    value: '',
    placeholder: 'e.g. Target',
  });

  showReferenceBand = new formattingSettings.ToggleSwitch({
    name: 'showReferenceBand',
    displayName: 'Show Band',
    value: false,
  });

  referenceBandOpacity = new formattingSettings.NumUpDown({
    name: 'referenceBandOpacity',
    displayName: 'Band Opacity (%)',
    value: 10,
  });

  referenceBandWidth = new formattingSettings.NumUpDown({
    name: 'referenceBandWidth',
    displayName: 'Band Width (%)',
    value: 10,
  });

  referenceLineAxis = new formattingSettings.ItemDropdown({
    name: 'referenceLineAxis',
    displayName: 'Target Axis',
    items: [
      { value: 'primary', displayName: 'Primary' },
      { value: 'secondary', displayName: 'Secondary' },
    ],
    value: { value: 'primary', displayName: 'Primary' },
  });

  name = 'referenceLineFormatting';
  displayName = 'Reference Line';
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
    displayName: 'Show Trend Line',
    value: false,
  });

  trendLineType = new formattingSettings.ItemDropdown({
    name: 'trendLineType',
    displayName: 'Type',
    items: [
      { value: 'linear', displayName: 'Linear' },
      { value: 'polynomial', displayName: 'Polynomial' },
      { value: 'exponential', displayName: 'Exponential' },
      { value: 'logarithmic', displayName: 'Logarithmic' },
      { value: 'power', displayName: 'Power' },
    ],
    value: { value: 'linear', displayName: 'Linear' },
  });

  polynomialOrder = new formattingSettings.NumUpDown({
    name: 'polynomialOrder',
    displayName: 'Polynomial Order',
    value: 2,
  });

  trendLineColor = new formattingSettings.ColorPicker({
    name: 'trendLineColor',
    displayName: 'Line Color',
    value: { value: '#6366F1' },
  });

  trendLineWidth = new formattingSettings.NumUpDown({
    name: 'trendLineWidth',
    displayName: 'Line Width',
    value: 2,
  });

  showEquation = new formattingSettings.ToggleSwitch({
    name: 'showEquation',
    displayName: 'Show Equation',
    value: false,
  });

  showR2 = new formattingSettings.ToggleSwitch({
    name: 'showR2',
    displayName: 'Show R²',
    value: false,
  });

  trendLineAxis = new formattingSettings.ItemDropdown({
    name: 'trendLineAxis',
    displayName: 'Target Axis',
    items: [
      { value: 'primary', displayName: 'Primary' },
      { value: 'secondary', displayName: 'Secondary' },
    ],
    value: { value: 'primary', displayName: 'Primary' },
  });

  name = 'trendLineFormatting';
  displayName = 'Trend Line';
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
    displayName: 'Show Target Line',
    value: false,
  });

  targetLabel = new formattingSettings.TextInput({
    name: 'targetLabel',
    displayName: 'Label',
    value: 'Target',
    placeholder: 'Target',
  });

  targetLineColor = new formattingSettings.ColorPicker({
    name: 'targetLineColor',
    displayName: 'Line Color',
    value: { value: '#F59E0B' },
  });

  targetLineWidth = new formattingSettings.NumUpDown({
    name: 'targetLineWidth',
    displayName: 'Line Width',
    value: 2,
  });

  targetLineStyle = new formattingSettings.ItemDropdown({
    name: 'targetLineStyle',
    displayName: 'Line Style',
    items: [
      { value: 'solid', displayName: 'Solid' },
      { value: 'dashed', displayName: 'Dashed' },
      { value: 'dotted', displayName: 'Dotted' },
    ],
    value: { value: 'dashed', displayName: 'Dashed' },
  });

  showTargetLabel = new formattingSettings.ToggleSwitch({
    name: 'showTargetLabel',
    displayName: 'Show Label',
    value: true,
  });

  showTargetBand = new formattingSettings.ToggleSwitch({
    name: 'showTargetBand',
    displayName: 'Show Band',
    value: false,
  });

  targetBandHalfWidth = new formattingSettings.NumUpDown({
    name: 'targetBandHalfWidth',
    displayName: 'Band Half Width',
    value: 10,
  });

  targetBandOpacity = new formattingSettings.NumUpDown({
    name: 'targetBandOpacity',
    displayName: 'Band Opacity (%)',
    value: 8,
  });

  targetLineAxis = new formattingSettings.ItemDropdown({
    name: 'targetLineAxis',
    displayName: 'Target Axis',
    items: [
      { value: 'primary', displayName: 'Primary' },
      { value: 'secondary', displayName: 'Secondary' },
    ],
    value: { value: 'primary', displayName: 'Primary' },
  });

  name = 'targetFormatting';
  displayName = 'Target Line';
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
    displayName: 'Enable Conditional Formatting',
    value: false,
  });

  conditionalDirection = new formattingSettings.ItemDropdown({
    name: 'conditionalDirection',
    displayName: 'Direction',
    items: [
      { value: 'ascending', displayName: 'Ascending (Low = Bad)' },
      { value: 'descending', displayName: 'Descending (Low = Good)' },
    ],
    value: { value: 'ascending', displayName: 'Ascending (Low = Bad)' },
  });

  threshold1 = new formattingSettings.NumUpDown({
    name: 'threshold1',
    displayName: 'Threshold 1',
    value: 30,
  });

  threshold2 = new formattingSettings.NumUpDown({
    name: 'threshold2',
    displayName: 'Threshold 2',
    value: 70,
  });

  conditionalColor1 = new formattingSettings.ColorPicker({
    name: 'conditionalColor1',
    displayName: 'Color 1 (Bad)',
    value: { value: '#EF4444' },
  });

  conditionalColor2 = new formattingSettings.ColorPicker({
    name: 'conditionalColor2',
    displayName: 'Color 2 (Warning)',
    value: { value: '#F59E0B' },
  });

  conditionalColor3 = new formattingSettings.ColorPicker({
    name: 'conditionalColor3',
    displayName: 'Color 3 (Good)',
    value: { value: '#22C55E' },
  });

  name = 'conditionalFormatting';
  displayName = 'Conditional Formatting';
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
    displayName: 'Show Crosshair',
    value: true,
  });

  crosshairLineColor = new formattingSettings.ColorPicker({
    name: 'crosshairLineColor',
    displayName: 'Line Color',
    value: { value: '#94A3B8' },
  });

  crosshairLineWidth = new formattingSettings.NumUpDown({
    name: 'crosshairLineWidth',
    displayName: 'Line Width',
    value: 1,
  });

  crosshairLineStyle = new formattingSettings.ItemDropdown({
    name: 'crosshairLineStyle',
    displayName: 'Line Style',
    items: [
      { value: 'solid', displayName: 'Solid' },
      { value: 'dashed', displayName: 'Dashed' },
      { value: 'dotted', displayName: 'Dotted' },
    ],
    value: { value: 'dashed', displayName: 'Dashed' },
  });

  showCrosshairValues = new formattingSettings.ToggleSwitch({
    name: 'showCrosshairValues',
    displayName: 'Show Values',
    value: true,
  });

  name = 'crosshairFormatting';
  displayName = 'Crosshair';
  slices = [
    this.showCrosshair,
    this.crosshairLineColor,
    this.crosshairLineWidth,
    this.crosshairLineStyle,
    this.showCrosshairValues,
  ];
}

// ── Accessibility Formatting ────────────────────────────────────────

export class AccessibilityFormattingCard extends formattingSettings.SimpleCard {
  enableKeyboardNav = new formattingSettings.ToggleSwitch({
    name: 'enableKeyboardNav',
    displayName: 'Enable Keyboard Navigation',
    value: true,
  });

  name = 'accessibilityFormatting';
  displayName = 'Accessibility';
  slices = [
    this.enableKeyboardNav,
  ];
}

// ── Annotation Formatting ───────────────────────────────────────────

export class AnnotationFormattingCard extends formattingSettings.SimpleCard {
  showAnnotations = new formattingSettings.ToggleSwitch({
    name: 'showAnnotations',
    displayName: 'Show Annotations',
    value: false,
  });

  annotation1Category = new formattingSettings.TextInput({
    name: 'annotation1Category',
    displayName: 'Annotation 1 — Category',
    value: '',
    placeholder: 'Category name',
  });

  annotation1Text = new formattingSettings.TextInput({
    name: 'annotation1Text',
    displayName: 'Annotation 1 — Text',
    value: '',
    placeholder: 'Annotation text',
  });

  annotation1Position = new formattingSettings.ItemDropdown({
    name: 'annotation1Position',
    displayName: 'Annotation 1 — Position',
    items: [
      { value: 'above', displayName: 'Above' },
      { value: 'below', displayName: 'Below' },
      { value: 'left', displayName: 'Left' },
      { value: 'right', displayName: 'Right' },
    ],
    value: { value: 'above', displayName: 'Above' },
  });

  annotation2Category = new formattingSettings.TextInput({
    name: 'annotation2Category',
    displayName: 'Annotation 2 — Category',
    value: '',
    placeholder: 'Category name',
  });

  annotation2Text = new formattingSettings.TextInput({
    name: 'annotation2Text',
    displayName: 'Annotation 2 — Text',
    value: '',
    placeholder: 'Annotation text',
  });

  annotation2Position = new formattingSettings.ItemDropdown({
    name: 'annotation2Position',
    displayName: 'Annotation 2 — Position',
    items: [
      { value: 'above', displayName: 'Above' },
      { value: 'below', displayName: 'Below' },
      { value: 'left', displayName: 'Left' },
      { value: 'right', displayName: 'Right' },
    ],
    value: { value: 'above', displayName: 'Above' },
  });

  annotation3Category = new formattingSettings.TextInput({
    name: 'annotation3Category',
    displayName: 'Annotation 3 — Category',
    value: '',
    placeholder: 'Category name',
  });

  annotation3Text = new formattingSettings.TextInput({
    name: 'annotation3Text',
    displayName: 'Annotation 3 — Text',
    value: '',
    placeholder: 'Annotation text',
  });

  annotation3Position = new formattingSettings.ItemDropdown({
    name: 'annotation3Position',
    displayName: 'Annotation 3 — Position',
    items: [
      { value: 'above', displayName: 'Above' },
      { value: 'below', displayName: 'Below' },
      { value: 'left', displayName: 'Left' },
      { value: 'right', displayName: 'Right' },
    ],
    value: { value: 'above', displayName: 'Above' },
  });

  annotationFontSize = new formattingSettings.NumUpDown({
    name: 'annotationFontSize',
    displayName: 'Font Size',
    value: 11,
  });

  annotationFontColor = new formattingSettings.ColorPicker({
    name: 'annotationFontColor',
    displayName: 'Font Color',
    value: { value: '#475569' },
  });

  annotationConnectorColor = new formattingSettings.ColorPicker({
    name: 'annotationConnectorColor',
    displayName: 'Connector Color',
    value: { value: '#94A3B8' },
  });

  name = 'annotationFormatting';
  displayName = 'Annotations';
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
    this.annotationConnectorColor,
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
    displayName: 'Color',
    value: { value: '' },
  });

  seriesOpacity = new formattingSettings.NumUpDown({
    name: 'seriesOpacity',
    displayName: 'Opacity (%)',
    value: 100,
  });

  showDataLabels = new formattingSettings.ToggleSwitch({
    name: 'showDataLabels',
    displayName: 'Show Data Labels',
    value: true,
  });

  lineStyle = new formattingSettings.ItemDropdown({
    name: 'lineStyle',
    displayName: 'Line Style',
    items: [
      { value: 'solid', displayName: 'Solid' },
      { value: 'dashed', displayName: 'Dashed' },
      { value: 'dotted', displayName: 'Dotted' },
    ],
    value: { value: 'solid', displayName: 'Solid' },
  });

  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width',
    value: 2,
  });

  name = 'seriesGroup';
  displayName = 'Series';
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
  groups: SeriesFormattingGroup[] = [];
}

// ── Line Stroke Formatting ───────────────────────────────────────────

export class LineStrokeFormattingCard extends formattingSettings.SimpleCard {
  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width',
    value: 2,
  });

  lineStyle = new formattingSettings.ItemDropdown({
    name: 'lineStyle',
    displayName: 'Line Style',
    items: [
      { value: 'solid', displayName: 'Solid' },
      { value: 'dashed', displayName: 'Dashed' },
      { value: 'dotted', displayName: 'Dotted' },
    ],
    value: { value: 'solid', displayName: 'Solid' },
  });

  name = 'lineStrokeFormatting';
  displayName = 'Line Stroke';
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
    displayName: 'Theme',
    items: COLOR_THEME_ITEMS,
    value: { value: 'default', displayName: 'Default' },
  });

  name = 'colorThemeFormatting';
  displayName = 'Color Theme';
  slices = [this.colorTheme];
}

// ── Capabilities JSON Templates ──────────────────────────────────────

/** Merge these into a visual's capabilities.json `objects` block. */
export const CAPABILITIES_TEMPLATES: Record<string, Record<string, unknown>> = {
  seriesFormatting: {
    displayName: 'Series Formatting',
    objectCategory: 2,
    properties: {
      seriesColor: { displayName: 'Color', type: { fill: { solid: { color: true } } } },
      seriesOpacity: { displayName: 'Opacity (%)', type: { numeric: true } },
      showDataLabels: { displayName: 'Show Data Labels', type: { bool: true } },
      lineStyle: { displayName: 'Line Style', type: { enumeration: [{ value: 'solid', displayName: 'Solid' }, { value: 'dashed', displayName: 'Dashed' }, { value: 'dotted', displayName: 'Dotted' }] } },
      lineWidth: { displayName: 'Line Width', type: { numeric: true } },
    },
  },
  axisFormatting: {
    displayName: 'Axis Formatting',
    properties: {
      xAxisTitle: { displayName: 'X-Axis Title', type: { text: true } },
      yAxisTitle: { displayName: 'Y-Axis Title', type: { text: true } },
      axisLabelColor: { displayName: 'Label Color', type: { fill: { solid: { color: true } } } },
      axisLabelSize: { displayName: 'Label Font Size', type: { numeric: true } },
      axisLabelFontFamily: { displayName: 'Label Font', type: { enumeration: FONT_FAMILY_ITEMS } },
      axisLabelRotation: { displayName: 'X-Label Rotation (°)', type: { numeric: true } },
      yAxisMin: { displayName: 'Y-Axis Min', type: { numeric: true } },
      yAxisMax: { displayName: 'Y-Axis Max', type: { numeric: true } },
      axisLineColor: { displayName: 'Axis Line Color', type: { fill: { solid: { color: true } } } },
      axisLineWidth: { displayName: 'Axis Line Width', type: { numeric: true } },
      showGridLines: { displayName: 'Show Grid Lines', type: { bool: true } },
      gridLineColor: { displayName: 'Grid Line Color', type: { fill: { solid: { color: true } } } },
      gridLineStyle: { displayName: 'Grid Line Style', type: { enumeration: [{ value: 'solid', displayName: 'Solid' }, { value: 'dashed', displayName: 'Dashed' }] } },
      gridLineWidth: { displayName: 'Grid Line Width', type: { numeric: true } },
      gridLineOpacity: { displayName: 'Grid Line Opacity (%)', type: { numeric: true } },
    },
  },
  legendFormatting: {
    displayName: 'Legend',
    properties: {
      showLegend: { displayName: 'Show Legend', type: { bool: true } },
      legendPosition: { displayName: 'Position', type: { enumeration: [{ value: 'bottom', displayName: 'Bottom' }, { value: 'top', displayName: 'Top' }, { value: 'left', displayName: 'Left' }, { value: 'right', displayName: 'Right' }] } },
      legendFontSize: { displayName: 'Font Size', type: { numeric: true } },
      legendFontColor: { displayName: 'Font Color', type: { fill: { solid: { color: true } } } },
      legendFontFamily: { displayName: 'Font', type: { enumeration: FONT_FAMILY_ITEMS } },
    },
  },
  dataLabelFormatting: {
    displayName: 'Data Labels',
    properties: {
      showDataLabels: { displayName: 'Show Data Labels', type: { bool: true } },
      dataLabelFontSize: { displayName: 'Font Size', type: { numeric: true } },
      dataLabelFontColor: { displayName: 'Font Color', type: { fill: { solid: { color: true } } } },
      dataLabelFontWeight: { displayName: 'Font Weight', type: { enumeration: [{ value: 'normal', displayName: 'Normal' }, { value: 'bold', displayName: 'Bold' }] } },
      dataLabelFontFamily: { displayName: 'Font', type: { enumeration: FONT_FAMILY_ITEMS } },
      dataLabelPosition: { displayName: 'Position', type: { enumeration: [{ value: 'auto', displayName: 'Auto' }, { value: 'above', displayName: 'Above' }, { value: 'below', displayName: 'Below' }, { value: 'inside', displayName: 'Inside' }, { value: 'outside', displayName: 'Outside' }] } },
    },
  },
  titleFormatting: {
    displayName: 'Chart Title',
    properties: {
      showTitle: { displayName: 'Show Title', type: { bool: true } },
      titleText: { displayName: 'Title Text', type: { text: true } },
      titleFontSize: { displayName: 'Font Size', type: { numeric: true } },
      titleFontColor: { displayName: 'Font Color', type: { fill: { solid: { color: true } } } },
      titleFontFamily: { displayName: 'Font', type: { enumeration: FONT_FAMILY_ITEMS } },
      titleAlignment: { displayName: 'Alignment', type: { enumeration: [{ value: 'left', displayName: 'Left' }, { value: 'center', displayName: 'Center' }, { value: 'right', displayName: 'Right' }] } },
      subtitleText: { displayName: 'Subtitle', type: { text: true } },
      subtitleFontSize: { displayName: 'Subtitle Font Size', type: { numeric: true } },
      subtitleFontColor: { displayName: 'Subtitle Color', type: { fill: { solid: { color: true } } } },
    },
  },
  numberFormatting: {
    displayName: 'Number Format',
    properties: {
      displayUnits: { displayName: 'Display Units', type: { enumeration: [{ value: 'auto', displayName: 'Auto' }, { value: 'none', displayName: 'None' }, { value: 'thousands', displayName: 'Thousands (K)' }, { value: 'millions', displayName: 'Millions (M)' }, { value: 'billions', displayName: 'Billions (B)' }] } },
      decimalPlaces: { displayName: 'Decimal Places', type: { numeric: true } },
      valuePrefix: { displayName: 'Prefix', type: { text: true } },
      valueSuffix: { displayName: 'Suffix', type: { text: true } },
    },
  },
  lineStrokeFormatting: {
    displayName: 'Line Stroke',
    properties: {
      lineWidth: { displayName: 'Line Width', type: { numeric: true } },
      lineStyle: { displayName: 'Line Style', type: { enumeration: [{ value: 'solid', displayName: 'Solid' }, { value: 'dashed', displayName: 'Dashed' }, { value: 'dotted', displayName: 'Dotted' }] } },
    },
  },
  scrollFormatting: {
    displayName: 'Scroll',
    properties: {
      enableScroll: { displayName: 'Enable Scroll', type: { bool: true } },
      minCategoryWidth: { displayName: 'Min Category Width (px)', type: { numeric: true } },
    },
  },
  sortFormatting: {
    displayName: 'Sort Order',
    properties: {
      sortBy: { displayName: 'Sort By', type: { enumeration: [{ value: 'dataOrder', displayName: 'Data Order' }, { value: 'valueAsc', displayName: 'Value (Ascending)' }, { value: 'valueDesc', displayName: 'Value (Descending)' }, { value: 'nameAsc', displayName: 'Name (A-Z)' }, { value: 'nameDesc', displayName: 'Name (Z-A)' }] } },
    },
  },
  referenceLineFormatting: {
    displayName: 'Reference Line',
    properties: {
      showReferenceLine: { displayName: 'Show Reference Line', type: { bool: true } },
      referenceLineType: { displayName: 'Type', type: { enumeration: [{ value: 'custom', displayName: 'Custom Value' }, { value: 'mean', displayName: 'Mean' }, { value: 'median', displayName: 'Median' }, { value: 'percentile', displayName: 'Percentile' }, { value: 'min', displayName: 'Min' }, { value: 'max', displayName: 'Max' }] } },
      referenceLineValue: { displayName: 'Value', type: { numeric: true } },
      referenceLineColor: { displayName: 'Line Color', type: { fill: { solid: { color: true } } } },
      referenceLineWidth: { displayName: 'Line Width', type: { numeric: true } },
      referenceLineStyle: { displayName: 'Line Style', type: { enumeration: [{ value: 'solid', displayName: 'Solid' }, { value: 'dashed', displayName: 'Dashed' }, { value: 'dotted', displayName: 'Dotted' }] } },
      showReferenceLabel: { displayName: 'Show Label', type: { bool: true } },
      referenceLabelText: { displayName: 'Label Text', type: { text: true } },
      showReferenceBand: { displayName: 'Show Band', type: { bool: true } },
      referenceBandOpacity: { displayName: 'Band Opacity (%)', type: { numeric: true } },
      referenceBandWidth: { displayName: 'Band Width (%)', type: { numeric: true } },
      referenceLineAxis: { displayName: 'Target Axis', type: { enumeration: [{ value: 'primary', displayName: 'Primary' }, { value: 'secondary', displayName: 'Secondary' }] } },
    },
  },
  trendLineFormatting: {
    displayName: 'Trend Line',
    properties: {
      showTrendLine: { displayName: 'Show Trend Line', type: { bool: true } },
      trendLineType: { displayName: 'Type', type: { enumeration: [{ value: 'linear', displayName: 'Linear' }, { value: 'polynomial', displayName: 'Polynomial' }, { value: 'exponential', displayName: 'Exponential' }, { value: 'logarithmic', displayName: 'Logarithmic' }, { value: 'power', displayName: 'Power' }] } },
      polynomialOrder: { displayName: 'Polynomial Order', type: { numeric: true } },
      trendLineColor: { displayName: 'Line Color', type: { fill: { solid: { color: true } } } },
      trendLineWidth: { displayName: 'Line Width', type: { numeric: true } },
      showEquation: { displayName: 'Show Equation', type: { bool: true } },
      showR2: { displayName: 'Show R²', type: { bool: true } },
      trendLineAxis: { displayName: 'Target Axis', type: { enumeration: [{ value: 'primary', displayName: 'Primary' }, { value: 'secondary', displayName: 'Secondary' }] } },
    },
  },
  targetFormatting: {
    displayName: 'Target Line',
    properties: {
      showTarget: { displayName: 'Show Target Line', type: { bool: true } },
      targetLabel: { displayName: 'Label', type: { text: true } },
      targetLineColor: { displayName: 'Line Color', type: { fill: { solid: { color: true } } } },
      targetLineWidth: { displayName: 'Line Width', type: { numeric: true } },
      targetLineStyle: { displayName: 'Line Style', type: { enumeration: [{ value: 'solid', displayName: 'Solid' }, { value: 'dashed', displayName: 'Dashed' }, { value: 'dotted', displayName: 'Dotted' }] } },
      showTargetLabel: { displayName: 'Show Label', type: { bool: true } },
      showTargetBand: { displayName: 'Show Band', type: { bool: true } },
      targetBandHalfWidth: { displayName: 'Band Half Width', type: { numeric: true } },
      targetBandOpacity: { displayName: 'Band Opacity (%)', type: { numeric: true } },
      targetLineAxis: { displayName: 'Target Axis', type: { enumeration: [{ value: 'primary', displayName: 'Primary' }, { value: 'secondary', displayName: 'Secondary' }] } },
    },
  },
  conditionalFormatting: {
    displayName: 'Conditional Formatting',
    properties: {
      enableConditional: { displayName: 'Enable Conditional Formatting', type: { bool: true } },
      conditionalDirection: { displayName: 'Direction', type: { enumeration: [{ value: 'ascending', displayName: 'Ascending (Low = Bad)' }, { value: 'descending', displayName: 'Descending (Low = Good)' }] } },
      threshold1: { displayName: 'Threshold 1', type: { numeric: true } },
      threshold2: { displayName: 'Threshold 2', type: { numeric: true } },
      conditionalColor1: { displayName: 'Color 1 (Bad)', type: { fill: { solid: { color: true } } } },
      conditionalColor2: { displayName: 'Color 2 (Warning)', type: { fill: { solid: { color: true } } } },
      conditionalColor3: { displayName: 'Color 3 (Good)', type: { fill: { solid: { color: true } } } },
    },
  },
  crosshairFormatting: {
    displayName: 'Crosshair',
    properties: {
      showCrosshair: { displayName: 'Show Crosshair', type: { bool: true } },
      crosshairLineColor: { displayName: 'Line Color', type: { fill: { solid: { color: true } } } },
      crosshairLineWidth: { displayName: 'Line Width', type: { numeric: true } },
      crosshairLineStyle: { displayName: 'Line Style', type: { enumeration: [{ value: 'solid', displayName: 'Solid' }, { value: 'dashed', displayName: 'Dashed' }, { value: 'dotted', displayName: 'Dotted' }] } },
      showCrosshairValues: { displayName: 'Show Values', type: { bool: true } },
    },
  },
  accessibilityFormatting: {
    displayName: 'Accessibility',
    properties: {
      enableKeyboardNav: { displayName: 'Enable Keyboard Navigation', type: { bool: true } },
    },
  },
  annotationFormatting: {
    displayName: 'Annotations',
    properties: {
      showAnnotations: { displayName: 'Show Annotations', type: { bool: true } },
      annotation1Category: { displayName: 'Annotation 1 — Category', type: { text: true } },
      annotation1Text: { displayName: 'Annotation 1 — Text', type: { text: true } },
      annotation1Position: { displayName: 'Annotation 1 — Position', type: { enumeration: [{ value: 'above', displayName: 'Above' }, { value: 'below', displayName: 'Below' }, { value: 'left', displayName: 'Left' }, { value: 'right', displayName: 'Right' }] } },
      annotation2Category: { displayName: 'Annotation 2 — Category', type: { text: true } },
      annotation2Text: { displayName: 'Annotation 2 — Text', type: { text: true } },
      annotation2Position: { displayName: 'Annotation 2 — Position', type: { enumeration: [{ value: 'above', displayName: 'Above' }, { value: 'below', displayName: 'Below' }, { value: 'left', displayName: 'Left' }, { value: 'right', displayName: 'Right' }] } },
      annotation3Category: { displayName: 'Annotation 3 — Category', type: { text: true } },
      annotation3Text: { displayName: 'Annotation 3 — Text', type: { text: true } },
      annotation3Position: { displayName: 'Annotation 3 — Position', type: { enumeration: [{ value: 'above', displayName: 'Above' }, { value: 'below', displayName: 'Below' }, { value: 'left', displayName: 'Left' }, { value: 'right', displayName: 'Right' }] } },
      annotationFontSize: { displayName: 'Font Size', type: { numeric: true } },
      annotationFontColor: { displayName: 'Font Color', type: { fill: { solid: { color: true } } } },
      annotationConnectorColor: { displayName: 'Connector Color', type: { fill: { solid: { color: true } } } },
    },
  },
  colorThemeFormatting: {
    displayName: 'Color Theme',
    properties: {
      colorTheme: { displayName: 'Theme', type: { enumeration: [{ value: 'default', displayName: 'Default' }, { value: 'ocean', displayName: 'Ocean' }, { value: 'sunset', displayName: 'Sunset' }, { value: 'forest', displayName: 'Forest' }, { value: 'berry', displayName: 'Berry' }, { value: 'monochrome', displayName: 'Monochrome' }, { value: 'earth', displayName: 'Earth' }] } },
    },
  },
};
