import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel'
import { describe, expect, it } from 'vitest'

import { MechanicalSettingsModel, readDisplaySettings } from '../settings'

describe('MechanicalSettingsModel', () => {
  it('defaults to the QAQC preset, solid backgrounds, transitions, and chart summaries', () => {
    expect(readDisplaySettings(new MechanicalSettingsModel())).toEqual({
      preset: 'qaqc',
      backgroundColor: '',
      backgroundOpacity: 100,
      cardOpacity: 100,
      animate: true,
      describeCharts: true,
    })
  })

  it('shows the qaqc preset as QCx in the Format pane while saved reports keep the qaqc value', () => {
    const preset = new MechanicalSettingsModel().colors.preset
    const qcx = { value: 'qaqc', displayName: 'QCx', displayNameKey: 'Qaqc_preset_qaqc' }
    expect(preset.value).toEqual(qcx)
    expect(preset.items[0]).toEqual(qcx)
  })

  it('falls back to QAQC for an unknown preset and clamps opacity', () => {
    const model = new MechanicalSettingsModel()
    model.colors.preset.value = { value: 'neon', displayName: 'Neon' }
    model.cardSettings.backgroundOpacity.value = 140
    model.cardSettings.cardOpacity.value = -5
    const settings = readDisplaySettings(model)
    expect(settings.preset).toBe('qaqc')
    expect(settings.backgroundOpacity).toBe(100)
    expect(settings.cardOpacity).toBe(0)
  })

  it('builds four Format pane cards with the object names capabilities.json declares', () => {
    const formattingModel = new FormattingSettingsService().buildFormattingModel(new MechanicalSettingsModel())
    expect(formattingModel.cards.map((card) => ('uid' in card ? card.uid : '').replace(/-card$/, ''))).toEqual([
      'colors',
      'cardSettings',
      'animationSettings',
      'accessibility',
    ])
  })
})
