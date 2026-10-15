import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** The declarations of one top-level rule in the shared stylesheet (jsdom cannot lay out the compiled CSS). */
export function ruleBody(selector: string): string {
  const source = readFileSync(join(__dirname, '..', 'qaqc.less'), 'utf8')
  const start = source.indexOf(`\n${selector} {`)
  if (start < 0) throw new Error(`rule ${selector} missing`)
  return source.slice(start, source.indexOf('}', start))
}
