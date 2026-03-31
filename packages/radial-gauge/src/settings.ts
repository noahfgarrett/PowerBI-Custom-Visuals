/**
 * Radial Gauge Pro -- Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, NumberFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard,
  ColorThemeFormattingCard,
  DateFilterFormattingCard,
} from '../../core/src';

// -- Arc Shape: all geometry together (merged Arc + Arc Display) ----------------

class ArcShapeSettings extends formattingSettings.SimpleCard {
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

  name = 'arcSettings';
  displayName = 'Arc Shape';
  slices = [this.thickness, this.roundedCaps, this.startAngle, this.arcRange, this.segmented, this.segmentCount];
}

// -- Arc Colors: track and zone border appearance -----------------------------

class ArcColorSettings extends formattingSettings.SimpleCard {
  trackColor = new formattingSettings.ColorPicker({
    name: 'trackColor',
    displayName: 'Track Color',
    value: { value: '#94A3B8' },
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

  name = 'arcColorSettings';
  displayName = 'Arc Colors';
  slices = [this.trackColor, this.trackOpacity, this.zoneBorderWidth, this.zoneBorderOpacity];
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

// -- Center Value: font settings only (delta colors moved to Comparison) ------

class CenterValueSettings extends formattingSettings.SimpleCard {
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
  displayName = 'Center Value';
  slices = [this.fontSize, this.fontColor, this.fontFamily, this.fontWeight];
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

  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width',
    value: 3,
  });

  name = 'targetSettings';
  displayName = 'Target';
  slices = [this.show, this.color, this.lineWidth];
}

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
  displayName = 'Scale & Ticks';
  slices = [this.showTicks, this.showLabels, this.majorTicks, this.minorTicks, this.majorTickColor, this.minorTickColor];
}

// ── Gauge Comparison Settings (now includes delta colors) ──────

class GaugeComparisonSettings extends formattingSettings.SimpleCard {
  showDelta = new formattingSettings.ToggleSwitch({
    name: 'showDelta',
    displayName: 'Show Delta Indicator',
    value: false,
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

  showSparkline = new formattingSettings.ToggleSwitch({
    name: 'showSparkline',
    displayName: 'Show Mini Sparkline',
    value: false,
  });

  name = 'gaugeComparisonSettings';
  displayName = 'Comparison';
  slices = [this.showDelta, this.deltaPositiveColor, this.deltaNegativeColor, this.showSparkline];
}

export class RadialGaugeSettings extends formattingSettings.Model {
  arcSettings = new ArcShapeSettings();
  arcColorSettings = new ArcColorSettings();
  zoneSettings = new ZoneSettings();
  valueSettings = new CenterValueSettings();
  targetSettings = new TargetSettings();
  needleSettings = new NeedleSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();
  gaugeScaleSettings = new GaugeScaleSettings();
  gaugeComparisonSettings = new GaugeComparisonSettings();

  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  numberFormattingCard = new NumberFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();
  legendFormattingCard = new LegendFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();
  cards = [
    this.arcSettings,
    this.arcColorSettings,
    this.zoneSettings,
    this.valueSettings,
    this.targetSettings,
    this.needleSettings,
    this.gaugeScaleSettings,
    this.gaugeComparisonSettings,
    this.titleFormattingCard,
    this.conditionalFormattingCard,
    this.cardSettings,
    this.numberFormattingCard,
    this.animationSettings,
    this.dataLabelFormattingCard,
    this.legendFormattingCard,
    this.colorThemeFormattingCard,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
