import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

function fail(message) {
  console.error(`[verify] ${message}`)
  process.exit(1)
}

const [packageDirArg, requiredSelector] = process.argv.slice(2)
if (!packageDirArg || !requiredSelector) fail('usage: node scripts/verify-pbiviz-css.mjs <packageDir> <requiredSelector>')

const distDir = join(resolve(process.cwd(), packageDirArg), 'dist')

let files = []
try {
  files = readdirSync(distDir).filter((name) => name.endsWith('.pbiviz'))
} catch {
  fail(`cannot read ${distDir}`)
}
if (files.length !== 1) fail(`expected exactly one .pbiviz in dist, found ${files.length}`)

const file = join(distDir, files[0])
let payload
try {
  payload = JSON.parse(execFileSync('unzip', ['-p', file, 'resources/*.pbiviz.json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }))
} catch (error) {
  fail(`cannot read resources JSON from ${files[0]}: ${error instanceof Error ? error.message : String(error)}`)
}

const content = payload?.content
const css = content?.css
const js = content?.js
if (typeof js !== 'string' || js.length === 0) fail(`${files[0]} has no content.js`)
if (typeof css !== 'string' || css.length === 0) fail(`${files[0]} has no content.css (visual.ts must import ../style/visual.less)`)
if (!css.includes(requiredSelector)) fail(`${files[0]} content.css does not contain ${requiredSelector}`)

console.log(`[verify] ok css=${Buffer.byteLength(css)} js=${Buffer.byteLength(js)}`)
