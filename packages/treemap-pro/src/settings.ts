/**
 * Treemap Pro — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, NumberFormattingCard } from '../../core/src';
// -- Treemap Layout Settings --------------------------------------------------

class TreemapSettings extends formattingSettings.SimpleCard {
  tiling = new formattingSettings.ItemDropdown({
    name: 'tiling',
    displayName: 'Tiling Algorithm',
    items: [
      { value: 'squarify', displayName: 'Squarify' },
      { value: 'binary', displayName: 'Binary' },
      { value: 'slice', displayName: 'Slice' },
      { value: 'dice', displayName: 'Dice' },
    ],
    value: { value: 'squarify', displayName: 'Squarify' },
  });

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


  tileStrokeColor = new formattingSettings.ColorPicker({

    name: 'tileStrokeColor',

    displayName: 'Tile Stroke Color',

    value: { value: '' },

  });

  tileStrokeWidth = new formattingSettings.NumUpDown({

    name: 'tileStrokeWidth',

    displayName: 'Tile Stroke Width',

    value: 2,

  });

  tilePadding = new formattingSettings.NumUpDown({

    name: 'tilePadding',

    displayName: 'Tile Padding',

    value: 2,

  });

  labelColor = new formattingSettings.ColorPicker({

    name: 'labelColor',

    displayName: 'Label Color',

    value: { value: '' },

  });


  name = 'treemapSettings';
  displayName = 'Treemap';
  slices = [this.tiling, this.showLabels, this.showValues, this.tileStrokeColor, this.tileStrokeWidth, this.tilePadding, this.labelColor];
}

// -- Color Settings -----------------------------------------------------------

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

// -- Card Style Settings ------------------------------------------------------

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

// -- Animation Settings -------------------------------------------------------

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

// -- Drill-Down Settings ------------------------------------------------------

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

// -- Heat Coloring Settings ---------------------------------------------------

class TreemapHeatSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Heat Coloring',
    value: false,
  });

  startColor = new formattingSettings.ColorPicker({
    name: 'startColor',
    displayName: 'Start Color',
    value: { value: '#E2E8F0' },
  });

  endColor = new formattingSettings.ColorPicker({
    name: 'endColor',
    displayName: 'End Color',
    value: { value: '#EF4444' },
  });

  name = 'treemapHeatSettings';
  displayName = 'Heat Coloring';
  slices = [this.enabled, this.startColor, this.endColor];
}

// -- Treemap Display Settings -------------------------------------------------

class TreemapDisplaySettings extends formattingSettings.SimpleCard {
  showPercentage = new formattingSettings.ToggleSwitch({
    name: 'showPercentage',
    displayName: 'Show Percentage',
    value: false,
  });

  percentOf = new formattingSettings.ItemDropdown({
    name: 'percentOf',
    displayName: 'Percent Of',
    items: [
      { value: 'total', displayName: 'Total' },
      { value: 'parent', displayName: 'Parent' },
    ],
    value: { value: 'total', displayName: 'Total' },
  });

  labelOverflow = new formattingSettings.ItemDropdown({
    name: 'labelOverflow',
    displayName: 'Label Overflow',
    items: [
      { value: 'truncate', displayName: 'Truncate' },
      { value: 'hide', displayName: 'Hide' },
    ],
    value: { value: 'truncate', displayName: 'Truncate' },
  });

  colorByDepth = new formattingSettings.ToggleSwitch({
    name: 'colorByDepth',
    displayName: 'Color Variation by Depth',
    value: false,
  });

  name = 'treemapDisplaySettings';
  displayName = 'Display';
  slices = [this.showPercentage, this.percentOf, this.labelOverflow, this.colorByDepth];
}

// -- Root Model ---------------------------------------------------------------

export class TreemapProSettings extends formattingSettings.Model {
  treemapSettings = new TreemapSettings();
  colorSettings = new ColorSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettingsCard();
  drillDownSettings = new DrillDownSettingsCard();
  treemapHeatSettings = new TreemapHeatSettings();
  treemapDisplaySettings = new TreemapDisplaySettings();

  legendFormattingCard = new LegendFormattingCard();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  numberFormattingCard = new NumberFormattingCard();
  cards = [
    this.treemapSettings,
    this.colorSettings,
    this.cardSettings,
    this.animationSettings,
    this.drillDownSettings,
    this.treemapHeatSettings,
    this.treemapDisplaySettings,
    this.legendFormattingCard,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.conditionalFormattingCard,
    this.accessibilityFormattingCard,
    this.colorThemeFormattingCard,
    this.numberFormattingCard,
  ];
}
