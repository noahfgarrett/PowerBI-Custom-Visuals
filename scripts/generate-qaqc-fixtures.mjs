#!/usr/bin/env node
// Writes the QA/QC test fixtures in packages/qaqc-shared/src/__tests__/fixtures from a fixed seed.
//
// Every value is made up: buildings, contractors, companies, titles, tags, inspectors and welders are fictional.
// The fixtures keep the column layout and the quirks of the inspection logs and issue exports the visuals read
// (spelling variants, blank and "N/A" cells, free-text answers, migrated BIM 360 dates as M/D/YY h:mm AM/PM text),
// so the tests run the same code paths a real report would.
//
//   node scripts/generate-qaqc-fixtures.mjs
//
// The output is deterministic: running it twice writes the same files.

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'qaqc-shared', 'src', '__tests__', 'fixtures')
const SEED = 20261015

// ---------------------------------------------------------------------------------------------------------------
// Random numbers

const TWO_TO_32 = 2 ** 32

/** A linear congruential generator (Numerical Recipes constants), so every run gets the same rows. */
function seededRandom(seed) {
  let state = seed >>> 0
  const next = () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / TWO_TO_32
  }
  const below = (count) => Math.floor(next() * count)
  return {
    next,
    below,
    chance: (p) => next() < p,
    pick: (items) => items[below(items.length)],
    between: (low, high) => low + below(high - low + 1),
    shuffle(items) {
      for (let i = items.length - 1; i > 0; i -= 1) {
        const j = below(i + 1)
        ;[items[i], items[j]] = [items[j], items[i]]
      }
      return items
    },
    /** One entry of [value, weight] pairs, chosen in proportion to its weight. */
    weighted(pairs) {
      const total = pairs.reduce((sum, [, weight]) => sum + weight, 0)
      let roll = next() * total
      for (const [value, weight] of pairs) {
        roll -= weight
        if (roll < 0) return value
      }
      return pairs[pairs.length - 1][0]
    },
  }
}

const random = seededRandom(SEED)

/** Every value repeated by its count, shuffled: a column with exactly these counts in a random order. */
function bag(pairs) {
  const items = []
  for (const [value, count] of pairs) for (let i = 0; i < count; i += 1) items.push(value)
  return random.shuffle(items)
}

function total(pairs) {
  return pairs.reduce((sum, [, count]) => sum + count, 0)
}

// ---------------------------------------------------------------------------------------------------------------
// Dates and ISO work weeks

const DAY = 86_400_000

function utc(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day))
}

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY)
}

function isoWeekMonday(year, week) {
  const jan4 = utc(year, 1, 4)
  return addDays(jan4, -((jan4.getUTCDay() + 6) % 7) + (week - 1) * 7)
}

function isoWeekOf(date) {
  const thursday = addDays(date, 3 - ((date.getUTCDay() + 6) % 7))
  const year = thursday.getUTCFullYear()
  const week = 1 + Math.round((thursday.getTime() - isoWeekMonday(year, 1).getTime() - 3 * DAY) / (7 * DAY))
  return { year, week }
}

function weekLabel({ year, week }) {
  return `WW${String(week).padStart(2, '0')}'${year}`
}

/** The weeks from `first` to `last`, inclusive, as { year, week }. */
function weeksBetween(first, last) {
  const weeks = []
  for (let monday = isoWeekMonday(first.year, first.week); monday <= isoWeekMonday(last.year, last.week); monday = addDays(monday, 7)) {
    weeks.push(isoWeekOf(monday))
  }
  return weeks
}

/** M/D/YYYY, as the exports write a date. */
function mdy(date) {
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()}`
}

/** M/D/YY h:mm AM/PM, as the BIM 360 columns of the enriched export write a date and time. */
function mdyTime(date, minutesIntoDay) {
  const hours24 = Math.floor(minutesIntoDay / 60)
  const minutes = minutesIntoDay % 60
  const hours12 = ((hours24 + 11) % 12) + 1
  const suffix = hours24 < 12 ? 'AM' : 'PM'
  const year = String(date.getUTCFullYear() % 100).padStart(2, '0')
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${year} ${hours12}:${String(minutes).padStart(2, '0')} ${suffix}`
}

function minDate(a, b) {
  return a < b ? a : b
}

/** A date from `first` to `last`, inclusive, skewed toward `last` when `skew` > 1. */
function dateBetween(first, last, skew = 1) {
  const span = Math.round((last.getTime() - first.getTime()) / DAY)
  return addDays(first, Math.round(span * Math.pow(random.next(), 1 / skew)))
}

/** Weekdays only: inspections and issues are logged on site days. */
function weekday(date) {
  const day = date.getUTCDay()
  return day === 6 ? addDays(date, -1) : day === 0 ? addDays(date, 1) : date
}

// ---------------------------------------------------------------------------------------------------------------
// Fictional site vocabulary

const FIRST_WEEK = { year: 2025, week: 51 }
const LAST_WEEK = { year: 2026, week: 42 }
/** Site shutdown over the holidays: no inspections are logged in these weeks. */
const HOLIDAY_WEEKS = new Set(["WW52'2025", "WW01'2026"])

