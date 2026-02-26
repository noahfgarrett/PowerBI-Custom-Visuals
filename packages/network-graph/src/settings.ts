/**
 * Network Graph — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { DataLabelFormattingCard, TitleFormattingCard } from '../../core/src';
class ForceSettings extends formattingSettings.SimpleCard {
  strength = new formattingSettings.NumUpDown({
    name: 'strength',
    displayName: 'Link Strength',
    value: -300,
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


  nodeRadius = new formattingSettings.NumUpDown({

    name: 'nodeRadius',

    displayName: 'Node Radius',

    value: 8,

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
  slices = [this.radius, this.showLabels, this.nodeRadius, this.nodeBorderColor, this.nodeBorderWidth];
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
  slices = [this.backgroundOpacity, this.borderRadius];
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

export class NetworkGraphSettings extends formattingSettings.Model {
  forceSettings = new ForceSettings();
  nodeSettings = new NodeSettings();
  linkSettings = new LinkSettings();
  colorSettings = new ColorSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();
  zoomSettings = new ZoomSettings();

  dataLabelFormattingCard = new DataLabelFormattingCard();

  titleFormattingCard = new TitleFormattingCard();


  cards = [
    this.forceSettings,
    this.nodeSettings,
    this.linkSettings,
    this.colorSettings,
    this.cardSettings,
    this.animationSettings,
    this.zoomSettings,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,

  ];
}
