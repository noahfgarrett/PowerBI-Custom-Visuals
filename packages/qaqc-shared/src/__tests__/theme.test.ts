import { describe, expect, it } from 'vitest'

import {
  chartColorsFromTheme,
  compositeOver,
  contrastRatio,
  isPresetName,
  PRESETS,
  resolveTheme,
  STATUS_COLORS,
  withOpacity,
  type ThemeOptions,
} from '../theme'

const BASE: ThemeOptions = { preset: 'qaqc', backgroundColor: '', backgroundOpacity: 100, cardOpacity: 100, highContrast: null }

describe('withOpacity', () => {
  it('converts hex to rgba with a clamped percent', () => {
    expect(withOpacity('#EDF1F6', 100)).toBe('rgba(237, 241, 246, 1)')
    expect(withOpacity('#FFFFFF', 0)).toBe('rgba(255, 255, 255, 0)')
    expect(withOpacity('#000000', 150)).toBe('rgba(0, 0, 0, 1)')
  })

  it('treats a non-finite percent as fully opaque', () => {
    expect(withOpacity('#000000', Number.NaN)).toBe('rgba(0, 0, 0, 1)')
  })
})

describe('resolveTheme', () => {
  it('uses the QAQC preset page and card colors by default', () => {
    const theme = resolveTheme(BASE)
    expect(theme.cssVariables['--qaqc-page']).toBe('rgba(237, 241, 246, 1)')
    expect(theme.cssVariables['--qaqc-series-1']).toBe('#2E5AAC')
  })

  it('applies a background color override and both opacities', () => {
    const theme = resolveTheme({ ...BASE, backgroundColor: '#FFFFFF', backgroundOpacity: 0, cardOpacity: 50 })
    expect(theme.cssVariables['--qaqc-page']).toBe('rgba(255, 255, 255, 0)')
    expect(theme.cssVariables['--qaqc-card']).toBe('rgba(253, 254, 255, 0.5)')
  })

  it('ignores an invalid override color', () => {
    expect(resolveTheme({ ...BASE, backgroundColor: 'red' }).cssVariables['--qaqc-page']).toBe('rgba(237, 241, 246, 1)')
  })

  it('keeps status colors fixed across every preset', () => {
    for (const preset of Object.keys(PRESETS)) {
      if (!isPresetName(preset)) throw new Error(`bad preset ${preset}`)
      const colors = resolveTheme({ ...BASE, preset }).colors
      expect([colors.good, colors.bad, colors.warn]).toEqual([STATUS_COLORS.good, STATUS_COLORS.bad, STATUS_COLORS.warn])
    }
  })

  it('switches to host colors in high-contrast mode', () => {
    const theme = resolveTheme({
      ...BASE,
      highContrast: { foreground: '#FFFF00', background: '#000000', foregroundSelected: '#00FFFF' },
    })
    expect(theme.colors.series1).toBe('#FFFF00')
    expect(theme.colors.series2).toBe('#00FFFF')
    expect(theme.cssVariables['--qaqc-page']).toBe('#000000')
  })

  it('tints Issue Detail discussion rows with the preset series 1 over the solid card', () => {
    expect(resolveTheme(BASE).cssVariables['--qaqc-discussion']).toBe('#ECF1F8')
    expect(resolveTheme({ ...BASE, preset: 'lotusworks' }).cssVariables['--qaqc-discussion']).toBe(
      compositeOver(PRESETS.lotusworks.series1, 0.08, PRESETS.lotusworks.card),
    )
  })

  it('keeps the discussion tint solid when cards are transparent', () => {
    expect(resolveTheme({ ...BASE, cardOpacity: 0 }).cssVariables['--qaqc-discussion']).toBe('#ECF1F8')
  })

  it('tints closed status pills with the fixed good color', () => {
    expect(resolveTheme(BASE).cssVariables['--qaqc-good-soft']).toBe('rgba(10, 122, 10, 0.12)')
  })

  it('drops the row and pill tints in high-contrast mode', () => {
    const theme = resolveTheme({
      ...BASE,
      highContrast: { foreground: '#FFFF00', background: '#000000', foregroundSelected: '#00FFFF' },
    })
    expect(theme.cssVariables['--qaqc-discussion']).toBe('#000000')
    expect(theme.cssVariables['--qaqc-good-soft']).toBe('#000000')
  })

  it('derives solid chart colors', () => {
    const colors = chartColorsFromTheme(resolveTheme({ ...BASE, cardOpacity: 0 }))
    expect(colors.card).toBe('#FDFEFF')
    expect(colors.bad).toBe('#D03B3B')
  })

  it('carries the good green into chart colors', () => {
    expect(chartColorsFromTheme(resolveTheme(BASE)).good).toBe(STATUS_COLORS.good)
  })

  it('flags high-contrast mode on the resolved theme', () => {
    const host = { foreground: '#FFFF00', background: '#000000', foregroundSelected: '#00FFFF' }
    expect(resolveTheme(BASE).isHighContrast).toBe(false)
    expect(resolveTheme({ ...BASE, highContrast: host }).isHighContrast).toBe(true)
  })

  it('carries the warn amber into chart colors', () => {
    expect(chartColorsFromTheme(resolveTheme(BASE)).warn).toBe(STATUS_COLORS.warn)
  })
})