const GENERAL_CONTRACTOR = 'Bayside'
const SECOND_CONTRACTOR = 'Greyfox'
const GAS_VENDOR = 'Larch'
const TRANSFER_CONTRACTOR = `To Be Transferred to ${GENERAL_CONTRACTOR}`

/** Inspection buildings and areas. F63.1 and F63.2 are the two halves of the main building; the weld tags write them F631 and F632. */
const ELECTRICAL_BUILDINGS = [
  ['F63.2', 187], ['F63.1', 46], ['WR1-AMW', 9], ['IWW Pump Station', 7], ['PS1', 6], ['WR1', 5], ['BK1', 4], ['OA1', 4],
  ['OAC', 4], ['Batch plant', 2], [null, 2], ['Utility Easement', 1], ['AU1', 1], ['LUNCH TENT 4', 1], ['ASU', 1],
  ['UGC3', 1], ['F632', 1], ['Substation', 1], ['YARD 2001', 1], ['SS2', 1], ['DC2', 1], ['FWPH', 1], ['DC1', 1],
]
const MECHANICAL_BUILDINGS = [
  ['F63.2', 23], ['F63.1', 22], ['BK1', 20], ['WR1', 14], ['PS1', 12], ['IWW Pump Station', 12], ['OAC', 11],
  ['Laydown Yard', 3], ['OA1', 2], ['Fire water pump house', 2], [null, 2], ['IWW', 1], ['Easment', 1],
  ['Orange lot laydown', 1], ['Off-site Warehouse', 1], ['South Laydown', 1], ['Green lot Laydown', 1], ['Gas Yard', 1],
  ['Fire water Pump House', 1], ['WR1-Cooling Yard', 1], ['Off-site warehouse', 1], ['Warehouse 5', 1],
  ['Fire pump house', 1], ['Sanitary Line', 1], ['Off-Site Warehouse', 1], ['DC1', 1],
]
const ELECTRICAL_PHASES = [['Final', 238], ['SOR', 48], ['N/A', 2]]
const MECHANICAL_PHASES = [['SOR', 91], ['Final', 44], ['Pressure Test', 1], ['Borescope', 1], ['Reciept Inspection', 1]]
const ELECTRICAL_ISSUES = [['No Issue Found', 280], ['COR', 6], ['NCR', 1], ['LOOSE LUG NEEDS RETORQUE', 1]]
const MECHANICAL_ISSUES = [
  ['No Issue Found', 122], ['Yes but not COR', 5], ['COR', 4], [null, 3], ['Tracking', 1], ['Gouge in pipe', 1],
  ['Discuss', 1], ['Yes no Cor', 1],
]

const FLUID_CODES = [
  ['AW', 276], ['IW', 141], ['FL', 101], ['CHWS', 83], ['MCHWS', 63], ['TW', 62], ['CWS', 61], ['CWR', 61], ['HRWS', 60],
  ['DW', 53], ['CHWR', 53], ['SHWS', 53], ['HRWR', 40], ['AMW', 40], ['IWW', 39], ['MCHWR', 33], ['GW', 31], ['RW', 30],
  ['SWS', 27], ['HFW', 22], ['CUS', 20], ['PAW', 20], ['SHWR', 20], ['NG', 20], ['V', 19], ['LPCWR', 19], ['PCWR', 18],
  ['SD', 17], ['SCW', 17], ['GS', 17], ['CRW', 17], ['DOW', 15], ['SAW', 15], ['OS', 15], ['SAN', 14], ['NAOH', 14],
  ['SCWS', 13], ['RAR', 13], ['PV', 13], ['VENT', 12], ['BW', 11], ['IPA', 11], ['UPWS', 10], ['CW', 9], ['LPCWS', 8],
  ['PCWS', 7], ['SG', 6], ['NAHC', 6], ['AV', 5], ['HWR', 4], ['OA', 4], ['TF', 3], ['CIP', 3], ['PA', 3], ['MCW', 2],
  ['HWS', 1], ['SW', 1],
]
const PIPE_SPECS = [
  ['A1A', 557], ['PCH', 341], ['B_MDW', 163], ['J1A', 104], ['MQW', 97], ['PCHA', 91], ['MCF', 53], ['MDW', 48],
  ['QCH', 45], ['PCHF', 40], ['K1A', 33], ['D1A', 32], ['MCV', 20], ['M2W', 19], ['K2A', 18], ['O1U', 18], ['PVC', 17],
  ['N1W', 16], ['B_PAQ', 8], ['M3W', 8], ['3AV', 6], ['J1B', 4], ['B_MQW', 4], ['I1C', 3], ['A1B', 2], ['O2C', 2], ['NG', 2],
]
/** Weld tag families. The building is read from the tag; YARD and BATCH tags carry none and land in Site General. */
const WELD_TAG_FAMILIES = [['F631', 739], ['BK1', 467], ['WR1', 301], ['YARD', 132], ['PHT', 54], ['PS1', 40], ['F632', 14], ['BATCH', 4]]
/** ISSUE CREATED? answers other than blank: BIM numbers, free text and the explicit "no". */
const WELD_ISSUE_ANSWERS = [
  'Reported', 'Reported', 'EF 2nd burn', 'EF 2nd burn', 'EF 2nd Burn', 'Failed Cor #987', 'Failed Cor #988', 'Cor-1001',
  '#1006', 'yes', 'Yes 1050', 'no',
]

