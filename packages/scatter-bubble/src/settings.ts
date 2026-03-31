/**
 * Scatter Bubble Plot — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, NumberFormattingCard, ReferenceLineFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard,
  SeriesFormattingCard,
  DateFilterFormattingCard,
} from '../../core/src';

// ── Bubble Appearance ────────────────────────────────────────────────

class BubbleAppearanceCard extends formattingSettings.SimpleCard {
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
  displayName = 'Bubble Appearance';
  slices = [this.minRadius, this.maxRadius, this.opacity, this.bubbleStrokeColor, this.bubbleStrokeWidth];
}

// ── Colors & Theme (merged Color Scale + Color Theme) ───────────────

class ColorsThemeCard extends formattingSettings.SimpleCard {
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
  displayName = 'Colors & Theme';
  slices = [this.colorScale, this.startColor, this.endColor];
}

// ── Card Style ────────────────────────────────────────────────────────

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style',
    items: [
      { value: 'none', displayName: 'None' },
      { value: 'glass', displayName: 'Glass' },
      { value: 'elevated', displayName: 'Elevated' },
      { value: 'neumorphic', displayName: 'Neumorphic' },
    ],
    value: { value: 'glass', displayName: 'Glass' },
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
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius];
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

  labelFontColor = new formattingSettings.ColorPicker({
    name: 'labelFontColor',
    displayName: 'Label Font Color',
    value: { value: '' },
  });

  labelFontFamily = new formattingSettings.ItemDropdown({
    name: 'labelFontFamily',
    displayName: 'Label Font',
    items: [
      { value: '', displayName: 'Default' },
      { value: 'Segoe UI', displayName: 'Segoe UI' },
      { value: 'Arial', displayName: 'Arial' },
      { value: 'Calibri', displayName: 'Calibri' },
      { value: 'Helvetica Neue', displayName: 'Helvetica Neue' },
      { value: 'Times New Roman', displayName: 'Times New Roman' },
      { value: 'Verdana', displayName: 'Verdana' },
      { value: 'Georgia', displayName: 'Georgia' },
    ],
    value: { value: '', displayName: 'Default' },
  });

  labelFontWeight = new formattingSettings.ItemDropdown({
    name: 'labelFontWeight',
    displayName: 'Label Font Weight',
    items: [
      { value: 'normal', displayName: 'Normal' },
      { value: 'bold', displayName: 'Bold' },
      { value: '600', displayName: 'Semi-Bold' },
    ],
    value: { value: 'normal', displayName: 'Normal' },
  });

  zoneFillOpacity = new formattingSettings.NumUpDown({
    name: 'zoneFillOpacity',
    displayName: 'Zone Fill Opacity',
    value: 0,
  });

  zone1Color = new formattingSettings.ColorPicker({
    name: 'zone1Color',
    displayName: 'Top-Left Zone Color',
    value: { value: '#F59E0B' },
  });

  zone2Color = new formattingSettings.ColorPicker({
    name: 'zone2Color',
    displayName: 'Top-Right Zone Color',
    value: { value: '#10B981' },
  });

  zone3Color = new formattingSettings.ColorPicker({
    name: 'zone3Color',
    displayName: 'Bottom-Left Zone Color',
    value: { value: '#EF4444' },
  });

  zone4Color = new formattingSettings.ColorPicker({
    name: 'zone4Color',
    displayName: 'Bottom-Right Zone Color',
    value: { value: '#3B82F6' },
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
    this.labelFontColor,
    this.labelFontFamily,
    this.labelFontWeight,
    this.zoneFillOpacity,
    this.zone1Color,
    this.zone2Color,
    this.zone3Color,
    this.zone4Color,
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
    displayName: 'Show R\u00B2',
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

// ── Analytics (merged Clustering + Zoom & Pan) ──────────────────────

class AnalyticsSettingsCard extends formattingSettings.SimpleCard {
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

  name = 'scatterClusterSettings';
  displayName = 'Analytics';
  slices = [this.enabled, this.clusters, this.showHulls, this.enableZoom, this.enablePan];
}

// ── Animation & Playback (merged Animation + Scatter Animation) ─────

class AnimationPlaybackCard extends formattingSettings.SimpleCard {
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

  name = 'animationSettings';
  displayName = 'Animation & Playback';
  slices = [this.enabled, this.duration, this.enableTransitions, this.enablePlayAxis, this.playSpeed];
}

// ── Root Model ────────────────────────────────────────────────────────

export class ScatterBubbleSettings extends formattingSettings.Model {
  scatterSettings = new BubbleAppearanceCard();
  scatterColorSettings = new ColorsThemeCard();
  cardSettings = new CardStyleSettings();
  quadrantSettings = new QuadrantSettingsCard();
  trendlineSettings = new TrendlineSettingsCard();

  scatterClusterSettings = new AnalyticsSettingsCard();
  animationSettings = new AnimationPlaybackCard();

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
  dateFilterFormattingCard = new DateFilterFormattingCard();
  cards = [
    this.scatterSettings,
    this.scatterColorSettings,
    this.quadrantSettings,
    this.trendlineSettings,
    this.scatterClusterSettings,
    this.animationSettings,
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
    this.cardSettings,
    this.dateFilterFormattingCard,
  ];
}
