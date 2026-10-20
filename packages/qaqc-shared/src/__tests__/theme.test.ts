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

describe('to-date card', () => {
  const HOST = { foreground: '#FFFF00', background: '#000000', foregroundSelected: '#00FFFF' }

  function presetColors(preset: string): ReturnType<typeof resolveTheme>['colors'] {
    if (!isPresetName(preset)) throw new Error(`bad preset ${preset}`)
    return resolveTheme({ ...BASE, preset }).colors
  }

  it('is a slightly darker tint of the QAQC card', () => {
    expect(resolveTheme(BASE).colors.toDateCard).toBe('#F6F8FC')
  })

  it.each(Object.keys(PRESETS))('is a tint of series 1 on the card in %s', (preset) => {
    const colors = presetColors(preset)
    expect(colors.toDateCard).toBe(compositeOver(colors.series1, 0.035, colors.card))
  })

  it.each(Object.keys(PRESETS))('is darker than the card by a small, consistent step in %s', (preset) => {
    const colors = presetColors(preset)
    expect(contrastRatio(colors.toDateCard, '#000000')).toBeLessThan(contrastRatio(colors.card, '#000000'))
    const step = contrastRatio(colors.card, colors.toDateCard)
    expect(step).toBeGreaterThanOrEqual(1.04)
    expect(step).toBeLessThanOrEqual(1.07)
  })

  it.each(Object.keys(PRESETS))('keeps ink at 4.5:1 or more in %s', (preset) => {
    const colors = presetColors(preset)
    expect(contrastRatio(colors.ink, colors.toDateCard)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(colors.ink2, colors.toDateCard)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(Object.keys(PRESETS))('keeps muted label text at 4.5:1 or more on the to-date card in %s', (preset) => {
    const colors = presetColors(preset)
    expect(contrastRatio(colors.muted, colors.toDateCard)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(Object.keys(PRESETS))('keeps the status text colours at 4.5:1 or more in %s', (preset) => {
    const colors = presetColors(preset)
    const below = Object.entries(STATUS_COLORS).filter(([, color]) => contrastRatio(color, colors.toDateCard) < 4.5).map(([name]) => name)
    expect(below).toEqual([])
  })

  it('reaches the stylesheet with the card opacity', () => {
    const theme = resolveTheme({ ...BASE, cardOpacity: 50 })
    expect(theme.cssVariables['--qaqc-to-date-card']).toBe(withOpacity(theme.colors.toDateCard, 50))
    expect(theme.cssVariables['--qaqc-week-card']).toBeUndefined()
  })

  it('is the host background in high-contrast mode', () => {
    const theme = resolveTheme({ ...BASE, highContrast: HOST })
    expect(theme.colors.toDateCard).toBe('#000000')
    expect(theme.cssVariables['--qaqc-to-date-card']).toBe('#000000')
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

/** CIE Lab (D65) of a #rrggbb colour. */
function hexToLab(hex: string): Lab {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
  const [r, g, b] = channels.map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  const f = (t: number): number => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

type Lab = [number, number, number]

/** CIEDE2000 colour difference between two Lab colours (Sharma, Wu and Dalal's formulation). */
function labDeltaE2000([l1, a1, b1]: Lab, [l2, a2, b2]: Lab): number {
  const radians = (degrees: number): number => (degrees * Math.PI) / 180
  const meanChroma = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2
  const g = 0.5 * (1 - Math.sqrt(meanChroma ** 7 / (meanChroma ** 7 + 25 ** 7)))
  const [a1p, a2p] = [a1 * (1 + g), a2 * (1 + g)]
  const [c1, c2] = [Math.hypot(a1p, b1), Math.hypot(a2p, b2)]
  const hue = (a: number, b: number): number => ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360
  const [h1, h2] = [hue(a1p, b1), hue(a2p, b2)]
  let hueStep = h2 - h1
  if (hueStep > 180) hueStep -= 360
  if (hueStep < -180) hueStep += 360
  if (c1 * c2 === 0) hueStep = 0
  const deltaL = l2 - l1
  const deltaC = c2 - c1
  const deltaH = 2 * Math.sqrt(c1 * c2) * Math.sin(radians(hueStep / 2))
  const meanL = (l1 + l2) / 2
  const meanC = (c1 + c2) / 2
  let meanH = h1 + h2
  if (c1 * c2 !== 0) meanH = Math.abs(h1 - h2) <= 180 ? (h1 + h2) / 2 : (h1 + h2 + (h1 + h2 < 360 ? 360 : -360)) / 2
  const t = 1 - 0.17 * Math.cos(radians(meanH - 30)) + 0.24 * Math.cos(radians(2 * meanH)) + 0.32 * Math.cos(radians(3 * meanH + 6))
    - 0.2 * Math.cos(radians(4 * meanH - 63))
  const rotation = 30 * Math.exp(-(((meanH - 275) / 25) ** 2))
  const rc = 2 * Math.sqrt(meanC ** 7 / (meanC ** 7 + 25 ** 7))
  const sl = 1 + (0.015 * (meanL - 50) ** 2) / Math.sqrt(20 + (meanL - 50) ** 2)
  const sc = 1 + 0.045 * meanC
  const sh = 1 + 0.015 * meanC * t
  const rt = -Math.sin(radians(2 * rotation)) * rc
  return Math.sqrt((deltaL / sl) ** 2 + (deltaC / sc) ** 2 + (deltaH / sh) ** 2 + rt * (deltaC / sc) * (deltaH / sh))
}

function deltaE2000(first: string, second: string): number {
  return labDeltaE2000(hexToLab(first), hexToLab(second))
}

type Matrix = [[number, number, number], [number, number, number], [number, number, number]]

/** Machado, Oliveira and Fernandes (2009) full-severity simulations, applied in linear RGB. */
const CVD_SIMULATIONS: Record<'protan' | 'deutan' | 'tritan', Matrix> = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
}

function simulate(hex: string, matrix: Matrix): string {
  const linear = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return `#${matrix.map((row) => {
    const value = Math.min(1, Math.max(0, row[0] * linear[0] + row[1] * linear[1] + row[2] * linear[2]))
    const encoded = value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055
    return Math.round(encoded * 255).toString(16).padStart(2, '0')
  }).join('')}`
}

describe('deltaE2000', () => {
  it('matches Sharma, Wu and Dalal\'s published test pairs', () => {
    expect(labDeltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485])).toBeCloseTo(2.0425, 4)
    expect(labDeltaE2000([50, 0, 0], [50, -1, 2])).toBeCloseTo(2.3669, 4)
    expect(labDeltaE2000([50, 2.5, 0], [73, 25, -18])).toBeCloseTo(27.1492, 4)
    expect(labDeltaE2000([2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514])).toBeCloseTo(0.9082, 4)
  })

  it('is 0 for identical colours and symmetric', () => {
    expect(deltaE2000('#2E5AAC', '#2E5AAC')).toBe(0)
    expect(deltaE2000('#2E5AAC', '#D03B3B')).toBeCloseTo(deltaE2000('#D03B3B', '#2E5AAC'), 10)
  })

  it('tells black from white by about 100', () => {
    expect(deltaE2000('#000000', '#FFFFFF')).toBeCloseTo(100, 0)
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

  it.each(Object.keys(PRESETS))('is perceptually distinct from series 1, the accent and every status colour in %s', (preset) => {
    if (!isPresetName(preset)) throw new Error(`bad preset ${preset}`)
    const colors = PRESETS[preset]
    const others: Record<string, string> = { series1: colors.series1, accent: colors.accent, ...STATUS_COLORS }
    const tooClose = Object.entries(others).filter(([, color]) => deltaE2000(colors.series3, color) <= 20).map(([name]) => name)
    expect(tooClose).toEqual([])
  })

  it.each(Object.keys(PRESETS))('stays apart from series 1 under every colour vision deficiency in %s', (preset) => {
    if (!isPresetName(preset)) throw new Error(`bad preset ${preset}`)
    const colors = PRESETS[preset]
    const tooClose = Object.entries(CVD_SIMULATIONS)
      .filter(([, matrix]) => deltaE2000(simulate(colors.series3, matrix), simulate(colors.series1, matrix)) < 15)
      .map(([name]) => name)
    expect(tooClose).toEqual([])
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
