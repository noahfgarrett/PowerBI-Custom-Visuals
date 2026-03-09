/**
 * Ring Stack -- Formatting model (properties pane).
 * Defines all user-configurable options that appear in the PBI format pane.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, SortFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, NumberFormattingCard } from '../../core/src';
class RingSettings extends formattingSettings.SimpleCard {
  thickness = new formattingSettings.NumUpDown({
    name: 'thickness',
    displayName: 'Thickness (px)',
    value: 16,
  });

  gap = new formattingSettings.NumUpDown({
    name: 'gap',
    displayName: 'Gap (px)',
    value: 8,
  });

  maxValue = new formattingSettings.NumUpDown({
    name: 'maxValue',
    displayName: 'Max Value',
    value: 100,
  });

  showLabels = new formattingSettings.ToggleSwitch({
    name: 'showLabels',
    displayName: 'Show Labels',
    value: true,
  });


  trackColor = new formattingSettings.ColorPicker({

    name: 'trackColor',

    displayName: 'Track Color',

    value: { value: '' },

  });

  trackOpacity = new formattingSettings.NumUpDown({

    name: 'trackOpacity',

    displayName: 'Track Opacity (%)',

    value: 15,

  });

  ringStrokeColor = new formattingSettings.ColorPicker({

    name: 'ringStrokeColor',

    displayName: 'Ring Stroke Color',

    value: { value: '' },

  });

  roundedCaps = new formattingSettings.ToggleSwitch({
    name: 'roundedCaps',
    displayName: 'Rounded Caps',
    value: true,
  });

  name = 'ringSettings';
  displayName = 'Ring';
  slices = [this.thickness, this.gap, this.maxValue, this.showLabels, this.trackColor, this.trackOpacity, this.ringStrokeColor, this.roundedCaps];
}

class ColorSettings extends formattingSettings.SimpleCard {
  ring1Color = new formattingSettings.ColorPicker({
    name: 'ring1Color',
    displayName: 'Ring 1 Color',
    value: { value: '' },
  });

  ring2Color = new formattingSettings.ColorPicker({
    name: 'ring2Color',
    displayName: 'Ring 2 Color',
    value: { value: '' },
  });

  ring3Color = new formattingSettings.ColorPicker({
    name: 'ring3Color',
    displayName: 'Ring 3 Color',
    value: { value: '' },
  });

  ring4Color = new formattingSettings.ColorPicker({
    name: 'ring4Color',
    displayName: 'Ring 4 Color',
    value: { value: '' },
  });

  ring5Color = new formattingSettings.ColorPicker({
    name: 'ring5Color',
    displayName: 'Ring 5 Color',
    value: { value: '' },
  });

  ring6Color = new formattingSettings.ColorPicker({
    name: 'ring6Color',
    displayName: 'Ring 6 Color',
    value: { value: '' },
  });

  name = 'colorSettings';
  displayName = 'Ring Colors';
  slices = [
    this.ring1Color,
    this.ring2Color,
    this.ring3Color,
    this.ring4Color,
    this.ring5Color,
    this.ring6Color,
  ];
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

class CenterContentSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Center Content',
    value: true,
  });

  displayMode = new formattingSettings.ItemDropdown({
    name: 'displayMode',
    displayName: 'Display Mode',
    items: [
      { value: 'total', displayName: 'Total' },
      { value: 'count', displayName: 'Count' },
      { value: 'average', displayName: 'Average' },
      { value: 'custom', displayName: 'Custom' },
    ],
    value: { value: 'total', displayName: 'Total' },
  });

  customText = new formattingSettings.TextInput({
    name: 'customText',
    displayName: 'Custom Text',
    value: '',
    placeholder: 'Custom label',
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size',
    value: 24,
  });

  fontColor = new formattingSettings.ColorPicker({
    name: 'fontColor',
    displayName: 'Font Color',
    value: { value: '' },
  });

  showLabel = new formattingSettings.ToggleSwitch({
    name: 'showLabel',
    displayName: 'Show Label',
    value: true,
  });

  labelFontSize = new formattingSettings.NumUpDown({
    name: 'labelFontSize',
    displayName: 'Label Font Size',
    value: 11,
  });

  name = 'centerContentSettings';
  displayName = 'Center Content';
  slices = [
    this.show,
    this.displayMode,
    this.customText,
    this.fontSize,
    this.fontColor,
    this.showLabel,
    this.labelFontSize,
  ];
}

class PerRingMaxSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Per-Ring Scale',
    value: false,
  });

  maxValues = new formattingSettings.TextInput({
    name: 'maxValues',
    displayName: 'Max Values (comma-separated)',
    value: '',
    placeholder: '100,500,1000',
  });

  showPercentage = new formattingSettings.ToggleSwitch({
    name: 'showPercentage',
    displayName: 'Show Percentage',
    value: true,
  });

  name = 'perRingMaxSettings';
  displayName = 'Per-Ring Scale';
  slices = [this.enabled, this.maxValues, this.showPercentage];
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

// ── Ring Display Settings ───────────────────────────────────────

class RingDisplaySettings extends formattingSettings.SimpleCard {
  showArcLabels = new formattingSettings.ToggleSwitch({
    name: 'showArcLabels',
    displayName: 'Show Arc Labels (textPath)',
    value: false,
  });

  showOverflow = new formattingSettings.ToggleSwitch({
    name: 'showOverflow',
    displayName: 'Show Overflow Indicator (>100%)',
    value: false,
  });

  name = 'ringDisplaySettings';
  displayName = 'Ring Display';
  slices = [this.showArcLabels, this.showOverflow];
}

// ── Ring Gradient Settings ──────────────────────────────────────

class RingGradientSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Gradient Fill',
    value: false,
  });

  name = 'ringGradientSettings';
  displayName = 'Ring Gradient';
  slices = [this.enabled];
}

export class RingStackSettings extends formattingSettings.Model {
  ringSettings = new RingSettings();
  colorSettings = new ColorSettings();
  centerContentSettings = new CenterContentSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();
  perRingMaxSettings = new PerRingMaxSettingsCard();
  ringDisplaySettings = new RingDisplaySettings();
  ringGradientSettings = new RingGradientSettings();

  legendFormattingCard = new LegendFormattingCard();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  sortFormattingCard = new SortFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  numberFormattingCard = new NumberFormattingCard();

  cards = [
    this.ringSettings,
    this.colorSettings,
    this.centerContentSettings,
    this.cardSettings,
    this.animationSettings,
    this.perRingMaxSettings,
    this.ringDisplaySettings,
    this.ringGradientSettings,
    this.legendFormattingCard,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.sortFormattingCard,
    this.conditionalFormattingCard,
    this.accessibilityFormattingCard,
    this.colorThemeFormattingCard,
    this.numberFormattingCard,
  ];
}
