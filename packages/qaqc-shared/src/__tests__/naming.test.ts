import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** The six QCx visuals. Their package folders keep the internal `qaqc-` prefix. */
const VISUAL_PACKAGES = ['qaqc-electrical', 'qaqc-issues', 'qaqc-mechanical', 'qaqc-overview', 'qaqc-performance', 'qaqc-welding'] as const

/** The folders the setup guides ship in. */
const GUIDE_FOLDERS = ['LotusWorks_Package', 'Business_Package'] as const

/**
 * Text that keeps "QAQC" because it names the user's own data: Smartsheet columns and the QAQC sign-off they record.
 * Everything else users see says QCx.
 */
const QAQC_ALLOW_LIST = ['QAQC Advisory Item', 'QAQC signature'] as const

const REPO_ROOT = join(__dirname, '..', '..', '..', '..')

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Every string anywhere inside a parsed JSON value. */
function stringsIn(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(stringsIn)
  if (isRecord(value)) return Object.values(value).flatMap(stringsIn)
  return []
}

/** The text with every allow-listed phrase removed, so only an unexpected "QAQC" is left to find. */
function withoutAllowedQaqc(text: string): string {
  return QAQC_ALLOW_LIST.reduce((remaining, phrase) => remaining.split(phrase).join(''), text)
}

/** The strings that still say "QAQC" once the allow-listed phrases are taken out. */
function unexpectedQaqc(texts: readonly string[]): string[] {
  return texts.filter((text) => withoutAllowedQaqc(text).includes('QAQC'))
}

function packageFile(pkg: string, ...path: string[]): string {
  return join(REPO_ROOT, 'packages', pkg, ...path)
}

function resources(pkg: string): Record<string, unknown> {
  const parsed = readJson(packageFile(pkg, 'stringResources', 'en-US', 'resources.resjson'))
  if (!isRecord(parsed) || !isRecord(parsed.values)) throw new Error(`${pkg} resources.resjson has no values`)
  return parsed.values
}

/** The Format pane's colour preset choices, from capabilities.json. */
function presetEnumeration(pkg: string): unknown[] {
  const capabilities = readJson(packageFile(pkg, 'capabilities.json'))
  const objects = isRecord(capabilities) ? capabilities.objects : undefined
  const colors = isRecord(objects) ? objects.colors : undefined
  const properties = isRecord(colors) ? colors.properties : undefined
  const preset = isRecord(properties) ? properties.preset : undefined
  const type = isRecord(preset) ? preset.type : undefined
  const enumeration = isRecord(type) ? type.enumeration : undefined
  if (!Array.isArray(enumeration)) throw new Error(`${pkg} capabilities.json has no colors.preset enumeration`)
  return enumeration
}

function guideNames(folder: string): string[] {
  return readdirSync(join(REPO_ROOT, folder)).filter((name) => name.endsWith('.md') || name.endsWith('.pq'))
}

describe.each(VISUAL_PACKAGES)('%s user-facing names', (pkg) => {
  it('lists the qaqc colour preset as QCx in capabilities.json', () => {
    const qaqc = presetEnumeration(pkg).find((item) => isRecord(item) && item.value === 'qaqc')
    expect(qaqc).toEqual({ value: 'qaqc', displayName: 'QCx', displayNameKey: 'Qaqc_preset_qaqc' })
  })

  it('translates the qaqc colour preset as QCx', () => {
    expect(resources(pkg).Qaqc_preset_qaqc).toBe('QCx')
  })

  it('says QCx, not QAQC, in resources.resjson outside the Smartsheet column names', () => {
    expect(unexpectedQaqc(stringsIn(resources(pkg)))).toEqual([])
  })

  it('says QCx, not QAQC, in capabilities.json outside the Smartsheet column names', () => {
    expect(unexpectedQaqc(stringsIn(readJson(packageFile(pkg, 'capabilities.json'))))).toEqual([])
  })

  it('says QCx, not QAQC, in pbiviz.json', () => {
    expect(unexpectedQaqc(stringsIn(readJson(packageFile(pkg, 'pbiviz.json'))))).toEqual([])
  })
})

describe.each(GUIDE_FOLDERS)('%s guides', (folder) => {
  it('names the setup guides and the Power Query script QCx', () => {
    expect(guideNames(folder).filter((name) => name.startsWith('QCx_')).sort()).toEqual([
      'QCx_Combined.pq',
      'QCx_Combined_SETUP.md',
      'QCx_Electrical_SETUP.md',
      'QCx_Issues_SETUP.md',
      'QCx_Mechanical_SETUP.md',
      'QCx_Overview_SETUP.md',
      'QCx_Performance_SETUP.md',
      'QCx_Welding_SETUP.md',
    ])
    expect(guideNames(folder).filter((name) => name.includes('QAQC'))).toEqual([])
  })

  it('says QCx, not QAQC, in every guide and script outside the Smartsheet column names', () => {
    const lines = guideNames(folder).flatMap((name) =>
      readFileSync(join(REPO_ROOT, folder, name), 'utf8').split('\n').map((line) => `${name}: ${line}`),
    )
    expect(unexpectedQaqc(lines)).toEqual([])
  })
})