const ROOT_CAUSES = [
  ['Installation', 300], ['Quality', 273], ['Incomplete Work', 81], ['Casting/Pouring/Erection', 65], ['Materials', 57],
  ['Coordination', 55], ['Excavation/Earthworks', 28], ['Housekeeping', 25], ['Trade Damage', 22], ['Constructability', 16],
  ['Workmanship', 15], ['Observation', 13], ['Communication', 13], [null, 10], ['Other', 10], ['Bonding', 9],
  ['Equipment', 7], ['Weather', 7], ['Documentation Incomplete', 7], ['Management - Lack of coordination', 7],
  ['Documentation Conflict', 6], ['Design Coordination', 5], ['Design Deficiency', 5], ['Planning', 4],
  ['Code Compliance', 4], ['Design Change', 4], ['Human - Human error', 3], ['Fusion', 3], ['Manufacturer Defect', 3],
  ['Shop Fabrication', 3], ['Welding', 3], ['Human - Lack of coordination', 3], ['Rigging', 2], ['Mechanical Jointing', 2],
  ['Material - Material component failure', 2], ['Design Flaw', 2], ['Inadequate Training', 1],
  ['Management - Lack of procedure', 1], ['Natural Disaster', 1],
]
const LOG_ROOT_CAUSES = [
  ['Installation', 53], ['Coordination', 29], ['Incomplete Work', 24], ['Casting/Pouring/Erection', 19], ['Trade Damage', 10],
  ['Housekeeping', 9], ['Quality', 6], ['Bonding', 5], ['Excavation/Earthworks', 5], ['Workmanship', 5],
  ['Documentation Incomplete', 5], ['Constructability', 4], ['Code Compliance', 4], ['Observation', 3], ['Fusion', 3],
  ['Materials', 3], ['Other', 2], ['Mechanical Jointing', 2], ['Documentation Conflict', 2], ['Design Deficiency', 2],
  ['Equipment', 1], ['Design Coordination', 1], ['Weather', 1], ['Rigging', 1], ['Manufacturer Defect', 1], ['Planning', 1],
  ['Material - Material component failure', 1], ['Shop Fabrication', 1], ['Design Change', 1],
]
/** Root Cause Category for the issue log's causes; the rest are Quality. */
const CATEGORY_OF_CAUSE = new Map([
  ['Design Deficiency', 'Design'], ['Design Coordination', 'Design'], ['Design Change', 'Design'],
  ['Documentation Conflict', 'Design'], ['Constructability', 'Coordination'], ['Planning', 'Coordination'],
  ['Rigging', 'Safety'],
])
const ISSUE_TYPES = [
  ['COR', 859], ['FIF', 136], ['NCR', 60], ['Coordination', 5], ['Observation', 4], ['Commissioning', 3], ['SOR', 3],
  ['Work to Complete', 2], ['Audit', 1], ['Critical COR', 1], ['Inspection', 1], ['Quality', 1], ['Design', 1],
]
const ENRICHED_CONTRACTORS = [[GENERAL_CONTRACTOR, 727], [SECOND_CONTRACTOR, 273], [TRANSFER_CONTRACTOR, 36], [GAS_VENDOR, 25], [null, 16]]
const ENRICHED_COMPANIES = [
  ['Ivory - QA', 515], ['Ivory - Ops', 260], ['Ivory', 240], [SECOND_CONTRACTOR, 23], [GENERAL_CONTRACTOR, 22], [null, 13],
  [GAS_VENDOR, 4],
]

const TITLE_PLACES = ['F63.1', 'F63.2', 'F631', 'F632', 'BK1', 'WR1', 'PS1', 'OAC', 'OA1', 'UGC3', 'IWW Pump Station', 'Laydown Yard']
const TITLE_PROBLEMS = [
  'Missing Grounding Plate', 'Damaged Anchor Hole', 'Clear Cover Issues', 'Pipe Support Spacing', 'Loose Conduit Fittings',
  'Corroded Unistrut', 'Valve Covers Missing', 'Insufficient Column Grout Fill', 'Damaged Manhole Grout',
  'Tracer Wire Wrong Colour', 'Improper Lap Splice', 'Exposed Pipe Insulation', 'Duct Bank Spacer Deficiency',
  'Fire Stopping Incomplete', 'Cable Tray Bonding', 'Equipment Label Missing', 'Weld Porosity', 'Flange Bolt Torque',
  'Concrete Honeycombing', 'Rebar Chair Spacing', 'Silt Fence Damaged', 'Chiller Inlet Covers Insufficient',
  'Nitrogen Purge Evidence', 'Pipe Bonding Deficiency', 'Trench Drain QC Requirements', 'HDPE Hi-Low Noncompliance',
  'Butterfly Valve Internals Exposed', 'Gouge in Piping', 'Spillway Matting Deficiency', 'Handrail Toe Board Missing',
  'Hanger Rod Not Plumb', 'Seismic Brace Missing', 'Conduit Seal Missing', 'Expansion Joint Damage', 'Coating Holidays',
]
const ADMIN_TITLES = ['Drawing and Package Naming Conventions', 'Distribution List Update', 'Kickoff Meeting Schedule', 'Audit', 'Test']

