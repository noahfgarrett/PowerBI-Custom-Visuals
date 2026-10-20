import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel'
import { describe, expect, it } from 'vitest'

import { WeldingSettingsModel, readDisplaySettings } from '../settings'

describe('WeldingSettingsModel', () => {
  it('defaults to the QAQC preset, solid backgrounds, transitions, chart summaries, and a 10 weld minimum', () => {
    expect(readDisplaySettings(new WeldingSettingsModel())).toEqual({
      preset: 'qaqc',
      backgroundColor: '',
      backgroundOpacity: 100,
      cardOpacity: 100,
      animate: true,
      describeCharts: true,
      minWelds: 10,
    })
  })

  it('shows the qaqc preset as QCx in the Format pane while saved reports keep the qaqc value', () => {
    const preset = new WeldingSettingsModel().colors.preset
    const qcx = { value: 'qaqc', displayName: 'QCx', displayNameKey: 'Qaqc_preset_qaqc' }
    expect(preset.value).toEqual(qcx)
    expect(preset.items[0]).toEqual(qcx)
  })

  it('falls back to QAQC for an unknown preset and clamps opacity', () => {
    const model = new WeldingSettingsModel()
    model.colors.preset.value = { value: 'neon', displayName: 'Neon' }
    model.cardSettings.backgroundOpacity.value = 140
    model.cardSettings.cardOpacity.value = -5
    const settings = readDisplaySettings(model)
    expect(settings.preset).toBe('qaqc')
    expect(settings.backgroundOpacity).toBe(100)
    expect(settings.cardOpacity).toBe(0)
  })

  it.each([
    [0, 1],
    [-20, 1],
    [250, 100],
    [100, 100],
    [1, 1],
    [7.6, 8],
    [Number.NaN, 10],
  ])('reads a minimum welds of %s as %s', (input, expected) => {
    const model = new WeldingSettingsModel()
    model.hotspots.minWelds.value = input
    expect(readDisplaySettings(model).minWelds).toBe(expected)
  })

  it('builds five Format pane cards with the object names capabilities.json declares', () => {
    const formattingModel = new FormattingSettingsService().buildFormattingModel(new WeldingSettingsModel())
    expect(formattingModel.cards.map((card) => ('uid' in card ? card.uid : '').replace(/-card$/, ''))).toEqual([
      'colors',
      'cardSettings',
      'animationSettings',
      'accessibility',
      'hotspots',
    ])
  })
})
