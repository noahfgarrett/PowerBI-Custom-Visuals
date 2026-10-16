import { onTestFinished } from 'vitest'

import { NAME_COLLATOR } from '../format'

/**
 * Counts NAME_COLLATOR comparisons for the rest of the test while keeping the real order; returns a reader for the
 * count. `compare` is a prototype getter that vi.spyOn cannot wrap, so a counting own property shadows it until
 * the test finishes.
 */
export function countCompares(): () => number {
  const compare = NAME_COLLATOR.compare
  let calls = 0
  Object.defineProperty(NAME_COLLATOR, 'compare', {
    configurable: true,
    value: (a: string, b: string): number => {
      calls += 1
      return compare(a, b)
    },
  })
  onTestFinished(() => {
    Reflect.deleteProperty(NAME_COLLATOR, 'compare')
  })
  return () => calls
}