function issueTitle(form = random.below(5)) {
  const place = random.pick(TITLE_PLACES)
  const problem = random.pick(TITLE_PROBLEMS)
  if (form === 0) return `${problem} in ${place}`
  if (form === 1) return `${place}- ${problem}`
  if (form === 2) return `${problem.charAt(0)}${problem.slice(1).toLowerCase()} at ${place}.`
  return `${place} - ${problem}`
}

// ---------------------------------------------------------------------------------------------------------------
// Inspection logs

const INSPECTION_WEEKS = weeksBetween(FIRST_WEEK, LAST_WEEK).filter((week) => !HOLIDAY_WEEKS.has(weekLabel(week)))

/** `count` week labels in date order, more of them later in the window, as the site got busier. */
function spreadOverWeeks(count, weeks, ramp) {
  const weights = weeks.map((_, position) => 1 + (ramp * position) / weeks.length)
  const chosen = []
  for (let i = 0; i < count; i += 1) chosen.push(random.weighted(weights.map((weight, position) => [position, weight])))
  // Every week in the window gets at least one row, so no week reads as missing data.
  weeks.forEach((_, position) => {
    if (position < count) chosen[position] = position
  })
  return chosen.sort((a, b) => a - b).map((position) => weekLabel(weeks[position]))
}

/** A row out of order now and then, as rows added later to a log are. */
function nudge(rows, every) {
  for (let i = every; i < rows.length - 1; i += every) [rows[i], rows[i + 1]] = [rows[i + 1], rows[i]]
  return rows
}

function inspectionRows(weeks, phases, issues, buildings, ramp) {
  const count = total(phases)
  if (total(issues) !== count || total(buildings) !== count) throw new Error('inspection columns disagree on the row count')
  const labels = spreadOverWeeks(count, weeks, ramp)
  const phaseBag = bag(phases)
  const issueBag = bag(issues)
  const buildingBag = bag(buildings)
  return nudge(labels.map((label, i) => [label, phaseBag[i], issueBag[i], buildingBag[i]]), 37)
}

const electrical = inspectionRows(INSPECTION_WEEKS, ELECTRICAL_PHASES, ELECTRICAL_ISSUES, ELECTRICAL_BUILDINGS, 1.5)
const mechanical = inspectionRows(
  INSPECTION_WEEKS.filter((week) => week.year === 2026),
  MECHANICAL_PHASES,
  MECHANICAL_ISSUES,
  MECHANICAL_BUILDINGS,
  0.5,
)

// ---------------------------------------------------------------------------------------------------------------
// Weld sign-offs

function digits(count) {
  let text = ''
  for (let i = 0; i < count; i += 1) text += String(random.below(10))
  return text
}

function weldTag(family) {
  const run = String(random.between(1, 12)).padStart(2, '0')
  switch (family) {
    case 'F631':
    case 'F632':
      return random.chance(0.7)
        ? `${family}M0${digits(2)}XX-P1${digits(2)}-FW-${run}`
        : `P4-${family}L00${random.between(1, 4)}-1-SAN-1${digits(5)}-SB0${digits(2)}`
    case 'BK1':
    case 'PS1':
      return `${family}XX10${random.between(1, 6)}XX-M0${digits(2)}-B1.1${digits(5)}-200-0${digits(3)}-FW-${run}`
    case 'WR1':
      return `P4-WR1XX00${random.between(1, 6)}-1-${random.pick(['IW', 'AMW', 'GW', 'TW'])}-FW${digits(3)}`
    case 'YARD':
      return `P4-YARD2001-${random.between(1, 9)}-DW-1${digits(5)}-FW0${digits(2)}`
    case 'PHT':
      return `PHT-F631M00${random.between(1, 9)}XX-1${digits(3)}`
    default:
      return `BATCH-PLANT-FW-${random.between(1, 20)}${random.pick(['', 'A', 'B'])}`
  }
}

const WELD_WEEKS = weeksBetween(FIRST_WEEK, LAST_WEEK)
const LAST_WEEK_POSITION = WELD_WEEKS.length - 1

const welding = (() => {
  const count = total(WELD_TAG_FAMILIES)
  const weekPositions = spreadOverWeeks(count, WELD_WEEKS, 2).map((label) => WELD_WEEKS.findIndex((week) => weekLabel(week) === label))
  const fluidBag = bag(FLUID_CODES)
  const specBag = bag(PIPE_SPECS)
  const familyBag = bag(WELD_TAG_FAMILIES)
  const issueAt = new Map(random.shuffle([...Array(count).keys()]).slice(0, WELD_ISSUE_ANSWERS.length).map((row, i) => [row, WELD_ISSUE_ANSWERS[i]]))
  return weekPositions.map((position, i) => {
    const age = LAST_WEEK_POSITION - position
    const isSigned = random.chance(age > 4 ? 0.68 : 0.3)
    const signedPosition = Math.min(position + random.below(4), LAST_WEEK_POSITION)
    return [
      weekLabel(WELD_WEEKS[position]),
      isSigned ? 'signed' : null,
      isSigned ? weekLabel(WELD_WEEKS[signedPosition]) : null,
      issueAt.get(i) ?? null,
      fluidBag[i],
      specBag[i],
      weldTag(familyBag[i]),
    ]
  })
})()

