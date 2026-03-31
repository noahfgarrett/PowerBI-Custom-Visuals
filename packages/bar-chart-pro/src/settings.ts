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
} from '../../core/src';

// ── Chart Mode ──────────────────────────────────────────────────────

class ChartModeSettings extends formattingSettings.SimpleCard {
  mode = new formattingSettings.ItemDropdown({
    name: 'mode',
    displayName: 'Mode',
    items: [
      { value: 'grouped', displayName: 'Grouped' },
      { value: 'stacked', displayName: 'Stacked' },
      { value: 'stacked100', displayName: '100% Stacked' },
      { value: 'combo', displayName: 'Combo (Bar + Line)' },
      { value: 'horizontal', displayName: 'Horizontal' },
      { value: 'diverging', displayName: 'Diverging' },
      { value: 'waterfall', displayName: 'Waterfall' },
    ],
    value: { value: 'grouped', displayName: 'Grouped' },
  });

  name = 'chartMode';
  displayName = 'Chart Mode';
  slices = [this.mode];
}

// ── Bar Settings (merged with Pattern Fill) ─────────────────────────

class BarSettings extends formattingSettings.SimpleCard {
  barStyle = new formattingSettings.ItemDropdown({
    name: 'barStyle',
    displayName: 'Bar Style',
    items: [
      { value: 'bar', displayName: 'Bar' },
      { value: 'lollipop', displayName: 'Lollipop' },
    ],
    value: { value: 'bar', displayName: 'Bar' },
  });

  cornerRadius = new formattingSettings.NumUpDown({
    name: 'cornerRadius',
    displayName: 'Corner Radius',
    value: 4,
  });

  barSpacing = new formattingSettings.NumUpDown({
    name: 'barSpacing',
    displayName: 'Bar Spacing',
    value: 2,
  });

  showDataLabels = new formattingSettings.ItemDropdown({
    name: 'showDataLabels',
    displayName: 'Data Labels',
    items: [
      { value: 'none', displayName: 'None' },
      { value: 'above', displayName: 'Above' },
      { value: 'inside', displayName: 'Inside' },
    ],
    value: { value: 'none', displayName: 'None' },
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

  barOpacity = new formattingSettings.NumUpDown({
    name: 'barOpacity',
    displayName: 'Bar Opacity (%)',
    value: 100,
  });

  useGradient = new formattingSettings.ToggleSwitch({
    name: 'useGradient',
    displayName: 'Gradient Fill',
    value: false,
  });

  // Pattern Fill (merged from PatternFillSettingsCard)
  patternEnabled = new formattingSettings.ToggleSwitch({
    name: 'patternEnabled',
    displayName: 'Enable Pattern Fill',
    value: false,
  });

  pattern = new formattingSettings.ItemDropdown({
    name: 'pattern',
    displayName: 'Pattern',
    items: [
      { value: 'diagonal', displayName: 'Diagonal Lines' },
      { value: 'crosshatch', displayName: 'Crosshatch' },
      { value: 'dots', displayName: 'Dots' },
      { value: 'horizontal', displayName: 'Horizontal Lines' },
      { value: 'vertical', displayName: 'Vertical Lines' },
    ],
    value: { value: 'diagonal', displayName: 'Diagonal Lines' },
  });

  patternOpacity = new formattingSettings.NumUpDown({
    name: 'patternOpacity',
    displayName: 'Pattern Opacity (%)',
    value: 30,
  });

  lollipopDotRadius = new formattingSettings.NumUpDown({
    name: 'lollipopDotRadius',
    displayName: 'Lollipop Dot Radius',
    value: 6,
  });

  lollipopStemWidth = new formattingSettings.NumUpDown({
    name: 'lollipopStemWidth',
    displayName: 'Lollipop Stem Width',
    value: 2,
  });

  name = 'barSettings';
  displayName = 'Bar Settings';
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
    displayName: 'Show Dots',
    value: true,
  });

  showLineDataLabels = new formattingSettings.ToggleSwitch({
    name: 'showLineDataLabels',
    displayName: 'Show Data Labels',
    value: false,
  });

  lineGradientFill = new formattingSettings.ToggleSwitch({
    name: 'lineGradientFill',
    displayName: 'Gradient Fill Under Line',
    value: false,
  });

  lineGradientOpacity = new formattingSettings.NumUpDown({
    name: 'lineGradientOpacity',
    displayName: 'Gradient Opacity (%)',
    value: 30,
  });

  lineDotRadius = new formattingSettings.NumUpDown({
    name: 'lineDotRadius',
    displayName: 'Dot Radius',
    value: 4,
  });

  lineDataLabelFontSize = new formattingSettings.NumUpDown({
    name: 'lineDataLabelFontSize',
    displayName: 'Data Label Font Size',
    value: 10,
  });

  lineDataLabelFontColor = new formattingSettings.ColorPicker({
    name: 'lineDataLabelFontColor',
    displayName: 'Data Label Font Color',
    value: { value: '' },
  });

