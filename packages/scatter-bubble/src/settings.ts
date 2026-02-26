/**
 * Scatter Bubble Plot — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard } from '../../core/src';
// ── Scatter Settings ──────────────────────────────────────────────────

class ScatterSettingsCard extends formattingSettings.SimpleCard {
  minRadius = new formattingSettings.NumUpDown({
    name: 'minRadius',
    displayName: 'Min Radius',
    value: 4,
  });

  maxRadius = new formattingSettings.NumUpDown({
    name: 'maxRadius',
    displayName: 'Max Radius',
    value: 30,
  });

  opacity = new formattingSettings.NumUpDown({
    name: 'opacity',
    displayName: 'Opacity (%)',
    value: 70,
  });


  bubbleStrokeColor = new formattingSettings.ColorPicker({

    name: 'bubbleStrokeColor',

    displayName: 'Bubble Stroke Color',

    value: { value: '' },

  });

  bubbleStrokeWidth = new formattingSettings.NumUpDown({

    name: 'bubbleStrokeWidth',

    displayName: 'Bubble Stroke Width',

    value: 1.5,

  });


  name = 'scatterSettings';
  displayName = 'Scatter Settings';
  slices = [this.minRadius, this.maxRadius, this.opacity, this.bubbleStrokeColor, this.bubbleStrokeWidth];
}

// ── Axis Settings ─────────────────────────────────────────────────────

class AxisSettingsCard extends formattingSettings.SimpleCard {
  showXAxis = new formattingSettings.ToggleSwitch({
    name: 'showXAxis',
    displayName: 'Show X-Axis',
    value: true,
  });

  showYAxis = new formattingSettings.ToggleSwitch({
    name: 'showYAxis',
    displayName: 'Show Y-Axis',
    value: true,
  });

  gridLines = new formattingSettings.ToggleSwitch({
    name: 'gridLines',
    displayName: 'Grid Lines',
    value: true,
  });

  name = 'axisSettings';
  displayName = 'Axes';
  slices = [this.showXAxis, this.showYAxis, this.gridLines];
}

// ── Legend Settings ───────────────────────────────────────────────────

class LegendSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Legend',
    value: true,
  });

  name = 'legendSettings';
  displayName = 'Legend';
  slices = [this.show];
}

// ── Card Style ────────────────────────────────────────────────────────

class CardStyleSettings extends formattingSettings.SimpleCard {
  enableGlass = new formattingSettings.ToggleSwitch({
    name: 'enableGlass',
    displayName: 'Glass Effect',
    value: true,
  });

  bgColor = new formattingSettings.ColorPicker({
    name: 'bgColor',
    displayName: 'Background Color',
    value: { value: '' },
  });

  bgOpacity = new formattingSettings.NumUpDown({
    name: 'bgOpacity',
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
  slices = [this.bgColor, this.bgOpacity, this.borderRadius];
}

// ── Animation Settings ───────────────────────────────────────────────

class AnimationSettingsCard extends formattingSettings.SimpleCard {
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

// ── Root Model ────────────────────────────────────────────────────────

export class ScatterBubbleSettings extends formattingSettings.Model {
  scatterSettings = new ScatterSettingsCard();
  axisSettings = new AxisSettingsCard();
  legendSettings = new LegendSettingsCard();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettingsCard();

  axisFormattingCard = new AxisFormattingCard();

  legendFormattingCard = new LegendFormattingCard();

  dataLabelFormattingCard = new DataLabelFormattingCard();

  titleFormattingCard = new TitleFormattingCard();


  cards = [
    this.scatterSettings,
    this.axisSettings,
    this.legendSettings,
    this.cardSettings,
    this.animationSettings,
    this.axisFormattingCard,
    this.legendFormattingCard,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,

  ];
}
