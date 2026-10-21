import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel'
import { describe, expect, it } from 'vitest'

import { PerformanceSettingsModel, readDisplaySettings as readPerformanceSettings } from '../../../qaqc-performance/src/settings'
import capabilities from '../../capabilities.json'
import { FfuMapSettingsModel, readDisplaySettings } from '../settings'

describe('FfuMapSettingsModel', () => {
  it('defaults the preset, background and card opacity like QCx Performance', () => {
    const performance = readPerformanceSettings(new PerformanceSettingsModel())
    expect(readDisplaySettings(new FfuMapSettingsModel())).toEqual({
      preset: performance.preset,
      backgroundColor: performance.backgroundColor,
      backgroundOpacity: performance.backgroundOpacity,
      cardOpacity: performance.cardOpacity,
    })
  })

  it('shows the qaqc preset as QCx in the Format pane while saved reports keep the qaqc value', () => {
    const preset = new FfuMapSettingsModel().colors.preset
    const qcx = { value: 'qaqc', displayName: 'QCx', displayNameKey: 'Qaqc_preset_qaqc' }
    expect(preset.value).toEqual(qcx)
    expect(preset.items[0]).toEqual(qcx)
  })

  it('falls back to QCx for an unknown preset and clamps opacity', () => {
    const model = new FfuMapSettingsModel()
    model.colors.preset.value = { value: 'neon', displayName: 'Neon' }
    model.cardSettings.backgroundOpacity.value = 140
    model.cardSettings.cardOpacity.value = Number.NaN
    const settings = readDisplaySettings(model)
    expect(settings.preset).toBe('qaqc')
    expect(settings.backgroundOpacity).toBe(100)
    expect(settings.cardOpacity).toBe(100)
  })

  it('builds the Format pane cards with the object names capabilities.json declares', () => {
    const formattingModel = new FormattingSettingsService().buildFormattingModel(new FfuMapSettingsModel())
    const names = formattingModel.cards.map((card) => ('uid' in card ? card.uid : '').replace(/-card$/, ''))
    expect(names).toEqual(['colors', 'cardSettings'])
    expect(Object.keys(capabilities.objects)).toEqual(names)
  })
})