// ---------------------------------------------------------------------------------------------------------------
// BIM Issues Log (the older Smartsheet log): 208 issues, all opened by the QA/QC team except five

/** IDs the tests name: the four newest have a blank creator and contractor, #920 is a voided test issue. */
const LOG_BLANK_CREATOR_IDS = [1024, 1023, 1022, 1021]
const LOG_VOID_TEST_ID = 920
const LOG_FIRST_ID = 367
const LOG_FIRST_DAY = utc(2024, 11, 14)
const LOG_LAST_DAY = utc(2026, 8, 3)

const issueLog = (() => {
  const fixed = new Set([...LOG_BLANK_CREATOR_IDS, LOG_VOID_TEST_ID, LOG_FIRST_ID, 1020, 839])
  const pool = []
  for (let id = LOG_FIRST_ID + 1; id < 1020; id += 1) if (!fixed.has(id)) pool.push(id)
  const ids = [...fixed, ...random.shuffle(pool).slice(0, 208 - fixed.size)].sort((a, b) => b - a)

  // The four blank-creator issues are Open and #920 is Void, so the bag holds the rest of 126 Closed, 47 Open and 27 Void.
  const statuses = bag([['Closed', 126], ['Open', 43], ['Void', 26], ['Not approved', 6]])
  const types = bag([['COR', 202], ['NCR', 5], ['Inspection', 1]])
  const causes = bag([...LOG_ROOT_CAUSES, [null, ids.length - total(LOG_ROOT_CAUSES)]])
  const span = LOG_LAST_DAY.getTime() - LOG_FIRST_DAY.getTime()
  let free = 0

  return ids.map((id, position) => {
    const share = (id - LOG_FIRST_ID) / (1024 - LOG_FIRST_ID)
    const created = weekday(new Date(LOG_FIRST_DAY.getTime() + Math.round((share * span) / DAY) * DAY))
    const isBlankCreator = LOG_BLANK_CREATOR_IDS.includes(id)
    if (isBlankCreator) {
      return [`#${id}`, issueTitle(), 'Open', 'COR', null, mdy(id === 1021 ? utc(2026, 7, 30) : LOG_LAST_DAY), null, mdy(addDays(created, random.between(3, 30))), '', null, null]
    }
    if (id === LOG_VOID_TEST_ID) {
      return [`#${id}`, 'Test', 'Void', 'COR', TRANSFER_CONTRACTOR, mdy(created), 'No', mdy(addDays(created, 5)), '', 'Coordination', 'Quality']
    }
    let status
    if (id === 1020) status = 'Ready to Inspect'
    else if (id === 839) status = 'Ready to inspect'
    else {
      status = statuses[free]
      free += 1
    }
    const type = id === 1020 ? 'COR' : types[position]
    const cause = id === 1020 ? 'Equipment' : causes[position]
    const contractor = share < 0.55 ? SECOND_CONTRACTOR : share < 0.75 ? random.weighted([[TRANSFER_CONTRACTOR, 3], [SECOND_CONTRACTOR, 1]]) : GENERAL_CONTRACTOR
    const updated = minDate(addDays(created, random.between(0, 90)), utc(2026, 7, 28))
    const due = id === 1008 ? utc(2028, 7, 28) : addDays(created, random.between(4, 30))
    return [
      `#${id}`,
      issueTitle(),
      status,
      type,
      contractor,
      mdy(created),
      mdy(updated),
      mdy(due),
      'LotusWorks',
      cause,
      cause === null ? null : CATEGORY_OF_CAUSE.get(cause) ?? 'Quality',
    ]
  })
})()

// ---------------------------------------------------------------------------------------------------------------
// Enriched Autodesk export: 1,077 issues, most migrated from BIM 360 on 7/24/2026

const MIGRATION_DAY = utc(2026, 7, 24)
const MIGRATION_CLOSED_AT = utc(2026, 7, 25)
const BIM360_FIRST_DAY = utc(2022, 3, 6)
const LAST_UPDATE_DAY = utc(2026, 10, 19)

/**
 * [Created by, BIM360_Created By, has BIM360 created, has BIM360 closed, has Closed at, Status] and how many rows have
 * that shape. A migrated issue has BIM 360 values; an issue opened after the migration has none.
 */
