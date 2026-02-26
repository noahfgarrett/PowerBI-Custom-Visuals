/**
 * Animated Waterfall Chart — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, DataLabelFormattingCard, TitleFormattingCard } from '../../core/src';
// -- Waterfall Settings -------------------------------------------------------

class WaterfallSettingsCard extends formattingSettings.SimpleCard {
  showConnectors = new formattingSettings.ToggleSwitch({
    name: 'showConnectors',
    displayName: 'Show Connectors',
    value: true,
  });

  showTotal = new formattingSettings.ToggleSwitch({
    name: 'showTotal',
    displayName: 'Show Total',
    value: true,
  });

  barWidth = new formattingSettings.NumUpDown({
    name: 'barWidth',
    displayName: 'Bar Width',
    value: 60,
  });


  barCornerRadius = new formattingSettings.NumUpDown({

    name: 'barCornerRadius',

    displayName: 'Bar Corner Radius',

    value: 3,

  });

  barBorderColor = new formattingSettings.ColorPicker({

    name: 'barBorderColor',

    displayName: 'Bar Border Color',

    value: { value: '' },

  });

  barBorderWidth = new formattingSettings.NumUpDown({

    name: 'barBorderWidth',

    displayName: 'Bar Border Width',

    value: 0,

  });


  name = 'waterfallSettings';
  displayName = 'Waterfall Settings';
  slices = [this.showConnectors, this.showTotal, this.barWidth, this.barCornerRadius, this.barBorderColor, this.barBorderWidth];
}

// -- Color Settings -----------------------------------------------------------

class ColorSettingsCard extends formattingSettings.SimpleCard {
  positiveColor = new formattingSettings.ColorPicker({
    name: 'positiveColor',
    displayName: 'Positive Color',
    value: { value: '#34D399' },
  });

  negativeColor = new formattingSettings.ColorPicker({
    name: 'negativeColor',
    displayName: 'Negative Color',
    value: { value: '#F87171' },
  });

  totalColor = new formattingSettings.ColorPicker({
    name: 'totalColor',
    displayName: 'Total Color',
    value: { value: '#3B82F6' },
  });

  name = 'colorSettings';
  displayName = 'Colors';
  slices = [this.positiveColor, this.negativeColor, this.totalColor];
}

// -- Value Labels -------------------------------------------------------------

class ValueSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Values',
    value: true,
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size',
    value: 11,
  });

  name = 'valueSettings';
  displayName = 'Value Labels';
  slices = [this.show, this.fontSize];
}

// -- Axis Settings ------------------------------------------------------------

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

  name = 'axisSettings';
  displayName = 'Axes';
  slices = [this.showXAxis, this.showYAxis];
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
    value: 50,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  slices = [this.enabled, this.duration, this.staggerDelay];
}

// -- Root Model ---------------------------------------------------------------


class ConnectorSettings extends formattingSettings.SimpleCard {
  connectorColor = new formattingSettings.ColorPicker({
    name: 'connectorColor',
    displayName: 'Connector Color',
    value: { value: '' },
  });

  connectorWidth = new formattingSettings.NumUpDown({
    name: 'connectorWidth',
    displayName: 'Connector Width',
    value: 1,
  });

  connectorStyle = new formattingSettings.ItemDropdown({
    name: 'connectorStyle',
    displayName: 'Connector Style',
    items: [{ value: 'solid', displayName: 'Solid' }, { value: 'dashed', displayName: 'Dashed' }],
    value: { value: 'dashed', displayName: 'Dashed' },
  });

  name = 'connectorFormatting';
  displayName = 'Connector';
  slices = [this.connectorColor, this.connectorWidth, this.connectorStyle];
}

export class AnimatedWaterfallSettings extends formattingSettings.Model {
  waterfallSettings = new WaterfallSettingsCard();
  colorSettings = new ColorSettingsCard();
  valueSettings = new ValueSettingsCard();
  axisSettings = new AxisSettingsCard();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettingsCard();

  axisFormattingCard = new AxisFormattingCard();

  dataLabelFormattingCard = new DataLabelFormattingCard();

  titleFormattingCard = new TitleFormattingCard();

  connectorSettings = new ConnectorSettings();


  cards = [
    this.waterfallSettings,
    this.colorSettings,
    this.valueSettings,
    this.axisSettings,
    this.cardSettings,
    this.animationSettings,
    this.axisFormattingCard,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.connectorSettings,

  ];
}
