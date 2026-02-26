/**
 * Health Bar — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, DataLabelFormattingCard, TitleFormattingCard } from '../../core/src';

// -- Health Bar Settings ------------------------------------------------------

class HealthBarSettingsCard extends formattingSettings.SimpleCard {
  barWidth = new formattingSettings.NumUpDown({
    name: 'barWidth',
    displayName: 'Bar Width',
    value: 40,
  });

  barCornerRadius = new formattingSettings.NumUpDown({
    name: 'barCornerRadius',
    displayName: 'Bar Corner Radius',
    value: 6,
  });

  showValue = new formattingSettings.ToggleSwitch({
    name: 'showValue',
    displayName: 'Show Value',
    value: true,
  });

  showPercent = new formattingSettings.ToggleSwitch({
    name: 'showPercent',
    displayName: 'Show % Symbol',
    value: true,
  });

  gap = new formattingSettings.NumUpDown({
    name: 'gap',
    displayName: 'Gap Between Bars',
    value: 16,
  });

  maxValue = new formattingSettings.NumUpDown({
    name: 'maxValue',
    displayName: 'Max Value',
    value: 100,
  });

  fillMode = new formattingSettings.ItemDropdown({
    name: 'fillMode',
    displayName: 'Fill Mode',
    items: [
      { value: 'gradient', displayName: 'Gradient' },
      { value: 'solid', displayName: 'Solid' },
    ],
    value: { value: 'gradient', displayName: 'Gradient' },
  });

  showYAxis = new formattingSettings.ToggleSwitch({
    name: 'showYAxis',
    displayName: 'Show Y-Axis Ticks',
    value: true,
  });

  name = 'healthBarSettings';
  displayName = 'Health Bar Settings';
  slices = [
    this.barWidth,
    this.barCornerRadius,
    this.showValue,
    this.showPercent,
    this.gap,
    this.maxValue,
    this.fillMode,
    this.showYAxis,
  ];
}

// -- Color Settings -----------------------------------------------------------

class ColorSettingsCard extends formattingSettings.SimpleCard {
  lowColor = new formattingSettings.ColorPicker({
    name: 'lowColor',
    displayName: 'Low Color (0%)',
    value: { value: '#EF4444' },
  });

  midColor = new formattingSettings.ColorPicker({
    name: 'midColor',
    displayName: 'Mid Color (50%)',
    value: { value: '#F59E0B' },
  });

  highColor = new formattingSettings.ColorPicker({
    name: 'highColor',
    displayName: 'High Color (100%)',
    value: { value: '#22C55E' },
  });

  trackColor = new formattingSettings.ColorPicker({
    name: 'trackColor',
    displayName: 'Track Color',
    value: { value: '#E2E8F0' },
  });

  trackOpacity = new formattingSettings.NumUpDown({
    name: 'trackOpacity',
    displayName: 'Track Opacity (%)',
    value: 15,
  });

  name = 'colorSettings';
  displayName = 'Colors';
  slices = [this.lowColor, this.midColor, this.highColor, this.trackColor, this.trackOpacity];
}

// -- Card Style ---------------------------------------------------------------

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

// -- Animation Settings -------------------------------------------------------

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

  staggerDelay = new formattingSettings.NumUpDown({
    name: 'staggerDelay',
    displayName: 'Stagger Delay (ms)',
    value: 80,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  slices = [this.enabled, this.duration, this.staggerDelay];
}

// -- Category Label Settings --------------------------------------------------

class CategoryLabelSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Category Labels',
    value: true,
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size',
    value: 11,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color',
    value: { value: '' },
  });

  name = 'categoryLabelSettings';
  displayName = 'Category Labels';
  slices = [this.show, this.fontSize, this.fontColor];
}

// -- Root Model ---------------------------------------------------------------

export class HealthBarSettings extends formattingSettings.Model {
  healthBarSettings = new HealthBarSettingsCard();
  colorSettings = new ColorSettingsCard();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettingsCard();

  categoryLabelSettings = new CategoryLabelSettingsCard();
  axisFormattingCard = new AxisFormattingCard();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();

  cards = [
    this.healthBarSettings,
    this.colorSettings,
    this.cardSettings,
    this.animationSettings,
    this.categoryLabelSettings,
    this.axisFormattingCard,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
  ];
}
