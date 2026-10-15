import type { InspectionPhase } from './types'

export const UNSPECIFIED_BUILDING = 'Unspecified'
const NO_ISSUE = 'no issue found'

export function cellText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'boolean') return String(value)
  return ''
}

export function classifyPhase(value: unknown): InspectionPhase {
  const text = cellText(value).toLowerCase()
  if (!text) return 'other'
  if (text === 'final' || text.startsWith('final ') || text.includes('final inspection')) return 'final'
  if (text.includes('sor')) return 'sor'
  return 'other'
}

export function isIssueFound(value: unknown): boolean {
  const text = cellText(value).toLowerCase()
  return text !== '' && text !== NO_ISSUE
}

export function normalizeBuilding(value: unknown): string {
  return cellText(value) || UNSPECIFIED_BUILDING
}