const ENRICHED_SHAPES = [
  [['Other', 'Other', true, true, true, 'Closed'], 804],
  [['Other', 'LotusWorks', true, true, true, 'Closed'], 152],
  [['Other', 'LotusWorks', true, false, false, 'Open'], 26],
  [['Other', null, false, false, true, 'Closed'], 19],
  [['LotusWorks', null, false, false, true, 'Closed'], 13],
  [['Other', 'Other', true, false, true, 'Closed'], 9],
  [['Other', 'LotusWorks', true, false, false, 'Pending'], 6],
  [['Other', 'LotusWorks', true, false, true, 'Closed'], 6],
  [['Other', 'LotusWorks', true, false, false, 'Not approved'], 6],
  [['LotusWorks', null, false, false, false, 'Open'], 5],
  [['Other', null, false, false, false, 'Open'], 4],
  [['LotusWorks', 'LotusWorks', true, false, true, 'Closed'], 4],
  [['Other', 'LotusWorks', true, false, false, 'In progress'], 4],
  [['Other', null, false, false, false, 'Pending'], 3],
  [['Other', null, false, false, true, 'Closed'], 3],
  [['LotusWorks', null, false, false, false, 'In progress'], 3],
  [['LotusWorks', null, false, false, false, 'Pending'], 2],
  [['LotusWorks', 'LotusWorks', true, false, false, 'Pending'], 2],
  [['Other', 'Other', true, false, false, 'Draft'], 2],
  [['Other', null, false, false, false, 'Draft'], 1],
  [['Other', 'Other', true, false, false, 'Pending'], 1],
  [['Other', 'LotusWorks', true, true, true, 'Pending'], 1],
  [['Other', 'LotusWorks', true, false, false, 'Draft'], 1],
]
/** Numbers the export skips, as deleted issues leave gaps. */
const ENRICHED_LAST_ID = 1088
/** Migrated BIM 360 creation dates written as dates rather than text, as a few cells in the export are. */
const BIM360_DATE_CELLS = 6

const enriched = (() => {
  const shapes = bag(ENRICHED_SHAPES)
  const count = shapes.length
  const skipped = new Set(random.shuffle([...Array(ENRICHED_LAST_ID - 1).keys()].map((i) => i + 2)).slice(0, ENRICHED_LAST_ID - count))
  const ids = []
  for (let id = 1; id <= ENRICHED_LAST_ID; id += 1) if (!skipped.has(id)) ids.push(id)
  // Migrated issues take the older numbers, so issue numbers rise with the creation date.
  const migrated = shapes.filter((shape) => shape[2])
  const native = shapes.filter((shape) => !shape[2])
  const ordered = [...migrated, ...native]

  const types = bag(ISSUE_TYPES)
  const contractors = bag(ENRICHED_CONTRACTORS)
  const companies = bag(ENRICHED_COMPANIES)
  const causes = bag(ROOT_CAUSES)
  const legacySpan = MIGRATION_DAY.getTime() - BIM360_FIRST_DAY.getTime()
  let legacyDateCells = 0
  // Issue numbers rise with the creation date, so the issues opened after the migration get their dates in order.
  const nativeDays = native.map(() => weekday(dateBetween(MIGRATION_DAY, utc(2026, 10, 15), 1.3))).sort((a, b) => a - b)

  const rows = ordered.map(([createdBy, legacyCreatedBy, hasLegacyCreated, hasLegacyClosed, hasClosedAt, status], i) => {
    const id = ids[i]
    let createdOn
    let legacyCreated = null
    let legacyClosed = null
    let closedAt = null
    if (hasLegacyCreated) {
      // Older numbers were opened earlier; the curve keeps most of them in the last two years.
      const share = Math.pow(i / migrated.length, 0.6)
      const isDateCell = legacyDateCells < BIM360_DATE_CELLS && i >= migrated.length - BIM360_DATE_CELLS
      // The newest migrated issues were opened in BIM 360 the week after the cut-over and carry a date, not a time.
      const opened = isDateCell
        ? weekday(addDays(utc(2026, 7, 27), legacyDateCells))
        : weekday(new Date(BIM360_FIRST_DAY.getTime() + Math.round((share * legacySpan) / DAY - 1) * DAY))
      const minutes = random.between(6 * 60, 23 * 60 + 59)
      if (isDateCell) legacyDateCells += 1
      legacyCreated = isDateCell ? mdy(opened) : mdyTime(opened, minutes)
      createdOn = isDateCell ? addDays(opened, 1) : MIGRATION_DAY
      if (hasLegacyClosed) {
        const closed = minDate(addDays(opened, random.between(2, 160)), addDays(MIGRATION_DAY, -1))
        legacyClosed = mdyTime(closed, random.between(6 * 60, 23 * 60 + 59))
      }
      if (hasClosedAt) closedAt = hasLegacyClosed ? MIGRATION_CLOSED_AT : dateBetween(MIGRATION_CLOSED_AT, LAST_UPDATE_DAY)
    } else {
      createdOn = nativeDays[i - migrated.length]
      if (hasClosedAt) closedAt = minDate(addDays(createdOn, random.between(1, 40)), LAST_UPDATE_DAY)
    }
    const updatedOn = closedAt !== null
      ? minDate(addDays(closedAt, random.between(0, 30)), LAST_UPDATE_DAY)
      : dateBetween(maxDate(createdOn, utc(2026, 7, 31)), LAST_UPDATE_DAY)
    const type = types[i]
    const isAdmin = type === 'Coordination' || type === 'Work to Complete' || type === 'Audit'
    const dueBase = legacyCreated !== null && !isDateCellText(legacyCreated) ? parseLegacy(legacyCreated) : createdOn
    const due = random.chance(0.005) ? null : addDays(dueBase, random.between(3, 30))
    return [
      `#${id}`,
      isAdmin ? random.pick(ADMIN_TITLES) : issueTitle(),
      status,
      type,
      isAdmin ? null : contractors[i],
      mdy(createdOn),
      mdy(updatedOn),
      due === null ? null : mdy(due),
      createdBy,
      isAdmin ? null : causes[i],
      legacyCreatedBy,
      legacyCreated,
      legacyClosed,
      closedAt === null ? null : mdy(closedAt),
      companies[i],
    ]
  })
  // The export lists the newest issue first.
  return rows.reverse()
})()

