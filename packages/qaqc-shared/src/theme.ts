import type { ChartColors } from './chartTypes'

export type PresetName = 'qaqc' | 'blue' | 'lotusworks' | 'grayscale'

export interface PresetColors {
  page: string
  card: string
  border: string
  hairline: string
  ink: string
  ink2: string
  muted: string
  faint: string
  accent: string
  accentSoft: string
  series1: string
  series2: string
  /** A second categorical hue for a two-line chart, far from series 1 in every preset. */
  series3: string
}

export interface ThemeColors extends PresetColors {
  /** Project-to-date card groups: a slightly darker tint of the card, so week and period cards are the lighter ones. */
  toDateCard: string
  onAccent: string
  good: string
  bad: string
  warn: string
}

/** Fixed in every preset: green = good/closed, red = bad/opened/issue found, amber = warning. */
export const STATUS_COLORS = { good: '#0A7A0A', bad: '#D03B3B', warn: '#B45309' } as const

export const PRESETS: Record<PresetName, PresetColors> = {
  qaqc: {
    page: '#EDF1F6', card: '#FDFEFF', border: '#DCE3EC', hairline: '#EBEEF3',
    ink: '#1B2530', ink2: '#45505F', muted: '#6A7583', faint: '#9AA4B2',
    accent: '#2E5AAC', accentSoft: '#EAF0FA', series1: '#2E5AAC', series2: '#86B6EF', series3: '#1A9C7B',
  },
  blue: {
    page: '#F7F8FA', card: '#FFFFFF', border: '#E3E7ED', hairline: '#EEF1F5',
    ink: '#00325B', ink2: '#2B4A6B', muted: '#5B6B7F', faint: '#98A6B6',
    accent: '#0071C5', accentSoft: '#E6F1FA', series1: '#0071C5', series2: '#9CCBEE', series3: '#A98804',
  },
  lotusworks: {
    page: '#F3F5F8', card: '#FFFFFF', border: '#DDE3EA', hairline: '#ECEFF3',
    ink: '#003459', ink2: '#2E4A66', muted: '#5E6E80', faint: '#9AA6B4',
    accent: '#E85D04', accentSoft: '#FDEFE6', series1: '#003459', series2: '#0077B6', series3: '#2A9D8F',
  },
  grayscale: {
    page: '#F2F2F2', card: '#FFFFFF', border: '#DADADA', hairline: '#ECECEC',
    ink: '#1E1E1E', ink2: '#444444', muted: '#6B6B6B', faint: '#A0A0A0',
    accent: '#3A3A3A', accentSoft: '#EDEDED', series1: '#3A3A3A', series2: '#A6A6A6', series3: '#8A8A8A',
  },
}

export interface HighContrastColors {
  foreground: string
  background: string
  foregroundSelected: string
}

export interface ThemeOptions {
  preset: PresetName
  /** '' or an invalid value means "use the preset page color". */
  backgroundColor: string
  backgroundOpacity: number
  cardOpacity: number
  highContrast: HighContrastColors | null
}

export interface ResolvedTheme {
  colors: ThemeColors
  /** True when Power BI's high-contrast colors replace the preset. */
  isHighContrast: boolean
  cssVariables: Record<string, string>
}

/** Issue Detail "Open for discussion" rows: series 1 at this opacity over the card, like the app's #EDF3F7 tint. */
const DISCUSSION_TINT_OPACITY = 0.08
/**
 * Project-to-date card groups: series 1 at this opacity over the card. Darker than the card by a contrast step of
 * 1.05 to 1.065 in every preset while every status colour stays at 4.5:1 or more on it (5% took red below 4.5:1).
 */
const TO_DATE_TINT_OPACITY = 0.035
/** Closed status pills: the good color at this percent. */
const GOOD_SOFT_PERCENT = 12

const HEX_COLOR = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i

export function isPresetName(value: unknown): value is PresetName {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PRESETS, value)
}

export function withOpacity(hex: string, percent: number): string {
  const match = hex.match(HEX_COLOR)
  if (!match) return hex
  const alpha = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) / 100 : 1
  const [r, g, b] = [match[1], match[2], match[3]].map((part) => parseInt(part, 16))
  return `rgba(${r}, ${g}, ${b}, ${Number(alpha.toFixed(3))})`
}

