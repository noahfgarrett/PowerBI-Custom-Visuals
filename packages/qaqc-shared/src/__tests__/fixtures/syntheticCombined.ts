import { COMBINED_COLUMNS } from './combinedRows'

type CombinedColumnName = (typeof COMBINED_COLUMNS)[number]

const COLUMN_COUNT = COMBINED_COLUMNS.length

function position(name: CombinedColumnName): number {
  return COMBINED_COLUMNS.indexOf(name)
}

const SOURCE = position('Source')
const ROW_ID = position('Row ID')
const WORK_WEEK = position('Work Week')
const PHASE = position('Inspection Phase')
const ISSUE = position('Issue')
const BUILDING = position('Building')
const QCR = position('QCR/FE')
const WELDER = position('Welder')
const TAG_NO = position('Tag No')
const SIGNATURE = position('Signature')
const SIGNED_WEEK = position('Work Week Signed')
const ID = position('ID')
const STATUS = position('Status')
const TYPE = position('Type')
const CREATED_ON = position('Created On')
const UPDATED_ON = position('Updated On')
const CREATED_BY = position('Created By')

/** Cumulative shares of the rows: about 12% Electrical, 6% Mechanical, 73% Welding and 9% BIM. */
const SOURCE_SHARES: ReadonlyArray<readonly [string, number]> = [
  ['Electrical', 0.12],
  ['Mechanical', 0.18],
  ['Welding', 0.91],
  ['BIM', 1],
] as const

const PHASES = ['Final', 'Final', 'SOR', 'Final', 'SOR', 'N/A'] as const
const QCR_NOT_RECORDED = ['N/A', 'NA', ''] as const
const WELD_TAGS = ['BK1XX104XX-M006-FW-', 'F631M008XX-P118-FW-', 'P4-WR1XX003-1-IW-FW-', 'BATCH-PLANT-FW-'] as const
const ISSUE_STATUSES = ['Closed', 'Open', 'Closed', 'Pending', 'Closed', 'Void', 'Open', 'Closed'] as const
const ISSUE_TYPES = ['COR', 'COR', 'NCR', 'DWN', ' cor ', 'Inspection'] as const
/** The latest week the rows use, so none are in the future for today = 2026-10-15 (WW42'2026). */
const LAST_YEAR = 2026
const LAST_YEAR_WEEKS = 42
const FIRST_YEAR = 2021

/** A seeded linear congruential generator (Numerical Recipes constants), so every run gets the same rows. */
interface Random {
  next: () => number
}

function seededRandom(seed: number): Random {
  let state = seed >>> 0
  return {
    next(): number {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
      return state
    },
  }
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0')
}

function weekLabel(year: number, week: number): string {
  return `WW${pad(week, 2)}'${year}`
}

interface PickedWeek {
  year: number
  week: number
}

function pickWeek(random: Random): PickedWeek {
  const year = FIRST_YEAR + (random.next() % (LAST_YEAR - FIRST_YEAR + 1))
  const weekCount = year === LAST_YEAR ? LAST_YEAR_WEEKS : 52
  return { year, week: 1 + (random.next() % weekCount) }
}

function sourceAt(position: number, count: number): string {
  const share = (position + 0.5) / count
  for (const [source, upTo] of SOURCE_SHARES) {
    if (share < upTo) return source
  }
  return 'BIM'
}

function inspectionRow(row: unknown[], random: Random): void {
  const { year, week } = pickWeek(random)
  row[WORK_WEEK] = weekLabel(year, week)
  row[PHASE] = PHASES[random.next() % PHASES.length]
  row[ISSUE] = random.next() % 25 === 0 ? 'NCR - cable damaged' : 'No Issue Found'
  row[BUILDING] = `B${random.next() % 40}`
  row[QCR] = random.next() % 15 === 0
    ? QCR_NOT_RECORDED[random.next() % QCR_NOT_RECORDED.length]
    : `QCR ${pad(1 + (random.next() % 30), 2)}`
}

function welderName(random: Random): string {
  return `Welder ${pad(1 + (random.next() % 120), 3)}`
}

function weldingRow(row: unknown[], random: Random, serial: number): void {
  const { year, week } = pickWeek(random)
  row[WORK_WEEK] = weekLabel(year, week)
  row[WELDER] = random.next() % 10 === 0 ? `${welderName(random)}, ${welderName(random)}` : welderName(random)
  row[TAG_NO] = `${WELD_TAGS[random.next() % WELD_TAGS.length]}${serial}`
  const isSigned = random.next() % 5 < 3
  row[SIGNATURE] = isSigned ? 'signed' : null
  const signedWeek = Math.min(week + (random.next() % 3), year === LAST_YEAR ? LAST_YEAR_WEEKS : 52)
  row[SIGNED_WEEK] = isSigned ? weekLabel(year, signedWeek) : null
  row[ISSUE] = random.next() % 50 === 0 ? `BIM #${serial}` : 'No'
}

function monthDayYear(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
}

/** About 2,100 days from 2021-01-04, so created dates run from January 2021 to early October 2026. */
const ISSUE_DAY_SPAN = 2_100

function bimRow(row: unknown[], random: Random, serial: number, days: string[]): void {
  const status = ISSUE_STATUSES[random.next() % ISSUE_STATUSES.length]
  const createdDay = random.next() % ISSUE_DAY_SPAN
  row[ID] = `#${serial}`
  row[STATUS] = status
  row[TYPE] = ISSUE_TYPES[random.next() % ISSUE_TYPES.length]
  row[CREATED_ON] = days[createdDay]
  row[UPDATED_ON] = status === 'Closed' ? days[createdDay + (random.next() % 40)] : null
  row[CREATED_BY] = random.next() % 20 === 0 ? 'Other Contractor' : 'LotusWorks'
}

/**
 * QAQC Combined rows in `COMBINED_COLUMNS` order with mixed sources (about 12% Electrical, 6% Mechanical,
 * 73% Welding and 9% BIM) in a seeded shuffled order. Columns that don't apply to a row's source are null.
 * Weeks and dates run from 2021 to WW42'2026. Row IDs are 1-based in the final order.
 */
export function syntheticCombinedRows(count: number, seed = 1): unknown[][] {
  const random = seededRandom(seed)
  const days: string[] = []
  for (let offset = 0; offset < ISSUE_DAY_SPAN + 40; offset += 1) days.push(monthDayYear(new Date(2021, 0, 4 + offset)))

  const rows: unknown[][] = []
  for (let serial = 0; serial < count; serial += 1) {
    const row: unknown[] = new Array<unknown>(COLUMN_COUNT).fill(null)
    const source = sourceAt(serial, count)
    row[SOURCE] = source
    if (source === 'Electrical' || source === 'Mechanical') inspectionRow(row, random)
    else if (source === 'Welding') weldingRow(row, random, serial)
    else bimRow(row, random, serial, days)
    rows.push(row)
  }

  for (let last = rows.length - 1; last > 0; last -= 1) {
    const swap = random.next() % (last + 1)
    const item = rows[last]
    rows[last] = rows[swap]
    rows[swap] = item
  }
  rows.forEach((row, rowIndex) => {
    row[ROW_ID] = rowIndex + 1
  })
  return rows
}
