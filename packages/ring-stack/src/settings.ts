/**
 * Ring Stack -- Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard } from '../../core/src';
class RingSettings extends formattingSettings.SimpleCard {
  thickness = new formattingSettings.NumUpDown({
    name: 'thickness',
    displayName: 'Thickness (px)',
    value: 16,
  });

  gap = new formattingSettings.NumUpDown({
    name: 'gap',
    displayName: 'Gap (px)',
    value: 8,
  });

  maxValue = new formattingSettings.NumUpDown({
    name: 'maxValue',
    displayName: 'Max Value',
    value: 100,
  });

  showLabels = new formattingSettings.ToggleSwitch({
    name: 'showLabels',
    displayName: 'Show Labels',
    value: true,
  });


  trackColor = new formattingSettings.ColorPicker({

    name: 'trackColor',

    displayName: 'Track Color',

    value: { value: '' },

  });

  trackOpacity = new formattingSettings.NumUpDown({

    name: 'trackOpacity',

    displayName: 'Track Opacity (%)',

    value: 15,

  });

  ringStrokeColor = new formattingSettings.ColorPicker({

    name: 'ringStrokeColor',

    displayName: 'Ring Stroke Color',

    value: { value: '' },

  });


  name = 'ringSettings';
  displayName = 'Ring';
  slices = [this.thickness, this.gap, this.maxValue, this.showLabels, this.trackColor, this.trackOpacity, this.ringStrokeColor];
}

class ColorSettings extends formattingSettings.SimpleCard {
  ring1Color = new formattingSettings.ColorPicker({
    name: 'ring1Color',
    displayName: 'Ring 1 Color',
    value: { value: '#F28C38' },
  });

  ring2Color = new formattingSettings.ColorPicker({
    name: 'ring2Color',
    displayName: 'Ring 2 Color',
    value: { value: '#3B82F6' },
  });

  ring3Color = new formattingSettings.ColorPicker({
    name: 'ring3Color',
    displayName: 'Ring 3 Color',
    value: { value: '#34D399' },
  });

  ring4Color = new formattingSettings.ColorPicker({
    name: 'ring4Color',
    displayName: 'Ring 4 Color',
    value: { value: '#F87171' },
  });

  ring5Color = new formattingSettings.ColorPicker({
    name: 'ring5Color',
    displayName: 'Ring 5 Color',
    value: { value: '#A78BFA' },
  });

  ring6Color = new formattingSettings.ColorPicker({
    name: 'ring6Color',
    displayName: 'Ring 6 Color',
    value: { value: '#FBBF24' },
  });

  name = 'colorSettings';
  displayName = 'Ring Colors';
  slices = [
    this.ring1Color,
    this.ring2Color,
    this.ring3Color,
    this.ring4Color,
    this.ring5Color,
    this.ring6Color,
  ];
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
  slices = [this.backgroundColor, this.backgroundOpacity, this.borderRadius];
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

export class RingStackSettings extends formattingSettings.Model {
  ringSettings = new RingSettings();
  colorSettings = new ColorSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();

  legendFormattingCard = new LegendFormattingCard();

  dataLabelFormattingCard = new DataLabelFormattingCard();

  titleFormattingCard = new TitleFormattingCard();


  cards = [
    this.ringSettings,
    this.colorSettings,
    this.cardSettings,
    this.animationSettings,
    this.legendFormattingCard,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,

  ];
}
