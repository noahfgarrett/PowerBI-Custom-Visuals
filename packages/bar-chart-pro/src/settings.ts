/**
 * Bar Chart Pro — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard } from '../../core/src';
// ── Chart Mode ──────────────────────────────────────────────────────

class ChartModeSettings extends formattingSettings.SimpleCard {
  mode = new formattingSettings.ItemDropdown({
    name: 'mode',
    displayName: 'Mode',
    items: [
      { value: 'grouped', displayName: 'Grouped' },
      { value: 'stacked', displayName: 'Stacked' },
      { value: 'combo', displayName: 'Combo (Bar + Line)' },
      { value: 'horizontal', displayName: 'Horizontal' },
      { value: 'diverging', displayName: 'Diverging' },
    ],
    value: { value: 'grouped', displayName: 'Grouped' },
  });

  name = 'chartMode';
  displayName = 'Chart Mode';
  slices = [this.mode];
}

// ── Bar Settings ────────────────────────────────────────────────────

class BarSettings extends formattingSettings.SimpleCard {
  cornerRadius = new formattingSettings.NumUpDown({
    name: 'cornerRadius',
    displayName: 'Corner Radius',
    value: 4,
  });

  barSpacing = new formattingSettings.NumUpDown({
    name: 'barSpacing',
    displayName: 'Bar Spacing',
    value: 2,
  });

  showDataLabels = new formattingSettings.ItemDropdown({
    name: 'showDataLabels',
    displayName: 'Data Labels',
    items: [
      { value: 'none', displayName: 'None' },
      { value: 'above', displayName: 'Above' },
      { value: 'inside', displayName: 'Inside' },
    ],
    value: { value: 'none', displayName: 'None' },
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

  barOpacity = new formattingSettings.NumUpDown({

    name: 'barOpacity',

    displayName: 'Bar Opacity (%)',

    value: 100,

  });

  useGradient = new formattingSettings.ToggleSwitch({
    name: 'useGradient',
    displayName: 'Gradient Fill',
    value: false,
  });

  name = 'barSettings';
  displayName = 'Bar Settings';
  slices = [this.cornerRadius, this.barSpacing, this.showDataLabels, this.barBorderColor, this.barBorderWidth, this.barOpacity, this.useGradient];
}

// ── Line Settings (combo mode) ──────────────────────────────────────

class LineSettings extends formattingSettings.SimpleCard {
  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width',
    value: 2,
  });

  showDots = new formattingSettings.ToggleSwitch({
    name: 'showDots',
    displayName: 'Show Dots',
    value: true,
  });

  lineStyle = new formattingSettings.ItemDropdown({
    name: 'lineStyle',
    displayName: 'Line Style',
    items: [
      { value: 'solid', displayName: 'Solid' },
      { value: 'dashed', displayName: 'Dashed' },
    ],
    value: { value: 'solid', displayName: 'Solid' },
  });

  name = 'lineSettings';
  displayName = 'Line Settings';
  slices = [this.lineWidth, this.showDots, this.lineStyle];
}

// ── Axis Settings ───────────────────────────────────────────────────

class AxisSettings extends formattingSettings.SimpleCard {
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

  showSecondaryYAxis = new formattingSettings.ToggleSwitch({
    name: 'showSecondaryYAxis',
    displayName: 'Show Secondary Y-Axis',
    value: false,
  });

  xLabelRotation = new formattingSettings.NumUpDown({
    name: 'xLabelRotation',
    displayName: 'X Label Rotation',
    value: 0,
  });

  name = 'axisSettings';
  displayName = 'Axes';
  slices = [this.showXAxis, this.showYAxis, this.showSecondaryYAxis, this.xLabelRotation];
}

// ── Target Line ─────────────────────────────────────────────────────

class TargetLineSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Target Line',
    value: true,
  });

  label = new formattingSettings.TextInput({
    name: 'label',
    displayName: 'Label',
    value: '',
    placeholder: 'e.g. Target',
  });

  style = new formattingSettings.ItemDropdown({
    name: 'style',
    displayName: 'Line Style',
    items: [
      { value: 'solid', displayName: 'Solid' },
      { value: 'dashed', displayName: 'Dashed' },
    ],
    value: { value: 'dashed', displayName: 'Dashed' },
  });

  color = new formattingSettings.ColorPicker({
    name: 'color',
    displayName: 'Color',
    value: { value: '#F87171' },
  });

  name = 'targetLine';
  displayName = 'Target Line';
  slices = [this.show, this.label, this.style, this.color];
}

// ── Legend Settings ──────────────────────────────────────────────────

class LegendSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Legend',
    value: true,
  });

  position = new formattingSettings.ItemDropdown({
    name: 'position',
    displayName: 'Position',
    items: [
      { value: 'bottom', displayName: 'Bottom' },
      { value: 'top', displayName: 'Top' },
      { value: 'right', displayName: 'Right' },
    ],
    value: { value: 'bottom', displayName: 'Bottom' },
  });

  name = 'legendSettings';
  displayName = 'Legend';
  slices = [this.show, this.position];
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

  staggerDelay = new formattingSettings.NumUpDown({
    name: 'staggerDelay',
    displayName: 'Stagger Delay (ms)',
    value: 50,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  slices = [this.enabled, this.duration, this.staggerDelay];
}

// ── Root Model ──────────────────────────────────────────────────────

export class BarChartProSettings extends formattingSettings.Model {
  chartMode = new ChartModeSettings();
  barSettings = new BarSettings();
  lineSettings = new LineSettings();
  axisSettings = new AxisSettings();
  targetLine = new TargetLineSettings();
  legendSettings = new LegendSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettingsCard();

  axisFormattingCard = new AxisFormattingCard();

  legendFormattingCard = new LegendFormattingCard();

  dataLabelFormattingCard = new DataLabelFormattingCard();

  titleFormattingCard = new TitleFormattingCard();


  cards = [
    this.chartMode,
    this.barSettings,
    this.lineSettings,
    this.axisSettings,
    this.targetLine,
    this.legendSettings,
    this.cardSettings,
    this.animationSettings,
    this.axisFormattingCard,
    this.legendFormattingCard,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,

  ];
}
