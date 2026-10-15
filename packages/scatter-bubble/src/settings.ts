/**
 * Scatter Bubble Plot — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, NumberFormattingCard, ReferenceLineFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard,
  SeriesFormattingCard,
  DateFilterFormattingCard,
  CARD_STYLE_MODE_ITEMS
} from '../../core/src';

// ── Bubble Appearance ────────────────────────────────────────────────

class BubbleAppearanceCard extends formattingSettings.SimpleCard {
  minRadius = new formattingSettings.NumUpDown({
    name: 'minRadius',
    displayName: 'Minimum Bubble Radius', displayNameKey: 'ScatterBubbleSettings_DisplayName_0008',
    value: 4,
  });

  maxRadius = new formattingSettings.NumUpDown({
    name: 'maxRadius',
    displayName: 'Maximum Bubble Radius', displayNameKey: 'ScatterBubbleSettings_DisplayName_0009',
    value: 30,
  });

  opacity = new formattingSettings.NumUpDown({
    name: 'opacity',
    displayName: 'Opacity (%)', displayNameKey: 'ScatterBubbleSettings_DisplayName_0010',
    value: 70,
  });

  bubbleStrokeColor = new formattingSettings.ColorPicker({
    name: 'bubbleStrokeColor',
    displayName: 'Bubble Stroke Color', displayNameKey: 'ScatterBubbleSettings_DisplayName_0011',
    value: { value: '' },
  });

  bubbleStrokeWidth = new formattingSettings.NumUpDown({
    name: 'bubbleStrokeWidth',
    displayName: 'Bubble Stroke Width', displayNameKey: 'ScatterBubbleSettings_DisplayName_0012',
    value: 1.5,
  });

  name = 'scatterSettings';
  displayName = 'Bubble Appearance';
  displayNameKey = 'ScatterBubbleSettings_DisplayName_0001';
  slices = [this.minRadius, this.maxRadius, this.opacity, this.bubbleStrokeColor, this.bubbleStrokeWidth];
}

// ── Colors & Theme (merged Color Scale + Color Theme) ───────────────

class ColorsThemeCard extends formattingSettings.SimpleCard {
  colorScale = new formattingSettings.ItemDropdown({
    name: 'colorScale',
    displayName: 'Color Scale', displayNameKey: 'ScatterBubbleSettings_DisplayName_0013',
    items: [
      { value: 'categorical', displayName: 'Categorical', displayNameKey: 'ScatterBubbleSettings_DisplayName_0014' },
      { value: 'sequential', displayName: 'Sequential', displayNameKey: 'ScatterBubbleSettings_DisplayName_0015' },
    ],
    value: { value: 'categorical', displayName: 'Categorical', displayNameKey: 'ScatterBubbleSettings_DisplayName_0016' },
  });

  startColor = new formattingSettings.ColorPicker({
    name: 'startColor',
    displayName: 'Start Color', displayNameKey: 'ScatterBubbleSettings_DisplayName_0017',
    value: { value: '#3B82F6' },
  });

  endColor = new formattingSettings.ColorPicker({
    name: 'endColor',
    displayName: 'End Color', displayNameKey: 'ScatterBubbleSettings_DisplayName_0018',
    value: { value: '#EF4444' },
  });

  name = 'scatterColorSettings';
  displayName = 'Color Scale';
  displayNameKey = 'ScatterBubbleSettings_DisplayName_0002';
  slices = [this.colorScale, this.startColor, this.endColor];
}

// ── Card Style ────────────────────────────────────────────────────────

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style', displayNameKey: 'ScatterBubbleSettings_DisplayName_0019',
    items: CARD_STYLE_MODE_ITEMS,
    value: { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'ScatterBubbleSettings_DisplayName_0024' },
  });

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background Color', displayNameKey: 'ScatterBubbleSettings_DisplayName_0025',
    value: { value: '' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Background Opacity (%)', displayNameKey: 'ScatterBubbleSettings_DisplayName_0026',
    value: 35,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius', displayNameKey: 'ScatterBubbleSettings_DisplayName_0027',
    value: 12,
  });

  contentPadding = new formattingSettings.NumUpDown({
    name: 'contentPadding',
    displayName: 'Content Padding', displayNameKey: 'ScatterBubbleSettings_DisplayName_0028',
    value: 8,
  });

  name = 'cardSettings';
  displayName = 'Card Style';
  displayNameKey = 'ScatterBubbleSettings_DisplayName_0003';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.contentPadding];
}

// ── Quadrant Settings ────────────────────────────────────────────────

class QuadrantSettingsCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Quadrants', displayNameKey: 'ScatterBubbleSettings_DisplayName_0029',
    value: false,
  });

  xValue = new formattingSettings.NumUpDown({
    name: 'xValue',
    displayName: 'X Divider Value', displayNameKey: 'ScatterBubbleSettings_DisplayName_0030',
    value: 50,
  });

  yValue = new formattingSettings.NumUpDown({
    name: 'yValue',
    displayName: 'Y Divider Value', displayNameKey: 'ScatterBubbleSettings_DisplayName_0031',
    value: 50,
  });

  lineColor = new formattingSettings.ColorPicker({
    name: 'lineColor',
    displayName: 'Line Color', displayNameKey: 'ScatterBubbleSettings_DisplayName_0032',
    value: { value: '#94A3B8' },
  });

  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width', displayNameKey: 'ScatterBubbleSettings_DisplayName_0033',
    value: 1,
  });

  lineStyle = new formattingSettings.ItemDropdown({
    name: 'lineStyle',
    displayName: 'Line Style', displayNameKey: 'ScatterBubbleSettings_DisplayName_0034',
    items: [
      { value: 'solid', displayName: 'Solid', displayNameKey: 'ScatterBubbleSettings_DisplayName_0035' },
      { value: 'dashed', displayName: 'Dashed', displayNameKey: 'ScatterBubbleSettings_DisplayName_0036' },
      { value: 'dotted', displayName: 'Dotted', displayNameKey: 'ScatterBubbleSettings_DisplayName_0037' },
    ],
    value: { value: 'dashed', displayName: 'Dashed', displayNameKey: 'ScatterBubbleSettings_DisplayName_0038' },
  });

  showLabels = new formattingSettings.ToggleSwitch({
    name: 'showLabels',
    displayName: 'Show Labels', displayNameKey: 'ScatterBubbleSettings_DisplayName_0039',
    value: true,
  });

  topRightLabel = new formattingSettings.TextInput({
    name: 'topRightLabel',
    displayName: 'Top-Right Label', displayNameKey: 'ScatterBubbleSettings_DisplayName_0040',
    value: '',
    placeholder: 'e.g. Stars', placeholderKey: 'ScatterBubbleSettings_Placeholder_0001',
  });

  topLeftLabel = new formattingSettings.TextInput({
    name: 'topLeftLabel',
    displayName: 'Top-Left Label', displayNameKey: 'ScatterBubbleSettings_DisplayName_0041',
    value: '',
    placeholder: 'e.g. Question Marks', placeholderKey: 'ScatterBubbleSettings_Placeholder_0002',
  });

  bottomRightLabel = new formattingSettings.TextInput({
    name: 'bottomRightLabel',
    displayName: 'Bottom-Right Label', displayNameKey: 'ScatterBubbleSettings_DisplayName_0042',
    value: '',
    placeholder: 'e.g. Cash Cows', placeholderKey: 'ScatterBubbleSettings_Placeholder_0003',
  });

  bottomLeftLabel = new formattingSettings.TextInput({
    name: 'bottomLeftLabel',
    displayName: 'Bottom-Left Label', displayNameKey: 'ScatterBubbleSettings_DisplayName_0043',
    value: '',
    placeholder: 'e.g. Dogs', placeholderKey: 'ScatterBubbleSettings_Placeholder_0004',
  });

  labelFontSize = new formattingSettings.NumUpDown({
    name: 'labelFontSize',
    displayName: 'Label Font Size', displayNameKey: 'ScatterBubbleSettings_DisplayName_0044',
    value: 11,
  });

  labelFontColor = new formattingSettings.ColorPicker({
    name: 'labelFontColor',
    displayName: 'Label Font Color', displayNameKey: 'ScatterBubbleSettings_DisplayName_0045',
    value: { value: '' },
  });

  labelFontFamily = new formattingSettings.ItemDropdown({
    name: 'labelFontFamily',
    displayName: 'Label Font', displayNameKey: 'ScatterBubbleSettings_DisplayName_0046',
    items: [
      { value: '', displayName: 'Default', displayNameKey: 'ScatterBubbleSettings_DisplayName_0047' },
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'ScatterBubbleSettings_DisplayName_0048' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'ScatterBubbleSettings_DisplayName_0049' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'ScatterBubbleSettings_DisplayName_0050' },
      { value: 'Helvetica Neue', displayName: 'Helvetica Neue', displayNameKey: 'ScatterBubbleSettings_DisplayName_0051' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'ScatterBubbleSettings_DisplayName_0052' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'ScatterBubbleSettings_DisplayName_0053' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'ScatterBubbleSettings_DisplayName_0054' },
    ],
    value: { value: '', displayName: 'Default', displayNameKey: 'ScatterBubbleSettings_DisplayName_0055' },
  });

  labelFontWeight = new formattingSettings.ItemDropdown({
    name: 'labelFontWeight',
    displayName: 'Label Font Weight', displayNameKey: 'ScatterBubbleSettings_DisplayName_0056',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'ScatterBubbleSettings_DisplayName_0057' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'ScatterBubbleSettings_DisplayName_0058' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'ScatterBubbleSettings_DisplayName_0059' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'ScatterBubbleSettings_DisplayName_0060' },
  });

  zoneFillOpacity = new formattingSettings.NumUpDown({
    name: 'zoneFillOpacity',
    displayName: 'Zone Fill Opacity (%)', displayNameKey: 'ScatterBubbleSettings_DisplayName_0061',
    value: 0,
  });

  zone1Color = new formattingSettings.ColorPicker({
    name: 'zone1Color',
    displayName: 'Top-Left Zone Color', displayNameKey: 'ScatterBubbleSettings_DisplayName_0062',
    value: { value: '#F59E0B' },
  });

  zone2Color = new formattingSettings.ColorPicker({
    name: 'zone2Color',
    displayName: 'Top-Right Zone Color', displayNameKey: 'ScatterBubbleSettings_DisplayName_0063',
    value: { value: '#10B981' },
  });

  zone3Color = new formattingSettings.ColorPicker({
    name: 'zone3Color',
    displayName: 'Bottom-Left Zone Color', displayNameKey: 'ScatterBubbleSettings_DisplayName_0064',
    value: { value: '#EF4444' },
  });

  zone4Color = new formattingSettings.ColorPicker({
    name: 'zone4Color',
    displayName: 'Bottom-Right Zone Color', displayNameKey: 'ScatterBubbleSettings_DisplayName_0065',
    value: { value: '#3B82F6' },
  });

  name = 'quadrantSettings';
  displayName = 'Quadrants';
  displayNameKey = 'ScatterBubbleSettings_DisplayName_0004';
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
    displayName: 'Show Trendline', displayNameKey: 'ScatterBubbleSettings_DisplayName_0066',
    value: false,
  });

  type = new formattingSettings.ItemDropdown({
    name: 'type',
    displayName: 'Regression Type', displayNameKey: 'ScatterBubbleSettings_DisplayName_0067',
    items: [
      { value: 'linear', displayName: 'Linear', displayNameKey: 'ScatterBubbleSettings_DisplayName_0068' },
      { value: 'polynomial', displayName: 'Polynomial', displayNameKey: 'ScatterBubbleSettings_DisplayName_0069' },
      { value: 'exponential', displayName: 'Exponential', displayNameKey: 'ScatterBubbleSettings_DisplayName_0070' },
      { value: 'logarithmic', displayName: 'Logarithmic', displayNameKey: 'ScatterBubbleSettings_DisplayName_0071' },
      { value: 'power', displayName: 'Power', displayNameKey: 'ScatterBubbleSettings_DisplayName_0072' },
    ],
    value: { value: 'linear', displayName: 'Linear', displayNameKey: 'ScatterBubbleSettings_DisplayName_0073' },
  });

  polynomialOrder = new formattingSettings.NumUpDown({
    name: 'polynomialOrder',
    displayName: 'Polynomial Order', displayNameKey: 'ScatterBubbleSettings_DisplayName_0074',
    value: 2,
  });

  lineColor = new formattingSettings.ColorPicker({
    name: 'lineColor',
    displayName: 'Line Color', displayNameKey: 'ScatterBubbleSettings_DisplayName_0075',
    value: { value: '#EF4444' },
  });

  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width', displayNameKey: 'ScatterBubbleSettings_DisplayName_0076',
    value: 2,
  });

  lineStyle = new formattingSettings.ItemDropdown({
    name: 'lineStyle',
    displayName: 'Line Style', displayNameKey: 'ScatterBubbleSettings_DisplayName_0077',
    items: [
      { value: 'solid', displayName: 'Solid', displayNameKey: 'ScatterBubbleSettings_DisplayName_0078' },
      { value: 'dashed', displayName: 'Dashed', displayNameKey: 'ScatterBubbleSettings_DisplayName_0079' },
    ],
    value: { value: 'dashed', displayName: 'Dashed', displayNameKey: 'ScatterBubbleSettings_DisplayName_0080' },
  });

  showEquation = new formattingSettings.ToggleSwitch({
    name: 'showEquation',
    displayName: 'Show Equation', displayNameKey: 'ScatterBubbleSettings_DisplayName_0081',
    value: false,
  });

  showR2 = new formattingSettings.ToggleSwitch({
    name: 'showR2',
    displayName: 'Show R\u00B2', displayNameKey: 'ScatterBubbleSettings_DisplayName_0082',
    value: true,
  });

  labelFontSize = new formattingSettings.NumUpDown({
    name: 'labelFontSize',
    displayName: 'Label Font Size', displayNameKey: 'ScatterBubbleSettings_DisplayName_0083',
    value: 10,
  });

  name = 'trendlineSettings';
  displayName = 'Trend Line';
  displayNameKey = 'ScatterBubbleSettings_DisplayName_0005';
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
    displayName: 'Enable Clustering', displayNameKey: 'ScatterBubbleSettings_DisplayName_0084',
    value: false,
  });

  clusters = new formattingSettings.NumUpDown({
    name: 'clusters',
    displayName: 'Number of Clusters', displayNameKey: 'ScatterBubbleSettings_DisplayName_0085',
    value: 3,
  });

  showHulls = new formattingSettings.ToggleSwitch({
    name: 'showHulls',
    displayName: 'Show Convex Hulls', displayNameKey: 'ScatterBubbleSettings_DisplayName_0086',
    value: true,
  });

  enableZoom = new formattingSettings.ToggleSwitch({
    name: 'enableZoom',
    displayName: 'Enable Zoom', displayNameKey: 'ScatterBubbleSettings_DisplayName_0087',
    value: false,
  });

  enablePan = new formattingSettings.ToggleSwitch({
    name: 'enablePan',
    displayName: 'Enable Pan', displayNameKey: 'ScatterBubbleSettings_DisplayName_0088',
    value: false,
  });

  name = 'scatterClusterSettings';
  displayName = 'Clustering and Navigation';
  displayNameKey = 'ScatterBubbleSettings_DisplayName_0006';
  slices = [this.enabled, this.clusters, this.showHulls, this.enableZoom, this.enablePan];
}

// ── Animation & Playback (merged Animation + Scatter Animation) ─────

class AnimationPlaybackCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Animate Bubble Entry', displayNameKey: 'ScatterBubbleSettings_DisplayName_0089',
    value: true,
  });

  duration = new formattingSettings.NumUpDown({
    name: 'duration',
    displayName: 'Duration (ms)', displayNameKey: 'ScatterBubbleSettings_DisplayName_0090',
    value: 600,
  });

  enableTransitions = new formattingSettings.ToggleSwitch({
    name: 'enableTransitions',
    displayName: 'Animated Transitions', displayNameKey: 'ScatterBubbleSettings_DisplayName_0091',
    value: true,
  });

  enablePlayAxis = new formattingSettings.ToggleSwitch({
    name: 'enablePlayAxis',
    displayName: 'Enable Play Axis', displayNameKey: 'ScatterBubbleSettings_DisplayName_0092',
    value: false,
  });

  playSpeed = new formattingSettings.NumUpDown({
    name: 'playSpeed',
    displayName: 'Play Speed (ms)', displayNameKey: 'ScatterBubbleSettings_DisplayName_0093',
    value: 1000,
  });

  name = 'animationSettings';
  displayName = 'Animation & Playback';
  displayNameKey = 'ScatterBubbleSettings_DisplayName_0007';
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
    this.seriesFormattingCard,
    this.dataLabelFormattingCard,
    this.axisFormattingCard,
    this.quadrantSettings,
    this.trendlineSettings,
    this.referenceLineFormattingCard,
    this.conditionalFormattingCard,
    this.scatterClusterSettings,
    this.animationSettings,
    this.legendFormattingCard,
    this.titleFormattingCard,
    this.numberFormattingCard,
    this.colorThemeFormattingCard,
    this.cardSettings,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