function maxDate(a, b) {
  return a > b ? a : b
}

function isDateCellText(text) {
  return !text.includes(' ')
}

function parseLegacy(text) {
  const [month, day, year] = text.split(' ')[0].split('/').map(Number)
  return utc(2000 + year, month, day)
}

// ---------------------------------------------------------------------------------------------------------------
// QCx Combined: the four sources appended, with inspectors and welders

const QCR_NAMES = [
  ['QCR 01', 95], ['QCR 02', 71], ['QCR 03', 39], ['QCR 04', 31], ['QCR 05', 15], ['QCR 06', 15], ['QCR 07', 6],
  ['QCR 08', 5], ['QCR 09', 3], ['QCR 10', 3], ['QCR 11', 2], ['QCR 12', 2], ['QCR 13', 2], ['QCR 14', 2], ['QCR 15', 1],
  ['QCR 16', 1], ['QCR 17', 1], ['N/A', 32], ['NA', 30],
]
const WELDER_COUNT = 62

function welderName(number) {
  return `Welder ${String(number).padStart(3, '0')}`
}

/** One welder, the busiest more often than the rest. */
function someWelder() {
  return welderName(1 + Math.floor(WELDER_COUNT * Math.pow(random.next(), 1.8)))
}

function welderCell() {
  const roll = random.next()
  if (roll < 0.004) return 'N/A'
  if (roll < 0.86) return someWelder()
  const first = someWelder()
  let second = someWelder()
  while (second === first) second = someWelder()
  if (roll < 0.997) return `${first},${second}`
  let third = someWelder()
  while (third === first || third === second) third = someWelder()
  return `${first},${second},${third}`
}

const COMBINED_COLUMNS = [
  'Source', 'Row ID', 'Work Week', 'Inspection Phase', 'Issue', 'Building', 'QCR/FE', 'Welder', 'Tag No', 'Signature',
  'Work Week Signed', 'ID', 'Status', 'Type', 'Created On', 'Updated On', 'Created By', 'Root Cause', 'BIM360 Created By',
  'BIM360 Created On', 'BIM360 Closed On', 'Closed At',
]

const combined = (() => {
  const inspectionCount = electrical.length + mechanical.length
  const qcrBag = bag([...QCR_NAMES, [null, inspectionCount - total(QCR_NAMES)]])
  const rows = []
  const blank = () => new Array(COMBINED_COLUMNS.length).fill(null)
  const set = (row, name, value) => {
    row[COMBINED_COLUMNS.indexOf(name)] = value
  }
  const append = (source, fill) => {
    const row = blank()
    set(row, 'Source', source)
    set(row, 'Row ID', rows.length + 1)
    fill(row)
    rows.push(row)
  }
  for (const [label, phase, issue, building] of electrical) {
    append('Electrical', (row) => {
      set(row, 'Work Week', label)
      set(row, 'Inspection Phase', phase)
      set(row, 'Issue', issue)
      set(row, 'Building', building)
      set(row, 'QCR/FE', qcrBag[rows.length])
    })
  }
  for (const [label, phase, issue, building] of mechanical) {
    append('Mechanical', (row) => {
      set(row, 'Work Week', label)
      set(row, 'Inspection Phase', phase)
      set(row, 'Issue', issue)
      set(row, 'Building', building)
      set(row, 'QCR/FE', qcrBag[rows.length])
    })
  }
  const unrecordedWelder = random.below(welding.length)
  welding.forEach(([label, signature, signedWeek, issue, , , tagNo], i) => {
    append('Welding', (row) => {
      set(row, 'Work Week', label)
      set(row, 'Issue', issue)
      set(row, 'Welder', i === unrecordedWelder ? null : welderCell())
      set(row, 'Tag No', tagNo)
      set(row, 'Signature', signature)
      set(row, 'Work Week Signed', signedWeek)
    })
  })
  for (const [id, , status, type, , createdOn, updatedOn, , createdBy, rootCause] of issueLog) {
    append('BIM', (row) => {
      set(row, 'ID', id)
      set(row, 'Status', status)
      set(row, 'Type', type)
      set(row, 'Created On', createdOn)
      set(row, 'Updated On', updatedOn)
      set(row, 'Created By', createdBy)
      set(row, 'Root Cause', rootCause)
    })
  }
  return rows
})()

// ---------------------------------------------------------------------------------------------------------------
// Sanity checks: nothing is dated after the export, and the shapes match what the tests expect

