/**
 * Bullet Chart Pro — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, DataLabelFormattingCard, TitleFormattingCard } from '../../core/src';
// ── Bullet Settings ─────────────────────────────────────────────────

class BulletSettings extends formattingSettings.SimpleCard {
  barHeight = new formattingSettings.NumUpDown({
    name: 'barHeight',
    displayName: 'Bar Height',
    value: 20,
  });

  showTarget = new formattingSettings.ToggleSwitch({
    name: 'showTarget',
    displayName: 'Show Target',
    value: true,
  });

  showLabels = new formattingSettings.ToggleSwitch({
    name: 'showLabels',
    displayName: 'Show Labels',
    value: true,
  });


  barCornerRadius = new formattingSettings.NumUpDown({

    name: 'barCornerRadius',

    displayName: 'Bar Corner Radius',

    value: 2,

  });

  rangeOpacity = new formattingSettings.NumUpDown({

    name: 'rangeOpacity',

    displayName: 'Range Opacity (%)',

    value: 15,

  });


  name = 'bulletSettings';
  displayName = 'Bullet Settings';
  slices = [this.barHeight, this.showTarget, this.showLabels, this.barCornerRadius, this.rangeOpacity];
}

// ── Range Colors ────────────────────────────────────────────────────

class RangeSettings extends formattingSettings.SimpleCard {
  poorColor = new formattingSettings.ColorPicker({
    name: 'poorColor',
    displayName: 'Poor Color',
    value: { value: '#FCA5A5' },
  });

  satisfactoryColor = new formattingSettings.ColorPicker({
    name: 'satisfactoryColor',
    displayName: 'Satisfactory Color',
    value: { value: '#FDE68A' },
  });

  goodColor = new formattingSettings.ColorPicker({
    name: 'goodColor',
    displayName: 'Good Color',
    value: { value: '#BBF7D0' },
  });

  barColor = new formattingSettings.ColorPicker({
    name: 'barColor',
    displayName: 'Bar Color',
    value: { value: '#1E293B' },
  });

  name = 'rangeSettings';
  displayName = 'Range Colors';
  slices = [this.poorColor, this.satisfactoryColor, this.goodColor, this.barColor];
}

// ── Card Style ──────────────────────────────────────────────────────

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

// ── Animation Settings ──────────────────────────────────────────────

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

// ── Root Model ──────────────────────────────────────────────────────

export class BulletChartProSettings extends formattingSettings.Model {
  bulletSettings = new BulletSettings();
  rangeSettings = new RangeSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettingsCard();

  axisFormattingCard = new AxisFormattingCard();

  dataLabelFormattingCard = new DataLabelFormattingCard();

  titleFormattingCard = new TitleFormattingCard();


  cards = [
    this.bulletSettings,
    this.rangeSettings,
    this.cardSettings,
    this.animationSettings,
    this.axisFormattingCard,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,

  ];
}
