/**
 * Sunburst Chart -- Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard } from '../../core/src';
class SunburstSettings extends formattingSettings.SimpleCard {
  showLabels = new formattingSettings.ToggleSwitch({
    name: 'showLabels',
    displayName: 'Show Labels',
    value: true,
  });

  labelMinAngle = new formattingSettings.NumUpDown({
    name: 'labelMinAngle',
    displayName: 'Label Min Angle',
    value: 5,
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


  name = 'sunburstSettings';
  displayName = 'Sunburst';
  slices = [this.showLabels, this.labelMinAngle, this.segmentStrokeColor, this.segmentStrokeWidth, this.labelColor];
}

class ColorSettings extends formattingSettings.SimpleCard {
  useChartPalette = new formattingSettings.ToggleSwitch({
    name: 'useChartPalette',
    displayName: 'Use Chart Palette',
    value: true,
  });

  name = 'colorSettings';
  displayName = 'Colors';
  slices = [this.useChartPalette];
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

class CenterContentSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Center Content',
    value: true,
  });

  displayMode = new formattingSettings.ItemDropdown({
    name: 'displayMode',
    displayName: 'Display Mode',
    items: [
      { value: 'total', displayName: 'Total' },
      { value: 'count', displayName: 'Count' },
      { value: 'average', displayName: 'Average' },
      { value: 'custom', displayName: 'Custom' },
    ],
    value: { value: 'total', displayName: 'Total' },
  });

  customText = new formattingSettings.TextInput({
    name: 'customText',
    displayName: 'Custom Text',
    value: '',
    placeholder: 'Custom label',
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size',
    value: 24,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color',
    value: { value: '' },
  });

  showLabel = new formattingSettings.ToggleSwitch({
    name: 'showLabel',
    displayName: 'Show Label',
    value: true,
  });

  labelFontSize = new formattingSettings.NumUpDown({
    name: 'labelFontSize',
    displayName: 'Label Font Size',
    value: 11,
  });

  name = 'centerContentSettings';
  displayName = 'Center Content';
  slices = [
    this.show,
    this.displayMode,
    this.customText,
    this.fontSize,
    this.fontColor,
    this.showLabel,
    this.labelFontSize,
  ];
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

// ── Sunburst Display Settings ──────────────────────────────────

class SunburstDisplaySettings extends formattingSettings.SimpleCard {
  showPercentages = new formattingSettings.ToggleSwitch({
    name: 'showPercentages',
    displayName: 'Show Percentages',
    value: false,
  });

  percentOf = new formattingSettings.ItemDropdown({
    name: 'percentOf',
    displayName: 'Percent Of',
    items: [
      { value: 'parent', displayName: 'Parent' },
      { value: 'total', displayName: 'Total' },
    ],
    value: { value: 'parent', displayName: 'Parent' },
  });

  innerRadius = new formattingSettings.NumUpDown({
    name: 'innerRadius',
    displayName: 'Inner Radius',
    value: 0,
  });

  startAngle = new formattingSettings.NumUpDown({
    name: 'startAngle',
    displayName: 'Start Angle',
    value: 0,
  });

  sortOrder = new formattingSettings.ItemDropdown({
    name: 'sortOrder',
    displayName: 'Sort Order',
    items: [
      { value: 'descending', displayName: 'Descending (largest first)' },
      { value: 'ascending', displayName: 'Ascending (smallest first)' },
      { value: 'none', displayName: 'Data Order' },
    ],
    value: { value: 'descending', displayName: 'Descending (largest first)' },
  });

  name = 'sunburstDisplaySettings';
  displayName = 'Sunburst Display';
  slices = [this.showPercentages, this.percentOf, this.innerRadius, this.startAngle, this.sortOrder];
}

export class SunburstChartSettings extends formattingSettings.Model {
  sunburstSettings = new SunburstSettings();
  colorSettings = new ColorSettings();
  centerContentSettings = new CenterContentSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();
  drillDownSettings = new DrillDownSettingsCard();
  sunburstDisplaySettings = new SunburstDisplaySettings();

  legendFormattingCard = new LegendFormattingCard();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  cards = [
    this.sunburstSettings,
    this.colorSettings,
    this.centerContentSettings,
    this.cardSettings,
    this.animationSettings,
    this.drillDownSettings,
    this.sunburstDisplaySettings,
    this.legendFormattingCard,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.conditionalFormattingCard,
    this.accessibilityFormattingCard,
    this.colorThemeFormattingCard,
  ];
}
