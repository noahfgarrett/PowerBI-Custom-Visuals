# QCx Filter Menu and Week Drill-Down Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Filter menu with a date range to all six QCx dashboards, a click-a-week issue drill-down, and Created By (Company) plus NCR Pass Rate on QCx Issues.

**Architecture:**
- A pure filter core and shared `FilterMenu` / `FilterChips` / `useDashboardFilters` live in `packages/qaqc-shared/src`.
- Each `visual.ts` keeps building the base index once per update and also passes its rows and columns. A dashboard uses that base index until a field filter is active, then rebuilds from the matching rows inside a memo, so no-filter behaviour and its budgets don't change.
- Date range is view state (`ViewState.dateRange`), restated by each model from its cumulative series, not a row filter.
- Drill-down reads per-week row positions kept in each index and opens through `ChartExpansionFrame` `kind: 'page'`.

**Tech Stack:** TypeScript strict, React 19.2.7, lucide-react 1.24.0, powerbi-visuals-api ~5.3.0, pbiviz 5, vitest + jsdom, Power Query (M).

**Spec:** `docs/superpowers/specs/2026-11-04-qcx-filters-drilldown-design.md`. Read it first; it is binding. Mockup for look and behaviour: `/private/tmp/claude-501/-Users-noahgarrett-Codebase-QAQC-Weekly-Report/758b0a9f-4c45-496f-be89-b387c5cbd742/scratchpad/filter-mockup/filter-mockup.html` (read-only, holds real rows, never copy it into the repo).

## Global Constraints

- No new npm dependencies. TypeScript strict, no `any`, no `as` except the JSON-import and mock-host patterns, explicit return types, exhaustive switches with `never`, no `console.log`, lucide icons only, no emoji.
- With no filter set, every existing fixture and snapshot test passes unchanged. Enriched fixture: 231 issues, 175 closed, 56 remaining.
- All new slots are optional. A visual with none of them bound behaves exactly as it does today, plus a Filter button holding Date range.
- Metric name is exactly `NCR Pass Rate`, with no small print on its cards. Menu copy: `Filter`, `Date range`, `From`, `To`, `Last 4 WW`, `Last 13 WW`, `This year`, `Clear all`, `Select all`, `Showing X of Y rows`, `Not recorded`, `Clear filters`.
- GUIDs, pbiviz names and class names don't change. `visual.ts` and `settings.ts` stay per package. Only the versions in the spec's Delivery table change, in Task 10.
- Fixtures contain no personal names. Company names are allowed. Nothing derived from FFU MAP.pdf.
- Working branch `feat/qcx-filters`. Conventional commits, each ending with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Don't merge, push or email.
- Run tests from the repo root: `npx vitest run --project <name>`. Typecheck: `npm run typecheck`. Don't use `npm run package:business`; it fails on unrelated visuals.

## Review Focus