function checkNotAfterExport(text, where) {
  if (text === null) return
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(text)
  if (!match) return
  const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3])
  const date = utc(year, Number(match[1]), Number(match[2]))
  if (date > utc(2026, 10, 19) && !where.startsWith('due')) throw new Error(`${where} ${text} is after the export`)
}
for (const row of enriched) [5, 6, 11, 12, 13].forEach((i) => checkNotAfterExport(row[i], `enriched ${row[0]} col ${i}`))
for (const row of issueLog) [5, 6].forEach((i) => checkNotAfterExport(row[i], `log ${row[0]} col ${i}`))
if (issueLog.length !== 208 || enriched.length !== 1077 || welding.length !== 1751) throw new Error('row counts changed')

// ---------------------------------------------------------------------------------------------------------------
// Output

function literal(value) {
  if (value === null) return 'null'
  if (typeof value === 'number') return String(value)
  return value.includes("'") ? JSON.stringify(value) : `'${value.replace(/\\/g, '\\\\')}'`
}

function rowsBlock(rows) {
  return rows.map((row) => `  [${row.map(literal).join(', ')}],`).join('\n')
}

function columnsBlock(columns) {
  return columns.map((column) => `  ${literal(column)},`).join('\n')
}

const HEADER = '// Generated by scripts/generate-qaqc-fixtures.mjs. Synthetic data: every name, tag and title is made up.'

function write(file, text) {
  writeFileSync(join(OUT, file), `${text.trimEnd()}\n`)
  console.log(`wrote ${file}`)
}

write('electricalRows.ts', `${HEADER}
// Electrical inspection log, ${electrical.length} rows. Columns: Work Week Observed, Inspection Phase, Issue?, Building.
export const ELECTRICAL_ROWS: ReadonlyArray<ReadonlyArray<string | null>> = [
${rowsBlock(electrical)}
]`)

write('mechanicalRows.ts', `${HEADER}
// Mechanical/process inspection log, ${mechanical.length} rows. Columns: Work Week Observed, Inspection Phase, Issue?, Building.
export const MECHANICAL_ROWS: ReadonlyArray<ReadonlyArray<string | null>> = [
${rowsBlock(mechanical)}
]`)

write('weldingRows.ts', `${HEADER}
// Weld inspection sign-offs, ${welding.length} rows.
// Columns: Weld Work Week, Signature, Work Week Signed, Issue Created?, Fluid Code, Pipe Spec, Tag No.
// A signed weld's Signature is 'signed'.
export const WELDING_ROWS: ReadonlyArray<ReadonlyArray<string | null>> = [
${rowsBlock(welding)}
]`)

write('issueRows.ts', `${HEADER}
// BIM Issues Log, ${issueLog.length} issues, newest first.
// Columns: ID, Title, Status, Type, Contractor, Created On, Updated On, Due Date, Created By, Root Cause, Root Cause Category.
// Created By is 'LotusWorks' for an issue the QA/QC team opened and '' otherwise.
export const ISSUE_ROWS: ReadonlyArray<ReadonlyArray<string | null>> = [
${rowsBlock(issueLog)}
]`)

write('enrichedIssueRows.ts', `${HEADER}
// Enriched Autodesk issue export, ${enriched.length.toLocaleString('en-US')} issues, newest first. Most were migrated from BIM 360 on 7/24/2026.
// Columns: ID, Title, Status, Type, Contractor, Created on, Updated on, Due date, Created by, Root cause,
// BIM360_Created By, BIM360_Created On, BIM360_Closed On, Closed at, Created By (Company).
// Created by and BIM360_Created By are 'LotusWorks' for the QA/QC team and 'Other' otherwise; a blank BIM360 creator
// stays blank (null), because a blank BIM360 creator decides which include rule applies. Dates are M/D/YYYY text,
// except the BIM360 dates, which are M/D/YY h:mm AM/PM text so parsing gets tested (a few are M/D/YYYY).
export const ENRICHED_ISSUE_COLUMNS = [
${columnsBlock(['ID', 'Title', 'Status', 'Type', 'Contractor', 'Created on', 'Updated on', 'Due date', 'Created by', 'Root cause', 'BIM360_Created By', 'BIM360_Created On', 'BIM360_Closed On', 'Closed at', 'Created By (Company)'])}
] as const

export const ENRICHED_ISSUE_ROWS: ReadonlyArray<ReadonlyArray<string | null>> = [
${rowsBlock(enriched)}
]`)

write('combinedRows.ts', `${HEADER}
// The QCx Combined schema: the Electrical, Mechanical, Welding and BIM fixtures appended in that order, with a 1-based
// Row ID after the append. Inspectors are QCR 01…, welders Welder 001…; a weld can list several, comma-separated.
// Not recorded values (blank, N/A, NA) are kept. BIM rows come from the BIM Issues Log fixture; the four enrichment
// columns appended last (BIM360 Created By, BIM360 Created On, BIM360 Closed On, Closed At) are null on every row.
export const COMBINED_COLUMNS = [
${columnsBlock(COMBINED_COLUMNS)}
] as const

export const COMBINED_ROWS: ReadonlyArray<ReadonlyArray<string | number | null>> = [
${rowsBlock(combined)}
]`)
