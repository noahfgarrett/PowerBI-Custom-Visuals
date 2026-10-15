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
  CARD_STYLE_MODE_ITEMS
} from '../../core/src';

// ── Chord Layout ────────────────────────────────────────────────────

class ChordLayoutSettings extends formattingSettings.SimpleCard {
  padding = new formattingSettings.NumUpDown({
    name: 'padding',
    displayName: 'Arc Gap', displayNameKey: 'ChordDiagramSettings_DisplayName_0007',
    value: 10,
  });

  minArcAngle = new formattingSettings.NumUpDown({
    name: 'minArcAngle',
    displayName: 'Minimum Label Angle (degrees)', displayNameKey: 'ChordDiagramSettings_DisplayName_0008',
    value: 0,
  });

  arcStrokeColor = new formattingSettings.ColorPicker({
    name: 'arcStrokeColor',
    displayName: 'Arc Stroke Color', displayNameKey: 'ChordDiagramSettings_DisplayName_0009',
    value: { value: '' },
  });

  arcThickness = new formattingSettings.NumUpDown({
    name: 'arcThickness',
    displayName: 'Arc Thickness', displayNameKey: 'ChordDiagramSettings_DisplayName_0010',
    value: 15,
  });

  name = 'chordSettings';
  displayName = 'Chord Layout';
  displayNameKey = 'ChordDiagramSettings_DisplayName_0001';
  slices = [this.padding, this.minArcAngle, this.arcStrokeColor, this.arcThickness];
}

// ── Ribbons ─────────────────────────────────────────────────────────

class ChordRibbonSettings extends formattingSettings.SimpleCard {
  ribbonOpacity = new formattingSettings.NumUpDown({
    name: 'ribbonOpacity',
    displayName: 'Ribbon Opacity (%)', displayNameKey: 'ChordDiagramSettings_DisplayName_0011',
    value: 65,
  });

  hoverOpacity = new formattingSettings.NumUpDown({
    name: 'hoverOpacity',
    displayName: 'Hover Opacity (%)', displayNameKey: 'ChordDiagramSettings_DisplayName_0012',
    value: 90,
  });

  dimOpacity = new formattingSettings.NumUpDown({
    name: 'dimOpacity',
    displayName: 'Dim Opacity (%)', displayNameKey: 'ChordDiagramSettings_DisplayName_0013',
    value: 8,
  });

  gradientRibbons = new formattingSettings.ToggleSwitch({
    name: 'gradientRibbons',
    displayName: 'Gradient Ribbons', displayNameKey: 'ChordDiagramSettings_DisplayName_0014',
    value: false,
  });

  directional = new formattingSettings.ToggleSwitch({
    name: 'directional',
    displayName: 'Directional Ribbons', displayNameKey: 'ChordDiagramSettings_DisplayName_0015',
    value: false,
  });

  name = 'chordRibbonSettings';
  displayName = 'Ribbons';
  displayNameKey = 'ChordDiagramSettings_DisplayName_0002';
  slices = [this.ribbonOpacity, this.hoverOpacity, this.dimOpacity, this.gradientRibbons, this.directional];
}

// ── Interaction ─────────────────────────────────────────────────────

class ChordInteractionSettings extends formattingSettings.SimpleCard {
  enableFiltering = new formattingSettings.ToggleSwitch({
    name: 'enableFiltering',
    displayName: 'Enable Chord Filtering', displayNameKey: 'ChordDiagramSettings_DisplayName_0016',
    value: false,
  });

  showFlowLabels = new formattingSettings.ToggleSwitch({
    name: 'showFlowLabels',
    displayName: 'Show Flow Labels on Hover', displayNameKey: 'ChordDiagramSettings_DisplayName_0017',
    value: false,
  });

  showEntityValues = new formattingSettings.ToggleSwitch({
    name: 'showEntityValues',
    displayName: 'Show Entity Totals', displayNameKey: 'ChordDiagramSettings_DisplayName_0018',
    value: false,
  });

  name = 'chordInteractionSettings';
  displayName = 'Interaction';
  displayNameKey = 'ChordDiagramSettings_DisplayName_0003';
  slices = [this.enableFiltering, this.showFlowLabels, this.showEntityValues];
}

// ── Color Theme ─────────────────────────────────────────────────────

class ChordColorThemeSettings extends formattingSettings.SimpleCard {
  useChartPalette = new formattingSettings.ToggleSwitch({
    name: 'useChartPalette',
    displayName: 'Use Chart Palette', displayNameKey: 'ChordDiagramSettings_DisplayName_0019',
    value: true,
  });

  colorTheme = new formattingSettings.ItemDropdown({
    name: 'colorTheme',
    displayName: 'Theme', displayNameKey: 'ChordDiagramSettings_DisplayName_0020',
    items: [
      { value: 'default', displayName: 'Default', displayNameKey: 'ChordDiagramSettings_DisplayName_0021' },
      { value: 'ocean', displayName: 'Ocean', displayNameKey: 'ChordDiagramSettings_DisplayName_0022' },
      { value: 'sunset', displayName: 'Sunset', displayNameKey: 'ChordDiagramSettings_DisplayName_0023' },
      { value: 'forest', displayName: 'Forest', displayNameKey: 'ChordDiagramSettings_DisplayName_0024' },
      { value: 'berry', displayName: 'Berry', displayNameKey: 'ChordDiagramSettings_DisplayName_0025' },
      { value: 'monochrome', displayName: 'Monochrome', displayNameKey: 'ChordDiagramSettings_DisplayName_0026' },
      { value: 'earth', displayName: 'Earth', displayNameKey: 'ChordDiagramSettings_DisplayName_0027' },
    ],
    value: { value: 'default', displayName: 'Default', displayNameKey: 'ChordDiagramSettings_DisplayName_0028' },
  });

  name = 'colorThemeFormatting';
  displayName = 'Color Theme';
  displayNameKey = 'ChordDiagramSettings_DisplayName_0004';
  slices = [this.useChartPalette, this.colorTheme];
}

// ── Card Style ──────────────────────────────────────────────────────

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style', displayNameKey: 'ChordDiagramSettings_DisplayName_0029',
    items: CARD_STYLE_MODE_ITEMS,
    value: { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'ChordDiagramSettings_DisplayName_0034' },
  });

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background Color', displayNameKey: 'ChordDiagramSettings_DisplayName_0035',
    value: { value: '' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Background Opacity (%)', displayNameKey: 'ChordDiagramSettings_DisplayName_0036',
    value: 35,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius', displayNameKey: 'ChordDiagramSettings_DisplayName_0037',
    value: 12,
  });

  contentPadding = new formattingSettings.NumUpDown({
    name: 'contentPadding',
    displayName: 'Content Padding', displayNameKey: 'ChordDiagramSettings_DisplayName_0038',
    value: 24,
  });

  name = 'cardSettings';
  displayName = 'Card Style';
  displayNameKey = 'ChordDiagramSettings_DisplayName_0005';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.contentPadding];
}

// ── Animation Settings ──────────────────────────────────────────────

class AnimationSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Animations', displayNameKey: 'ChordDiagramSettings_DisplayName_0039',
    value: true,
  });

  duration = new formattingSettings.NumUpDown({
    name: 'duration',
    displayName: 'Duration (ms)', displayNameKey: 'ChordDiagramSettings_DisplayName_0040',
    value: 600,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  displayNameKey = 'ChordDiagramSettings_DisplayName_0006';
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
