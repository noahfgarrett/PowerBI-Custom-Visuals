/**
 * Bar Chart Pro — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 *
 * Reorganized: 30 → 29 cards (pattern fill merged into bar settings)
 * Cards reordered into logical groups:
 * 1. Chart Type: Chart Mode
 * 2. Bar & Line Appearance: Bar Settings (incl. Pattern Fill), Line Settings, Secondary Axis, Series Colors
 * 3. Data Labels
 * 4. Overlays & Analysis: Target Line, Reference Line, Trend Line, Pareto, Benchmark Band, Variance
 * 5. Axes & Grid: Axes, Scroll, Zoom
 * 6. Layout: Top N, Small Multiples, Drill-Down
 * 7. Chrome & Styling: Title, Legend, Card Style, Animation, Number Format, Line Number Format
 * 8. Advanced: Conditional, Annotations, Accessibility, Color Theme, Date Filter
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import {
  AxisFormattingCard,
  LegendFormattingCard,
  DataLabelFormattingCard,
  TitleFormattingCard,
  ScrollFormattingCard,
  NumberFormattingCard,
  ReferenceLineFormattingCard,
  TrendLineFormattingCard,
  ConditionalFormattingCard,
  AnnotationFormattingCard,
  AccessibilityFormattingCard,
  SeriesFormattingCard,
  ColorThemeFormattingCard,
  DateFilterFormattingCard,
  CrosshairFormattingCard,
  CARD_STYLE_MODE_ITEMS
} from '../../core/src';

// ── Chart Mode ──────────────────────────────────────────────────────

class ChartModeSettings extends formattingSettings.SimpleCard {
  mode = new formattingSettings.ItemDropdown({
    name: 'mode',
    displayName: 'Mode', displayNameKey: 'BarChartProSettings_DisplayName_0017',
    items: [
      { value: 'grouped', displayName: 'Grouped', displayNameKey: 'BarChartProSettings_DisplayName_0018' },
      { value: 'stacked', displayName: 'Stacked', displayNameKey: 'BarChartProSettings_DisplayName_0019' },
      { value: 'stacked100', displayName: '100% Stacked', displayNameKey: 'BarChartProSettings_DisplayName_0020' },
      { value: 'combo', displayName: 'Combo (Bar + Line)', displayNameKey: 'BarChartProSettings_DisplayName_0021' },
      { value: 'horizontal', displayName: 'Horizontal', displayNameKey: 'BarChartProSettings_DisplayName_0022' },
      { value: 'diverging', displayName: 'Diverging', displayNameKey: 'BarChartProSettings_DisplayName_0023' },
      { value: 'waterfall', displayName: 'Waterfall', displayNameKey: 'BarChartProSettings_DisplayName_0024' },
    ],
    value: { value: 'grouped', displayName: 'Grouped', displayNameKey: 'BarChartProSettings_DisplayName_0025' },
  });

  name = 'chartMode';
  displayName = 'Chart Mode';
  displayNameKey = 'BarChartProSettings_DisplayName_0001';
  slices = [this.mode];
}

// ── Bar Settings (merged with Pattern Fill) ─────────────────────────

class BarSettings extends formattingSettings.SimpleCard {
  barStyle = new formattingSettings.ItemDropdown({
    name: 'barStyle',
    displayName: 'Bar Style', displayNameKey: 'BarChartProSettings_DisplayName_0026',
    items: [
      { value: 'bar', displayName: 'Bar', displayNameKey: 'BarChartProSettings_DisplayName_0027' },
      { value: 'lollipop', displayName: 'Lollipop', displayNameKey: 'BarChartProSettings_DisplayName_0028' },
    ],
    value: { value: 'bar', displayName: 'Bar', displayNameKey: 'BarChartProSettings_DisplayName_0029' },
  });

  cornerRadius = new formattingSettings.NumUpDown({
    name: 'cornerRadius',
    displayName: 'Corner Radius', displayNameKey: 'BarChartProSettings_DisplayName_0030',
    value: 4,
  });

  barSpacing = new formattingSettings.NumUpDown({
    name: 'barSpacing',
    displayName: 'Bar Spacing', displayNameKey: 'BarChartProSettings_DisplayName_0031',
    value: 2,
  });

  showDataLabels = new formattingSettings.ItemDropdown({
    name: 'showDataLabels',
    displayName: 'Data Labels', displayNameKey: 'BarChartProSettings_DisplayName_0032',
    items: [
      { value: 'none', displayName: 'None', displayNameKey: 'BarChartProSettings_DisplayName_0033' },
      { value: 'above', displayName: 'Above', displayNameKey: 'BarChartProSettings_DisplayName_0034' },
      { value: 'inside', displayName: 'Inside', displayNameKey: 'BarChartProSettings_DisplayName_0035' },
    ],
    value: { value: 'none', displayName: 'None', displayNameKey: 'BarChartProSettings_DisplayName_0036' },
  });

  barBorderColor = new formattingSettings.ColorPicker({
    name: 'barBorderColor',
    displayName: 'Bar Border Color', displayNameKey: 'BarChartProSettings_DisplayName_0037',
    value: { value: '' },
  });

  barBorderWidth = new formattingSettings.NumUpDown({
    name: 'barBorderWidth',
    displayName: 'Bar Border Width', displayNameKey: 'BarChartProSettings_DisplayName_0038',
    value: 0,
  });

  barOpacity = new formattingSettings.NumUpDown({
    name: 'barOpacity',
    displayName: 'Bar Opacity (%)', displayNameKey: 'BarChartProSettings_DisplayName_0039',
    value: 100,
  });

  useGradient = new formattingSettings.ToggleSwitch({
    name: 'useGradient',
    displayName: 'Gradient Fill', displayNameKey: 'BarChartProSettings_DisplayName_0040',
    value: false,
  });

  // Pattern Fill (merged from PatternFillSettingsCard)
  patternEnabled = new formattingSettings.ToggleSwitch({
    name: 'patternEnabled',
    displayName: 'Enable Pattern Fill', displayNameKey: 'BarChartProSettings_DisplayName_0041',
    value: false,
  });

  pattern = new formattingSettings.ItemDropdown({
    name: 'pattern',
    displayName: 'Pattern', displayNameKey: 'BarChartProSettings_DisplayName_0042',
    items: [
      { value: 'diagonal', displayName: 'Diagonal Lines', displayNameKey: 'BarChartProSettings_DisplayName_0043' },
      { value: 'crosshatch', displayName: 'Crosshatch', displayNameKey: 'BarChartProSettings_DisplayName_0044' },
      { value: 'dots', displayName: 'Dots', displayNameKey: 'BarChartProSettings_DisplayName_0045' },
      { value: 'horizontal', displayName: 'Horizontal Lines', displayNameKey: 'BarChartProSettings_DisplayName_0046' },
      { value: 'vertical', displayName: 'Vertical Lines', displayNameKey: 'BarChartProSettings_DisplayName_0047' },
    ],
    value: { value: 'diagonal', displayName: 'Diagonal Lines', displayNameKey: 'BarChartProSettings_DisplayName_0048' },
  });

  patternOpacity = new formattingSettings.NumUpDown({
    name: 'patternOpacity',
    displayName: 'Pattern Opacity (%)', displayNameKey: 'BarChartProSettings_DisplayName_0049',
    value: 30,
  });

  lollipopDotRadius = new formattingSettings.NumUpDown({
    name: 'lollipopDotRadius',
    displayName: 'Lollipop Dot Radius', displayNameKey: 'BarChartProSettings_DisplayName_0050',
    value: 6,
  });

  lollipopStemWidth = new formattingSettings.NumUpDown({
    name: 'lollipopStemWidth',
    displayName: 'Lollipop Stem Width', displayNameKey: 'BarChartProSettings_DisplayName_0051',
    value: 2,
  });

  name = 'barSettings';
  displayName = 'Bar Settings';
  displayNameKey = 'BarChartProSettings_DisplayName_0002';
  slices = [
    this.barStyle, this.cornerRadius, this.barSpacing, this.showDataLabels,
    this.barBorderColor, this.barBorderWidth, this.barOpacity, this.useGradient,
    this.patternEnabled, this.pattern, this.patternOpacity,
    this.lollipopDotRadius, this.lollipopStemWidth,
  ];
}

// ── Line Settings (combo mode) ──────────────────────────────────────

class LineSettings extends formattingSettings.SimpleCard {
  showDots = new formattingSettings.ToggleSwitch({
    name: 'showDots',
    displayName: 'Show Dots', displayNameKey: 'BarChartProSettings_DisplayName_0052',
    value: true,
  });

  showLineDataLabels = new formattingSettings.ToggleSwitch({
    name: 'showLineDataLabels',
    displayName: 'Show Data Labels', displayNameKey: 'BarChartProSettings_DisplayName_0053',
    value: false,
  });

  lineGradientFill = new formattingSettings.ToggleSwitch({
    name: 'lineGradientFill',
    displayName: 'Gradient Fill Under Line', displayNameKey: 'BarChartProSettings_DisplayName_0054',
    value: false,
  });

  lineGradientOpacity = new formattingSettings.NumUpDown({
    name: 'lineGradientOpacity',
    displayName: 'Gradient Opacity (%)', displayNameKey: 'BarChartProSettings_DisplayName_0055',
    value: 30,
  });

  lineDotRadius = new formattingSettings.NumUpDown({
    name: 'lineDotRadius',
    displayName: 'Dot Radius', displayNameKey: 'BarChartProSettings_DisplayName_0056',
    value: 4,
  });

  lineDataLabelFontSize = new formattingSettings.NumUpDown({
    name: 'lineDataLabelFontSize',
    displayName: 'Data Label Font Size', displayNameKey: 'BarChartProSettings_DisplayName_0057',
    value: 10,
  });

  lineDataLabelFontColor = new formattingSettings.ColorPicker({
    name: 'lineDataLabelFontColor',
    displayName: 'Data Label Font Color', displayNameKey: 'BarChartProSettings_DisplayName_0058',
    value: { value: '' },
  });

  lineDataLabelFontFamily = new formattingSettings.ItemDropdown({
    name: 'lineDataLabelFontFamily',
    displayName: 'Data Label Font', displayNameKey: 'BarChartProSettings_DisplayName_0059',
    items: [
      { value: '', displayName: 'Default', displayNameKey: 'BarChartProSettings_DisplayName_0060' },
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'BarChartProSettings_DisplayName_0061' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'BarChartProSettings_DisplayName_0062' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'BarChartProSettings_DisplayName_0063' },
      { value: 'Helvetica Neue', displayName: 'Helvetica Neue', displayNameKey: 'BarChartProSettings_DisplayName_0064' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'BarChartProSettings_DisplayName_0065' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'BarChartProSettings_DisplayName_0066' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'BarChartProSettings_DisplayName_0067' },
    ],
    value: { value: '', displayName: 'Default', displayNameKey: 'BarChartProSettings_DisplayName_0068' },
  });

  lineDataLabelFontWeight = new formattingSettings.ItemDropdown({
    name: 'lineDataLabelFontWeight',
    displayName: 'Data Label Font Weight', displayNameKey: 'BarChartProSettings_DisplayName_0069',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'BarChartProSettings_DisplayName_0070' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'BarChartProSettings_DisplayName_0071' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'BarChartProSettings_DisplayName_0072' },
    ],
    value: { value: '600', displayName: 'Semi-Bold', displayNameKey: 'BarChartProSettings_DisplayName_0073' },
  });

  lineDataLabelOffset = new formattingSettings.NumUpDown({
    name: 'lineDataLabelOffset',
    displayName: 'Data Label Offset', displayNameKey: 'BarChartProSettings_DisplayName_0074',
    value: 10,
  });

  name = 'lineSettings';
  displayName = 'Line Settings';
  displayNameKey = 'BarChartProSettings_DisplayName_0003';
  slices = [
    this.showDots,
    this.showLineDataLabels,
    this.lineDataLabelFontSize,
    this.lineDataLabelFontColor,
    this.lineDataLabelFontFamily,
    this.lineDataLabelFontWeight,
    this.lineDataLabelOffset,
    this.lineGradientFill,
    this.lineGradientOpacity,
    this.lineDotRadius,
  ];
}

// ── Secondary Axis Settings (combo mode only) ──────────────────────

class SecondaryAxisSettingsCard extends formattingSettings.SimpleCard {
  showSecondaryYAxis = new formattingSettings.ToggleSwitch({
    name: 'showSecondaryYAxis',
    displayName: 'Show Secondary Y-Axis', displayNameKey: 'BarChartProSettings_DisplayName_0075',
    value: false,
  });

  secondaryYAxisTitle = new formattingSettings.TextInput({
    name: 'secondaryYAxisTitle',
    displayName: 'Secondary Y-Axis Title', displayNameKey: 'BarChartProSettings_DisplayName_0076',
    value: '',
    placeholder: 'e.g. Revenue', placeholderKey: 'BarChartProSettings_Placeholder_0001',
  });

  name = 'secondaryAxisSettings';
  displayName = 'Secondary Axis';
  displayNameKey = 'BarChartProSettings_DisplayName_0004';
  slices = [this.showSecondaryYAxis, this.secondaryYAxisTitle];
}

// ── Data Roles ──────────────────────────────────────────────────────

class DataRolesSettingsCard extends formattingSettings.SimpleCard {
  colorBy = new formattingSettings.ItemDropdown({
    name: 'colorBy',
    displayName: 'Color Bars By', displayNameKey: 'BarChartProSettings_DisplayName_0158',
    items: [
      { value: 'series', displayName: 'Series', displayNameKey: 'BarChartProSettings_DisplayName_0159' },
      { value: 'category', displayName: 'Category', displayNameKey: 'BarChartProSettings_DisplayName_0160' },
    ],
    value: { value: 'series', displayName: 'Series', displayNameKey: 'BarChartProSettings_DisplayName_0161' },
  });

  name = 'dataRolesSettings';
  displayName = 'Bar Colors';
  displayNameKey = 'BarChartProSettings_DisplayName_0153';
  slices = [this.colorBy];
}

export class CategoryColorGroup extends formattingSettings.Group {
  categoryColor = new formattingSettings.ColorPicker({
    name: 'categoryColor',
    displayName: 'Color', displayNameKey: 'BarChartProSettings_DisplayName_0162',
    value: { value: '' },
  });

  name = 'categoryColorGroup';
  displayName = 'Category';
  displayNameKey = 'BarChartProSettings_DisplayName_0154';
  slices = [this.categoryColor];

  constructor(init?: Partial<Pick<CategoryColorGroup, 'name' | 'displayName'>>) {
    super();
    if (init?.name) this.name = init.name;
    if (init?.displayName) this.displayName = init.displayName;
  }
}

export class CategoryColorsCard extends formattingSettings.CompositeCard {
  name = 'categoryColors';
  displayName = 'Category Colors';
  displayNameKey = 'BarChartProSettings_DisplayName_0155';
  groups: CategoryColorGroup[] = [];
}

// ── Target Line ─────────────────────────────────────────────────────

class TargetLineSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Target Line', displayNameKey: 'BarChartProSettings_DisplayName_0077',
    value: true,
  });

  label = new formattingSettings.TextInput({
    name: 'label',
    displayName: 'Label', displayNameKey: 'BarChartProSettings_DisplayName_0078',
    value: '',
    placeholder: 'e.g. Target', placeholderKey: 'BarChartProSettings_Placeholder_0002',
  });

  style = new formattingSettings.ItemDropdown({
    name: 'style',
    displayName: 'Line Style', displayNameKey: 'BarChartProSettings_DisplayName_0079',
    items: [
      { value: 'solid', displayName: 'Solid', displayNameKey: 'BarChartProSettings_DisplayName_0080' },
      { value: 'dashed', displayName: 'Dashed', displayNameKey: 'BarChartProSettings_DisplayName_0081' },
    ],
    value: { value: 'dashed', displayName: 'Dashed', displayNameKey: 'BarChartProSettings_DisplayName_0082' },
  });

  color = new formattingSettings.ColorPicker({
    name: 'color',
    displayName: 'Color', displayNameKey: 'BarChartProSettings_DisplayName_0083',
    value: { value: '#F87171' },
  });

  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width', displayNameKey: 'BarChartProSettings_DisplayName_0084',
    value: 1.5,
  });

  name = 'targetLine';
  displayName = 'Target Line';
  displayNameKey = 'BarChartProSettings_DisplayName_0005';
  slices = [this.show, this.label, this.style, this.color, this.lineWidth];
}

// ── Variance Indicator Settings ─────────────────────────────────────

class VarianceSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Variance Indicators', displayNameKey: 'BarChartProSettings_DisplayName_0085',
    value: false,
  });

  compareAgainst = new formattingSettings.ItemDropdown({
    name: 'compareAgainst',
    displayName: 'Compare Against', displayNameKey: 'BarChartProSettings_DisplayName_0086',
    items: [
      { value: 'target', displayName: 'Target (data role)', displayNameKey: 'BarChartProSettings_DisplayName_0087' },
      { value: 'average', displayName: 'Average', displayNameKey: 'BarChartProSettings_DisplayName_0088' },
      { value: 'median', displayName: 'Median', displayNameKey: 'BarChartProSettings_DisplayName_0089' },
      { value: 'custom', displayName: 'Custom Value', displayNameKey: 'BarChartProSettings_DisplayName_0090' },
    ],
    value: { value: 'average', displayName: 'Average', displayNameKey: 'BarChartProSettings_DisplayName_0091' },
  });

  customValue = new formattingSettings.NumUpDown({
    name: 'customValue',
    displayName: 'Custom Value', displayNameKey: 'BarChartProSettings_DisplayName_0092',
    value: 0,
  });

  showDelta = new formattingSettings.ToggleSwitch({
    name: 'showDelta',
    displayName: 'Show Delta Value', displayNameKey: 'BarChartProSettings_DisplayName_0093',
    value: true,
  });

  showArrow = new formattingSettings.ToggleSwitch({
    name: 'showArrow',
    displayName: 'Show Arrow', displayNameKey: 'BarChartProSettings_DisplayName_0094',
    value: true,
  });

  positiveColor = new formattingSettings.ColorPicker({
    name: 'positiveColor',
    displayName: 'Positive Color', displayNameKey: 'BarChartProSettings_DisplayName_0095',
    value: { value: '#22C55E' },
  });

  negativeColor = new formattingSettings.ColorPicker({
    name: 'negativeColor',
    displayName: 'Negative Color', displayNameKey: 'BarChartProSettings_DisplayName_0096',
    value: { value: '#EF4444' },
  });

  varianceFontSize = new formattingSettings.NumUpDown({
    name: 'varianceFontSize',
    displayName: 'Font Size', displayNameKey: 'BarChartProSettings_DisplayName_0097',
    value: 9,
  });

  name = 'varianceSettings';
  displayName = 'Variance Indicators';
  displayNameKey = 'BarChartProSettings_DisplayName_0006';
  slices = [this.show, this.compareAgainst, this.customValue, this.showDelta, this.showArrow, this.positiveColor, this.negativeColor, this.varianceFontSize];
}

// ── Percent Comparison Labels ───────────────────────────────────────

class PercentComparisonSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Ratio Labels', displayNameKey: 'BarChartProSettings_DisplayName_0163',
    value: false,
  });

  numeratorSeriesIndex = new formattingSettings.NumUpDown({
    name: 'numeratorSeriesIndex',
    displayName: 'Numerator Series Number', displayNameKey: 'BarChartProSettings_DisplayName_0164',
    value: 2,
  });

  denominatorSeriesIndex = new formattingSettings.NumUpDown({
    name: 'denominatorSeriesIndex',
    displayName: 'Denominator Series Number', displayNameKey: 'BarChartProSettings_DisplayName_0165',
    value: 1,
  });

  decimalPlaces = new formattingSettings.NumUpDown({
    name: 'decimalPlaces',
    displayName: 'Decimal Places', displayNameKey: 'BarChartProSettings_DisplayName_0166',
    value: 0,
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size', displayNameKey: 'BarChartProSettings_DisplayName_0167',
    value: 11,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color', displayNameKey: 'BarChartProSettings_DisplayName_0168',
    value: { value: '' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Font Weight', displayNameKey: 'BarChartProSettings_DisplayName_0169',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'BarChartProSettings_DisplayName_0170' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'BarChartProSettings_DisplayName_0171' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'BarChartProSettings_DisplayName_0172' },
    ],
    value: { value: '600', displayName: 'Semi-Bold', displayNameKey: 'BarChartProSettings_DisplayName_0173' },
  });

  labelSpace = new formattingSettings.NumUpDown({
    name: 'labelSpace',
    displayName: 'Label Space', displayNameKey: 'BarChartProSettings_DisplayName_0174',
    value: 72,
  });

  name = 'percentComparisonSettings';
  displayName = 'Series Ratio Labels';
  displayNameKey = 'BarChartProSettings_DisplayName_0156';
  slices = [
    this.show,
    this.numeratorSeriesIndex,
    this.denominatorSeriesIndex,
    this.decimalPlaces,
    this.fontSize,
    this.fontColor,
    this.fontWeight,
    this.labelSpace,
  ];
}

// ── Benchmark Band Settings ─────────────────────────────────────────

class BenchmarkBandSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Benchmark Band', displayNameKey: 'BarChartProSettings_DisplayName_0098',
    value: false,
  });

  lowerBound = new formattingSettings.NumUpDown({
    name: 'lowerBound',
    displayName: 'Lower Bound', displayNameKey: 'BarChartProSettings_DisplayName_0099',
    value: 0,
  });

  upperBound = new formattingSettings.NumUpDown({
    name: 'upperBound',
    displayName: 'Upper Bound', displayNameKey: 'BarChartProSettings_DisplayName_0100',
    value: 100,
  });

  bandColor = new formattingSettings.ColorPicker({
    name: 'bandColor',
    displayName: 'Band Color', displayNameKey: 'BarChartProSettings_DisplayName_0101',
    value: { value: '#3B82F6' },
  });

  bandOpacity = new formattingSettings.NumUpDown({
    name: 'bandOpacity',
    displayName: 'Band Opacity (%)', displayNameKey: 'BarChartProSettings_DisplayName_0102',
    value: 8,
  });

  label = new formattingSettings.TextInput({
    name: 'label',
    displayName: 'Label', displayNameKey: 'BarChartProSettings_DisplayName_0103',
    value: '',
    placeholder: 'e.g. Target Zone', placeholderKey: 'BarChartProSettings_Placeholder_0003',
  });

  name = 'benchmarkBandSettings';
  displayName = 'Benchmark Band';
  displayNameKey = 'BarChartProSettings_DisplayName_0007';
  slices = [this.show, this.lowerBound, this.upperBound, this.bandColor, this.bandOpacity, this.label];
}

// ── Top N / Others ──────────────────────────────────────────────────

class TopNSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Top N', displayNameKey: 'BarChartProSettings_DisplayName_0104',
    value: false,
  });

  topN = new formattingSettings.NumUpDown({
    name: 'topN',
    displayName: 'Top N', displayNameKey: 'BarChartProSettings_DisplayName_0105',
    value: 10,
  });

  othersLabel = new formattingSettings.TextInput({
    name: 'othersLabel',
    displayName: 'Others Label', displayNameKey: 'BarChartProSettings_DisplayName_0106',
    value: 'Others',
    placeholder: 'e.g. Others', placeholderKey: 'BarChartProSettings_Placeholder_0004',
  });

  othersColor = new formattingSettings.ColorPicker({
    name: 'othersColor',
    displayName: 'Others Color', displayNameKey: 'BarChartProSettings_DisplayName_0107',
    value: { value: '#94A3B8' },
  });

  sortBy = new formattingSettings.ItemDropdown({
    name: 'sortBy',
    displayName: 'Sort By', displayNameKey: 'BarChartProSettings_DisplayName_0108',
    items: [
      { value: 'value', displayName: 'Value', displayNameKey: 'BarChartProSettings_DisplayName_0109' },
      { value: 'name', displayName: 'Name', displayNameKey: 'BarChartProSettings_DisplayName_0110' },
    ],
    value: { value: 'value', displayName: 'Value', displayNameKey: 'BarChartProSettings_DisplayName_0111' },
  });

  name = 'topNSettings';
  displayName = 'Top N / Others';
  displayNameKey = 'BarChartProSettings_DisplayName_0008';
  slices = [this.enabled, this.topN, this.othersLabel, this.othersColor, this.sortBy];
}

// ── On-Chart Sort Controls ──────────────────────────────────────────

class SortControlsSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Show On-Chart Sort', displayNameKey: 'BarChartProSettings_DisplayName_0175',
    value: true,
  });

  defaultSort = new formattingSettings.ItemDropdown({
    name: 'defaultSort',
    displayName: 'Default Sort', displayNameKey: 'BarChartProSettings_DisplayName_0176',
    items: [
      { value: 'noSort', displayName: 'No Sort', displayNameKey: 'BarChartProSettings_DisplayName_0177' },
      { value: 'highToLow', displayName: 'High to Low', displayNameKey: 'BarChartProSettings_DisplayName_0178' },
      { value: 'lowToHigh', displayName: 'Low to High', displayNameKey: 'BarChartProSettings_DisplayName_0179' },
      { value: 'percentHighToLow', displayName: 'Percent: High to Low', displayNameKey: 'BarChartProSettings_DisplayName_0180' },
      { value: 'percentLowToHigh', displayName: 'Percent: Low to High', displayNameKey: 'BarChartProSettings_DisplayName_0181' },
    ],
    value: { value: 'noSort', displayName: 'No Sort', displayNameKey: 'BarChartProSettings_DisplayName_0182' },
  });

  showPercentOptions = new formattingSettings.ToggleSwitch({
    name: 'showPercentOptions',
    displayName: 'Show Percent Sort Options', displayNameKey: 'BarChartProSettings_DisplayName_0183',
    value: true,
  });

  position = new formattingSettings.ItemDropdown({
    name: 'position',
    displayName: 'Position', displayNameKey: 'BarChartProSettings_DisplayName_0184',
    items: [
      { value: 'right', displayName: 'Right', displayNameKey: 'BarChartProSettings_DisplayName_0185' },
      { value: 'topRight', displayName: 'Top Right', displayNameKey: 'BarChartProSettings_DisplayName_0186' },
    ],
    value: { value: 'right', displayName: 'Right', displayNameKey: 'BarChartProSettings_DisplayName_0187' },
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size', displayNameKey: 'BarChartProSettings_DisplayName_0188',
    value: 11,
  });

  activeColor = new formattingSettings.ColorPicker({
    name: 'activeColor',
    displayName: 'Active Color', displayNameKey: 'BarChartProSettings_DisplayName_0189',
    value: { value: '#0F172A' },
  });

  inactiveColor = new formattingSettings.ColorPicker({
    name: 'inactiveColor',
    displayName: 'Inactive Color', displayNameKey: 'BarChartProSettings_DisplayName_0190',
    value: { value: '#64748B' },
  });

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background', displayNameKey: 'BarChartProSettings_DisplayName_0191',
    value: { value: '#FFFFFF' },
  });

  name = 'sortControlsSettings';
  displayName = 'Sort Controls';
  displayNameKey = 'BarChartProSettings_DisplayName_0157';
  slices = [
    this.enabled,
    this.defaultSort,
    this.showPercentOptions,
    this.position,
    this.fontSize,
    this.activeColor,
    this.inactiveColor,
    this.backgroundColor,
  ];
}

// ── Small Multiples Settings ─────────────────────────────────────────

class SmallMultiplesSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Small Multiples', displayNameKey: 'BarChartProSettings_DisplayName_0112',
    value: false,
  });

  columns = new formattingSettings.NumUpDown({
    name: 'columns',
    displayName: 'Columns', displayNameKey: 'BarChartProSettings_DisplayName_0113',
    value: 3,
  });

  syncYAxis = new formattingSettings.ToggleSwitch({
    name: 'syncYAxis',
    displayName: 'Sync Y-Axis', displayNameKey: 'BarChartProSettings_DisplayName_0114',
    value: true,
  });

  cellTitleFontSize = new formattingSettings.NumUpDown({
    name: 'cellTitleFontSize',
    displayName: 'Cell Title Font Size', displayNameKey: 'BarChartProSettings_DisplayName_0115',
    value: 10,
  });

  cellTitleFontColor = new formattingSettings.ColorPicker({
    name: 'cellTitleFontColor',
    displayName: 'Cell Title Font Color', displayNameKey: 'BarChartProSettings_DisplayName_0116',
    value: { value: '#64748B' },
  });

  name = 'smallMultiplesSettings';
  displayName = 'Small Multiples';
  displayNameKey = 'BarChartProSettings_DisplayName_0009';
  slices = [this.enabled, this.columns, this.syncYAxis, this.cellTitleFontSize, this.cellTitleFontColor];
}

// ── Drill-Down Settings ─────────────────────────────────────────────

class DrillDownSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Drill-Down', displayNameKey: 'BarChartProSettings_DisplayName_0117',
    value: true,
  });

  showBreadcrumb = new formattingSettings.ToggleSwitch({
    name: 'showBreadcrumb',
    displayName: 'Show Breadcrumb', displayNameKey: 'BarChartProSettings_DisplayName_0118',
    value: true,
  });

  breadcrumbFontSize = new formattingSettings.NumUpDown({
    name: 'breadcrumbFontSize',
    displayName: 'Breadcrumb Font Size', displayNameKey: 'BarChartProSettings_DisplayName_0119',
    value: 11,
  });

  breadcrumbColor = new formattingSettings.ColorPicker({
    name: 'breadcrumbColor',
    displayName: 'Breadcrumb Color', displayNameKey: 'BarChartProSettings_DisplayName_0120',
    value: { value: '#64748B' },
  });

  name = 'drillDownSettings';
  displayName = 'Drill-Down';
  displayNameKey = 'BarChartProSettings_DisplayName_0010';
  slices = [this.enabled, this.showBreadcrumb, this.breadcrumbFontSize, this.breadcrumbColor];
}

// ── Card Style ──────────────────────────────────────────────────────

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style', displayNameKey: 'BarChartProSettings_DisplayName_0121',
    items: CARD_STYLE_MODE_ITEMS,
    value: { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'BarChartProSettings_DisplayName_0126' },
  });

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background Color', displayNameKey: 'BarChartProSettings_DisplayName_0127',
    value: { value: '' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Background Opacity (%)', displayNameKey: 'BarChartProSettings_DisplayName_0128',
    value: 85,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius', displayNameKey: 'BarChartProSettings_DisplayName_0129',
    value: 12,
  });

  contentPadding = new formattingSettings.NumUpDown({
    name: 'contentPadding',
    displayName: 'Content Padding', displayNameKey: 'BarChartProSettings_DisplayName_0130',
    value: 12,
  });

  name = 'cardSettings';
  displayName = 'Card Style';
  displayNameKey = 'BarChartProSettings_DisplayName_0011';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.contentPadding];
}

// ── Animation Settings ──────────────────────────────────────────────

class AnimationSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Animations', displayNameKey: 'BarChartProSettings_DisplayName_0131',
    value: true,
  });

  duration = new formattingSettings.NumUpDown({
    name: 'duration',
    displayName: 'Duration (ms)', displayNameKey: 'BarChartProSettings_DisplayName_0132',
    value: 600,
  });

  staggerDelay = new formattingSettings.NumUpDown({
    name: 'staggerDelay',
    displayName: 'Stagger Delay (ms)', displayNameKey: 'BarChartProSettings_DisplayName_0133',
    value: 50,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  displayNameKey = 'BarChartProSettings_DisplayName_0012';
  slices = [this.enabled, this.duration, this.staggerDelay];
}

// ── Line Number Format (separate from bars) ────────────────────────

class LineNumberFormattingCard extends formattingSettings.SimpleCard {
  displayUnits = new formattingSettings.ItemDropdown({
    name: 'displayUnits',
    displayName: 'Display Units', displayNameKey: 'BarChartProSettings_DisplayName_0134',
    items: [
      { value: 'auto', displayName: 'Auto', displayNameKey: 'BarChartProSettings_DisplayName_0135' },
      { value: 'none', displayName: 'None', displayNameKey: 'BarChartProSettings_DisplayName_0136' },
      { value: 'thousands', displayName: 'Thousands (K)', displayNameKey: 'BarChartProSettings_DisplayName_0137' },
      { value: 'millions', displayName: 'Millions (M)', displayNameKey: 'BarChartProSettings_DisplayName_0138' },
      { value: 'billions', displayName: 'Billions (B)', displayNameKey: 'BarChartProSettings_DisplayName_0139' },
    ],
    value: { value: 'auto', displayName: 'Auto', displayNameKey: 'BarChartProSettings_DisplayName_0140' },
  });

  decimalPlaces = new formattingSettings.NumUpDown({
    name: 'decimalPlaces',
    displayName: 'Decimal Places', displayNameKey: 'BarChartProSettings_DisplayName_0141',
    value: -1,
  });

  valuePrefix = new formattingSettings.TextInput({
    name: 'valuePrefix',
    displayName: 'Prefix', displayNameKey: 'BarChartProSettings_DisplayName_0142',
    value: '',
    placeholder: 'e.g. $', placeholderKey: 'BarChartProSettings_Placeholder_0005',
  });

  valueSuffix = new formattingSettings.TextInput({
    name: 'valueSuffix',
    displayName: 'Suffix', displayNameKey: 'BarChartProSettings_DisplayName_0143',
    value: '',
    placeholder: 'e.g. %', placeholderKey: 'BarChartProSettings_Placeholder_0006',
  });

  name = 'lineNumberFormatting';
  displayName = 'Line Number Format';
  displayNameKey = 'BarChartProSettings_DisplayName_0013';
  slices = [this.displayUnits, this.decimalPlaces, this.valuePrefix, this.valueSuffix];
}

// ── Pareto Line Settings ────────────────────────────────────────

class ParetoSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Pareto Line', displayNameKey: 'BarChartProSettings_DisplayName_0144',
    value: false,
  });

  lineColor = new formattingSettings.ColorPicker({
    name: 'lineColor',
    displayName: 'Line Color', displayNameKey: 'BarChartProSettings_DisplayName_0145',
    value: { value: '#6366F1' },
  });

  showThreshold = new formattingSettings.ToggleSwitch({
    name: 'showThreshold',
    displayName: 'Show 80% Line', displayNameKey: 'BarChartProSettings_DisplayName_0146',
    value: true,
  });

  name = 'paretoSettings';
  displayName = 'Pareto Line';
  displayNameKey = 'BarChartProSettings_DisplayName_0014';
  slices = [this.show, this.lineColor, this.showThreshold];
}

// ── Zoom & Pan Settings ─────────────────────────────────────────────

class ZoomSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Zoom', displayNameKey: 'BarChartProSettings_DisplayName_0147',
    value: false,
  });

  name = 'zoomSettings';
  displayName = 'Zoom & Pan';
  displayNameKey = 'BarChartProSettings_DisplayName_0015';
  slices = [this.enabled];
}

// ── Waterfall Settings ───────────────────────────────────────────────

class WaterfallSettingsCard extends formattingSettings.SimpleCard {
  positiveColor = new formattingSettings.ColorPicker({
    name: 'positiveColor',
    displayName: 'Positive Color', displayNameKey: 'BarChartProSettings_DisplayName_0148',
    value: { value: '' }, // empty = use theme green
  });

  negativeColor = new formattingSettings.ColorPicker({
    name: 'negativeColor',
    displayName: 'Negative Color', displayNameKey: 'BarChartProSettings_DisplayName_0149',
    value: { value: '' }, // empty = use theme red
  });

  totalColor = new formattingSettings.ColorPicker({
    name: 'totalColor',
    displayName: 'Total Color', displayNameKey: 'BarChartProSettings_DisplayName_0150',
    value: { value: '#64748B' },
  });

  connectorColor = new formattingSettings.ColorPicker({
    name: 'connectorColor',
    displayName: 'Connector Color', displayNameKey: 'BarChartProSettings_DisplayName_0151',
    value: { value: '#94A3B8' },
  });

  connectorWidth = new formattingSettings.NumUpDown({
    name: 'connectorWidth',
    displayName: 'Connector Width', displayNameKey: 'BarChartProSettings_DisplayName_0152',
    value: 1,
  });

  name = 'waterfallSettings';
  displayName = 'Waterfall';
  displayNameKey = 'BarChartProSettings_DisplayName_0016';
  slices = [this.positiveColor, this.negativeColor, this.totalColor, this.connectorColor, this.connectorWidth];
}

// ── Root Model (30 cards, reordered into logical groups) ────────────

export class BarChartProSettings extends formattingSettings.Model {
  // Chart Type
  chartMode = new ChartModeSettings();

  // Bar & Line Appearance
  barSettings = new BarSettings();
  lineSettings = new LineSettings();
  secondaryAxisSettings = new SecondaryAxisSettingsCard();
  dataRolesSettings = new DataRolesSettingsCard();
  seriesFormattingCard = new SeriesFormattingCard();
  categoryColorsCard = new CategoryColorsCard();

  // Data Labels
  dataLabelFormattingCard = new DataLabelFormattingCard();

  // Mode-Specific
  waterfallSettings = new WaterfallSettingsCard();

  // Overlays & Analysis
  targetLine = new TargetLineSettings();
  referenceLineFormattingCard = new ReferenceLineFormattingCard();
  trendLineFormattingCard = new TrendLineFormattingCard();
  paretoSettings = new ParetoSettingsCard();
  benchmarkBandSettings = new BenchmarkBandSettingsCard();
  varianceSettings = new VarianceSettingsCard();
  percentComparisonSettings = new PercentComparisonSettingsCard();

  // Axes & Grid
  axisFormattingCard = new AxisFormattingCard();
  scrollFormattingCard = new ScrollFormattingCard();
  zoomSettings = new ZoomSettingsCard();

  // Layout
  topNSettings = new TopNSettingsCard();
  sortControlsSettings = new SortControlsSettingsCard();
  smallMultiplesSettings = new SmallMultiplesSettingsCard();
  drillDownSettings = new DrillDownSettingsCard();

  // Chrome & Styling
  titleFormattingCard = new TitleFormattingCard();
  legendFormattingCard = new LegendFormattingCard();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettingsCard();
  numberFormattingCard = new NumberFormattingCard();
  lineNumberFormattingCard = new LineNumberFormattingCard();

  // Crosshair
  crosshairFormattingCard = new CrosshairFormattingCard();

  // Advanced
  conditionalFormattingCard = new ConditionalFormattingCard();
  annotationFormattingCard = new AnnotationFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();
  colorThemeFormattingCard = new ColorThemeFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();

  cards = [
    // Group 1: Chart Type
    this.chartMode,
    // Group 2: Bar & Line Appearance
    this.barSettings,
    this.lineSettings,
    this.secondaryAxisSettings,
    this.dataRolesSettings,
    this.seriesFormattingCard,
    this.categoryColorsCard,
    // Group 2b: Mode-Specific
    this.waterfallSettings,
    // Group 3: Data Labels
    this.dataLabelFormattingCard,
    // Group 4: Overlays & Analysis
    this.targetLine,
    this.referenceLineFormattingCard,
    this.trendLineFormattingCard,
    this.paretoSettings,
    this.benchmarkBandSettings,
    this.varianceSettings,
    this.percentComparisonSettings,
    // Group 5: Axes & Grid
    this.axisFormattingCard,
    this.scrollFormattingCard,
    this.zoomSettings,
    // Group 6: Layout
    this.topNSettings,
    this.sortControlsSettings,
    this.smallMultiplesSettings,
    this.drillDownSettings,
    // Group 7: Chrome & Styling
    this.titleFormattingCard,
    this.legendFormattingCard,
    this.cardSettings,
    this.animationSettings,
    this.numberFormattingCard,
    this.lineNumberFormattingCard,
    // Crosshair
    this.crosshairFormattingCard,
    // Group 8: Advanced
    this.conditionalFormattingCard,
    this.annotationFormattingCard,
    this.accessibilityFormattingCard,
    this.colorThemeFormattingCard,
    this.dateFilterFormattingCard,
  ];
}
