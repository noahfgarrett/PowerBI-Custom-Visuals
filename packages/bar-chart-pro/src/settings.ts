/**
 * Bar Chart Pro — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
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
} from '../../core/src';

// ── Pattern Fill Settings ───────────────────────────────────────────

class PatternFillSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
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

  name = 'patternFillSettings';
  displayName = 'Pattern Fill';
  slices = [this.enabled, this.pattern, this.patternOpacity];
}

// ── Variance Indicator Settings ─────────────────────────────────────

class VarianceSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Variance Indicators',
    value: false,
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

  name = 'varianceSettings';
  displayName = 'Variance Indicators';
  slices = [this.show, this.showDelta, this.showArrow, this.positiveColor, this.negativeColor];
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
    ],
    value: { value: 'grouped', displayName: 'Grouped' },
  });

  name = 'chartMode';
  displayName = 'Chart Mode';
  slices = [this.mode];
}

// ── Bar Settings ────────────────────────────────────────────────────

class BarSettings extends formattingSettings.SimpleCard {
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

  name = 'barSettings';
  displayName = 'Bar Settings';
  slices = [this.cornerRadius, this.barSpacing, this.showDataLabels, this.barBorderColor, this.barBorderWidth, this.barOpacity, this.useGradient];
}

// ── Line Settings (combo mode) ──────────────────────────────────────

class LineSettings extends formattingSettings.SimpleCard {
  showDots = new formattingSettings.ToggleSwitch({
    name: 'showDots',
    displayName: 'Show Dots',
    value: true,
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

  name = 'lineSettings';
  displayName = 'Line Settings';
  slices = [this.showDots, this.lineGradientFill, this.lineGradientOpacity];
}

// ── Secondary Axis Settings (combo mode only) ──────────────────────

class SecondaryAxisSettingsCard extends formattingSettings.SimpleCard {
  showSecondaryYAxis = new formattingSettings.ToggleSwitch({
    name: 'showSecondaryYAxis',
    displayName: 'Show Secondary Y-Axis',
    value: false,
  });

  name = 'secondaryAxisSettings';
  displayName = 'Secondary Axis';
  slices = [this.showSecondaryYAxis];
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

  name = 'targetLine';
  displayName = 'Target Line';
  slices = [this.show, this.label, this.style, this.color];
}

// ── Card Style ──────────────────────────────────────────────────────

class CardStyleSettings extends formattingSettings.SimpleCard {
  enableGlass = new formattingSettings.ToggleSwitch({
    name: 'enableGlass',
    displayName: 'Glass Effect',
    value: true,
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
  slices = [this.enableGlass, this.backgroundColor, this.backgroundOpacity, this.borderRadius];
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

// ── Root Model ──────────────────────────────────────────────────────

export class BarChartProSettings extends formattingSettings.Model {
  chartMode = new ChartModeSettings();
  barSettings = new BarSettings();
  lineSettings = new LineSettings();
  secondaryAxisSettings = new SecondaryAxisSettingsCard();
  targetLine = new TargetLineSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettingsCard();
  topNSettings = new TopNSettingsCard();
  drillDownSettings = new DrillDownSettingsCard();

  // New feature cards
  patternFillSettings = new PatternFillSettingsCard();
  varianceSettings = new VarianceSettingsCard();
  benchmarkBandSettings = new BenchmarkBandSettingsCard();

  // Shared formatting cards from core
  axisFormattingCard = new AxisFormattingCard();
  legendFormattingCard = new LegendFormattingCard();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  scrollFormattingCard = new ScrollFormattingCard();
  numberFormattingCard = new NumberFormattingCard();
  referenceLineFormattingCard = new ReferenceLineFormattingCard();
  trendLineFormattingCard = new TrendLineFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  annotationFormattingCard = new AnnotationFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();
  seriesFormattingCard = new SeriesFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  cards = [
    this.chartMode,
    this.barSettings,
    this.lineSettings,
    this.secondaryAxisSettings,
    this.targetLine,
    this.cardSettings,
    this.animationSettings,
    this.topNSettings,
    this.drillDownSettings,
    this.patternFillSettings,
    this.varianceSettings,
    this.benchmarkBandSettings,
    this.axisFormattingCard,
    this.legendFormattingCard,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.scrollFormattingCard,
    this.numberFormattingCard,
    this.referenceLineFormattingCard,
    this.trendLineFormattingCard,
    this.conditionalFormattingCard,
    this.annotationFormattingCard,
    this.accessibilityFormattingCard,
    this.seriesFormattingCard,
    this.colorThemeFormattingCard,
  ];
}
