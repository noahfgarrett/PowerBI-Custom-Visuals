import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel'
import { describe, expect, it } from 'vitest'

import { ElectricalSettingsModel, readDisplaySettings } from '../settings'

describe('ElectricalSettingsModel', () => {
  it('defaults to the QAQC preset, solid backgrounds, transitions, and chart summaries', () => {
    expect(readDisplaySettings(new ElectricalSettingsModel())).toEqual({
      preset: 'qaqc',
      backgroundColor: '',
      backgroundOpacity: 100,
      cardOpacity: 100,
      animate: true,
      describeCharts: true,
    })
  })

  it('falls back to QAQC for an unknown preset and clamps opacity', () => {
    const model = new ElectricalSettingsModel()
    model.colors.preset.value = { value: 'neon', displayName: 'Neon' }
    model.cardSettings.backgroundOpacity.value = 140
    model.cardSettings.cardOpacity.value = -5
    const settings = readDisplaySettings(model)
    expect(settings.preset).toBe('qaqc')
    expect(settings.backgroundOpacity).toBe(100)
    expect(settings.cardOpacity).toBe(0)
  })

  it('builds four Format pane cards with the object names capabilities.json declares', () => {
    const formattingModel = new FormattingSettingsService().buildFormattingModel(new ElectricalSettingsModel())
    expect(formattingModel.cards.map((card) => card.uid.replace(/-card$/, ''))).toEqual([
      'colors',
      'cardSettings',
      'animationSettings',
      'accessibility',
    ])
  })
})
