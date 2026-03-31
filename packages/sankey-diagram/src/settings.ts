/**
 * Sankey Diagram Pro — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import {
  LegendFormattingCard,
  DataLabelFormattingCard,
  ScrollFormattingCard,
  TitleFormattingCard,
  ConditionalFormattingCard,
  AccessibilityFormattingCard,
  ColorThemeFormattingCard,
  NumberFormattingCard,
  DateFilterFormattingCard,
} from '../../core/src';

// ── Node Shape ──────────────────────────────────────────────────────

class NodeShapeSettings extends formattingSettings.SimpleCard {
  width = new formattingSettings.NumUpDown({
    name: 'width',
    displayName: 'Node Width',
    value: 20,
  });

  padding = new formattingSettings.NumUpDown({
    name: 'padding',
    displayName: 'Node Padding',
    value: 16,
  });

  cornerRadius = new formattingSettings.NumUpDown({
    name: 'cornerRadius',
    displayName: 'Corner Radius',
    value: 3,
  });

  opacity = new formattingSettings.NumUpDown({
    name: 'opacity',
    displayName: 'Node Opacity (%)',
    value: 100,
  });

  minHeight = new formattingSettings.NumUpDown({
    name: 'minHeight',
    displayName: 'Minimum Height',
    value: 1,
  });

  nodeBorderColor = new formattingSettings.ColorPicker({
    name: 'nodeBorderColor',
    displayName: 'Node Border Color',
    value: { value: '' },
  });

  nodeBorderWidth = new formattingSettings.NumUpDown({
    name: 'nodeBorderWidth',
    displayName: 'Node Border Width',
    value: 0,
  });

  name = 'nodeSettings';
  displayName = 'Node Shape';
  slices = [
    this.width, this.padding, this.cornerRadius, this.opacity, this.minHeight,
    this.nodeBorderColor, this.nodeBorderWidth,
  ];
}

// ── Node Colors ─────────────────────────────────────────────────────

class NodeColorSettings extends formattingSettings.SimpleCard {
  colorMode = new formattingSettings.ItemDropdown({
    name: 'colorMode',
    displayName: 'Color Mode',
    items: [
      { value: 'auto', displayName: 'Auto (Theme)' },
      { value: 'byLayer', displayName: 'By Layer' },
    ],
    value: { value: 'auto', displayName: 'Auto (Theme)' },
  });

  sourceColor = new formattingSettings.ColorPicker({
    name: 'sourceColor',
    displayName: 'Source Color',
    value: { value: '#3B82F6' },
  });

  step2Color = new formattingSettings.ColorPicker({
    name: 'step2Color',
    displayName: 'Step 2 Color',
    value: { value: '#8B5CF6' },
  });

  step3Color = new formattingSettings.ColorPicker({
    name: 'step3Color',
    displayName: 'Step 3 Color',
    value: { value: '#EC4899' },
  });

  step4Color = new formattingSettings.ColorPicker({
    name: 'step4Color',
    displayName: 'Step 4 Color',
    value: { value: '#F59E0B' },
  });

  step5Color = new formattingSettings.ColorPicker({
    name: 'step5Color',
    displayName: 'Step 5 Color',
    value: { value: '#10B981' },
  });

  targetColor = new formattingSettings.ColorPicker({
    name: 'targetColor',
    displayName: 'Target Color',
    value: { value: '#EF4444' },
  });

  name = 'nodeColorSettings';
  displayName = 'Node Colors';
  slices = [
    this.colorMode,
    this.sourceColor, this.step2Color, this.step3Color,
    this.step4Color, this.step5Color, this.targetColor,
  ];
}

// ── Node Labels ─────────────────────────────────────────────────────

class NodeLabelSettings extends formattingSettings.SimpleCard {
  labelPosition = new formattingSettings.ItemDropdown({
    name: 'labelPosition',
    displayName: 'Label Position',
    items: [
      { value: 'inside', displayName: 'Inside' },
      { value: 'beside', displayName: 'Beside' },
      { value: 'above', displayName: 'Above' },
      { value: 'below', displayName: 'Below' },
      { value: 'none', displayName: 'None (Hover)' },
    ],
    value: { value: 'beside', displayName: 'Beside' },
  });

  labelFontSize = new formattingSettings.NumUpDown({
    name: 'labelFontSize',
    displayName: 'Label Font Size',
    value: 12,
  });

  labelFontFamily = new formattingSettings.ItemDropdown({
    name: 'labelFontFamily',
    displayName: 'Label Font Family',
    items: [
      { value: '', displayName: 'Default' },
      { value: 'Arial', displayName: 'Arial' },
      { value: 'Calibri', displayName: 'Calibri' },
      { value: 'Cambria', displayName: 'Cambria' },
      { value: 'Courier New', displayName: 'Courier New' },
      { value: 'Georgia', displayName: 'Georgia' },
      { value: 'Helvetica Neue', displayName: 'Helvetica Neue' },
      { value: 'Segoe UI', displayName: 'Segoe UI' },
      { value: 'Tahoma', displayName: 'Tahoma' },
      { value: 'Times New Roman', displayName: 'Times New Roman' },
      { value: 'Trebuchet MS', displayName: 'Trebuchet MS' },
      { value: 'Verdana', displayName: 'Verdana' },
    ],
    value: { value: '', displayName: 'Default' },
  });

  labelFontWeight = new formattingSettings.ItemDropdown({
    name: 'labelFontWeight',
    displayName: 'Label Font Weight',
    items: [
      { value: 'normal', displayName: 'Normal' },
      { value: 'bold', displayName: 'Bold' },
    ],
    value: { value: 'normal', displayName: 'Normal' },
  });

  labelFontStyle = new formattingSettings.ItemDropdown({
    name: 'labelFontStyle',
    displayName: 'Label Font Style',
    items: [
      { value: 'normal', displayName: 'Normal' },
      { value: 'italic', displayName: 'Italic' },
    ],
    value: { value: 'normal', displayName: 'Normal' },
  });

  labelColor = new formattingSettings.ColorPicker({
    name: 'labelColor',
    displayName: 'Label Color (All)',
    value: { value: '' },
  });

  sourceLabelColor = new formattingSettings.ColorPicker({
    name: 'sourceLabelColor',
    displayName: 'Source Label Color',
    value: { value: '' },
  });

  step2LabelColor = new formattingSettings.ColorPicker({
    name: 'step2LabelColor',
    displayName: 'Step 2 Label Color',
    value: { value: '' },
  });

  step3LabelColor = new formattingSettings.ColorPicker({
    name: 'step3LabelColor',
    displayName: 'Step 3 Label Color',
    value: { value: '' },
  });

  step4LabelColor = new formattingSettings.ColorPicker({
    name: 'step4LabelColor',
    displayName: 'Step 4 Label Color',
    value: { value: '' },
  });

  step5LabelColor = new formattingSettings.ColorPicker({
    name: 'step5LabelColor',
    displayName: 'Step 5 Label Color',
    value: { value: '' },
  });

  targetLabelColor = new formattingSettings.ColorPicker({
    name: 'targetLabelColor',
    displayName: 'Target Label Color',
    value: { value: '' },
  });

  name = 'nodeLabelSettings';
  displayName = 'Node Labels';
  slices = [
    this.labelPosition,
    this.labelFontSize, this.labelFontFamily, this.labelFontWeight, this.labelFontStyle,
    this.labelColor,
    this.sourceLabelColor, this.step2LabelColor, this.step3LabelColor,
    this.step4LabelColor, this.step5LabelColor, this.targetLabelColor,
  ];
}

// ── Links (merged with Link Features) ───────────────────────────────

class LinkSettings extends formattingSettings.SimpleCard {
  opacity = new formattingSettings.NumUpDown({
    name: 'opacity',
    displayName: 'Opacity (%)',
    value: 40,
  });

  hoverOpacity = new formattingSettings.NumUpDown({
    name: 'hoverOpacity',
    displayName: 'Hover Opacity (%)',
    value: 70,
  });

  colorMode = new formattingSettings.ItemDropdown({
    name: 'colorMode',
    displayName: 'Color Mode',
    items: [
      { value: 'source', displayName: 'Source' },
      { value: 'target', displayName: 'Target' },
      { value: 'gradient', displayName: 'Gradient' },
      { value: 'custom', displayName: 'Custom' },
    ],
    value: { value: 'gradient', displayName: 'Gradient' },
  });

  dimOpacity = new formattingSettings.NumUpDown({
    name: 'dimOpacity',
    displayName: 'Dim Opacity (%)',
    value: 8,
  });

  customColor = new formattingSettings.ColorPicker({
    name: 'customColor',
    displayName: 'Custom Color',
    value: { value: '#64748B' },
  });

  curvature = new formattingSettings.NumUpDown({
    name: 'curvature',
    displayName: 'Curvature',
    value: 50,
  });

  gradientLinks = new formattingSettings.ToggleSwitch({
    name: 'gradientLinks',
    displayName: 'Gradient Links',
    value: true,
  });

  opacityByValue = new formattingSettings.ToggleSwitch({
    name: 'opacityByValue',
    displayName: 'Opacity by Value',
    value: false,
  });

  name = 'linkSettings';
  displayName = 'Links';
  slices = [
    this.opacity, this.hoverOpacity, this.colorMode, this.customColor, this.curvature,
    this.dimOpacity, this.gradientLinks, this.opacityByValue,
  ];
}

// ── Link Labels (showFlowLabels moved here from Link Features) ──────

class LinkLabelSettings extends formattingSettings.SimpleCard {
  showLinkLabels = new formattingSettings.ToggleSwitch({
    name: 'showLinkLabels',
    displayName: 'Show Link Labels',
    value: false,
  });

  linkLabelFontSize = new formattingSettings.NumUpDown({
    name: 'linkLabelFontSize',
    displayName: 'Font Size',
    value: 10,
  });

  linkLabelFontColor = new formattingSettings.ColorPicker({
    name: 'linkLabelFontColor',
    displayName: 'Font Color',
    value: { value: '#333333' },
  });

  linkLabelFontFamily = new formattingSettings.ItemDropdown({
    name: 'linkLabelFontFamily',
    displayName: 'Font Family',
    items: [
      { value: '', displayName: 'Default' },
      { value: 'Arial', displayName: 'Arial' },
      { value: 'Calibri', displayName: 'Calibri' },
      { value: 'Cambria', displayName: 'Cambria' },
      { value: 'Courier New', displayName: 'Courier New' },
      { value: 'Georgia', displayName: 'Georgia' },
      { value: 'Helvetica Neue', displayName: 'Helvetica Neue' },
      { value: 'Segoe UI', displayName: 'Segoe UI' },
      { value: 'Tahoma', displayName: 'Tahoma' },
      { value: 'Times New Roman', displayName: 'Times New Roman' },
      { value: 'Trebuchet MS', displayName: 'Trebuchet MS' },
      { value: 'Verdana', displayName: 'Verdana' },
    ],
    value: { value: '', displayName: 'Default' },
  });

  linkLabelFontWeight = new formattingSettings.ItemDropdown({
    name: 'linkLabelFontWeight',
    displayName: 'Font Weight',
    items: [
      { value: 'normal', displayName: 'Normal' },
      { value: 'bold', displayName: 'Bold' },
    ],
    value: { value: 'normal', displayName: 'Normal' },
  });

  linkLabelFormat = new formattingSettings.ItemDropdown({
    name: 'linkLabelFormat',
    displayName: 'Label Format',
    items: [
      { value: 'value', displayName: 'Value' },
      { value: 'percent', displayName: 'Percent' },
      { value: 'both', displayName: 'Both' },
    ],
    value: { value: 'value', displayName: 'Value' },
  });

  showFlowLabels = new formattingSettings.ToggleSwitch({
    name: 'showFlowLabels',
    displayName: 'Show Flow Labels on Hover',
    value: false,
  });

  name = 'linkLabelSettings';
  displayName = 'Link Labels';
  slices = [this.showLinkLabels, this.linkLabelFontSize, this.linkLabelFontColor, this.linkLabelFontFamily, this.linkLabelFontWeight, this.linkLabelFormat, this.showFlowLabels];
}

// ── Totals ──────────────────────────────────────────────────────────

class TotalSettings extends formattingSettings.SimpleCard {
  showNodeValues = new formattingSettings.ToggleSwitch({
    name: 'showNodeValues',
    displayName: 'Show Node Values',
    value: false,
  });

  nodeValueFormat = new formattingSettings.ItemDropdown({
    name: 'nodeValueFormat',
    displayName: 'Node Value Format',
    items: [
      { value: 'value', displayName: 'Value' },
      { value: 'percent', displayName: 'Percent' },
      { value: 'both', displayName: 'Both' },
    ],
    value: { value: 'value', displayName: 'Value' },
  });

  showLayerTotals = new formattingSettings.ToggleSwitch({
    name: 'showLayerTotals',
    displayName: 'Show Layer Totals',
    value: false,
  });

  layerTotalPosition = new formattingSettings.ItemDropdown({
    name: 'layerTotalPosition',
    displayName: 'Layer Total Position',
    items: [
      { value: 'top', displayName: 'Top' },
      { value: 'bottom', displayName: 'Bottom' },
    ],
    value: { value: 'top', displayName: 'Top' },
  });

  totalFontSize = new formattingSettings.NumUpDown({
    name: 'totalFontSize',
    displayName: 'Font Size',
    value: 11,
  });

  totalFontColor = new formattingSettings.ColorPicker({
    name: 'totalFontColor',
    displayName: 'Font Color',
    value: { value: '' },
  });

  totalFontFamily = new formattingSettings.ItemDropdown({
    name: 'totalFontFamily',
    displayName: 'Font Family',
    items: [
      { value: '', displayName: 'Default' },
      { value: 'Arial', displayName: 'Arial' },
      { value: 'Calibri', displayName: 'Calibri' },
      { value: 'Cambria', displayName: 'Cambria' },
      { value: 'Courier New', displayName: 'Courier New' },
      { value: 'Georgia', displayName: 'Georgia' },
      { value: 'Helvetica Neue', displayName: 'Helvetica Neue' },
      { value: 'Segoe UI', displayName: 'Segoe UI' },
      { value: 'Tahoma', displayName: 'Tahoma' },
      { value: 'Times New Roman', displayName: 'Times New Roman' },
      { value: 'Trebuchet MS', displayName: 'Trebuchet MS' },
      { value: 'Verdana', displayName: 'Verdana' },
    ],
    value: { value: '', displayName: 'Default' },
  });

  totalFontWeight = new formattingSettings.ItemDropdown({
    name: 'totalFontWeight',
    displayName: 'Font Weight',
    items: [
      { value: 'normal', displayName: 'Normal' },
      { value: 'bold', displayName: 'Bold' },
      { value: '600', displayName: 'Semi-Bold' },
    ],
    value: { value: '600', displayName: 'Semi-Bold' },
  });

  name = 'totalSettings';
  displayName = 'Totals';
  slices = [
    this.showNodeValues, this.nodeValueFormat,
    this.showLayerTotals, this.layerTotalPosition,
    this.totalFontSize, this.totalFontColor, this.totalFontFamily, this.totalFontWeight,
  ];
}

// ── Layout ──────────────────────────────────────────────────────────

class LayoutSettings extends formattingSettings.SimpleCard {
  nodeAlign = new formattingSettings.ItemDropdown({
    name: 'nodeAlign',
    displayName: 'Node Alignment',
    items: [
      { value: 'justify', displayName: 'Justify' },
      { value: 'left', displayName: 'Left' },
      { value: 'right', displayName: 'Right' },
      { value: 'center', displayName: 'Center' },
    ],
    value: { value: 'justify', displayName: 'Justify' },
  });

  sortOrder = new formattingSettings.ItemDropdown({
    name: 'sortOrder',
    displayName: 'Sort Order',
    items: [
      { value: 'auto', displayName: 'Automatic' },
      { value: 'ascending', displayName: 'Ascending' },
      { value: 'descending', displayName: 'Descending' },
      { value: 'none', displayName: 'None' },
    ],
    value: { value: 'auto', displayName: 'Automatic' },
  });

  iterations = new formattingSettings.NumUpDown({
    name: 'iterations',
    displayName: 'Layout Iterations',
    value: 6,
  });

  name = 'layoutSettings';
  displayName = 'Layout';
  slices = [this.nodeAlign, this.sortOrder, this.iterations];
}

// ── Tooltips ────────────────────────────────────────────────────────

class TooltipSettings extends formattingSettings.SimpleCard {
  showTooltips = new formattingSettings.ToggleSwitch({
    name: 'showTooltips',
    displayName: 'Show Tooltips',
    value: true,
  });

  showPercentage = new formattingSettings.ToggleSwitch({
    name: 'showPercentage',
    displayName: 'Show Percentage',
    value: false,
  });

  valueFormat = new formattingSettings.ItemDropdown({
    name: 'valueFormat',
    displayName: 'Value Format',
    items: [
      { value: 'auto', displayName: 'Auto' },
      { value: 'full', displayName: 'Full' },
      { value: 'abbreviated', displayName: 'Abbreviated' },
    ],
    value: { value: 'auto', displayName: 'Auto' },
  });

  name = 'tooltipSettings';
  displayName = 'Tooltips';
  slices = [this.showTooltips, this.showPercentage, this.valueFormat];
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

// ── Interaction ─────────────────────────────────────────────────────

class SankeyInteractionSettings extends formattingSettings.SimpleCard {
  highlightFlows = new formattingSettings.ToggleSwitch({
    name: 'highlightFlows',
    displayName: 'Highlight Flow Path',
    value: true,
  });

  enableDrag = new formattingSettings.ToggleSwitch({
    name: 'enableDrag',
    displayName: 'Enable Node Drag',
    value: false,
  });

  enableFiltering = new formattingSettings.ToggleSwitch({
    name: 'enableFiltering',
    displayName: 'Enable Flow Filtering',
    value: false,
  });

  name = 'sankeyInteractionSettings';
  displayName = 'Interaction';
  slices = [this.highlightFlows, this.enableDrag, this.enableFiltering];
}

// ── Root Model ──────────────────────────────────────────────────────

export class SankeyDiagramSettings extends formattingSettings.Model {
  nodeSettings = new NodeShapeSettings();
  nodeColorSettings = new NodeColorSettings();
  nodeLabelSettings = new NodeLabelSettings();
  linkSettings = new LinkSettings();
  linkLabelSettings = new LinkLabelSettings();
  totalSettings = new TotalSettings();
  layoutSettings = new LayoutSettings();
  tooltipSettings = new TooltipSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();

  sankeyInteractionSettings = new SankeyInteractionSettings();

  legendFormattingCard = new LegendFormattingCard();

  dataLabelFormattingCard = new DataLabelFormattingCard();

  scrollFormattingCard = (() => {
    const card = new ScrollFormattingCard();
    card.minCategoryWidth.value = 20;
    return card;
  })();

  titleFormattingCard = new TitleFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  numberFormattingCard = new NumberFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();
  cards = [
    this.nodeSettings,
    this.nodeColorSettings,
    this.nodeLabelSettings,
    this.linkSettings,
    this.linkLabelSettings,
    this.totalSettings,
    this.layoutSettings,
    this.tooltipSettings,
    this.cardSettings,
    this.animationSettings,
    this.sankeyInteractionSettings,
    this.legendFormattingCard,
    this.dataLabelFormattingCard,
    this.scrollFormattingCard,
    this.titleFormattingCard,
    this.conditionalFormattingCard,
    this.accessibilityFormattingCard,
    this.colorThemeFormattingCard,
    this.numberFormattingCard,
    this.dateFilterFormattingCard,
  ];
}