describe('isPresetName', () => {
  it('accepts only known presets', () => {
    expect(isPresetName('blue')).toBe(true)
    expect(isPresetName('neon')).toBe(false)
    expect(isPresetName(3)).toBe(false)
  })
})

describe('compositeOver', () => {
  it('blends a colour at an opacity over a background', () => {
    expect(compositeOver('#003459', 0.675, '#FFFFFF')).toBe('#53768F')
    expect(compositeOver('#000000', 0.5, '#FFFFFF')).toBe('#808080')
  })

  it('keeps the colour at full opacity and the background at none', () => {
    expect(compositeOver('#2E5AAC', 1, '#FDFEFF')).toBe('#2E5AAC')
    expect(compositeOver('#2E5AAC', 0, '#FDFEFF')).toBe('#FDFEFF')
  })

  it('treats a non-finite opacity as fully opaque, like withOpacity', () => {
    expect(compositeOver('#003459', Number.NaN, '#FFFFFF')).toBe('#003459')
  })

  it('returns the colour unchanged when either colour is not hex', () => {
    expect(compositeOver('red', 0.5, '#FFFFFF')).toBe('red')
  })
})

describe('contrastRatio', () => {
  it('measures WCAG contrast between two colours', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 6)
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 6)
    expect(contrastRatio('#FFFFFF', '#53768F')).toBeCloseTo(4.82, 2)
  })

  it('is the same in either order', () => {
    expect(contrastRatio('#1B2530', '#86B6EF')).toBeCloseTo(contrastRatio('#86B6EF', '#1B2530'), 9)
  })

  it('is 1 when a colour is not hex', () => {
    expect(contrastRatio('red', '#FFFFFF')).toBe(1)
  })
})

describe('series 3', () => {
  it('differs from series 1 and the status colours in every preset, with at least 3:1 contrast on the card', () => {
    for (const preset of Object.keys(PRESETS)) {
      if (!isPresetName(preset)) throw new Error(`bad preset ${preset}`)
      const colors = PRESETS[preset]
      expect(colors.series3).not.toBe(colors.series1)
      expect(Object.values(STATUS_COLORS)).not.toContain(colors.series3)
      expect(contrastRatio(colors.series3, colors.card)).toBeGreaterThanOrEqual(3)
    }
  })

  it('reaches the stylesheet and the chart colours', () => {
    const theme = resolveTheme(BASE)
    expect(theme.cssVariables['--qaqc-series-3']).toBe(PRESETS.qaqc.series3)
    expect(chartColorsFromTheme(theme).series3).toBe(PRESETS.qaqc.series3)
  })

  it('is the host foreground in high-contrast mode, where charts tell it apart by a dash', () => {
    const host = { foreground: '#FFFF00', background: '#000000', foregroundSelected: '#00FFFF' }
    expect(resolveTheme({ ...BASE, highContrast: host }).colors.series3).toBe('#FFFF00')
  })
})
