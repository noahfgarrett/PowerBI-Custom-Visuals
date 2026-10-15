# QAQC Electrical Inspections Visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `packages/qaqc-shared` (work-week math, inspection rules, theme, React charts) and `packages/qaqc-electrical` (the Electrical Inspections `.pbiviz`), matching the QAQC HTML app's look, then package it into `LotusWorks_Package/`.

**Architecture:** `qaqc-shared` is plain TypeScript + React with no Power BI dependency, so everything is unit-tested in Vitest/jsdom. Rows are aggregated once per data update into a per-week index; all interactions recompute from the index only. `qaqc-electrical/src/visual.ts` is a thin Power BI adapter: it reads the table data view by role, builds the index, resolves the theme, and renders `<ElectricalDashboard>` with React 19.

**Tech Stack:** TypeScript 5 (strict), React 19.2.7, react-dom 19.2.7, lucide-react 1.24.0, powerbi-visuals-tools 5.6.0 (`pbiviz`), powerbi-visuals-api 5.3.0, powerbi-visuals-utils-formattingmodel 6.x, Vitest 3 + jsdom, Vite (dev preview only), Less.

**Spec:** `docs/superpowers/specs/2026-10-15-qaqc-electrical-visual-design.md`

**Branch:** `feat/qaqc-electrical` (already created, based on `chore/visual-package-updates`).

---

## Conventions every task follows

- Run all commands from the repo root `/Users/noahgarrett/Codebase/PowerBI` unless a step says otherwise.
- Imports: external packages, then internal (`../../qaqc-shared/src/...`), then relative; blank line between groups.
- No `any`. Every function declares its return type. Components return `ReactElement` or `ReactElement | null` (React 19 types have no global `JSX` namespace).
- UI copy never uses em dashes (DESIGN.md ban). Use `n/a`, `·`, or `−` (U+2212 minus) instead.
- `powerbi-visuals-api` has **no runtime enum objects**. Never read `powerbi.VisualUpdateType.X` or `powerbi.visuals.ValidatorType.X` at runtime. Use numeric constants with a comment (TypeScript accepts the matching numeric literal for the const enum types; this was verified).
- Test files import `describe/it/expect/vi` from `vitest` explicitly.
- Commit after each task with a conventional message ending in:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```

## Release-gate facts (from `scripts/review-business-package.mjs`)

The review gate reads **`src/visual.ts`**, **`src/settings.ts`**, `capabilities.json`, `pbiviz.json`, and requires `src/__tests__/visual.test.ts`. Zero warnings means:

- `package.json` version `1.0.0` ↔ `pbiviz.json` `visual.version` `1.0.0.0`.
- `pbiviz.json` registers `stringResources/en-US/resources.resjson`; `supportUrl` and `gitHubUrl` are HTTPS.
- `capabilities.objects` contains `cardSettings` (with a `backgroundColor` property), `animationSettings`, and an object whose name contains `accessibility`. Every object, property, data role, and enumeration item has `displayName` + `displayNameKey` (and `description` + `descriptionKey` where a description exists).
- `settings.ts` contains `class CardStyleSettings` and `animationSettings =`.
- `visual.ts` contains: `createSelectionManager`, `allowInteractions`, `showContextMenu`, `keydown`, `aria-label`, `isHighContrast`, `notifyRenderingStarted`, `notifyRenderingFinished`, `notifyRenderingFailed`, `renderEmptyState`, `tooltipService`.
- `capabilities.json`: `supportsEmptyDataView: true`, `tooltips.supportEnhancedTooltips: true`, a `dataReductionAlgorithm`, and at most one role with `min >= 1` per mapping condition (so all field slots use `max: 1` only; required-slot validation happens in code).

## File structure

```
tsconfig.base.json                                   modify: add "jsx": "react-jsx"
packages/qaqc-shared/
  package.json, tsconfig.json, vitest.config.ts
  src/types.ts                 WorkWeek, rows, index, view state, model types
  src/workWeeks.ts             ISO work-week parsing and stepping
  src/inspections.ts           row rules, buildInspectionIndex, buildInspectionModel
  src/footnotes.ts             footnote strings from the index
  src/format.ts                count, percent, delta formatting
  src/chartMath.ts             niceScale, label thinning, bar paths, pass-rate domain
  src/chartTypes.ts            ChartColors, TooltipRequest
  src/theme.ts                 presets, fixed status colors, resolveTheme
  src/qaqc.less                all visual styles
  src/hooks/useElementSize.ts  rAF-throttled ResizeObserver
  src/components/              KpiCard, KpiGroup, WorkWeekPicker, RangeToggle, ChartPanel,
                               StackedBarChart, LineChart, HorizontalBarChart,
                               StatusPanel, LoadingBar, Footnotes
  src/__tests__/               setup.ts, render.tsx, fixtures/, *.test.ts(x)
packages/qaqc-electrical/
  package.json, pbiviz.json, tsconfig.json, vitest.config.ts, capabilities.json
  stringResources/en-US/resources.resjson
  assets/icon.png              generated by scripts/make-icon.mjs
  scripts/ensure-api.cjs, scripts/make-icon.mjs
  style/visual.less            imports ../../qaqc-shared/src/qaqc.less
  src/settings.ts              Format pane model
  src/dataView.ts              table data view → rows + column positions
  src/ElectricalDashboard.tsx  layout and state
  src/visual.ts                Power BI adapter
  src/__tests__/               settings, dataView, ElectricalDashboard, visual tests
  dev/                         Vite preview harness
LotusWorks_Package/QAQC_Electrical_SETUP.md
```

---

### Task 1: Scaffold `qaqc-shared` and enable JSX

**Files:**
- Modify: `tsconfig.base.json`
- Create: `packages/qaqc-shared/package.json`, `packages/qaqc-shared/tsconfig.json`, `packages/qaqc-shared/vitest.config.ts`
- Create: `packages/qaqc-shared/src/__tests__/setup.ts`, `packages/qaqc-shared/src/__tests__/render.tsx`
- Test: `packages/qaqc-shared/src/__tests__/smoke.test.tsx`

- [ ] **Step 1: Add JSX to the base tsconfig**

In `tsconfig.base.json`, add `"jsx": "react-jsx",` directly after the `"lib"` line, so `compilerOptions` begins:

```json
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
```

- [ ] **Step 2: Create `packages/qaqc-shared/package.json`**

```json
{
  "name": "@pbi/qaqc-shared",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "lucide-react": "1.24.0",
    "react": "19.2.7",
    "react-dom": "19.2.7"
  },
  "devDependencies": {
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    "typescript": "^5.3.3"
  }
}
```

- [ ] **Step 3: Create `packages/qaqc-shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "./dist", "jsx": "react-jsx" },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

- [ ] **Step 4: Create `packages/qaqc-shared/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'qaqc-shared',
    environment: 'jsdom',
    css: false,
    setupFiles: ['../core/src/__test-utils__/setup.ts', './src/__tests__/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
```

- [ ] **Step 5: Create the React test setup `packages/qaqc-shared/src/__tests__/setup.ts`**

```ts
declare global {
  // React reads this flag to allow act() in tests.
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

export {}
```

- [ ] **Step 6: Create the render helper `packages/qaqc-shared/src/__tests__/render.tsx`**

```tsx
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'

export interface Rendered {
  container: HTMLDivElement
  rerender: (node: ReactNode) => void
  unmount: () => void
}

export function render(node: ReactNode): Rendered {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)
  act(() => {
    root.render(node)
  })
  return {
    container,
    rerender(next: ReactNode): void {
      act(() => {
        root.render(next)
      })
    },
    unmount(): void {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}
```

- [ ] **Step 7: Write the smoke test `packages/qaqc-shared/src/__tests__/smoke.test.tsx`**

```tsx
import { describe, expect, it } from 'vitest'

import { render } from './render'

describe('test harness', () => {
  it('renders React components into jsdom', () => {
    const view = render(<p className="probe">ready</p>)
    expect(view.container.querySelector('.probe')?.textContent).toBe('ready')
    view.unmount()
  })
})
```

- [ ] **Step 8: Install dependencies and review the lockfile**

Run: `npm install`
Then run: `git diff package-lock.json | grep -E '^\+\s+"node_modules/[^"]+": \{' `
Expected: only these new entries (some may already exist and not appear): `node_modules/react`, `node_modules/react-dom`, `node_modules/scheduler`, `node_modules/lucide-react`, `node_modules/@types/react`, `node_modules/@types/react-dom`, `node_modules/csstype`, plus the workspace link `node_modules/@pbi/qaqc-shared`. No other new packages.
Then run: `git diff package-lock.json | grep -n '"hasInstallScript"'`
Expected: no output.

- [ ] **Step 9: Run the smoke test**

Run: `npx vitest run --project qaqc-shared`
Expected: PASS, 1 test.

- [ ] **Step 10: Run the repo typecheck**

Run: `npm run typecheck`
Expected: exit 0, no errors.

- [ ] **Step 11: Commit**

```bash
git add tsconfig.base.json package-lock.json packages/qaqc-shared
git commit -m "chore: scaffold qaqc-shared package with React test harness

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Shared types and ISO work weeks

**Files:**
- Create: `packages/qaqc-shared/src/types.ts`
- Create: `packages/qaqc-shared/src/workWeeks.ts`
- Test: `packages/qaqc-shared/src/__tests__/workWeeks.test.ts`

- [ ] **Step 1: Create `packages/qaqc-shared/src/types.ts`**

```ts
export interface WorkWeek {
  week: number
  year: number
  /** year * 100 + week. Sorts chronologically. */
  key: number
  /** WW42'2026 */
  label: string
}

export type InspectionPhase = 'final' | 'sor' | 'other'

/** Column positions of each field slot inside a table row. */
export interface InspectionColumns {
  workWeek: number
  phase: number
  issue: number
  building: number
}

export type InspectionRows = ReadonlyArray<ReadonlyArray<unknown>>

export interface WeekCounts {
  week: WorkWeek
  finals: number
  sors: number
  /** Final inspections with an issue found. SORs never count. */
  issuesFound: number
}

export interface BuildingTally {
  finals: number
  sors: number
}

export interface InspectionIndex {
  currentWeek: WorkWeek
  /** Continuous weeks from the first week with data through the current week. */
  weeks: WeekCounts[]
  /** Parallel to weeks: running totals through each week. */
  cumulativeFinals: number[]
  cumulativeSors: number[]
  cumulativeIssues: number[]
  /** Parallel to weeks: building → tally for that week. */
  buildingsByWeek: Array<Map<string, BuildingTally>>
  positionByKey: Map<number, number>
  totalRows: number
  skippedRows: number
  futureRows: number
}

export type RangeMode = 'recent' | 'all'

export interface ViewState {
  selectedKey: number
  windowEndKey: number
  range: RangeMode
}

export interface DeltaMetric {
  value: number
  delta: number
}

export interface PassRatePoint {
  week: WorkWeek
  /** Percent 0–100, or null when no Finals exist through this week. */
  rate: number | null
  cleanFinals: number
  totalFinals: number
  hadIssue: boolean
}

export interface BuildingBar {
  building: string
  finals: number
  sors: number
}

export interface OtherBuildings {
  count: number
  finals: number
  sors: number
}

export interface InspectionModel {
  selectedWeek: WorkWeek
  previousWeek: WorkWeek
  /** Newest first. */
  weekOptions: WorkWeek[]
  thisWeek: {
    finals: DeltaMetric
    sors: DeltaMetric
    issuesFound: DeltaMetric
  }
  toDate: {
    finals: number
    sors: number
    finalsThisWeek: number
    sorsThisWeek: number
    cleanFinals: number
    passRate: number | null
    passRateDeltaPoints: number | null
  }
  window: WeekCounts[]
  passRateTrend: PassRatePoint[]
  buildings: BuildingBar[]
  otherBuildings: OtherBuildings | null
  hasData: boolean
}
```

- [ ] **Step 2: Write the failing test `packages/qaqc-shared/src/__tests__/workWeeks.test.ts`**

```ts
import { describe, expect, it } from 'vitest'

import {
  enumerateWorkWeeks,
  makeWorkWeek,
  nextWorkWeek,
  parseWorkWeek,
  previousWorkWeek,
  shortWeekLabel,
  toIsoWorkWeek,
  weeksInIsoYear,
} from '../workWeeks'

describe('parseWorkWeek', () => {
  it('parses the Smartsheet label format', () => {
    expect(parseWorkWeek("WW42'2026")).toEqual(makeWorkWeek(2026, 42))
  })

  it('accepts spacing, dashes, word prefixes, curly quotes, and two-digit years', () => {
    expect(parseWorkWeek('WW 7 - 2026')?.label).toBe("WW07'2026")
    expect(parseWorkWeek('Week 42 2026')?.label).toBe("WW42'2026")
    expect(parseWorkWeek("ww42'26")?.label).toBe("WW42'2026")
    expect(parseWorkWeek('  WW42’2026  ')?.label).toBe("WW42'2026")
  })

  it('accepts week 53 only in 53-week ISO years', () => {
    expect(parseWorkWeek("WW53'2026")?.key).toBe(202653)
    expect(parseWorkWeek("WW53'2025")).toBeNull()
  })

  it('rejects unreadable values', () => {
    for (const value of ['', 'UPW', 'WW102025', "WW00'2026", null, undefined, 42, {}]) {
      expect(parseWorkWeek(value)).toBeNull()
    }
  })

  it('converts Date values to their ISO week', () => {
    expect(parseWorkWeek(new Date(2026, 9, 15))?.label).toBe("WW42'2026")
  })
})

