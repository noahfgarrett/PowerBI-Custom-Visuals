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
  CARD_STYLE_MODE_ITEMS
} from '../../core/src';
// ── Grid Settings (merged with Layout) ──────────────────────────────

class GridSettings extends formattingSettings.SimpleCard {
  rows = new formattingSettings.NumUpDown({
    name: 'rows',
    displayName: 'Rows', displayNameKey: 'WaffleChartSettings_DisplayName_0007',
    value: 10,
  });

  cols = new formattingSettings.NumUpDown({
    name: 'cols',
    displayName: 'Columns', displayNameKey: 'WaffleChartSettings_DisplayName_0008',
    value: 10,
  });

  gap = new formattingSettings.NumUpDown({
    name: 'gap',
    displayName: 'Cell Gap (px)', displayNameKey: 'WaffleChartSettings_DisplayName_0009',
    value: 3,
  });

  chartPadding = new formattingSettings.NumUpDown({
    name: 'chartPadding',
    displayName: 'Chart Padding (px)', displayNameKey: 'WaffleChartSettings_DisplayName_0010',
    value: 12,
  });

  fillDirection = new formattingSettings.ItemDropdown({
    name: 'fillDirection',
    displayName: 'Fill Direction', displayNameKey: 'WaffleChartSettings_DisplayName_0011',
    items: [
      { value: 'lr', displayName: 'Left to Right', displayNameKey: 'WaffleChartSettings_DisplayName_0012' },
      { value: 'bt', displayName: 'Bottom to Top', displayNameKey: 'WaffleChartSettings_DisplayName_0013' },
      { value: 'diagonal', displayName: 'Diagonal', displayNameKey: 'WaffleChartSettings_DisplayName_0014' },
      { value: 'radial', displayName: 'Radial', displayNameKey: 'WaffleChartSettings_DisplayName_0015' },
    ],
    value: { value: 'bt', displayName: 'Bottom to Top', displayNameKey: 'WaffleChartSettings_DisplayName_0016' },
  });

  autoFitCells = new formattingSettings.ToggleSwitch({
    name: 'autoFitCells',
    displayName: 'Auto-Fit Rows and Columns', displayNameKey: 'WaffleChartSettings_DisplayName_0017',
    value: false,
  });

  shape = new formattingSettings.ItemDropdown({
    name: 'shape',
    displayName: 'Cell Shape', displayNameKey: 'WaffleChartSettings_DisplayName_0018',
    items: [
      { value: 'square', displayName: 'Square', displayNameKey: 'WaffleChartSettings_DisplayName_0019' },
      { value: 'circle', displayName: 'Circle', displayNameKey: 'WaffleChartSettings_DisplayName_0020' },
    ],
    value: { value: 'square', displayName: 'Square', displayNameKey: 'WaffleChartSettings_DisplayName_0021' },
  });

  cellCornerRadius = new formattingSettings.NumUpDown({
    name: 'cellCornerRadius',
    displayName: 'Cell Corner Radius (px)', displayNameKey: 'WaffleChartSettings_DisplayName_0022',
    value: 2,
  });

  name = 'gridSettings';
  displayName = 'Grid';
  displayNameKey = 'WaffleChartSettings_DisplayName_0001';
  slices = [this.rows, this.cols, this.gap, this.chartPadding, this.fillDirection, this.autoFitCells, this.shape, this.cellCornerRadius];
}

// ── Color Settings (canonical location for fill/empty/stroke) ───────

class ColorSettings extends formattingSettings.SimpleCard {
  fillColor = new formattingSettings.ColorPicker({
    name: 'fillColor',
    displayName: 'Fill Color', displayNameKey: 'WaffleChartSettings_DisplayName_0023',
    value: { value: '' },
  });

  emptyColor = new formattingSettings.ColorPicker({
    name: 'emptyColor',
    displayName: 'Empty Color', displayNameKey: 'WaffleChartSettings_DisplayName_0024',
    value: { value: '#E2E8F0' },
  });

