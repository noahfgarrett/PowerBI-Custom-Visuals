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
