import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The declarations of one top-level rule in the shared stylesheet (jsdom cannot lay out the compiled CSS). The
 * selector may stand alone (`.a {`) or be one line of a selector list (`.a,` followed by more selectors).
 */
export function ruleBody(selector: string): string {
  const source = readFileSync(join(__dirname, '..', 'qaqc.less'), 'utf8')
  const alone = source.indexOf(`\n${selector} {`)
  const listed = source.indexOf(`\n${selector},\n`)
  const start = alone >= 0 ? alone : listed
  if (start < 0) throw new Error(`rule ${selector} missing`)
  const open = source.indexOf('{', start)
  return source.slice(open, source.indexOf('}', open))
}
