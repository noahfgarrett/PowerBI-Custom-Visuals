/**
 * Treemap Pro — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, NumberFormattingCard,
  DateFilterFormattingCard,
} from '../../core/src';

// ── Treemap (core settings — tiling, labels, values, padding) ──
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

  tilePadding = new formattingSettings.NumUpDown({
    name: 'tilePadding',
    displayName: 'Tile Padding',
    value: 2,
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Label Font Size',
    value: 11,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Label Font Color',
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

  name = 'treemapSettings';
  displayName = 'Treemap';
  slices = [this.tiling, this.showLabels, this.showValues, this.tilePadding, this.fontSize, this.fontColor, this.fontFamily, this.fontWeight];
}

// ── Tile Appearance (merged: Colors + Heat Coloring + stroke + colorByDepth) ──
class TileAppearanceSettings extends formattingSettings.SimpleCard {
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

  useChartPalette = new formattingSettings.ToggleSwitch({
    name: 'useChartPalette',
    displayName: 'Use Chart Palette',
    value: true,
  });

  colorByDepth = new formattingSettings.ToggleSwitch({
    name: 'colorByDepth',
    displayName: 'Color Variation by Depth',
    value: false,
  });

  heatEnabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Heat Coloring',
    value: false,
  });

  startColor = new formattingSettings.ColorPicker({
    name: 'startColor',
    displayName: 'Heat Start Color',
    value: { value: '#E2E8F0' },
  });

  endColor = new formattingSettings.ColorPicker({
    name: 'endColor',
    displayName: 'Heat End Color',
    value: { value: '#EF4444' },
  });

  tileOpacity = new formattingSettings.NumUpDown({
    name: 'tileOpacity',
    displayName: 'Tile Opacity (%)',
    value: 100,
  });

  tileCornerRadius = new formattingSettings.NumUpDown({
    name: 'tileCornerRadius',
    displayName: 'Tile Corner Radius',
    value: 3,
  });

  name = 'tileAppearanceSettings';
  displayName = 'Tile Appearance';
  slices = [this.tileStrokeColor, this.tileStrokeWidth, this.tileCornerRadius, this.useChartPalette, this.colorByDepth, this.tileOpacity, this.heatEnabled, this.startColor, this.endColor];
}

// ── Display (reduced — only percentage and label overflow) ──
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

  name = 'treemapDisplaySettings';
  displayName = 'Display';
  slices = [this.showPercentage, this.percentOf, this.labelOverflow];
}

// -- Card Style Settings ------------------------------------------------------

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

  breadcrumbFontFamily = new formattingSettings.ItemDropdown({
    name: 'breadcrumbFontFamily',
    displayName: 'Breadcrumb Font Family',
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

  breadcrumbFontWeight = new formattingSettings.ItemDropdown({
    name: 'breadcrumbFontWeight',
    displayName: 'Breadcrumb Font Weight',
    items: [
      { value: 'normal', displayName: 'Normal' },
      { value: 'bold', displayName: 'Bold' },
      { value: '600', displayName: 'Semi-Bold' },
    ],
    value: { value: 'normal', displayName: 'Normal' },
  });

  name = 'drillDownSettings';
  displayName = 'Drill-Down';
  slices = [this.enabled, this.showBreadcrumb, this.breadcrumbFontSize, this.breadcrumbColor, this.breadcrumbFontFamily, this.breadcrumbFontWeight];
}

// -- Root Model ---------------------------------------------------------------

export class TreemapProSettings extends formattingSettings.Model {
  treemapSettings = new TreemapSettings();
  tileAppearanceSettings = new TileAppearanceSettings();
  treemapDisplaySettings = new TreemapDisplaySettings();
  drillDownSettings = new DrillDownSettingsCard();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettingsCard();

  legendFormattingCard = new LegendFormattingCard();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  numberFormattingCard = new NumberFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();
  cards = [
    this.treemapSettings,
    this.tileAppearanceSettings,
    this.treemapDisplaySettings,
    this.drillDownSettings,
    this.dataLabelFormattingCard,
    this.legendFormattingCard,
    this.titleFormattingCard,
    this.cardSettings,
    this.animationSettings,
    this.numberFormattingCard,
    this.conditionalFormattingCard,
    this.colorThemeFormattingCard,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
