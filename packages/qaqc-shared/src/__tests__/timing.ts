/** How many times each timing budget is measured; the fastest run is the one compared with the budget. */
export const TIMING_RUNS = 3

/** Milliseconds `work` takes to run once. */
export function elapsed(work: () => void): number {
  const start = performance.now()
  work()
  return performance.now() - start
}

/**
 * The fastest of `runs` measurements, in milliseconds. `measure` runs once per measurement and returns the time it
 * measured, so setup that must be fresh for every run (a new index for a cold first call, a new render) goes inside
 * it, outside the timed part.
 *
 * The full suite runs test files in parallel, so a single run can be slowed by CPU contention. The fastest run still
 * catches a real regression, which slows every run, while the budgets themselves stay unchanged.
 */
export function bestOf(runs: number, measure: () => number): number {
  if (!Number.isInteger(runs) || runs < 1) throw new Error(`bestOf needs at least one run, got ${runs}`)
  let best = Number.POSITIVE_INFINITY
  for (let run = 0; run < runs; run += 1) {
    best = Math.min(best, measure())
  }
  return best
}
