/**
 * KPI Card Pro — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { TitleFormattingCard, NumberFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard } from '../../core/src';
class ValueSettings extends formattingSettings.SimpleCard {
  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size',
    value: 32,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color',
    value: { value: '' }, // empty = use theme default
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

  name = 'valueSettings';
  displayName = 'Value';
  slices = [this.fontSize, this.fontColor, this.fontFamily, this.fontWeight];
}

class LabelSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Label',
    value: true,
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size',
    value: 11,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color',
    value: { value: '' },
  });

  customText = new formattingSettings.TextInput({
    name: 'text',
    displayName: 'Custom Text',
    value: '',
    placeholder: 'Override label text',
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

  name = 'labelSettings';
  displayName = 'Label';
  slices = [this.show, this.fontSize, this.fontColor, this.fontFamily, this.fontWeight, this.customText];
}

class TrendSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Trend',
    value: true,
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size',
    value: 14,
  });

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

  neutralColor = new formattingSettings.ColorPicker({
    name: 'neutralColor',
    displayName: 'Neutral Color',
    value: { value: '#94A3B8' },
  });

  name = 'trendSettings';
  displayName = 'Trend Arrow';
  slices = [this.show, this.fontSize, this.positiveColor, this.negativeColor, this.neutralColor];
}

class SparklineSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Sparkline',
    value: true,
  });

  lineColor = new formattingSettings.ColorPicker({
    name: 'lineColor',
    displayName: 'Line Color',
    value: { value: '' },
  });

  fillOpacity = new formattingSettings.NumUpDown({
    name: 'fillOpacity',
    displayName: 'Fill Opacity (%)',
    value: 45,
  });


  sparklineColor = new formattingSettings.ColorPicker({

    name: 'sparklineColor',

    displayName: 'Sparkline Color',

    value: { value: '' },

  });

  sparklineWidth = new formattingSettings.NumUpDown({

    name: 'sparklineWidth',

    displayName: 'Sparkline Width',

    value: 2,

  });

  dividerColor = new formattingSettings.ColorPicker({

    name: 'dividerColor',

    displayName: 'Divider Color',

    value: { value: '' },

  });


  name = 'sparklineSettings';
  displayName = 'Sparkline';
  slices = [this.show, this.lineColor, this.fillOpacity, this.sparklineColor, this.sparklineWidth, this.dividerColor];
}

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

class AnimationSettings extends formattingSettings.SimpleCard {
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

// -- KPI Comparison Settings --------------------------------------------------

class KpiComparisonSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Comparison',
    value: false,
  });

  showPercentChange = new formattingSettings.ToggleSwitch({
    name: 'showPercentChange',
    displayName: 'Show % Change',
    value: true,
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size',
    value: 11,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color',
    value: { value: '#64748B' },
  });

  name = 'kpiComparisonSettings';
  displayName = 'Comparison';
  slices = [this.show, this.showPercentChange, this.fontSize, this.fontColor];
}

// -- KPI Layout Settings ------------------------------------------------------

class KpiLayoutSettings extends formattingSettings.SimpleCard {
  kpiCount = new formattingSettings.ItemDropdown({
    name: 'kpiCount',
    displayName: 'KPI Count',
    items: [
      { value: '1', displayName: '1' },
      { value: '2', displayName: '2' },
      { value: '3', displayName: '3' },
      { value: '4', displayName: '4' },
    ],
    value: { value: '1', displayName: '1' },
  });

  sparklineType = new formattingSettings.ItemDropdown({
    name: 'sparklineType',
    displayName: 'Sparkline Type',
    items: [
      { value: 'line', displayName: 'Line' },
      { value: 'area', displayName: 'Area' },
      { value: 'bar', displayName: 'Bar' },
    ],
    value: { value: 'line', displayName: 'Line' },
  });

  name = 'kpiLayoutSettings';
  displayName = 'Layout';
  slices = [this.kpiCount, this.sparklineType];
}

// -- KPI Goal Settings --------------------------------------------------------

class KpiGoalSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Goal',
    value: false,
  });

  goalValue = new formattingSettings.NumUpDown({
    name: 'goalValue',
    displayName: 'Goal Value',
    value: 100,
  });

  showProgressBar = new formattingSettings.ToggleSwitch({
    name: 'showProgressBar',
    displayName: 'Show Progress Bar',
    value: true,
  });

  metColor = new formattingSettings.ColorPicker({
    name: 'metColor',
    displayName: 'Goal Met Color',
    value: { value: '#22C55E' },
  });

  unmetColor = new formattingSettings.ColorPicker({
    name: 'unmetColor',
    displayName: 'Goal Unmet Color',
    value: { value: '#3B82F6' },
  });

  name = 'kpiGoalSettings';
  displayName = 'Goal / Target';
  slices = [this.show, this.goalValue, this.showProgressBar, this.metColor, this.unmetColor];
}

export class KpiCardSettings extends formattingSettings.Model {
  valueSettings = new ValueSettings();
  labelSettings = new LabelSettings();
  trendSettings = new TrendSettings();
  sparklineSettings = new SparklineSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();
  kpiComparisonSettings = new KpiComparisonSettings();
  kpiLayoutSettings = new KpiLayoutSettings();
  kpiGoalSettings = new KpiGoalSettings();

  titleFormattingCard = new TitleFormattingCard();
  numberFormattingCard = new NumberFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();

  cards = [
    this.valueSettings,
    this.labelSettings,
    this.trendSettings,
    this.sparklineSettings,
    this.cardSettings,
    this.animationSettings,
    this.kpiComparisonSettings,
    this.kpiLayoutSettings,
    this.kpiGoalSettings,
    this.titleFormattingCard,
    this.numberFormattingCard,
    this.conditionalFormattingCard,
    this.accessibilityFormattingCard,
    this.colorThemeFormattingCard,
  ];
}
