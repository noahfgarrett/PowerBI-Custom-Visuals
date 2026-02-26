/**
 * Box Plot — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard } from '../../core/src';
// -- Box Settings ----------------------------------------------------------

class BoxSettingsCard extends formattingSettings.SimpleCard {
  boxWidth = new formattingSettings.NumUpDown({
    name: 'boxWidth',
    displayName: 'Box Width',
    value: 40,
  });

  showOutliers = new formattingSettings.ToggleSwitch({
    name: 'showOutliers',
    displayName: 'Show Outliers',
    value: true,
  });

  showMedianLine = new formattingSettings.ToggleSwitch({
    name: 'showMedianLine',
    displayName: 'Show Median Line',
    value: true,
  });

  medianColor = new formattingSettings.ColorPicker({
    name: 'medianColor',
    displayName: 'Median Color',
    value: { value: '#F28C38' },
  });


  boxStrokeColor = new formattingSettings.ColorPicker({

    name: 'boxStrokeColor',

    displayName: 'Box Stroke Color',

    value: { value: '' },

  });

  boxStrokeWidth = new formattingSettings.NumUpDown({

    name: 'boxStrokeWidth',

    displayName: 'Box Stroke Width',

    value: 1,

  });

  whiskerWidth = new formattingSettings.NumUpDown({

    name: 'whiskerWidth',

    displayName: 'Whisker Width',

    value: 1,

  });

  outlierRadius = new formattingSettings.NumUpDown({

    name: 'outlierRadius',

    displayName: 'Outlier Radius',

    value: 3,

  });


  name = 'boxSettings';
  displayName = 'Box Settings';
  slices = [this.boxWidth, this.showOutliers, this.showMedianLine, this.medianColor, this.boxStrokeColor, this.boxStrokeWidth, this.whiskerWidth, this.outlierRadius];
}

// -- Color Settings --------------------------------------------------------

class ColorSettingsCard extends formattingSettings.SimpleCard {
  boxColor = new formattingSettings.ColorPicker({
    name: 'boxColor',
    displayName: 'Box Color',
    value: { value: '#3B82F6' },
  });

  whiskerColor = new formattingSettings.ColorPicker({
    name: 'whiskerColor',
    displayName: 'Whisker Color',
    value: { value: '#64748B' },
  });

  name = 'colorSettings';
  displayName = 'Colors';
  slices = [this.boxColor, this.whiskerColor];
}

// -- Axis Settings ---------------------------------------------------------

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

// -- Card Style ------------------------------------------------------------

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

// -- Animation Settings ----------------------------------------------------

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

// -- Root Model ------------------------------------------------------------

export class BoxPlotSettings extends formattingSettings.Model {
  boxSettings = new BoxSettingsCard();
  colorSettings = new ColorSettingsCard();
  axisSettings = new AxisSettingsCard();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettingsCard();

  axisFormattingCard = new AxisFormattingCard();

  legendFormattingCard = new LegendFormattingCard();

  dataLabelFormattingCard = new DataLabelFormattingCard();

  titleFormattingCard = new TitleFormattingCard();


  cards = [
    this.boxSettings,
    this.colorSettings,
    this.axisSettings,
    this.cardSettings,
    this.animationSettings,
    this.axisFormattingCard,
    this.legendFormattingCard,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,

  ];
}
