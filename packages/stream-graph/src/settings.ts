/**
 * Stream Graph — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, LineStrokeFormattingCard, SortFormattingCard} from '../../core/src';
class StreamSettings extends formattingSettings.SimpleCard {
  offset = new formattingSettings.ItemDropdown({
    name: 'offset',
    displayName: 'Stack Offset',
    items: [
      { value: 'wiggle', displayName: 'Wiggle' },
      { value: 'silhouette', displayName: 'Silhouette' },
      { value: 'expand', displayName: 'Expand' },
      { value: 'none', displayName: 'None' },
    ],
    value: { value: 'wiggle', displayName: 'Wiggle' },
  });

  curve = new formattingSettings.ItemDropdown({
    name: 'curve',
    displayName: 'Curve Type',
    items: [
      { value: 'basis', displayName: 'Basis' },
      { value: 'monotoneX', displayName: 'Monotone X' },
      { value: 'cardinal', displayName: 'Cardinal' },
    ],
    value: { value: 'basis', displayName: 'Basis' },
  });


  streamOpacity = new formattingSettings.NumUpDown({

    name: 'streamOpacity',

    displayName: 'Stream Opacity (%)',

    value: 80,

  });

  streamStrokeColor = new formattingSettings.ColorPicker({

    name: 'streamStrokeColor',

    displayName: 'Stream Stroke Color',

    value: { value: '' },

  });

  streamStrokeWidth = new formattingSettings.NumUpDown({

    name: 'streamStrokeWidth',

    displayName: 'Stream Stroke Width',

    value: 0.5,

  });


  name = 'streamSettings';
  displayName = 'Stream';
  slices = [this.offset, this.curve, this.streamOpacity, this.streamStrokeColor, this.streamStrokeWidth];
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

class AxisSettings extends formattingSettings.SimpleCard {
  showXAxis = new formattingSettings.ToggleSwitch({
    name: 'showXAxis',
    displayName: 'Show X Axis',
    value: true,
  });

  name = 'axisSettings';
  displayName = 'Axis';
  slices = [this.showXAxis];
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

// ── Crosshair Settings ──────────────────────────────────────────────

class CrosshairSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Crosshair',
    value: true,
  });

  lineColor = new formattingSettings.ColorPicker({
    name: 'lineColor',
    displayName: 'Line Color',
    value: { value: '#94A3B8' },
  });

  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width',
    value: 1,
  });

  lineStyle = new formattingSettings.ItemDropdown({
    name: 'lineStyle',
    displayName: 'Line Style',
    items: [
      { value: 'solid', displayName: 'Solid' },
      { value: 'dashed', displayName: 'Dashed' },
    ],
    value: { value: 'dashed', displayName: 'Dashed' },
  });

  showValues = new formattingSettings.ToggleSwitch({
    name: 'showValues',
    displayName: 'Show Values',
    value: true,
  });

  name = 'crosshairSettings';
  displayName = 'Crosshair';
  slices = [this.show, this.lineColor, this.lineWidth, this.lineStyle, this.showValues];
}

export class StreamGraphSettings extends formattingSettings.Model {
  streamSettings = new StreamSettings();
  colorSettings = new ColorSettings();
  axisSettings = new AxisSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();

  axisFormattingCard = new AxisFormattingCard();

  legendFormattingCard = new LegendFormattingCard();

  dataLabelFormattingCard = new DataLabelFormattingCard();

  titleFormattingCard = new TitleFormattingCard();

  lineStrokeFormattingCard = new LineStrokeFormattingCard();


  sortFormattingCard = new SortFormattingCard();

  crosshairSettings = new CrosshairSettingsCard();

  cards = [
    this.streamSettings,
    this.colorSettings,
    this.axisSettings,
    this.cardSettings,
    this.animationSettings,
    this.axisFormattingCard,
    this.legendFormattingCard,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.lineStrokeFormattingCard,
    this.sortFormattingCard,
    this.crosshairSettings,
  ];
}
