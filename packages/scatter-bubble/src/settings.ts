/**
 * Scatter Bubble Plot — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, NumberFormattingCard, ReferenceLineFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard,
  SeriesFormattingCard, } from '../../core/src';
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

// ── Card Style ────────────────────────────────────────────────────────

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
  slices = [this.enableGlass, this.backgroundColor, this.backgroundOpacity, this.borderRadius];
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

// ── Quadrant Settings ────────────────────────────────────────────────

class QuadrantSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Quadrants',
    value: false,
  });

  xValue = new formattingSettings.NumUpDown({
    name: 'xValue',
    displayName: 'X Divider Value',
    value: 50,
  });

  yValue = new formattingSettings.NumUpDown({
    name: 'yValue',
    displayName: 'Y Divider Value',
    value: 50,
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
      { value: 'dotted', displayName: 'Dotted' },
    ],
    value: { value: 'dashed', displayName: 'Dashed' },
  });

  showLabels = new formattingSettings.ToggleSwitch({
    name: 'showLabels',
    displayName: 'Show Labels',
    value: true,
  });

  topRightLabel = new formattingSettings.TextInput({
    name: 'topRightLabel',
    displayName: 'Top-Right Label',
    value: '',
    placeholder: 'e.g. Stars',
  });

  topLeftLabel = new formattingSettings.TextInput({
    name: 'topLeftLabel',
    displayName: 'Top-Left Label',
    value: '',
    placeholder: 'e.g. Question Marks',
  });

  bottomRightLabel = new formattingSettings.TextInput({
    name: 'bottomRightLabel',
    displayName: 'Bottom-Right Label',
    value: '',
    placeholder: 'e.g. Cash Cows',
  });

  bottomLeftLabel = new formattingSettings.TextInput({
    name: 'bottomLeftLabel',
    displayName: 'Bottom-Left Label',
    value: '',
    placeholder: 'e.g. Dogs',
  });

  labelFontSize = new formattingSettings.NumUpDown({
    name: 'labelFontSize',
    displayName: 'Label Font Size',
    value: 11,
  });

  zoneFillOpacity = new formattingSettings.NumUpDown({
    name: 'zoneFillOpacity',
    displayName: 'Zone Fill Opacity',
    value: 0,
  });

  name = 'quadrantSettings';
  displayName = 'Quadrant Lines';
  slices = [
    this.show,
    this.xValue,
    this.yValue,
    this.lineColor,
    this.lineWidth,
    this.lineStyle,
    this.showLabels,
    this.topRightLabel,
    this.topLeftLabel,
    this.bottomRightLabel,
    this.bottomLeftLabel,
    this.labelFontSize,
    this.zoneFillOpacity,
  ];
}

// ── Trendline Settings ──────────────────────────────────────────────

class TrendlineSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Trendline',
    value: false,
  });

  type = new formattingSettings.ItemDropdown({
    name: 'type',
    displayName: 'Regression Type',
    items: [
      { value: 'linear', displayName: 'Linear' },
      { value: 'polynomial', displayName: 'Polynomial' },
      { value: 'exponential', displayName: 'Exponential' },
      { value: 'logarithmic', displayName: 'Logarithmic' },
      { value: 'power', displayName: 'Power' },
    ],
    value: { value: 'linear', displayName: 'Linear' },
  });

  polynomialOrder = new formattingSettings.NumUpDown({
    name: 'polynomialOrder',
    displayName: 'Polynomial Order',
    value: 2,
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
    ],
    value: { value: 'dashed', displayName: 'Dashed' },
  });

  showEquation = new formattingSettings.ToggleSwitch({
    name: 'showEquation',
    displayName: 'Show Equation',
    value: false,
  });

  showR2 = new formattingSettings.ToggleSwitch({
    name: 'showR2',
    displayName: 'Show R²',
    value: true,
  });

  labelFontSize = new formattingSettings.NumUpDown({
    name: 'labelFontSize',
    displayName: 'Label Font Size',
    value: 10,
  });

  name = 'trendlineSettings';
  displayName = 'Trendline';
  slices = [
    this.show,
    this.type,
    this.polynomialOrder,
    this.lineColor,
    this.lineWidth,
    this.lineStyle,
    this.showEquation,
    this.showR2,
    this.labelFontSize,
  ];
}

// ── Scatter Cluster Settings ─────────────────────────────────────────

class ScatterClusterSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Clustering',
    value: false,
  });

  clusters = new formattingSettings.NumUpDown({
    name: 'clusters',
    displayName: 'Number of Clusters',
    value: 3,
  });

  showHulls = new formattingSettings.ToggleSwitch({
    name: 'showHulls',
    displayName: 'Show Convex Hulls',
    value: true,
  });

  name = 'scatterClusterSettings';
  displayName = 'Clustering';
  slices = [this.enabled, this.clusters, this.showHulls];
}

// ── Scatter Animation Settings ──────────────────────────────────────

class ScatterAnimationSettingsCard extends formattingSettings.SimpleCard {
  enableTransitions = new formattingSettings.ToggleSwitch({
    name: 'enableTransitions',
    displayName: 'Animated Transitions',
    value: true,
  });

  enablePlayAxis = new formattingSettings.ToggleSwitch({
    name: 'enablePlayAxis',
    displayName: 'Enable Play Axis',
    value: false,
  });

  playSpeed = new formattingSettings.NumUpDown({
    name: 'playSpeed',
    displayName: 'Play Speed (ms)',
    value: 1000,
  });

  name = 'scatterAnimationSettings';
  displayName = 'Scatter Animation';
  slices = [this.enableTransitions, this.enablePlayAxis, this.playSpeed];
}

// ── Scatter Zoom Settings ───────────────────────────────────────────

class ScatterZoomSettingsCard extends formattingSettings.SimpleCard {
  enableZoom = new formattingSettings.ToggleSwitch({
    name: 'enableZoom',
    displayName: 'Enable Zoom',
    value: false,
  });

  enablePan = new formattingSettings.ToggleSwitch({
    name: 'enablePan',
    displayName: 'Enable Pan',
    value: false,
  });

  name = 'scatterZoomSettings';
  displayName = 'Zoom & Pan';
  slices = [this.enableZoom, this.enablePan];
}

// ── Scatter Color Settings ──────────────────────────────────────────

class ScatterColorSettingsCard extends formattingSettings.SimpleCard {
  colorScale = new formattingSettings.ItemDropdown({
    name: 'colorScale',
    displayName: 'Color Scale',
    items: [
      { value: 'categorical', displayName: 'Categorical' },
      { value: 'sequential', displayName: 'Sequential' },
    ],
    value: { value: 'categorical', displayName: 'Categorical' },
  });

  startColor = new formattingSettings.ColorPicker({
    name: 'startColor',
    displayName: 'Start Color',
    value: { value: '#3B82F6' },
  });

  endColor = new formattingSettings.ColorPicker({
    name: 'endColor',
    displayName: 'End Color',
    value: { value: '#EF4444' },
  });

  name = 'scatterColorSettings';
  displayName = 'Color Scale';
  slices = [this.colorScale, this.startColor, this.endColor];
}

// ── Root Model ────────────────────────────────────────────────────────

export class ScatterBubbleSettings extends formattingSettings.Model {
  scatterSettings = new ScatterSettingsCard();
  axisSettings = new AxisSettingsCard();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettingsCard();
  quadrantSettings = new QuadrantSettingsCard();
  trendlineSettings = new TrendlineSettingsCard();

  scatterClusterSettings = new ScatterClusterSettingsCard();
  scatterAnimationSettings = new ScatterAnimationSettingsCard();
  scatterZoomSettings = new ScatterZoomSettingsCard();
  scatterColorSettings = new ScatterColorSettingsCard();

  axisFormattingCard = new AxisFormattingCard();

  legendFormattingCard = new LegendFormattingCard();

  dataLabelFormattingCard = new DataLabelFormattingCard();

  titleFormattingCard = new TitleFormattingCard();

  numberFormattingCard = new NumberFormattingCard();

  referenceLineFormattingCard = new ReferenceLineFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  seriesFormattingCard = new SeriesFormattingCard();
  cards = [
    this.scatterSettings,
    this.axisSettings,
    this.cardSettings,
    this.animationSettings,
    this.quadrantSettings,
    this.trendlineSettings,
    this.scatterClusterSettings,
    this.scatterAnimationSettings,
    this.scatterZoomSettings,
    this.scatterColorSettings,
    this.axisFormattingCard,
    this.legendFormattingCard,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.numberFormattingCard,
    this.referenceLineFormattingCard,
    this.conditionalFormattingCard,
    this.accessibilityFormattingCard,
    this.seriesFormattingCard,
    this.colorThemeFormattingCard,
  ];
}
