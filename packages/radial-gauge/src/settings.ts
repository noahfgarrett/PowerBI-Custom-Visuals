/**
 * Radial Gauge Pro -- Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { DataLabelFormattingCard, TitleFormattingCard, NumberFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard } from '../../core/src';
class ArcSettings extends formattingSettings.SimpleCard {
  thickness = new formattingSettings.ItemDropdown({
    name: 'thickness',
    displayName: 'Thickness',
    items: [
      { value: 'thin', displayName: 'Thin' },
      { value: 'medium', displayName: 'Medium' },
      { value: 'thick', displayName: 'Thick' },
    ],
    value: { value: 'medium', displayName: 'Medium' },
  });

  trackOpacity = new formattingSettings.NumUpDown({

    name: 'trackOpacity',

    displayName: 'Track Opacity (%)',

    value: 15,

  });

  zoneBorderWidth = new formattingSettings.NumUpDown({

    name: 'zoneBorderWidth',

    displayName: 'Zone Border Width',

    value: 1.5,

  });

  zoneBorderOpacity = new formattingSettings.NumUpDown({

    name: 'zoneBorderOpacity',

    displayName: 'Zone Border Opacity (%)',

    value: 30,

  });

  trackColor = new formattingSettings.ColorPicker({
    name: 'trackColor',
    displayName: 'Track Color',
    value: { value: '#94A3B8' },
  });

  roundedCaps = new formattingSettings.ToggleSwitch({
    name: 'roundedCaps',
    displayName: 'Rounded Caps',
    value: true,
  });

  startAngle = new formattingSettings.ItemDropdown({
    name: 'startAngle',
    displayName: 'Arc Preset',
    items: [
      { value: 'half', displayName: 'Half Circle' },
      { value: 'full', displayName: 'Full Circle' },
    ],
    value: { value: 'half', displayName: 'Half Circle' },
  });

  name = 'arcSettings';
  displayName = 'Arc';
  slices = [this.thickness, this.trackColor, this.trackOpacity, this.zoneBorderWidth, this.zoneBorderOpacity, this.roundedCaps, this.startAngle];
}

class ZoneSettings extends formattingSettings.SimpleCard {
  zone1Threshold = new formattingSettings.NumUpDown({
    name: 'zone1Threshold',
    displayName: 'Zone 1 Threshold (%)',
    value: 33,
  });

  zone1Color = new formattingSettings.ColorPicker({
    name: 'zone1Color',
    displayName: 'Zone 1 Color',
    value: { value: '#F87171' }, // red
  });

  zone2Threshold = new formattingSettings.NumUpDown({
    name: 'zone2Threshold',
    displayName: 'Zone 2 Threshold (%)',
    value: 66,
  });

  zone2Color = new formattingSettings.ColorPicker({
    name: 'zone2Color',
    displayName: 'Zone 2 Color',
    value: { value: '#FBBF24' }, // amber
  });

  zone3Color = new formattingSettings.ColorPicker({
    name: 'zone3Color',
    displayName: 'Zone 3 Color',
    value: { value: '#34D399' }, // green
  });

  name = 'zoneSettings';
  displayName = 'Color Zones';
  slices = [
    this.zone1Threshold,
    this.zone1Color,
    this.zone2Threshold,
    this.zone2Color,
    this.zone3Color,
  ];
}

class ValueSettings extends formattingSettings.SimpleCard {
  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size',
    value: 28,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color',
    value: { value: '' }, // empty = use theme default
  });

  deltaPositiveColor = new formattingSettings.ColorPicker({
    name: 'deltaPositiveColor',
    displayName: 'Delta Positive Color',
    value: { value: '#22C55E' },
  });

  deltaNegativeColor = new formattingSettings.ColorPicker({
    name: 'deltaNegativeColor',
    displayName: 'Delta Negative Color',
    value: { value: '#EF4444' },
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Font Family',
    items: [
      { value: 'Segoe UI', displayName: 'Segoe UI' },
      { value: 'Arial', displayName: 'Arial' },
      { value: 'Calibri', displayName: 'Calibri' },
      { value: 'Helvetica', displayName: 'Helvetica' },
      { value: 'Times New Roman', displayName: 'Times New Roman' },
      { value: 'Verdana', displayName: 'Verdana' },
      { value: 'Georgia', displayName: 'Georgia' },
    ],
    value: { value: 'Segoe UI', displayName: 'Segoe UI' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Font Weight',
    items: [
      { value: 'normal', displayName: 'Normal' },
      { value: 'bold', displayName: 'Bold' },
      { value: '600', displayName: 'Semi-Bold' },
    ],
    value: { value: 'normal', displayName: 'Normal' },
  });

  name = 'valueSettings';
  displayName = 'Value';
  slices = [this.fontSize, this.fontColor, this.fontFamily, this.fontWeight, this.deltaPositiveColor, this.deltaNegativeColor];
}

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

  name = 'targetSettings';
  displayName = 'Target';
  slices = [this.show, this.color];
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
  slices = [this.enableGlass, this.backgroundColor, this.backgroundOpacity, this.borderRadius];
}

class NeedleSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Needle',
    value: false,
  });

  color = new formattingSettings.ColorPicker({
    name: 'color',
    displayName: 'Needle Color',
    value: { value: '#0F172A' },
  });

  width = new formattingSettings.NumUpDown({
    name: 'width',
    displayName: 'Width (px)',
    value: 3,
  });

  showHub = new formattingSettings.ToggleSwitch({
    name: 'showHub',
    displayName: 'Show Hub',
    value: true,
  });

  hubRadius = new formattingSettings.NumUpDown({
    name: 'hubRadius',
    displayName: 'Hub Radius',
    value: 8,
  });

  name = 'needleSettings';
  displayName = 'Needle';
  slices = [this.show, this.color, this.width, this.showHub, this.hubRadius];
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

// ── Gauge Scale Settings ────────────────────────────────────────

class GaugeScaleSettings extends formattingSettings.SimpleCard {
  showTicks = new formattingSettings.ToggleSwitch({
    name: 'showTicks',
    displayName: 'Show Tick Marks',
    value: false,
  });

  showLabels = new formattingSettings.ToggleSwitch({
    name: 'showLabels',
    displayName: 'Show Scale Labels',
    value: false,
  });

  majorTicks = new formattingSettings.NumUpDown({
    name: 'majorTicks',
    displayName: 'Major Ticks',
    value: 5,
  });

  minorTicks = new formattingSettings.NumUpDown({
    name: 'minorTicks',
    displayName: 'Minor Ticks',
    value: 2,
  });

  majorTickColor = new formattingSettings.ColorPicker({
    name: 'majorTickColor',
    displayName: 'Major Tick Color',
    value: { value: '#64748B' },
  });

  minorTickColor = new formattingSettings.ColorPicker({
    name: 'minorTickColor',
    displayName: 'Minor Tick Color',
    value: { value: '#94A3B8' },
  });

  name = 'gaugeScaleSettings';
  displayName = 'Scale';
  slices = [this.showTicks, this.showLabels, this.majorTicks, this.minorTicks, this.majorTickColor, this.minorTickColor];
}

// ── Gauge Arc Settings ──────────────────────────────────────────

class GaugeArcSettings extends formattingSettings.SimpleCard {
  arcRange = new formattingSettings.NumUpDown({
    name: 'arcRange',
    displayName: 'Arc Range (degrees)',
    value: 270,
  });

  segmented = new formattingSettings.ToggleSwitch({
    name: 'segmented',
    displayName: 'LED-Style Segments',
    value: false,
  });

  segmentCount = new formattingSettings.NumUpDown({
    name: 'segmentCount',
    displayName: 'Segment Count',
    value: 20,
  });

  name = 'gaugeArcSettings';
  displayName = 'Arc Display';
  slices = [this.arcRange, this.segmented, this.segmentCount];
}

// ── Gauge Comparison Settings ───────────────────────────────────

class GaugeComparisonSettings extends formattingSettings.SimpleCard {
  showDelta = new formattingSettings.ToggleSwitch({
    name: 'showDelta',
    displayName: 'Show Delta Indicator',
    value: false,
  });

  showSparkline = new formattingSettings.ToggleSwitch({
    name: 'showSparkline',
    displayName: 'Show Mini Sparkline',
    value: false,
  });

  name = 'gaugeComparisonSettings';
  displayName = 'Comparison';
  slices = [this.showDelta, this.showSparkline];
}

export class RadialGaugeSettings extends formattingSettings.Model {
  arcSettings = new ArcSettings();
  zoneSettings = new ZoneSettings();
  valueSettings = new ValueSettings();
  targetSettings = new TargetSettings();
  needleSettings = new NeedleSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();
  gaugeScaleSettings = new GaugeScaleSettings();
  gaugeArcSettings = new GaugeArcSettings();
  gaugeComparisonSettings = new GaugeComparisonSettings();

  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  numberFormattingCard = new NumberFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  cards = [
    this.arcSettings,
    this.zoneSettings,
    this.valueSettings,
    this.targetSettings,
    this.needleSettings,
    this.cardSettings,
    this.animationSettings,
    this.gaugeScaleSettings,
    this.gaugeArcSettings,
    this.gaugeComparisonSettings,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.numberFormattingCard,
    this.conditionalFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
