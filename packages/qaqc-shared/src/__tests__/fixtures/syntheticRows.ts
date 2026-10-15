const PHASES = ['Final', 'SOR', 'Final', 'N/A'] as const
const ISSUES = ['No Issue Found', 'No Issue Found', 'No Issue Found', 'NCR'] as const

/** Inspection rows spread across WW01–WW52 of 2021–2026 and `buildingCount` buildings. */
export function syntheticInspectionRows(count: number, buildingCount = 40): string[][] {
  const rows: string[][] = []
  for (let i = 0; i < count; i += 1) {
    const year = 2021 + (i % 6)
    const week = (i % 52) + 1
    rows.push([
      `WW${String(week).padStart(2, '0')}'${year}`,
      PHASES[i % 4],
      ISSUES[Math.floor(i / 4) % 4],
      `B${i % buildingCount}`,
    ])
  }
  return rows
}

const WELD_SYSTEMS = ['AW', 'IW', 'FL', 'CHWS', 'CWR', 'SHWS', 'TMXW', 'MCHWS'] as const
const WELD_SPECS = ['PCH', 'QCH', 'MDW', 'PCHA'] as const
const WELD_TAGS = ['BK1XX104XX-M006-FW-', 'F631M008XX-P118-FW-', 'P4-WR1XX003-1-IW-FW-', 'BATCH-PLANT-FW-'] as const

/**
 * Weld rows spread across WW01–WW52 of 2021–2026: [weld week, signature, signed week, issue, system, spec, tag no].
 * About half are signed (the signed week follows the weld week) and one in twenty has an issue.
 */
export function syntheticWeldRows(count: number, systemCount = 56): Array<Array<string | null>> {
  const rows: Array<Array<string | null>> = []
  for (let i = 0; i < count; i += 1) {
    const year = 2021 + (i % 6)
    const week = (i % 52) + 1
    const isSigned = i % 2 === 0
    const signedWeek = Math.min(week + (i % 3), 52)
    rows.push([
      `WW${String(week).padStart(2, '0')}'${year}`,
      isSigned ? 'signed' : null,
      isSigned ? `WW${String(signedWeek).padStart(2, '0')}'${year}` : null,
      i % 20 === 0 ? `BIM ${i}` : null,
      i % 5 === 0 ? `S${i % systemCount}` : WELD_SYSTEMS[i % WELD_SYSTEMS.length],
      WELD_SPECS[i % 4],
      `${WELD_TAGS[i % 4]}${i}`,
    ])
  }
  return rows
}

const ISSUE_STATUSES = ['Closed', 'Open', 'Closed', 'Not approved', 'Closed', 'Void', 'Pending', 'Closed'] as const
const ISSUE_TYPES = ['COR', 'NCR', 'SOR', 'Observation'] as const
const ISSUE_CONTRACTORS = ['Bayside', 'Mapleford', 'Redstone', ''] as const
const ISSUE_DISCIPLINES = ['Mechanical', 'Electrical', 'Civil', 'Welding', ''] as const
// About 2,100 days from WW01'2021, so created dates run from January 2021 to October 2026.
const ISSUE_DAY_SPAN = 2_100

function monthDayYear(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
}

/**
 * BIM issue rows with M/D/YYYY dates from January 2021 to October 2026: [id, title, status, type, contractor,
 * discipline, created on, updated on, due date, created by]. One in eight is void and one in twenty has a
 * non-LotusWorks creator. Closed issues close up to 40 days after they open.
 */
export function syntheticIssueRows(count: number): Array<Array<string | null>> {
  const days: string[] = []
  for (let offset = 0; offset < ISSUE_DAY_SPAN + 60; offset += 1) days.push(monthDayYear(new Date(2021, 0, 4 + offset)))
  const rows: Array<Array<string | null>> = []
  for (let i = 0; i < count; i += 1) {
    const created = i % ISSUE_DAY_SPAN
    rows.push([
      `#${i}`,
      `Issue ${i}`,
      ISSUE_STATUSES[i % ISSUE_STATUSES.length],
      ISSUE_TYPES[i % ISSUE_TYPES.length],
      ISSUE_CONTRACTORS[i % ISSUE_CONTRACTORS.length],
      ISSUE_DISCIPLINES[i % ISSUE_DISCIPLINES.length],
      days[created],
      i % 3 === 0 ? null : days[created + (i % 41)],
      days[created + 14],
      i % 20 === 0 ? 'Bayside' : 'Jane Doe (LotusWorks)',
    ])
  }
  return rows
}
