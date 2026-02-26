/**
 * Morphing Area Chart — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, LineStrokeFormattingCard, ScrollFormattingCard, NumberFormattingCard} from '../../core/src';

// ── Reference Line Settings ─────────────────────────────────────────

class ReferenceLineSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Reference Line',
    value: false,
  });

  value = new formattingSettings.NumUpDown({
    name: 'value',
    displayName: 'Value',
    value: 0,
  });

  lineColor = new formattingSettings.ColorPicker({
    name: 'lineColor',
    displayName: 'Line Color',
    value: { value: '#EF4444' },
  });

  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width',
    value: 2,
  });

  lineStyle = new formattingSettings.ItemDropdown({
    name: 'lineStyle',
    displayName: 'Line Style',
    items: [
      { value: 'solid', displayName: 'Solid' },
      { value: 'dashed', displayName: 'Dashed' },
      { value: 'dotted', displayName: 'Dotted' },
    ],
    value: { value: 'dashed', displayName: 'Dashed' },
  });

  showLabel = new formattingSettings.ToggleSwitch({
    name: 'showLabel',
    displayName: 'Show Label',
    value: true,
  });

  labelText = new formattingSettings.TextInput({
    name: 'labelText',
    displayName: 'Label Text',
    value: '',
    placeholder: 'Custom label (blank = value)',
  });

  showBand = new formattingSettings.ToggleSwitch({
    name: 'showBand',
    displayName: 'Show Band',
    value: false,
  });

  bandUpperValue = new formattingSettings.NumUpDown({
    name: 'bandUpperValue',
    displayName: 'Band Upper Value',
    value: 0,
  });

  bandOpacity = new formattingSettings.NumUpDown({
    name: 'bandOpacity',
    displayName: 'Band Opacity (%)',
    value: 15,
  });

  name = 'referenceLineSettings';
  displayName = 'Reference Line';
  slices = [
    this.show,
    this.value,
    this.lineColor,
    this.lineWidth,
    this.lineStyle,
    this.showLabel,
    this.labelText,
    this.showBand,
    this.bandUpperValue,
    this.bandOpacity,
  ];
}

// ── Line Settings ────────────────────────────────────────────────────

class LineSettingsCard extends formattingSettings.SimpleCard {
  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width',
    value: 2,
  });

  curve = new formattingSettings.ItemDropdown({
    name: 'curve',
    displayName: 'Curve Type',
    items: [
      { value: 'monotoneX', displayName: 'Smooth (Monotone)' },
      { value: 'linear', displayName: 'Linear' },
      { value: 'step', displayName: 'Step' },
    ],
    value: { value: 'monotoneX', displayName: 'Smooth (Monotone)' },
  });

  showDots = new formattingSettings.ToggleSwitch({
    name: 'showDots',
    displayName: 'Show Dots',
    value: true,
  });

  showArea = new formattingSettings.ToggleSwitch({
    name: 'showArea',
    displayName: 'Show Area Fill',
    value: true,
  });


  dotRadius = new formattingSettings.NumUpDown({

    name: 'dotRadius',

    displayName: 'Dot Radius',

    value: 4,

  });

  dotStrokeColor = new formattingSettings.ColorPicker({

    name: 'dotStrokeColor',

    displayName: 'Dot Stroke Color',

    value: { value: '' },

  });

  dotStrokeWidth = new formattingSettings.NumUpDown({

    name: 'dotStrokeWidth',

    displayName: 'Dot Stroke Width',

    value: 2,

  });


  name = 'lineSettings';
  displayName = 'Line Settings';
  slices = [this.lineWidth, this.curve, this.showDots, this.showArea, this.dotRadius, this.dotStrokeColor, this.dotStrokeWidth];
}

// ── Area Settings ────────────────────────────────────────────────────

class AreaSettingsCard extends formattingSettings.SimpleCard {
  fillOpacity = new formattingSettings.NumUpDown({
    name: 'fillOpacity',
    displayName: 'Fill Opacity (%)',
    value: 30,
  });

  useGradient = new formattingSettings.ToggleSwitch({
    name: 'useGradient',
    displayName: 'Gradient Fill',
    value: true,
  });

  name = 'areaSettings';
  displayName = 'Area Settings';
  slices = [this.fillOpacity, this.useGradient];
}

// ── Axis Settings ────────────────────────────────────────────────────

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

// ── Legend Settings ──────────────────────────────────────────────────

class LegendSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Legend',
    value: true,
  });

  position = new formattingSettings.ItemDropdown({
    name: 'position',
    displayName: 'Position',
    items: [
      { value: 'top', displayName: 'Top' },
      { value: 'bottom', displayName: 'Bottom' },
      { value: 'left', displayName: 'Left' },
      { value: 'right', displayName: 'Right' },
    ],
    value: { value: 'top', displayName: 'Top' },
  });

  name = 'legendSettings';
  displayName = 'Legend';
  slices = [this.show, this.position];
}

// ── Card Style ───────────────────────────────────────────────────────

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

// ── Root Model ───────────────────────────────────────────────────────

export class MorphingAreaChartSettings extends formattingSettings.Model {
  lineSettings = new LineSettingsCard();
  areaSettings = new AreaSettingsCard();
  axisSettings = new AxisSettingsCard();
  legendSettings = new LegendSettingsCard();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettingsCard();

  axisFormattingCard = new AxisFormattingCard();

  legendFormattingCard = new LegendFormattingCard();

  dataLabelFormattingCard = new DataLabelFormattingCard();

  titleFormattingCard = new TitleFormattingCard();

  lineStrokeFormattingCard = new LineStrokeFormattingCard();

  scrollFormattingCard = new ScrollFormattingCard();

  constructor() {
    super();
    this.scrollFormattingCard.minCategoryWidth.value = 20;
  }

  numberFormattingCard = new NumberFormattingCard();

  crosshairSettings = new CrosshairSettingsCard();
  referenceLineSettings = new ReferenceLineSettingsCard();

  cards = [
    this.lineSettings,
    this.areaSettings,
    this.axisSettings,
    this.legendSettings,
    this.cardSettings,
    this.animationSettings,
    this.axisFormattingCard,
    this.legendFormattingCard,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.lineStrokeFormattingCard,
    this.scrollFormattingCard,
    this.numberFormattingCard,
    this.crosshairSettings,
    this.referenceLineSettings,
  ];
}
