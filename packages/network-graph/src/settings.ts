/**
 * Network Graph — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import {
  LegendFormattingCard,
  DataLabelFormattingCard,
  TitleFormattingCard,
  ConditionalFormattingCard,
  AccessibilityFormattingCard,
  ColorThemeFormattingCard,
  DateFilterFormattingCard,
  NumberFormattingCard,
  CARD_STYLE_MODE_ITEMS
} from '../../core/src';

// ── Nodes ─────────────────────────────────────────────────────────────────────

class NodeSettings extends formattingSettings.SimpleCard {
  radius = new formattingSettings.NumUpDown({
    name: 'radius',
    displayName: 'Node Radius', displayNameKey: 'NetworkGraphSettings_DisplayName_0008',
    value: 8,
  });

  minRadius = new formattingSettings.NumUpDown({
    name: 'minRadius',
    displayName: 'Min Dynamic Radius',
    value: 4,
  });

  maxRadius = new formattingSettings.NumUpDown({
    name: 'maxRadius',
    displayName: 'Max Dynamic Radius',
    value: 20,
  });

  showLabels = new formattingSettings.ToggleSwitch({
    name: 'showLabels',
    displayName: 'Show Labels', displayNameKey: 'NetworkGraphSettings_DisplayName_0009',
    value: true,
  });

  nodeBorderColor = new formattingSettings.ColorPicker({
    name: 'nodeBorderColor',
    displayName: 'Node Border Color', displayNameKey: 'NetworkGraphSettings_DisplayName_0010',
    value: { value: '' },
  });

  nodeBorderWidth = new formattingSettings.NumUpDown({
    name: 'nodeBorderWidth',
    displayName: 'Node Border Width', displayNameKey: 'NetworkGraphSettings_DisplayName_0011',
    value: 1.5,
  });

  // Moved from NetworkLayoutSettings
  sizeByDegree = new formattingSettings.ToggleSwitch({
    name: 'sizeByDegree',
    displayName: 'Size by Degree', displayNameKey: 'NetworkGraphSettings_DisplayName_0012',
    value: false,
  });

  targetSizeMode = new formattingSettings.ItemDropdown({
    name: 'targetSizeMode',
    displayName: 'Target Size Mode',
    items: [
      { value: 'fixed', displayName: 'Fixed' },
      { value: 'count', displayName: 'Connection Count' },
      { value: 'weight', displayName: 'Total Weight' },
    ],
    value: { value: 'fixed', displayName: 'Fixed' },
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Label Font Size', displayNameKey: 'NetworkGraphSettings_DisplayName_0013',
    value: 11,
  });

  useRoleLabelFontSizes = new formattingSettings.ToggleSwitch({
    name: 'useRoleLabelFontSizes',
    displayName: 'Use Role Label Sizes',
    value: false,
  });

  sourceLabelFontSize = new formattingSettings.NumUpDown({
    name: 'sourceLabelFontSize',
    displayName: 'Source Label Font Size',
    value: 11,
  });

  targetLabelFontSize = new formattingSettings.NumUpDown({
    name: 'targetLabelFontSize',
    displayName: 'Target Label Font Size',
    value: 11,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Label Font Color', displayNameKey: 'NetworkGraphSettings_DisplayName_0014',
    value: { value: '' },
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Font Family', displayNameKey: 'NetworkGraphSettings_DisplayName_0015',
    items: [
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'NetworkGraphSettings_DisplayName_0016' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'NetworkGraphSettings_DisplayName_0017' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'NetworkGraphSettings_DisplayName_0018' },
      { value: 'Helvetica', displayName: 'Helvetica', displayNameKey: 'NetworkGraphSettings_DisplayName_0019' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'NetworkGraphSettings_DisplayName_0020' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'NetworkGraphSettings_DisplayName_0021' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'NetworkGraphSettings_DisplayName_0022' },
    ],
    value: { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'NetworkGraphSettings_DisplayName_0023' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Font Weight', displayNameKey: 'NetworkGraphSettings_DisplayName_0024',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'NetworkGraphSettings_DisplayName_0025' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'NetworkGraphSettings_DisplayName_0026' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'NetworkGraphSettings_DisplayName_0027' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'NetworkGraphSettings_DisplayName_0028' },
  });

  labelVisibility = new formattingSettings.ItemDropdown({
    name: 'labelVisibility',
    displayName: 'Label Visibility',
    items: [
      { value: 'smart', displayName: 'Smart Density' },
      { value: 'always', displayName: 'Always' },
      { value: 'hover', displayName: 'Hover' },
      { value: 'selected', displayName: 'Selected' },
      { value: 'adaptive', displayName: 'Adaptive Zoom' },
    ],
    value: { value: 'smart', displayName: 'Smart Density' },
  });

  labelPosition = new formattingSettings.ItemDropdown({
    name: 'labelPosition',
    displayName: 'Label Position',
    items: [
      { value: 'right', displayName: 'Outside Right' },
      { value: 'inside', displayName: 'Inside Node' },
      { value: 'left', displayName: 'Outside Left' },
      { value: 'above', displayName: 'Above Node' },
      { value: 'below', displayName: 'Below Node' },
    ],
    value: { value: 'right', displayName: 'Outside Right' },
  });

  adaptiveZoomThreshold = new formattingSettings.NumUpDown({
    name: 'adaptiveZoomThreshold',
    displayName: 'Adaptive Zoom Threshold',
    value: 1.2,
  });

  labelOffset = new formattingSettings.NumUpDown({
    name: 'labelOffset',
    displayName: 'Label Offset',
    value: 8,
  });

  maxLabelCharacters = new formattingSettings.NumUpDown({
    name: 'maxLabelCharacters',
    displayName: 'Max Label Characters',
    value: 28,
  });

  labelHalo = new formattingSettings.ToggleSwitch({
    name: 'labelHalo',
    displayName: 'Label Halo',
    value: true,
  });

  labelHaloColor = new formattingSettings.ColorPicker({
    name: 'labelHaloColor',
    displayName: 'Halo Color',
    value: { value: '#ffffff' },
  });

  labelHaloWidth = new formattingSettings.NumUpDown({
    name: 'labelHaloWidth',
    displayName: 'Halo Width',
    value: 3,
  });

  name = 'nodeSettings';
  displayName = 'Nodes';
  displayNameKey = 'NetworkGraphSettings_DisplayName_0001';
  slices = [
    this.radius,
    this.showLabels,
    this.nodeBorderColor,
    this.nodeBorderWidth,
    this.sizeByDegree,
    this.targetSizeMode,
    this.minRadius,
    this.maxRadius,
    this.fontSize,
    this.useRoleLabelFontSizes,
    this.sourceLabelFontSize,
    this.targetLabelFontSize,
    this.fontColor,
    this.fontFamily,
    this.fontWeight,
    this.labelVisibility,
    this.labelPosition,
    this.adaptiveZoomThreshold,
    this.labelOffset,
    this.maxLabelCharacters,
    this.labelHalo,
    this.labelHaloColor,
    this.labelHaloWidth,
  ];
}

// ── Links (merged LinkSettings + NetworkLinkSettings) ─────────────────────────

class LinkSettings extends formattingSettings.SimpleCard {
  linkColor = new formattingSettings.ColorPicker({
    name: 'linkColor',
    displayName: 'Link Color', displayNameKey: 'NetworkGraphSettings_DisplayName_0029',
    value: { value: '' },
  });

  linkWidth = new formattingSettings.NumUpDown({
    name: 'linkWidth',
    displayName: 'Link Width', displayNameKey: 'NetworkGraphSettings_DisplayName_0030',
    value: 2,
  });

  opacity = new formattingSettings.NumUpDown({
    name: 'opacity',
    displayName: 'Opacity (%)', displayNameKey: 'NetworkGraphSettings_DisplayName_0031',
    value: 72,
  });

  showArrows = new formattingSettings.ToggleSwitch({
    name: 'showArrows',
    displayName: 'Show Arrows', displayNameKey: 'NetworkGraphSettings_DisplayName_0032',
    value: false,
  });

  widthByWeight = new formattingSettings.ToggleSwitch({
    name: 'widthByWeight',
    displayName: 'Width by Weight', displayNameKey: 'NetworkGraphSettings_DisplayName_0033',
    value: false,
  });

  minWidth = new formattingSettings.NumUpDown({
    name: 'minWidth',
    displayName: 'Min Link Width', displayNameKey: 'NetworkGraphSettings_DisplayName_0034',
    value: 1.5,
  });

  maxWidth = new formattingSettings.NumUpDown({
    name: 'maxWidth',
    displayName: 'Max Link Width', displayNameKey: 'NetworkGraphSettings_DisplayName_0035',
    value: 8,
  });

  showWeightLabels = new formattingSettings.ToggleSwitch({
    name: 'showWeightLabels',
    displayName: 'Show Weight Labels',
    value: false,
  });

  weightLabelFontSize = new formattingSettings.NumUpDown({
    name: 'weightLabelFontSize',
    displayName: 'Weight Label Font Size',
    value: 11,
  });

  weightLabelFontColor = new formattingSettings.ColorPicker({
    name: 'weightLabelFontColor',
    displayName: 'Weight Label Color',
    value: { value: '#0F172A' },
  });

  weightLabelBackgroundColor = new formattingSettings.ColorPicker({
    name: 'weightLabelBackgroundColor',
    displayName: 'Weight Label Background',
    value: { value: '#ffffff' },
  });

  weightLabelBackgroundOpacity = new formattingSettings.NumUpDown({
    name: 'weightLabelBackgroundOpacity',
    displayName: 'Weight Label Background Opacity (%)',
    value: 85,
  });

  minWeightLabel = new formattingSettings.NumUpDown({
    name: 'minWeightLabel',
    displayName: 'Minimum Weight to Label',
    value: 0,
  });

  name = 'linkSettings';
  displayName = 'Links';
  displayNameKey = 'NetworkGraphSettings_DisplayName_0002';
  slices = [
    this.linkColor,
    this.linkWidth,
    this.opacity,
    this.showArrows,
    this.widthByWeight,
    this.minWidth,
    this.maxWidth,
    this.showWeightLabels,
    this.weightLabelFontSize,
    this.weightLabelFontColor,
    this.weightLabelBackgroundColor,
    this.weightLabelBackgroundOpacity,
    this.minWeightLabel,
  ];
}

// ── Colors & Theme (merged ColorSettings + ColorThemeFormattingCard) ──────────

class ColorsAndThemeSettings extends formattingSettings.SimpleCard {
  colorByNodeRole = new formattingSettings.ToggleSwitch({
    name: 'colorByNodeRole',
    displayName: 'Color by Source/Target Role',
    value: true,
  });

  sourceNodeColor = new formattingSettings.ColorPicker({
    name: 'sourceNodeColor',
    displayName: 'Source Node Color',
    value: { value: '#2563EB' },
  });

  targetNodeColor = new formattingSettings.ColorPicker({
    name: 'targetNodeColor',
    displayName: 'Target Node Color',
    value: { value: '#DC2626' },
  });

  bothRoleNodeColor = new formattingSettings.ColorPicker({
    name: 'bothRoleNodeColor',
    displayName: 'Source + Target Node Color',
    value: { value: '#D97706' },
  });

  useChartPalette = new formattingSettings.ToggleSwitch({
    name: 'useChartPalette',
    displayName: 'Use Chart Palette', displayNameKey: 'NetworkGraphSettings_DisplayName_0036',
    value: true,
  });

  // Clustering moved here from NetworkLayoutSettings
  enableClustering = new formattingSettings.ToggleSwitch({
    name: 'enableClustering',
    displayName: 'Cluster Detection & Coloring', displayNameKey: 'NetworkGraphSettings_DisplayName_0037',
    value: false,
  });

  name = 'colorSettings';
  displayName = 'Colors & Theme';
  displayNameKey = 'NetworkGraphSettings_DisplayName_0003';
  slices = [
    this.colorByNodeRole,
    this.sourceNodeColor,
    this.targetNodeColor,
    this.bothRoleNodeColor,
    this.useChartPalette,
    this.enableClustering,
  ];
}

// ── Card Style ────────────────────────────────────────────────────────────────

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style', displayNameKey: 'NetworkGraphSettings_DisplayName_0038',
    items: CARD_STYLE_MODE_ITEMS,
    value: { value: 'glass', displayName: 'Glass', displayNameKey: 'NetworkGraphSettings_DisplayName_0043' },
  });

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background Color', displayNameKey: 'NetworkGraphSettings_DisplayName_0044',
    value: { value: '' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Background Opacity (%)', displayNameKey: 'NetworkGraphSettings_DisplayName_0045',
    value: 35,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius', displayNameKey: 'NetworkGraphSettings_DisplayName_0046',
    value: 12,
  });

  contentPadding = new formattingSettings.NumUpDown({
    name: 'contentPadding',
    displayName: 'Content Padding', displayNameKey: 'NetworkGraphSettings_DisplayName_0047',
    value: 12,
  });

  name = 'cardSettings';
  displayName = 'Card Style';
  displayNameKey = 'NetworkGraphSettings_DisplayName_0004';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.contentPadding];
}

// ── Interaction (merged NetworkInteractionSettings + ZoomSettings) ─────────────

class InteractionSettings extends formattingSettings.SimpleCard {
  enableDrag = new formattingSettings.ToggleSwitch({
    name: 'enableDrag',
    displayName: 'Enable Node Drag', displayNameKey: 'NetworkGraphSettings_DisplayName_0048',
    value: true,
  });

  pinDraggedNodes = new formattingSettings.ToggleSwitch({
    name: 'pinDraggedNodes',
    displayName: 'Pin Dragged Nodes',
    value: true,
  });

  enableSearch = new formattingSettings.ToggleSwitch({
    name: 'enableSearch',
    displayName: 'Enable Search', displayNameKey: 'NetworkGraphSettings_DisplayName_0049',
    value: false,
  });

  highlightNeighbors = new formattingSettings.ToggleSwitch({
    name: 'highlightNeighbors',
    displayName: 'Highlight Neighbors on Hover', displayNameKey: 'NetworkGraphSettings_DisplayName_0050',
    value: true,
  });

  enableZoom = new formattingSettings.ToggleSwitch({
    name: 'enableZoom',
    displayName: 'Enable Zoom & Pan', displayNameKey: 'NetworkGraphSettings_DisplayName_0051',
    value: true,
  });

  minZoom = new formattingSettings.NumUpDown({
    name: 'minZoom',
    displayName: 'Min Zoom', displayNameKey: 'NetworkGraphSettings_DisplayName_0052',
    value: 0.3,
  });

  maxZoom = new formattingSettings.NumUpDown({
    name: 'maxZoom',
    displayName: 'Max Zoom', displayNameKey: 'NetworkGraphSettings_DisplayName_0053',
    value: 5,
  });

  zoomWheelSensitivity = new formattingSettings.NumUpDown({
    name: 'zoomWheelSensitivity',
    displayName: 'Zoom Wheel Sensitivity (%)',
    value: 50,
  });

  crossHighlightMode = new formattingSettings.ItemDropdown({
    name: 'crossHighlightMode',
    displayName: 'Cross-Highlight Mode',
    items: [
      { value: 'focus', displayName: 'Focus' },
      { value: 'dim', displayName: 'Dim Others' },
    ],
    value: { value: 'focus', displayName: 'Focus' },
  });

  name = 'zoomSettings';
  displayName = 'Interaction';
  displayNameKey = 'NetworkGraphSettings_DisplayName_0005';
  slices = [this.enableDrag, this.pinDraggedNodes, this.enableSearch, this.highlightNeighbors, this.enableZoom, this.minZoom, this.maxZoom, this.zoomWheelSensitivity, this.crossHighlightMode];
}

// ── Physics & Layout ──────────────────────────────────────────────────────────

class PhysicsAndLayoutSettings extends formattingSettings.SimpleCard {
  layoutMode = new formattingSettings.ItemDropdown({
    name: 'layoutMode',
    displayName: 'Layout Preset',
    items: [
      { value: 'sourceTarget', displayName: 'Source / Target Spread' },
      { value: 'force', displayName: 'Free Force' },
      { value: 'mapCanvas', displayName: 'Map Canvas' },
    ],
    value: { value: 'sourceTarget', displayName: 'Source / Target Spread' },
  });

  strength = new formattingSettings.NumUpDown({
    name: 'strength',
    displayName: 'Link Strength', displayNameKey: 'NetworkGraphSettings_DisplayName_0054',
    value: 0.35,
  });

  linkDistance = new formattingSettings.NumUpDown({
    name: 'linkDistance',
    displayName: 'Link Distance', displayNameKey: 'NetworkGraphSettings_DisplayName_0055',
    value: 150,
  });

  chargeStrength = new formattingSettings.NumUpDown({
    name: 'chargeStrength',
    displayName: 'Charge Strength', displayNameKey: 'NetworkGraphSettings_DisplayName_0056',
    value: -650,
  });

  roleSeparation = new formattingSettings.NumUpDown({
    name: 'roleSeparation',
    displayName: 'Source/Target Separation',
    value: 320,
  });

  roleSpread = new formattingSettings.NumUpDown({
    name: 'roleSpread',
    displayName: 'Lane Spread',
    value: 300,
  });

  roleForceStrength = new formattingSettings.NumUpDown({
    name: 'roleForceStrength',
    displayName: 'Lane Force Strength',
    value: 0.24,
  });

  enableCollision = new formattingSettings.ToggleSwitch({
    name: 'enableCollision',
    displayName: 'Collision Prevention', displayNameKey: 'NetworkGraphSettings_DisplayName_0057',
    value: true,
  });

  edgeBundling = new formattingSettings.ToggleSwitch({
    name: 'edgeBundling',
    displayName: 'Edge Bundling', displayNameKey: 'NetworkGraphSettings_DisplayName_0058',
    value: false,
  });

  autoCenter = new formattingSettings.ToggleSwitch({
    name: 'autoCenter',
    displayName: 'Auto-Center on Load',
    value: true,
  });

  fitOnLoad = new formattingSettings.ToggleSwitch({
    name: 'fitOnLoad',
    displayName: 'Fit to View on Load',
    value: true,
  });

  fitPadding = new formattingSettings.NumUpDown({
    name: 'fitPadding',
    displayName: 'Fit Padding',
    value: 24,
  });

  settleTicks = new formattingSettings.NumUpDown({
    name: 'settleTicks',
    displayName: 'Initial Settle Ticks',
    value: 100,
  });

  name = 'forceSettings';
  displayName = 'Physics & Layout';
  displayNameKey = 'NetworkGraphSettings_DisplayName_0006';
  slices = [
    this.layoutMode,
    this.strength,
    this.linkDistance,
    this.chargeStrength,
    this.roleSeparation,
    this.roleSpread,
    this.roleForceStrength,
    this.enableCollision,
    this.edgeBundling,
    this.autoCenter,
    this.fitOnLoad,
    this.fitPadding,
    this.settleTicks,
  ];
}

// ── Map Canvas ───────────────────────────────────────────────────────────────

class MapCanvasSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Map Canvas',
    value: false,
  });

  showUploadControl = new formattingSettings.ToggleSwitch({
    name: 'showUploadControl',
    displayName: 'Show Upload Button',
    value: false,
  });

  imageSource = new formattingSettings.TextInput({
    name: 'imageSource',
    displayName: 'Image URL/Data URI',
    value: '',
    placeholder: 'Auto-filled by Upload Map, or paste WebP, PNG, SVG, or image URL',
  });

  imageFit = new formattingSettings.ItemDropdown({
    name: 'imageFit',
    displayName: 'Image Fit',
    items: [
      { value: 'contain', displayName: 'Contain' },
      { value: 'cover', displayName: 'Cover' },
      { value: 'stretch', displayName: 'Stretch' },
    ],
    value: { value: 'contain', displayName: 'Contain' },
  });

  horizontalAlign = new formattingSettings.ItemDropdown({
    name: 'horizontalAlign',
    displayName: 'Horizontal Align',
    items: [
      { value: 'left', displayName: 'Left' },
      { value: 'center', displayName: 'Center' },
      { value: 'right', displayName: 'Right' },
    ],
    value: { value: 'center', displayName: 'Center' },
  });

  verticalAlign = new formattingSettings.ItemDropdown({
    name: 'verticalAlign',
    displayName: 'Vertical Align',
    items: [
      { value: 'top', displayName: 'Top' },
      { value: 'middle', displayName: 'Middle' },
      { value: 'bottom', displayName: 'Bottom' },
    ],
    value: { value: 'middle', displayName: 'Middle' },
  });

  imageOpacity = new formattingSettings.NumUpDown({
    name: 'imageOpacity',
    displayName: 'Image Opacity (%)',
    value: 85,
  });

  dimOverlayOpacity = new formattingSettings.NumUpDown({
    name: 'dimOverlayOpacity',
    displayName: 'Dim Overlay (%)',
    value: 12,
  });

  targetLayoutPreset = new formattingSettings.ItemDropdown({
    name: 'targetLayoutPreset',
    displayName: 'Target Layout Preset',
    items: [
      { value: 'orbit', displayName: 'Orbit Sources' },
      { value: 'cluster', displayName: 'Source Clusters' },
      { value: 'hybrid', displayName: 'Hybrid Rings' },
      { value: 'rail', displayName: 'Rail' },
    ],
    value: { value: 'orbit', displayName: 'Orbit Sources' },
  });

  targetOrbitRadius = new formattingSettings.NumUpDown({
    name: 'targetOrbitRadius',
    displayName: 'Target Link Length',
    value: 40,
  });

  targetRailPosition = new formattingSettings.ItemDropdown({
    name: 'targetRailPosition',
    displayName: 'Target Rail Position',
    items: [
      { value: 'right', displayName: 'Right' },
      { value: 'left', displayName: 'Left' },
      { value: 'top', displayName: 'Top' },
      { value: 'bottom', displayName: 'Bottom' },
    ],
    value: { value: 'right', displayName: 'Right' },
  });

  persistedSourcePositions = new formattingSettings.TextInput({
    name: 'persistedSourcePositions',
    displayName: 'Saved Source Positions',
    value: '',
    placeholder: 'Saved automatically when source nodes are dragged',
  });

  resetPositions = new formattingSettings.ToggleSwitch({
    name: 'resetPositions',
    displayName: 'Reset Saved Positions',
    value: false,
  });

  name = 'mapCanvasSettings';
  displayName = 'Map Canvas';
  slices = [
    this.enabled,
    this.showUploadControl,
    this.imageSource,
    this.imageFit,
    this.horizontalAlign,
    this.verticalAlign,
    this.imageOpacity,
    this.dimOverlayOpacity,
    this.targetLayoutPreset,
    this.targetOrbitRadius,
    this.targetRailPosition,
    this.persistedSourcePositions,
    this.resetPositions,
  ];
}

// ── Measure Badges ──────────────────────────────────────────────────────────

class MeasureBadgeSettings extends formattingSettings.SimpleCard {
  showBadges = new formattingSettings.ToggleSwitch({
    name: 'showBadges',
    displayName: 'Show Measure Badges',
    value: false,
  });

  badgeMeasureName = new formattingSettings.TextInput({
    name: 'badgeMeasureName',
    displayName: 'Badge Measure Name',
    value: '',
    placeholder: 'Blank uses first detail measure',
  });

  badgeDisplayMode = new formattingSettings.ItemDropdown({
    name: 'badgeDisplayMode',
    displayName: 'Badge Text',
    items: [
      { value: 'value', displayName: 'Value' },
      { value: 'nameValue', displayName: 'Name + Value' },
      { value: 'name', displayName: 'Name' },
    ],
    value: { value: 'value', displayName: 'Value' },
  });

  badgeFontSize = new formattingSettings.NumUpDown({
    name: 'badgeFontSize',
    displayName: 'Badge Font Size',
    value: 11,
  });

  badgeColor = new formattingSettings.ColorPicker({
    name: 'badgeColor',
    displayName: 'Badge Text Color',
    value: { value: '#0F172A' },
  });

  badgeBackgroundColor = new formattingSettings.ColorPicker({
    name: 'badgeBackgroundColor',
    displayName: 'Badge Background',
    value: { value: '#FFFFFF' },
  });

  badgeBackgroundOpacity = new formattingSettings.NumUpDown({
    name: 'badgeBackgroundOpacity',
    displayName: 'Badge Background Opacity (%)',
    value: 90,
  });

  badgeOffset = new formattingSettings.NumUpDown({
    name: 'badgeOffset',
    displayName: 'Badge Offset',
    value: 16,
  });

  name = 'measureBadgeSettings';
  displayName = 'Measure Badges';
  slices = [
    this.showBadges,
    this.badgeMeasureName,
    this.badgeDisplayMode,
    this.badgeFontSize,
    this.badgeColor,
    this.badgeBackgroundColor,
    this.badgeBackgroundOpacity,
    this.badgeOffset,
  ];
}

// ── Node Inspector ──────────────────────────────────────────────────────────

class NodeInspectorSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Click Inspector',
    value: true,
  });

  position = new formattingSettings.ItemDropdown({
    name: 'position',
    displayName: 'Inspector Position',
    items: [
      { value: 'right', displayName: 'Right' },
      { value: 'left', displayName: 'Left' },
      { value: 'bottom', displayName: 'Bottom' },
    ],
    value: { value: 'right', displayName: 'Right' },
  });

  showCoreMetrics = new formattingSettings.ToggleSwitch({
    name: 'showCoreMetrics',
    displayName: 'Show Core Metrics',
    value: true,
  });

  showDetailMeasures = new formattingSettings.ToggleSwitch({
    name: 'showDetailMeasures',
    displayName: 'Show Detail Measures',
    value: true,
  });

  showDetailColumns = new formattingSettings.ToggleSwitch({
    name: 'showDetailColumns',
    displayName: 'Show Detail Columns',
    value: true,
  });

  maxDetailValues = new formattingSettings.NumUpDown({
    name: 'maxDetailValues',
    displayName: 'Max Values per Detail',
    value: 6,
  });

  focusOnClick = new formattingSettings.ToggleSwitch({
    name: 'focusOnClick',
    displayName: 'Zoom to Clicked Node',
    value: true,
  });

  focusZoomScale = new formattingSettings.NumUpDown({
    name: 'focusZoomScale',
    displayName: 'Focus Zoom Scale',
    value: 1.45,
  });

  name = 'nodeInspectorSettings';
  displayName = 'Node Inspector';
  slices = [
    this.enabled,
    this.position,
    this.showCoreMetrics,
    this.showDetailMeasures,
    this.showDetailColumns,
    this.maxDetailValues,
    this.focusOnClick,
    this.focusZoomScale,
  ];
}

// ── Animation Settings ──────────────────────────────────────────────────────

class AnimationSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Animations', displayNameKey: 'NetworkGraphSettings_DisplayName_0059',
    value: true,
  });

  duration = new formattingSettings.NumUpDown({
    name: 'duration',
    displayName: 'Duration (ms)', displayNameKey: 'NetworkGraphSettings_DisplayName_0060',
    value: 600,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  displayNameKey = 'NetworkGraphSettings_DisplayName_0007';
  slices = [this.enabled, this.duration];
}

// ── Root Model ──────────────────────────────────────────────────────────────

export class NetworkGraphSettings extends formattingSettings.Model {
  nodeSettings = new NodeSettings();
  linkSettings = new LinkSettings();
  colorsAndThemeSettings = new ColorsAndThemeSettings();
  cardSettings = new CardStyleSettings();
  interactionSettings = new InteractionSettings();
  physicsAndLayoutSettings = new PhysicsAndLayoutSettings();
  mapCanvasSettings = new MapCanvasSettings();
  measureBadgeSettings = new MeasureBadgeSettings();
  nodeInspectorSettings = new NodeInspectorSettings();
  animationSettings = new AnimationSettings();

  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  numberFormattingCard = new NumberFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();
  colorThemeFormattingCard = new ColorThemeFormattingCard();
  legendFormattingCard = new LegendFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();

  cards = [
    this.nodeSettings,
    this.linkSettings,
    this.colorsAndThemeSettings,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.numberFormattingCard,
    this.cardSettings,
    this.interactionSettings,
    this.physicsAndLayoutSettings,
    this.mapCanvasSettings,
    this.measureBadgeSettings,
    this.nodeInspectorSettings,
    this.animationSettings,
    this.conditionalFormattingCard,
    this.accessibilityFormattingCard,
    this.colorThemeFormattingCard,
    this.legendFormattingCard,
    this.dateFilterFormattingCard,
  ];
}
