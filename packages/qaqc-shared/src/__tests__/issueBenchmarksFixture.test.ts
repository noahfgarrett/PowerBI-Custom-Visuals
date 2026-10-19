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

describe("issue benchmarks as of WW42'2026 (October export)", () => {
  const benchmarks = buildIssueBenchmarks(index, WW42, TODAY)

  it('counts 126 closures', () => {
    expect(benchmarks.closures).toBe(126)
    expect(benchmarks.closedWithoutDate).toBe(0)
  })

  it('closes typically in 32 days, 90% within 77 days, the slowest in 314 days', () => {
    expect(benchmarks.typical).toBe(32)
    expect(benchmarks.window).toBe(77)
    expect(benchmarks.slowest).toBe(314)
  })

  it('has 51 open issues, all 51 past the window and 28 older than any closure', () => {
    expect(benchmarks.open).toHaveLength(51)
    expect(benchmarks.pastWindow).toBe(51)
    expect(benchmarks.olderThanAny).toBe(28)
  })

  it('has the same open count as WW41', () => {
    expect(benchmarks.openDelta).toBe(0)
  })

  it('has a median open age of 351 days', () => {
    expect(benchmarks.medianOpenAge).toBe(351)
  })

  it('has #759 and #760 as the oldest open issues at 413 days', () => {
    const [first, second, third] = benchmarks.open
    expect([first.issue.id, first.age]).toEqual(['#759', 413])
    expect([second.issue.id, second.age]).toEqual(['#760', 413])
    expect(third.age).toBeLessThan(413)
  })

  it('buckets the open issues 0 / 0 / 3 / 10 / 19 / 19', () => {
    const buckets = ageBuckets(benchmarks)
    expect(buckets.map((bucket) => [bucket.label, bucket.count])).toEqual([
      ['Under 1 month', 0],
      ['1 month – 77 days', 0],
      ['78 days – 3 months', 3],
      ['3–6 months', 10],
      ['6–12 months', 19],
      ['12+ months', 19],
    ])
  })

  it('ends the backlog age line at 351 days with 51 open', () => {
    const profile = agingProfile(index, { selectedKey: WW42, windowEndKey: WW42, range: 'recent' }, TODAY)
    expect(profile).toHaveLength(30)
    expect(profile[29]).toMatchObject({ median: 351, open: 51 })
  })
})

describe("issue benchmarks as of WW30'2026", () => {
  const benchmarks = buildIssueBenchmarks(index, WW30, TODAY)

  it('has 50 open issues and 39 past the window', () => {
    expect(benchmarks.open).toHaveLength(50)
    expect(benchmarks.pastWindow).toBe(39)
  })

  it('recomputes the window as 77 days from 125 closures', () => {
    expect(benchmarks.closures).toBe(125)
    expect(benchmarks.window).toBe(77)
  })

  it('buckets the open issues 5 / 6 / 0 / 6 / 33 / 0', () => {
    expect(ageBuckets(benchmarks).map((bucket) => bucket.count)).toEqual([5, 6, 0, 6, 33, 0])
  })
})

describe("quarterly median days to close as of WW42'2026", () => {
  const points = quarterMedians(index, WW42, TODAY)

  it("runs Q4'24 to Q4'26 with each median and closed count", () => {
    expect(points.map((point) => [point.label, point.median, point.closed])).toEqual([
      ["Q4'24", 30, 2],
      ["Q1'25", 19, 3],
      ["Q2'25", 14, 8],
      ["Q3'25", 22.5, 32],
      ["Q4'25", 59, 45],
      ["Q1'26", 13.5, 10],
      ["Q2'26", 16, 17],
      ["Q3'26", 32, 9],
      ["Q4'26", null, 0],
    ])
  })

  it("has Q4'25 as the only quarter slower than typical", () => {
    const typical = buildIssueBenchmarks(index, WW42, TODAY).typical ?? 0
    const slower = points.filter((point) => point.median !== null && point.median > typical).map((point) => point.label)
    expect(slower).toEqual(["Q4'25"])
  })

  it('counts every closure once', () => {
    expect(points.reduce((sum, point) => sum + point.closed, 0)).toBe(126)
  })
})
