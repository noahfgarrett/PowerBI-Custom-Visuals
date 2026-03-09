/**
 * Funnel Pro — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard } from '../../core/src';
// ── Funnel Settings ──────────────────────────────────────────────────

class FunnelSettingsCard extends formattingSettings.SimpleCard {
  style = new formattingSettings.ItemDropdown({
    name: 'style',
    displayName: 'Style',
    items: [
      { value: 'symmetric', displayName: 'Symmetric' },
      { value: 'leftAligned', displayName: 'Left Aligned' },
    ],
    value: { value: 'symmetric', displayName: 'Symmetric' },
  });

  showConversionRate = new formattingSettings.ToggleSwitch({
    name: 'showConversionRate',
    displayName: 'Show Conversion Rate',
    value: true,
  });

  gap = new formattingSettings.NumUpDown({
    name: 'gap',
    displayName: 'Gap',
    value: 4,
  });

  showValues = new formattingSettings.ToggleSwitch({
    name: 'showValues',
    displayName: 'Show Values',
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

    value: 1,

  });

  labelColor = new formattingSettings.ColorPicker({

    name: 'labelColor',

    displayName: 'Label Color',

    value: { value: '' },

  });

  pyramidMode = new formattingSettings.ToggleSwitch({
    name: 'pyramidMode',
    displayName: 'Pyramid Mode',
    value: false,
  });

  name = 'funnelSettings';
  displayName = 'Funnel Settings';
  slices = [this.style, this.showConversionRate, this.gap, this.showValues, this.segmentStrokeColor, this.segmentStrokeWidth, this.labelColor, this.pyramidMode];
}

// ── Color Settings ───────────────────────────────────────────────────

class ColorSettingsCard extends formattingSettings.SimpleCard {
  baseColor = new formattingSettings.ColorPicker({
    name: 'baseColor',
    displayName: 'Base Color',
    value: { value: '#3B82F6' },
  });

  useGradient = new formattingSettings.ToggleSwitch({
    name: 'useGradient',
    displayName: 'Use Gradient',
    value: true,
  });

  name = 'colorSettings';
  displayName = 'Color';
  slices = [this.baseColor, this.useGradient];
}

// ── Card Style ───────────────────────────────────────────────────────

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

// ── Funnel Comparison Settings ───────────────────────────────────────

class FunnelComparisonSettingsCard extends formattingSettings.SimpleCard {
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
  displayName = 'Comparison';
  slices = [this.enabled, this.showDropOff, this.dropOffColor];
}

// ── Funnel Layout Settings ──────────────────────────────────────────

class FunnelLayoutSettingsCard extends formattingSettings.SimpleCard {
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

  name = 'funnelLayoutSettings';
  displayName = 'Funnel Layout';
  slices = [this.neckWidth, this.neckHeight, this.dynamicHeight, this.borderRadius];
}

// ── Funnel Annotation Settings ──────────────────────────────────────

class FunnelAnnotationSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Annotations',
    value: false,
  });

  name = 'funnelAnnotationSettings';
  displayName = 'Stage Annotations';
  slices = [this.show];
}

// ── Root Model ───────────────────────────────────────────────────────

export class FunnelProSettings extends formattingSettings.Model {
  funnelSettings = new FunnelSettingsCard();
  colorSettings = new ColorSettingsCard();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettingsCard();

  funnelComparisonSettings = new FunnelComparisonSettingsCard();
  funnelLayoutSettings = new FunnelLayoutSettingsCard();
  funnelAnnotationSettings = new FunnelAnnotationSettingsCard();

  legendFormattingCard = new LegendFormattingCard();

  dataLabelFormattingCard = new DataLabelFormattingCard();

  titleFormattingCard = new TitleFormattingCard();

  axisFormattingCard = new AxisFormattingCard();

  referenceLineFormattingCard = new ReferenceLineFormattingCard();
  trendLineFormattingCard = new TrendLineFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  cards = [
    this.funnelSettings,
    this.colorSettings,
    this.cardSettings,
    this.animationSettings,
    this.funnelComparisonSettings,
    this.funnelLayoutSettings,
    this.funnelAnnotationSettings,
    this.legendFormattingCard,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.axisFormattingCard,
    this.referenceLineFormattingCard,
    this.trendLineFormattingCard,
    this.conditionalFormattingCard,
    this.accessibilityFormattingCard,
    this.colorThemeFormattingCard,
  ];
}