1. **Non-text cells:** Power BI sends numbers and `Date` values for some columns (Issue ID, Qty, Date Observed). Grouping, search, chips and the drill-down must show them as text a person recognises, and never `[object Object]` or an ISO timestamp. *(Tasks 1, 4)*
2. **A filter that shortens the week axis:** a filtered index starts at its first matching week, while the selected week and the date range came from the full data. The selection must stay valid, the From/To dropdowns must keep listing the full data's weeks, and nothing may throw. *(Task 3)*
3. **Refresh with the menu open or filters set:** rows change under the menu during segmented loading. Ticked values no longer in the data drop out, the counts update, and an emptied selection means no filter on that field rather than no rows. *(Task 2)*
4. **Esc order and focus:** Esc closes the open menu first, then the page under it. Focus returns to the Filter button or the chart, never to `body`. *(Tasks 2, 4)*
5. **A row with no readable week:** skipped and future-dated rows still count toward `Showing X of Y` the same way each time, and the existing skipped/future footnotes reflect the filtered rows without contradicting it. *(Task 3)*

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/qaqc-shared/src/rowFilters.ts` | Pure: value grouping, catalogue, row matching, selection helpers |
| `packages/qaqc-shared/src/weekRange.ts` | Pure: `WeekRange`, presets, clamping, range equals-all check |
| `packages/qaqc-shared/src/hooks/useDashboardFilters.ts` | Filter and date range state, filtered rows, menu and chip props |
| `packages/qaqc-shared/src/components/FilterMenu.tsx` | Button and popover |
| `packages/qaqc-shared/src/components/FilterChips.tsx` | Chips, Clear all, per-source notes |
| `packages/qaqc-shared/src/components/WeekIssuesPage.tsx` | The drill-down page |
| `packages/qaqc-shared/src/drilldown.ts` | Column definitions and row selection per source |
| `packages/qaqc-shared/src/dataView.ts`, `types.ts` | New optional column positions |
| Existing dashboards and models | Wiring per Tasks 3–9 |
| `LotusWorks_Package/QCx_Combined.pq` and both guide folders | Script and docs (Task 8, Task 10) |

---

### Task 1: Filter core and week ranges

**Files:**
- Create: `packages/qaqc-shared/src/rowFilters.ts`, `packages/qaqc-shared/src/weekRange.ts`
- Test: `packages/qaqc-shared/src/__tests__/rowFilters.test.ts`, `__tests__/weekRange.test.ts`, `__tests__/rowFiltersBenchmark.test.ts`
- Modify: `packages/qaqc-shared/vitest.timing.config.ts` (add the benchmark to `TIMING_TESTS`)

**Interfaces — produces:**
```ts
// rowFilters.ts
export const NOT_RECORDED_LABEL = 'Not recorded'
export type Row = ReadonlyArray<unknown>
export interface FilterFieldDef {
  id: string
  label: string
  /** The row's value or values, as the dashboard shows them; '' means blank. */
  read: (row: Row) => string | readonly string[]
  /** Replaces "Not recorded" for fields a chart already labels ('Unspecified', 'Unassigned'). */
  blankLabel?: string
  /** A row this returns false for is not filtered by this field, and adds nothing to its counts. */
  appliesTo?: (row: Row) => boolean
  /** Group keys ticked when nothing else is. A selection equal to this isn't an active filter. */
  defaultKeys?: readonly string[]
  hasSelectAll?: boolean
}
export interface FilterOption { key: string; label: string; count: number; isBlank: boolean }
export interface CatalogField { def: FilterFieldDef; options: FilterOption[] }
export interface FilterCatalog { fields: CatalogField[]; totalRows: number }
export type FilterSelection = ReadonlyMap<string, ReadonlySet<string>> // field id → group keys
export const NO_SELECTION: FilterSelection
export function groupKey(text: string): string // trimmed, lower-cased; blank, n/a, na, none, - → BLANK_KEY
export function cellDisplayText(value: unknown): string // Date → yyyy-mm-dd, others text, null → ''
export function buildFilterCatalog(rows: ReadonlyArray<Row>, fields: readonly FilterFieldDef[]): FilterCatalog
export function normalizeSelection(selection: FilterSelection, catalog: FilterCatalog): FilterSelection // drops vanished keys and empty sets
export function isFieldActive(field: CatalogField, keys: ReadonlySet<string> | undefined): boolean
export function activeFieldCount(catalog: FilterCatalog, selection: FilterSelection): number
export function matchRows(rows: ReadonlyArray<Row>, catalog: FilterCatalog, selection: FilterSelection): ReadonlyArray<Row> // same array reference when no field is active
// weekRange.ts
export interface WeekRange { fromKey: number; toKey: number }
export interface RangeWeek { key: number; label: string }
export type RangePreset = 'last4' | 'last13' | 'thisYear'
export function presetRange(preset: RangePreset, weeks: readonly RangeWeek[], currentKey: number): WeekRange
export function clampRange(range: WeekRange, weeks: readonly RangeWeek[]): WeekRange | null // null when it equals all of `weeks`
```

- [ ] **Step 1: Write failing tests.** One behaviour per test:
  - `groups values trimmed and ignoring case, showing the most common spelling` (`ELECTRICAL`×2, `Electrical`×5 → one option, label `Electrical`, count 7).
  - `groups blank, N/A, n/a, NA, None and - into Not recorded, listed last`.
  - `uses blankLabel in place of Not recorded when set`.
  - `sorts options by count descending, Not recorded last`.
  - `shows a Date cell as yyyy-mm-dd and a number as its text` *(Review Focus 1)*.
  - `matches OR within a field and AND across fields`.
  - `returns the same rows array when nothing is active`.
  - `a multi-value read matches a row if any value is ticked, and counts the row once per value in options but once in matchRows` (Welder `P-012, PF-025`).
  - `appliesTo false leaves the row in the result and out of the field's counts`.
  - `a selection equal to defaultKeys isn't active, and an empty selection on a field with defaultKeys falls back to the default`.
  - `normalizeSelection drops keys no longer in the catalog and removes emptied fields`.
  - `presetRange: last4 covers 4 weeks including the current one; thisYear starts at the current year's first week`.
  - `clampRange pulls limits into the data and returns null when it covers all weeks`.
  - Timing (in `rowFiltersBenchmark.test.ts`, with `bestOf(TIMING_RUNS, …)`, 100,000 rows, 6 fields, 3 active): `matchRows under 50 ms`, `buildFilterCatalog under 300 ms`.

