/**
 * Treemap Pro — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, NumberFormattingCard,
  DateFilterFormattingCard,
  CARD_STYLE_MODE_ITEMS
} from '../../core/src';

// ── Treemap (core settings — tiling, labels, values, padding) ──
class TreemapSettings extends formattingSettings.SimpleCard {
  tiling = new formattingSettings.ItemDropdown({
    name: 'tiling',
    displayName: 'Tiling Algorithm', displayNameKey: 'TreemapProSettings_DisplayName_0007',
    items: [
      { value: 'squarify', displayName: 'Squarify', displayNameKey: 'TreemapProSettings_DisplayName_0008' },
      { value: 'binary', displayName: 'Binary', displayNameKey: 'TreemapProSettings_DisplayName_0009' },
      { value: 'slice', displayName: 'Slice', displayNameKey: 'TreemapProSettings_DisplayName_0010' },
      { value: 'dice', displayName: 'Dice', displayNameKey: 'TreemapProSettings_DisplayName_0011' },
    ],
    value: { value: 'squarify', displayName: 'Squarify', displayNameKey: 'TreemapProSettings_DisplayName_0012' },
  });

  showLabels = new formattingSettings.ToggleSwitch({
    name: 'showLabels',
    displayName: 'Show Category Labels', displayNameKey: 'TreemapProSettings_DisplayName_0013',
    value: true,
  });

  showValues = new formattingSettings.ToggleSwitch({
    name: 'showValues',
    displayName: 'Show Values', displayNameKey: 'TreemapProSettings_DisplayName_0014',
    value: true,
  });

  tilePadding = new formattingSettings.NumUpDown({
    name: 'tilePadding',
    displayName: 'Tile Padding', displayNameKey: 'TreemapProSettings_DisplayName_0015',
    value: 2,
  });

  chartPadding = new formattingSettings.NumUpDown({
    name: 'chartPadding',
    displayName: 'Chart Padding', displayNameKey: 'TreemapProSettings_DisplayName_0016',
    value: 8,
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Category Label Size', displayNameKey: 'TreemapProSettings_DisplayName_0017',
    value: 11,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Category Label Color', displayNameKey: 'TreemapProSettings_DisplayName_0018',
    value: { value: '' },
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Category Label Font', displayNameKey: 'TreemapProSettings_DisplayName_0019',
    items: [
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'TreemapProSettings_DisplayName_0020' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'TreemapProSettings_DisplayName_0021' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'TreemapProSettings_DisplayName_0022' },
      { value: 'Helvetica', displayName: 'Helvetica', displayNameKey: 'TreemapProSettings_DisplayName_0023' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'TreemapProSettings_DisplayName_0024' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'TreemapProSettings_DisplayName_0025' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'TreemapProSettings_DisplayName_0026' },
    ],
    value: { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'TreemapProSettings_DisplayName_0027' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Category Label Weight', displayNameKey: 'TreemapProSettings_DisplayName_0028',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'TreemapProSettings_DisplayName_0029' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'TreemapProSettings_DisplayName_0030' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'TreemapProSettings_DisplayName_0031' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'TreemapProSettings_DisplayName_0032' },
  });

  labelPadding = new formattingSettings.NumUpDown({
    name: 'labelPadding',
    displayName: 'Label Padding', displayNameKey: 'TreemapProSettings_DisplayName_0033',
    value: 6,
  });

  name = 'treemapSettings';
  displayName = 'Tile Layout & Labels';
  displayNameKey = 'TreemapProSettings_DisplayName_0001';
  slices = [this.tiling, this.showLabels, this.showValues, this.tilePadding, this.chartPadding, this.labelPadding, this.fontSize, this.fontColor, this.fontFamily, this.fontWeight];
}

// ── Tile Appearance (merged: Colors + Heat Coloring + stroke + colorByDepth) ──
class TileAppearanceSettings extends formattingSettings.SimpleCard {
  tileStrokeColor = new formattingSettings.ColorPicker({
    name: 'tileStrokeColor',
    displayName: 'Tile Stroke Color', displayNameKey: 'TreemapProSettings_DisplayName_0034',
    value: { value: '' },
  });

  tileStrokeWidth = new formattingSettings.NumUpDown({
    name: 'tileStrokeWidth',
    displayName: 'Tile Stroke Width', displayNameKey: 'TreemapProSettings_DisplayName_0035',
    value: 2,
  });

  useChartPalette = new formattingSettings.ToggleSwitch({
    name: 'useChartPalette',
    displayName: 'Use Chart Palette', displayNameKey: 'TreemapProSettings_DisplayName_0036',
    value: true,
  });

  colorByDepth = new formattingSettings.ToggleSwitch({
    name: 'colorByDepth',
    displayName: 'Color Variation by Depth', displayNameKey: 'TreemapProSettings_DisplayName_0037',
    value: false,
  });

  heatEnabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Heat Coloring', displayNameKey: 'TreemapProSettings_DisplayName_0038',
    value: false,
  });

  startColor = new formattingSettings.ColorPicker({
    name: 'startColor',
    displayName: 'Heat Start Color', displayNameKey: 'TreemapProSettings_DisplayName_0039',
    value: { value: '#E2E8F0' },
  });

  endColor = new formattingSettings.ColorPicker({
    name: 'endColor',
    displayName: 'Heat End Color', displayNameKey: 'TreemapProSettings_DisplayName_0040',
    value: { value: '#EF4444' },
  });

  tileOpacity = new formattingSettings.NumUpDown({
    name: 'tileOpacity',
    displayName: 'Tile Opacity (%)', displayNameKey: 'TreemapProSettings_DisplayName_0041',
    value: 100,
  });

  tileCornerRadius = new formattingSettings.NumUpDown({
    name: 'tileCornerRadius',
    displayName: 'Tile Corner Radius', displayNameKey: 'TreemapProSettings_DisplayName_0042',
    value: 3,
  });

  name = 'tileAppearanceSettings';
  displayName = 'Tile Appearance';
  displayNameKey = 'TreemapProSettings_DisplayName_0002';
  slices = [this.tileStrokeColor, this.tileStrokeWidth, this.tileCornerRadius, this.useChartPalette, this.colorByDepth, this.tileOpacity, this.heatEnabled, this.startColor, this.endColor];
}

// ── Display (reduced — only percentage and label overflow) ──
class TreemapDisplaySettings extends formattingSettings.SimpleCard {
  showPercentage = new formattingSettings.ToggleSwitch({
    name: 'showPercentage',
    displayName: 'Show Percentage', displayNameKey: 'TreemapProSettings_DisplayName_0043',
    value: false,
  });

  percentOf = new formattingSettings.ItemDropdown({
    name: 'percentOf',
    displayName: 'Percent Of', displayNameKey: 'TreemapProSettings_DisplayName_0044',
    items: [
      { value: 'total', displayName: 'Total', displayNameKey: 'TreemapProSettings_DisplayName_0045' },
      { value: 'parent', displayName: 'Parent', displayNameKey: 'TreemapProSettings_DisplayName_0046' },
    ],
    value: { value: 'total', displayName: 'Total', displayNameKey: 'TreemapProSettings_DisplayName_0047' },
  });

  labelOverflow = new formattingSettings.ItemDropdown({
    name: 'labelOverflow',
    displayName: 'Label Overflow', displayNameKey: 'TreemapProSettings_DisplayName_0048',
    items: [
      { value: 'truncate', displayName: 'Truncate', displayNameKey: 'TreemapProSettings_DisplayName_0049' },
      { value: 'hide', displayName: 'Hide', displayNameKey: 'TreemapProSettings_DisplayName_0050' },
    ],
    value: { value: 'truncate', displayName: 'Truncate', displayNameKey: 'TreemapProSettings_DisplayName_0051' },
  });

  name = 'treemapDisplaySettings';
  displayName = 'Display';
  displayNameKey = 'TreemapProSettings_DisplayName_0003';
  slices = [this.showPercentage, this.percentOf, this.labelOverflow];
}

// -- Card Style Settings ------------------------------------------------------

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style', displayNameKey: 'TreemapProSettings_DisplayName_0052',
    items: CARD_STYLE_MODE_ITEMS,
    value: { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'TreemapProSettings_DisplayName_0057' },
  });

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background Color', displayNameKey: 'TreemapProSettings_DisplayName_0058',
    value: { value: '' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Background Opacity (%)', displayNameKey: 'TreemapProSettings_DisplayName_0059',
    value: 85,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius', displayNameKey: 'TreemapProSettings_DisplayName_0060',
    value: 12,
  });

  contentPadding = new formattingSettings.NumUpDown({
    name: 'contentPadding',
    displayName: 'Content Padding', displayNameKey: 'TreemapProSettings_DisplayName_0082',
    value: 8,
  });

  name = 'cardSettings';
  displayName = 'Card Style';
  displayNameKey = 'TreemapProSettings_DisplayName_0004';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.contentPadding];
}

// -- Animation Settings -------------------------------------------------------

class AnimationSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Animations', displayNameKey: 'TreemapProSettings_DisplayName_0061',
    value: true,
  });

  duration = new formattingSettings.NumUpDown({
    name: 'duration',
    displayName: 'Duration (ms)', displayNameKey: 'TreemapProSettings_DisplayName_0062',
    value: 600,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  displayNameKey = 'TreemapProSettings_DisplayName_0005';
  slices = [this.enabled, this.duration];
}

// -- Drill-Down Settings ------------------------------------------------------

class DrillDownSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Drill-Down', displayNameKey: 'TreemapProSettings_DisplayName_0063',
    value: true,
  });

  showBreadcrumb = new formattingSettings.ToggleSwitch({
    name: 'showBreadcrumb',
    displayName: 'Show Breadcrumb', displayNameKey: 'TreemapProSettings_DisplayName_0064',
    value: true,
  });

  breadcrumbFontSize = new formattingSettings.NumUpDown({
    name: 'breadcrumbFontSize',
    displayName: 'Breadcrumb Font Size', displayNameKey: 'TreemapProSettings_DisplayName_0065',
    value: 11,
  });

  breadcrumbColor = new formattingSettings.ColorPicker({
    name: 'breadcrumbColor',
    displayName: 'Breadcrumb Color', displayNameKey: 'TreemapProSettings_DisplayName_0066',
    value: { value: '#64748B' },
  });

  breadcrumbFontFamily = new formattingSettings.ItemDropdown({
    name: 'breadcrumbFontFamily',
    displayName: 'Breadcrumb Font Family', displayNameKey: 'TreemapProSettings_DisplayName_0067',
    items: [
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'TreemapProSettings_DisplayName_0068' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'TreemapProSettings_DisplayName_0069' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'TreemapProSettings_DisplayName_0070' },
      { value: 'Helvetica', displayName: 'Helvetica', displayNameKey: 'TreemapProSettings_DisplayName_0071' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'TreemapProSettings_DisplayName_0072' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'TreemapProSettings_DisplayName_0073' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'TreemapProSettings_DisplayName_0074' },
    ],
    value: { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'TreemapProSettings_DisplayName_0075' },
  });

  breadcrumbFontWeight = new formattingSettings.ItemDropdown({
    name: 'breadcrumbFontWeight',
    displayName: 'Breadcrumb Font Weight', displayNameKey: 'TreemapProSettings_DisplayName_0076',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'TreemapProSettings_DisplayName_0077' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'TreemapProSettings_DisplayName_0078' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'TreemapProSettings_DisplayName_0079' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'TreemapProSettings_DisplayName_0080' },
  });

  name = 'drillDownSettings';
  displayName = 'Drill-Down';
  displayNameKey = 'TreemapProSettings_DisplayName_0006';
  slices = [this.enabled, this.showBreadcrumb, this.breadcrumbFontSize, this.breadcrumbColor, this.breadcrumbFontFamily, this.breadcrumbFontWeight];
}

class InteractionSettingsCard extends formattingSettings.SimpleCard {
  crossHighlightMode = new formattingSettings.ItemDropdown({
    name: 'crossHighlightMode',
    displayName: 'Cross-Highlight Behavior', displayNameKey: 'TreemapProSettings_DisplayName_0083',
    items: [
      { value: 'focus', displayName: 'Show Highlighted Data Only', displayNameKey: 'TreemapProSettings_DisplayName_0084' },
      { value: 'dim', displayName: 'Dim Unhighlighted Data', displayNameKey: 'TreemapProSettings_DisplayName_0085' },
    ],
    value: { value: 'focus', displayName: 'Show Highlighted Data Only', displayNameKey: 'TreemapProSettings_DisplayName_0086' },
  });

  name = 'interactionSettings';
  displayName = 'Interaction';
  displayNameKey = 'TreemapProSettings_DisplayName_0081';
  slices = [this.crossHighlightMode];
}

// -- Root Model ---------------------------------------------------------------

export class TreemapProSettings extends formattingSettings.Model {
  treemapSettings = new TreemapSettings();
  tileAppearanceSettings = new TileAppearanceSettings();
  treemapDisplaySettings = new TreemapDisplaySettings();
  drillDownSettings = new DrillDownSettingsCard();
  interactionSettings = new InteractionSettingsCard();
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
    this.interactionSettings,
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