function hexChannels(hex: string): [number, number, number] | null {
  const match = hex.match(HEX_COLOR)
  if (!match) return null
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)]
}

/** The solid colour of `color` drawn at `opacity` (0–1) over `background`. Non-hex input returns `color` unchanged. */
export function compositeOver(color: string, opacity: number, background: string): string {
  const front = hexChannels(color)
  const back = hexChannels(background)
  if (front === null || back === null) return color
  const alpha = Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : 1
  const mixed = front.map((channel, index) => Math.round(channel * alpha + back[index] * (1 - alpha)))
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0').toUpperCase()).join('')}`
}

function relativeLuminance(channels: [number, number, number]): number {
  const [r, g, b] = channels.map((channel) => {
    const value = channel / 255
    // The sRGB transfer threshold; WCAG 2's 0.03928 differs only between 8-bit steps, so hex results are identical.
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio (1–21) between two hex colours; 1 when either is not hex. */
export function contrastRatio(a: string, b: string): number {
  const first = hexChannels(a)
  const second = hexChannels(b)
  if (first === null || second === null) return 1
  const [light, dark] = [relativeLuminance(first), relativeLuminance(second)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

function highContrastColors(host: HighContrastColors): ThemeColors {
  return {
    page: host.background, card: host.background, toDateCard: host.background,
    border: host.foreground, hairline: host.foreground,
    ink: host.foreground, ink2: host.foreground, muted: host.foreground, faint: host.foreground,
    accent: host.foregroundSelected, accentSoft: host.background, onAccent: host.background,
    series1: host.foreground, series2: host.foregroundSelected, series3: host.foreground,
    good: host.foreground, bad: host.foregroundSelected, warn: host.foreground,
  }
}

export function resolveTheme(options: ThemeOptions): ResolvedTheme {
  const highContrast = options.highContrast
  const preset = PRESETS[options.preset]
  const colors: ThemeColors = highContrast
    ? highContrastColors(highContrast)
    : { ...preset, toDateCard: compositeOver(preset.series1, TO_DATE_TINT_OPACITY, preset.card), onAccent: '#FFFFFF', ...STATUS_COLORS }
  const pageBase = HEX_COLOR.test(options.backgroundColor) ? options.backgroundColor : colors.page
  const fill = (color: string, percent: number): string => (highContrast ? color : withOpacity(color, percent))

  return {
    colors,
    isHighContrast: highContrast !== null,
    cssVariables: {
      '--qaqc-page': fill(highContrast ? colors.page : pageBase, options.backgroundOpacity),
      '--qaqc-card': fill(colors.card, options.cardOpacity),
      '--qaqc-to-date-card': fill(colors.toDateCard, options.cardOpacity),
      '--qaqc-card-solid': colors.card,
      '--qaqc-border': colors.border,
      '--qaqc-hairline': colors.hairline,
      '--qaqc-ink': colors.ink,
      '--qaqc-ink-2': colors.ink2,
      '--qaqc-muted': colors.muted,
      '--qaqc-faint': colors.faint,
      '--qaqc-accent': colors.accent,
      '--qaqc-accent-soft': colors.accentSoft,
      '--qaqc-on-accent': colors.onAccent,
      '--qaqc-series-1': colors.series1,
      '--qaqc-series-2': colors.series2,
      '--qaqc-series-3': colors.series3,
      '--qaqc-good': colors.good,
      '--qaqc-bad': colors.bad,
      '--qaqc-warn': colors.warn,
      // High contrast keeps only host colors, so rows and pills lose their tints and keep their bar, dot and text.
      '--qaqc-discussion': highContrast ? colors.card : compositeOver(colors.series1, DISCUSSION_TINT_OPACITY, colors.card),
      '--qaqc-good-soft': highContrast ? colors.card : withOpacity(colors.good, GOOD_SOFT_PERCENT),
    },
  }
}

export function chartColorsFromTheme(theme: ResolvedTheme): ChartColors {
  const { colors } = theme
  return {
    series1: colors.series1,
    series2: colors.series2,
    series3: colors.series3,
    good: colors.good,
    bad: colors.bad,
    warn: colors.warn,
    card: colors.card,
    grid: colors.hairline,
    axisText: colors.muted,
    ink: colors.ink,
    accent: colors.accent,
  }
}
