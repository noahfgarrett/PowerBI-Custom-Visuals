import { act } from 'react'
import { vi } from 'vitest'

import { LABEL_METRICS } from '../chartLabels'
import type { ChartColors } from '../chartTypes'
import { buildIssueIndex } from '../issues'
import type { IssueColumns, IssueIndex } from '../types'
import { ISSUE_ROWS } from './fixtures/issueRows'

// Shared by the Issue Aging page tests: the October export, its columns, and DOM helpers for the charts.

export const AGING_COLUMNS: IssueColumns = {
  id: 0,
  title: 1,
  status: 2,
  type: 3,
  contractor: 4,
  createdOn: 5,
  updatedOn: 6,
  dueDate: 7,
  createdBy: 8,
  rootCause: 9,
  rootCauseCategory: 10,
}
export const AGING_TODAY = new Date(2026, 9, 15) // WW42'2026
export const WW42 = 202642
export const WW30 = 202630

export const AGING_COLORS: ChartColors = {
  series1: '#2E5AAC', series2: '#86B6EF', series3: '#1A9C7B', good: '#0A7A0A', bad: '#D03B3B', warn: '#B45309', card: '#FDFEFF',
  grid: '#EBEEF3', axisText: '#6A7583', ink: '#1B2530', accent: '#2E5AAC',
}

export function agingIndex(rows: ReadonlyArray<ReadonlyArray<string | null>> = ISSUE_ROWS): IssueIndex {
  return buildIssueIndex(rows, AGING_COLUMNS, AGING_TODAY)
}

/** The October export without its closed issues: nothing has closed as of any week, so there is no window. */
export function noClosuresIndex(): IssueIndex {
  return agingIndex(ISSUE_ROWS.filter((row) => row[2] !== 'Closed'))
}

export function fire(target: Element, event: Event): void {
  act(() => {
    target.dispatchEvent(event)
  })
}

export function click(target: Element): void {
  fire(target, new MouseEvent('click', { bubbles: true }))
}

export function pressKey(target: Element, key: string): void {
  fire(target, new KeyboardEvent('keydown', { key, bubbles: true }))
}

export function all(root: ParentNode, selector: string): Element[] {
  return [...root.querySelectorAll(selector)]
}

export function texts(root: ParentNode, selector: string): string[] {
  return all(root, selector).map((node) => node.textContent ?? '')
}

export interface TextBox {
  text: string
  left: number
  right: number
  top: number
  bottom: number
}

/** Font sizes of the chart text classes, so a box can be sized from LABEL_METRICS (measured at 9.5 px). */
const FONT_SIZES: ReadonlyArray<readonly [string, number]> = [
  ['qaqc-aging-count', 12],
  ['qaqc-aging-bucket-label', 11],
  ['qaqc-aging-bucket-range', 9.5],
  ['qaqc-aging-label', 9.5],
  ['qaqc-axis-year', 9],
  ['qaqc-axis-text', 10.5],
]

function fontSize(node: Element): number {
  return FONT_SIZES.find(([name]) => node.classList.contains(name))?.[1] ?? 10.5
}

/** The approximate box of an SVG text node, from its anchor, baseline and font size. */
export function textBox(node: Element): TextBox {
  const text = node.textContent ?? ''
  const scale = fontSize(node) / 9.5
  const width = text.length * LABEL_METRICS.charWidth * scale
  const x = Number(node.getAttribute('x'))
  const y = Number(node.getAttribute('y'))
  const anchor = node.getAttribute('text-anchor') ?? 'start'
  const left = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x
  return { text, left, right: left + width, top: y - LABEL_METRICS.ascent * scale, bottom: y + LABEL_METRICS.descent * scale }
}

function overlaps(a: TextBox, b: TextBox): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

/** Every pair of overlapping, unrotated text nodes under the root. */
export function textCollisions(root: ParentNode): Array<[string, string]> {
  const boxes = all(root, 'svg text').filter((node) => !node.hasAttribute('transform')).map(textBox)
  const found: Array<[string, string]> = []
  boxes.forEach((a, at) => {
    boxes.slice(at + 1).forEach((b) => {
      if (overlaps(a, b)) found.push([a.text, b.text])
    })
  })
  return found
}

/** Gives every element this size; undone by vi.restoreAllMocks in each test file's afterEach. */
export function stubSize(width = 800, height = 400): void {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height, toJSON: () => ({}),
  })
}