- [ ] **Step 2: Run them.** `npx vitest run packages/qaqc-shared/src/__tests__/rowFilters.test.ts packages/qaqc-shared/src/__tests__/weekRange.test.ts`. Expected: FAIL, modules missing.

- [ ] **Step 3: Implement both modules.** Cache `groupKey` by raw string in `buildFilterCatalog` and `matchRows`, as `isIncludedCreator` does.

- [ ] **Step 4: Run them plus** `npx vitest run --project qaqc-shared-timing`. Expected: PASS.

- [ ] **Step 5: Commit.** `feat: add the shared row filter core and week ranges`

---

### Task 2: Filter menu, chips and state hook

**Files:**
- Create: `packages/qaqc-shared/src/components/FilterMenu.tsx`, `components/FilterChips.tsx`, `hooks/useDashboardFilters.ts`
- Modify: `packages/qaqc-shared/src/components/DashboardHeader.tsx`, `src/qaqc.less`
- Test: `__tests__/FilterMenu.test.tsx`, `__tests__/useDashboardFilters.test.tsx`

**Interfaces — consumes:** Task 1. **Produces:**
```ts
// useDashboardFilters.ts
export interface FilterSourceNote { message: string; whenFieldActive: readonly string[] } // field ids
export interface DashboardFiltersOptions {
  rows: ReadonlyArray<Row>
  fields: readonly FilterFieldDef[]
  /** The full data's weeks, for From and To. Never the filtered index's weeks. */
  weeks: readonly RangeWeek[]
  currentKey: number
  notes?: readonly FilterSourceNote[]
}
export interface DashboardFilters {
  filteredRows: ReadonlyArray<Row> // same reference as `rows` when no field is active
  dateRange: WeekRange | null
  isAnyActive: boolean
  isFieldFilterActive: boolean
  menu: FilterMenuProps
  chips: FilterChipsProps
  clearAll: () => void
}
export function useDashboardFilters(options: DashboardFiltersOptions): DashboardFilters
```
`DashboardHeader` gains `filterMenu?: FilterMenuProps` and `isRangeDisabled?: boolean`. `FilterMenu` renders the `ListFilter` button before `RangeToggle`; `FilterChips` renders under the header, by the dashboard.

- [ ] **Step 1: Write failing tests**, using `render` from `__tests__/render.tsx`:
  - `opens on click and closes on Esc and outside click, returning focus to the button` *(Review Focus 4)*.
  - `Esc on the open menu stops propagation, so a parent Esc handler doesn't fire` *(Review Focus 4)*.
  - `ticking a value applies immediately and updates Showing X of Y rows`.
  - `shows a count badge of active groups; date range counts as one`.
  - `default-only selection shows no badge and no chip`.
  - `unticking every value on a default field returns to the default`.
  - `Select all ticks every value on a field with hasSelectAll`.
  - `Clear all restores defaults and clears the range`.
  - `search narrows a field's list; counts come from unfiltered rows`.
  - `chips list values by label; removing a chip clears only that group`.
  - `a note shows only while its field is active`.
  - `selection survives new rows, dropping vanished values; emptied fields mean no filter` *(Review Focus 3)*.
  - `From and To list the full weeks and presets set them; a range equal to all weeks isn't active`.
  - `the button is disabled when interactive is false`.
  - Accessibility: `button has aria-expanded and aria-haspopup, the popover role="dialog" with a label, each checkbox a name including its count`.
  - Stylesheet (`__tests__/stylesheet.ts` `ruleBody`): `.qaqc-filter-popover` limits its height and scrolls.

