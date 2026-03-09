/**
 * Sankey Diagram Pro — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import {
  DataLabelFormattingCard,
  ScrollFormattingCard,
  TitleFormattingCard,
  ConditionalFormattingCard,
  AccessibilityFormattingCard,
  ColorThemeFormattingCard,
} from '../../core/src';
class NodeSettings extends formattingSettings.SimpleCard {
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

  labelColor = new formattingSettings.ColorPicker({
    name: 'labelColor',
    displayName: 'Label Color',
    value: { value: '' }, // empty = use theme default
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

  name = 'nodeSettings';
  displayName = 'Nodes';
  slices = [
    this.width, this.padding, this.labelPosition,
    this.labelFontSize, this.labelFontFamily, this.labelFontWeight, this.labelFontStyle,
    this.labelColor, this.nodeBorderColor, this.nodeBorderWidth,
    this.cornerRadius, this.opacity, this.minHeight,
  ];
}

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

  name = 'linkSettings';
  displayName = 'Links';
  slices = [this.opacity, this.hoverOpacity, this.colorMode, this.customColor, this.curvature, this.dimOpacity];
}

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

  name = 'linkLabelSettings';
  displayName = 'Link Labels';
  slices = [this.showLinkLabels, this.linkLabelFontSize, this.linkLabelFontColor, this.linkLabelFontWeight, this.linkLabelFormat];
}

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

  name = 'totalSettings';
  displayName = 'Totals';
  slices = [
    this.showNodeValues, this.nodeValueFormat,
    this.showLayerTotals, this.layerTotalPosition,
    this.totalFontSize, this.totalFontColor,
  ];
}

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

class SankeyLinkSettings extends formattingSettings.SimpleCard {
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

  showFlowLabels = new formattingSettings.ToggleSwitch({
    name: 'showFlowLabels',
    displayName: 'Show Flow Labels on Hover',
    value: false,
  });

  name = 'sankeyLinkSettings';
  displayName = 'Link Features';
  slices = [this.gradientLinks, this.opacityByValue, this.showFlowLabels];
}

class SankeyNodeSettings extends formattingSettings.SimpleCard {
  showNodeValues = new formattingSettings.ToggleSwitch({
    name: 'showNodeValues',
    displayName: 'Show Node Values',
    value: false,
  });

  nodeLabelFontSize = new formattingSettings.NumUpDown({
    name: 'nodeLabelFontSize',
    displayName: 'Node Label Font Size',
    value: 11,
  });

  name = 'sankeyNodeSettings';
  displayName = 'Node Features';
  slices = [this.showNodeValues, this.nodeLabelFontSize];
}

export class SankeyDiagramSettings extends formattingSettings.Model {
  nodeSettings = new NodeSettings();
  linkSettings = new LinkSettings();
  linkLabelSettings = new LinkLabelSettings();
  totalSettings = new TotalSettings();
  layoutSettings = new LayoutSettings();
  tooltipSettings = new TooltipSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();

  sankeyInteractionSettings = new SankeyInteractionSettings();
  sankeyLinkSettings = new SankeyLinkSettings();
  sankeyNodeSettings = new SankeyNodeSettings();

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
  cards = [
    this.nodeSettings,
    this.linkSettings,
    this.linkLabelSettings,
    this.totalSettings,
    this.layoutSettings,
    this.tooltipSettings,
    this.cardSettings,
    this.animationSettings,
    this.sankeyInteractionSettings,
    this.sankeyLinkSettings,
    this.sankeyNodeSettings,
    this.dataLabelFormattingCard,
    this.scrollFormattingCard,
    this.titleFormattingCard,
    this.conditionalFormattingCard,
    this.accessibilityFormattingCard,
    this.colorThemeFormattingCard,
  ];
}
