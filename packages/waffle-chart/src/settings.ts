/**
 * Waffle Chart — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { DataLabelFormattingCard, LegendFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard } from '../../core/src';
// ── Grid Settings ────────────────────────────────────────────────────

class GridSettings extends formattingSettings.SimpleCard {
  rows = new formattingSettings.NumUpDown({
    name: 'rows',
    displayName: 'Rows',
    value: 10,
  });

  cols = new formattingSettings.NumUpDown({
    name: 'cols',
    displayName: 'Columns',
    value: 10,
  });

  gap = new formattingSettings.NumUpDown({
    name: 'gap',
    displayName: 'Gap',
    value: 3,
  });

  shape = new formattingSettings.ItemDropdown({
    name: 'shape',
    displayName: 'Cell Shape',
    items: [
      { value: 'square', displayName: 'Square' },
      { value: 'circle', displayName: 'Circle' },
    ],
    value: { value: 'square', displayName: 'Square' },
  });


  cellStrokeColor = new formattingSettings.ColorPicker({

    name: 'cellStrokeColor',

    displayName: 'Cell Stroke Color',

    value: { value: '' },

  });

  cellCornerRadius = new formattingSettings.NumUpDown({

    name: 'cellCornerRadius',

    displayName: 'Cell Corner Radius',

    value: 2,

  });

  emptyColor = new formattingSettings.ColorPicker({

    name: 'emptyColor',

    displayName: 'Empty Color',

    value: { value: '' },

  });


  name = 'gridSettings';
  displayName = 'Grid';
  slices = [this.rows, this.cols, this.gap, this.shape, this.cellStrokeColor, this.cellCornerRadius, this.emptyColor];
}

// ── Color Settings ───────────────────────────────────────────────────

class ColorSettings extends formattingSettings.SimpleCard {
  fillColor = new formattingSettings.ColorPicker({
    name: 'fillColor',
    displayName: 'Fill Color',
    value: { value: '' },
  });

  emptyColor = new formattingSettings.ColorPicker({
    name: 'emptyColor',
    displayName: 'Empty Color',
    value: { value: '#E2E8F0' },
  });

  name = 'colorSettings';
  displayName = 'Colors';
  slices = [this.fillColor, this.emptyColor];
}

// ── Value Display Settings ───────────────────────────────────────────

class ValueSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Percentage',
    value: true,
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size',
    value: 32,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color',
    value: { value: '' }, // empty = use theme default
  });

  name = 'valueSettings';
  displayName = 'Value Display';
  slices = [this.show, this.fontSize, this.fontColor];
}

// ── Card Style Settings ──────────────────────────────────────────────

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

// ── Pictogram Settings ──────────────────────────────────────────────

class PictogramSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Pictogram Mode',
    value: false,
  });

  iconShape = new formattingSettings.ItemDropdown({
    name: 'iconShape',
    displayName: 'Icon Shape',
    items: [
      { value: 'circle', displayName: 'Circle' },
      { value: 'person', displayName: 'Person' },
      { value: 'star', displayName: 'Star' },
      { value: 'heart', displayName: 'Heart' },
      { value: 'square', displayName: 'Square' },
      { value: 'checkmark', displayName: 'Checkmark' },
    ],
    value: { value: 'person', displayName: 'Person' },
  });

  iconSize = new formattingSettings.NumUpDown({
    name: 'iconSize',
    displayName: 'Icon Size (%)',
    value: 90,
  });

  outlineOpacity = new formattingSettings.NumUpDown({
    name: 'outlineOpacity',
    displayName: 'Outline Opacity (%)',
    value: 20,
  });

  name = 'pictogramSettings';
  displayName = 'Pictogram';
  slices = [this.enabled, this.iconShape, this.iconSize, this.outlineOpacity];
}

// ── Top-level Model ──────────────────────────────────────────────────

// ── Waffle Layout Settings ──────────────────────────────────────

class WaffleLayoutSettings extends formattingSettings.SimpleCard {
  fillDirection = new formattingSettings.ItemDropdown({
    name: 'fillDirection',
    displayName: 'Fill Direction',
    items: [
      { value: 'lr', displayName: 'Left to Right' },
      { value: 'bt', displayName: 'Bottom to Top' },
      { value: 'diagonal', displayName: 'Diagonal' },
      { value: 'radial', displayName: 'Radial' },
    ],
    value: { value: 'bt', displayName: 'Bottom to Top' },
  });

  autoFitCells = new formattingSettings.ToggleSwitch({
    name: 'autoFitCells',
    displayName: 'Auto-Fit Cell Size',
    value: false,
  });

  name = 'waffleLayoutSettings';
  displayName = 'Layout';
  slices = [this.fillDirection, this.autoFitCells];
}

// ── Waffle Icon Settings ────────────────────────────────────────

class WaffleIconSettings extends formattingSettings.SimpleCard {
  iconSet = new formattingSettings.ItemDropdown({
    name: 'iconSet',
    displayName: 'Icon Set',
    items: [
      { value: 'default', displayName: 'Default' },
      { value: 'weather', displayName: 'Weather' },
      { value: 'arrows', displayName: 'Arrows' },
      { value: 'shapes', displayName: 'Shapes' },
      { value: 'status', displayName: 'Status' },
    ],
    value: { value: 'default', displayName: 'Default' },
  });

  name = 'waffleIconSettings';
  displayName = 'Icon Library';
  slices = [this.iconSet];
}

// ── Top-level Model ──────────────────────────────────────────────────

export class WaffleChartSettings extends formattingSettings.Model {
  gridSettings = new GridSettings();
  colorSettings = new ColorSettings();
  valueSettings = new ValueSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();
  pictogramSettings = new PictogramSettingsCard();
  waffleLayoutSettings = new WaffleLayoutSettings();
  waffleIconSettings = new WaffleIconSettings();

  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  legendFormattingCard = new LegendFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();

  cards = [
    this.gridSettings,
    this.colorSettings,
    this.valueSettings,
    this.cardSettings,
    this.animationSettings,
    this.pictogramSettings,
    this.waffleLayoutSettings,
    this.waffleIconSettings,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.legendFormattingCard,
    this.conditionalFormattingCard,
    this.accessibilityFormattingCard,
    this.colorThemeFormattingCard,
  ];
}