describe('ISO week math', () => {
  it('finds the ISO week of a date, including year edges', () => {
    expect(toIsoWorkWeek(new Date(2026, 9, 15)).label).toBe("WW42'2026")
    expect(toIsoWorkWeek(new Date(2027, 0, 1)).label).toBe("WW53'2026")
    expect(toIsoWorkWeek(new Date(2025, 11, 29)).label).toBe("WW01'2026")
  })

  it('knows which years have 53 weeks', () => {
    expect(weeksInIsoYear(2025)).toBe(52)
    expect(weeksInIsoYear(2026)).toBe(53)
  })

  it('steps across the 53-week year boundary', () => {
    expect(nextWorkWeek(makeWorkWeek(2026, 52)).label).toBe("WW53'2026")
    expect(nextWorkWeek(makeWorkWeek(2026, 53)).label).toBe("WW01'2027")
    expect(previousWorkWeek(makeWorkWeek(2027, 1)).label).toBe("WW53'2026")
    expect(previousWorkWeek(makeWorkWeek(2026, 1)).label).toBe("WW52'2025")
  })

  it('enumerates a continuous inclusive range', () => {
    const weeks = enumerateWorkWeeks(makeWorkWeek(2025, 51), makeWorkWeek(2026, 2))
    expect(weeks.map((week) => week.label)).toEqual(["WW51'2025", "WW52'2025", "WW01'2026", "WW02'2026"])
  })

  it('returns an empty range when start is after end', () => {
    expect(enumerateWorkWeeks(makeWorkWeek(2026, 3), makeWorkWeek(2026, 2))).toEqual([])
  })

  it('formats a short axis label', () => {
    expect(shortWeekLabel(makeWorkWeek(2026, 7))).toBe('WW07')
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run --project qaqc-shared workWeeks`
Expected: FAIL, cannot resolve `../workWeeks`.

- [ ] **Step 4: Implement `packages/qaqc-shared/src/workWeeks.ts`**

```ts
import type { WorkWeek } from './types'

const MS_PER_DAY = 86_400_000
// Smartsheet exports vary: WW42'2026, WW 42 - 2026, Week 42 2026, two-digit years.
const WORK_WEEK_PATTERN = /^(?:WW|WK|WEEK)?\s*(\d{1,2})\s*(?:['’/_,.\-]|\s)\s*(\d{2,4})$/i
const weeksPerYear = new Map<number, number>()

export function makeWorkWeek(year: number, week: number): WorkWeek {
  return {
    year,
    week,
    key: year * 100 + week,
    label: `WW${String(week).padStart(2, '0')}'${year}`,
  }
}

export function toIsoWorkWeek(date: Date): WorkWeek {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = utc.getUTCDay() || 7
  utc.setUTCDate(utc.getUTCDate() + 4 - day)
  const yearStart = Date.UTC(utc.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((utc.getTime() - yearStart) / MS_PER_DAY + 1) / 7)
  return makeWorkWeek(utc.getUTCFullYear(), week)
}

export function weeksInIsoYear(year: number): number {
  const cached = weeksPerYear.get(year)
  if (cached !== undefined) return cached
  // December 28 always falls in the last ISO week of its year.
  const count = toIsoWorkWeek(new Date(year, 11, 28)).week
  weeksPerYear.set(year, count)
  return count
}

export function parseWorkWeek(value: unknown): WorkWeek | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : toIsoWorkWeek(value)
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const match = String(value).trim().match(WORK_WEEK_PATTERN)
  if (!match) return null
  const week = Number(match[1])
  const rawYear = Number(match[2])
  const year = rawYear < 100 ? 2000 + rawYear : rawYear
  if (week < 1 || week > weeksInIsoYear(year)) return null
  return makeWorkWeek(year, week)
}

export function nextWorkWeek(week: WorkWeek): WorkWeek {
  return week.week < weeksInIsoYear(week.year)
    ? makeWorkWeek(week.year, week.week + 1)
    : makeWorkWeek(week.year + 1, 1)
}

export function previousWorkWeek(week: WorkWeek): WorkWeek {
  return week.week > 1
    ? makeWorkWeek(week.year, week.week - 1)
    : makeWorkWeek(week.year - 1, weeksInIsoYear(week.year - 1))
}

export function enumerateWorkWeeks(start: WorkWeek, end: WorkWeek): WorkWeek[] {
  const weeks: WorkWeek[] = []
  let cursor = start
  while (cursor.key <= end.key) {
    weeks.push(cursor)
    cursor = nextWorkWeek(cursor)
  }
  return weeks
}

export function shortWeekLabel(week: WorkWeek): string {
  return `WW${String(week.week).padStart(2, '0')}`
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run --project qaqc-shared workWeeks`
Expected: PASS, 11 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/qaqc-shared/src/types.ts packages/qaqc-shared/src/workWeeks.ts packages/qaqc-shared/src/__tests__/workWeeks.test.ts
git commit -m "feat: add QAQC shared types and ISO work-week math

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Inspection row rules

**Files:**
- Create: `packages/qaqc-shared/src/inspections.ts`
- Test: `packages/qaqc-shared/src/__tests__/inspectionRules.test.ts`

- [ ] **Step 1: Write the failing test `packages/qaqc-shared/src/__tests__/inspectionRules.test.ts`**

```ts
import { describe, expect, it } from 'vitest'

import { cellText, classifyPhase, isIssueFound, normalizeBuilding, UNSPECIFIED_BUILDING } from '../inspections'

describe('cellText', () => {
  it('trims strings and stringifies numbers and booleans', () => {
    expect(cellText('  F63.2 ')).toBe('F63.2')
    expect(cellText(42)).toBe('42')
    expect(cellText(true)).toBe('true')
  })

  it('returns an empty string for blanks and unsupported values', () => {
    expect(cellText(null)).toBe('')
    expect(cellText(undefined)).toBe('')
    expect(cellText({})).toBe('')
  })
})

describe('classifyPhase', () => {
  it('detects Finals regardless of case and spacing', () => {
    for (const value of ['Final', ' FINAL ', 'Final Inspection', 'final walk', 'Electrical final inspection']) {
      expect(classifyPhase(value)).toBe('final')
    }
  })

  it('detects SORs', () => {
    expect(classifyPhase('SOR')).toBe('sor')
    expect(classifyPhase(' sor ')).toBe('sor')
  })

  it('treats every other phase as other', () => {
    for (const value of ['N/A', '', null, 'Pressure Test', 'Finalized', 'Borescope']) {
      expect(classifyPhase(value)).toBe('other')
    }
  })
})

describe('isIssueFound', () => {
  it('counts any filled value except No Issue Found', () => {
    expect(isIssueFound('NCR')).toBe(true)
    expect(isIssueFound('GROUND TAIL NEEDS REMOVED')).toBe(true)
  })

  it('ignores No Issue Found and blanks', () => {
    expect(isIssueFound('No Issue Found')).toBe(false)
    expect(isIssueFound(' no issue found ')).toBe(false)
    expect(isIssueFound('')).toBe(false)
    expect(isIssueFound(null)).toBe(false)
  })
})

describe('normalizeBuilding', () => {
  it('trims names and labels blanks as Unspecified', () => {
    expect(normalizeBuilding(' F63.2 ')).toBe('F63.2')
    expect(normalizeBuilding('')).toBe(UNSPECIFIED_BUILDING)
    expect(normalizeBuilding(null)).toBe('Unspecified')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project qaqc-shared inspectionRules`
Expected: FAIL, cannot resolve `../inspections`.

- [ ] **Step 3: Implement the rules in `packages/qaqc-shared/src/inspections.ts`**

```ts
import type { InspectionPhase } from './types'

export const UNSPECIFIED_BUILDING = 'Unspecified'
const NO_ISSUE = 'no issue found'

export function cellText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

export function classifyPhase(value: unknown): InspectionPhase {
  const text = cellText(value).toLowerCase()
  if (!text) return 'other'
  if (text === 'final' || text.startsWith('final ') || text.includes('final inspection')) return 'final'
  if (text.includes('sor')) return 'sor'
  return 'other'
}

export function isIssueFound(value: unknown): boolean {
  const text = cellText(value).toLowerCase()
  return text !== '' && text !== NO_ISSUE
}

export function normalizeBuilding(value: unknown): string {
  return cellText(value) || UNSPECIFIED_BUILDING
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run --project qaqc-shared inspectionRules`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/qaqc-shared/src/inspections.ts packages/qaqc-shared/src/__tests__/inspectionRules.test.ts
git commit -m "feat: add Final, SOR, and issue rules for inspection rows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Build the per-week inspection index

**Files:**
- Modify: `packages/qaqc-shared/src/inspections.ts`
- Test: `packages/qaqc-shared/src/__tests__/inspectionIndex.test.ts`

- [ ] **Step 1: Write the failing test `packages/qaqc-shared/src/__tests__/inspectionIndex.test.ts`**

```ts
import { describe, expect, it } from 'vitest'

import { buildInspectionIndex } from '../inspections'

const COLUMNS = { workWeek: 0, phase: 1, issue: 2, building: 3 }
const TODAY = new Date(2026, 9, 15) // WW42'2026

const ROWS = [
  ["WW40'2026", 'Final', 'No Issue Found', 'F63.2'],
  ["WW40'2026", 'SOR', 'COR', 'F63.2'],
  ["WW42'2026", 'Final', 'NCR', 'F63.1'],
  ["WW42'2026", 'N/A', '', 'F63.1'],
  ['UPW', 'Final', '', 'F63.2'],
  ["WW44'2026", 'Final', '', 'F63.2'],
  [null, 'SOR', '', ''],
]

describe('buildInspectionIndex', () => {
  it('builds continuous weeks from the first data week through the current week', () => {
    const index = buildInspectionIndex(ROWS, COLUMNS, TODAY)
    expect(index.currentWeek.label).toBe("WW42'2026")
    expect(index.weeks.map((item) => item.week.label)).toEqual(["WW40'2026", "WW41'2026", "WW42'2026"])
  })

  it('counts Finals, SORs, and issues on Finals only', () => {
    const index = buildInspectionIndex(ROWS, COLUMNS, TODAY)
    expect(index.weeks.map(({ finals, sors, issuesFound }) => [finals, sors, issuesFound])).toEqual([
      [1, 1, 0],
      [0, 0, 0],
      [1, 0, 1],
    ])
  })

  it('keeps running totals parallel to the weeks', () => {
    const index = buildInspectionIndex(ROWS, COLUMNS, TODAY)
    expect(index.cumulativeFinals).toEqual([1, 1, 2])
    expect(index.cumulativeSors).toEqual([1, 1, 1])
    expect(index.cumulativeIssues).toEqual([0, 0, 1])
    expect(index.positionByKey.get(202641)).toBe(1)
  })

  it('tallies buildings per week for Finals and SORs', () => {
    const index = buildInspectionIndex(ROWS, COLUMNS, TODAY)
    expect(index.buildingsByWeek[0].get('F63.2')).toEqual({ finals: 1, sors: 1 })
    expect(index.buildingsByWeek[2].get('F63.1')).toEqual({ finals: 1, sors: 0 })
  })

  it('counts skipped and future rows separately', () => {
    const index = buildInspectionIndex(ROWS, COLUMNS, TODAY)
    expect(index.totalRows).toBe(7)
    expect(index.skippedRows).toBe(2)
    expect(index.futureRows).toBe(1)
  })

  it('reads Date cells as ISO weeks', () => {
    const index = buildInspectionIndex([[new Date(2026, 9, 13), 'Final', '', 'OAC']], COLUMNS, TODAY)
    expect(index.weeks.map((item) => item.finals)).toEqual([1])
  })

  it('returns only the current week, all zeros, when there are no rows', () => {
    const index = buildInspectionIndex([], COLUMNS, TODAY)
    expect(index.weeks).toHaveLength(1)
    expect(index.weeks[0]).toMatchObject({ finals: 0, sors: 0, issuesFound: 0 })
    expect(index.cumulativeFinals).toEqual([0])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project qaqc-shared inspectionIndex`
Expected: FAIL, `buildInspectionIndex` is not exported.

- [ ] **Step 3: Implement `buildInspectionIndex` in `packages/qaqc-shared/src/inspections.ts`**

Replace the first import line with:

```ts
import type {
  BuildingTally,
  InspectionColumns,
  InspectionIndex,
  InspectionPhase,
  InspectionRows,
  WeekCounts,
  WorkWeek,
} from './types'
import { enumerateWorkWeeks, parseWorkWeek, toIsoWorkWeek } from './workWeeks'
```

Append to the end of the file:

```ts
interface WeekBucket {
  finals: number
  sors: number
  issuesFound: number
  buildings: Map<string, BuildingTally>
}

// Work-week and phase text repeat heavily (a few hundred distinct values across
// hundreds of thousands of rows), so parsing is cached by the raw text.
function readWeek(value: unknown, cache: Map<string, WorkWeek | null>): WorkWeek | null {
  if (typeof value !== 'string' && typeof value !== 'number') return parseWorkWeek(value)
  const text = String(value)
  const cached = cache.get(text)
  if (cached !== undefined) return cached
  const parsed = parseWorkWeek(text)
  cache.set(text, parsed)
  return parsed
}

function readPhase(value: unknown, cache: Map<string, InspectionPhase>): InspectionPhase {
  if (typeof value !== 'string') return classifyPhase(value)
  const cached = cache.get(value)
  if (cached !== undefined) return cached
  const phase = classifyPhase(value)
  cache.set(value, phase)
  return phase
}

export function buildInspectionIndex(
  rows: InspectionRows,
  columns: InspectionColumns,
  today: Date,
): InspectionIndex {
  const currentWeek = toIsoWorkWeek(today)
  const weekCache = new Map<string, WorkWeek | null>()
  const phaseCache = new Map<string, InspectionPhase>()
  const buckets = new Map<number, WeekBucket>()
  let skippedRows = 0
  let futureRows = 0
  let firstWeek: WorkWeek | null = null

  for (const row of rows) {
    const week = readWeek(row[columns.workWeek], weekCache)
    if (!week) {
      skippedRows += 1
      continue
    }
    if (week.key > currentWeek.key) {
      futureRows += 1
      continue
    }
    if (!firstWeek || week.key < firstWeek.key) firstWeek = week

    const phase = readPhase(row[columns.phase], phaseCache)
    if (phase === 'other') continue

    let bucket = buckets.get(week.key)
    if (!bucket) {
      bucket = { finals: 0, sors: 0, issuesFound: 0, buildings: new Map() }
      buckets.set(week.key, bucket)
    }
    const building = normalizeBuilding(row[columns.building])
    let tally = bucket.buildings.get(building)
    if (!tally) {
      tally = { finals: 0, sors: 0 }
      bucket.buildings.set(building, tally)
    }
    if (phase === 'final') {
      bucket.finals += 1
      tally.finals += 1
      if (isIssueFound(row[columns.issue])) bucket.issuesFound += 1
    } else {
      bucket.sors += 1
      tally.sors += 1
    }
  }

  const weeks: WeekCounts[] = []
  const cumulativeFinals: number[] = []
  const cumulativeSors: number[] = []
  const cumulativeIssues: number[] = []
  const buildingsByWeek: Array<Map<string, BuildingTally>> = []
  const positionByKey = new Map<number, number>()
  let finals = 0
  let sors = 0
  let issues = 0

  for (const week of enumerateWorkWeeks(firstWeek ?? currentWeek, currentWeek)) {
    const bucket = buckets.get(week.key)
    const counts: WeekCounts = {
      week,
      finals: bucket?.finals ?? 0,
      sors: bucket?.sors ?? 0,
      issuesFound: bucket?.issuesFound ?? 0,
    }
    finals += counts.finals
    sors += counts.sors
    issues += counts.issuesFound
    positionByKey.set(week.key, weeks.length)
    weeks.push(counts)
    cumulativeFinals.push(finals)
    cumulativeSors.push(sors)
    cumulativeIssues.push(issues)
    buildingsByWeek.push(bucket?.buildings ?? new Map())
  }

  return {
    currentWeek,
    weeks,
    cumulativeFinals,
    cumulativeSors,
    cumulativeIssues,
    buildingsByWeek,
    positionByKey,
    totalRows: rows.length,
    skippedRows,
    futureRows,
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run --project qaqc-shared inspection`
Expected: PASS, 15 tests across `inspectionRules` and `inspectionIndex`.

- [ ] **Step 5: Commit**

```bash
git add packages/qaqc-shared/src/inspections.ts packages/qaqc-shared/src/__tests__/inspectionIndex.test.ts
git commit -m "feat: aggregate inspection rows into a per-week index

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Build the view model from the index

**Files:**
- Modify: `packages/qaqc-shared/src/inspections.ts`
- Test: `packages/qaqc-shared/src/__tests__/inspectionModel.test.ts`

- [ ] **Step 1: Write the failing test `packages/qaqc-shared/src/__tests__/inspectionModel.test.ts`**

```ts
import { describe, expect, it } from 'vitest'

import { buildInspectionIndex, buildInspectionModel, defaultViewState } from '../inspections'
import type { InspectionIndex, ViewState } from '../types'

const COLUMNS = { workWeek: 0, phase: 1, issue: 2, building: 3 }
const TODAY = new Date(2026, 9, 15) // WW42'2026

/** Weeks 1–42 of 2026: finals = week % 5 + 1, sors = week % 3, NCR on the first Final in weeks 10 and 40. */
function syntheticIndex(): InspectionIndex {
  const rows: string[][] = []
  for (let week = 1; week <= 42; week += 1) {
    const label = `WW${String(week).padStart(2, '0')}'2026`
    for (let i = 0; i < (week % 5) + 1; i += 1) {
      rows.push([label, 'Final', i === 0 && (week === 10 || week === 40) ? 'NCR' : 'No Issue Found', 'F63.2'])
    }
    for (let i = 0; i < week % 3; i += 1) rows.push([label, 'SOR', '', 'F63.1'])
  }
  return buildInspectionIndex(rows, COLUMNS, TODAY)
}

function view(index: InspectionIndex, overrides: Partial<ViewState>): ViewState {
  return { ...defaultViewState(index), ...overrides }
}

describe('buildInspectionModel', () => {
  it('defaults to the current week and a 30-week window', () => {
    const index = syntheticIndex()
    const model = buildInspectionModel(index, defaultViewState(index))
    expect(model.selectedWeek.label).toBe("WW42'2026")
    expect(model.window).toHaveLength(30)
    expect(model.window[0].week.label).toBe("WW13'2026")
  })

  it('shows every week in All mode', () => {
    const index = syntheticIndex()
    expect(buildInspectionModel(index, view(index, { range: 'all' })).window).toHaveLength(42)
  })

  it('starts the window at the first data week when history is short', () => {
    const index = syntheticIndex()
    const model = buildInspectionModel(index, view(index, { selectedKey: 202620, windowEndKey: 202620 }))
    expect(model.window.map((item) => item.week.label)).toHaveLength(20)
    expect(model.window[0].week.label).toBe("WW01'2026")
  })

  it('computes this-week values and deltas vs the previous week', () => {
    const index = syntheticIndex()
    const model = buildInspectionModel(index, view(index, { selectedKey: 202640 }))
    expect(model.thisWeek.finals).toEqual({ value: 1, delta: -4 })
    expect(model.thisWeek.sors).toEqual({ value: 1, delta: 1 })
    expect(model.thisWeek.issuesFound).toEqual({ value: 1, delta: 1 })
    expect(model.previousWeek.label).toBe("WW39'2026")
  })

  it('computes to-date totals and the NCR pass rate through the selected week', () => {
    const index = syntheticIndex()
    const model = buildInspectionModel(index, view(index, { selectedKey: 202640 }))
    expect(model.toDate.finals).toBe(120)
    expect(model.toDate.sors).toBe(40)
    expect(model.toDate.cleanFinals).toBe(118)
    expect(model.toDate.passRate).toBeCloseTo(98.333, 3)
    expect(model.toDate.passRateDeltaPoints).toBeCloseTo(-0.826, 3)
  })

  it('treats the week before the first data week as zero', () => {
    const index = syntheticIndex()
    const model = buildInspectionModel(index, view(index, { selectedKey: 202601 }))
    expect(model.thisWeek.finals).toEqual({ value: 2, delta: 2 })
    expect(model.toDate.passRateDeltaPoints).toBeNull()
  })

  it('falls back to the current week for an unknown selection', () => {
    const index = syntheticIndex()
    expect(buildInspectionModel(index, view(index, { selectedKey: 209901 })).selectedWeek.label).toBe("WW42'2026")
  })

  it('lists week options newest first', () => {
    const index = syntheticIndex()
    const options = buildInspectionModel(index, defaultViewState(index)).weekOptions
    expect(options[0].label).toBe("WW42'2026")
    expect(options[options.length - 1].label).toBe("WW01'2026")
  })

  it('builds a cumulative pass-rate trend that flags NCR weeks', () => {
    const index = syntheticIndex()
    const trend = buildInspectionModel(index, defaultViewState(index)).passRateTrend
    const ww40 = trend.find((point) => point.week.key === 202640)
    expect(ww40?.hadIssue).toBe(true)
    expect(ww40?.totalFinals).toBe(120)
    expect(trend.filter((point) => point.hadIssue)).toHaveLength(1)
  })

  it('ranks the top 8 buildings and groups the rest as Other', () => {
    const names = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet']
    const counts = [5, 4, 3, 3, 2, 2, 1, 1, 1, 1]
    const rows = names.flatMap((name, i) => Array.from({ length: counts[i] }, () => ["WW42'2026", 'Final', '', name]))
    const index = buildInspectionIndex(rows, COLUMNS, TODAY)
    const model = buildInspectionModel(index, defaultViewState(index))
    expect(model.buildings.map((bar) => bar.building)).toEqual(names.slice(0, 8))
    expect(model.otherBuildings).toEqual({ count: 2, finals: 2, sors: 0 })
  })

  it('reports no data for an empty index', () => {
    const index = buildInspectionIndex([], COLUMNS, TODAY)
    const model = buildInspectionModel(index, defaultViewState(index))
    expect(model.hasData).toBe(false)
    expect(model.toDate.passRate).toBeNull()
    expect(model.otherBuildings).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project qaqc-shared inspectionModel`
Expected: FAIL, `buildInspectionModel` is not exported.

- [ ] **Step 3: Implement the model in `packages/qaqc-shared/src/inspections.ts`**

Update the type import to also include `BuildingBar`, `DeltaMetric`, `InspectionModel`, `OtherBuildings`, `ViewState`, and the work-week import to also include `previousWorkWeek`:

```ts
import type {
  BuildingBar,
  BuildingTally,
  DeltaMetric,
  InspectionColumns,
  InspectionIndex,
  InspectionModel,
  InspectionPhase,
  InspectionRows,
  OtherBuildings,
  ViewState,
  WeekCounts,
  WorkWeek,
} from './types'
import { enumerateWorkWeeks, parseWorkWeek, previousWorkWeek, toIsoWorkWeek } from './workWeeks'
```

Add after `const NO_ISSUE = 'no issue found'`:

```ts
export const RECENT_WEEK_COUNT = 30
export const TOP_BUILDING_COUNT = 8
```

Append to the end of the file:

```ts
export function defaultViewState(index: InspectionIndex): ViewState {
  return { selectedKey: index.currentWeek.key, windowEndKey: index.currentWeek.key, range: 'recent' }
}

function deltaMetric(value: number, previous: number): DeltaMetric {
  return { value, delta: value - previous }
}

function passRateAt(index: InspectionIndex, position: number): number | null {
  if (position < 0) return null
  const finals = index.cumulativeFinals[position]
  if (finals === 0) return null
  return ((finals - index.cumulativeIssues[position]) / finals) * 100
}

function summarizeBuildings(
  index: InspectionIndex,
  start: number,
  end: number,
): { buildings: BuildingBar[]; otherBuildings: OtherBuildings | null } {
  const totals = new Map<string, BuildingTally>()
  for (let position = start; position <= end; position += 1) {
    for (const [building, tally] of index.buildingsByWeek[position]) {
      const total = totals.get(building) ?? { finals: 0, sors: 0 }
      total.finals += tally.finals
      total.sors += tally.sors
      totals.set(building, total)
    }
  }
  const ranked: BuildingBar[] = [...totals.entries()]
    .map(([building, tally]) => ({ building, finals: tally.finals, sors: tally.sors }))
    .sort((a, b) => b.finals + b.sors - (a.finals + a.sors) || a.building.localeCompare(b.building))
  const rest = ranked.slice(TOP_BUILDING_COUNT)
  return {
    buildings: ranked.slice(0, TOP_BUILDING_COUNT),
    otherBuildings: rest.length === 0
      ? null
      : {
          count: rest.length,
          finals: rest.reduce((sum, bar) => sum + bar.finals, 0),
          sors: rest.reduce((sum, bar) => sum + bar.sors, 0),
        },
  }
}

export function buildInspectionModel(index: InspectionIndex, view: ViewState): InspectionModel {
  const lastPosition = index.weeks.length - 1
  const selectedPosition = index.positionByKey.get(view.selectedKey) ?? lastPosition
  const endPosition = index.positionByKey.get(view.windowEndKey) ?? lastPosition
  const startPosition = view.range === 'all' ? 0 : Math.max(0, endPosition - RECENT_WEEK_COUNT + 1)
  const selected = index.weeks[selectedPosition]
  const previous = selectedPosition > 0 ? index.weeks[selectedPosition - 1] : null
  const finalsToDate = index.cumulativeFinals[selectedPosition]
  const passRate = passRateAt(index, selectedPosition)
  const previousPassRate = passRateAt(index, selectedPosition - 1)
  const window = index.weeks.slice(startPosition, endPosition + 1)
  const { buildings, otherBuildings } = summarizeBuildings(index, startPosition, endPosition)

  return {
    selectedWeek: selected.week,
    previousWeek: previousWorkWeek(selected.week),
    weekOptions: index.weeks.map((item) => item.week).reverse(),
    thisWeek: {
      finals: deltaMetric(selected.finals, previous?.finals ?? 0),
      sors: deltaMetric(selected.sors, previous?.sors ?? 0),
      issuesFound: deltaMetric(selected.issuesFound, previous?.issuesFound ?? 0),
    },
    toDate: {
      finals: finalsToDate,
      sors: index.cumulativeSors[selectedPosition],
      finalsThisWeek: selected.finals,
      sorsThisWeek: selected.sors,
      cleanFinals: finalsToDate - index.cumulativeIssues[selectedPosition],
      passRate,
      passRateDeltaPoints: passRate !== null && previousPassRate !== null ? passRate - previousPassRate : null,
    },
    window,
    passRateTrend: window.map((item, offset) => {
      const position = startPosition + offset
      const totalFinals = index.cumulativeFinals[position]
      return {
        week: item.week,
        rate: passRateAt(index, position),
        cleanFinals: totalFinals - index.cumulativeIssues[position],
        totalFinals,
        hadIssue: item.issuesFound > 0,
      }
    }),
    buildings,
    otherBuildings,
    hasData: index.totalRows - index.skippedRows - index.futureRows > 0,
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run --project qaqc-shared inspectionModel`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/qaqc-shared/src/inspections.ts packages/qaqc-shared/src/__tests__/inspectionModel.test.ts
git commit -m "feat: derive cards, chart window, pass-rate trend, and buildings from the index

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Real-export fixture test

**Files:**
- Create: `packages/qaqc-shared/src/__tests__/fixtures/electricalRows.ts` (generated)
- Test: `packages/qaqc-shared/src/__tests__/electricalFixture.test.ts`

- [ ] **Step 1: Generate the fixture from the export (4 columns, no personal data)**

Run:

```bash
mkdir -p packages/qaqc-shared/src/__tests__/fixtures
python3 -I -W ignore - "/Users/noahgarrett/Downloads/OneDrive_2026-10-14 (1)/Smartsheet Exports/Electrical_Inspection_Log.xlsx" packages/qaqc-shared/src/__tests__/fixtures/electricalRows.ts <<'EOF'
import json, sys, openpyxl
workbook = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)
rows = list(workbook.worksheets[0].iter_rows(values_only=True))
header = list(rows[0])
columns = [header.index(name) for name in ('Work Week Observed', 'Inspection Phase', 'Issue?', 'Building')]
data = []
for row in rows[1:]:
    if all(value is None for value in row):
        continue
    data.append([None if row[c] is None else str(row[c]) for c in columns])
with open(sys.argv[2], 'w') as handle:
    handle.write('// Generated from Electrical_Inspection_Log.xlsx (2026-10-14 export).\n')
    handle.write('// Columns: Work Week Observed, Inspection Phase, Issue?, Building. No personal data.\n')
    handle.write('export const ELECTRICAL_ROWS: ReadonlyArray<ReadonlyArray<string | null>> = ')
    handle.write(json.dumps(data, ensure_ascii=False))
    handle.write('\n')
print(len(data))
EOF
```

Expected output: `288`

- [ ] **Step 2: Write the test `packages/qaqc-shared/src/__tests__/electricalFixture.test.ts`**

```ts
import { describe, expect, it } from 'vitest'

import { buildInspectionIndex, buildInspectionModel, defaultViewState } from '../inspections'
import { ELECTRICAL_ROWS } from './fixtures/electricalRows'

const COLUMNS = { workWeek: 0, phase: 1, issue: 2, building: 3 }
const TODAY = new Date(2026, 9, 15) // WW42'2026
const index = buildInspectionIndex(ELECTRICAL_ROWS, COLUMNS, TODAY)

describe('Electrical export (2026-10-14)', () => {
  it('reads every row with no skipped or future weeks', () => {
    expect(index.totalRows).toBe(288)
    expect(index.skippedRows).toBe(0)
    expect(index.futureRows).toBe(0)
  })

  it('spans WW51\'2025 through WW42\'2026', () => {
    expect(index.weeks[0].week.label).toBe("WW51'2025")
    expect(index.weeks[index.weeks.length - 1].week.label).toBe("WW42'2026")
    expect(index.weeks).toHaveLength(44)
  })

  it('matches the WW42 cards', () => {
    const model = buildInspectionModel(index, defaultViewState(index))
    expect(model.thisWeek.finals).toEqual({ value: 3, delta: -3 })
    expect(model.thisWeek.sors).toEqual({ value: 3, delta: 0 })
    expect(model.thisWeek.issuesFound).toEqual({ value: 0, delta: 0 })
    expect(model.toDate.finals).toBe(238)
    expect(model.toDate.sors).toBe(48)
    expect(model.toDate.cleanFinals).toBe(236)
    expect(model.toDate.passRate).toBeCloseTo(99.16, 2)
    expect(model.toDate.passRateDeltaPoints).toBeCloseTo(0.0107, 4)
  })

  it('matches WW41 when it is selected', () => {
    const model = buildInspectionModel(index, { ...defaultViewState(index), selectedKey: 202641 })
    expect(model.thisWeek.finals.value).toBe(6)
    expect(model.thisWeek.sors.value).toBe(3)
    expect(model.toDate.finals).toBe(235)
  })

  it('uses WW13 through WW42 for the 30-week window and flags the two NCR weeks', () => {
    const model = buildInspectionModel(index, defaultViewState(index))
    expect(model.window[0].week.label).toBe("WW13'2026")
    expect(model.passRateTrend.filter((point) => point.hadIssue).map((point) => point.week.label)).toEqual([
      "WW22'2026",
      "WW23'2026",
    ])
  })

  it('ranks F63.2 first and groups 11 smaller buildings as Other', () => {
    const model = buildInspectionModel(index, defaultViewState(index))
    expect(model.buildings[0]).toEqual({ building: 'F63.2', finals: 138, sors: 15 })
    expect(model.buildings).toHaveLength(8)
    expect(model.otherBuildings?.count).toBe(11)
    expect((model.otherBuildings?.finals ?? 0) + (model.otherBuildings?.sors ?? 0)).toBe(12)
  })
})
```

- [ ] **Step 3: Run it**

Run: `npx vitest run --project qaqc-shared electricalFixture`
Expected: PASS, 6 tests. If any expectation fails, STOP and re-derive the expected number from the export with the Step 1 Python approach before changing code or tests; do not edit expectations to match output.

- [ ] **Step 4: Commit**

```bash
git add packages/qaqc-shared/src/__tests__/fixtures/electricalRows.ts packages/qaqc-shared/src/__tests__/electricalFixture.test.ts
git commit -m "test: verify inspection model against the real Electrical export

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Large-data benchmark

**Files:**
- Create: `packages/qaqc-shared/src/__tests__/fixtures/syntheticRows.ts`
- Test: `packages/qaqc-shared/src/__tests__/benchmark.test.ts`

- [ ] **Step 1: Create `packages/qaqc-shared/src/__tests__/fixtures/syntheticRows.ts`**

```ts
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
```

- [ ] **Step 2: Write `packages/qaqc-shared/src/__tests__/benchmark.test.ts`**

Budgets are 2× the spec targets (150 ms / 750 ms / 16 ms) to absorb CI variance. Task 19 records actual timings.

```ts
import { describe, expect, it } from 'vitest'

import { buildInspectionIndex, buildInspectionModel, defaultViewState } from '../inspections'
import { syntheticInspectionRows } from './fixtures/syntheticRows'

const COLUMNS = { workWeek: 0, phase: 1, issue: 2, building: 3 }
const TODAY = new Date(2026, 9, 15)

function elapsed(work: () => void): number {
  const start = performance.now()
  work()
  return performance.now() - start
}

describe('performance budgets', () => {
  it('indexes 100,000 rows within budget', () => {
    const rows = syntheticInspectionRows(100_000)
    buildInspectionIndex(rows, COLUMNS, TODAY)
    expect(elapsed(() => buildInspectionIndex(rows, COLUMNS, TODAY))).toBeLessThan(300)
  })

  it('indexes 500,000 rows within budget', () => {
    const rows = syntheticInspectionRows(500_000)
    buildInspectionIndex(rows, COLUMNS, TODAY)
    expect(elapsed(() => buildInspectionIndex(rows, COLUMNS, TODAY))).toBeLessThan(1500)
  })

  it('recomputes the All-range view model from a 500,000-row index within one frame', () => {
    const index = buildInspectionIndex(syntheticInspectionRows(500_000), COLUMNS, TODAY)
    const view = { ...defaultViewState(index), range: 'all' as const }
    buildInspectionModel(index, view)
    expect(elapsed(() => buildInspectionModel(index, view))).toBeLessThan(16)
  })
})
```

- [ ] **Step 3: Run it**

Run: `npx vitest run --project qaqc-shared benchmark`
Expected: PASS, 3 tests. If a budget fails, profile `buildInspectionIndex` (the per-row loop must do only cached Map lookups and integer increments) before touching the budget.

- [ ] **Step 4: Commit**

```bash
git add packages/qaqc-shared/src/__tests__/fixtures/syntheticRows.ts packages/qaqc-shared/src/__tests__/benchmark.test.ts
git commit -m "test: add 100k and 500k row performance budgets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Formatting, chart math, theme, and footnotes

**Files:**
- Create: `packages/qaqc-shared/src/format.ts`, `packages/qaqc-shared/src/chartMath.ts`, `packages/qaqc-shared/src/chartTypes.ts`, `packages/qaqc-shared/src/theme.ts`, `packages/qaqc-shared/src/footnotes.ts`
- Test: `packages/qaqc-shared/src/__tests__/format.test.ts`, `chartMath.test.ts`, `theme.test.ts`, `footnotes.test.ts`

- [ ] **Step 1: Write the failing tests**

`packages/qaqc-shared/src/__tests__/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { formatCount, formatDelta, formatPercent, formatPointsDelta, pluralize, trendOf } from '../format'

describe('format', () => {
  it('formats counts with thousands separators', () => {
    expect(formatCount(1234567)).toBe('1,234,567')
  })

  it('formats percents and n/a', () => {
    expect(formatPercent(99.1596)).toBe('99.2%')
    expect(formatPercent(null)).toBe('n/a')
  })

  it('formats signed deltas against a week', () => {
    expect(formatDelta(3, 'WW41')).toBe('+3 vs WW41')
    expect(formatDelta(-3, 'WW41')).toBe('−3 vs WW41')
    expect(formatDelta(0, 'WW41')).toBe('No change vs WW41')
  })

  it('formats percentage-point deltas, rounding tiny changes', () => {
    expect(formatPointsDelta(0.0107)).toBe('+0.01 pts')
    expect(formatPointsDelta(-0.826)).toBe('−0.8 pts')
    expect(formatPointsDelta(0.001)).toBe('No change')
  })

  it('maps deltas to trends', () => {
    expect(trendOf(2)).toBe('up')
    expect(trendOf(-1)).toBe('down')
    expect(trendOf(0)).toBe('flat')
  })

  it('pluralizes', () => {
    expect(pluralize(1, 'row', 'rows')).toBe('row')
    expect(pluralize(2, 'row', 'rows')).toBe('rows')
  })
})
```

`packages/qaqc-shared/src/__tests__/chartMath.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { labelIndices, niceScale, passRateDomain, roundedRightBarPath, roundedTopBarPath, truncateLabel } from '../chartMath'

describe('niceScale', () => {
  it('rounds the max up to a nice step with integer ticks', () => {
    expect(niceScale(14)).toEqual({ max: 15, ticks: [0, 5, 10, 15] })
    expect(niceScale(0)).toEqual({ max: 1, ticks: [0, 1] })
  })
})

describe('labelIndices', () => {
  it('labels every bar when there is room', () => {
    expect(labelIndices(30, 1320, 29).size).toBe(30)
  })

  it('thins labels from the right and always keeps the selected bar', () => {
    expect([...labelIndices(30, 440, 28)].sort((a, b) => a - b)).toEqual([2, 5, 8, 11, 14, 17, 20, 23, 26, 28])
  })

  it('returns nothing for an empty chart', () => {
    expect(labelIndices(0, 400, -1).size).toBe(0)
  })
})

describe('bar paths', () => {
  it('rounds the top corners and squares the baseline', () => {
    expect(roundedTopBarPath(0, 10, 20, 50, 4)).toBe('M0,60V14Q0,10 4,10H16Q20,10 20,14V60Z')
  })

  it('rounds the right end of horizontal bars', () => {
    expect(roundedRightBarPath(0, 0, 40, 10, 4)).toBe('M0,0H36Q40,0 40,4V6Q40,10 36,10H0Z')
  })

  it('returns an empty path for zero-size bars', () => {
    expect(roundedTopBarPath(0, 10, 20, 0, 4)).toBe('')
    expect(roundedRightBarPath(0, 0, 0, 10, 4)).toBe('')
  })
})

describe('passRateDomain', () => {
  it('zooms to one point below the lowest rate', () => {
    expect(passRateDomain([99.1, null, 100])).toEqual({ min: 98, max: 100 })
    expect(passRateDomain([100, 100])).toEqual({ min: 99, max: 100 })
  })

  it('uses the full range when there are no rates', () => {
    expect(passRateDomain([null])).toEqual({ min: 0, max: 100 })
  })
})

describe('truncateLabel', () => {
  it('keeps short labels and ellipsizes long ones', () => {
    expect(truncateLabel('F63.2', 10)).toBe('F63.2')
    expect(truncateLabel('IWW Pump Station', 8)).toBe('IWW Pum…')
  })
})
```

`packages/qaqc-shared/src/__tests__/theme.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { chartColorsFromTheme, isPresetName, PRESETS, resolveTheme, STATUS_COLORS, withOpacity, type ThemeOptions } from '../theme'

const BASE: ThemeOptions = { preset: 'qaqc', backgroundColor: '', backgroundOpacity: 100, cardOpacity: 100, highContrast: null }

describe('withOpacity', () => {
  it('converts hex to rgba with a clamped percent', () => {
    expect(withOpacity('#EDF1F6', 100)).toBe('rgba(237, 241, 246, 1)')
    expect(withOpacity('#FFFFFF', 0)).toBe('rgba(255, 255, 255, 0)')
    expect(withOpacity('#000000', 150)).toBe('rgba(0, 0, 0, 1)')
  })
})

describe('resolveTheme', () => {
  it('uses the QAQC preset page and card colors by default', () => {
    const theme = resolveTheme(BASE)
    expect(theme.cssVariables['--qaqc-page']).toBe('rgba(237, 241, 246, 1)')
    expect(theme.cssVariables['--qaqc-series-1']).toBe('#2E5AAC')
  })

  it('applies a background color override and both opacities', () => {
    const theme = resolveTheme({ ...BASE, backgroundColor: '#FFFFFF', backgroundOpacity: 0, cardOpacity: 50 })
    expect(theme.cssVariables['--qaqc-page']).toBe('rgba(255, 255, 255, 0)')
    expect(theme.cssVariables['--qaqc-card']).toBe('rgba(253, 254, 255, 0.5)')
  })

  it('ignores an invalid override color', () => {
    expect(resolveTheme({ ...BASE, backgroundColor: 'red' }).cssVariables['--qaqc-page']).toBe('rgba(237, 241, 246, 1)')
  })

  it('keeps status colors fixed across every preset', () => {
    for (const preset of Object.keys(PRESETS)) {
      if (!isPresetName(preset)) throw new Error(`bad preset ${preset}`)
      const colors = resolveTheme({ ...BASE, preset }).colors
      expect([colors.good, colors.bad, colors.warn]).toEqual([STATUS_COLORS.good, STATUS_COLORS.bad, STATUS_COLORS.warn])
    }
  })

  it('switches to host colors in high-contrast mode', () => {
    const theme = resolveTheme({
      ...BASE,
      highContrast: { foreground: '#FFFF00', background: '#000000', foregroundSelected: '#00FFFF' },
    })
    expect(theme.colors.series1).toBe('#FFFF00')
    expect(theme.colors.series2).toBe('#00FFFF')
    expect(theme.cssVariables['--qaqc-page']).toBe('#000000')
  })

  it('derives solid chart colors', () => {
    const colors = chartColorsFromTheme(resolveTheme({ ...BASE, cardOpacity: 0 }))
    expect(colors.card).toBe('#FDFEFF')
    expect(colors.bad).toBe('#D03B3B')
  })
})

describe('isPresetName', () => {
  it('accepts only known presets', () => {
    expect(isPresetName('blue')).toBe(true)
    expect(isPresetName('neon')).toBe(false)
    expect(isPresetName(3)).toBe(false)
  })
})
```

`packages/qaqc-shared/src/__tests__/footnotes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { buildFootnotes } from '../footnotes'
import { buildInspectionIndex } from '../inspections'

const COLUMNS = { workWeek: 0, phase: 1, issue: 2, building: 3 }
const TODAY = new Date(2026, 9, 15)

describe('buildFootnotes', () => {
  it('is empty for clean data with a Row ID', () => {
    const index = buildInspectionIndex([["WW42'2026", 'Final', '', 'A']], COLUMNS, TODAY)
    expect(buildFootnotes(index, true, false)).toEqual([])
  })

  it('explains skipped, future, missing Row ID, and the row limit', () => {
    const index = buildInspectionIndex(
      [['UPW', 'Final', '', 'A'], ['', 'SOR', '', 'A'], ["WW50'2026", 'Final', '', 'A']],
      COLUMNS,
      TODAY,
    )
    expect(buildFootnotes(index, false, true)).toEqual([
      'Showing the first 3 rows (Power BI data limit)',
      '2 rows skipped: unreadable work week',
      "1 row dated after WW42'2026 not counted",
      'Add an Index column to the Row ID slot so Power BI keeps identical rows separate',
    ])
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --project qaqc-shared format chartMath theme footnotes`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `packages/qaqc-shared/src/format.ts`**

```ts
const COUNT_FORMAT = new Intl.NumberFormat('en-US')
const MINUS = '−'

export type DeltaTone = 'neutral' | 'good' | 'warn' | 'bad'
export type Trend = 'up' | 'down' | 'flat' | 'none'

export function formatCount(value: number): string {
  return COUNT_FORMAT.format(value)
}

export function formatPercent(value: number | null, digits = 1): string {
  return value === null ? 'n/a' : `${value.toFixed(digits)}%`
}

export function formatDelta(delta: number, comparedTo: string): string {
  if (delta === 0) return `No change vs ${comparedTo}`
  return `${delta > 0 ? '+' : MINUS}${formatCount(Math.abs(delta))} vs ${comparedTo}`
}

/** Rounds to hundredths so tiny float noise reads as no change. */
export function roundPoints(delta: number): number {
  return Math.round(delta * 100) / 100
}

export function formatPointsDelta(delta: number): string {
  const rounded = roundPoints(delta)
  if (rounded === 0) return 'No change'
  const size = Math.abs(rounded)
  return `${rounded > 0 ? '+' : MINUS}${size.toFixed(size < 0.1 ? 2 : 1)} pts`
}

export function trendOf(delta: number): Trend {
  if (delta > 0) return 'up'
  if (delta < 0) return 'down'
  return 'flat'
}

export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}
```

- [ ] **Step 4: Implement `packages/qaqc-shared/src/chartMath.ts`**

```ts
export interface NiceScale {
  max: number
  ticks: number[]
}

/** Integer-step axis for counts. */
export function niceScale(maxValue: number, tickCount = 4): NiceScale {
  const safeMax = Math.max(1, maxValue)
  const rawStep = safeMax / tickCount
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const residual = rawStep / magnitude
  const niceResidual = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10
  const step = Math.max(1, niceResidual * magnitude)
  const max = Math.ceil(safeMax / step) * step
  const ticks: number[] = []
  for (let tick = 0; tick <= max; tick += step) ticks.push(tick)
  return { max, ticks }
}

/** Which bar indices get an axis label: evenly spaced from the right, always including the selection. */
export function labelIndices(count: number, plotWidth: number, selectedIndex: number, minLabelWidth = 44): Set<number> {
  const result = new Set<number>()
  if (count <= 0) return result
  const capacity = Math.max(1, Math.floor(plotWidth / minLabelWidth))
  const every = Math.max(1, Math.ceil(count / capacity))
  const guard = Math.ceil(every / 2)
  for (let index = count - 1; index >= 0; index -= every) {
    const crowdsSelection = selectedIndex >= 0 && index !== selectedIndex && Math.abs(index - selectedIndex) < guard
    if (!crowdsSelection) result.add(index)
  }
  if (selectedIndex >= 0 && selectedIndex < count) result.add(selectedIndex)
  return result
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

/** Vertical bar with rounded top corners and a square baseline (DESIGN.md mark spec). */
export function roundedTopBarPath(x: number, y: number, width: number, height: number, radius: number): string {
  if (width <= 0 || height <= 0) return ''
  const r = Math.min(radius, width / 2, height)
  const [x0, y0, x1, y1] = [round(x), round(y), round(x + width), round(y + height)]
  return `M${x0},${y1}V${round(y0 + r)}Q${x0},${y0} ${round(x0 + r)},${y0}H${round(x1 - r)}Q${x1},${y0} ${x1},${round(y0 + r)}V${y1}Z`
}

/** Horizontal bar with a rounded right end. */
export function roundedRightBarPath(x: number, y: number, width: number, height: number, radius: number): string {
  if (width <= 0 || height <= 0) return ''
  const r = Math.min(radius, width, height / 2)
  const [x0, y0, x1, y1] = [round(x), round(y), round(x + width), round(y + height)]
  return `M${x0},${y0}H${round(x1 - r)}Q${x1},${y0} ${x1},${round(y0 + r)}V${round(y1 - r)}Q${x1},${y1} ${round(x1 - r)},${y1}H${x0}Z`
}

export function passRateDomain(rates: ReadonlyArray<number | null>): { min: number; max: number } {
  const values = rates.filter((rate): rate is number => rate !== null)
  if (values.length === 0) return { min: 0, max: 100 }
  return { min: Math.max(0, Math.floor(Math.min(...values)) - 1), max: 100 }
}

export function truncateLabel(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, Math.max(1, maxChars - 1))}…`
}
```

- [ ] **Step 5: Implement `packages/qaqc-shared/src/chartTypes.ts`**

```ts
export interface ChartColors {
  series1: string
  series2: string
  bad: string
  /** Solid card color, used for marker rings and badge text. */
  card: string
  grid: string
  axisText: string
  ink: string
  accent: string
}

export interface TooltipRow {
  label: string
  value: string
}

export interface TooltipRequest {
  title: string
  rows: TooltipRow[]
  clientX: number
  clientY: number
}

export type TooltipHandler = (request: TooltipRequest | null) => void
```

- [ ] **Step 6: Implement `packages/qaqc-shared/src/theme.ts`**

```ts
import type { ChartColors } from './chartTypes'

export type PresetName = 'qaqc' | 'blue' | 'lotusworks' | 'grayscale'

export interface PresetColors {
  page: string
  card: string
  weekCard: string
  border: string
  hairline: string
  ink: string
  ink2: string
  muted: string
  faint: string
  accent: string
  accentSoft: string
  series1: string
  series2: string
}

export interface ThemeColors extends PresetColors {
  onAccent: string
  good: string
  bad: string
  warn: string
}

/** Fixed in every preset: green = good/closed, red = bad/opened/issue found, amber = warning. */
export const STATUS_COLORS = { good: '#0A7A0A', bad: '#D03B3B', warn: '#B45309' } as const

export const PRESETS: Record<PresetName, PresetColors> = {
  qaqc: {
    page: '#EDF1F6', card: '#FDFEFF', weekCard: '#F8FAFF', border: '#DCE3EC', hairline: '#EBEEF3',
    ink: '#1B2530', ink2: '#45505F', muted: '#6A7583', faint: '#9AA4B2',
    accent: '#2E5AAC', accentSoft: '#EAF0FA', series1: '#2E5AAC', series2: '#86B6EF',
  },
  blue: {
    page: '#F7F8FA', card: '#FFFFFF', weekCard: '#F5F9FD', border: '#E3E7ED', hairline: '#EEF1F5',
    ink: '#00325B', ink2: '#2B4A6B', muted: '#5B6B7F', faint: '#98A6B6',
    accent: '#0071C5', accentSoft: '#E6F1FA', series1: '#0071C5', series2: '#9CCBEE',
  },
  lotusworks: {
    page: '#F3F5F8', card: '#FFFFFF', weekCard: '#FFF9F5', border: '#DDE3EA', hairline: '#ECEFF3',
    ink: '#003459', ink2: '#2E4A66', muted: '#5E6E80', faint: '#9AA6B4',
    accent: '#E85D04', accentSoft: '#FDEFE6', series1: '#003459', series2: '#0077B6',
  },
  grayscale: {
    page: '#F2F2F2', card: '#FFFFFF', weekCard: '#FAFAFA', border: '#DADADA', hairline: '#ECECEC',
    ink: '#1E1E1E', ink2: '#444444', muted: '#6B6B6B', faint: '#A0A0A0',
    accent: '#3A3A3A', accentSoft: '#EDEDED', series1: '#3A3A3A', series2: '#A6A6A6',
  },
}

export interface HighContrastColors {
  foreground: string
  background: string
  foregroundSelected: string
}

export interface ThemeOptions {
  preset: PresetName
  /** '' or an invalid value means "use the preset page color". */
  backgroundColor: string
  backgroundOpacity: number
  cardOpacity: number
  highContrast: HighContrastColors | null
}

export interface ResolvedTheme {
  colors: ThemeColors
  cssVariables: Record<string, string>
}

const HEX_COLOR = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i

export function isPresetName(value: unknown): value is PresetName {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PRESETS, value)
}

export function withOpacity(hex: string, percent: number): string {
  const match = hex.match(HEX_COLOR)
  if (!match) return hex
  const alpha = Math.min(100, Math.max(0, percent)) / 100
  const [r, g, b] = [match[1], match[2], match[3]].map((part) => parseInt(part, 16))
  return `rgba(${r}, ${g}, ${b}, ${Number(alpha.toFixed(3))})`
}

function highContrastColors(host: HighContrastColors): ThemeColors {
  return {
    page: host.background, card: host.background, weekCard: host.background,
    border: host.foreground, hairline: host.foreground,
    ink: host.foreground, ink2: host.foreground, muted: host.foreground, faint: host.foreground,
    accent: host.foregroundSelected, accentSoft: host.background, onAccent: host.background,
    series1: host.foreground, series2: host.foregroundSelected,
    good: host.foreground, bad: host.foregroundSelected, warn: host.foreground,
  }
}

export function resolveTheme(options: ThemeOptions): ResolvedTheme {
  const highContrast = options.highContrast
  const colors: ThemeColors = highContrast
    ? highContrastColors(highContrast)
    : { ...PRESETS[options.preset], onAccent: '#FFFFFF', ...STATUS_COLORS }
  const pageBase = HEX_COLOR.test(options.backgroundColor) ? options.backgroundColor : colors.page
  const fill = (color: string, percent: number): string => (highContrast ? color : withOpacity(color, percent))

  return {
    colors,
    cssVariables: {
      '--qaqc-page': fill(highContrast ? colors.page : pageBase, options.backgroundOpacity),
      '--qaqc-card': fill(colors.card, options.cardOpacity),
      '--qaqc-week-card': fill(colors.weekCard, options.cardOpacity),
      '--qaqc-card-solid': colors.card,
      '--qaqc-border': colors.border,
      '--qaqc-hairline': colors.hairline,
      '--qaqc-ink': colors.ink,
      '--qaqc-ink-2': colors.ink2,
      '--qaqc-muted': colors.muted,
      '--qaqc-faint': colors.faint,
      '--qaqc-accent': colors.accent,
      '--qaqc-accent-soft': colors.accentSoft,
      '--qaqc-on-accent': colors.onAccent,
      '--qaqc-series-1': colors.series1,
      '--qaqc-series-2': colors.series2,
      '--qaqc-good': colors.good,
      '--qaqc-bad': colors.bad,
      '--qaqc-warn': colors.warn,
    },
  }
}

export function chartColorsFromTheme(theme: ResolvedTheme): ChartColors {
  const { colors } = theme
  return {
    series1: colors.series1,
    series2: colors.series2,
    bad: colors.bad,
    card: colors.card,
    grid: colors.hairline,
    axisText: colors.muted,
    ink: colors.ink,
    accent: colors.accent,
  }
}
```

- [ ] **Step 7: Implement `packages/qaqc-shared/src/footnotes.ts`**

```ts
import { formatCount, pluralize } from './format'
import type { InspectionIndex } from './types'

export function buildFootnotes(index: InspectionIndex, hasRowId: boolean, rowLimitReached: boolean): string[] {
  const notes: string[] = []
  if (rowLimitReached) {
    notes.push(`Showing the first ${formatCount(index.totalRows)} rows (Power BI data limit)`)
  }
  if (index.skippedRows > 0) {
    notes.push(`${formatCount(index.skippedRows)} ${pluralize(index.skippedRows, 'row', 'rows')} skipped: unreadable work week`)
  }
  if (index.futureRows > 0) {
    notes.push(
      `${formatCount(index.futureRows)} ${pluralize(index.futureRows, 'row', 'rows')} dated after ${index.currentWeek.label} not counted`,
    )
  }
  if (!hasRowId) {
    notes.push('Add an Index column to the Row ID slot so Power BI keeps identical rows separate')
  }
  return notes
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run --project qaqc-shared format chartMath theme footnotes`
Expected: PASS, 26 tests.

- [ ] **Step 9: Commit**

```bash
git add packages/qaqc-shared/src/format.ts packages/qaqc-shared/src/chartMath.ts packages/qaqc-shared/src/chartTypes.ts packages/qaqc-shared/src/theme.ts packages/qaqc-shared/src/footnotes.ts packages/qaqc-shared/src/__tests__/format.test.ts packages/qaqc-shared/src/__tests__/chartMath.test.ts packages/qaqc-shared/src/__tests__/theme.test.ts packages/qaqc-shared/src/__tests__/footnotes.test.ts
git commit -m "feat: add QAQC formatting, chart math, color presets, and footnotes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Styles

**Files:**
- Create: `packages/qaqc-shared/src/qaqc.less`

- [ ] **Step 1: Create `packages/qaqc-shared/src/qaqc.less`**

```less
// QAQC visual styles, ported from the QAQC Weekly Report Dashboard (DESIGN.md).
// Colors come from CSS variables that resolveTheme() sets on the host element.

.qaqc-host {
  width: 100%;
  height: 100%;
  overflow: hidden;
  color: var(--qaqc-ink);
  font-family: Inter, "Segoe UI", system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.qaqc-host *,
.qaqc-host *::before,
.qaqc-host *::after {
  box-sizing: border-box;
}

.qaqc-root {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  padding: 12px 14px 10px;
  overflow: hidden;
  background: var(--qaqc-page);
}

.qaqc-header {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.qaqc-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.qaqc-title h2 {
  margin: 0;
  overflow: hidden;
  color: var(--qaqc-ink);
  font-size: 15px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qaqc-title-icon {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: var(--qaqc-accent-soft);
  color: var(--qaqc-accent);
}

.qaqc-controls {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

.qaqc-range-toggle {
  display: inline-flex;
  padding: 2px;
  border: 1px solid var(--qaqc-border);
  border-radius: 9px;
  background: var(--qaqc-card-solid);
}

.qaqc-range-toggle button {
  padding: 4px 10px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--qaqc-muted);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  transition: background-color 150ms ease-out, color 150ms ease-out;
}

.qaqc-range-toggle button:hover:not(:disabled) {
  color: var(--qaqc-ink);
}

.qaqc-range-toggle button.is-active {
  background: var(--qaqc-accent);
  color: var(--qaqc-on-accent);
}

.qaqc-range-toggle button:disabled,
.qaqc-week-picker select:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.qaqc-range-toggle button:focus-visible,
.qaqc-week-picker select:focus-visible,
.qaqc-chart:focus-visible {
  outline: 2px solid var(--qaqc-accent);
  outline-offset: 2px;
}

.qaqc-week-picker {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 28px 0 10px;
  border: 1px solid var(--qaqc-border);
  border-radius: 9px;
  background: var(--qaqc-card-solid);
  color: var(--qaqc-ink);
}

.qaqc-week-picker svg {
  color: var(--qaqc-muted);
}

.qaqc-week-picker select {
  padding: 0;
  border: 0;
  appearance: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
}

.qaqc-week-picker-chevron {
  position: absolute;
  right: 9px;
  pointer-events: none;
}

.qaqc-kpi-row {
  display: grid;
  flex: 0 0 auto;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
}

.qaqc-kpi-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 6px 12px 8px;
  border: 1px solid var(--qaqc-border);
  border-radius: 14px;
  background: var(--qaqc-card);
  box-shadow: 0 1px 2px rgba(27, 37, 48, 0.06);
}

.qaqc-kpi-group.is-week {
  background: var(--qaqc-week-card);
}

.qaqc-kpi-group-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.qaqc-kpi-group-head span {
  color: var(--qaqc-ink-2);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.qaqc-kpi-group-head em {
  color: var(--qaqc-faint);
  font-size: 10.5px;
  font-style: normal;
  font-weight: 600;
}

.qaqc-kpi-group-body {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.qaqc-kpi {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 3px 4px 3px 2px;
}

.qaqc-kpi-head {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.qaqc-kpi-icon {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 1px solid var(--qaqc-border);
  border-radius: 7px;
  background: var(--qaqc-card-solid);
  color: var(--qaqc-muted);
}

.qaqc-kpi-label {
  overflow: hidden;
  color: var(--qaqc-muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qaqc-kpi-value {
  color: var(--qaqc-ink);
  font-size: 20px;
  font-weight: 650;
  letter-spacing: -0.01em;
  line-height: 1.05;
}

.qaqc-kpi-detail {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  overflow: hidden;
  color: var(--qaqc-muted);
  font-size: 11px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qaqc-kpi-detail.is-good {
  color: var(--qaqc-good);
}

.qaqc-kpi-detail.is-warn {
  color: var(--qaqc-warn);
}

.qaqc-kpi-detail.is-bad {
  color: var(--qaqc-bad);
}

.qaqc-charts {
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
  min-height: 0;
}

.qaqc-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 12px 14px;
  overflow: hidden;
  border: 1px solid var(--qaqc-border);
  border-radius: 14px;
  background: var(--qaqc-card);
  box-shadow: 0 4px 14px rgba(27, 37, 48, 0.08);
}

.qaqc-panel-main {
  grid-row: 1 / 3;
}

.qaqc-panel-title {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  color: var(--qaqc-ink);
}

.qaqc-panel-title svg {
  color: var(--qaqc-accent);
}

.qaqc-panel-title h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 650;
}

.qaqc-legend {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: 12px;
  margin: 6px 0 2px;
  padding: 0;
  list-style: none;
}

.qaqc-legend li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--qaqc-ink-2);
  font-size: 11px;
  font-weight: 600;
}

.qaqc-legend-swatch.is-bar {
  width: 16px;
  height: 4px;
  border-radius: 2px;
}

.qaqc-legend-swatch.is-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
}

.qaqc-chart-body {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  margin-top: 4px;
}

.qaqc-chart {
  display: block;
  overflow: visible;
}

.qaqc-chart-empty {
  display: grid;
  place-items: center;
  height: 100%;
  margin: 0;
  color: var(--qaqc-muted);
  font-size: 12.5px;
}

.qaqc-axis-text {
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
}

.qaqc-axis-text.is-selected {
  font-weight: 700;
}

.qaqc-value-text {
  font-size: 10.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.qaqc-selected-band {
  opacity: 0.08;
}

.qaqc-issue-badge text {
  font-size: 10px;
  font-weight: 700;
}

.qaqc-bar.is-dimmed {
  opacity: 0.55;
}

.qaqc-animate .qaqc-bar {
  transition: opacity 180ms ease-out;
}

.qaqc-animate .qaqc-selected-band {
  transition: transform 180ms ease-out;
}

.qaqc-footnotes {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.qaqc-footnotes li {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--qaqc-muted);
  font-size: 10.5px;
}

.qaqc-loading {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 2px;
  overflow: hidden;
  background: var(--qaqc-hairline);
}

.qaqc-loading span {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 30%;
  background: var(--qaqc-accent);
  animation: qaqc-loading 1.1s ease-in-out infinite;
}

@keyframes qaqc-loading {
  from {
    left: -30%;
  }

  to {
    left: 100%;
  }
}

.qaqc-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
  padding: 24px;
  background: var(--qaqc-page);
  text-align: center;
}

.qaqc-status-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--qaqc-accent-soft);
  color: var(--qaqc-accent);
}

.qaqc-status h2 {
  margin: 0;
  color: var(--qaqc-ink);
  font-size: 15px;
  font-weight: 650;
}

.qaqc-status p {
  max-width: 440px;
  margin: 0;
  color: var(--qaqc-ink-2);
  font-size: 12.5px;
}

.qaqc-status ul {
  display: grid;
  gap: 4px;
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
}

.qaqc-status li {
  padding: 5px 10px;
  border: 1px solid var(--qaqc-border);
  border-radius: 8px;
  background: var(--qaqc-card);
  color: var(--qaqc-ink);
  font-size: 12px;
  font-weight: 600;
}

.qaqc-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.qaqc-root.is-compact .qaqc-header {
  flex-wrap: wrap;
}

.qaqc-root.is-compact .qaqc-kpi-row {
  grid-template-columns: minmax(0, 1fr);
}

.qaqc-root.is-compact .qaqc-charts {
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr);
}

.qaqc-root.is-compact .qaqc-panel-main {
  grid-row: auto;
}

@media (prefers-reduced-motion: reduce) {
  .qaqc-host * {
    animation: none !important;
    transition: none !important;
  }
}
```

- [ ] **Step 2: Verify it compiles with the repo's Less**

Run: `npx lessc packages/qaqc-shared/src/qaqc.less > /dev/null && echo ok`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add packages/qaqc-shared/src/qaqc.less
git commit -m "feat: port QAQC dashboard styles for the Power BI visuals

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Cards, header controls, and the resize hook

**Files:**
- Create: `packages/qaqc-shared/src/hooks/useElementSize.ts`
- Create: `packages/qaqc-shared/src/components/KpiCard.tsx`, `KpiGroup.tsx`, `WorkWeekPicker.tsx`, `RangeToggle.tsx`
- Test: `packages/qaqc-shared/src/__tests__/cards.test.tsx`, `controls.test.tsx`

- [ ] **Step 1: Write the failing tests**

`packages/qaqc-shared/src/__tests__/cards.test.tsx`:

```tsx
import { ClipboardCheck } from 'lucide-react'
import { afterEach, describe, expect, it } from 'vitest'

import { KpiCard } from '../components/KpiCard'
import { KpiGroup } from '../components/KpiGroup'
import { render, type Rendered } from './render'

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

describe('KpiCard', () => {
  it('shows the label, value, and detail with an accessible summary', () => {
    view = render(
      <KpiCard label="Final Inspections" value="3" detail={'−3 vs WW41'} tone="neutral" trend="down" icon={ClipboardCheck} />,
    )
    const card = view.container.querySelector('article')
    expect(card?.getAttribute('aria-label')).toBe('Final Inspections: 3. −3 vs WW41')
    expect(card?.querySelector('.qaqc-kpi-value')?.textContent).toBe('3')
    expect(card?.querySelector('.qaqc-kpi-detail svg')).not.toBeNull()
  })

  it('colors the detail by tone', () => {
    view = render(<KpiCard label="Issues Found" value="2" detail="+2 vs WW41" tone="warn" trend="up" icon={ClipboardCheck} />)
    expect(view.container.querySelector('.qaqc-kpi-detail.is-warn')).not.toBeNull()
  })

  it('omits the trend icon when trend is none', () => {
    view = render(<KpiCard label="Finals to Date" value="238" detail="+3 this WW" tone="neutral" trend="none" icon={ClipboardCheck} />)
    expect(view.container.querySelector('.qaqc-kpi-detail svg')).toBeNull()
  })
})

describe('KpiGroup', () => {
  it('renders a titled group with an optional subtitle', () => {
    view = render(
      <KpiGroup title="Project to date" subtitle="Through WW42'2026" variant="total">
        <span className="child" />
      </KpiGroup>,
    )
    const group = view.container.querySelector('section.qaqc-kpi-group.is-total')
    expect(group?.querySelector('em')?.textContent).toBe("Through WW42'2026")
    expect(group?.querySelector('.child')).not.toBeNull()
  })
})
```

`packages/qaqc-shared/src/__tests__/controls.test.tsx`:

```tsx
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RangeToggle } from '../components/RangeToggle'
import { WorkWeekPicker } from '../components/WorkWeekPicker'
import { makeWorkWeek } from '../workWeeks'
import { render, type Rendered } from './render'

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

const OPTIONS = [makeWorkWeek(2026, 42), makeWorkWeek(2026, 41), makeWorkWeek(2026, 40)]

describe('WorkWeekPicker', () => {
  it('lists weeks and reports the chosen key as a number', () => {
    const onChange = vi.fn()
    view = render(<WorkWeekPicker options={OPTIONS} valueKey={202642} disabled={false} onChange={onChange} />)
    const select = view.container.querySelector('select')
    if (!select) throw new Error('select missing')
    expect(select.options).toHaveLength(3)
    expect(select.value).toBe('202642')
    act(() => {
      select.value = '202641'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onChange).toHaveBeenCalledWith(202641)
  })

  it('can be disabled', () => {
    view = render(<WorkWeekPicker options={OPTIONS} valueKey={202642} disabled onChange={vi.fn()} />)
    expect(view.container.querySelector('select')?.disabled).toBe(true)
  })
})

describe('RangeToggle', () => {
  it('marks the active range and switches on click', () => {
    const onChange = vi.fn()
    view = render(<RangeToggle value="recent" recentCount={30} disabled={false} onChange={onChange} />)
    const [recent, all] = Array.from(view.container.querySelectorAll('button'))
    expect(recent.textContent).toBe('30 WW')
    expect(recent.getAttribute('aria-pressed')).toBe('true')
    expect(all.getAttribute('aria-pressed')).toBe('false')
    act(() => {
      all.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onChange).toHaveBeenCalledWith('all')
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --project qaqc-shared cards controls`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `packages/qaqc-shared/src/hooks/useElementSize.ts`**

```ts
import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

export interface ElementSize {
  width: number
  height: number
}

/** Measures an element; ResizeObserver callbacks are coalesced to one update per animation frame. */
export function useElementSize<T extends HTMLElement>(): [RefObject<T | null>, ElementSize] {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const measure = (): void => {
      const rect = element.getBoundingClientRect()
      const next = { width: Math.floor(rect.width), height: Math.floor(rect.height) }
      setSize((current) => (current.width === next.width && current.height === next.height ? current : next))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    let frame = 0
    const observer = new ResizeObserver(() => {
      if (frame !== 0) return
      frame = requestAnimationFrame(() => {
        frame = 0
        measure()
      })
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
      if (frame !== 0) cancelAnimationFrame(frame)
    }
  }, [])

  return [ref, size]
}
```

- [ ] **Step 4: Implement `packages/qaqc-shared/src/components/KpiCard.tsx`**

```tsx
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from 'lucide-react'
import type { ReactElement } from 'react'

import type { DeltaTone, Trend } from '../format'

const TREND_ICONS: Record<Exclude<Trend, 'none'>, LucideIcon> = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
}

export interface KpiCardProps {
  label: string
  value: string
  detail: string
  tone: DeltaTone
  trend: Trend
  icon: LucideIcon
}

export function KpiCard({ label, value, detail, tone, trend, icon: Icon }: KpiCardProps): ReactElement {
  const TrendIcon = trend === 'none' ? null : TREND_ICONS[trend]
  return (
    <article className="qaqc-kpi" aria-label={`${label}: ${value}. ${detail}`}>
      <div className="qaqc-kpi-head">
        <span className="qaqc-kpi-icon">
          <Icon size={13} aria-hidden="true" />
        </span>
        <span className="qaqc-kpi-label">{label}</span>
      </div>
      <strong className="qaqc-kpi-value">{value}</strong>
      <span className={`qaqc-kpi-detail is-${tone}`}>
        {TrendIcon && <TrendIcon size={12} aria-hidden="true" />}
        {detail}
      </span>
    </article>
  )
}
```

- [ ] **Step 5: Implement `packages/qaqc-shared/src/components/KpiGroup.tsx`**

```tsx
import type { ReactElement, ReactNode } from 'react'

export interface KpiGroupProps {
  title: string
  subtitle?: string
  variant: 'week' | 'total'
  children: ReactNode
}

export function KpiGroup({ title, subtitle, variant, children }: KpiGroupProps): ReactElement {
  return (
    <section className={`qaqc-kpi-group is-${variant}`} aria-label={title}>
      <header className="qaqc-kpi-group-head">
        <span>{title}</span>
        {subtitle && <em>{subtitle}</em>}
      </header>
      <div className="qaqc-kpi-group-body">{children}</div>
    </section>
  )
}
```

- [ ] **Step 6: Implement `packages/qaqc-shared/src/components/WorkWeekPicker.tsx`**

```tsx
import { CalendarDays, ChevronDown } from 'lucide-react'
import type { ReactElement } from 'react'

import type { WorkWeek } from '../types'

export interface WorkWeekPickerProps {
  /** Newest first. */
  options: WorkWeek[]
  valueKey: number
  disabled: boolean
  onChange: (key: number) => void
}

export function WorkWeekPicker({ options, valueKey, disabled, onChange }: WorkWeekPickerProps): ReactElement {
  return (
    <label className="qaqc-week-picker">
      <CalendarDays size={14} aria-hidden="true" />
      <span className="qaqc-visually-hidden">Work week</span>
      <select value={String(valueKey)} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))}>
        {options.map((option) => (
          <option key={option.key} value={String(option.key)}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} aria-hidden="true" className="qaqc-week-picker-chevron" />
    </label>
  )
}
```

- [ ] **Step 7: Implement `packages/qaqc-shared/src/components/RangeToggle.tsx`**

```tsx
import type { ReactElement } from 'react'

import type { RangeMode } from '../types'

export interface RangeToggleProps {
  value: RangeMode
  recentCount: number
  disabled: boolean
  onChange: (mode: RangeMode) => void
}

export function RangeToggle({ value, recentCount, disabled, onChange }: RangeToggleProps): ReactElement {
  const options: Array<{ mode: RangeMode; label: string }> = [
    { mode: 'recent', label: `${recentCount} WW` },
    { mode: 'all', label: 'All' },
  ]
  return (
    <div className="qaqc-range-toggle" role="group" aria-label="Chart range">
      {options.map((option) => (
        <button
          key={option.mode}
          type="button"
          className={value === option.mode ? 'is-active' : undefined}
          aria-pressed={value === option.mode}
          disabled={disabled}
          onClick={() => onChange(option.mode)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run --project qaqc-shared cards controls`
Expected: PASS, 7 tests.

- [ ] **Step 9: Commit**

```bash
git add packages/qaqc-shared/src/hooks packages/qaqc-shared/src/components/KpiCard.tsx packages/qaqc-shared/src/components/KpiGroup.tsx packages/qaqc-shared/src/components/WorkWeekPicker.tsx packages/qaqc-shared/src/components/RangeToggle.tsx packages/qaqc-shared/src/__tests__/cards.test.tsx packages/qaqc-shared/src/__tests__/controls.test.tsx
git commit -m "feat: add QAQC KPI cards, week picker, range toggle, and resize hook

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Finals + SORs stacked bar chart

**Files:**
- Create: `packages/qaqc-shared/src/components/StackedBarChart.tsx`
- Test: `packages/qaqc-shared/src/__tests__/StackedBarChart.test.tsx`

- [ ] **Step 1: Write the failing test `packages/qaqc-shared/src/__tests__/StackedBarChart.test.tsx`**

```tsx
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ChartColors } from '../chartTypes'
import { StackedBarChart, type StackedBarChartProps } from '../components/StackedBarChart'
import type { WeekCounts } from '../types'
import { makeWorkWeek } from '../workWeeks'
import { render, type Rendered } from './render'

const COLORS: ChartColors = {
  series1: '#2E5AAC', series2: '#86B6EF', bad: '#D03B3B', card: '#FDFEFF',
  grid: '#EBEEF3', axisText: '#6A7583', ink: '#1B2530', accent: '#2E5AAC',
}

const WEEKS: WeekCounts[] = [
  { week: makeWorkWeek(2026, 40), finals: 4, sors: 1, issuesFound: 0 },
  { week: makeWorkWeek(2026, 41), finals: 6, sors: 3, issuesFound: 2 },
  { week: makeWorkWeek(2026, 42), finals: 3, sors: 3, issuesFound: 0 },
]

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

function draw(overrides: Partial<StackedBarChartProps> = {}): Rendered {
  return render(
    <StackedBarChart
      weeks={WEEKS}
      selectedKey={202642}
      width={600}
      height={300}
      colors={COLORS}
      interactive
      animate={false}
      describe
      onSelectWeek={vi.fn()}
      onHover={vi.fn()}
      {...overrides}
    />,
  )
}

function fire(target: Element, event: Event): void {
  act(() => {
    target.dispatchEvent(event)
  })
}

describe('StackedBarChart', () => {
  it('draws one hit area per week and a count badge on issue weeks', () => {
    view = draw()
    expect(view.container.querySelectorAll('.qaqc-hit')).toHaveLength(3)
    const badges = view.container.querySelectorAll('.qaqc-issue-badge')
    expect(badges).toHaveLength(1)
    expect(badges[0].textContent).toBe('2')
  })

  it('labels the selected week in bold', () => {
    view = draw()
    expect(view.container.querySelector('.qaqc-axis-text.is-selected')?.textContent).toBe('WW42')
  })

  it('selects a week on click when interactive', () => {
    const onSelectWeek = vi.fn()
    view = draw({ onSelectWeek })
    const hit = view.container.querySelector('[data-week="202641"]')
    if (!hit) throw new Error('hit area missing')
    fire(hit, new MouseEvent('click', { bubbles: true }))
    expect(onSelectWeek).toHaveBeenCalledWith(202641)
  })

  it('ignores clicks when interactions are off', () => {
    const onSelectWeek = vi.fn()
    view = draw({ onSelectWeek, interactive: false })
    const hit = view.container.querySelector('[data-week="202641"]')
    if (!hit) throw new Error('hit area missing')
    fire(hit, new MouseEvent('click', { bubbles: true }))
    expect(onSelectWeek).not.toHaveBeenCalled()
  })

  it('moves focus with arrow keys and selects with Enter', () => {
    const onSelectWeek = vi.fn()
    view = draw({ onSelectWeek })
    const svg = view.container.querySelector('svg')
    if (!svg) throw new Error('svg missing')
    expect(svg.getAttribute('tabindex')).toBe('0')
    fire(svg, new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    fire(svg, new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(onSelectWeek).toHaveBeenCalledWith(202641)
  })

  it('reports hover details and clears them on leave', () => {
    const onHover = vi.fn()
    view = draw({ onHover })
    const hit = view.container.querySelector('[data-week="202641"]')
    const svg = view.container.querySelector('svg')
    if (!hit || !svg) throw new Error('chart missing')
    fire(hit, new MouseEvent('mousemove', { bubbles: true, clientX: 10, clientY: 20 }))
    expect(onHover).toHaveBeenLastCalledWith({
      title: "WW41'2026",
      rows: [
        { label: 'Finals', value: '6' },
        { label: 'SORs', value: '3' },
        { label: 'Issues found', value: '2' },
      ],
      clientX: 10,
      clientY: 20,
    })
    fire(svg, new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }))
    expect(onHover).toHaveBeenLastCalledWith(null)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project qaqc-shared StackedBarChart`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `packages/qaqc-shared/src/components/StackedBarChart.tsx`**

```tsx
import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent, type ReactElement } from 'react'

import { labelIndices, niceScale, roundedTopBarPath } from '../chartMath'
import type { ChartColors, TooltipHandler } from '../chartTypes'
import { formatCount } from '../format'
import type { WeekCounts } from '../types'
import { shortWeekLabel } from '../workWeeks'

const MARGIN = { top: 22, right: 8, bottom: 24, left: 34 } as const
const MAX_BAR_WIDTH = 24
const MIN_BAR_WIDTH = 2
const BADGE_RADIUS = 8
const CORNER_RADIUS = 4

export interface StackedBarChartProps {
  weeks: WeekCounts[]
  selectedKey: number
  width: number
  height: number
  colors: ChartColors
  interactive: boolean
  animate: boolean
  describe: boolean
  onSelectWeek: (key: number) => void
  onHover: TooltipHandler
}

function describeWeek(item: WeekCounts): string {
  return `${item.week.label}: ${formatCount(item.finals)} Finals, ${formatCount(item.sors)} SORs, ${formatCount(item.issuesFound)} issues found`
}

export function StackedBarChart({
  weeks,
  selectedKey,
  width,
  height,
  colors,
  interactive,
  animate,
  describe,
  onSelectWeek,
  onHover,
}: StackedBarChartProps): ReactElement {
  const selectedIndex = weeks.findIndex((item) => item.week.key === selectedKey)
  const [focusIndex, setFocusIndex] = useState(selectedIndex >= 0 ? selectedIndex : weeks.length - 1)
  const [hasFocus, setHasFocus] = useState(false)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  useEffect(() => {
    if (selectedIndex >= 0) setFocusIndex(selectedIndex)
  }, [selectedIndex])

  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right)
  const plotHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom)
  const band = weeks.length > 0 ? plotWidth / weeks.length : plotWidth
  const barWidth = Math.min(MAX_BAR_WIDTH, Math.max(MIN_BAR_WIDTH, band * 0.68))
  const scale = useMemo(() => niceScale(weeks.reduce((max, item) => Math.max(max, item.finals + item.sors), 0)), [weeks])
  const labels = useMemo(() => labelIndices(weeks.length, plotWidth, selectedIndex), [weeks.length, plotWidth, selectedIndex])
  const focus = Math.min(Math.max(focusIndex, 0), weeks.length - 1)
  const y = (value: number): number => MARGIN.top + plotHeight - (value / scale.max) * plotHeight
  const bandX = (index: number): number => MARGIN.left + index * band

  function showTooltip(index: number, event: MouseEvent<SVGRectElement>): void {
    const item = weeks[index]
    setHoverIndex(index)
    onHover({
      title: item.week.label,
      rows: [
        { label: 'Finals', value: formatCount(item.finals) },
        { label: 'SORs', value: formatCount(item.sors) },
        { label: 'Issues found', value: formatCount(item.issuesFound) },
      ],
      clientX: event.clientX,
      clientY: event.clientY,
    })
  }

  function hideTooltip(): void {
    setHoverIndex(null)
    onHover(null)
  }

  function handleKeyDown(event: KeyboardEvent<SVGSVGElement>): void {
    if (weeks.length === 0) return
    const targets: Record<string, number> = {
      ArrowLeft: focus - 1,
      ArrowRight: focus + 1,
      Home: 0,
      End: weeks.length - 1,
    }
    const target = targets[event.key]
    if (target !== undefined) {
      event.preventDefault()
      setFocusIndex(Math.min(Math.max(target, 0), weeks.length - 1))
      return
    }
    if ((event.key === 'Enter' || event.key === ' ') && interactive) {
      event.preventDefault()
      onSelectWeek(weeks[focus].week.key)
    }
  }

  const summary = describe && weeks.length > 0
    ? `Finals and SORs by work week, ${weeks[0].week.label} to ${weeks[weeks.length - 1].week.label}.${hasFocus ? ` ${describeWeek(weeks[focus])}` : ''}`
    : 'Finals and SORs by work week'

  return (
    <svg
      className={animate ? 'qaqc-chart qaqc-animate' : 'qaqc-chart'}
      width={width}
      height={height}
      role="group"
      aria-label={summary}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={() => setHasFocus(true)}
      onBlur={() => setHasFocus(false)}
      onMouseLeave={hideTooltip}
    >
      {selectedIndex >= 0 && (
        <rect
          className="qaqc-selected-band"
          x={0}
          y={MARGIN.top}
          width={band}
          height={plotHeight}
          fill={colors.accent}
          style={{ transform: `translateX(${bandX(selectedIndex)}px)` }}
        />
      )}
      {scale.ticks.map((tick) => (
        <g key={tick}>
          <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} stroke={colors.grid} />
          <text className="qaqc-axis-text" x={MARGIN.left - 6} y={y(tick) + 3.5} textAnchor="end" fill={colors.axisText}>
            {formatCount(tick)}
          </text>
        </g>
      ))}
      {weeks.map((item, index) => {
        const x = bandX(index) + (band - barWidth) / 2
        const finalsTop = y(item.finals)
        const totalTop = y(item.finals + item.sors)
        const isSelected = index === selectedIndex
        return (
          <g key={item.week.key} className={hoverIndex !== null && hoverIndex !== index ? 'qaqc-bar is-dimmed' : 'qaqc-bar'}>
            {item.sors > 0 && (
              <path d={roundedTopBarPath(x, totalTop, barWidth, finalsTop - totalTop, CORNER_RADIUS)} fill={colors.series2} />
            )}
            {item.finals > 0 && (item.sors > 0
              ? <rect x={x} y={finalsTop} width={barWidth} height={y(0) - finalsTop} fill={colors.series1} />
              : <path d={roundedTopBarPath(x, finalsTop, barWidth, y(0) - finalsTop, CORNER_RADIUS)} fill={colors.series1} />)}
            {item.issuesFound > 0 && (
              <g
                className="qaqc-issue-badge"
                transform={`translate(${x + barWidth / 2} ${Math.max(BADGE_RADIUS + 1, totalTop - BADGE_RADIUS - 4)})`}
              >
                <circle r={BADGE_RADIUS} fill={colors.bad} stroke={colors.card} strokeWidth={2} />
                <text y={3.5} textAnchor="middle" fill={colors.card}>
                  {item.issuesFound}
                </text>
              </g>
            )}
            {labels.has(index) && (
              <text
                className={isSelected ? 'qaqc-axis-text is-selected' : 'qaqc-axis-text'}
                x={bandX(index) + band / 2}
                y={height - 8}
                textAnchor="middle"
                fill={isSelected ? colors.ink : colors.axisText}
              >
                {shortWeekLabel(item.week)}
              </text>
            )}
          </g>
        )
      })}
      {hasFocus && weeks.length > 0 && (
        <rect
          x={bandX(focus) + 1}
          y={MARGIN.top - 2}
          width={Math.max(0, band - 2)}
          height={plotHeight + 4}
          rx={3}
          fill="none"
          stroke={colors.accent}
          strokeWidth={1.5}
        />
      )}
      {weeks.map((item, index) => (
        <rect
          key={`hit-${item.week.key}`}
          className="qaqc-hit"
          data-week={item.week.key}
          x={bandX(index)}
          y={MARGIN.top}
          width={band}
          height={plotHeight}
          fill="transparent"
          style={{ cursor: interactive ? 'pointer' : 'default' }}
          onMouseMove={(event) => showTooltip(index, event)}
          onClick={interactive ? () => onSelectWeek(item.week.key) : undefined}
        />
      ))}
    </svg>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run --project qaqc-shared StackedBarChart`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/qaqc-shared/src/components/StackedBarChart.tsx packages/qaqc-shared/src/__tests__/StackedBarChart.test.tsx
git commit -m "feat: add Finals + SORs stacked bar chart with week selection

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Pass-rate line chart and building bar chart

**Files:**
- Create: `packages/qaqc-shared/src/components/LineChart.tsx`, `packages/qaqc-shared/src/components/HorizontalBarChart.tsx`
- Test: `packages/qaqc-shared/src/__tests__/smallCharts.test.tsx`

- [ ] **Step 1: Write the failing test `packages/qaqc-shared/src/__tests__/smallCharts.test.tsx`**

```tsx
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ChartColors } from '../chartTypes'
import { HorizontalBarChart } from '../components/HorizontalBarChart'
import { LineChart } from '../components/LineChart'
import type { PassRatePoint } from '../types'
import { makeWorkWeek } from '../workWeeks'
import { render, type Rendered } from './render'

const COLORS: ChartColors = {
  series1: '#2E5AAC', series2: '#86B6EF', bad: '#D03B3B', card: '#FDFEFF',
  grid: '#EBEEF3', axisText: '#6A7583', ink: '#1B2530', accent: '#2E5AAC',
}

function point(week: number, rate: number | null, hadIssue = false): PassRatePoint {
  return { week: makeWorkWeek(2026, week), rate, cleanFinals: 236, totalFinals: 238, hadIssue }
}

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

describe('LineChart', () => {
  it('draws the line, issue dots, and an end label', () => {
    view = render(
      <LineChart
        points={[point(40, 99.5), point(41, 99.1, true), point(42, 99.16)]}
        selectedKey={202642}
        width={300}
        height={160}
        colors={COLORS}
        describe
        onHover={vi.fn()}
      />,
    )
    expect(view.container.querySelector('.qaqc-line')?.getAttribute('d')).toMatch(/^M/)
    expect(view.container.querySelectorAll('.qaqc-issue-dot')).toHaveLength(1)
    expect(view.container.querySelector('.qaqc-end-label')?.textContent).toBe('99.2%')
  })

  it('skips weeks without Finals instead of drawing through them', () => {
    view = render(
      <LineChart points={[point(40, null), point(41, 100), point(42, 100)]} selectedKey={202642} width={300} height={160} colors={COLORS} describe onHover={vi.fn()} />,
    )
    expect(view.container.querySelector('.qaqc-line')?.getAttribute('d')?.match(/M/g)).toHaveLength(1)
  })

  it('reports pass-rate tooltips', () => {
    const onHover = vi.fn()
    view = render(
      <LineChart points={[point(41, 99.1), point(42, 99.16)]} selectedKey={202642} width={300} height={160} colors={COLORS} describe onHover={onHover} />,
    )
    const hit = view.container.querySelector('[data-week="202642"]')
    if (!hit) throw new Error('hit missing')
    act(() => {
      hit.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 5, clientY: 6 }))
    })
    expect(onHover).toHaveBeenLastCalledWith({
      title: "WW42'2026",
      rows: [
        { label: 'NCR pass rate', value: '99.2%' },
        { label: 'Clean Finals', value: '236 / 238' },
      ],
      clientX: 5,
      clientY: 6,
    })
  })
})

describe('HorizontalBarChart', () => {
  it('draws one row per building plus Other', () => {
    view = render(
      <HorizontalBarChart
        bars={[{ building: 'F63.2', finals: 138, sors: 15 }, { building: 'IWW Pump Station Annex', finals: 6, sors: 1 }]}
        other={{ count: 2, finals: 2, sors: 0 }}
        width={160}
        height={200}
        colors={COLORS}
        describe
        onHover={vi.fn()}
      />,
    )
    const labels = Array.from(view.container.querySelectorAll('.qaqc-row-label')).map((node) => node.textContent ?? '')
    expect(labels).toHaveLength(3)
    // Label column is min(132, 160 x 0.36) = 57.6px, so labels keep floor((57.6 - 8) / 6.4) = 7 characters.
    expect(labels[0]).toBe('F63.2')
    expect(labels[1]).toBe('IWW Pu…')
    expect(labels[2]).toBe('Other (…')
    expect(Array.from(view.container.querySelectorAll('.qaqc-value-text')).map((node) => node.textContent)).toEqual(['153', '7', '2'])
  })

  it('reports building tooltips', () => {
    const onHover = vi.fn()
    view = render(
      <HorizontalBarChart bars={[{ building: 'F63.2', finals: 138, sors: 15 }]} other={null} width={300} height={120} colors={COLORS} describe onHover={onHover} />,
    )
    const hit = view.container.querySelector('.qaqc-hit')
    if (!hit) throw new Error('hit missing')
    act(() => {
      hit.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 1, clientY: 2 }))
    })
    expect(onHover).toHaveBeenLastCalledWith({
      title: 'F63.2',
      rows: [
        { label: 'Finals', value: '138' },
        { label: 'SORs', value: '15' },
        { label: 'Total', value: '153' },
      ],
      clientX: 1,
      clientY: 2,
    })
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project qaqc-shared smallCharts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `packages/qaqc-shared/src/components/LineChart.tsx`**

```tsx
import type { MouseEvent, ReactElement } from 'react'

import { passRateDomain } from '../chartMath'
import type { ChartColors, TooltipHandler } from '../chartTypes'
import { formatCount, formatPercent } from '../format'
import type { PassRatePoint } from '../types'

const MARGIN = { top: 14, right: 42, bottom: 10, left: 40 } as const
const DOT_RADIUS = 4

export interface LineChartProps {
  points: PassRatePoint[]
  selectedKey: number
  width: number
  height: number
  colors: ChartColors
  describe: boolean
  onHover: TooltipHandler
}

export function LineChart({ points, selectedKey, width, height, colors, describe, onHover }: LineChartProps): ReactElement {
  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right)
  const plotHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom)
  const domain = passRateDomain(points.map((item) => item.rate))
  const step = points.length > 1 ? plotWidth / (points.length - 1) : 0
  const x = (index: number): number => (points.length > 1 ? MARGIN.left + index * step : MARGIN.left + plotWidth / 2)
  const y = (rate: number): number => MARGIN.top + plotHeight - ((rate - domain.min) / (domain.max - domain.min)) * plotHeight
  const band = points.length > 0 ? plotWidth / points.length : plotWidth

  let line = ''
  let previousWasNull = true
  points.forEach((item, index) => {
    if (item.rate === null) {
      previousWasNull = true
      return
    }
    line += `${previousWasNull ? 'M' : 'L'}${x(index).toFixed(2)},${y(item.rate).toFixed(2)}`
    previousWasNull = false
  })

  const lastIndex = points.reduce((found, item, index) => (item.rate !== null ? index : found), -1)
  const selectedIndex = points.findIndex((item) => item.week.key === selectedKey)
  const ticks = [domain.min, (domain.min + domain.max) / 2, domain.max]
  const lastRate = lastIndex >= 0 ? points[lastIndex].rate : null
  const summary = describe && lastRate !== null ? `NCR pass rate trend, ending at ${formatPercent(lastRate)}` : 'NCR pass rate trend'

  function showTooltip(item: PassRatePoint, event: MouseEvent<SVGRectElement>): void {
    onHover({
      title: item.week.label,
      rows: [
        { label: 'NCR pass rate', value: formatPercent(item.rate) },
        { label: 'Clean Finals', value: `${formatCount(item.cleanFinals)} / ${formatCount(item.totalFinals)}` },
      ],
      clientX: event.clientX,
      clientY: event.clientY,
    })
  }

  return (
    <svg className="qaqc-chart" width={width} height={height} role="img" aria-label={summary} onMouseLeave={() => onHover(null)}>
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} stroke={colors.grid} />
          <text className="qaqc-axis-text" x={MARGIN.left - 6} y={y(tick) + 3.5} textAnchor="end" fill={colors.axisText}>
            {formatPercent(tick, Number.isInteger(tick) ? 0 : 1)}
          </text>
        </g>
      ))}
      {selectedIndex >= 0 && (
        <line x1={x(selectedIndex)} x2={x(selectedIndex)} y1={MARGIN.top} y2={MARGIN.top + plotHeight} stroke={colors.accent} strokeOpacity={0.35} />
      )}
      <path className="qaqc-line" d={line} fill="none" stroke={colors.series1} strokeWidth={2} strokeLinejoin="round" />
      {points.map((item, index) =>
        item.hadIssue && item.rate !== null ? (
          <circle
            key={`issue-${item.week.key}`}
            className="qaqc-issue-dot"
            cx={x(index)}
            cy={y(item.rate)}
            r={DOT_RADIUS}
            fill={colors.bad}
            stroke={colors.card}
            strokeWidth={2}
          />
        ) : null,
      )}
      {lastRate !== null && (
        <text className="qaqc-value-text qaqc-end-label" x={x(lastIndex) + 6} y={y(lastRate) + 3.5} fill={colors.ink}>
          {formatPercent(lastRate)}
        </text>
      )}
      {points.map((item, index) => (
        <rect
          key={`hit-${item.week.key}`}
          className="qaqc-hit"
          data-week={item.week.key}
          x={x(index) - band / 2}
          y={MARGIN.top}
          width={band}
          height={plotHeight}
          fill="transparent"
          onMouseMove={(event) => showTooltip(item, event)}
        />
      ))}
    </svg>
  )
}
```

- [ ] **Step 4: Implement `packages/qaqc-shared/src/components/HorizontalBarChart.tsx`**

```tsx
import type { MouseEvent, ReactElement } from 'react'

import { roundedRightBarPath, truncateLabel } from '../chartMath'
import type { ChartColors, TooltipHandler } from '../chartTypes'
import { formatCount } from '../format'
import type { BuildingBar, OtherBuildings } from '../types'

const LABEL_RATIO = 0.36
const MAX_LABEL_WIDTH = 132
const VALUE_SPACE = 34
const MAX_ROW_HEIGHT = 24
const MAX_BAR_THICKNESS = 14
const CHAR_WIDTH = 6.4

export interface HorizontalBarChartProps {
  bars: BuildingBar[]
  other: OtherBuildings | null
  width: number
  height: number
  colors: ChartColors
  describe: boolean
  onHover: TooltipHandler
}

interface Row {
  label: string
  finals: number
  sors: number
}

export function HorizontalBarChart({ bars, other, width, height, colors, describe, onHover }: HorizontalBarChartProps): ReactElement {
  const rows: Row[] = [
    ...bars.map((bar) => ({ label: bar.building, finals: bar.finals, sors: bar.sors })),
    ...(other ? [{ label: `Other (${other.count} buildings)`, finals: other.finals, sors: other.sors }] : []),
  ]
  const labelWidth = Math.min(MAX_LABEL_WIDTH, width * LABEL_RATIO)
  const plotWidth = Math.max(0, width - labelWidth - VALUE_SPACE)
  const rowHeight = rows.length > 0 ? Math.min(MAX_ROW_HEIGHT, height / rows.length) : 0
  const thickness = Math.min(MAX_BAR_THICKNESS, rowHeight * 0.64)
  const maxTotal = rows.reduce((max, row) => Math.max(max, row.finals + row.sors), 1)
  const scale = plotWidth / maxTotal
  const maxChars = Math.max(1, Math.floor((labelWidth - 8) / CHAR_WIDTH))
  const summary = describe && rows.length > 0
    ? `Inspections by building. Most: ${rows[0].label}, ${formatCount(rows[0].finals + rows[0].sors)}`
    : 'Inspections by building'

  function showTooltip(row: Row, event: MouseEvent<SVGRectElement>): void {
    onHover({
      title: row.label,
      rows: [
        { label: 'Finals', value: formatCount(row.finals) },
        { label: 'SORs', value: formatCount(row.sors) },
        { label: 'Total', value: formatCount(row.finals + row.sors) },
      ],
      clientX: event.clientX,
      clientY: event.clientY,
    })
  }

  return (
    <svg className="qaqc-chart" width={width} height={height} role="img" aria-label={summary} onMouseLeave={() => onHover(null)}>
      {rows.map((row, index) => {
        const top = index * rowHeight
        const barY = top + (rowHeight - thickness) / 2
        const finalsWidth = row.finals * scale
        const sorsWidth = row.sors * scale
        const total = row.finals + row.sors
        return (
          <g key={row.label}>
            <text className="qaqc-axis-text qaqc-row-label" x={labelWidth - 8} y={barY + thickness / 2 + 3.5} textAnchor="end" fill={colors.ink}>
              {truncateLabel(row.label, maxChars)}
            </text>
            {row.sors > 0
              ? (
                <>
                  <rect x={labelWidth} y={barY} width={finalsWidth} height={thickness} fill={colors.series1} />
                  <path d={roundedRightBarPath(labelWidth + finalsWidth, barY, sorsWidth, thickness, 4)} fill={colors.series2} />
                </>
              )
              : <path d={roundedRightBarPath(labelWidth, barY, finalsWidth, thickness, 4)} fill={colors.series1} />}
            <text className="qaqc-value-text" x={labelWidth + total * scale + 6} y={barY + thickness / 2 + 3.5} fill={colors.axisText}>
              {formatCount(total)}
            </text>
            <rect
              className="qaqc-hit"
              x={0}
              y={top}
              width={width}
              height={rowHeight}
              fill="transparent"
              onMouseMove={(event) => showTooltip(row, event)}
            />
          </g>
        )
      })}
    </svg>
  )
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run --project qaqc-shared smallCharts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/qaqc-shared/src/components/LineChart.tsx packages/qaqc-shared/src/components/HorizontalBarChart.tsx packages/qaqc-shared/src/__tests__/smallCharts.test.tsx
git commit -m "feat: add NCR pass-rate line chart and building bar chart

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Panel, status, loading, and footnote components

**Files:**
- Create: `packages/qaqc-shared/src/components/ChartPanel.tsx`, `StatusPanel.tsx`, `LoadingBar.tsx`, `Footnotes.tsx`
- Test: `packages/qaqc-shared/src/__tests__/panels.test.tsx`

- [ ] **Step 1: Write the failing test `packages/qaqc-shared/src/__tests__/panels.test.tsx`**

```tsx
import { ChartColumnStacked, ListChecks } from 'lucide-react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ChartPanel } from '../components/ChartPanel'
import { Footnotes } from '../components/Footnotes'
import { LoadingBar } from '../components/LoadingBar'
import { StatusPanel } from '../components/StatusPanel'
import { render, type Rendered } from './render'

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
  vi.restoreAllMocks()
})

describe('ChartPanel', () => {
  it('shows the empty message instead of the chart', () => {
    const chart = vi.fn(() => <svg />)
    view = render(
      <ChartPanel title="Inspections by Building" icon={ChartColumnStacked} legend={[]} emptyMessage="No inspections match the current filters">
        {chart}
      </ChartPanel>,
    )
    expect(view.container.querySelector('.qaqc-chart-empty')?.textContent).toBe('No inspections match the current filters')
    expect(chart).not.toHaveBeenCalled()
  })

  it('renders the chart with the measured body size and a legend', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 400, bottom: 200, width: 400, height: 200, toJSON: () => ({}),
    })
    const chart = vi.fn(({ width, height }: { width: number; height: number }) => <svg data-size={`${width}x${height}`} />)
    view = render(
      <ChartPanel
        title="Finals + SORs by Work Week"
        icon={ChartColumnStacked}
        legend={[{ label: 'Finals', color: '#2E5AAC', shape: 'bar' }, { label: 'Issue found', color: '#D03B3B', shape: 'dot' }]}
        emptyMessage={null}
      >
        {chart}
      </ChartPanel>,
    )
    expect(view.container.querySelector('svg[data-size="400x200"]')).not.toBeNull()
    expect(view.container.querySelectorAll('.qaqc-legend li')).toHaveLength(2)
    expect(view.container.querySelector('.qaqc-legend-swatch.is-dot')).not.toBeNull()
  })
})

describe('StatusPanel', () => {
  it('lists the items it is given', () => {
    view = render(<StatusPanel icon={ListChecks} title="Add columns" message="Drag these columns:" items={['Work Week Observed → Work Week']} />)
    expect(view.container.querySelector('[role="status"] h2')?.textContent).toBe('Add columns')
    expect(view.container.querySelectorAll('li')).toHaveLength(1)
  })
})

describe('LoadingBar and Footnotes', () => {
  it('renders a progress bar only while active', () => {
    view = render(<LoadingBar active />)
    expect(view.container.querySelector('[role="progressbar"]')).not.toBeNull()
    view.rerender(<LoadingBar active={false} />)
    expect(view.container.querySelector('[role="progressbar"]')).toBeNull()
  })

  it('renders footnotes only when there are notes', () => {
    view = render(<Footnotes notes={['2 rows skipped: unreadable work week']} />)
    expect(view.container.querySelectorAll('.qaqc-footnotes li')).toHaveLength(1)
    view.rerender(<Footnotes notes={[]} />)
    expect(view.container.querySelector('.qaqc-footnotes')).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project qaqc-shared panels`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `packages/qaqc-shared/src/components/ChartPanel.tsx`**

```tsx
import type { LucideIcon } from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'

import { useElementSize, type ElementSize } from '../hooks/useElementSize'

export interface LegendItem {
  label: string
  color: string
  shape: 'bar' | 'dot'
}

export interface ChartPanelProps {
  title: string
  icon: LucideIcon
  legend: LegendItem[]
  /** When set, shown instead of the chart. */
  emptyMessage: string | null
  className?: string
  children: (size: ElementSize) => ReactNode
}

export function ChartPanel({ title, icon: Icon, legend, emptyMessage, className, children }: ChartPanelProps): ReactElement {
  const [bodyRef, size] = useElementSize<HTMLDivElement>()
  const isMeasured = size.width > 0 && size.height > 0
  return (
    <section className={className ? `qaqc-panel ${className}` : 'qaqc-panel'} aria-label={title}>
      <header className="qaqc-panel-title">
        <Icon size={15} aria-hidden="true" />
        <h3>{title}</h3>
      </header>
      {legend.length > 0 && (
        <ul className="qaqc-legend">
          {legend.map((item) => (
            <li key={item.label}>
              <span className={`qaqc-legend-swatch is-${item.shape}`} style={{ background: item.color }} />
              {item.label}
            </li>
          ))}
        </ul>
      )}
      <div className="qaqc-chart-body" ref={bodyRef}>
        {emptyMessage !== null ? <p className="qaqc-chart-empty">{emptyMessage}</p> : isMeasured ? children(size) : null}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Implement `packages/qaqc-shared/src/components/StatusPanel.tsx`**

```tsx
import type { LucideIcon } from 'lucide-react'
import type { ReactElement } from 'react'

export interface StatusPanelProps {
  icon: LucideIcon
  title: string
  message: string
  items: string[]
}

export function StatusPanel({ icon: Icon, title, message, items }: StatusPanelProps): ReactElement {
  return (
    <section className="qaqc-status" role="status" aria-label={title}>
      <span className="qaqc-status-icon">
        <Icon size={22} aria-hidden="true" />
      </span>
      <h2>{title}</h2>
      <p>{message}</p>
      {items.length > 0 && (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 5: Implement `packages/qaqc-shared/src/components/LoadingBar.tsx`**

```tsx
import type { ReactElement } from 'react'

export function LoadingBar({ active }: { active: boolean }): ReactElement | null {
  if (!active) return null
  return (
    <div className="qaqc-loading" role="progressbar" aria-label="Loading more rows">
      <span />
    </div>
  )
}
```

- [ ] **Step 6: Implement `packages/qaqc-shared/src/components/Footnotes.tsx`**

```tsx
import { Info } from 'lucide-react'
import type { ReactElement } from 'react'

export function Footnotes({ notes }: { notes: string[] }): ReactElement | null {
  if (notes.length === 0) return null
  return (
    <ul className="qaqc-footnotes">
      {notes.map((note) => (
        <li key={note}>
          <Info size={12} aria-hidden="true" />
          {note}
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 7: Run all qaqc-shared tests and typecheck**

Run: `npx vitest run --project qaqc-shared && npm run typecheck`
Expected: all qaqc-shared tests PASS; typecheck exit 0.

- [ ] **Step 8: Commit**

```bash
git add packages/qaqc-shared/src/components/ChartPanel.tsx packages/qaqc-shared/src/components/StatusPanel.tsx packages/qaqc-shared/src/components/LoadingBar.tsx packages/qaqc-shared/src/components/Footnotes.tsx packages/qaqc-shared/src/__tests__/panels.test.tsx
git commit -m "feat: add chart panel, status panel, loading bar, and footnotes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Scaffold the `qaqc-electrical` visual package

**Files:**
- Create: `packages/qaqc-electrical/package.json`, `pbiviz.json`, `tsconfig.json`, `vitest.config.ts`, `capabilities.json`
- Create: `packages/qaqc-electrical/stringResources/en-US/resources.resjson`
- Create: `packages/qaqc-electrical/scripts/ensure-api.cjs` (copy), `packages/qaqc-electrical/scripts/make-icon.mjs`
- Create: `packages/qaqc-electrical/style/visual.less`
- Create: `packages/qaqc-electrical/assets/icon.png` (generated)

- [ ] **Step 1: Create `packages/qaqc-electrical/package.json`**

```json
{
  "name": "@pbi/qaqc-electrical",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "node scripts/ensure-api.cjs && pbiviz package --all-locales",
    "start": "pbiviz start",
    "dev": "vite --config dev/vite.config.ts",
    "icon": "node scripts/make-icon.mjs"
  },
  "dependencies": {
    "lucide-react": "1.24.0",
    "powerbi-visuals-api": "~5.3.0",
    "powerbi-visuals-utils-formattingmodel": "^6.0.0",
    "react": "19.2.7",
    "react-dom": "19.2.7"
  },
  "devDependencies": {
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    "powerbi-visuals-tools": "^5.3.0",
    "typescript": "^5.3.3"
  }
}
```

- [ ] **Step 2: Create `packages/qaqc-electrical/pbiviz.json`**

```json
{
  "visual": {
    "name": "qaqcElectrical",
    "displayName": "QAQC Electrical Inspections",
    "guid": "qaqcElectrical_6B2E9D4A1C7F",
    "visualClassName": "QaqcElectricalVisual",
    "version": "1.0.0.0",
    "description": "Weekly Electrical inspection Finals, SORs, NCR pass rate, and building breakdown from the Smartsheet Electrical Inspection Log.",
    "supportUrl": "https://github.com/noahgarrett/PowerBI/issues",
    "gitHubUrl": "https://github.com/noahgarrett/PowerBI"
  },
  "apiVersion": "5.3.0",
  "author": {
    "name": "LotusWorks",
    "email": "contact@visualizebuild.com"
  },
  "assets": {
    "icon": "assets/icon.png"
  },
  "style": "style/visual.less",
  "capabilities": "capabilities.json",
  "stringResources": [
    "stringResources/en-US/resources.resjson"
  ]
}
```

The GUID must never change after the first release: re-importing a `.pbiviz` with the same GUID and a higher version upgrades it in place.

- [ ] **Step 3: Create `packages/qaqc-electrical/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "./dist", "jsx": "react-jsx" },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["src/**/*.test.ts", "src/**/*.test.tsx", "src/__tests__/**", "dev/**", "node_modules", "dist"],
  "files": ["src/visual.ts"]
}
```

- [ ] **Step 4: Create `packages/qaqc-electrical/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'qaqc-electrical',
    environment: 'jsdom',
    css: false,
    setupFiles: ['../core/src/__test-utils__/setup.ts', '../qaqc-shared/src/__tests__/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
```

- [ ] **Step 5: Create `packages/qaqc-electrical/capabilities.json`**

```json
{
  "dataRoles": [
    {
      "name": "workWeek",
      "kind": "Grouping",
      "displayName": "Work Week",
      "displayNameKey": "Qaqc_role_workWeek",
      "description": "Work Week Observed, for example WW42'2026.",
      "descriptionKey": "Qaqc_role_workWeek_description"
    },
    {
      "name": "phase",
      "kind": "Grouping",
      "displayName": "Inspection Phase",
      "displayNameKey": "Qaqc_role_phase",
      "description": "Final, SOR, or another inspection phase.",
      "descriptionKey": "Qaqc_role_phase_description"
    },
    {
      "name": "issue",
      "kind": "Grouping",
      "displayName": "Issue?",
      "displayNameKey": "Qaqc_role_issue",
      "description": "No Issue Found, or the issue raised on the inspection.",
      "descriptionKey": "Qaqc_role_issue_description"
    },
    {
      "name": "building",
      "kind": "Grouping",
      "displayName": "Building",
      "displayNameKey": "Qaqc_role_building",
      "description": "Building or area inspected.",
      "descriptionKey": "Qaqc_role_building_description"
    },
    {
      "name": "rowId",
      "kind": "Grouping",
      "displayName": "Row ID",
      "displayNameKey": "Qaqc_role_rowId",
      "description": "Optional unique row number (Power Query Index column). Keeps identical rows separate.",
      "descriptionKey": "Qaqc_role_rowId_description"
    }
  ],
  "dataViewMappings": [
    {
      "conditions": [
        {
          "workWeek": { "max": 1 },
          "phase": { "max": 1 },
          "issue": { "max": 1 },
          "building": { "max": 1 },
          "rowId": { "max": 1 }
        }
      ],
      "table": {
        "rows": {
          "select": [
            { "for": { "in": "workWeek" } },
            { "for": { "in": "phase" } },
            { "for": { "in": "issue" } },
            { "for": { "in": "building" } },
            { "for": { "in": "rowId" } }
          ],
          "dataReductionAlgorithm": {
            "window": { "count": 30000 }
          }
        }
      }
    }
  ],
  "objects": {
    "colors": {
      "displayName": "Colors",
      "displayNameKey": "Qaqc_colors",
      "properties": {
        "preset": {
          "displayName": "Preset",
          "displayNameKey": "Qaqc_colors_preset",
          "type": {
            "enumeration": [
              { "value": "qaqc", "displayName": "QAQC", "displayNameKey": "Qaqc_preset_qaqc" },
              { "value": "blue", "displayName": "Blue", "displayNameKey": "Qaqc_preset_blue" },
              { "value": "lotusworks", "displayName": "LotusWorks", "displayNameKey": "Qaqc_preset_lotusworks" },
              { "value": "grayscale", "displayName": "Grayscale", "displayNameKey": "Qaqc_preset_grayscale" }
            ]
          }
        }
      }
    },
    "cardSettings": {
      "displayName": "Background",
      "displayNameKey": "Qaqc_background",
      "properties": {
        "backgroundColor": {
          "displayName": "Background color",
          "displayNameKey": "Qaqc_background_color",
          "type": { "fill": { "solid": { "color": true } } }
        },
        "backgroundOpacity": {
          "displayName": "Background opacity",
          "displayNameKey": "Qaqc_background_opacity",
          "type": { "numeric": true }
        },
        "cardOpacity": {
          "displayName": "Card opacity",
          "displayNameKey": "Qaqc_card_opacity",
          "type": { "numeric": true }
        }
      }
    },
    "animationSettings": {
      "displayName": "Animation",
      "displayNameKey": "Qaqc_animation",
      "properties": {
        "enabled": {
          "displayName": "Transitions",
          "displayNameKey": "Qaqc_animation_enabled",
          "type": { "bool": true }
        }
      }
    },
    "accessibility": {
      "displayName": "Accessibility",
      "displayNameKey": "Qaqc_accessibility",
      "properties": {
        "chartSummaries": {
          "displayName": "Screen reader chart summaries",
          "displayNameKey": "Qaqc_accessibility_summaries",
          "type": { "bool": true }
        }
      }
    }
  },
  "tooltips": {
    "supportedTypes": { "default": true },
    "supportEnhancedTooltips": true
  },
  "supportsEmptyDataView": true,
  "supportsKeyboardFocus": true,
  "privileges": []
}
```

- [ ] **Step 6: Create `packages/qaqc-electrical/stringResources/en-US/resources.resjson`**

```json
{
  "locale": "en-US",
  "values": {
    "Qaqc_role_workWeek": "Work Week",
    "Qaqc_role_workWeek_description": "Work Week Observed, for example WW42'2026.",
    "Qaqc_role_phase": "Inspection Phase",
    "Qaqc_role_phase_description": "Final, SOR, or another inspection phase.",
    "Qaqc_role_issue": "Issue?",
    "Qaqc_role_issue_description": "No Issue Found, or the issue raised on the inspection.",
    "Qaqc_role_building": "Building",
    "Qaqc_role_building_description": "Building or area inspected.",
    "Qaqc_role_rowId": "Row ID",
    "Qaqc_role_rowId_description": "Optional unique row number (Power Query Index column). Keeps identical rows separate.",
    "Qaqc_colors": "Colors",
    "Qaqc_colors_preset": "Preset",
    "Qaqc_preset_qaqc": "QAQC",
    "Qaqc_preset_blue": "Blue",
    "Qaqc_preset_lotusworks": "LotusWorks",
    "Qaqc_preset_grayscale": "Grayscale",
    "Qaqc_background": "Background",
    "Qaqc_background_color": "Background color",
    "Qaqc_background_opacity": "Background opacity",
    "Qaqc_card_opacity": "Card opacity",
    "Qaqc_animation": "Animation",
    "Qaqc_animation_enabled": "Transitions",
    "Qaqc_accessibility": "Accessibility",
    "Qaqc_accessibility_summaries": "Screen reader chart summaries"
  }
}
```

- [ ] **Step 7: Copy the API link script**

Run: `mkdir -p packages/qaqc-electrical/scripts && cp packages/ssm-explorer/scripts/ensure-api.cjs packages/qaqc-electrical/scripts/ensure-api.cjs`

- [ ] **Step 8: Create `packages/qaqc-electrical/scripts/make-icon.mjs`**

```js
#!/usr/bin/env node
// Writes assets/icon.png: a 20x20 lucide Zap mark in the QAQC accent color (#2E5AAC).

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const SIZE = 20;
const SAMPLES = 4;
const COLOR = [0x2e, 0x5a, 0xac];
// lucide "zap" polygon on its 24x24 grid
const POLYGON = [[13, 2], [3, 14], [12, 14], [11, 22], [21, 10], [12, 10]];

function inside(x, y) {
  let hit = false;
  for (let i = 0, j = POLYGON.length - 1; i < POLYGON.length; j = i++) {
    const [xi, yi] = POLYGON[i];
    const [xj, yj] = POLYGON[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

const scale = 24 / SIZE;
const stride = SIZE * 4 + 1;
const raw = Buffer.alloc(SIZE * stride);
for (let py = 0; py < SIZE; py++) {
  raw[py * stride] = 0;
  for (let px = 0; px < SIZE; px++) {
    let covered = 0;
    for (let sy = 0; sy < SAMPLES; sy++) {
      for (let sx = 0; sx < SAMPLES; sx++) {
        if (inside((px + (sx + 0.5) / SAMPLES) * scale, (py + (sy + 0.5) / SAMPLES) * scale)) covered++;
      }
    }
    const offset = py * stride + 1 + px * 4;
    raw[offset] = COLOR[0];
    raw[offset + 1] = COLOR[1];
    raw[offset + 2] = COLOR[2];
    raw[offset + 3] = Math.round((covered / (SAMPLES * SAMPLES)) * 255);
  }
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body));
  return Buffer.concat([length, body, crc]);
}

const header = Buffer.alloc(13);
header.writeUInt32BE(SIZE, 0);
header.writeUInt32BE(SIZE, 4);
header[8] = 8; // bit depth
header[9] = 6; // RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', header),
  chunk('IDAT', zlib.deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);

const target = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'icon.png');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, png);
console.log(`[icon] wrote ${path.relative(process.cwd(), target)}`);
```

- [ ] **Step 9: Generate and check the icon**

Run: `npm run icon -w @pbi/qaqc-electrical && file packages/qaqc-electrical/assets/icon.png`
Expected: `PNG image data, 20 x 20, 8-bit/color RGBA, non-interlaced`. Open the PNG with the Read tool and confirm a blue lightning bolt.

- [ ] **Step 10: Create `packages/qaqc-electrical/style/visual.less`**

```less
@import (less) "../../qaqc-shared/src/qaqc.less";
```

- [ ] **Step 11: Install the workspace and verify Vitest sees the project**

Run: `npm install && npx vitest run --project qaqc-electrical --passWithNoTests`
Expected: exit 0 ("No test files found"). `git diff package-lock.json` shows only the `@pbi/qaqc-electrical` workspace entries.

- [ ] **Step 12: Commit**

```bash
git add package-lock.json packages/qaqc-electrical
git commit -m "chore: scaffold qaqc-electrical visual package

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Format pane settings

**Files:**
- Create: `packages/qaqc-electrical/src/settings.ts`
- Test: `packages/qaqc-electrical/src/__tests__/settings.test.ts`

- [ ] **Step 1: Write the failing test `packages/qaqc-electrical/src/__tests__/settings.test.ts`**

```ts
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel'
import { describe, expect, it } from 'vitest'

import { ElectricalSettingsModel, readDisplaySettings } from '../settings'

describe('ElectricalSettingsModel', () => {
  it('defaults to the QAQC preset, solid backgrounds, transitions, and chart summaries', () => {
    expect(readDisplaySettings(new ElectricalSettingsModel())).toEqual({
      preset: 'qaqc',
      backgroundColor: '',
      backgroundOpacity: 100,
      cardOpacity: 100,
      animate: true,
      describeCharts: true,
    })
  })

  it('falls back to QAQC for an unknown preset and clamps opacity', () => {
    const model = new ElectricalSettingsModel()
    model.colors.preset.value = { value: 'neon', displayName: 'Neon' }
    model.cardSettings.backgroundOpacity.value = 140
    model.cardSettings.cardOpacity.value = -5
    const settings = readDisplaySettings(model)
    expect(settings.preset).toBe('qaqc')
    expect(settings.backgroundOpacity).toBe(100)
    expect(settings.cardOpacity).toBe(0)
  })

  it('builds four Format pane cards with the object names capabilities.json declares', () => {
    const formattingModel = new FormattingSettingsService().buildFormattingModel(new ElectricalSettingsModel())
    expect(formattingModel.cards.map((card) => card.uid.split('_')[0])).toEqual([
      'colors',
      'cardSettings',
      'animationSettings',
      'accessibility',
    ])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project qaqc-electrical settings`
Expected: FAIL, cannot resolve `../settings`.

- [ ] **Step 3: Implement `packages/qaqc-electrical/src/settings.ts`**

```ts
import type powerbi from 'powerbi-visuals-api'
import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel'

import { isPresetName, type PresetName } from '../../qaqc-shared/src/theme'

// powerbi.visuals.ValidatorType.Min / Max. The API package has no runtime enums,
// so the const enum values are spelled out.
const VALIDATOR_MIN = 0
const VALIDATOR_MAX = 1

const PERCENT_OPTIONS: powerbi.visuals.NumUpDownFormat = {
  minValue: { type: VALIDATOR_MIN, value: 0 },
  maxValue: { type: VALIDATOR_MAX, value: 100 },
  unitSymbol: '%',
}

const PRESET_ITEMS = [
  { value: 'qaqc', displayName: 'QAQC', displayNameKey: 'Qaqc_preset_qaqc' },
  { value: 'blue', displayName: 'Blue', displayNameKey: 'Qaqc_preset_blue' },
  { value: 'lotusworks', displayName: 'LotusWorks', displayNameKey: 'Qaqc_preset_lotusworks' },
  { value: 'grayscale', displayName: 'Grayscale', displayNameKey: 'Qaqc_preset_grayscale' },
]

class ColorsCard extends formattingSettings.SimpleCard {
  preset = new formattingSettings.ItemDropdown({
    name: 'preset',
    displayName: 'Preset',
    displayNameKey: 'Qaqc_colors_preset',
    items: PRESET_ITEMS,
    value: PRESET_ITEMS[0],
  })

  name = 'colors'
  displayName = 'Colors'
  displayNameKey = 'Qaqc_colors'
  slices = [this.preset]
}

class CardStyleSettings extends formattingSettings.SimpleCard {
  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background color',
    displayNameKey: 'Qaqc_background_color',
    value: { value: '' }, // empty = use the preset page color
  })

  backgroundOpacity = new formattingSettings.Slider({
    name: 'backgroundOpacity',
    displayName: 'Background opacity',
    displayNameKey: 'Qaqc_background_opacity',
    value: 100,
    options: PERCENT_OPTIONS,
  })

  cardOpacity = new formattingSettings.Slider({
    name: 'cardOpacity',
    displayName: 'Card opacity',
    displayNameKey: 'Qaqc_card_opacity',
    value: 100,
    options: PERCENT_OPTIONS,
  })

  name = 'cardSettings'
  displayName = 'Background'
  displayNameKey = 'Qaqc_background'
  slices = [this.backgroundColor, this.backgroundOpacity, this.cardOpacity]
}

class AnimationSettingsCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Transitions',
    displayNameKey: 'Qaqc_animation_enabled',
    value: true,
  })

  name = 'animationSettings'
  displayName = 'Animation'
  displayNameKey = 'Qaqc_animation'
  slices = [this.enabled]
}

class AccessibilityCard extends formattingSettings.SimpleCard {
  chartSummaries = new formattingSettings.ToggleSwitch({
    name: 'chartSummaries',
    displayName: 'Screen reader chart summaries',
    displayNameKey: 'Qaqc_accessibility_summaries',
    value: true,
  })

  name = 'accessibility'
  displayName = 'Accessibility'
  displayNameKey = 'Qaqc_accessibility'
  slices = [this.chartSummaries]
}

export class ElectricalSettingsModel extends formattingSettings.Model {
  colors = new ColorsCard()
  cardSettings = new CardStyleSettings()
  animationSettings = new AnimationSettingsCard()
  accessibility = new AccessibilityCard()
  cards = [this.colors, this.cardSettings, this.animationSettings, this.accessibility]
}

export interface DisplaySettings {
  preset: PresetName
  backgroundColor: string
  backgroundOpacity: number
  cardOpacity: number
  animate: boolean
  describeCharts: boolean
}

function clampPercent(value: number): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 100
}

export function readDisplaySettings(model: ElectricalSettingsModel): DisplaySettings {
  const preset = model.colors.preset.value.value
  return {
    preset: isPresetName(preset) ? preset : 'qaqc',
    backgroundColor: model.cardSettings.backgroundColor.value?.value ?? '',
    backgroundOpacity: clampPercent(model.cardSettings.backgroundOpacity.value),
    cardOpacity: clampPercent(model.cardSettings.cardOpacity.value),
    animate: model.animationSettings.enabled.value,
    describeCharts: model.accessibility.chartSummaries.value,
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --project qaqc-electrical settings`
Expected: PASS, 3 tests. If the third test fails because `card.uid` has a different shape in formattingmodel 6.2.2, print `formattingModel.cards.map((card) => card.uid)` once, then change only the extraction expression (for example `card.uid.replace(/_card$/, '')`) so the assertion still checks the four object names in order.

- [ ] **Step 5: Commit**

```bash
git add packages/qaqc-electrical/src/settings.ts packages/qaqc-electrical/src/__tests__/settings.test.ts
git commit -m "feat: add Electrical visual Format pane settings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Read the Power BI table data view

**Files:**
- Create: `packages/qaqc-electrical/src/dataView.ts`
- Test: `packages/qaqc-electrical/src/__tests__/dataView.test.ts`, `packages/qaqc-electrical/src/__tests__/tableDataView.ts` (test helper)

- [ ] **Step 1: Create the shared test helper `packages/qaqc-electrical/src/__tests__/tableDataView.ts`**

```ts
import type powerbi from 'powerbi-visuals-api'

export type SlotRole = 'workWeek' | 'phase' | 'issue' | 'building' | 'rowId'

export interface TableOptions {
  roles?: SlotRole[]
  segment?: boolean
}

const ALL_ROLES: SlotRole[] = ['workWeek', 'phase', 'issue', 'building', 'rowId']

/**
 * Builds a table data view whose columns carry the given roles, in order. Each input row
 * supplies the first four slot values; the Row ID column (if present) is numbered from 1.
 */
export function tableDataView(rows: ReadonlyArray<ReadonlyArray<string | null>>, options: TableOptions = {}): powerbi.DataView {
  const roles = options.roles ?? ALL_ROLES
  const columns: powerbi.DataViewMetadataColumn[] = roles.map((role, index) => ({
    displayName: role,
    index,
    roles: { [role]: true },
  }))
  const tableRows: powerbi.DataViewTableRow[] = rows.map((row, rowIndex) =>
    roles.map((role) => (role === 'rowId' ? rowIndex + 1 : row[ALL_ROLES.indexOf(role)] ?? '')),
  )
  return {
    metadata: options.segment ? { columns, segment: {} } : { columns },
    table: { columns, rows: tableRows },
  }
}
```

- [ ] **Step 2: Write the failing test `packages/qaqc-electrical/src/__tests__/dataView.test.ts`**

```ts
import { describe, expect, it } from 'vitest'

import { readInspectionTable } from '../dataView'
import { tableDataView } from './tableDataView'

const ROW = ["WW42'2026", 'Final', 'No Issue Found', 'F63.2']

describe('readInspectionTable', () => {
  it('reports every required slot when there is no data view', () => {
    const result = readInspectionTable(undefined)
    expect(result.kind).toBe('missing')
    if (result.kind === 'missing') expect(result.missing.map((slot) => slot.slot)).toEqual(['Work Week', 'Inspection Phase', 'Issue?', 'Building'])
  })

  it('names only the slots that are still empty', () => {
    const result = readInspectionTable(tableDataView([ROW], { roles: ['workWeek', 'phase'] }))
    expect(result.kind).toBe('missing')
    if (result.kind === 'missing') expect(result.missing.map((slot) => slot.column)).toEqual(['Issue?', 'Building'])
  })

  it('finds column positions by role regardless of order', () => {
    const result = readInspectionTable(tableDataView([ROW], { roles: ['building', 'issue', 'rowId', 'phase', 'workWeek'] }))
    expect(result.kind).toBe('ready')
    if (result.kind === 'ready') {
      expect(result.columns).toEqual({ workWeek: 4, phase: 3, issue: 1, building: 0 })
      expect(result.rows[0][result.columns.workWeek]).toBe("WW42'2026")
      expect(result.hasRowId).toBe(true)
    }
  })

  it('notes when the Row ID slot is empty', () => {
    const result = readInspectionTable(tableDataView([ROW], { roles: ['workWeek', 'phase', 'issue', 'building'] }))
    expect(result.kind === 'ready' && result.hasRowId).toBe(false)
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run --project qaqc-electrical dataView`
Expected: FAIL, cannot resolve `../dataView`.

- [ ] **Step 4: Implement `packages/qaqc-electrical/src/dataView.ts`**

```ts
import type powerbi from 'powerbi-visuals-api'

import type { InspectionColumns, InspectionRows } from '../../qaqc-shared/src/types'

export interface FieldSlot {
  role: keyof InspectionColumns
  /** Field slot name in the Power BI Fields pane. */
  slot: string
  /** Smartsheet column the user drags into it. */
  column: string
}

export const REQUIRED_SLOTS: readonly FieldSlot[] = [
  { role: 'workWeek', slot: 'Work Week', column: 'Work Week Observed' },
  { role: 'phase', slot: 'Inspection Phase', column: 'Inspection Phase' },
  { role: 'issue', slot: 'Issue?', column: 'Issue?' },
  { role: 'building', slot: 'Building', column: 'Building' },
]

const ROW_ID_ROLE = 'rowId'

export type TableReadResult =
  | { kind: 'missing'; missing: FieldSlot[] }
  | { kind: 'ready'; rows: InspectionRows; columns: InspectionColumns; hasRowId: boolean }

export function readInspectionTable(dataView: powerbi.DataView | undefined): TableReadResult {
  const table = dataView?.table
  if (!table) return { kind: 'missing', missing: [...REQUIRED_SLOTS] }

  const positionOf = (role: string): number => table.columns.findIndex((column) => column.roles?.[role] === true)
  const missing = REQUIRED_SLOTS.filter((slot) => positionOf(slot.role) < 0)
  if (missing.length > 0) return { kind: 'missing', missing }

  return {
    kind: 'ready',
    rows: table.rows ?? [],
    columns: {
      workWeek: positionOf('workWeek'),
      phase: positionOf('phase'),
      issue: positionOf('issue'),
      building: positionOf('building'),
    },
    hasRowId: positionOf(ROW_ID_ROLE) >= 0,
  }
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run --project qaqc-electrical dataView`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/qaqc-electrical/src/dataView.ts packages/qaqc-electrical/src/__tests__/dataView.test.ts packages/qaqc-electrical/src/__tests__/tableDataView.ts
git commit -m "feat: read Electrical field slots from the table data view

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Electrical dashboard layout

**Files:**
- Create: `packages/qaqc-electrical/src/ElectricalDashboard.tsx`
- Test: `packages/qaqc-electrical/src/__tests__/ElectricalDashboard.test.tsx`

- [ ] **Step 1: Write the failing test `packages/qaqc-electrical/src/__tests__/ElectricalDashboard.test.tsx`**

```tsx
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ELECTRICAL_ROWS } from '../../../qaqc-shared/src/__tests__/fixtures/electricalRows'
import { render, type Rendered } from '../../../qaqc-shared/src/__tests__/render'
import { buildInspectionIndex } from '../../../qaqc-shared/src/inspections'
import { resolveTheme } from '../../../qaqc-shared/src/theme'
import { ElectricalDashboard, type ElectricalDashboardProps } from '../ElectricalDashboard'

const INDEX = buildInspectionIndex(ELECTRICAL_ROWS, { workWeek: 0, phase: 1, issue: 2, building: 3 }, new Date(2026, 9, 15))
const THEME = resolveTheme({ preset: 'qaqc', backgroundColor: '', backgroundOpacity: 100, cardOpacity: 100, highContrast: null })

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

function draw(overrides: Partial<ElectricalDashboardProps> = {}): Rendered {
  return render(
    <ElectricalDashboard
      index={INDEX}
      theme={THEME}
      interactive
      animate={false}
      describeCharts
      loading={false}
      footnotes={[]}
      viewport={{ width: 1280, height: 720 }}
      onHover={vi.fn()}
      {...overrides}
    />,
  )
}

function cardValue(container: HTMLElement, label: string): string | null {
  return container.querySelector(`[aria-label^="${label}:"] .qaqc-kpi-value`)?.textContent ?? null
}

describe('ElectricalDashboard', () => {
  it('opens on the current week with the six cards', () => {
    view = draw()
    const { container } = view
    expect(container.querySelector('h2')?.textContent).toBe('Electrical Inspections')
    expect(container.querySelector('.qaqc-kpi-group.is-week span')?.textContent).toBe("WW42'2026")
    expect(cardValue(container, 'Final Inspections')).toBe('3')
    expect(cardValue(container, 'SORs')).toBe('3')
    expect(cardValue(container, 'Issues Found')).toBe('0')
    expect(cardValue(container, 'Finals to Date')).toBe('238')
    expect(cardValue(container, 'SORs to Date')).toBe('48')
    expect(cardValue(container, 'NCR Pass Rate')).toBe('99.2%')
  })

  it('switches cards and the to-date label when another week is picked', () => {
    view = draw()
    const select = view.container.querySelector('select')
    if (!select) throw new Error('week picker missing')
    expect(select.options).toHaveLength(44)
    act(() => {
      select.value = '202641'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(cardValue(view.container, 'Final Inspections')).toBe('6')
    expect(view.container.querySelector('.qaqc-kpi-group.is-total em')?.textContent).toBe("Through WW41'2026")
  })

  it('toggles the chart range', () => {
    view = draw()
    const all = Array.from(view.container.querySelectorAll('.qaqc-range-toggle button')).find((button) => button.textContent === 'All')
    if (!all) throw new Error('All button missing')
    act(() => {
      all.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(all.getAttribute('aria-pressed')).toBe('true')
  })

  it('shows three chart panels on a full page and none on a short tile', () => {
    view = draw()
    expect(view.container.querySelectorAll('.qaqc-panel')).toHaveLength(3)
    view.rerender(
      <ElectricalDashboard
        index={INDEX}
        theme={THEME}
        interactive
        animate={false}
        describeCharts
        loading={false}
        footnotes={[]}
        viewport={{ width: 1280, height: 400 }}
        onHover={vi.fn()}
      />,
    )
    expect(view.container.querySelectorAll('.qaqc-panel')).toHaveLength(0)
  })

  it('uses the compact layout on narrow tiles', () => {
    view = draw({ viewport: { width: 800, height: 900 } })
    expect(view.container.querySelector('.qaqc-root.is-compact')).not.toBeNull()
  })

  it('disables controls when interactions are not allowed', () => {
    view = draw({ interactive: false })
    expect(view.container.querySelector('select')?.disabled).toBe(true)
  })

  it('shows the loading bar and footnotes it is given', () => {
    view = draw({ loading: true, footnotes: ['2 rows skipped: unreadable work week'] })
    expect(view.container.querySelector('[role="progressbar"]')).not.toBeNull()
    expect(view.container.querySelector('.qaqc-footnotes')?.textContent).toContain('2 rows skipped')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project qaqc-electrical ElectricalDashboard`
Expected: FAIL, cannot resolve `../ElectricalDashboard`.

- [ ] **Step 3: Implement `packages/qaqc-electrical/src/ElectricalDashboard.tsx`**

```tsx
import { Building2, ChartColumnStacked, CircleAlert, CircleCheck, ClipboardCheck, Gauge, TrendingUp, Wrench, Zap } from 'lucide-react'
import { useMemo, useState, type ReactElement } from 'react'

import type { TooltipHandler } from '../../qaqc-shared/src/chartTypes'
import { ChartPanel, type LegendItem } from '../../qaqc-shared/src/components/ChartPanel'
import { Footnotes } from '../../qaqc-shared/src/components/Footnotes'
import { HorizontalBarChart } from '../../qaqc-shared/src/components/HorizontalBarChart'
import { KpiCard } from '../../qaqc-shared/src/components/KpiCard'
import { KpiGroup } from '../../qaqc-shared/src/components/KpiGroup'
import { LineChart } from '../../qaqc-shared/src/components/LineChart'
import { LoadingBar } from '../../qaqc-shared/src/components/LoadingBar'
import { RangeToggle } from '../../qaqc-shared/src/components/RangeToggle'
import { StackedBarChart } from '../../qaqc-shared/src/components/StackedBarChart'
import { WorkWeekPicker } from '../../qaqc-shared/src/components/WorkWeekPicker'
import {
  formatCount,
  formatDelta,
  formatPercent,
  formatPointsDelta,
  roundPoints,
  trendOf,
  type DeltaTone,
} from '../../qaqc-shared/src/format'
import { buildInspectionModel, RECENT_WEEK_COUNT } from '../../qaqc-shared/src/inspections'
import { chartColorsFromTheme, type ResolvedTheme } from '../../qaqc-shared/src/theme'
import type { InspectionIndex, RangeMode } from '../../qaqc-shared/src/types'
import { shortWeekLabel } from '../../qaqc-shared/src/workWeeks'

export const COMPACT_WIDTH = 900
export const CARDS_ONLY_HEIGHT = 420
const NO_ROWS_MESSAGE = 'No inspections match the current filters'

export interface ElectricalDashboardProps {
  index: InspectionIndex
  theme: ResolvedTheme
  interactive: boolean
  animate: boolean
  describeCharts: boolean
  loading: boolean
  footnotes: string[]
  viewport: { width: number; height: number }
  onHover: TooltipHandler
}

function pointsTone(delta: number | null): DeltaTone {
  if (delta === null) return 'neutral'
  const rounded = roundPoints(delta)
  if (rounded < 0) return 'bad'
  if (rounded > 0) return 'good'
  return 'neutral'
}

export function ElectricalDashboard({
  index,
  theme,
  interactive,
  animate,
  describeCharts,
  loading,
  footnotes,
  viewport,
  onHover,
}: ElectricalDashboardProps): ReactElement {
  const [selectedKey, setSelectedKey] = useState(index.currentWeek.key)
  const [windowEndKey, setWindowEndKey] = useState(index.currentWeek.key)
  const [range, setRange] = useState<RangeMode>('recent')

  // Keep the user's week across data refreshes when it still exists; otherwise use the current week.
  const effectiveSelected = index.positionByKey.has(selectedKey) ? selectedKey : index.currentWeek.key
  const effectiveEnd = index.positionByKey.has(windowEndKey) ? windowEndKey : index.currentWeek.key
  const model = useMemo(
    () => buildInspectionModel(index, { selectedKey: effectiveSelected, windowEndKey: effectiveEnd, range }),
    [index, effectiveSelected, effectiveEnd, range],
  )
  const colors = chartColorsFromTheme(theme)
  const { thisWeek, toDate } = model
  const previousLabel = shortWeekLabel(model.previousWeek)
  const isCompact = viewport.width < COMPACT_WIDTH
  const isCardsOnly = viewport.height < CARDS_ONLY_HEIGHT
  const rootClass = ['qaqc-root', isCompact ? 'is-compact' : '', isCardsOnly ? 'is-cards-only' : ''].filter(Boolean).join(' ')
  const hasFinalsInWindow = model.passRateTrend.some((point) => point.rate !== null)

  const finalsSorsLegend: LegendItem[] = [
    { label: 'Finals', color: colors.series1, shape: 'bar' },
    { label: 'SORs', color: colors.series2, shape: 'bar' },
  ]
  const passRateDetail = toDate.passRateDeltaPoints === null
    ? `${formatCount(toDate.cleanFinals)} / ${formatCount(toDate.finals)} Finals`
    : `${formatCount(toDate.cleanFinals)} / ${formatCount(toDate.finals)} Finals · ${formatPointsDelta(toDate.passRateDeltaPoints)}`

  function pickWeek(key: number): void {
    setSelectedKey(key)
    setWindowEndKey(key)
  }

  return (
    <div className={rootClass}>
      <LoadingBar active={loading} />
      <header className="qaqc-header">
        <div className="qaqc-title">
          <span className="qaqc-title-icon">
            <Zap size={16} aria-hidden="true" />
          </span>
          <h2>Electrical Inspections</h2>
        </div>
        <div className="qaqc-controls">
          <RangeToggle value={range} recentCount={RECENT_WEEK_COUNT} disabled={!interactive} onChange={setRange} />
          <WorkWeekPicker options={model.weekOptions} valueKey={model.selectedWeek.key} disabled={!interactive} onChange={pickWeek} />
        </div>
      </header>

      <div className="qaqc-kpi-row">
        <KpiGroup title={model.selectedWeek.label} variant="week">
          <KpiCard
            label="Final Inspections"
            icon={ClipboardCheck}
            value={formatCount(thisWeek.finals.value)}
            detail={formatDelta(thisWeek.finals.delta, previousLabel)}
            tone="neutral"
            trend={trendOf(thisWeek.finals.delta)}
          />
          <KpiCard
            label="SORs"
            icon={Wrench}
            value={formatCount(thisWeek.sors.value)}
            detail={formatDelta(thisWeek.sors.delta, previousLabel)}
            tone="neutral"
            trend={trendOf(thisWeek.sors.delta)}
          />
          <KpiCard
            label="Issues Found"
            icon={CircleAlert}
            value={formatCount(thisWeek.issuesFound.value)}
            detail={formatDelta(thisWeek.issuesFound.delta, previousLabel)}
            tone={thisWeek.issuesFound.delta > 0 ? 'warn' : 'neutral'}
            trend={trendOf(thisWeek.issuesFound.delta)}
          />
        </KpiGroup>
        <KpiGroup title="Project to date" subtitle={`Through ${model.selectedWeek.label}`} variant="total">
          <KpiCard
            label="Finals to Date"
            icon={CircleCheck}
            value={formatCount(toDate.finals)}
            detail={`+${formatCount(toDate.finalsThisWeek)} this WW`}
            tone="neutral"
            trend="none"
          />
          <KpiCard
            label="SORs to Date"
            icon={Wrench}
            value={formatCount(toDate.sors)}
            detail={`+${formatCount(toDate.sorsThisWeek)} this WW`}
            tone="neutral"
            trend="none"
          />
          <KpiCard
            label="NCR Pass Rate"
            icon={Gauge}
            value={formatPercent(toDate.passRate)}
            detail={passRateDetail}
            tone={pointsTone(toDate.passRateDeltaPoints)}
            trend={toDate.passRateDeltaPoints === null ? 'none' : trendOf(roundPoints(toDate.passRateDeltaPoints))}
          />
        </KpiGroup>
      </div>

      {!isCardsOnly && (
        <div className="qaqc-charts">
          <ChartPanel
            className="qaqc-panel-main"
            title="Finals + SORs by Work Week"
            icon={ChartColumnStacked}
            legend={[...finalsSorsLegend, { label: 'Issue found', color: colors.bad, shape: 'dot' }]}
            emptyMessage={model.hasData ? null : NO_ROWS_MESSAGE}
          >
            {(size) => (
              <StackedBarChart
                weeks={model.window}
                selectedKey={model.selectedWeek.key}
                width={size.width}
                height={size.height}
                colors={colors}
                interactive={interactive}
                animate={animate}
                describe={describeCharts}
                onSelectWeek={setSelectedKey}
                onHover={onHover}
              />
            )}
          </ChartPanel>
          <ChartPanel
            title="NCR Pass Rate Trend"
            icon={TrendingUp}
            legend={[
              { label: 'Pass rate', color: colors.series1, shape: 'bar' },
              { label: 'Week with NCR', color: colors.bad, shape: 'dot' },
            ]}
            emptyMessage={hasFinalsInWindow ? null : 'No Final inspections in this range'}
          >
            {(size) => (
              <LineChart
                points={model.passRateTrend}
                selectedKey={model.selectedWeek.key}
                width={size.width}
                height={size.height}
                colors={colors}
                describe={describeCharts}
                onHover={onHover}
              />
            )}
          </ChartPanel>
          <ChartPanel
            title="Inspections by Building"
            icon={Building2}
            legend={finalsSorsLegend}
            emptyMessage={model.buildings.length > 0 ? null : NO_ROWS_MESSAGE}
          >
            {(size) => (
              <HorizontalBarChart
                bars={model.buildings}
                other={model.otherBuildings}
                width={size.width}
                height={size.height}
                colors={colors}
                describe={describeCharts}
                onHover={onHover}
              />
            )}
          </ChartPanel>
        </div>
      )}

      <Footnotes notes={footnotes} />
    </div>
  )
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --project qaqc-electrical ElectricalDashboard`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/qaqc-electrical/src/ElectricalDashboard.tsx packages/qaqc-electrical/src/__tests__/ElectricalDashboard.test.tsx
git commit -m "feat: add Electrical dashboard layout with cards, charts, and week state

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18: Power BI adapter (`visual.ts`)

**Files:**
- Create: `packages/qaqc-electrical/src/visual.ts`
- Test: `packages/qaqc-electrical/src/__tests__/visual.test.ts`

- [ ] **Step 1: Write the failing test `packages/qaqc-electrical/src/__tests__/visual.test.ts`**

```ts
import type powerbi from 'powerbi-visuals-api'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createConstructorOptions } from '../../../core/src/__test-utils__'
import { ELECTRICAL_ROWS } from '../../../qaqc-shared/src/__tests__/fixtures/electricalRows'
import { QaqcElectricalVisual } from '../visual'
import { tableDataView } from './tableDataView'

type ConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions
type UpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions

interface Harness {
  visual: QaqcElectricalVisual
  element: HTMLElement
  host: Record<string, unknown>
  events: { renderingStarted: ReturnType<typeof vi.fn>; renderingFinished: ReturnType<typeof vi.fn>; renderingFailed: ReturnType<typeof vi.fn> }
  showContextMenu: ReturnType<typeof vi.fn>
  tooltip: { show: ReturnType<typeof vi.fn>; move: ReturnType<typeof vi.fn>; hide: ReturnType<typeof vi.fn>; enabled: () => boolean }
}

function createHarness(hostOverrides: Record<string, unknown> = {}): Harness {
  const options = createConstructorOptions()
  const events = { renderingStarted: vi.fn(), renderingFinished: vi.fn(), renderingFailed: vi.fn() }
  const showContextMenu = vi.fn(() => Promise.resolve({}))
  const tooltip = { show: vi.fn(), move: vi.fn(), hide: vi.fn(), enabled: () => true }
  Object.assign(options.host, {
    eventService: events,
    tooltipService: tooltip,
    createSelectionManager: () => ({ showContextMenu, select: vi.fn(), clear: vi.fn(), hasSelection: () => false }),
    ...hostOverrides,
  })
  // The core mock host implements the parts of IVisualHost these tests exercise.
  const visual = new QaqcElectricalVisual(options as unknown as ConstructorOptions)
  return { visual, element: options.element, host: options.host, events, showContextMenu, tooltip }
}

function update(dataView: powerbi.DataView | undefined, viewport = { width: 1280, height: 720 }, operationKind = 0): UpdateOptions {
  return { viewport, dataViews: dataView ? [dataView] : [], type: 2, operationKind }
}

function apply(target: Harness, options: UpdateOptions): void {
  act(() => {
    target.visual.update(options)
  })
}

function cardValue(element: HTMLElement, label: string): string | null {
  return element.querySelector(`[aria-label^="${label}:"] .qaqc-kpi-value`)?.textContent ?? null
}

let harness: Harness | null = null

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 15, 12))
})

afterEach(() => {
  harness?.visual.destroy()
  harness?.element.remove()
  harness = null
  vi.useRealTimers()
})

describe('QaqcElectricalVisual', () => {
  it('labels the visual for assistive technology', () => {
    harness = createHarness()
    expect(harness.element.getAttribute('aria-label')).toBe('Electrical inspections dashboard')
  })

  it('lists the missing field slots before data is bound', () => {
    harness = createHarness()
    apply(harness, update(undefined))
    const items = Array.from(harness.element.querySelectorAll('.qaqc-status li')).map((item) => item.textContent)
    expect(items).toEqual([
      'Work Week Observed → Work Week',
      'Inspection Phase → Inspection Phase',
      'Issue? → Issue?',
      'Building → Building',
    ])
  })

  it('renders the dashboard from bound columns', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ELECTRICAL_ROWS)))
    expect(cardValue(harness.element, 'Final Inspections')).toBe('3')
    expect(cardValue(harness.element, 'NCR Pass Rate')).toBe('99.2%')
    expect(harness.element.querySelector('.qaqc-footnotes')).toBeNull()
  })

  it('applies the preset colors as CSS variables', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ELECTRICAL_ROWS)))
    expect(harness.element.style.getPropertyValue('--qaqc-series-1')).toBe('#2E5AAC')
  })

  it('uses host colors in high-contrast mode', () => {
    harness = createHarness({
      colorPalette: {
        isHighContrast: true,
        foreground: { value: '#FFFF00' },
        background: { value: '#000000' },
        foregroundSelected: { value: '#00FFFF' },
      },
    })
    apply(harness, update(tableDataView(ELECTRICAL_ROWS)))
    expect(harness.element.style.getPropertyValue('--qaqc-series-1')).toBe('#FFFF00')
  })

  it('requests more segments and shows the loading bar', () => {
    const fetchMoreData = vi.fn(() => true)
    harness = createHarness({ fetchMoreData })
    apply(harness, update(tableDataView(ELECTRICAL_ROWS, { segment: true })))
    expect(fetchMoreData).toHaveBeenCalledWith(true)
    expect(harness.element.querySelector('[role="progressbar"]')).not.toBeNull()
  })

  it('renders what it has with a footnote when Power BI refuses more segments', () => {
    harness = createHarness({ fetchMoreData: () => false })
    apply(harness, update(tableDataView(ELECTRICAL_ROWS, { segment: true })))
    expect(harness.element.querySelector('.qaqc-footnotes')?.textContent).toContain('Showing the first 288 rows (Power BI data limit)')
  })

  it('reminds the author to bind a Row ID', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ELECTRICAL_ROWS, { roles: ['workWeek', 'phase', 'issue', 'building'] })))
    expect(harness.element.querySelector('.qaqc-footnotes')?.textContent).toContain('Row ID')
  })

  it('reports rendering lifecycle events', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ELECTRICAL_ROWS)))
    expect(harness.events.renderingStarted).toHaveBeenCalledTimes(1)
    expect(harness.events.renderingFinished).toHaveBeenCalledTimes(1)
    expect(harness.events.renderingFailed).not.toHaveBeenCalled()
  })

  it('reports a rendering failure instead of throwing', () => {
    harness = createHarness()
    const broken = tableDataView(ELECTRICAL_ROWS)
    Object.defineProperty(broken.table, 'rows', { get: () => { throw new Error('boom') } })
    expect(() => harness?.visual.update(update(broken))).not.toThrow()
    expect(harness.events.renderingFailed).toHaveBeenCalledWith(expect.anything(), 'boom')
  })

  it('opens the host context menu on right-click', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ELECTRICAL_ROWS)))
    harness.element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 50 }))
    expect(harness.showContextMenu).toHaveBeenCalledWith(expect.anything(), { x: 40, y: 50 })
  })

  it('opens the context menu from the keyboard with Shift+F10', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ELECTRICAL_ROWS)))
    harness.element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'F10', shiftKey: true }))
    expect(harness.showContextMenu).toHaveBeenCalledTimes(1)
  })

  it('does not open the context menu when interactions are blocked', () => {
    harness = createHarness({ hostCapabilities: { allowInteractions: false } })
    apply(harness, update(tableDataView(ELECTRICAL_ROWS)))
    harness.element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    expect(harness.showContextMenu).not.toHaveBeenCalled()
  })

  it('returns a Format pane model with four cards', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ELECTRICAL_ROWS)))
    expect(harness.visual.getFormattingModel().cards).toHaveLength(4)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project qaqc-electrical visual`
Expected: FAIL, cannot resolve `../visual`.

- [ ] **Step 3: Implement `packages/qaqc-electrical/src/visual.ts`**

```ts
import { ListChecks, LoaderCircle } from 'lucide-react'
import type powerbi from 'powerbi-visuals-api'
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel'
import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'

import type { TooltipRequest } from '../../qaqc-shared/src/chartTypes'
import { StatusPanel } from '../../qaqc-shared/src/components/StatusPanel'
import { buildFootnotes } from '../../qaqc-shared/src/footnotes'
import { buildInspectionIndex } from '../../qaqc-shared/src/inspections'
import { resolveTheme, type HighContrastColors, type ResolvedTheme } from '../../qaqc-shared/src/theme'
import type { InspectionIndex } from '../../qaqc-shared/src/types'
import { readInspectionTable, type FieldSlot, type TableReadResult } from './dataView'
import { ElectricalDashboard } from './ElectricalDashboard'
import { ElectricalSettingsModel, readDisplaySettings } from './settings'

type VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions
type VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions
type IVisualHost = powerbi.extensibility.visual.IVisualHost

// powerbi.VisualUpdateType.Data and powerbi.VisualDataChangeOperationKind.Create.
// The API package has no runtime enums, so the const enum values are spelled out.
const DATA_UPDATE_FLAG = 2
const CREATE_OPERATION = 0

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export class QaqcElectricalVisual implements powerbi.extensibility.visual.IVisual {
  private readonly host: IVisualHost
  private readonly element: HTMLElement
  private readonly root: Root
  private readonly selectionManager: powerbi.extensibility.ISelectionManager
  private readonly formattingSettingsService: FormattingSettingsService
  private settings = new ElectricalSettingsModel()
  private table: TableReadResult | null = null
  private index: InspectionIndex | null = null
  private loading = false
  private rowLimitReached = false
  private viewport: powerbi.IViewport = { width: 0, height: 0 }

  constructor(options: VisualConstructorOptions) {
    this.host = options.host
    this.element = options.element
    this.element.classList.add('qaqc-host')
    this.element.setAttribute('role', 'region')
    this.element.setAttribute('aria-label', 'Electrical inspections dashboard')
    this.selectionManager = this.host.createSelectionManager()
    this.formattingSettingsService = new FormattingSettingsService(this.host.createLocalizationManager())
    this.root = createRoot(this.element)
    this.element.addEventListener('contextmenu', this.handleContextMenu)
    this.element.addEventListener('keydown', this.handleKeyDown)
  }

  public update(options: VisualUpdateOptions): void {
    this.notifyRenderingStarted(options)
    try {
      const dataView = options.dataViews?.[0]
      this.viewport = options.viewport
      this.settings = dataView
        ? this.formattingSettingsService.populateFormattingSettingsModel(ElectricalSettingsModel, dataView)
        : new ElectricalSettingsModel()
      if (options.operationKind === CREATE_OPERATION) this.rowLimitReached = false

      if (dataView?.metadata.segment && !this.rowLimitReached) {
        if (this.host.fetchMoreData(true)) {
          this.loading = true
          this.render()
          this.notifyRenderingFinished(options)
          return
        }
        this.rowLimitReached = true
      }

      const isDataUpdate = (options.type & DATA_UPDATE_FLAG) !== 0
      if (isDataUpdate || this.table === null) {
        this.table = readInspectionTable(dataView)
        this.index = this.table.kind === 'ready'
          ? buildInspectionIndex(this.table.rows, this.table.columns, new Date())
          : null
      }
      this.loading = false
      this.render()
      this.notifyRenderingFinished(options)
    } catch (error) {
      this.notifyRenderingFailed(options, error instanceof Error ? error.message : String(error))
    }
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings)
  }

  public destroy(): void {
    this.element.removeEventListener('contextmenu', this.handleContextMenu)
    this.element.removeEventListener('keydown', this.handleKeyDown)
    this.root.unmount()
  }

  private render(): void {
    const display = readDisplaySettings(this.settings)
    const theme = resolveTheme({
      preset: display.preset,
      backgroundColor: display.backgroundColor,
      backgroundOpacity: display.backgroundOpacity,
      cardOpacity: display.cardOpacity,
      highContrast: this.highContrastColors(),
    })
    this.applyTheme(theme)

    if (this.index === null || this.table === null || this.table.kind === 'missing') {
      if (this.loading) {
        this.renderLoadingState()
        return
      }
      this.renderEmptyState(this.table?.kind === 'missing' ? this.table.missing : [])
      return
    }

    const index = this.index
    const footnotes = buildFootnotes(index, this.table.hasRowId, this.rowLimitReached)
    flushSync(() => {
      this.root.render(
        createElement(ElectricalDashboard, {
          index,
          theme,
          interactive: this.interactionsAllowed(),
          animate: display.animate && !prefersReducedMotion(),
          describeCharts: display.describeCharts,
          loading: this.loading,
          footnotes,
          viewport: { width: this.viewport.width, height: this.viewport.height },
          onHover: this.handleTooltip,
        }),
      )
    })
  }

  /** Setup state: tells the author which Smartsheet columns still need a field slot. */
  private renderEmptyState(missing: FieldSlot[]): void {
    flushSync(() => {
      this.root.render(
        createElement(StatusPanel, {
          icon: ListChecks,
          title: 'Add the Electrical Inspection Log columns',
          message: 'Drag these columns from your Smartsheet table into the matching field slots.',
          items: missing.map((slot) => `${slot.column} → ${slot.slot}`),
        }),
      )
    })
  }

  private renderLoadingState(): void {
    flushSync(() => {
      this.root.render(
        createElement(StatusPanel, {
          icon: LoaderCircle,
          title: 'Loading inspections',
          message: 'Power BI is sending the rows in batches.',
          items: [],
        }),
      )
    })
  }

  private applyTheme(theme: ResolvedTheme): void {
    for (const [name, value] of Object.entries(theme.cssVariables)) {
      this.element.style.setProperty(name, value)
    }
  }

  private highContrastColors(): HighContrastColors | null {
    const palette = this.host.colorPalette
    if (!palette.isHighContrast) return null
    return {
      foreground: palette.foreground.value,
      background: palette.background.value,
      foregroundSelected: palette.foregroundSelected.value,
    }
  }

  private interactionsAllowed(): boolean {
    return this.host.hostCapabilities?.allowInteractions !== false
  }

  private openContextMenu(x: number, y: number): void {
    if (!this.interactionsAllowed()) return
    const emptySelection = this.host.createSelectionIdBuilder().createSelectionId()
    void this.selectionManager.showContextMenu(emptySelection, { x, y })
  }

  private readonly handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault()
    this.openContextMenu(event.clientX, event.clientY)
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return
    event.preventDefault()
    const bounds = this.element.getBoundingClientRect()
    this.openContextMenu(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
  }

  private readonly handleTooltip = (request: TooltipRequest | null): void => {
    if (request === null) {
      this.host.tooltipService.hide({ immediately: true, isTouchEvent: false })
      return
    }
    const bounds = this.element.getBoundingClientRect()
    this.host.tooltipService.show({
      coordinates: [request.clientX - bounds.left, request.clientY - bounds.top],
      isTouchEvent: false,
      identities: [],
      dataItems: request.rows.map((row) => ({ displayName: row.label, value: row.value, header: request.title })),
    })
  }

  private notifyRenderingStarted(options: VisualUpdateOptions): void {
    this.host.eventService?.renderingStarted(options)
  }

  private notifyRenderingFinished(options: VisualUpdateOptions): void {
    this.host.eventService?.renderingFinished(options)
  }

  private notifyRenderingFailed(options: VisualUpdateOptions, reason: string): void {
    this.host.eventService?.renderingFailed(options, reason)
  }
}
```

- [ ] **Step 4: Run the visual tests**

Run: `npx vitest run --project qaqc-electrical visual`
Expected: PASS, 14 tests. If `createConstructorOptions` is not exported from `../../../core/src/__test-utils__`, import it from `../../../core/src/__test-utils__/mock-constructor` instead.

- [ ] **Step 5: Run every QAQC test and the repo typecheck**

Run: `npx vitest run --project qaqc-shared --project qaqc-electrical && npm run typecheck`
Expected: all PASS; typecheck exit 0. If typecheck reports `palette.background` or `palette.foregroundSelected` missing on `ISandboxExtendedColorPalette`, open `node_modules/powerbi-visuals-api/src/visuals-api.d.ts`, find the interface, and use the property names it declares.

- [ ] **Step 6: Commit**

```bash
git add packages/qaqc-electrical/src/visual.ts packages/qaqc-electrical/src/__tests__/visual.test.ts
git commit -m "feat: add Power BI adapter for the Electrical visual

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 19: Browser preview harness and visual verification

**Files:**
- Create: `packages/qaqc-electrical/dev/vite.config.ts`, `dev/index.html`, `dev/main.tsx`, `dev/vite-env.d.ts`
- Modify: `.claude/launch.json` (create if missing)

- [ ] **Step 1: Create `packages/qaqc-electrical/dev/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname),
  server: { host: '127.0.0.1', port: 5190, strictPort: true },
});
```

- [ ] **Step 2: Create `packages/qaqc-electrical/dev/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 3: Create `packages/qaqc-electrical/dev/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>QAQC Electrical preview</title>
    <style>
      body {
        margin: 0;
        padding: 24px;
        background: repeating-conic-gradient(#e6e6e6 0% 25%, #ffffff 0% 50%) 0 0 / 20px 20px;
        font-family: system-ui, sans-serif;
      }
      #frame {
        position: relative;
        outline: 1px dashed #9aa4b2;
      }
      #tooltip {
        position: fixed;
        z-index: 10;
        display: none;
        padding: 8px 10px;
        border-radius: 8px;
        background: #1b2530;
        color: #fff;
        font-size: 11.5px;
        pointer-events: none;
      }
    </style>
  </head>
  <body>
    <div id="frame"></div>
    <div id="tooltip"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create `packages/qaqc-electrical/dev/main.tsx`**

Query parameters: `preset` (qaqc|blue|lotusworks|grayscale), `bg` and `card` (0–100), `color` (hex override), `data` (fixture|synthetic|empty|missing|loading), `rows` (synthetic row count), `w` and `h` (viewport), `interactive` (1|0), `hc` (1 = high contrast).

```tsx
import { ListChecks, LoaderCircle } from 'lucide-react'
import { createRoot } from 'react-dom/client'

import '../style/visual.less'

import { ELECTRICAL_ROWS } from '../../qaqc-shared/src/__tests__/fixtures/electricalRows'
import { syntheticInspectionRows } from '../../qaqc-shared/src/__tests__/fixtures/syntheticRows'
import type { TooltipRequest } from '../../qaqc-shared/src/chartTypes'
import { StatusPanel } from '../../qaqc-shared/src/components/StatusPanel'
import { buildFootnotes } from '../../qaqc-shared/src/footnotes'
import { buildInspectionIndex } from '../../qaqc-shared/src/inspections'
import { isPresetName, resolveTheme } from '../../qaqc-shared/src/theme'
import { REQUIRED_SLOTS } from '../src/dataView'
import { ElectricalDashboard } from '../src/ElectricalDashboard'

const params = new URLSearchParams(window.location.search)
const width = Number(params.get('w') ?? 1280)
const height = Number(params.get('h') ?? 720)
const presetParam = params.get('preset') ?? 'qaqc'
const data = params.get('data') ?? 'fixture'
const today = new Date(2026, 9, 15)

const frame = document.getElementById('frame')
const tooltip = document.getElementById('tooltip')
if (!frame || !tooltip) throw new Error('preview markup missing')
frame.style.width = `${width}px`
frame.style.height = `${height}px`
frame.classList.add('qaqc-host')

const theme = resolveTheme({
  preset: isPresetName(presetParam) ? presetParam : 'qaqc',
  backgroundColor: params.get('color') ?? '',
  backgroundOpacity: Number(params.get('bg') ?? 100),
  cardOpacity: Number(params.get('card') ?? 100),
  highContrast: params.get('hc') === '1' ? { foreground: '#FFFF00', background: '#000000', foregroundSelected: '#00FFFF' } : null,
})
for (const [name, value] of Object.entries(theme.cssVariables)) frame.style.setProperty(name, value)

function showTooltip(request: TooltipRequest | null): void {
  if (!tooltip) return
  if (request === null) {
    tooltip.style.display = 'none'
    return
  }
  tooltip.innerHTML = ''
  const title = document.createElement('strong')
  title.textContent = request.title
  tooltip.appendChild(title)
  for (const row of request.rows) {
    const line = document.createElement('div')
    line.textContent = `${row.label}: ${row.value}`
    tooltip.appendChild(line)
  }
  tooltip.style.left = `${request.clientX + 12}px`
  tooltip.style.top = `${request.clientY + 12}px`
  tooltip.style.display = 'block'
}

const root = createRoot(frame)
const columns = { workWeek: 0, phase: 1, issue: 2, building: 3 }

if (data === 'missing') {
  root.render(
    <StatusPanel
      icon={ListChecks}
      title="Add the Electrical Inspection Log columns"
      message="Drag these columns from your Smartsheet table into the matching field slots."
      items={REQUIRED_SLOTS.map((slot) => `${slot.column} → ${slot.slot}`)}
    />,
  )
} else if (data === 'loading') {
  root.render(<StatusPanel icon={LoaderCircle} title="Loading inspections" message="Power BI is sending the rows in batches." items={[]} />)
} else {
  const rows = data === 'synthetic'
    ? syntheticInspectionRows(Number(params.get('rows') ?? 500_000))
    : data === 'empty' ? [] : ELECTRICAL_ROWS
  const started = performance.now()
  const index = buildInspectionIndex(rows, columns, today)
  document.title = `index ${Math.round(performance.now() - started)} ms`
  root.render(
    <ElectricalDashboard
      index={index}
      theme={theme}
      interactive={params.get('interactive') !== '0'}
      animate
      describeCharts
      loading={false}
      footnotes={buildFootnotes(index, true, false)}
      viewport={{ width, height }}
      onHover={showTooltip}
    />,
  )
}
```

- [ ] **Step 5: Add a launch configuration in `.claude/launch.json`**

If the file exists, add this entry to `configurations`; otherwise create it with:

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "qaqc-electrical-dev",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev", "-w", "@pbi/qaqc-electrical"],
      "port": 5190
    }
  ]
}
```

- [ ] **Step 6: Typecheck the harness**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 7: Visual verification (VVP)**

Start the preview with the Browser pane tool `preview_start` using name `qaqc-electrical-dev`. For each URL below, navigate, take a screenshot, and check every listed item. Fix any failure in source, then re-check the same URL. Do not move on with a visual defect: if it works but looks broken, it is broken.

| URL (append to `http://127.0.0.1:5190/`) | Must be true |
|---|---|
| `?preset=qaqc` | Header: Zap tile, "Electrical Inspections", `30 WW` active, `WW42'2026`. One card row, height ≤ ~15% of 720 (≤ 108px). Cards: 3 / 3 / 0 and 238 / 48 / 99.2%. Main chart spans the left two-thirds and full chart height; Pass Rate and Building stacked on the right. Red issue badges showing "1" above WW22 and WW23, and red dots at WW22 and WW23 on the Pass Rate line. WW42 band shaded and its label bold. No overlapping axis labels. |
| `?preset=qaqc` then click the WW35 bar | Week group title becomes WW35'2026; cards change; the chart does not move; WW35 band highlighted. |
| `?preset=qaqc` then pick WW20'2026 in the dropdown | Short history: window runs WW51'2025 to WW20'2026, no issue badges, WW20 selected and labeled. |
| `?preset=qaqc` then click `All` | Bars from WW51'2025 to WW42'2026, labels thinned, nothing overlaps. |
| `?preset=blue` | Off-white page, white cards, Ivory blue Finals, light blue SORs, dark navy text; badges and NCR dots still red. |
| `?preset=lotusworks` and `?preset=grayscale` | Series colors per spec table; status colors unchanged. |
| `?bg=0&card=0` | Checkerboard shows through page and cards; borders and text still legible. |
| `?w=800&h=900` | Compact: card groups stacked, charts in one column, header wraps cleanly. |
| `?w=1280&h=380` | Cards only, no charts, nothing clipped. |
| `?data=missing` and `?data=loading` | Centered status panel with icon, title, message (and the four `column → slot` items for missing). |
| `?data=empty` | Cards show 0 / n/a; chart panels show "No inspections match the current filters". |
| `?hc=1` | Black background, yellow/cyan marks, all text readable. |
| `?data=synthetic&rows=500000&preset=qaqc` | Page title shows index time; record it. Click bars, toggle All, change weeks: each responds without visible lag. |

Hover any bar, point, and building row once and confirm the preview tooltip shows the expected rows.

- [ ] **Step 8: Record timings**

Run: `npx vitest run --project qaqc-shared benchmark --reporter=verbose`
Record the three durations alongside the synthetic preview's index time in the Task 22 summary.

- [ ] **Step 9: Commit**

```bash
git add packages/qaqc-electrical/dev .claude/launch.json
git commit -m "chore: add Electrical visual browser preview harness

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 20: Build the `.pbiviz` and pass the review gate

**Files:**
- Modify: `Business_Package/review-report.json`, `LotusWorks_Package/review-report.json` (generated by the review script)

- [ ] **Step 1: Build**

Run: `npm run build -w @pbi/qaqc-electrical`
Expected: `packages/qaqc-electrical/dist/qaqcElectrical_6B2E9D4A1C7F.1.0.0.0.pbiviz` exists. Run `ls -lh packages/qaqc-electrical/dist/*.pbiviz` and note the size (expect well under 1 MB; React + react-dom add roughly 150–200 KB minified).

- [ ] **Step 2: Run the review gate**

Run: `npm run review:business`
Then run:

```bash
node -e "const r=require('./Business_Package/review-report.json');const p=r.packages.find(x=>x.package==='qaqc-electrical');console.log(JSON.stringify(p.issues,null,2));process.exit(p.issueCount===0?0:1)"
```

Expected: `[]` and exit 0. If any issue appears, fix the cause in the named file (not by adding dead code to satisfy a pattern), rebuild, and re-run both commands.

- [ ] **Step 3: Confirm the full test suite still passes**

Run: `npx vitest run`
Expected: all test files pass (the existing 1,028 tests plus the new QAQC tests).

- [ ] **Step 4: Commit**

```bash
git add Business_Package/review-report.json LotusWorks_Package/review-report.json
git commit -m "chore: record review gate results with the Electrical visual

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 21: Setup guide, package sync, and release zip

**Files:**
- Create: `LotusWorks_Package/QAQC_Electrical_SETUP.md`
- Modify: `Business_Package/*.pbiviz`, `LotusWorks_Package/*.pbiviz` (sync scripts)

- [ ] **Step 1: Create `LotusWorks_Package/QAQC_Electrical_SETUP.md`**

```markdown
# QAQC Electrical Inspections visual: setup

## 1. Import the visual (once per report)

1. In Power BI Desktop, open the Visualizations pane, select the three dots (…), then **Import a visual from a file**.
2. Choose `qaqcElectrical_6B2E9D4A1C7F.<version>.pbiviz`.
3. To update later, import the newer file the same way. It replaces the old version in place and keeps your field bindings.

## 2. Add a Row ID (Power Query, once per report)

Power BI merges rows that are identical in every bound column. To keep every inspection:

1. **Home → Transform data**, select the Electrical Inspection Log query.
2. **Add Column → Index Column → From 1**.
3. **Close & Apply**.

## 3. Bind the columns

| Field slot | Smartsheet column |
|---|---|
| Work Week | Work Week Observed |
| Inspection Phase | Inspection Phase |
| Issue? | Issue? |
| Building | Building |
| Row ID | Index |

Set every field to **Don't summarize**. The visual is designed to fill a full report page.

## 4. Use it

- The week dropdown opens on the current work week every time the report opens.
- `30 WW | All` switches the charts between the last 30 weeks and full history.
- Click a bar to see that week's cards without moving the chart.
- Format pane: **Colors → Preset** (QAQC, Ivory, LotusWorks, Grayscale), **Background** (color, background opacity, card opacity), **Animation**, **Accessibility**.

## Counting rules

- **Final:** Inspection Phase is Final (any case) or contains "final inspection". **SOR:** contains "SOR".
- **Issues Found:** Final rows whose Issue? is filled in and is not "No Issue Found". SOR rows never count.
- **NCR Pass Rate:** Finals with no issue ÷ all Finals, through the selected week.
```

- [ ] **Step 2: Sync the packages**

Run: `npm run sync:business && npm run sync:lotusworks`
Expected: both report copying 34 `.pbiviz` files (33 existing + the Electrical visual).
Then run: `ls LotusWorks_Package | grep -c '\.pbiviz$' && ls LotusWorks_Package | grep qaqcElectrical`
Expected: `34` and `qaqcElectrical_6B2E9D4A1C7F.1.0.0.0.pbiviz`.
Then run: `git status --short Business_Package LotusWorks_Package`
Expected: only the new `qaqcElectrical_…pbiviz` files, the setup guide, and the review reports changed. If other `.pbiviz` files changed, STOP: the sync rebuilt or replaced visuals it should not have. Restore them with `git checkout -- Business_Package LotusWorks_Package` and investigate before continuing.

- [ ] **Step 3: Create the release zip**

Run:

```bash
mkdir -p releases
(cd LotusWorks_Package && zip -qr ../releases/LotusWorks_Package_2026-10-15_QAQC-Electrical-1.0.0.zip .)
unzip -l releases/LotusWorks_Package_2026-10-15_QAQC-Electrical-1.0.0.zip | grep -E 'qaqcElectrical|QAQC_Electrical_SETUP'
```

Expected: both files listed. (`releases/` is gitignored; the zip stays local for transfer.)

- [ ] **Step 4: Commit**

```bash
git add LotusWorks_Package Business_Package
git commit -m "feat: package QAQC Electrical visual 1.0.0 with setup guide

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 22: Final verification

- [ ] **Step 1: Full checks**

Run: `npm run typecheck && npx vitest run && npm run review:business`
Expected: typecheck exit 0; all tests pass; review shows `errors=0` and the `qaqc-electrical` entry has 0 issues.

- [ ] **Step 2: Self-review the diff**

Run: `git diff chore/visual-package-updates --stat` and read every changed source file once. Check for:
- leftover `console.log` outside `scripts/` (none allowed)
- `any`, unchecked `as` casts outside tests
- em dashes in UI strings (`grep -rn $'—' packages/qaqc-shared/src packages/qaqc-electrical/src` must print nothing)
- functions missing explicit return types

- [ ] **Step 3: Summarize for the user**

Report: what was built, the `.pbiviz` path and size, the release zip path, benchmark timings from Task 19 Step 8, screenshots from Task 19 Step 7 (at least default, Ivory, transparent, compact), and the manual Power BI Desktop smoke test the user needs to run on the work laptop (import, bind with Index, check WW42 numbers 3 / 3 / 0 / 238 / 48 / 99.2%).
