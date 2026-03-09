/**
 * Network Graph — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import {
  DataLabelFormattingCard,
  TitleFormattingCard,
  ConditionalFormattingCard,
  AccessibilityFormattingCard,
  ColorThemeFormattingCard,
} from '../../core/src';
class ForceSettings extends formattingSettings.SimpleCard {
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

  name = 'forceSettings';
  displayName = 'Force Physics';
  slices = [this.strength, this.linkDistance, this.chargeStrength];
}

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


  name = 'nodeSettings';
  displayName = 'Nodes';
  slices = [this.radius, this.showLabels, this.nodeBorderColor, this.nodeBorderWidth];
}

class LinkSettings extends formattingSettings.SimpleCard {
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

  name = 'linkSettings';
  displayName = 'Links';
  slices = [this.opacity, this.showArrows, this.linkColor, this.linkWidth];
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

class ZoomSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
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
  displayName = 'Zoom & Pan';
  slices = [this.enabled, this.minZoom, this.maxZoom];
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

class NetworkLayoutSettings extends formattingSettings.SimpleCard {
  enableClustering = new formattingSettings.ToggleSwitch({
    name: 'enableClustering',
    displayName: 'Cluster Detection & Coloring',
    value: false,
  });

  sizeByDegree = new formattingSettings.ToggleSwitch({
    name: 'sizeByDegree',
    displayName: 'Size by Degree',
    value: false,
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

  name = 'networkLayoutSettings';
  displayName = 'Layout Features';
  slices = [this.enableClustering, this.sizeByDegree, this.enableCollision, this.edgeBundling];
}

class NetworkInteractionSettings extends formattingSettings.SimpleCard {
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

  name = 'networkInteractionSettings';
  displayName = 'Interaction Features';
  slices = [this.enableDrag, this.enableSearch, this.highlightNeighbors];
}

class NetworkLinkSettings extends formattingSettings.SimpleCard {
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

  name = 'networkLinkSettings';
  displayName = 'Link Features';
  slices = [this.widthByWeight, this.minWidth, this.maxWidth];
}

export class NetworkGraphSettings extends formattingSettings.Model {
  forceSettings = new ForceSettings();
  nodeSettings = new NodeSettings();
  linkSettings = new LinkSettings();
  colorSettings = new ColorSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();
  zoomSettings = new ZoomSettings();

  networkLayoutSettings = new NetworkLayoutSettings();
  networkInteractionSettings = new NetworkInteractionSettings();
  networkLinkSettings = new NetworkLinkSettings();

  dataLabelFormattingCard = new DataLabelFormattingCard();

  titleFormattingCard = new TitleFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  cards = [
    this.forceSettings,
    this.nodeSettings,
    this.linkSettings,
    this.colorSettings,
    this.cardSettings,
    this.animationSettings,
    this.zoomSettings,
    this.networkLayoutSettings,
    this.networkInteractionSettings,
    this.networkLinkSettings,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.conditionalFormattingCard,
    this.accessibilityFormattingCard,
    this.colorThemeFormattingCard,
  ];
}