  name = 'lineSettings';
  displayName = 'Line Settings';
  slices = [this.showDots, this.showLineDataLabels, this.lineDataLabelFontSize, this.lineDataLabelFontColor, this.lineGradientFill, this.lineGradientOpacity, this.lineDotRadius];
}

// ── Secondary Axis Settings (combo mode only) ──────────────────────

class SecondaryAxisSettingsCard extends formattingSettings.SimpleCard {
  showSecondaryYAxis = new formattingSettings.ToggleSwitch({
    name: 'showSecondaryYAxis',
    displayName: 'Show Secondary Y-Axis',
    value: false,
  });

  secondaryYAxisTitle = new formattingSettings.TextInput({
    name: 'secondaryYAxisTitle',
    displayName: 'Secondary Y-Axis Title',
    value: '',
    placeholder: 'e.g. Revenue',
  });

  name = 'secondaryAxisSettings';
  displayName = 'Secondary Axis';
  slices = [this.showSecondaryYAxis, this.secondaryYAxisTitle];
}

// ── Target Line ─────────────────────────────────────────────────────

class TargetLineSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Target Line',
    value: true,
  });

  label = new formattingSettings.TextInput({
    name: 'label',
    displayName: 'Label',
    value: '',
    placeholder: 'e.g. Target',
  });

  style = new formattingSettings.ItemDropdown({
    name: 'style',
    displayName: 'Line Style',
    items: [
      { value: 'solid', displayName: 'Solid' },
      { value: 'dashed', displayName: 'Dashed' },
    ],
    value: { value: 'dashed', displayName: 'Dashed' },
  });

  color = new formattingSettings.ColorPicker({
    name: 'color',
    displayName: 'Color',
    value: { value: '#F87171' },
  });

  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width',
    value: 1.5,
  });

  name = 'targetLine';
  displayName = 'Target Line';
  slices = [this.show, this.label, this.style, this.color, this.lineWidth];
}

// ── Variance Indicator Settings ─────────────────────────────────────

class VarianceSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Variance Indicators',
    value: false,
  });

  compareAgainst = new formattingSettings.ItemDropdown({
    name: 'compareAgainst',
    displayName: 'Compare Against',
    items: [
      { value: 'target', displayName: 'Target (data role)' },
      { value: 'average', displayName: 'Average' },
      { value: 'median', displayName: 'Median' },
      { value: 'custom', displayName: 'Custom Value' },
    ],
    value: { value: 'average', displayName: 'Average' },
  });

  customValue = new formattingSettings.NumUpDown({
    name: 'customValue',
    displayName: 'Custom Value',
    value: 0,
  });

  showDelta = new formattingSettings.ToggleSwitch({
    name: 'showDelta',
    displayName: 'Show Delta Value',
    value: true,
  });

  showArrow = new formattingSettings.ToggleSwitch({
    name: 'showArrow',
    displayName: 'Show Arrow',
    value: true,
  });

  positiveColor = new formattingSettings.ColorPicker({
    name: 'positiveColor',
    displayName: 'Positive Color',
    value: { value: '#22C55E' },
  });

  negativeColor = new formattingSettings.ColorPicker({
    name: 'negativeColor',
    displayName: 'Negative Color',
    value: { value: '#EF4444' },
  });

  varianceFontSize = new formattingSettings.NumUpDown({
    name: 'varianceFontSize',
    displayName: 'Font Size',
    value: 9,
  });

  name = 'varianceSettings';
  displayName = 'Variance Indicators';
  slices = [this.show, this.compareAgainst, this.customValue, this.showDelta, this.showArrow, this.positiveColor, this.negativeColor, this.varianceFontSize];
}

// ── Benchmark Band Settings ─────────────────────────────────────────

class BenchmarkBandSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Benchmark Band',
    value: false,
  });

  lowerBound = new formattingSettings.NumUpDown({
    name: 'lowerBound',
    displayName: 'Lower Bound',
    value: 0,
  });

  upperBound = new formattingSettings.NumUpDown({
    name: 'upperBound',
    displayName: 'Upper Bound',
    value: 100,
  });

  bandColor = new formattingSettings.ColorPicker({
    name: 'bandColor',
    displayName: 'Band Color',
    value: { value: '#3B82F6' },
  });

  bandOpacity = new formattingSettings.NumUpDown({
    name: 'bandOpacity',
    displayName: 'Band Opacity (%)',
    value: 8,
  });

  label = new formattingSettings.TextInput({
    name: 'label',
    displayName: 'Label',
    value: '',
    placeholder: 'e.g. Target Zone',
  });

  name = 'benchmarkBandSettings';
  displayName = 'Benchmark Band';
  slices = [this.show, this.lowerBound, this.upperBound, this.bandColor, this.bandOpacity, this.label];
}

// ── Top N / Others ──────────────────────────────────────────────────

class TopNSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Top N',
    value: false,
  });

  topN = new formattingSettings.NumUpDown({
    name: 'topN',
    displayName: 'Top N',
    value: 10,
  });

  othersLabel = new formattingSettings.TextInput({
    name: 'othersLabel',
    displayName: 'Others Label',
    value: 'Others',
    placeholder: 'e.g. Others',
  });

  othersColor = new formattingSettings.ColorPicker({
    name: 'othersColor',
    displayName: 'Others Color',
    value: { value: '#94A3B8' },
  });

  sortBy = new formattingSettings.ItemDropdown({
    name: 'sortBy',
    displayName: 'Sort By',
    items: [
      { value: 'value', displayName: 'Value' },
      { value: 'name', displayName: 'Name' },
    ],
    value: { value: 'value', displayName: 'Value' },
  });

  name = 'topNSettings';
  displayName = 'Top N / Others';
  slices = [this.enabled, this.topN, this.othersLabel, this.othersColor, this.sortBy];
}

// ── Small Multiples Settings ─────────────────────────────────────────

class SmallMultiplesSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Small Multiples',
    value: false,
  });

  columns = new formattingSettings.NumUpDown({
    name: 'columns',
    displayName: 'Columns',
    value: 3,
  });

  syncYAxis = new formattingSettings.ToggleSwitch({
    name: 'syncYAxis',
    displayName: 'Sync Y-Axis',
    value: true,
  });

  cellTitleFontSize = new formattingSettings.NumUpDown({
    name: 'cellTitleFontSize',
    displayName: 'Cell Title Font Size',
    value: 10,
  });

  cellTitleFontColor = new formattingSettings.ColorPicker({
    name: 'cellTitleFontColor',
    displayName: 'Cell Title Font Color',
    value: { value: '#64748B' },
  });

  name = 'smallMultiplesSettings';
  displayName = 'Small Multiples';
  slices = [this.enabled, this.columns, this.syncYAxis, this.cellTitleFontSize, this.cellTitleFontColor];
}

// ── Drill-Down Settings ─────────────────────────────────────────────

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

// ── Card Style ──────────────────────────────────────────────────────

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

// ── Animation Settings ──────────────────────────────────────────────

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

// ── Line Number Format (separate from bars) ────────────────────────

class LineNumberFormattingCard extends formattingSettings.SimpleCard {
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

  name = 'lineNumberFormatting';
  displayName = 'Line Number Format';
  slices = [this.displayUnits, this.decimalPlaces, this.valuePrefix, this.valueSuffix];
}

// ── Pareto Line Settings ────────────────────────────────────────

class ParetoSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Pareto Line',
    value: false,
  });

  lineColor = new formattingSettings.ColorPicker({
    name: 'lineColor',
    displayName: 'Line Color',
    value: { value: '#6366F1' },
  });

  showThreshold = new formattingSettings.ToggleSwitch({
    name: 'showThreshold',
    displayName: 'Show 80% Line',
    value: true,
  });

  name = 'paretoSettings';
  displayName = 'Pareto Line';
  slices = [this.show, this.lineColor, this.showThreshold];
}

// ── Zoom & Pan Settings ─────────────────────────────────────────────

class ZoomSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Zoom',
    value: false,
  });

  name = 'zoomSettings';
  displayName = 'Zoom & Pan';
  slices = [this.enabled];
}

// ── Waterfall Settings ───────────────────────────────────────────────

class WaterfallSettingsCard extends formattingSettings.SimpleCard {
  positiveColor = new formattingSettings.ColorPicker({
    name: 'positiveColor',
    displayName: 'Positive Color',
    value: { value: '' }, // empty = use theme green
  });

  negativeColor = new formattingSettings.ColorPicker({
    name: 'negativeColor',
    displayName: 'Negative Color',
    value: { value: '' }, // empty = use theme red
  });

  totalColor = new formattingSettings.ColorPicker({
    name: 'totalColor',
    displayName: 'Total Color',
    value: { value: '#64748B' },
  });

  connectorColor = new formattingSettings.ColorPicker({
    name: 'connectorColor',
    displayName: 'Connector Color',
    value: { value: '#94A3B8' },
  });

  connectorWidth = new formattingSettings.NumUpDown({
    name: 'connectorWidth',
    displayName: 'Connector Width',
    value: 1,
  });

  name = 'waterfallSettings';
  displayName = 'Waterfall';
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
  seriesFormattingCard = new SeriesFormattingCard();

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

  // Axes & Grid
  axisFormattingCard = new AxisFormattingCard();
  scrollFormattingCard = new ScrollFormattingCard();
  zoomSettings = new ZoomSettingsCard();

  // Layout
  topNSettings = new TopNSettingsCard();
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
    this.seriesFormattingCard,
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
    // Group 5: Axes & Grid
    this.axisFormattingCard,
    this.scrollFormattingCard,
    this.zoomSettings,
    // Group 6: Layout
    this.topNSettings,
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
