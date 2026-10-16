import { describe, expect, it } from 'vitest'

import { layoutChart } from '../components/IssuesTrendChart'
import { layoutWeekLines, type WeekLine } from '../components/OverviewLinesChart'
import { layoutPersonWeeks } from '../components/PersonWeekChart'
import type { PersonWeek } from '../performance'
import type { IssueTrendPoint } from '../types'
import { makeWorkWeek } from '../workWeeks'

// Pins every placed label's position for the three charts that share chartLabels.ts, at a spread of tile sizes and
// with dense data, so a change to the shared placement shows up as a moved label. The data is busy on purpose:
// labels collide, slide off their bars, slide inward from the axes, and two overview lines share values.

interface Positioned {
  key: string
  text: string
  x: number
  y: number
}

/** One line per label, in the layout's draw order. */
function positions(labels: readonly Positioned[]): string[] {
  return labels.map((label) => `${label.key} ${label.text} @ ${label.x},${label.y}`)
}

const SIZES: ReadonlyArray<readonly [number, number]> = [
  [320, 200],
  [632, 307],
  [900, 420],
  [1400, 560],
]

const ISSUE_POINTS: IssueTrendPoint[] = Array.from({ length: 40 }, (_, index) => ({
  week: makeWorkWeek(2026, index + 1),
  opened: (index * 7) % 13,
  closed: (index * 5) % 11,
  remainingOpen: 120 + ((index * 17) % 45),
}))

const OVERVIEW_LINES: WeekLine[] = [
  { key: 'inspection', color: '#2E5AAC', isDashed: false, values: Array.from({ length: 36 }, (_, index) => 88 + ((index * 7) % 9)) },
  {
    key: 'welding',
    color: '#1A9C7B',
    isDashed: true,
    // Every fourth week matches the inspection line exactly, so the two lines share a label there.
    values: Array.from({ length: 36 }, (_, index) => {
      if (index % 9 === 5) return null
      return index % 4 === 0 ? 88 + ((index * 7) % 9) : 86 + ((index * 5) % 11)
    }),
  },
]
const OVERVIEW_SCALE = { min: 84, max: 100, ticks: [84, 92, 100] }
const formatRate = (value: number): string => `${value.toFixed(1)}%`

const PERSON_WEEKS: PersonWeek[] = Array.from({ length: 30 }, (_, index) => {
  const volume = index < 3 ? 0 : (index * 7) % 12
  const ncrs = index < 3 ? 0 : (index * 3) % 4
  return { week: makeWorkWeek(2026, index + 10), volume, ncrs, runningRate: index < 3 ? null : 2 + ((index * 13) % 17) / 3 }
})

describe('chart label positions', () => {
  for (const [width, height] of SIZES) {
    for (const showValues of [false, true]) {
      it(`places the issue trend labels at ${width} × ${height}${showValues ? ', every value' : ''}`, () => {
        expect(positions(layoutChart(ISSUE_POINTS, width, height, showValues).labels)).toMatchSnapshot()
      })

      it(`places the overview line labels at ${width} × ${height}${showValues ? ', every value' : ''}`, () => {
        const titled = layoutWeekLines(OVERVIEW_LINES, 36, OVERVIEW_SCALE, width, height, true, 20, showValues, formatRate)
        const untitled = layoutWeekLines(OVERVIEW_LINES, 36, OVERVIEW_SCALE, width, height, false, -1, showValues, formatRate)
        expect({ titled: positions(titled.labels), untitled: positions(untitled.labels) }).toMatchSnapshot()
      })
    }

    it(`places the person week labels at ${width} × ${height}`, () => {
      expect(positions(layoutPersonWeeks(PERSON_WEEKS, width, height).labels)).toMatchSnapshot()
    })
  }
})
