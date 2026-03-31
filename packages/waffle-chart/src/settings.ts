/**
 * Waffle Chart — Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 *
 * Reorganized: 16 → 11 cards
 * - Merged "Layout" into "Grid" (fillDirection, autoFitCells now in Grid)
 * - Merged "Icon Library" into "Pictogram" (iconSet now in Pictogram)
 * - Removed duplicate emptyColor from Grid (Colors card is canonical)
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { DataLabelFormattingCard, LegendFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard,
  DateFilterFormattingCard, NumberFormattingCard,
} from '../../core/src';
// ── Grid Settings (merged with Layout) ──────────────────────────────

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

  shape = new formattingSettings.ItemDropdown({
    name: 'shape',
    displayName: 'Cell Shape',
    items: [
      { value: 'square', displayName: 'Square' },
      { value: 'circle', displayName: 'Circle' },
    ],
    value: { value: 'square', displayName: 'Square' },
  });

  cellCornerRadius = new formattingSettings.NumUpDown({
    name: 'cellCornerRadius',
    displayName: 'Cell Corner Radius',
    value: 2,
  });

  name = 'gridSettings';
  displayName = 'Grid';
  slices = [this.rows, this.cols, this.gap, this.fillDirection, this.autoFitCells, this.shape, this.cellCornerRadius];
}

// ── Color Settings (canonical location for fill/empty/stroke) ───────

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

  cellStrokeColor = new formattingSettings.ColorPicker({
    name: 'cellStrokeColor',
    displayName: 'Cell Stroke Color',
    value: { value: '' },
  });

  name = 'colorSettings';
  displayName = 'Colors';
  slices = [this.fillColor, this.emptyColor, this.cellStrokeColor];
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
  displayName = 'Value Display';
  slices = [this.show, this.fontSize, this.fontColor, this.fontFamily, this.fontWeight];
}

// ── Pictogram Settings (merged with Icon Library) ───────────────────

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
  slices = [this.enabled, this.iconShape, this.iconSet, this.iconSize, this.outlineOpacity];
}

// ── Card Style Settings ──────────────────────────────────────────────

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

// ── Top-level Model (11 cards) ──────────────────────────────────────

export class WaffleChartSettings extends formattingSettings.Model {
  gridSettings = new GridSettings();
  colorSettings = new ColorSettings();
  valueSettings = new ValueSettings();
  pictogramSettings = new PictogramSettingsCard();
  legendFormattingCard = new LegendFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();
  dataLabelFormattingCard = new DataLabelFormattingCard();

  conditionalFormattingCard = new ConditionalFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();
  colorThemeFormattingCard = new ColorThemeFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();
  numberFormattingCard = new NumberFormattingCard();

  cards = [
    this.gridSettings,
    this.colorSettings,
    this.valueSettings,
    this.pictogramSettings,
    this.legendFormattingCard,
    this.titleFormattingCard,
    this.cardSettings,
    this.animationSettings,
    this.dataLabelFormattingCard,
    this.numberFormattingCard,
    this.conditionalFormattingCard,
    this.accessibilityFormattingCard,
    this.colorThemeFormattingCard,
    this.dateFilterFormattingCard,
  ];
}
