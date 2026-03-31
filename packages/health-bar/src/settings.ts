/**
 * Health Bar — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ScrollFormattingCard, SortFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, AnnotationFormattingCard, AccessibilityFormattingCard, NumberFormattingCard,
  ColorThemeFormattingCard,
  DateFilterFormattingCard,
} from '../../core/src';

// ── Bar Shape ────────────────────────────────────────────────────────

class BarShapeSettingsCard extends formattingSettings.SimpleCard {
  barWidth = new formattingSettings.NumUpDown({
    name: 'barWidth',
    displayName: 'Bar Width',
    value: 40,
  });

  barCornerRadius = new formattingSettings.NumUpDown({
    name: 'barCornerRadius',
    displayName: 'Bar Corner Radius',
    value: 6,
  });

  gap = new formattingSettings.NumUpDown({
    name: 'gap',
    displayName: 'Gap Between Bars',
    value: 16,
  });

  fillMode = new formattingSettings.ItemDropdown({
    name: 'fillMode',
    displayName: 'Fill Mode',
    items: [
      { value: 'gradient', displayName: 'Gradient' },
      { value: 'solid', displayName: 'Solid' },
    ],
    value: { value: 'gradient', displayName: 'Gradient' },
  });

  name = 'barShapeSettings';
  displayName = 'Bar Shape';
  slices = [this.barWidth, this.barCornerRadius, this.gap, this.fillMode];
}

// ── Scale & Range (merged healthBarSettings.maxValue + healthBarScale.minValue + showYAxis) ──

class ScaleRangeSettingsCard extends formattingSettings.SimpleCard {
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

  showYAxis = new formattingSettings.ToggleSwitch({
    name: 'showYAxis',
    displayName: 'Show Y-Axis Ticks',
    value: true,
  });

  name = 'scaleRangeSettings';
  displayName = 'Scale & Range';
  slices = [this.minValue, this.maxValue, this.showYAxis];
}

// ── Colors ───────────────────────────────────────────────────────────

class ColorSettingsCard extends formattingSettings.SimpleCard {
  lowColor = new formattingSettings.ColorPicker({
    name: 'lowColor',
    displayName: 'Low Color (0%)',
    value: { value: '#EF4444' },
  });

  midColor = new formattingSettings.ColorPicker({
    name: 'midColor',
    displayName: 'Mid Color (50%)',
    value: { value: '#F59E0B' },
  });

  highColor = new formattingSettings.ColorPicker({
    name: 'highColor',
    displayName: 'High Color (100%)',
    value: { value: '#22C55E' },
  });

  trackColor = new formattingSettings.ColorPicker({
    name: 'trackColor',
    displayName: 'Track Color',
    value: { value: '#E2E8F0' },
  });

  trackOpacity = new formattingSettings.NumUpDown({
    name: 'trackOpacity',
    displayName: 'Track Opacity (%)',
    value: 15,
  });

  name = 'colorSettings';
  displayName = 'Colors';
  slices = [this.lowColor, this.midColor, this.highColor, this.trackColor, this.trackOpacity];
}

// ── Value Labels (merged showValue, showPercent, valuePosition) ──────

class ValueLabelsSettingsCard extends formattingSettings.SimpleCard {
  showValue = new formattingSettings.ToggleSwitch({
    name: 'showValue',
    displayName: 'Show Value',
    value: true,
  });

  showPercent = new formattingSettings.ToggleSwitch({
    name: 'showPercent',
    displayName: 'Show % Symbol',
    value: true,
  });

  position = new formattingSettings.ItemDropdown({
    name: 'position',
    displayName: 'Value Position',
    items: [
      { value: 'above', displayName: 'Above' },
      { value: 'inside', displayName: 'Inside' },
      { value: 'end', displayName: 'End' },
      { value: 'right', displayName: 'Right' },
    ],
    value: { value: 'above', displayName: 'Above' },
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

  name = 'valueLabelsSettings';
  displayName = 'Value Labels';
  slices = [this.showValue, this.showPercent, this.position, this.fontSize, this.fontColor, this.fontFamily, this.fontWeight];
}

// ── Category Labels ──────────────────────────────────────────────────

class CategoryLabelSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Category Labels',
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

  name = 'categoryLabelSettings';
  displayName = 'Category Labels';
  slices = [this.show, this.fontSize, this.fontColor, this.fontFamily, this.fontWeight];
}

// ── Target ───────────────────────────────────────────────────────────

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

  markerStyle = new formattingSettings.ItemDropdown({
    name: 'markerStyle',
    displayName: 'Marker Style',
    items: [
      { value: 'line', displayName: 'Line' },
      { value: 'triangle', displayName: 'Triangle' },
      { value: 'diamond', displayName: 'Diamond' },
    ],
    value: { value: 'line', displayName: 'Line' },
  });

  name = 'targetSettings';
  displayName = 'Target';
  slices = [this.show, this.color, this.lineWidth, this.markerStyle];
}

// ── Card Style ───────────────────────────────────────────────────────

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

// ── Animation ────────────────────────────────────────────────────────

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
    value: 80,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  slices = [this.enabled, this.duration, this.staggerDelay];
}

// ── Zone Background ─────────────────────────────────────────────────

class HealthBarZoneSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Zone Background',
    value: false,
  });

  zoneColors = new formattingSettings.TextInput({
    name: 'zoneColors',
    displayName: 'Zone Colors (CSV)',
    value: '#EF4444,#F59E0B,#22C55E',
    placeholder: '#EF4444,#F59E0B,#22C55E',
  });

  name = 'healthBarZone';
  displayName = 'Zone Background';
  slices = [this.show, this.zoneColors];
}

// ── Root Model ───────────────────────────────────────────────────────

export class HealthBarSettings extends formattingSettings.Model {
  barShapeSettings = new BarShapeSettingsCard();
  scaleRangeSettings = new ScaleRangeSettingsCard();
  colorSettings = new ColorSettingsCard();
  valueLabelsSettings = new ValueLabelsSettingsCard();
  categoryLabelSettings = new CategoryLabelSettingsCard();
  targetSettings = new TargetSettings();

  titleFormattingCard = new TitleFormattingCard();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettingsCard();

  axisFormattingCard = new AxisFormattingCard();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  scrollFormattingCard = new ScrollFormattingCard();
  sortFormattingCard = new SortFormattingCard();
  numberFormattingCard = new NumberFormattingCard();

  referenceLineFormattingCard = new ReferenceLineFormattingCard();
  trendLineFormattingCard = new TrendLineFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  annotationFormattingCard = new AnnotationFormattingCard();
  healthBarZone = new HealthBarZoneSettings();
  legendFormattingCard = new LegendFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  cards = [
    this.barShapeSettings,
    this.scaleRangeSettings,
    this.colorSettings,
    this.valueLabelsSettings,
    this.categoryLabelSettings,
    this.targetSettings,
    this.titleFormattingCard,
    this.cardSettings,
    this.animationSettings,
    this.axisFormattingCard,
    this.dataLabelFormattingCard,
    this.scrollFormattingCard,
    this.sortFormattingCard,
    this.numberFormattingCard,
    this.referenceLineFormattingCard,
    this.trendLineFormattingCard,
    this.conditionalFormattingCard,
    this.annotationFormattingCard,
    this.healthBarZone,
    this.legendFormattingCard,
    this.colorThemeFormattingCard,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