- [ ] **Step 2: Run.** `npx vitest run packages/qaqc-shared/src/__tests__/FilterMenu.test.tsx packages/qaqc-shared/src/__tests__/useDashboardFilters.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement.** `.qaqc-filter-*` rules use existing tokens and match the mockup. The first field section starts open. Sections collapse independently. Handle Esc with `stopPropagation` on the popover so `ChartExpansionFrame` doesn't see it. All dashboards' existing header snapshots stay unchanged when `filterMenu` is undefined.

- [ ] **Step 4: Run** the same tests and `npx vitest run --project qaqc-shared`. Expected: PASS.

- [ ] **Step 5: Commit.** `feat: add the filter menu, chips and state hook`

---

### Task 3: Date range in the view, and filters on Electrical and Mechanical

**Files:**
- Modify: `packages/qaqc-shared/src/types.ts` (`ViewState`, `InspectionModel`), `hooks/useWeekWindow.ts`, `inspections.ts`, `dataView.ts`, `components/InspectionDashboard.tsx`, `components/WorkWeekPicker.tsx`; `packages/qaqc-electrical/{capabilities.json,src/visual.ts,stringResources/en-US/resources.resjson}` and the same for `qaqc-mechanical`
- Test: `__tests__/useWeekWindow.test.tsx`, `__tests__/inspectionModel.test.ts`, `__tests__/InspectionDashboard.test.tsx`, `__tests__/dataView.test.ts`, each package's `visual.test.ts`

**Interfaces — consumes:** Tasks 1–2. **Produces:**
```ts
export interface ViewState { selectedKey: number; windowEndKey: number; range: RangeMode; dateRange: WeekRange | null }
export function useWeekWindow(index: WeekWindowIndex, dateRange?: WeekRange | null): WeekWindow
export interface InspectionOptionalColumns { // positions, −1 when unbound
  generalContractor: number; tradeSupplier: number; discipline: number; inspectionCategory: number; status: number
  inspectionId: number; equipmentTag: number; issueId: number; findingType: number; dateObserved: number; qcr: number; notes: number
}
export type TableReadResult =
  | { kind: 'missing'; missing: FieldSlot[] }
  | { kind: 'ready'; rows: InspectionRows; columns: InspectionColumns; optional: InspectionOptionalColumns }
export const INSPECTION_OPTIONAL_SLOTS: readonly FieldSlot<keyof InspectionOptionalColumns>[]
export function inspectionFilterFields(columns: InspectionColumns, optional: InspectionOptionalColumns): FilterFieldDef[]
export interface InspectionFilterSource { rows: InspectionRows; columns: InspectionColumns; optional: InspectionOptionalColumns; today: Date }
```
`InspectionDashboard` gains prop `filterSource: InspectionFilterSource`. Its index is `props.index` until `isFieldFilterActive`, then `useMemo(() => buildInspectionIndex(filteredRows, columns, today))`. Slots use the sheet's headers: `General Contractor`, `Trade Supplier`, `Discipline`, `Inspection Category`, `Status`, `Inspection ID`, `Equipment ID / Tag Number`, `Issue ID`, `Finding Type`, `Date Observed`, `QCR/FE` (`QCR / FE` on Mechanical), `Notes`. Building's `blankLabel` is `Unspecified`, read through the existing building normaliser.

- [ ] **Step 1: Write failing tests:**
  - `useWeekWindow`: `a date range clamps the selected week and window into it, and clearing it restores the prior selection when still valid`.
  - `useWeekWindow`: `a selected week missing from a filtered index falls back without throwing` *(Review Focus 2)*.
  - Model: `in range, the trend shows only the range's weeks`; `to-date totals restate to the range`; `the pass rate trend restarts at From, and its last point equals the In Range card`; `no range equals the existing output exactly`.
  - Dashboard: `shows the Filter button with only the bound fields`; `a field filter recalculates cards and charts`; `In range retitles the group, with "WW.. to WW.." and "Finals in Range"`; `the 30 WW | All toggle is disabled during a range`; `the week picker lists only the range's weeks`; `no matching rows shows the empty state with Clear filters`; `From/To keep listing every week after a filter shortens the axis` *(Review Focus 2)*; `skipped and future footnotes describe the filtered rows, and Showing X of Y counts every bound row consistently` *(Review Focus 5)*.
  - Visual: `optional roles are declared in capabilities, in order, none required`; `the base index still builds once per data update, not on a filter change`.

- [ ] **Step 2: Run** `npx vitest run --project qaqc-shared`, `--project qaqc-electrical`, `--project qaqc-mechanical`. Expected: new tests FAIL.

- [ ] **Step 3: Implement.** Every existing call site passes `dateRange: null` through `useWeekWindow`, so other dashboards are unaffected until their task. `isRangeDisabled` follows `dateRange !== null`.

- [ ] **Step 4: Run** the same projects plus `npm run typecheck`. Expected: PASS; existing snapshots unchanged.

- [ ] **Step 5: Commit.** `feat: filter QCx Electrical and Mechanical`

---

### Task 4: Week drill-down, on Electrical and Mechanical

