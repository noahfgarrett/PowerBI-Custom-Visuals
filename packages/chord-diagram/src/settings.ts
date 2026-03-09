/**
 * Chord Diagram — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import {
  DataLabelFormattingCard,
  LegendFormattingCard,
  TitleFormattingCard,
  SortFormattingCard,
  ConditionalFormattingCard,
  AccessibilityFormattingCard,
  ColorThemeFormattingCard,
} from '../../core/src';
class ChordSettings extends formattingSettings.SimpleCard {
  padding = new formattingSettings.NumUpDown({
    name: 'padding',
    displayName: 'Padding',
    value: 10,
  });

  ribbonOpacity = new formattingSettings.NumUpDown({
    name: 'ribbonOpacity',
    displayName: 'Ribbon Opacity (%)',
    value: 65,
  });

  hoverOpacity = new formattingSettings.NumUpDown({
    name: 'hoverOpacity',
    displayName: 'Hover Opacity (%)',
    value: 90,
  });


  arcStrokeColor = new formattingSettings.ColorPicker({

    name: 'arcStrokeColor',

    displayName: 'Arc Stroke Color',

    value: { value: '' },

  });

  dimOpacity = new formattingSettings.NumUpDown({

    name: 'dimOpacity',

    displayName: 'Dim Opacity (%)',

    value: 8,

  });


  name = 'chordSettings';
  displayName = 'Chord';
  slices = [this.padding, this.ribbonOpacity, this.hoverOpacity, this.arcStrokeColor, this.dimOpacity];
}

class ColorSettings extends formattingSettings.SimpleCard {
  useChartPalette = new formattingSettings.ToggleSwitch({
    name: 'useChartPalette',
    displayName: 'Use Chart Palette',
    value: true,
  });

  name = 'colorSettings';
  displayName = 'Color';
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

class ChordInteractionSettings extends formattingSettings.SimpleCard {
  enableFiltering = new formattingSettings.ToggleSwitch({
    name: 'enableFiltering',
    displayName: 'Enable Chord Filtering',
    value: false,
  });

  showFlowLabels = new formattingSettings.ToggleSwitch({
    name: 'showFlowLabels',
    displayName: 'Show Flow Labels on Hover',
    value: false,
  });

  name = 'chordInteractionSettings';
  displayName = 'Interaction Features';
  slices = [this.enableFiltering, this.showFlowLabels];
}

class ChordRibbonSettings extends formattingSettings.SimpleCard {
  gradientRibbons = new formattingSettings.ToggleSwitch({
    name: 'gradientRibbons',
    displayName: 'Gradient Ribbons',
    value: false,
  });

  directional = new formattingSettings.ToggleSwitch({
    name: 'directional',
    displayName: 'Directional Ribbons',
    value: false,
  });

  minArcAngle = new formattingSettings.NumUpDown({
    name: 'minArcAngle',
    displayName: 'Min Arc Angle (degrees)',
    value: 0,
  });

  name = 'chordRibbonSettings';
  displayName = 'Ribbon Features';
  slices = [this.gradientRibbons, this.directional, this.minArcAngle];
}

class ChordLabelSettings extends formattingSettings.SimpleCard {
  showEntityValues = new formattingSettings.ToggleSwitch({
    name: 'showEntityValues',
    displayName: 'Show Entity Values',
    value: false,
  });

  name = 'chordLabelSettings';
  displayName = 'Label Features';
  slices = [this.showEntityValues];
}

export class ChordDiagramSettings extends formattingSettings.Model {
  chordSettings = new ChordSettings();
  colorSettings = new ColorSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();

  chordInteractionSettings = new ChordInteractionSettings();
  chordRibbonSettings = new ChordRibbonSettings();
  chordLabelSettings = new ChordLabelSettings();

  dataLabelFormattingCard = new DataLabelFormattingCard();

  titleFormattingCard = new TitleFormattingCard();

  legendFormattingCard = new LegendFormattingCard();

  sortFormattingCard = new SortFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  cards = [
    this.chordSettings,
    this.colorSettings,
    this.cardSettings,
    this.animationSettings,
    this.chordInteractionSettings,
    this.chordRibbonSettings,
    this.chordLabelSettings,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.legendFormattingCard,
    this.sortFormattingCard,
    this.conditionalFormattingCard,
    this.accessibilityFormattingCard,
    this.colorThemeFormattingCard,
  ];
}