  cellStrokeColor = new formattingSettings.ColorPicker({
    name: 'cellStrokeColor',
    displayName: 'Cell Border Color', displayNameKey: 'WaffleChartSettings_DisplayName_0025',
    value: { value: '' },
  });

  name = 'colorSettings';
  displayName = 'Colors';
  displayNameKey = 'WaffleChartSettings_DisplayName_0002';
  slices = [this.fillColor, this.emptyColor, this.cellStrokeColor];
}

// ── Value Display Settings ───────────────────────────────────────────

class ValueSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Value', displayNameKey: 'WaffleChartSettings_DisplayName_0026',
    value: true,
  });

  displayMode = new formattingSettings.ItemDropdown({
    name: 'displayMode',
    displayName: 'Show As', displayNameKey: 'WaffleChartSettings_DisplayName_0074',
    items: [
      { value: 'percentage', displayName: 'Percentage', displayNameKey: 'WaffleChartSettings_DisplayName_0075' },
      { value: 'value', displayName: 'Actual Value', displayNameKey: 'WaffleChartSettings_DisplayName_0076' },
      { value: 'valueAndMax', displayName: 'Value and Maximum', displayNameKey: 'WaffleChartSettings_DisplayName_0077' },
    ],
    value: { value: 'percentage', displayName: 'Percentage', displayNameKey: 'WaffleChartSettings_DisplayName_0078' },
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size', displayNameKey: 'WaffleChartSettings_DisplayName_0027',
    value: 32,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color', displayNameKey: 'WaffleChartSettings_DisplayName_0028',
    value: { value: '' }, // empty = use theme default
  });

  fontFamily = new formattingSettings.ItemDropdown({
    name: 'fontFamily',
    displayName: 'Font Family', displayNameKey: 'WaffleChartSettings_DisplayName_0029',
    items: [
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'WaffleChartSettings_DisplayName_0030' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'WaffleChartSettings_DisplayName_0031' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'WaffleChartSettings_DisplayName_0032' },
      { value: 'Helvetica', displayName: 'Helvetica', displayNameKey: 'WaffleChartSettings_DisplayName_0033' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'WaffleChartSettings_DisplayName_0034' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'WaffleChartSettings_DisplayName_0035' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'WaffleChartSettings_DisplayName_0036' },
    ],
    value: { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'WaffleChartSettings_DisplayName_0037' },
  });

  fontWeight = new formattingSettings.ItemDropdown({
    name: 'fontWeight',
    displayName: 'Font Weight', displayNameKey: 'WaffleChartSettings_DisplayName_0038',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'WaffleChartSettings_DisplayName_0039' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'WaffleChartSettings_DisplayName_0040' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'WaffleChartSettings_DisplayName_0041' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'WaffleChartSettings_DisplayName_0042' },
  });

  valueSpacing = new formattingSettings.NumUpDown({
    name: 'valueSpacing',
    displayName: 'Space Between Grid and Value', displayNameKey: 'WaffleChartSettings_DisplayName_0043',
    value: 8,
  });

  name = 'valueSettings';
  displayName = 'Value Display';
  displayNameKey = 'WaffleChartSettings_DisplayName_0003';
  slices = [this.show, this.displayMode, this.fontSize, this.fontColor, this.fontFamily, this.fontWeight, this.valueSpacing];
}

// ── Pictogram Settings (merged with Icon Library) ───────────────────

class PictogramSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Pictogram Mode', displayNameKey: 'WaffleChartSettings_DisplayName_0044',
    value: false,
  });

  iconShape = new formattingSettings.ItemDropdown({
    name: 'iconShape',
    displayName: 'Icon Shape', displayNameKey: 'WaffleChartSettings_DisplayName_0045',
    items: [
      { value: 'circle', displayName: 'Circle', displayNameKey: 'WaffleChartSettings_DisplayName_0046' },
      { value: 'person', displayName: 'Person', displayNameKey: 'WaffleChartSettings_DisplayName_0047' },
      { value: 'star', displayName: 'Star', displayNameKey: 'WaffleChartSettings_DisplayName_0048' },
      { value: 'heart', displayName: 'Heart', displayNameKey: 'WaffleChartSettings_DisplayName_0049' },
      { value: 'square', displayName: 'Square', displayNameKey: 'WaffleChartSettings_DisplayName_0050' },
      { value: 'checkmark', displayName: 'Checkmark', displayNameKey: 'WaffleChartSettings_DisplayName_0051' },
    ],
    value: { value: 'person', displayName: 'Person', displayNameKey: 'WaffleChartSettings_DisplayName_0052' },
  });

  iconSet = new formattingSettings.ItemDropdown({
    name: 'iconSet',
    displayName: 'Icon Preset', displayNameKey: 'WaffleChartSettings_DisplayName_0053',
    items: [
      { value: 'default', displayName: 'Custom Shape', displayNameKey: 'WaffleChartSettings_DisplayName_0054' },
      { value: 'weather', displayName: 'Star', displayNameKey: 'WaffleChartSettings_DisplayName_0055' },
      { value: 'arrows', displayName: 'Checkmark', displayNameKey: 'WaffleChartSettings_DisplayName_0056' },
      { value: 'shapes', displayName: 'Square', displayNameKey: 'WaffleChartSettings_DisplayName_0057' },
      { value: 'status', displayName: 'Circle', displayNameKey: 'WaffleChartSettings_DisplayName_0058' },
    ],
    value: { value: 'default', displayName: 'Custom Shape', displayNameKey: 'WaffleChartSettings_DisplayName_0059' },
  });

  iconSize = new formattingSettings.NumUpDown({
    name: 'iconSize',
    displayName: 'Icon Size (%)', displayNameKey: 'WaffleChartSettings_DisplayName_0060',
    value: 90,
  });

  outlineOpacity = new formattingSettings.NumUpDown({
    name: 'outlineOpacity',
    displayName: 'Outline Opacity (%)', displayNameKey: 'WaffleChartSettings_DisplayName_0061',
    value: 20,
  });

  name = 'pictogramSettings';
  displayName = 'Pictogram';
  displayNameKey = 'WaffleChartSettings_DisplayName_0004';
  slices = [this.enabled, this.iconShape, this.iconSet, this.iconSize, this.outlineOpacity];
}

// ── Card Style Settings ──────────────────────────────────────────────

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style', displayNameKey: 'WaffleChartSettings_DisplayName_0062',
    items: CARD_STYLE_MODE_ITEMS,
    value: { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'WaffleChartSettings_DisplayName_0067' },
  });

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background Color', displayNameKey: 'WaffleChartSettings_DisplayName_0068',
    value: { value: '' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Background Opacity (%)', displayNameKey: 'WaffleChartSettings_DisplayName_0069',
    value: 35,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius', displayNameKey: 'WaffleChartSettings_DisplayName_0070',
    value: 12,
  });

  contentPadding = new formattingSettings.NumUpDown({
    name: 'contentPadding',
    displayName: 'Content Padding', displayNameKey: 'WaffleChartSettings_DisplayName_0073',
    value: 8,
  });

  name = 'cardSettings';
  displayName = 'Card Style';
  displayNameKey = 'WaffleChartSettings_DisplayName_0005';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.contentPadding];
}

// ── Animation Settings ───────────────────────────────────────────────

class AnimationSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Animations', displayNameKey: 'WaffleChartSettings_DisplayName_0071',
    value: true,
  });

  duration = new formattingSettings.NumUpDown({
    name: 'duration',
    displayName: 'Duration (ms)', displayNameKey: 'WaffleChartSettings_DisplayName_0072',
    value: 600,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  displayNameKey = 'WaffleChartSettings_DisplayName_0006';
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
    this.titleFormattingCard,
    this.legendFormattingCard,
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
