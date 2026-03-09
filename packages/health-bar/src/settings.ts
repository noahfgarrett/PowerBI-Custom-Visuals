/**
 * Health Bar — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ScrollFormattingCard, SortFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, AnnotationFormattingCard, AccessibilityFormattingCard, NumberFormattingCard } from '../../core/src';

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

// -- Target Settings ----------------------------------------------------------

class TargetSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Target',
    value: true,
  });

  color = new formattingSettings.ColorPicker({
    name: 'color',
    displayName: 'Target Color',
    value: { value: '#0F172A' },
  });

  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width',
    value: 2,
  });

  markerStyle = new formattingSettings.ItemDropdown({
    name: 'markerStyle',
    displayName: 'Marker Style',
    items: [
      { value: 'line', displayName: 'Line' },
      { value: 'triangle', displayName: 'Triangle' },
      { value: 'diamond', displayName: 'Diamond' },
    ],
    value: { value: 'line', displayName: 'Line' },
  });

  name = 'targetSettings';
  displayName = 'Target';
  slices = [this.show, this.color, this.lineWidth, this.markerStyle];
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
  slices = [this.enableGlass, this.backgroundColor, this.backgroundOpacity, this.borderRadius];
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

// -- Health Bar Zone Settings -------------------------------------------------

class HealthBarZoneSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Zone Background',
    value: false,
  });

  zoneColors = new formattingSettings.TextInput({
    name: 'zoneColors',
    displayName: 'Zone Colors (CSV)',
    value: '#EF4444,#F59E0B,#22C55E',
    placeholder: '#EF4444,#F59E0B,#22C55E',
  });

  name = 'healthBarZone';
  displayName = 'Zone Background';
  slices = [this.show, this.zoneColors];
}

// -- Health Bar Scale Settings ------------------------------------------------

class HealthBarScaleSettings extends formattingSettings.SimpleCard {
  minValue = new formattingSettings.NumUpDown({
    name: 'minValue',
    displayName: 'Min Value',
    value: 0,
  });

  name = 'healthBarScale';
  displayName = 'Scale';
  slices = [this.minValue];
}

// -- Health Bar Value Position Settings ---------------------------------------

class HealthBarValuePositionSettings extends formattingSettings.SimpleCard {
  position = new formattingSettings.ItemDropdown({
    name: 'position',
    displayName: 'Value Position',
    items: [
      { value: 'above', displayName: 'Above' },
      { value: 'inside', displayName: 'Inside' },
      { value: 'end', displayName: 'End' },
      { value: 'right', displayName: 'Right' },
    ],
    value: { value: 'above', displayName: 'Above' },
  });

  name = 'healthBarValuePosition';
  displayName = 'Value Position';
  slices = [this.position];
}

// -- Root Model ---------------------------------------------------------------

export class HealthBarSettings extends formattingSettings.Model {
  healthBarSettings = new HealthBarSettingsCard();
  colorSettings = new ColorSettingsCard();
  targetSettings = new TargetSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettingsCard();

  categoryLabelSettings = new CategoryLabelSettingsCard();
  axisFormattingCard = new AxisFormattingCard();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  scrollFormattingCard = new ScrollFormattingCard();

  sortFormattingCard = new SortFormattingCard();

  referenceLineFormattingCard = new ReferenceLineFormattingCard();
  trendLineFormattingCard = new TrendLineFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  annotationFormattingCard = new AnnotationFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  healthBarZone = new HealthBarZoneSettings();
  healthBarScale = new HealthBarScaleSettings();
  healthBarValuePosition = new HealthBarValuePositionSettings();
  numberFormattingCard = new NumberFormattingCard();

  cards = [
    this.healthBarSettings,
    this.colorSettings,
    this.targetSettings,
    this.cardSettings,
    this.animationSettings,
    this.categoryLabelSettings,
    this.axisFormattingCard,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.scrollFormattingCard,
    this.sortFormattingCard,
    this.referenceLineFormattingCard,
    this.trendLineFormattingCard,
    this.conditionalFormattingCard,
    this.annotationFormattingCard,
    this.accessibilityFormattingCard,
    this.healthBarZone,
    this.healthBarScale,
    this.healthBarValuePosition,
    this.numberFormattingCard,
  ];
}
