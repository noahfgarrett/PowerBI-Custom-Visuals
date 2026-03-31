/**
 * Gauge Cluster -- Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, NumberFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard,
  ColorThemeFormattingCard,
  DateFilterFormattingCard,
} from '../../core/src';

// ── Grid Layout ─────────────────────────────────────────────────────

class GridLayoutSettingsCard extends formattingSettings.SimpleCard {
  gaugesPerRow = new formattingSettings.NumUpDown({
    name: 'gaugesPerRow',
    displayName: 'Gauges Per Row',
    value: 4,
  });

  sortByValue = new formattingSettings.ToggleSwitch({
    name: 'sortByValue',
    displayName: 'Sort by Value',
    value: false,
  });

  name = 'gridLayoutSettings';
  displayName = 'Grid Layout';
  slices = [this.gaugesPerRow, this.sortByValue];
}

// ── Arc Appearance ──────────────────────────────────────────────────

class ArcAppearanceSettingsCard extends formattingSettings.SimpleCard {
  arcRange = new formattingSettings.NumUpDown({
    name: 'arcRange',
    displayName: 'Arc Range (\u00b0)',
    value: 240,
  });

  roundedCaps = new formattingSettings.ToggleSwitch({
    name: 'roundedCaps',
    displayName: 'Rounded Caps',
    value: true,
  });

  trackOpacity = new formattingSettings.NumUpDown({
    name: 'trackOpacity',
    displayName: 'Track Opacity (%)',
    value: 15,
  });

  showNeedle = new formattingSettings.ToggleSwitch({
    name: 'showNeedle',
    displayName: 'Show Needle/Pointer',
    value: false,
  });

  arcThickness = new formattingSettings.NumUpDown({
    name: 'arcThickness',
    displayName: 'Arc Thickness (% of radius)',
    value: 20,
  });

  trackColor = new formattingSettings.ColorPicker({
    name: 'trackColor',
    displayName: 'Track Color',
    value: { value: '#94A3B8' },
  });

  name = 'arcAppearanceSettings';
  displayName = 'Arc Appearance';
  slices = [this.arcRange, this.roundedCaps, this.trackOpacity, this.trackColor, this.showNeedle, this.arcThickness];
}

// ── Value Range ─────────────────────────────────────────────────────

class ValueRangeSettingsCard extends formattingSettings.SimpleCard {
  minValue = new formattingSettings.NumUpDown({
    name: 'minValue',
    displayName: 'Min Value',
    value: 0,
  });

  maxValue = new formattingSettings.NumUpDown({
    name: 'maxValue',
    displayName: 'Max Value',
    value: 100,
  });

  name = 'valueRangeSettings';
  displayName = 'Value Range';
  slices = [this.minValue, this.maxValue];
}

// ── Color Zones ─────────────────────────────────────────────────────

class ZoneSettings extends formattingSettings.SimpleCard {
  lowThreshold = new formattingSettings.NumUpDown({
    name: 'lowThreshold',
    displayName: 'Low Threshold (%)',
    value: 33,
  });

  highThreshold = new formattingSettings.NumUpDown({
    name: 'highThreshold',
    displayName: 'High Threshold (%)',
    value: 66,
  });

  lowColor = new formattingSettings.ColorPicker({
    name: 'lowColor',
    displayName: 'Low Color',
    value: { value: '#F87171' },
  });

  midColor = new formattingSettings.ColorPicker({
    name: 'midColor',
    displayName: 'Mid Color',
    value: { value: '#FBBF24' },
  });

  highColor = new formattingSettings.ColorPicker({
    name: 'highColor',
    displayName: 'High Color',
    value: { value: '#34D399' },
  });

  name = 'zoneSettings';
  displayName = 'Color Zones';
  slices = [this.lowThreshold, this.highThreshold, this.lowColor, this.midColor, this.highColor];
}

// ── Target ──────────────────────────────────────────────────────────

class TargetSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Target',
    value: true,
  });

  color = new formattingSettings.ColorPicker({
    name: 'color',
    displayName: 'Target Color',
    value: { value: '#0F172A' },
  });

  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width',
    value: 2,
  });

  name = 'targetSettings';
  displayName = 'Target';
  slices = [this.show, this.color, this.lineWidth];
}

// ── Labels (merged Cluster Display + Cluster Labels + label props) ──

class LabelsSettingsCard extends formattingSettings.SimpleCard {
  showLabels = new formattingSettings.ToggleSwitch({
    name: 'showLabels',
    displayName: 'Show Labels',
    value: true,
  });

  showValues = new formattingSettings.ToggleSwitch({
    name: 'showValues',
    displayName: 'Show Values',
    value: true,
  });

  labelFontSize = new formattingSettings.NumUpDown({
    name: 'labelFontSize',
    displayName: 'Label Font Size',
    value: 11,
  });

  labelFontColor = new formattingSettings.ColorPicker({
    name: 'labelFontColor',
    displayName: 'Label Font Color',
    value: { value: '' },
  });

  labelFontFamily = new formattingSettings.ItemDropdown({
    name: 'labelFontFamily',
    displayName: 'Label Font Family',
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

  labelFontWeight = new formattingSettings.ItemDropdown({
    name: 'labelFontWeight',
    displayName: 'Label Font Weight',
    items: [
      { value: 'normal', displayName: 'Normal' },
      { value: 'bold', displayName: 'Bold' },
      { value: '600', displayName: 'Semi-Bold' },
    ],
    value: { value: 'normal', displayName: 'Normal' },
  });

  showSubtitle = new formattingSettings.ToggleSwitch({
    name: 'showSubtitle',
    displayName: 'Show Subtitle',
    value: false,
  });

  subtitleField = new formattingSettings.TextInput({
    name: 'subtitleField',
    displayName: 'Subtitle Field',
    value: '',
    placeholder: 'e.g. Department',
  });

  showSparklines = new formattingSettings.ToggleSwitch({
    name: 'showSparklines',
    displayName: 'Show Mini Sparklines',
    value: false,
  });

  name = 'labelsSettings';
  displayName = 'Labels';
  slices = [this.showLabels, this.showValues, this.labelFontSize, this.labelFontColor, this.labelFontFamily, this.labelFontWeight, this.showSubtitle, this.subtitleField, this.showSparklines];
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

// ── Animation ───────────────────────────────────────────────────────

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

// ── Root Model ──────────────────────────────────────────────────────

export class GaugeClusterSettings extends formattingSettings.Model {
  gridLayoutSettings = new GridLayoutSettingsCard();
  arcAppearanceSettings = new ArcAppearanceSettingsCard();
  valueRangeSettings = new ValueRangeSettingsCard();
  zoneSettings = new ZoneSettings();
  targetSettings = new TargetSettings();
  labelsSettings = new LabelsSettingsCard();

  titleFormattingCard = new TitleFormattingCard();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  numberFormattingCard = new NumberFormattingCard();

  animationSettings = new AnimationSettings();
  cardSettings = new CardStyleSettings();

  legendFormattingCard = new LegendFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  colorThemeFormattingCard = new ColorThemeFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  cards = [
    this.gridLayoutSettings,
    this.arcAppearanceSettings,
    this.valueRangeSettings,
    this.zoneSettings,
    this.targetSettings,
    this.labelsSettings,
    this.titleFormattingCard,
    this.dataLabelFormattingCard,
    this.numberFormattingCard,
    this.animationSettings,
    this.cardSettings,
    this.legendFormattingCard,
    this.conditionalFormattingCard,
    this.colorThemeFormattingCard,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
