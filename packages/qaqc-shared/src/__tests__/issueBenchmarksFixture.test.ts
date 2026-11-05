import { describe, expect, it } from 'vitest'

import type { IssueColumns } from '../types'
import { ageBuckets, agingProfile, buildIssueBenchmarks, quarterMedians } from '../issueBenchmarks'
import { buildIssueIndex } from '../issues'
import { ISSUE_ROWS } from './fixtures/issueRows'

const COLUMNS: IssueColumns = {
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
const TODAY = new Date(2026, 9, 15) // WW42'2026
const WW42 = 202642
const WW30 = 202630
const index = buildIssueIndex(ISSUE_ROWS, COLUMNS, TODAY)

// Expected values are pinned to the seeded synthetic fixtures from scripts/generate-qaqc-fixtures.mjs.

describe("issue benchmarks as of WW42'2026 (issue log fixture)", () => {
  const benchmarks = buildIssueBenchmarks(index, WW42, TODAY)

  it('counts 126 closures', () => {
    expect(benchmarks.closures).toBe(126)
    expect(benchmarks.closedWithoutDate).toBe(0)
  })

  it('closes typically in 43 days, 90% within 81 days, the slowest in 90 days', () => {
    expect(benchmarks.typical).toBe(43)
    expect(benchmarks.window).toBe(81)
    expect(benchmarks.slowest).toBe(90)
  })

  it('has 51 open issues, 49 past the window and 49 older than any closure', () => {
    expect(benchmarks.open).toHaveLength(51)
    expect(benchmarks.pastWindow).toBe(49)
    expect(benchmarks.olderThanAny).toBe(49)
  })

  it('has the same open count as WW41', () => {
    expect(benchmarks.openDelta).toBe(0)
  })

  it('has a median open age of 462 days', () => {
    expect(benchmarks.medianOpenAge).toBe(462)
  })

  it('has #367 as the oldest open issue at 700 days, then #378 and #379 tied at 689 days in ID order', () => {
    const [first, second, third, fourth] = benchmarks.open
    expect([first.issue.id, first.age]).toEqual(['#367', 700])
    expect([second.issue.id, second.age]).toEqual(['#378', 689])
    expect([third.issue.id, third.age]).toEqual(['#379', 689])
    expect(fourth.age).toBeLessThan(689)
  })

  it('buckets the open issues 0 / 2 / 0 / 4 / 14 / 31', () => {
    const buckets = ageBuckets(benchmarks)
    expect(buckets.map((bucket) => [bucket.label, bucket.count])).toEqual([
      ['Under 1 month', 0],
      ['1 month – 81 days', 2],
      ['82 days – 3 months', 0],
      ['3–6 months', 4],
      ['6–12 months', 14],
      ['12+ months', 31],
    ])
  })

  it('ends the backlog age line at 462 days with 51 open', () => {
    const profile = agingProfile(index, { selectedKey: WW42, windowEndKey: WW42, range: 'recent', dateRange: null }, TODAY)
    expect(profile).toHaveLength(30)
    expect(profile[29]).toMatchObject({ median: 462, open: 51 })
  })
})

describe("issue benchmarks as of WW30'2026", () => {
  const benchmarks = buildIssueBenchmarks(index, WW30, TODAY)

  it('has 62 open issues and 45 past the window', () => {
    expect(benchmarks.open).toHaveLength(62)
    expect(benchmarks.pastWindow).toBe(45)
  })

  it('recomputes the window as 82 days from 112 closures', () => {
    expect(benchmarks.closures).toBe(112)
    expect(benchmarks.window).toBe(82)
  })

  it('buckets the open issues 8 / 9 / 0 / 7 / 10 / 28', () => {
    expect(ageBuckets(benchmarks).map((bucket) => bucket.count)).toEqual([8, 9, 0, 7, 10, 28])
  })
})

describe("quarterly median days to close as of WW42'2026", () => {
  const points = quarterMedians(index, WW42, TODAY)

  it("runs Q1'25 to Q4'26 with each median and closed count", () => {
    expect(points.map((point) => [point.label, point.median, point.closed])).toEqual([
      ["Q1'25", 43.5, 20],
      ["Q2'25", 60, 19],
      ["Q3'25", 28, 13],
      ["Q4'25", 41.5, 16],
      ["Q1'26", 46, 18],
      ["Q2'26", 54.5, 20],
      ["Q3'26", 34, 20],
      ["Q4'26", null, 0],
    ])
  })

  it("has Q1'25, Q2'25, Q1'26 and Q2'26 as the quarters slower than typical", () => {
    const typical = buildIssueBenchmarks(index, WW42, TODAY).typical ?? 0
    const slower = points.filter((point) => point.median !== null && point.median > typical).map((point) => point.label)
    expect(slower).toEqual(["Q1'25", "Q2'25", "Q1'26", "Q2'26"])
  })

  it('counts every closure once', () => {
    expect(points.reduce((sum, point) => sum + point.closed, 0)).toBe(126)
  })
})
