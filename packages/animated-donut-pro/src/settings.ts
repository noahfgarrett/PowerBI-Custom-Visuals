/**
 * Animated Donut Pro — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, NumberFormattingCard,
  DateFilterFormattingCard,
} from '../../core/src';

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

// ── Donut Settings ──────────────────────────────────────────────────

class DonutSettings extends formattingSettings.SimpleCard {
  innerRadius = new formattingSettings.NumUpDown({
    name: 'innerRadius',
    displayName: 'Inner Radius (%)',
    value: 55,
  });

  arcShape = new formattingSettings.ItemDropdown({
    name: 'arcShape',
    displayName: 'Arc Shape',
    items: [
      { value: 'full', displayName: 'Full Circle (360°)' },
      { value: 'semi', displayName: 'Semi Circle (180°)' },
      { value: 'threeQuarter', displayName: 'Three Quarter (270°)' },
    ],
    value: { value: 'full', displayName: 'Full Circle (360°)' },
  });

  showCenter = new formattingSettings.ToggleSwitch({
    name: 'showCenter',
    displayName: 'Show Center Value',
    value: true,
  });

  showLabels = new formattingSettings.ToggleSwitch({
    name: 'showLabels',
    displayName: 'Show Labels',
    value: true,
  });


  segmentStrokeColor = new formattingSettings.ColorPicker({

    name: 'segmentStrokeColor',

    displayName: 'Segment Stroke Color',

    value: { value: '' },

  });

  segmentStrokeWidth = new formattingSettings.NumUpDown({

    name: 'segmentStrokeWidth',

    displayName: 'Segment Stroke Width',

    value: 1.5,

  });

  labelColor = new formattingSettings.ColorPicker({

    name: 'labelColor',

    displayName: 'Label Color',

    value: { value: '' },

  });

  labelFontSize = new formattingSettings.NumUpDown({

    name: 'labelFontSize',

    displayName: 'Label Font Size',

    value: 10,

  });


  name = 'donutSettings';
  displayName = 'Donut Settings';
  slices = [this.innerRadius, this.arcShape, this.showCenter, this.showLabels, this.segmentStrokeColor, this.segmentStrokeWidth, this.labelColor, this.labelFontSize];
}

// ── Value Settings (center display) ─────────────────────────────────

class ValueSettings extends formattingSettings.SimpleCard {
  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size',
    value: 28,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color',
    value: { value: '' },
  });

  prefix = new formattingSettings.TextInput({
    name: 'prefix',
    displayName: 'Prefix',
    value: '',
    placeholder: 'e.g. $',
  });

  suffix = new formattingSettings.TextInput({
    name: 'suffix',
    displayName: 'Suffix',
    value: '',
    placeholder: 'e.g. %',
  });

  decimalPlaces = new formattingSettings.NumUpDown({
    name: 'decimalPlaces',
    displayName: 'Decimal Places',
    value: 0,
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
  displayName = 'Center Value';
  slices = [this.fontSize, this.fontColor, this.fontFamily, this.fontWeight, this.prefix, this.suffix, this.decimalPlaces];
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

  name = 'animationSettings';
  displayName = 'Animation';
  slices = [this.enabled, this.duration];
}

// ── Nested Rings Settings ────────────────────────────────────────

class DonutNestedSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Nested Rings',
    value: false,
  });

  innerRingField = new formattingSettings.TextInput({
    name: 'innerRingField',
    displayName: 'Inner Ring Field',
    value: '',
    placeholder: 'e.g. SubCategory',
  });

  name = 'donutNestedSettings';
  displayName = 'Nested Rings';
  slices = [this.enabled, this.innerRingField];
}

// ── Exploded Segments Settings ──────────────────────────────────

class DonutExplodeSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Exploded Segments',
    value: false,
  });

  distance = new formattingSettings.NumUpDown({
    name: 'distance',
    displayName: 'Explode Distance (px)',
    value: 20,
  });

  name = 'donutExplodeSettings';
  displayName = 'Exploded Segments';
  slices = [this.enabled, this.distance];
}

// ── Donut Label Format Settings ─────────────────────────────────

class DonutLabelSettings extends formattingSettings.SimpleCard {
  format = new formattingSettings.ItemDropdown({
    name: 'format',
    displayName: 'Label Format',
    items: [
      { value: 'category', displayName: 'Category' },
      { value: 'value', displayName: 'Value' },
      { value: 'percent', displayName: 'Percentage' },
      { value: 'both', displayName: 'Category + Value' },
    ],
    value: { value: 'category', displayName: 'Category' },
  });

  connectorLines = new formattingSettings.ToggleSwitch({
    name: 'connectorLines',
    displayName: 'Connector Lines',
    value: false,
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

  name = 'donutLabelSettings';
  displayName = 'Label Format';
  slices = [this.format, this.connectorLines, this.fontFamily, this.fontWeight];
}

// ── Root Model ──────────────────────────────────────────────────────

export class AnimatedDonutProSettings extends formattingSettings.Model {
  donutSettings = new DonutSettings();
  valueSettings = new ValueSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettingsCard();
  topNSettings = new TopNSettingsCard();
  donutNestedSettings = new DonutNestedSettings();
  donutExplodeSettings = new DonutExplodeSettings();
  donutLabelSettings = new DonutLabelSettings();

  legendFormattingCard = new LegendFormattingCard();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  numberFormattingCard = new NumberFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();
  cards = [
    this.donutSettings,
    this.valueSettings,
    this.donutLabelSettings,
    this.colorThemeFormattingCard,
    this.topNSettings,
    this.animationSettings,
    this.legendFormattingCard,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.numberFormattingCard,
    this.cardSettings,
    this.donutNestedSettings,
    this.donutExplodeSettings,
    this.conditionalFormattingCard,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