**Files:**
- Create: `packages/qaqc-shared/src/components/WeekIssuesPage.tsx`, `src/drilldown.ts`
- Modify: `inspections.ts`, `types.ts`, `components/LineChart.tsx`, `components/StackedBarChart.tsx` (only if its click doesn't report the week), `components/InspectionDashboard.tsx`, `src/qaqc.less`
- Test: `__tests__/WeekIssuesPage.test.tsx`, `__tests__/drilldown.test.ts`, `__tests__/inspectionIndex.test.ts`, `__tests__/InspectionDashboard.test.tsx`, `__tests__/smallCharts.test.tsx`

**Interfaces — consumes:** Task 3. **Produces:**
```ts
export interface DrillColumn { key: string; label: string; read: (row: Row) => string; isLong?: boolean }
export interface DrillGroup { title: string | null; columns: DrillColumn[]; rows: ReadonlyArray<Row> }
export interface WeekIssuesPageProps { weekLabel: string; groups: DrillGroup[]; onEscape?: () => boolean }
export function inspectionDrillColumns(columns: InspectionColumns, optional: InspectionOptionalColumns): DrillColumn[] // unbound hidden
// InspectionIndex gains:
issueRowsByWeek: ReadonlyArray<readonly number[]> // parallel to weeks; row positions behind issuesFound
```
`LineChart` gains `onSelectWeek?: (key: number) => void`, with click and keyboard selection through the same helper `StackedBarChart` uses. The dashboard's panel map gains a `drill` page panel; `selectWeek` wrapped so a week with `issuesFound > 0` also calls `openPage('drill', chartElement)`.

- [ ] **Step 1: Write failing tests:**
  - `issueRowsByWeek holds exactly the rows behind each week's issuesFound`.
  - `every week's list length equals issuesFound, with and without a filter` (loop all fixture weeks).
  - `a click on a week with issues selects it and opens the page titled Issues · WW23'2026`.
  - `a click on a week with none only selects it`.
  - `Enter on the focused week behaves the same`.
  - `Esc and Back return to the dashboard with focus on the chart` *(Review Focus 4)*.
  - `the NCR Pass Rate Trend opens the same page, and hover behaviour is unchanged`.
  - `a Date Observed cell shows yyyy-mm-dd and a numeric Issue ID shows as text` *(Review Focus 1)*.
  - `unbound columns are hidden; required slots alone still list Building, Phase and Issue`.
  - `long text truncates with the full value as a title`.
  - `the table sorts by a clicked header`.
  - Timing (add to `benchmark.test.ts`): `building the index with issueRowsByWeek stays inside the existing 100k budget`.

- [ ] **Step 2: Run** `npx vitest run --project qaqc-shared`. Expected: new tests FAIL.

- [ ] **Step 3: Implement.** Reuse `tableSort.ts` and `WindowedIssueTable`'s virtualisation. The drill page's rows read `filterSource.rows` or `filteredRows`, matching whichever produced the index.

- [ ] **Step 4: Run** `--project qaqc-shared`, `--project qaqc-shared-timing`, `--project qaqc-electrical`, `--project qaqc-mechanical`. Expected: PASS.

- [ ] **Step 5: Commit.** `feat: drill into a week's issues on Electrical and Mechanical`

---

### Task 5: QCx Welding filters and drill-down

**Files:**
- Modify: `packages/qaqc-shared/src/welds.ts`, `dataView.ts`, `types.ts`, `drilldown.ts`, `components/WeldingDashboard.tsx`; `packages/qaqc-welding/{capabilities.json,src/visual.ts,stringResources/en-US/resources.resjson}`
- Test: `__tests__/weldIndex.test.ts`, `__tests__/weldModel.test.ts`, `__tests__/WeldingDashboard.test.tsx`, `packages/qaqc-welding/src/__tests__/visual.test.ts`

**Interfaces — consumes:** Tasks 1–4. **Produces:** `WeldOptionalColumns { welder: number; workPackage: number }`, `WELD_OPTIONAL_SLOTS` (`WELDER`, `WORK PKG`), `weldFilterFields(columns, optional): FilterFieldDef[]` (Building via `weldBuilding(tag)`, Pipe Spec, Fluid Code, Welder comma-split, Work Package), `WeldIndex.issueRowsByWeek`, `weldDrillColumns(columns, optional): DrillColumn[]` (Tag No, Welder, Pipe Spec, Fluid Code, Issue Created, Signature).

- [ ] **Step 1: Write failing tests:** `Building filters through the Tag No derivation`; `a weld listing P-012 and PF-025 matches either and counts once in Showing X of Y`; `in range, the to-date cards and weekly charts restate`; `every week's drill list length equals the chart's issue count, with and without a filter`; `no filter leaves existing output identical`.

- [ ] **Step 2: Run** `--project qaqc-shared` and `--project qaqc-welding`. Expected: new tests FAIL.

- [ ] **Step 3: Implement,** following Tasks 3–4. Issue Rate by Building and building tables read the range when set.

- [ ] **Step 4: Run** the same plus typecheck. Expected: PASS.

- [ ] **Step 5: Commit.** `feat: filter and drill into QCx Welding`

---

### Task 6: QCx Issues filters, Created By (Company), range and drill-down

**Files:**
- Modify: `packages/qaqc-shared/src/issues.ts`, `dataView.ts`, `types.ts`, `drilldown.ts`, `components/IssuesDashboard.tsx`, `components/IssuesTrendChart.tsx` only if needed; `packages/qaqc-issues/{capabilities.json,src/visual.ts,stringResources/en-US/resources.resjson}`
- Test: `__tests__/issueIndex.test.ts`, `__tests__/issueModel.test.ts`, `__tests__/IssuesDashboard.test.tsx`, a new `__tests__/issueCompanyFixture.test.ts`; regenerate the enriched fixture script to add a company column

**Interfaces — consumes:** Tasks 1–4. **Produces:**
```ts
export const LOTUSWORKS_COMPANY = 'LotusWorks'
export function issueCompanyOf(row: Row, columns: IssueColumns): string // isIncludedIssue → LotusWorks; else trimmed company; '' if blank
export interface BuildIssueIndexOptions { includeAllCreators?: boolean } // default false keeps isIncludedIssue
export function buildIssueIndex(rows: InspectionRows, columns: IssueColumns, today: Date, options?: BuildIssueIndexOptions): IssueIndex
export function issueFilterFields(columns: IssueColumns): FilterFieldDef[]
// IssueIndex gains closedByCreatedWeek: number[] (issues now closed, by the week they were created)
//                 openedRowsByWeek, closedRowsByWeek: ReadonlyArray<readonly number[]>
```
Add `createdByCompany` and `discipline` to `IssueColumns` and `OPTIONAL_ISSUE_ROLES`. Fields in order: Created By (Company) with `defaultKeys: [groupKey(LOTUSWORKS_COMPANY)]` and `hasSelectAll: true`, Contractor (`blankLabel: 'Unassigned'`, through the existing contractor reader), Status, Type, Discipline, Root Cause. A field filter or non-default company rebuilds with `includeAllCreators: true` over the matching rows. With the company slot unbound, no company field appears and the index stays LotusWorks-only.

- [ ] **Step 1: Write failing tests:**
  - Fixture: `company distribution is LotusWorks 231, Ivory - QA 515, Ivory - Ops 256, Ivory 23, Greyfox 17, Bayside 21, Larch 4, Not recorded 10, total 1,077`.
  - Fixture, `today` 2026-11-04: `LotusWorks + Greyfox + Bayside gives 269 opened, 211 closed, 58 remaining, 78.4%`.
  - `the default view equals today's visual exactly` (existing enriched numbers).
  - `Showing X of Y counts every issue row`.
  - `issue Detail, the Pareto and Issue Aging recalculate for selected companies`.
  - Range: `Total Opened and Total Closed count within the range`; `Remaining Open is the open count at range end, and equals the Remaining Open line's last point`; `Closure Rate is the share opened in range now closed, never above 100%`; `Aging and Pareto aren't restated by the range but follow field filters`.
  - Drill: `a week's opened and closed groups equal the chart's numbers, with and without filters`; `a click on a week with no activity only selects it`.
  - Overview and Performance stay LotusWorks-only: existing overview and performance fixtures pass unchanged.

- [ ] **Step 2: Run** `--project qaqc-shared` and `--project qaqc-issues`. Expected: new tests FAIL.

- [ ] **Step 3: Implement.** Keep `isIncludedIssue` the default path so existing callers don't change.

- [ ] **Step 4: Run** the same plus typecheck. Expected: PASS.

- [ ] **Step 5: Commit.** `feat: filter QCx Issues by company and more, with a week drill-down`

---

### Task 7: NCR Pass Rate on QCx Issues

**Files:**
- Modify: `packages/qaqc-shared/src/dataView.ts`, `types.ts`, `issues.ts`, `components/IssuesDashboard.tsx`; `packages/qaqc-issues/{capabilities.json,src/visual.ts,stringResources/en-US/resources.resjson}`
- Test: `__tests__/IssuesDashboard.test.tsx`, `packages/qaqc-issues/src/__tests__/visual.test.ts`

**Interfaces — consumes:** `splitCombinedRows`, `buildInspectionIndex`, `isIncludedIssue`, Task 6. **Produces:** `IssueColumns` optional `source`, `rowId`, `workWeek`, `phase`, `issue`; `IssuesDashboard` prop `inspections: { index: InspectionIndex | null }`. In `visual.ts`, with Source bound, rows split: BIM rows go to the issue path; Electrical and Mechanical rows, concatenated, to one `buildInspectionIndex`. Welding rows are ignored.

- [ ] **Step 1: Write failing tests:** `with Source bound, the card NCR Pass Rate shows 100% − (NCRs ÷ Finals) over Electrical and Mechanical finals through the selected week, matching the Overview's Inspection NCR pass rate on the combined fixture`; `in range the card restates to the range`; `unbound, the card is hidden and output is identical`; `a card has no small print`; `an issue field filter leaves the card unfiltered and shows the note All inspections`; `identical inspection rows aren't merged when Row ID is bound: the finals count matches`; `the Source slot unbound with Combined columns otherwise bound treats every row as an issue, as today`.

- [ ] **Step 2: Run** `--project qaqc-shared` and `--project qaqc-issues`. Expected: new tests FAIL.

- [ ] **Step 3: Implement.** Bind `rowId` as a Grouping role only for the table identity; it's not displayed.

- [ ] **Step 4: Run** the same plus typecheck. Expected: PASS.

- [ ] **Step 5: Commit.** `feat: show NCR Pass Rate on QCx Issues`

---

### Task 8: QCx Combined columns, and the Overview

**Files:**
- Modify: `LotusWorks_Package/QCx_Combined.pq`, `Business_Package/QCx_Combined.pq` (identical), `packages/qaqc-shared/src/dataView.ts`, `combined.ts`, `overview.ts`, `types.ts`, `drilldown.ts`, `components/OverviewDashboard.tsx`; `packages/qaqc-overview/{capabilities.json,src/visual.ts,stringResources/en-US/resources.resjson}`
- Test: `__tests__/combined.test.ts`, `__tests__/overviewIndex.test.ts`, `__tests__/overviewModel.test.ts`, `__tests__/OverviewDashboard.test.tsx`, `packages/qaqc-overview/src/__tests__/visual.test.ts`

**Interfaces — consumes:** Tasks 1–7. **Produces:**
- New `CombinedColumns` optional positions, −1 when unbound: `generalContractor`, `contractor`, `tradeSupplier`, `discipline`, `inspectionCategory`, `inspectionId`, `equipmentTag`, `issueId`, `findingType`, `dateObserved`, `notes`, `pipeSpec`, `fluidCode`, `workPackage`, `title`, `dueDate`, `createdByCompany`, plus Overview-only `tagNo`, `welder`, `qcr`.
- `combined.ts` maps `pipeSpec` and `fluidCode` through `weldColumnsOf` when bound, instead of hardcoding them absent.
- `overviewFilterFields(columns): FilterFieldDef[]`: Contractor reads General Contractor on inspection rows and Contractor on BIM rows, `appliesTo` false on Welding. Building applies to inspections, and to welding via `weldBuilding(tag)`, with `appliesTo` false on BIM. Discipline applies to inspections and BIM.
- `buildOverviewIndex(split, columns, today, reuse?: Partial<SourceIndexes>)` rebuilds only sources whose rows changed.

Script rules: the existing 22 columns keep their names and order, and new columns follow. New selects use `MissingField.UseNull`. `Status` keeps one column. Welding headers rename to `Pipe Spec`, `Fluid Code`, `Work Package`. `Inspection ID` is null on Mechanical.

- [ ] **Step 1: Write failing tests:**
  - `combined.test.ts`: script test (read the `.pq` text): `the first 22 Result columns are unchanged in order`; `each new column is listed`; `both package copies are identical`.
  - `Contractor merges General Contractor and BIM Contractor into one list`.
  - `welding is unaffected by Contractor and Discipline, with the note "Welding isn't filtered by Contractor"`; `BIM is unaffected by Building, with its note`; `Building filters welding through the Tag No derivation`.
  - `DWN rate shows n/a and "Not available with filters" while any filter or range is active`.
  - `in range, cards and series restate`.
  - `no filter leaves overview fixtures unchanged`.
  - Drill: `a week's list equals that week's Electrical, Mechanical and Welding NCR counts, labelled by source; BIM rows aren't listed`; `the same under filters`.
  - `a rebuild reuses the indexes of untouched sources` (count `buildInspectionIndex` calls).

- [ ] **Step 2: Run** `--project qaqc-shared` and `--project qaqc-overview`. Expected: new tests FAIL.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run** the same plus `--project qaqc-performance` (shared Combined columns) and typecheck. Expected: PASS.

- [ ] **Step 5: Commit.** `feat: extend QCx Combined and filter the Overview`

---

### Task 9: QCx Performance filters

**Files:**
- Modify: `packages/qaqc-shared/src/dataView.ts`, `performance.ts`, `components/PerformanceDashboard.tsx`; `packages/qaqc-performance/{capabilities.json,src/visual.ts,stringResources/en-US/resources.resjson}`
- Test: `__tests__/performanceModel.test.ts`, `__tests__/PerformanceDashboard.test.tsx`, `packages/qaqc-performance/src/__tests__/visual.test.ts`

**Interfaces — consumes:** Tasks 1–3, Task 8's columns. **Produces:** `PERFORMANCE_SLOTS` optional additions (General Contractor, Discipline, Pipe Spec, Fluid Code); `performanceFilterFields(columns, group: 'qcr' | 'welder'): FilterFieldDef[]`.

- [ ] **Step 1: Write failing tests:** `the QCR / FE group offers Contractor, Building and Discipline`; `the Welders group offers Building, Pipe Spec and Fluid Code`; `switching groups keeps the other group's selection without applying it`; `a date range replaces the period: ranks, cards and trend use it, and 30 WW | All is disabled`; `Minimum finals applies inside the filtered period`; `the person page restates its This period cards and chart, and All time stays all time`; `no filter leaves fixtures unchanged`.

- [ ] **Step 2: Run** `--project qaqc-shared` and `--project qaqc-performance`. Expected: new tests FAIL.

- [ ] **Step 3: Implement.** The person page's chart and NCR table read the same filtered rows as its table row, so the numbers agree.

- [ ] **Step 4: Run** the same plus typecheck. Expected: PASS.

- [ ] **Step 5: Commit.** `feat: filter QCx Performance`

---

### Task 10: Guides, versions, packaging and visual check

**Files:**
- Modify: both folders' `QCx_Electrical_SETUP.md`, `QCx_Mechanical_SETUP.md`, `QCx_Welding_SETUP.md`, `QCx_Issues_SETUP.md`, `QCx_Overview_SETUP.md`, `QCx_Performance_SETUP.md`, `QCx_Combined_SETUP.md` (each pair identical); each visual's `package.json`, `pbiviz.json`; `package-lock.json`; old and new `.pbiviz` in both folders.

- [ ] **Step 1: Update guides,** in their existing voice: new optional slots, the Filter menu, In range behaviour, week drill-down, the notes about sources without a field, DWN under filters, Created By (Company) and how to rebind QCx Issues to QCx Combined for the NCR Pass Rate, and re-pasting the longer script (the preview now shows more than 22 columns; state the count). Guide tests or greps must find no mention of a removed behaviour.

- [ ] **Step 2: Bump versions** exactly per the spec's Delivery table, with test assertions.

- [ ] **Step 3: Full checks.** `npm test`, `npm run typecheck`, `npm run review:business`. Expected: all pass; 0 errors; no new warnings for the six QCx visuals.

- [ ] **Step 4: Build and sync.** For each of the six: delete its stale `dist/*.pbiviz`, run `npm run build -w @pbi/qaqc-<name>` (expect `[verify] ok`). Then `npm run sync:business && npm run sync:lotusworks`. Remove each old-version `.pbiviz` from both folders. Restore (`git checkout --`) any rebuilt file of a non-QCx visual and the review reports.

- [ ] **Step 5: Visual check.** Use each package's dev harness (fixture data only) and headless Chrome (`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --force-device-scale-factor=2 --window-size=1312,752 --virtual-time-budget=4000 --screenshot=<path> <url>`), or a scratch DevTools driver for interactive states. For all six: menu open, filters with chips, in range, empty state, and drill-down where it exists; and one compact tile (about 480×320). Save to `/private/tmp/claude-501/-Users-noahgarrett-Codebase-QAQC-Weekly-Report/758b0a9f-4c45-496f-be89-b387c5cbd742/scratchpad/filter-build/` only. Read every PNG and fix defects: overlap, clipping, misalignment, popover off-tile.

- [ ] **Step 6: Commit.** `chore: package the QCx filter and drill-down release`, then any fixes as `fix:` commits before it.
