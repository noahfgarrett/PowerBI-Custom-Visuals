import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel'
import { describe, expect, it } from 'vitest'

import { PerformanceSettingsModel, readDisplaySettings } from '../settings'

describe('PerformanceSettingsModel', () => {
  it('defaults to the QAQC preset, solid backgrounds, transitions, chart summaries, and minimums of 5 finals and 10 welds', () => {
    expect(readDisplaySettings(new PerformanceSettingsModel())).toEqual({
      preset: 'qaqc',
      backgroundColor: '',
      backgroundOpacity: 100,
      cardOpacity: 100,
      animate: true,
      describeCharts: true,
      minimumFinals: 5,
      minimumWelds: 10,
    })
  })

  it('falls back to QAQC for an unknown preset and clamps opacity', () => {
    const model = new PerformanceSettingsModel()
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
    [Number.NaN, 5],
  ])('reads a minimum finals of %s as %s', (input, expected) => {
    const model = new PerformanceSettingsModel()
    model.ranking.minimumFinals.value = input
    expect(readDisplaySettings(model).minimumFinals).toBe(expected)
  })

  it.each([
    [0, 1],
    [250, 100],
    [12.4, 12],
    [Number.NaN, 10],
  ])('reads a minimum welds of %s as %s', (input, expected) => {
    const model = new PerformanceSettingsModel()
    model.ranking.minimumWelds.value = input
    expect(readDisplaySettings(model).minimumWelds).toBe(expected)
  })

  it('limits both minimums to 1 to 100 in the Format pane', () => {
    const model = new PerformanceSettingsModel()
    for (const slice of [model.ranking.minimumFinals, model.ranking.minimumWelds]) {
      expect(slice.options?.minValue?.value).toBe(1)
      expect(slice.options?.maxValue?.value).toBe(100)
    }
  })

  it('builds five Format pane cards with the object names capabilities.json declares', () => {
    const formattingModel = new FormattingSettingsService().buildFormattingModel(new PerformanceSettingsModel())
    expect(formattingModel.cards.map((card) => ('uid' in card ? card.uid : '').replace(/-card$/, ''))).toEqual([
      'colors',
      'cardSettings',
      'animationSettings',
      'accessibility',
      'ranking',
    ])
  })
})
