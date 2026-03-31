/**
 * Funnel Pro — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, NumberFormattingCard,
  DateFilterFormattingCard,
} from '../../core/src';

// ── Funnel Shape ────────────────────────────────────────────────────

class FunnelShapeSettingsCard extends formattingSettings.SimpleCard {
  style = new formattingSettings.ItemDropdown({
    name: 'style',
    displayName: 'Style',
    items: [
      { value: 'symmetric', displayName: 'Symmetric' },
      { value: 'leftAligned', displayName: 'Left Aligned' },
    ],
    value: { value: 'symmetric', displayName: 'Symmetric' },
  });

  pyramidMode = new formattingSettings.ToggleSwitch({
    name: 'pyramidMode',
    displayName: 'Pyramid Mode',
    value: false,
  });

  gap = new formattingSettings.NumUpDown({
    name: 'gap',
    displayName: 'Gap',
    value: 4,
  });

  neckWidth = new formattingSettings.NumUpDown({
    name: 'neckWidth',
    displayName: 'Neck Width (%)',
    value: 20,
  });

  neckHeight = new formattingSettings.NumUpDown({
    name: 'neckHeight',
    displayName: 'Neck Height (%)',
    value: 25,
  });

  dynamicHeight = new formattingSettings.ToggleSwitch({
    name: 'dynamicHeight',
    displayName: 'Dynamic Height per Stage',
    value: false,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius',
    value: 4,
  });

  name = 'funnelShapeSettings';
  displayName = 'Funnel Shape';
  slices = [this.style, this.pyramidMode, this.gap, this.neckWidth, this.neckHeight, this.dynamicHeight, this.borderRadius];
}

// ── Stage Appearance ────────────────────────────────────────────────

class StageAppearanceSettingsCard extends formattingSettings.SimpleCard {
  segmentStrokeColor = new formattingSettings.ColorPicker({
    name: 'segmentStrokeColor',
    displayName: 'Segment Stroke Color',
    value: { value: '' },
  });

  segmentStrokeWidth = new formattingSettings.NumUpDown({
    name: 'segmentStrokeWidth',
    displayName: 'Segment Stroke Width',
    value: 1,
  });

  labelColor = new formattingSettings.ColorPicker({
    name: 'labelColor',
    displayName: 'Label Color',
    value: { value: '' },
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Label Font Size',
    value: 12,
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

  showValues = new formattingSettings.ToggleSwitch({
    name: 'showValues',
    displayName: 'Show Values',
    value: true,
  });

  showConversionRate = new formattingSettings.ToggleSwitch({
    name: 'showConversionRate',
    displayName: 'Show Conversion Rate',
    value: true,
  });

  showAnnotations = new formattingSettings.ToggleSwitch({
    name: 'showAnnotations',
    displayName: 'Show Annotations',
    value: false,
  });

  name = 'stageAppearanceSettings';
  displayName = 'Stage Appearance';
  slices = [this.segmentStrokeColor, this.segmentStrokeWidth, this.labelColor, this.fontSize, this.fontFamily, this.fontWeight, this.showValues, this.showConversionRate, this.showAnnotations];
}

// ── Color Settings ───────────────────────────────────────────────────

class ColorSettingsCard extends formattingSettings.SimpleCard {
  useGradient = new formattingSettings.ToggleSwitch({
    name: 'useGradient',
    displayName: 'Use Gradient',
    value: true,
  });

  baseColor = new formattingSettings.ColorPicker({
    name: 'baseColor',
    displayName: 'Base Color',
    value: { value: '#3B82F6' },
  });

  name = 'colorSettings';
  displayName = 'Color';
  slices = [this.useGradient, this.baseColor];
}

// ── Drop-Off Analysis ───────────────────────────────────────────────

class DropOffAnalysisSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Comparison',
    value: false,
  });

  showDropOff = new formattingSettings.ToggleSwitch({
    name: 'showDropOff',
    displayName: 'Show Drop-Off',
    value: false,
  });

  dropOffColor = new formattingSettings.ColorPicker({
    name: 'dropOffColor',
    displayName: 'Drop-Off Color',
    value: { value: '#EF4444' },
  });

  name = 'funnelComparisonSettings';
  displayName = 'Drop-Off Analysis';
  slices = [this.enabled, this.showDropOff, this.dropOffColor];
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

// ── Animation Settings ───────────────────────────────────────────────

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

// ── Root Model ───────────────────────────────────────────────────────

export class FunnelProSettings extends formattingSettings.Model {
  funnelShapeSettings = new FunnelShapeSettingsCard();
  stageAppearanceSettings = new StageAppearanceSettingsCard();
  colorSettings = new ColorSettingsCard();
  funnelComparisonSettings = new DropOffAnalysisSettingsCard();

  titleFormattingCard = new TitleFormattingCard();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  legendFormattingCard = new LegendFormattingCard();
  axisFormattingCard = new AxisFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  numberFormattingCard = new NumberFormattingCard();
  animationSettings = new AnimationSettingsCard();
  cardSettings = new CardStyleSettings();

  referenceLineFormattingCard = new ReferenceLineFormattingCard();
  trendLineFormattingCard = new TrendLineFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  cards = [
    this.funnelShapeSettings,
    this.stageAppearanceSettings,
    this.colorSettings,
    this.funnelComparisonSettings,
    this.titleFormattingCard,
    this.dataLabelFormattingCard,
    this.legendFormattingCard,
    this.axisFormattingCard,
    this.colorThemeFormattingCard,
    this.numberFormattingCard,
    this.animationSettings,
    this.cardSettings,
    this.referenceLineFormattingCard,
    this.trendLineFormattingCard,
    this.conditionalFormattingCard,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
