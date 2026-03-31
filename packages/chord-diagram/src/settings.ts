/**
 * Chord Diagram — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import {
  DataLabelFormattingCard,
  LegendFormattingCard,
  TitleFormattingCard,
  SortFormattingCard,
  ConditionalFormattingCard,
  AccessibilityFormattingCard,
  NumberFormattingCard,
  DateFilterFormattingCard,
} from '../../core/src';

// ── Chord Layout ────────────────────────────────────────────────────

class ChordLayoutSettings extends formattingSettings.SimpleCard {
  padding = new formattingSettings.NumUpDown({
    name: 'padding',
    displayName: 'Padding',
    value: 10,
  });

  minArcAngle = new formattingSettings.NumUpDown({
    name: 'minArcAngle',
    displayName: 'Min Arc Angle (degrees)',
    value: 0,
  });

  arcStrokeColor = new formattingSettings.ColorPicker({
    name: 'arcStrokeColor',
    displayName: 'Arc Stroke Color',
    value: { value: '' },
  });

  arcThickness = new formattingSettings.NumUpDown({
    name: 'arcThickness',
    displayName: 'Arc Thickness',
    value: 15,
  });

  name = 'chordSettings';
  displayName = 'Chord Layout';
  slices = [this.padding, this.minArcAngle, this.arcStrokeColor, this.arcThickness];
}

// ── Ribbons ─────────────────────────────────────────────────────────

class ChordRibbonSettings extends formattingSettings.SimpleCard {
  ribbonOpacity = new formattingSettings.NumUpDown({
    name: 'ribbonOpacity',
    displayName: 'Ribbon Opacity (%)',
    value: 65,
  });

  hoverOpacity = new formattingSettings.NumUpDown({
    name: 'hoverOpacity',
    displayName: 'Hover Opacity (%)',
    value: 90,
  });

  dimOpacity = new formattingSettings.NumUpDown({
    name: 'dimOpacity',
    displayName: 'Dim Opacity (%)',
    value: 8,
  });

  gradientRibbons = new formattingSettings.ToggleSwitch({
    name: 'gradientRibbons',
    displayName: 'Gradient Ribbons',
    value: false,
  });

  directional = new formattingSettings.ToggleSwitch({
    name: 'directional',
    displayName: 'Directional Ribbons',
    value: false,
  });

  name = 'chordRibbonSettings';
  displayName = 'Ribbons';
  slices = [this.ribbonOpacity, this.hoverOpacity, this.dimOpacity, this.gradientRibbons, this.directional];
}

// ── Interaction ─────────────────────────────────────────────────────

class ChordInteractionSettings extends formattingSettings.SimpleCard {
  enableFiltering = new formattingSettings.ToggleSwitch({
    name: 'enableFiltering',
    displayName: 'Enable Chord Filtering',
    value: false,
  });

  showFlowLabels = new formattingSettings.ToggleSwitch({
    name: 'showFlowLabels',
    displayName: 'Show Flow Labels on Hover',
    value: false,
  });

  showEntityValues = new formattingSettings.ToggleSwitch({
    name: 'showEntityValues',
    displayName: 'Show Entity Values',
    value: false,
  });

  name = 'chordInteractionSettings';
  displayName = 'Interaction';
  slices = [this.enableFiltering, this.showFlowLabels, this.showEntityValues];
}

// ── Color Theme ─────────────────────────────────────────────────────

class ChordColorThemeSettings extends formattingSettings.SimpleCard {
  useChartPalette = new formattingSettings.ToggleSwitch({
    name: 'useChartPalette',
    displayName: 'Use Chart Palette',
    value: true,
  });

  colorTheme = new formattingSettings.ItemDropdown({
    name: 'colorTheme',
    displayName: 'Theme',
    items: [
      { value: 'default', displayName: 'Default' },
      { value: 'ocean', displayName: 'Ocean' },
      { value: 'sunset', displayName: 'Sunset' },
      { value: 'forest', displayName: 'Forest' },
      { value: 'berry', displayName: 'Berry' },
      { value: 'monochrome', displayName: 'Monochrome' },
      { value: 'earth', displayName: 'Earth' },
    ],
    value: { value: 'default', displayName: 'Default' },
  });

  name = 'colorThemeFormatting';
  displayName = 'Color Theme';
  slices = [this.useChartPalette, this.colorTheme];
}

// ── Card Style ──────────────────────────────────────────────────────

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

// ── Animation Settings ──────────────────────────────────────────────

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

// ── Root Model ──────────────────────────────────────────────────────

export class ChordDiagramSettings extends formattingSettings.Model {
  chordSettings = new ChordLayoutSettings();
  chordRibbonSettings = new ChordRibbonSettings();
  chordInteractionSettings = new ChordInteractionSettings();
  colorThemeFormattingCard = new ChordColorThemeSettings();

  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  legendFormattingCard = new LegendFormattingCard();

  numberFormattingCard = new NumberFormattingCard();
  sortFormattingCard = new SortFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();

  animationSettings = new AnimationSettings();
  cardSettings = new CardStyleSettings();
  dateFilterFormattingCard = new DateFilterFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  cards = [
    this.chordSettings,
    this.chordRibbonSettings,
    this.chordInteractionSettings,
    this.colorThemeFormattingCard,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.legendFormattingCard,
    this.numberFormattingCard,
    this.sortFormattingCard,
    this.conditionalFormattingCard,
    this.animationSettings,
    this.cardSettings,
    this.dateFilterFormattingCard,
    this.accessibilityFormattingCard,
  ];
}
