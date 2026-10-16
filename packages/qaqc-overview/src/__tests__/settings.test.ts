import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel'
import { describe, expect, it } from 'vitest'

import { OverviewSettingsModel, readDisplaySettings } from '../settings'

describe('OverviewSettingsModel', () => {
  it('defaults to the QAQC preset, solid backgrounds, transitions and chart summaries', () => {
    expect(readDisplaySettings(new OverviewSettingsModel())).toEqual({
      preset: 'qaqc',
      backgroundColor: '',
      backgroundOpacity: 100,
      cardOpacity: 100,
      animate: true,
      describeCharts: true,
    })
  })

  it('falls back to QAQC for an unknown preset and clamps opacity', () => {
    const model = new OverviewSettingsModel()
    model.colors.preset.value = { value: 'neon', displayName: 'Neon' }
    model.cardSettings.backgroundOpacity.value = 140
    model.cardSettings.cardOpacity.value = -5
    const settings = readDisplaySettings(model)
    expect(settings.preset).toBe('qaqc')
    expect(settings.backgroundOpacity).toBe(100)
    expect(settings.cardOpacity).toBe(0)
  })

  it('reads a non-number opacity as fully opaque', () => {
    const model = new OverviewSettingsModel()
    model.cardSettings.cardOpacity.value = Number.NaN
    expect(readDisplaySettings(model).cardOpacity).toBe(100)
  })

  it('builds four Format pane cards with the object names capabilities.json declares, and no Ranking', () => {
    const formattingModel = new FormattingSettingsService().buildFormattingModel(new OverviewSettingsModel())
    expect(formattingModel.cards.map((card) => ('uid' in card ? card.uid : '').replace(/-card$/, ''))).toEqual([
      'colors',
      'cardSettings',
      'animationSettings',
      'accessibility',
    ])
  })
})
