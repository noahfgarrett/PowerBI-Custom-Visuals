/**
 * Sankey Diagram Pro — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import {
  LegendFormattingCard,
  ScrollFormattingCard,
  TitleFormattingCard,
  ConditionalFormattingCard,
  AccessibilityFormattingCard,
  ColorThemeFormattingCard,
  NumberFormattingCard,
  DateFilterFormattingCard,
  CARD_STYLE_MODE_ITEMS
} from '../../core/src';

// ── Node Shape ──────────────────────────────────────────────────────

class NodeShapeSettings extends formattingSettings.SimpleCard {
  width = new formattingSettings.NumUpDown({
    name: 'width',
    displayName: 'Node Width', displayNameKey: 'SankeyDiagramSettings_DisplayName_0012',
    value: 20,
  });

  padding = new formattingSettings.NumUpDown({
    name: 'padding',
    displayName: 'Node Padding', displayNameKey: 'SankeyDiagramSettings_DisplayName_0013',
    value: 16,
  });

  cornerRadius = new formattingSettings.NumUpDown({
    name: 'cornerRadius',
    displayName: 'Corner Radius', displayNameKey: 'SankeyDiagramSettings_DisplayName_0014',
    value: 3,
  });

  opacity = new formattingSettings.NumUpDown({
    name: 'opacity',
    displayName: 'Node Opacity (%)', displayNameKey: 'SankeyDiagramSettings_DisplayName_0015',
    value: 100,
  });

  minHeight = new formattingSettings.NumUpDown({
    name: 'minHeight',
    displayName: 'Minimum Height', displayNameKey: 'SankeyDiagramSettings_DisplayName_0016',
    value: 1,
  });

  nodeBorderColor = new formattingSettings.ColorPicker({
    name: 'nodeBorderColor',
    displayName: 'Node Border Color', displayNameKey: 'SankeyDiagramSettings_DisplayName_0017',
    value: { value: '' },
  });

  nodeBorderWidth = new formattingSettings.NumUpDown({
    name: 'nodeBorderWidth',
    displayName: 'Node Border Width', displayNameKey: 'SankeyDiagramSettings_DisplayName_0018',
    value: 0,
  });

  name = 'nodeSettings';
  displayName = 'Node Shape';
  displayNameKey = 'SankeyDiagramSettings_DisplayName_0001';
  slices = [
    this.width, this.padding, this.cornerRadius, this.opacity, this.minHeight,
    this.nodeBorderColor, this.nodeBorderWidth,
  ];
}

// ── Node Colors ─────────────────────────────────────────────────────

class NodeColorSettings extends formattingSettings.SimpleCard {
  colorMode = new formattingSettings.ItemDropdown({
    name: 'colorMode',
    displayName: 'Color Mode', displayNameKey: 'SankeyDiagramSettings_DisplayName_0019',
    items: [
      { value: 'auto', displayName: 'Auto (Theme)', displayNameKey: 'SankeyDiagramSettings_DisplayName_0020' },
      { value: 'byLayer', displayName: 'By Layer', displayNameKey: 'SankeyDiagramSettings_DisplayName_0021' },
    ],
    value: { value: 'auto', displayName: 'Auto (Theme)', displayNameKey: 'SankeyDiagramSettings_DisplayName_0022' },
  });

  sourceColor = new formattingSettings.ColorPicker({
    name: 'sourceColor',
    displayName: 'Source Color', displayNameKey: 'SankeyDiagramSettings_DisplayName_0023',
    value: { value: '#3B82F6' },
  });

  step2Color = new formattingSettings.ColorPicker({
    name: 'step2Color',
    displayName: 'Step 2 Color', displayNameKey: 'SankeyDiagramSettings_DisplayName_0024',
    value: { value: '#8B5CF6' },
  });

  step3Color = new formattingSettings.ColorPicker({
    name: 'step3Color',
    displayName: 'Step 3 Color', displayNameKey: 'SankeyDiagramSettings_DisplayName_0025',
    value: { value: '#EC4899' },
  });

  step4Color = new formattingSettings.ColorPicker({
    name: 'step4Color',
    displayName: 'Step 4 Color', displayNameKey: 'SankeyDiagramSettings_DisplayName_0026',
    value: { value: '#F59E0B' },
  });

  step5Color = new formattingSettings.ColorPicker({
    name: 'step5Color',
    displayName: 'Step 5 Color', displayNameKey: 'SankeyDiagramSettings_DisplayName_0027',
    value: { value: '#10B981' },
  });

  targetColor = new formattingSettings.ColorPicker({
    name: 'targetColor',
    displayName: 'Target Color', displayNameKey: 'SankeyDiagramSettings_DisplayName_0028',
    value: { value: '#EF4444' },
  });

  name = 'nodeColorSettings';
  displayName = 'Node Colors';
  displayNameKey = 'SankeyDiagramSettings_DisplayName_0002';
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
    displayName: 'Label Position', displayNameKey: 'SankeyDiagramSettings_DisplayName_0029',
    items: [
      { value: 'inside', displayName: 'Inside', displayNameKey: 'SankeyDiagramSettings_DisplayName_0030' },
      { value: 'beside', displayName: 'Beside', displayNameKey: 'SankeyDiagramSettings_DisplayName_0031' },
      { value: 'above', displayName: 'Above', displayNameKey: 'SankeyDiagramSettings_DisplayName_0032' },
      { value: 'below', displayName: 'Below', displayNameKey: 'SankeyDiagramSettings_DisplayName_0033' },
      { value: 'none', displayName: 'None (Hover)', displayNameKey: 'SankeyDiagramSettings_DisplayName_0034' },
    ],
    value: { value: 'beside', displayName: 'Beside', displayNameKey: 'SankeyDiagramSettings_DisplayName_0035' },
  });

  labelFontSize = new formattingSettings.NumUpDown({
    name: 'labelFontSize',
    displayName: 'Label Font Size', displayNameKey: 'SankeyDiagramSettings_DisplayName_0036',
    value: 12,
  });

  labelFontFamily = new formattingSettings.ItemDropdown({
    name: 'labelFontFamily',
    displayName: 'Label Font Family', displayNameKey: 'SankeyDiagramSettings_DisplayName_0037',
    items: [
      { value: '', displayName: 'Default', displayNameKey: 'SankeyDiagramSettings_DisplayName_0038' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'SankeyDiagramSettings_DisplayName_0039' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'SankeyDiagramSettings_DisplayName_0040' },
      { value: 'Cambria', displayName: 'Cambria', displayNameKey: 'SankeyDiagramSettings_DisplayName_0041' },
      { value: 'Courier New', displayName: 'Courier New', displayNameKey: 'SankeyDiagramSettings_DisplayName_0042' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'SankeyDiagramSettings_DisplayName_0043' },
      { value: 'Helvetica Neue', displayName: 'Helvetica Neue', displayNameKey: 'SankeyDiagramSettings_DisplayName_0044' },
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'SankeyDiagramSettings_DisplayName_0045' },
      { value: 'Tahoma', displayName: 'Tahoma', displayNameKey: 'SankeyDiagramSettings_DisplayName_0046' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'SankeyDiagramSettings_DisplayName_0047' },
      { value: 'Trebuchet MS', displayName: 'Trebuchet MS', displayNameKey: 'SankeyDiagramSettings_DisplayName_0048' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'SankeyDiagramSettings_DisplayName_0049' },
    ],
    value: { value: '', displayName: 'Default', displayNameKey: 'SankeyDiagramSettings_DisplayName_0050' },
  });

  labelFontWeight = new formattingSettings.ItemDropdown({
    name: 'labelFontWeight',
    displayName: 'Label Font Weight', displayNameKey: 'SankeyDiagramSettings_DisplayName_0051',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'SankeyDiagramSettings_DisplayName_0052' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'SankeyDiagramSettings_DisplayName_0053' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'SankeyDiagramSettings_DisplayName_0054' },
  });

  labelFontStyle = new formattingSettings.ItemDropdown({
    name: 'labelFontStyle',
    displayName: 'Label Font Style', displayNameKey: 'SankeyDiagramSettings_DisplayName_0055',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'SankeyDiagramSettings_DisplayName_0056' },
      { value: 'italic', displayName: 'Italic', displayNameKey: 'SankeyDiagramSettings_DisplayName_0057' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'SankeyDiagramSettings_DisplayName_0058' },
  });

  labelColor = new formattingSettings.ColorPicker({
    name: 'labelColor',
    displayName: 'Label Color (All)', displayNameKey: 'SankeyDiagramSettings_DisplayName_0059',
    value: { value: '' },
  });

  sourceLabelColor = new formattingSettings.ColorPicker({
    name: 'sourceLabelColor',
    displayName: 'Source Label Color', displayNameKey: 'SankeyDiagramSettings_DisplayName_0060',
    value: { value: '' },
  });

  step2LabelColor = new formattingSettings.ColorPicker({
    name: 'step2LabelColor',
    displayName: 'Step 2 Label Color', displayNameKey: 'SankeyDiagramSettings_DisplayName_0061',
    value: { value: '' },
  });

  step3LabelColor = new formattingSettings.ColorPicker({
    name: 'step3LabelColor',
    displayName: 'Step 3 Label Color', displayNameKey: 'SankeyDiagramSettings_DisplayName_0062',
    value: { value: '' },
  });

  step4LabelColor = new formattingSettings.ColorPicker({
    name: 'step4LabelColor',
    displayName: 'Step 4 Label Color', displayNameKey: 'SankeyDiagramSettings_DisplayName_0063',
    value: { value: '' },
  });

  step5LabelColor = new formattingSettings.ColorPicker({
    name: 'step5LabelColor',
    displayName: 'Step 5 Label Color', displayNameKey: 'SankeyDiagramSettings_DisplayName_0064',
    value: { value: '' },
  });

  targetLabelColor = new formattingSettings.ColorPicker({
    name: 'targetLabelColor',
    displayName: 'Target Label Color', displayNameKey: 'SankeyDiagramSettings_DisplayName_0065',
    value: { value: '' },
  });

  name = 'nodeLabelSettings';
  displayName = 'Node Labels';
  displayNameKey = 'SankeyDiagramSettings_DisplayName_0003';
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
    displayName: 'Opacity (%)', displayNameKey: 'SankeyDiagramSettings_DisplayName_0066',
    value: 40,
  });

  hoverOpacity = new formattingSettings.NumUpDown({
    name: 'hoverOpacity',
    displayName: 'Hover Opacity (%)', displayNameKey: 'SankeyDiagramSettings_DisplayName_0067',
    value: 70,
  });

  colorMode = new formattingSettings.ItemDropdown({
    name: 'colorMode',
    displayName: 'Color Mode', displayNameKey: 'SankeyDiagramSettings_DisplayName_0068',
    items: [
      { value: 'source', displayName: 'Source', displayNameKey: 'SankeyDiagramSettings_DisplayName_0069' },
      { value: 'target', displayName: 'Target', displayNameKey: 'SankeyDiagramSettings_DisplayName_0070' },
      { value: 'gradient', displayName: 'Gradient', displayNameKey: 'SankeyDiagramSettings_DisplayName_0071' },
      { value: 'custom', displayName: 'Custom', displayNameKey: 'SankeyDiagramSettings_DisplayName_0072' },
    ],
    value: { value: 'gradient', displayName: 'Gradient', displayNameKey: 'SankeyDiagramSettings_DisplayName_0073' },
  });

  dimOpacity = new formattingSettings.NumUpDown({
    name: 'dimOpacity',
    displayName: 'Dim Opacity (%)', displayNameKey: 'SankeyDiagramSettings_DisplayName_0074',
    value: 8,
  });

  customColor = new formattingSettings.ColorPicker({
    name: 'customColor',
    displayName: 'Custom Color', displayNameKey: 'SankeyDiagramSettings_DisplayName_0075',
    value: { value: '#64748B' },
  });

  curvature = new formattingSettings.NumUpDown({
    name: 'curvature',
    displayName: 'Curvature', displayNameKey: 'SankeyDiagramSettings_DisplayName_0076',
    value: 50,
  });

  opacityByValue = new formattingSettings.ToggleSwitch({
    name: 'opacityByValue',
    displayName: 'Opacity by Value', displayNameKey: 'SankeyDiagramSettings_DisplayName_0078',
    value: false,
  });

  name = 'linkSettings';
  displayName = 'Links';
  displayNameKey = 'SankeyDiagramSettings_DisplayName_0004';
  slices = [
    this.opacity, this.hoverOpacity, this.colorMode, this.customColor, this.curvature,
    this.dimOpacity, this.opacityByValue,
  ];
}

// ── Link Labels (showFlowLabels moved here from Link Features) ──────

class LinkLabelSettings extends formattingSettings.SimpleCard {
  showLinkLabels = new formattingSettings.ToggleSwitch({
    name: 'showLinkLabels',
    displayName: 'Show Link Labels', displayNameKey: 'SankeyDiagramSettings_DisplayName_0079',
    value: false,
  });

  linkLabelFontSize = new formattingSettings.NumUpDown({
    name: 'linkLabelFontSize',
    displayName: 'Font Size', displayNameKey: 'SankeyDiagramSettings_DisplayName_0080',
    value: 10,
  });

  linkLabelFontColor = new formattingSettings.ColorPicker({
    name: 'linkLabelFontColor',
    displayName: 'Font Color', displayNameKey: 'SankeyDiagramSettings_DisplayName_0081',
    value: { value: '#333333' },
  });

  linkLabelFontFamily = new formattingSettings.ItemDropdown({
    name: 'linkLabelFontFamily',
    displayName: 'Font Family', displayNameKey: 'SankeyDiagramSettings_DisplayName_0082',
    items: [
      { value: '', displayName: 'Default', displayNameKey: 'SankeyDiagramSettings_DisplayName_0083' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'SankeyDiagramSettings_DisplayName_0084' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'SankeyDiagramSettings_DisplayName_0085' },
      { value: 'Cambria', displayName: 'Cambria', displayNameKey: 'SankeyDiagramSettings_DisplayName_0086' },
      { value: 'Courier New', displayName: 'Courier New', displayNameKey: 'SankeyDiagramSettings_DisplayName_0087' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'SankeyDiagramSettings_DisplayName_0088' },
      { value: 'Helvetica Neue', displayName: 'Helvetica Neue', displayNameKey: 'SankeyDiagramSettings_DisplayName_0089' },
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'SankeyDiagramSettings_DisplayName_0090' },
      { value: 'Tahoma', displayName: 'Tahoma', displayNameKey: 'SankeyDiagramSettings_DisplayName_0091' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'SankeyDiagramSettings_DisplayName_0092' },
      { value: 'Trebuchet MS', displayName: 'Trebuchet MS', displayNameKey: 'SankeyDiagramSettings_DisplayName_0093' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'SankeyDiagramSettings_DisplayName_0094' },
    ],
    value: { value: '', displayName: 'Default', displayNameKey: 'SankeyDiagramSettings_DisplayName_0095' },
  });

  linkLabelFontWeight = new formattingSettings.ItemDropdown({
    name: 'linkLabelFontWeight',
    displayName: 'Font Weight', displayNameKey: 'SankeyDiagramSettings_DisplayName_0096',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'SankeyDiagramSettings_DisplayName_0097' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'SankeyDiagramSettings_DisplayName_0098' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'SankeyDiagramSettings_DisplayName_0099' },
  });

  linkLabelFormat = new formattingSettings.ItemDropdown({
    name: 'linkLabelFormat',
    displayName: 'Label Format', displayNameKey: 'SankeyDiagramSettings_DisplayName_0100',
    items: [
      { value: 'value', displayName: 'Value', displayNameKey: 'SankeyDiagramSettings_DisplayName_0101' },
      { value: 'percent', displayName: 'Percent', displayNameKey: 'SankeyDiagramSettings_DisplayName_0102' },
      { value: 'both', displayName: 'Both', displayNameKey: 'SankeyDiagramSettings_DisplayName_0103' },
    ],
    value: { value: 'value', displayName: 'Value', displayNameKey: 'SankeyDiagramSettings_DisplayName_0104' },
  });

  showFlowLabels = new formattingSettings.ToggleSwitch({
    name: 'showFlowLabels',
    displayName: 'Show Flow Labels on Hover', displayNameKey: 'SankeyDiagramSettings_DisplayName_0105',
    value: false,
  });

  name = 'linkLabelSettings';
  displayName = 'Link Labels';
  displayNameKey = 'SankeyDiagramSettings_DisplayName_0005';
  slices = [this.showLinkLabels, this.linkLabelFontSize, this.linkLabelFontColor, this.linkLabelFontFamily, this.linkLabelFontWeight, this.linkLabelFormat, this.showFlowLabels];
}

// ── Totals ──────────────────────────────────────────────────────────

class TotalSettings extends formattingSettings.SimpleCard {
  showNodeValues = new formattingSettings.ToggleSwitch({
    name: 'showNodeValues',
    displayName: 'Show Node Values', displayNameKey: 'SankeyDiagramSettings_DisplayName_0106',
    value: false,
  });

  nodeValueFormat = new formattingSettings.ItemDropdown({
    name: 'nodeValueFormat',
    displayName: 'Node Value Format', displayNameKey: 'SankeyDiagramSettings_DisplayName_0107',
    items: [
      { value: 'value', displayName: 'Value', displayNameKey: 'SankeyDiagramSettings_DisplayName_0108' },
      { value: 'percent', displayName: 'Percent', displayNameKey: 'SankeyDiagramSettings_DisplayName_0109' },
      { value: 'both', displayName: 'Both', displayNameKey: 'SankeyDiagramSettings_DisplayName_0110' },
    ],
    value: { value: 'value', displayName: 'Value', displayNameKey: 'SankeyDiagramSettings_DisplayName_0111' },
  });

  showLayerTotals = new formattingSettings.ToggleSwitch({
    name: 'showLayerTotals',
    displayName: 'Show Layer Totals', displayNameKey: 'SankeyDiagramSettings_DisplayName_0112',
    value: false,
  });

  layerTotalPosition = new formattingSettings.ItemDropdown({
    name: 'layerTotalPosition',
    displayName: 'Layer Total Position', displayNameKey: 'SankeyDiagramSettings_DisplayName_0113',
    items: [
      { value: 'top', displayName: 'Top', displayNameKey: 'SankeyDiagramSettings_DisplayName_0114' },
      { value: 'bottom', displayName: 'Bottom', displayNameKey: 'SankeyDiagramSettings_DisplayName_0115' },
    ],
    value: { value: 'top', displayName: 'Top', displayNameKey: 'SankeyDiagramSettings_DisplayName_0116' },
  });

  totalFontSize = new formattingSettings.NumUpDown({
    name: 'totalFontSize',
    displayName: 'Font Size', displayNameKey: 'SankeyDiagramSettings_DisplayName_0117',
    value: 11,
  });

  totalFontColor = new formattingSettings.ColorPicker({
    name: 'totalFontColor',
    displayName: 'Font Color', displayNameKey: 'SankeyDiagramSettings_DisplayName_0118',
    value: { value: '' },
  });

  totalFontFamily = new formattingSettings.ItemDropdown({
    name: 'totalFontFamily',
    displayName: 'Font Family', displayNameKey: 'SankeyDiagramSettings_DisplayName_0119',
    items: [
      { value: '', displayName: 'Default', displayNameKey: 'SankeyDiagramSettings_DisplayName_0120' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'SankeyDiagramSettings_DisplayName_0121' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'SankeyDiagramSettings_DisplayName_0122' },
      { value: 'Cambria', displayName: 'Cambria', displayNameKey: 'SankeyDiagramSettings_DisplayName_0123' },
      { value: 'Courier New', displayName: 'Courier New', displayNameKey: 'SankeyDiagramSettings_DisplayName_0124' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'SankeyDiagramSettings_DisplayName_0125' },
      { value: 'Helvetica Neue', displayName: 'Helvetica Neue', displayNameKey: 'SankeyDiagramSettings_DisplayName_0126' },
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'SankeyDiagramSettings_DisplayName_0127' },
      { value: 'Tahoma', displayName: 'Tahoma', displayNameKey: 'SankeyDiagramSettings_DisplayName_0128' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'SankeyDiagramSettings_DisplayName_0129' },
      { value: 'Trebuchet MS', displayName: 'Trebuchet MS', displayNameKey: 'SankeyDiagramSettings_DisplayName_0130' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'SankeyDiagramSettings_DisplayName_0131' },
    ],
    value: { value: '', displayName: 'Default', displayNameKey: 'SankeyDiagramSettings_DisplayName_0132' },
  });

  totalFontWeight = new formattingSettings.ItemDropdown({
    name: 'totalFontWeight',
    displayName: 'Font Weight', displayNameKey: 'SankeyDiagramSettings_DisplayName_0133',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'SankeyDiagramSettings_DisplayName_0134' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'SankeyDiagramSettings_DisplayName_0135' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'SankeyDiagramSettings_DisplayName_0136' },
    ],
    value: { value: '600', displayName: 'Semi-Bold', displayNameKey: 'SankeyDiagramSettings_DisplayName_0137' },
  });

  name = 'totalSettings';
  displayName = 'Totals';
  displayNameKey = 'SankeyDiagramSettings_DisplayName_0006';
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
    displayName: 'Node Alignment', displayNameKey: 'SankeyDiagramSettings_DisplayName_0138',
    items: [
      { value: 'justify', displayName: 'Justify', displayNameKey: 'SankeyDiagramSettings_DisplayName_0139' },
      { value: 'left', displayName: 'Left', displayNameKey: 'SankeyDiagramSettings_DisplayName_0140' },
      { value: 'right', displayName: 'Right', displayNameKey: 'SankeyDiagramSettings_DisplayName_0141' },
      { value: 'center', displayName: 'Center', displayNameKey: 'SankeyDiagramSettings_DisplayName_0142' },
    ],
    value: { value: 'justify', displayName: 'Justify', displayNameKey: 'SankeyDiagramSettings_DisplayName_0143' },
  });

  sortOrder = new formattingSettings.ItemDropdown({
    name: 'sortOrder',
    displayName: 'Sort Order', displayNameKey: 'SankeyDiagramSettings_DisplayName_0144',
    items: [
      { value: 'auto', displayName: 'Automatic', displayNameKey: 'SankeyDiagramSettings_DisplayName_0145' },
      { value: 'ascending', displayName: 'Ascending', displayNameKey: 'SankeyDiagramSettings_DisplayName_0146' },
      { value: 'descending', displayName: 'Descending', displayNameKey: 'SankeyDiagramSettings_DisplayName_0147' },
      { value: 'none', displayName: 'None', displayNameKey: 'SankeyDiagramSettings_DisplayName_0148' },
    ],
    value: { value: 'auto', displayName: 'Automatic', displayNameKey: 'SankeyDiagramSettings_DisplayName_0149' },
  });

  iterations = new formattingSettings.NumUpDown({
    name: 'iterations',
    displayName: 'Layout Iterations', displayNameKey: 'SankeyDiagramSettings_DisplayName_0150',
    value: 6,
  });

  name = 'layoutSettings';
  displayName = 'Layout';
  displayNameKey = 'SankeyDiagramSettings_DisplayName_0007';
  slices = [this.nodeAlign, this.sortOrder, this.iterations];
}

// ── Tooltips ────────────────────────────────────────────────────────

class TooltipSettings extends formattingSettings.SimpleCard {
  showTooltips = new formattingSettings.ToggleSwitch({
    name: 'showTooltips',
    displayName: 'Show Tooltips', displayNameKey: 'SankeyDiagramSettings_DisplayName_0151',
    value: true,
  });

  showPercentage = new formattingSettings.ToggleSwitch({
    name: 'showPercentage',
    displayName: 'Show Percentage', displayNameKey: 'SankeyDiagramSettings_DisplayName_0152',
    value: false,
  });

  valueFormat = new formattingSettings.ItemDropdown({
    name: 'valueFormat',
    displayName: 'Value Format', displayNameKey: 'SankeyDiagramSettings_DisplayName_0153',
    items: [
      { value: 'auto', displayName: 'Auto', displayNameKey: 'SankeyDiagramSettings_DisplayName_0154' },
      { value: 'full', displayName: 'Full', displayNameKey: 'SankeyDiagramSettings_DisplayName_0155' },
      { value: 'abbreviated', displayName: 'Abbreviated', displayNameKey: 'SankeyDiagramSettings_DisplayName_0156' },
    ],
    value: { value: 'auto', displayName: 'Auto', displayNameKey: 'SankeyDiagramSettings_DisplayName_0157' },
  });

  name = 'tooltipSettings';
  displayName = 'Tooltips';
  displayNameKey = 'SankeyDiagramSettings_DisplayName_0008';
  slices = [this.showTooltips, this.showPercentage, this.valueFormat];
}

// ── Card Style ──────────────────────────────────────────────────────

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style', displayNameKey: 'SankeyDiagramSettings_DisplayName_0158',
    items: CARD_STYLE_MODE_ITEMS,
    value: { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'SankeyDiagramSettings_DisplayName_0163' },
  });

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background Color', displayNameKey: 'SankeyDiagramSettings_DisplayName_0164',
    value: { value: '' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Background Opacity (%)', displayNameKey: 'SankeyDiagramSettings_DisplayName_0165',
    value: 85,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius', displayNameKey: 'SankeyDiagramSettings_DisplayName_0166',
    value: 12,
  });

  contentPadding = new formattingSettings.NumUpDown({
    name: 'contentPadding',
    displayName: 'Content Padding', displayNameKey: 'SankeyDiagramSettings_DisplayName_0167',
    value: 20,
  });

  name = 'cardSettings';
  displayName = 'Card Style';
  displayNameKey = 'SankeyDiagramSettings_DisplayName_0009';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.contentPadding];
}

// ── Animation ───────────────────────────────────────────────────────

class AnimationSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Animations', displayNameKey: 'SankeyDiagramSettings_DisplayName_0168',
    value: true,
  });

  duration = new formattingSettings.NumUpDown({
    name: 'duration',
    displayName: 'Duration (ms)', displayNameKey: 'SankeyDiagramSettings_DisplayName_0169',
    value: 600,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  displayNameKey = 'SankeyDiagramSettings_DisplayName_0010';
  slices = [this.enabled, this.duration];
}

// ── Interaction ─────────────────────────────────────────────────────

class SankeyInteractionSettings extends formattingSettings.SimpleCard {
  highlightFlows = new formattingSettings.ToggleSwitch({
    name: 'highlightFlows',
    displayName: 'Highlight Flow Path', displayNameKey: 'SankeyDiagramSettings_DisplayName_0170',
    value: true,
  });

  enableDrag = new formattingSettings.ToggleSwitch({
    name: 'enableDrag',
    displayName: 'Enable Node Drag', displayNameKey: 'SankeyDiagramSettings_DisplayName_0171',
    value: false,
  });

  enableFiltering = new formattingSettings.ToggleSwitch({
    name: 'enableFiltering',
    displayName: 'Enable Flow Filtering', displayNameKey: 'SankeyDiagramSettings_DisplayName_0172',
    value: false,
  });

  crossHighlightMode = new formattingSettings.ItemDropdown({
    name: 'crossHighlightMode',
    displayName: 'Cross-Highlight Behavior', displayNameKey: 'SankeyDiagramSettings_DisplayName_0173',
    items: [
      { value: 'focus', displayName: 'Show Highlighted Data Only', displayNameKey: 'SankeyDiagramSettings_DisplayName_0174' },
      { value: 'dim', displayName: 'Dim Unhighlighted Data', displayNameKey: 'SankeyDiagramSettings_DisplayName_0175' },
    ],
    value: { value: 'focus', displayName: 'Show Highlighted Data Only', displayNameKey: 'SankeyDiagramSettings_DisplayName_0176' },
  });

  name = 'sankeyInteractionSettings';
  displayName = 'Interaction';
  displayNameKey = 'SankeyDiagramSettings_DisplayName_0011';
  slices = [this.highlightFlows, this.enableDrag, this.enableFiltering, this.crossHighlightMode];
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

  legendFormattingCard = (() => {
    const card = new LegendFormattingCard();
    card.slices = card.slices.filter((slice) =>
      !['showInlineLabels', 'inlineLabelFontSize', 'inlineLabelOffset'].includes(slice.name)
    );
    return card;
  })();

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
    this.sankeyInteractionSettings,
    this.tooltipSettings,
    this.legendFormattingCard,
    this.numberFormattingCard,
    this.scrollFormattingCard,
    this.conditionalFormattingCard,
    this.animationSettings,
    this.titleFormattingCard,
    this.cardSettings,
    this.colorThemeFormattingCard,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
