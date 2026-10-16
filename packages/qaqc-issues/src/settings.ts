import type powerbi from 'powerbi-visuals-api'
import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel'

import { isPresetName, type PresetName } from '../../qaqc-shared/src/theme'

// powerbi.visuals.ValidatorType.Min / Max. The API package has no runtime enums,
// so the const enum values are spelled out.
const VALIDATOR_MIN = 0
const VALIDATOR_MAX = 1

const PERCENT_OPTIONS: powerbi.visuals.NumUpDownFormat = {
  minValue: { type: VALIDATOR_MIN, value: 0 },
  maxValue: { type: VALIDATOR_MAX, value: 100 },
  unitSymbol: '%',
}

const PRESET_ITEMS = [
  { value: 'qaqc', displayName: 'QAQC', displayNameKey: 'Qaqc_preset_qaqc' },
  { value: 'blue', displayName: 'Blue', displayNameKey: 'Qaqc_preset_blue' },
  { value: 'lotusworks', displayName: 'LotusWorks', displayNameKey: 'Qaqc_preset_lotusworks' },
  { value: 'grayscale', displayName: 'Grayscale', displayNameKey: 'Qaqc_preset_grayscale' },
]

class ColorsCard extends formattingSettings.SimpleCard {
  preset = new formattingSettings.ItemDropdown({
    name: 'preset',
    displayName: 'Preset',
    displayNameKey: 'Qaqc_colors_preset',
    items: PRESET_ITEMS,
    value: PRESET_ITEMS[0],
  })

  name = 'colors'
  displayName = 'Colors'
  displayNameKey = 'Qaqc_colors'
  slices = [this.preset]
}

class CardStyleSettings extends formattingSettings.SimpleCard {
  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background color',
    displayNameKey: 'Qaqc_background_color',
    value: { value: '' }, // empty = use the preset page color
  })

  backgroundOpacity = new formattingSettings.Slider({
    name: 'backgroundOpacity',
    displayName: 'Background opacity',
    displayNameKey: 'Qaqc_background_opacity',
    value: 100,
    options: PERCENT_OPTIONS,
  })

  cardOpacity = new formattingSettings.Slider({
    name: 'cardOpacity',
    displayName: 'Card opacity',
    displayNameKey: 'Qaqc_card_opacity',
    value: 100,
    options: PERCENT_OPTIONS,
  })

  name = 'cardSettings'
  displayName = 'Background'
  displayNameKey = 'Qaqc_background'
  slices = [this.backgroundColor, this.backgroundOpacity, this.cardOpacity]
}

class AnimationSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Transitions',
    displayNameKey: 'Qaqc_animation_enabled',
    value: true,
  })

  name = 'animationSettings'
  displayName = 'Animation'
  displayNameKey = 'Qaqc_animation'
  slices = [this.enabled]
}

class AccessibilityCard extends formattingSettings.SimpleCard {
  chartSummaries = new formattingSettings.ToggleSwitch({
    name: 'chartSummaries',
    displayName: 'Screen reader chart summaries',
    displayNameKey: 'Qaqc_accessibility_summaries',
    value: true,
  })

  name = 'accessibility'
  displayName = 'Accessibility'
  displayNameKey = 'Qaqc_accessibility'
  slices = [this.chartSummaries]
}

export class IssuesSettingsModel extends formattingSettings.Model {
  colors = new ColorsCard()
  cardSettings = new CardStyleSettings()
  animationSettings = new AnimationSettingsCard()
  accessibility = new AccessibilityCard()
  cards = [this.colors, this.cardSettings, this.animationSettings, this.accessibility]
}

export interface DisplaySettings {
  preset: PresetName
  backgroundColor: string
  backgroundOpacity: number
  cardOpacity: number
  animate: boolean
  describeCharts: boolean
}

function clampPercent(value: number): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 100
}

export function readDisplaySettings(model: IssuesSettingsModel): DisplaySettings {
  const preset = model.colors.preset.value.value
  return {
    preset: isPresetName(preset) ? preset : 'qaqc',
    backgroundColor: model.cardSettings.backgroundColor.value?.value ?? '',
    backgroundOpacity: clampPercent(model.cardSettings.backgroundOpacity.value),
    cardOpacity: clampPercent(model.cardSettings.cardOpacity.value),
    animate: model.animationSettings.enabled.value,
    describeCharts: model.accessibility.chartSummaries.value,
  }
}
