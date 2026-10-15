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
