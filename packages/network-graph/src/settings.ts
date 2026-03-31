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
} from '../../core/src';

// ── Nodes ─────────────────────────────────────────────────────────────────────

class NodeSettings extends formattingSettings.SimpleCard {
  radius = new formattingSettings.NumUpDown({
    name: 'radius',
    displayName: 'Node Radius',
    value: 8,
  });

  showLabels = new formattingSettings.ToggleSwitch({
    name: 'showLabels',
    displayName: 'Show Labels',
    value: true,
  });

  nodeBorderColor = new formattingSettings.ColorPicker({
    name: 'nodeBorderColor',
    displayName: 'Node Border Color',
    value: { value: '' },
  });

  nodeBorderWidth = new formattingSettings.NumUpDown({
    name: 'nodeBorderWidth',
    displayName: 'Node Border Width',
    value: 1.5,
  });

  // Moved from NetworkLayoutSettings
  sizeByDegree = new formattingSettings.ToggleSwitch({
    name: 'sizeByDegree',
    displayName: 'Size by Degree',
    value: false,
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

  name = 'nodeSettings';
  displayName = 'Nodes';
  slices = [this.radius, this.showLabels, this.nodeBorderColor, this.nodeBorderWidth, this.sizeByDegree, this.fontSize, this.fontColor, this.fontFamily, this.fontWeight];
}

// ── Links (merged LinkSettings + NetworkLinkSettings) ─────────────────────────

class LinkSettings extends formattingSettings.SimpleCard {
  linkColor = new formattingSettings.ColorPicker({
    name: 'linkColor',
    displayName: 'Link Color',
    value: { value: '' },
  });

  linkWidth = new formattingSettings.NumUpDown({
    name: 'linkWidth',
    displayName: 'Link Width',
    value: 1,
  });

  opacity = new formattingSettings.NumUpDown({
    name: 'opacity',
    displayName: 'Opacity (%)',
    value: 40,
  });

  showArrows = new formattingSettings.ToggleSwitch({
    name: 'showArrows',
    displayName: 'Show Arrows',
    value: false,
  });

  widthByWeight = new formattingSettings.ToggleSwitch({
    name: 'widthByWeight',
    displayName: 'Width by Weight',
    value: false,
  });

  minWidth = new formattingSettings.NumUpDown({
    name: 'minWidth',
    displayName: 'Min Link Width',
    value: 1,
  });

  maxWidth = new formattingSettings.NumUpDown({
    name: 'maxWidth',
    displayName: 'Max Link Width',
    value: 8,
  });

  name = 'linkSettings';
  displayName = 'Links';
  slices = [this.linkColor, this.linkWidth, this.opacity, this.showArrows, this.widthByWeight, this.minWidth, this.maxWidth];
}

// ── Colors & Theme (merged ColorSettings + ColorThemeFormattingCard) ──────────

class ColorsAndThemeSettings extends formattingSettings.SimpleCard {
  useChartPalette = new formattingSettings.ToggleSwitch({
    name: 'useChartPalette',
    displayName: 'Use Chart Palette',
    value: true,
  });

  // Clustering moved here from NetworkLayoutSettings
  enableClustering = new formattingSettings.ToggleSwitch({
    name: 'enableClustering',
    displayName: 'Cluster Detection & Coloring',
    value: false,
  });

  name = 'colorSettings';
  displayName = 'Colors & Theme';
  slices = [this.useChartPalette, this.enableClustering];
}

// ── Card Style ────────────────────────────────────────────────────────────────

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

// ── Interaction (merged NetworkInteractionSettings + ZoomSettings) ─────────────

class InteractionSettings extends formattingSettings.SimpleCard {
  enableDrag = new formattingSettings.ToggleSwitch({
    name: 'enableDrag',
    displayName: 'Enable Node Drag',
    value: true,
  });

  enableSearch = new formattingSettings.ToggleSwitch({
    name: 'enableSearch',
    displayName: 'Enable Search',
    value: false,
  });

  highlightNeighbors = new formattingSettings.ToggleSwitch({
    name: 'highlightNeighbors',
    displayName: 'Highlight Neighbors on Hover',
    value: true,
  });

  enableZoom = new formattingSettings.ToggleSwitch({
    name: 'enableZoom',
    displayName: 'Enable Zoom & Pan',
    value: true,
  });

  minZoom = new formattingSettings.NumUpDown({
    name: 'minZoom',
    displayName: 'Min Zoom',
    value: 0.3,
  });

  maxZoom = new formattingSettings.NumUpDown({
    name: 'maxZoom',
    displayName: 'Max Zoom',
    value: 5,
  });

  name = 'zoomSettings';
  displayName = 'Interaction';
  slices = [this.enableDrag, this.enableSearch, this.highlightNeighbors, this.enableZoom, this.minZoom, this.maxZoom];
}

// ── Physics & Layout ──────────────────────────────────────────────────────────

class PhysicsAndLayoutSettings extends formattingSettings.SimpleCard {
  strength = new formattingSettings.NumUpDown({
    name: 'strength',
    displayName: 'Link Strength',
    value: 0.5,
  });

  linkDistance = new formattingSettings.NumUpDown({
    name: 'linkDistance',
    displayName: 'Link Distance',
    value: 80,
  });

  chargeStrength = new formattingSettings.NumUpDown({
    name: 'chargeStrength',
    displayName: 'Charge Strength',
    value: -300,
  });

  enableCollision = new formattingSettings.ToggleSwitch({
    name: 'enableCollision',
    displayName: 'Collision Prevention',
    value: true,
  });

  edgeBundling = new formattingSettings.ToggleSwitch({
    name: 'edgeBundling',
    displayName: 'Edge Bundling',
    value: false,
  });

  name = 'forceSettings';
  displayName = 'Physics & Layout';
  slices = [this.strength, this.linkDistance, this.chargeStrength, this.enableCollision, this.edgeBundling];
}

// ── Animation Settings ──────────────────────────────────────────────────────

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

// ── Root Model ──────────────────────────────────────────────────────────────

export class NetworkGraphSettings extends formattingSettings.Model {
  nodeSettings = new NodeSettings();
  linkSettings = new LinkSettings();
  colorsAndThemeSettings = new ColorsAndThemeSettings();
  cardSettings = new CardStyleSettings();
  interactionSettings = new InteractionSettings();
  physicsAndLayoutSettings = new PhysicsAndLayoutSettings();
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
    this.animationSettings,
    this.conditionalFormattingCard,
    this.accessibilityFormattingCard,
    this.colorThemeFormattingCard,
    this.legendFormattingCard,
    this.dateFilterFormattingCard,
  ];
}
