/**
 * Chord Diagram — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { DataLabelFormattingCard, LegendFormattingCard, TitleFormattingCard, SortFormattingCard} from '../../core/src';
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

export class ChordDiagramSettings extends formattingSettings.Model {
  chordSettings = new ChordSettings();
  colorSettings = new ColorSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();

  dataLabelFormattingCard = new DataLabelFormattingCard();

  titleFormattingCard = new TitleFormattingCard();

  legendFormattingCard = new LegendFormattingCard();

  sortFormattingCard = new SortFormattingCard();

  cards = [
    this.chordSettings,
    this.colorSettings,
    this.cardSettings,
    this.animationSettings,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.legendFormattingCard,
    this.sortFormattingCard,
  ];
}
