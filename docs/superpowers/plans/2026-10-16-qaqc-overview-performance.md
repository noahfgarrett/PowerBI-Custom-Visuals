# QAQC Overview and Performance Visuals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `packages/qaqc-overview` and `packages/qaqc-performance` per `docs/superpowers/specs/2026-10-16-qaqc-overview-performance-design.md`. Both read one QAQC Combined table. Week labels also become year-qualified in all six QAQC visuals.

**Architecture:**
- **Data.** Both visuals read the combined table through a shared reader, then split the rows by Source in one pass. Electrical, Mechanical, Welding and BIM rows are indexed with the existing `buildInspectionIndex`, `buildWeldIndex` and `buildIssueIndex`.
- **Overview model.** Aligns the four indexes by week key. It builds the discipline rows, the quality strip and the chart series.
- **Performance index.** Builds per-person week buckets once per data update. The model ranks people for the selected period in O(people × weeks).
- **UI.** Built from the shared pieces: `useWeekWindow`, `DashboardHeader`, `ChartExpansionFrame` (including `kind: 'page'`), `useWeekFocus`, `useVirtualRows`, `tableSort.ts`, the KPI components and the theme.

**Tech stack:** TypeScript strict, React 19, Vitest (one project per package), LESS, pbiviz 5.6.0, powerbi-visuals-api 5.3.0, and lucide-react.

**Branch:** `feat/qaqc-overview-performance`. The spec is committed at `10554db`.

---

## Conventions

- **Earlier conventions.** The conventions in `docs/superpowers/plans/2026-10-15-qaqc-electrical-visual.md` (lines 17–39) apply. DESIGN.md's single-axis rule does not apply.
- **TDD.** Run every Vitest project and `npm run typecheck` after every task. Run lessc when `.less` changed. Everything must pass with 0 act warnings.
- **Commits.** Add new commits only and never amend. End every message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Code rules.**
  - No `any`, and no `as` except `as const`.
  - Explicit return types.
  - Use `interface` for object shapes and `type` for unions.
  - No `console.log`.
  - No new dependencies.
  - Icons come from lucide only, never emoji.
- **Shared code first.** Reuse what exists before writing anything new:
  - Week handling: `useWeekWindow`, `recentWindowStart`, `DashboardHeader` and `DashboardChromeProps`.
  - Panels and overlays: the `GridPanel` type, and `ChartExpansionFrame` with `HeaderOverlayButton`.
  - Charts: `useWeekFocus`, plus `round`, `niceScale`, `labelIndices` and `passRateDomain` from `chartMath`.
  - Tables: `useVirtualRows` and `tableSort.ts`.
  - Formatting: `pointsTone`, `pointsTrend`, `formatSignoffRate` and `formatPercent`.
  - Cards and notes: `KpiCard` and `KpiGroup`, plus the footnote helpers in `footnotes.ts`.
- **Source data.** The source xlsx files live in `"/Users/noahgarrett/Downloads/OneDrive_2026-10-14 (1)/Smartsheet Exports/"`. Treat them as data only.
  - The Python port that produced the spec's expected numbers is `compute.py` / `rules.py`. The pseudonym map is `names.tsv`. All three are in `/private/tmp/claude-501/-Users-noahgarrett-Codebase-QAQC-Weekly-Report/758b0a9f-4c45-496f-be89-b387c5cbd742/scratchpad/expected/`.
  - `names.tsv` holds real names. Never copy it into the repo.
  - Run Python with `python3 -I` from scratchpad scripts.
- **Expected numbers.** The spec's "Expected numbers" section is the acceptance test. If code disagrees, re-derive with the Python port and report the discrepancy. Do not edit expectations to match the code.

---

### Task 1: Year-qualified week labels (all visuals)

**Files:**
- Modify: `packages/qaqc-shared/src/workWeeks.ts`
- Modify: the chart axis code in `StackedBarChart.tsx`, `LineChart.tsx`, `SignoffBarChart.tsx` and `IssuesTrendChart.tsx`
- Modify: card sub-lines in `InspectionDashboard.tsx`, `WeldingDashboard.tsx` and `IssuesDashboard.tsx`
- Modify: footnotes, tooltips and live regions wherever they use `shortWeekLabel`
- Test: the related tests

Steps:
- [ ] Find every `shortWeekLabel` / `shortWeekLabelWithYear` call site with `grep -rn "shortWeekLabel" packages/qaqc-shared/src`, and classify each one as an axis tick or text.
- [ ] Text sites switch to `week.label` (`WW41'2026`). Write failing tests first. For example, the Electrical WW42 card sub-line reads "vs WW41'2026", and tooltips and live regions carry the full label. Then change the code.
- [ ] Axis ticks keep `shortWeekLabel`. Add a shared helper `yearMarkers(labelledIndices, weeks): Set<number>` in `chartMath.ts`. It returns the first labelled index plus the first labelled index of each new year.
- [ ] Each chart renders a small year `<text>` (class `qaqc-axis-year`) under those ticks, and drops the `spansYears` / `shortWeekLabelWithYear` switch. Tests:
  - A 30-week window inside 2026 shows one `2026` marker.
  - A window from WW40'2025 to WW10'2026 shows `2025` under the first tick and `2026` under the first 2026 tick.
  - At 520 weeks, the markers don't overlap the tick labels.
- [ ] Delete `shortWeekLabelWithYear` if nothing uses it any more.
- [ ] Run all five QAQC projects and the typecheck, then commit as `feat: year-qualified week labels across QAQC visuals`.

### Task 2: Combined table reader, row split and fixture

**Files:**
- Modify: `packages/qaqc-shared/src/dataView.ts` (add `readCombinedTable`, `OVERVIEW_SLOTS`, `PERFORMANCE_SLOTS` and `CombinedColumns`)
- Create: `packages/qaqc-shared/src/combined.ts` (`splitCombinedRows`, `CombinedSplit`, and helpers that map `CombinedColumns` into `InspectionColumns`, `WeldColumns` and `IssueColumns`)
- Create: `packages/qaqc-shared/src/__tests__/fixtures/combinedRows.ts`
- Create: `packages/qaqc-shared/src/__tests__/combined.test.ts`
- Modify: `dataView.test.ts`

Steps:
- [ ] Write `CombinedColumns`, an interface holding the position (or −1) of every role in the spec's Field slots table: `source`, `workWeek`, `phase`, `issue`, `building`, `qcr`, `welder`, `tagNo`, `signature`, `signedWeek`, `id`, `status`, `type`, `createdOn`, `updatedOn`, `createdBy`, `greenTags`. Write it before the code that uses it.
- [ ] `readCombinedTable(table, slots)` uses the same pattern as `readIssueTable`.
  - It returns `missing` for any required slot that isn't bound. `greenTags` is never required.
  - `OVERVIEW_SLOTS` and `PERFORMANCE_SLOTS` list exactly the slots the spec marks for each visual, with the Smartsheet column names from the spec.
  - Test each slot list for missing slots, for full binding, and for an optional Green tags slot that isn't bound.
- [ ] `readGreenTags(rows, column)` returns the first finite number in the column, or null.
  - It accepts numbers and numeric strings. Blanks, NaN and non-numbers give null.
  - It returns null when `column` is −1.
- [ ] `splitCombinedRows(rows, sourceColumn)` makes one pass and returns `{ electrical, mechanical, welding, bim, unknownSource: number }`.
  - Source is matched trimmed and case-insensitively against `electrical`, `mechanical`, `welding` and `bim`.
  - Rows are shared by reference, not copied.
  - Test mixed case and whitespace, an unknown value, and blank values.
- [ ] Add mapping helpers `inspectionColumnsOf(c)`, `weldColumnsOf(c)` and `issueColumnsOf(c)` that build the existing builders' column types from `CombinedColumns`.
  - The existing builders need columns the combined table doesn't have: `fluidCode` and `pipeSpec` for welds; `title`, `contractor` and `dueDate` for issues. For those, pass position −1 and check that the builders treat −1 as a blank cell. `cellText(row[-1])` is `''` because `row[-1]` is `undefined`. Verify this rather than assuming it, and add a test that indexes Welding and BIM rows with those columns at −1.
- [ ] **Fixture.**
  - Write a scratchpad Python script that reads the four xlsx files and emits `combinedRows.ts`, with the columns in the order `COMBINED_COLUMNS` (exported from the fixture).
  - Rows follow the spec's Combined table mapping: Source, Row ID (1-based), and every schema column with null where a column doesn't apply.
  - Dates are encoded the way `issueRows.ts` encodes them.
  - Replace QCR/FE and each comma-split Welder part using `names.tsv`, keeping the comma structure. Not recorded values (blank, `n/a`, `na`, `none`, `-`) stay as they are.
  - BIM Created By becomes `'LotusWorks'` when it passes the include rule, otherwise `''`. This is the same as `issueRows.ts`.
  - Check: 2,385 rows, with 288, 138, 1,751 and 208 per source, and no real names. Grep the output for every name in `names.tsv`; there must be 0 hits.
- [ ] **Fixture test, `combinedFixture.test.ts`.**
  - The row counts per source match.
  - Indexing each split with the existing builders reproduces the existing fixtures' headline numbers:
    - Electrical: finals 238 and SORs 48 through WW42
    - Mechanical: 44 finals and 91 SORs
    - Welding: 1,751 welds and 1,054 signed
    - BIM: 177 / 126 / 51
- [ ] Run all projects and the typecheck, then commit as `feat: read and split the QAQC Combined table`.

### Task 3: Overview model

**Files:**
- Create: `packages/qaqc-shared/src/overview.ts`
- Modify: `packages/qaqc-shared/src/types.ts`, adding the Overview types at the end
- Test: `__tests__/overviewIndex.test.ts`, `__tests__/overviewModel.test.ts`, `__tests__/overviewFixture.test.ts`, plus additions to `benchmark.test.ts`

Steps:
- [ ] Types first:
  - `OverviewIndex`: the four discipline indexes (each possibly empty), the union `weeks`, `positionByKey`, `currentWeek`, `greenTags: number | null`, per-week COR and DWN counts with their cumulative arrays, and footnote counts per source including `unknownSource`.
  - `CardMode = 'week' | 'toDate'`.
  - `OverviewModel`: `rows` (electrical, mechanical, welding and bim, each `{ connected: boolean; cards: OverviewCard[4]; sparkline: number[]; trendText: string }`), `quality` (5 cards), `activity` (per-week Elec and Mech finals and SORs for the window), `rates` (per-week inspection and welding pass rate with counts, `null` when the denominator is 0), `windowTotals`, `hasData`, `weekOptions` and `selectedWeek`.
  - `OverviewCard`: `{ label; value: number | null; display: string; delta; deltaDisplay; tone: DeltaTone; subLine }`, following the existing card value shapes. Read the shape `InspectionDashboard` builds its cards from and mirror it.
- [ ] `buildOverviewIndex(split, columns, today)`:
  - Indexes each split with the existing builders.
  - Takes the union of their weeks from the earliest first week to the current week, using `enumerateWorkWeeks`.
  - Counts CORs and DWNs per created week over included, non-void BIM issues, matching Type trimmed and case-insensitively. Reuse the BIM index's normalized records if they expose Type. If they don't, add a `type` field to `IssueRecord`; it was trimmed earlier as unused, and now it is used.
  - Reads `greenTags`.
- [ ] `buildOverviewModel(index, view, mode)`:
  - Values, deltas, tones and sub-lines exactly as in the spec's Discipline rows and Quality strip sections, including the "Rule ambiguities resolved" bullets.
  - Look up each discipline at W through that discipline's own `positionByKey`, so a week before a discipline's first week counts as zero.
  - Remaining open and Closure rate are always to date.
  - The Welding Sign-off % uses the welding model's latest-week fallback.
  - Pass rates are `n/a` with a 0 denominator.
  - DWN sub-line text follows the spec.
  - Sparklines cover the 30 weeks ending at W.
  - `trendText` reads like "up 4 vs WW41'2026".
- [ ] Unit tests on small hand-built splits:
  - each tone rule
  - both modes
  - a discipline with no rows (`connected: false`)
  - W before a discipline's first week
  - a missing Green tags value
  - Type matching (`cor`, ` COR `, `DWN`)
  - BIM NCR not counted
  - a void COR not counted
- [ ] `overviewFixture.test.ts` asserts every value in the spec's Expected numbers sections "Overview discipline rows", "Quality strip" and "Chart spot checks", at WW42 and WW41 in both modes.
- [ ] Add a synthetic combined-rows generator to `fixtures/syntheticRows.ts`, seeded with mixed sources. Benchmarks:
  - `buildOverviewIndex` on 500k rows in 1,500 ms or less.
  - `buildOverviewModel` in 16 ms or less.
- [ ] Commit as `feat: add the QAQC overview model`.

### Task 4: Overview charts and pieces

**Files:**
- Create in `packages/qaqc-shared/src/components/`:
  - `ActivityLinesChart.tsx`
  - `QualityRatesChart.tsx`
  - `Sparkline.tsx`
  - `OverviewWeekTable.tsx` (the expanded tables)
- Modify: `qaqc.less`
- Test: `__tests__/overviewCharts.test.tsx`

Steps:
- [ ] **`ActivityLinesChart`**, per the spec:
  - Two smooth lines with dots: Electrical in series 1 and Mechanical in series 3. In high contrast, the Mechanical line is dashed.
  - A nice left axis with gridlines.
  - Labels on the last and selected points, with collision avoidance between the two lines' labels.
  - The selected band, with click and keyboard selection through `useWeekFocus`.
  - A static aria-label plus a live region.
  - A tooltip with week, Electrical (Finals, SORs, total) and Mechanical (same).
  - A legend.
  - Year markers from Task 1.
  - A `showValues` expanded mode.
  - Follow `IssuesTrendChart` for structure, memoization and label layout.
  - Test that labels never overlap, at 30 and 520 weeks and at 3 sizes, with `it.each`.
- [ ] **`QualityRatesChart`**:
  - Two pass-rate lines on a `passRateDomain` axis, broken where the rate is null.
  - The same selection, tooltip (with counts), legend, keyboard and expanded behaviour as `ActivityLinesChart`.
  - Test the line breaks, and that the domain zooms in.
- [ ] **`Sparkline`**:
  - An `aria-hidden` SVG polyline with the W point marked.
  - It handles all-zero, single-point and empty series without NaN.
- [ ] **`OverviewWeekTable`**:
  - Sortable, using `useTableSort` and `tableSort`.
  - Activity columns: Week, Elec Finals, Elec SORs, Mech Finals, Mech SORs.
  - Rates columns: Week, Inspection rate, Inspection NCRs/Finals, Welding rate, Welding NCRs/Welds.
- [ ] Commit as `feat: add overview charts and sparklines`.

### Task 5: `OverviewDashboard`

**Files:**
- Create: `packages/qaqc-shared/src/components/OverviewDashboard.tsx` and `OverviewRow.tsx`
- Modify: `qaqc.less` and `footnotes.ts` (add `buildOverviewFootnotes`)
- Test: `__tests__/OverviewDashboard.test.tsx` and `footnotes.test.ts`

Steps:
- [ ] **Props** extend `DashboardChromeProps` with `index: OverviewIndex`.
- [ ] **Header** is `DashboardHeader`, with a `This WW | To date` segmented control passed as a leading child, reusing `RangeToggle`'s styling.
- [ ] **Week state** uses `useWeekWindow`. The card mode is local state, defaulting to `'week'`.
- [ ] **`OverviewRow`:**
  - A label with a lucide icon (`Zap`, `Wrench`, `Flame` or `CircleAlert`) and the name, followed by 4 `KpiCard`s and a `Sparkline`.
  - When `connected` is false it shows the "Not connected" message from the spec.
  - The row has `role="group"` and an `aria-label` that includes `trendText`.
- [ ] **Layout:**
  - Four discipline rows, then the quality strip as a `KpiGroup` of 5 cards, then a chart grid with Activity large on the left and Quality rates small on the right. Both charts can expand, through the `GridPanel` type and `ChartExpansionFrame`.
  - Compact mode stacks the content. Cards-only mode hides the charts.
  - At 1340×790 the whole layout has to fit without page scroll. Size rows and cards to make that work, and check it in the browser in Task 6.
- [ ] **Footnotes.** `buildOverviewFootnotes(index, rowLimitReached)` covers:
  - Per source: skipped rows (unreadable or future week, no Created On) and excluded creators.
  - Unknown Source rows.
  - The row limit.

  Wording follows the existing builders, prefixed with the source ("Welding: 2 rows skipped: unreadable work week").
- [ ] **Tests**, using the combined fixture:
  - The WW42 This WW and To date values in the rows and the strip, spot-checking at least 2 cards per row.
  - Switching the mode.
  - Bar click and keyboard selection.
  - Expanding each chart and restoring focus.
  - A disconnected row.
  - Compact mode, cards-only mode, and an 800×300 tile.
  - The footnotes.
- [ ] Commit as `feat: add the QAQC overview dashboard`.

### Task 6: `qaqc-overview` package and harness

**Files:**
- Create under `packages/qaqc-overview/`, copied from `packages/qaqc-issues/`:
  - `package.json`, `pbiviz.json`, `tsconfig.json`, `vitest.config.ts`, `scripts/ensure-api.cjs`, `style/visual.less`
  - `capabilities.json`, `stringResources/en-US/resources.resjson`
  - `src/settings.ts`, `src/visual.ts`, `src/__tests__/*`
  - `dev/*`
- Modify: `scripts/make-qaqc-icon.mjs` (add a `dashboard` shape) and `/Users/noahgarrett/Codebase/QAQC-Weekly-Report/.claude/launch.json` (add `qaqc-overview-dev`, port 5194)

Steps:
- [ ] Use the GUID, class, display name, version and icon from the spec table. The description is "One-stop QAQC page: Electrical, Mechanical, Welding and BIM Issues by work week, with quality rates."
- [ ] Capabilities:
  - The roles in `OVERVIEW_SLOTS` (`max: 1` each).
  - `greenTags` as a **measure** role (`kind: 1`, Measure), `max: 1`, optional.
  - The same objects as Issues, and the table mapping with the 30000 window.
  - Matching resjson keys.
- [ ] `visual.ts`:
  - Wire `readCombinedTable(OVERVIEW_SLOTS)`, `splitCombinedRows`, `buildOverviewIndex` (with `new Date()`), `buildOverviewFootnotes` and `OverviewDashboard`.
  - The strings are given in the spec's Error states section.
  - Keep every review-gate string, the React 19 error path, fetchMoreData, and the `.less` import.
  - The header is titled "QAQC Overview" with the `LayoutDashboard` icon.
- [ ] `visual.test.ts`:
  - The setup state.
  - WW42 values (fake timers, 2026-10-15).
  - A bound Green tags value changes the DWN sub-line.
  - Interactions off.
  - High contrast.
  - The failure path.
- [ ] Dev harness: port 5194, the combined fixture, `?data=synthetic&rows=N` with a default of 500,000, `?greenTags=N`, and the same parameters as the Issues harness.
- [ ] Checks:
  - `npm install` adds only the workspace.
  - The build prints `[verify] ok`.
  - `review:business` shows 0 issues for `qaqc-overview`. Restore the review reports afterwards.
- [ ] Commit as `feat: add QAQC Overview visual package`.

### Task 7: Performance index and model

**Files:**
- Create: `packages/qaqc-shared/src/performance.ts`
- Modify: `types.ts`
- Test: `__tests__/performanceIndex.test.ts`, `__tests__/performanceModel.test.ts`, `__tests__/performanceFixture.test.ts`, plus additions to `benchmark.test.ts`

Steps:
- [ ] Types first:
  - `PerformanceGroup = 'qcr' | 'welders'`.
  - `PersonKey` is a string group key.
  - `PersonRecord`: `{ key; name; disciplines: Set<'E' | 'M'> (QCR only); weekly: Map<number, { volume; sors; ncrs }> }`. Alternatively, use dense arrays aligned to `weeks` if that is faster. Measure and choose.
  - `PerformanceIndex`:
    - `weeks`, `positionByKey` and `currentWeek`
    - `qcr` and `welders` person lists
    - `notRecorded` per group, with weekly buckets
    - `sharedWelds` per week
    - per-person NCR row references for the detail view
    - footnote counts
  - `PerformanceModel`:
    - `summary`
    - `ranked`, `belowMinimum` and `notRecorded` rows, each `{ key; name; tags; volume; sors; ncrs; rate; trend: Array<{ volume; hasNcr }> }`
    - `window`, `weekOptions` and `selectedWeek`
  - `PersonDetail`: cards (period and all-time), weekly series and NCR rows.
- [ ] `isNotRecorded(value)`: blank, or `n/a`, `na`, `none` or `-` after trimming and lower-casing.
- [ ] `buildPerformanceIndex(split, columns, today)`:
  - **QCR/FE:**
    - Uses Electrical and Mechanical rows whose phase is Final or SOR and whose week is readable and not in the future. Use `classifyPhase`, `isIssueFound` and the inspection week parser.
    - Names are grouped by lower case with whitespace collapsed, keeping the first spelling.
    - Each person records E or M tags.
  - **Welders:**
    - Uses Welding rows whose weld week is readable and not in the future.
    - The Welder cell is split on commas and each part is trimmed. Distinct parts are credited once each.
    - The weld's issue (`isWeldIssue` from `welds.ts`) is credited to each welder.
    - Count shared welds per week.
  - **Not recorded:** rows or parts matching `isNotRecorded` go to `notRecorded`. A weld with no recorded part is Not recorded.
  - **Detail rows:** keep the NCR row positions per person for the detail table.
- [ ] `buildPerformanceModel(index, view, group, minimum)`:
  - **Period:** the selected range ending at W. Sum each person's buckets over the window positions.
  - **Ranking:** rank people with volume ≥ minimum by rate descending, then NCRs descending, then name using `NAME_COLLATOR`. Everyone else goes to `belowMinimum`, sorted by volume descending.
  - **Not recorded:** one row.
  - **Trend:** the 30 weeks ending at W, regardless of range.
  - **Summary:** whole-group totals, as in the spec's Summary strip.
  - Complexity must be O(people × weeks).
- [ ] `buildPersonDetail(index, group, key, view)` returns period and all-time cards, the weekly series with a running NCR rate within the period, and the NCR rows. NCR rows hold Work Week label and key, Source, Building or Tag No, and Issue text, sorted newest first.
- [ ] Unit tests:
  - Grouping across spellings.
  - E and M tags.
  - Comma splitting and duplicate parts within one cell.
  - A Not recorded value inside a welder list.
  - Ranking ties.
  - The minimum boundary (volume equal to the minimum is ranked).
  - The period window.
  - The trend window.
  - The running rate.
- [ ] `performanceFixture.test.ts` asserts every value in the spec's Expected numbers "Performance" section: both groups, both periods, the tables, below-minimum, Not recorded, shared welds, and the summary strip.
- [ ] Benchmark: index 500k synthetic combined rows and rank them, in 300 ms or less for ranking. The index has its own budget, which you set from measurements and report.
- [ ] Commit as `feat: add the QAQC performance model`.

### Task 8: Performance components

**Files:**
- Create in `packages/qaqc-shared/src/components/`:
  - `PerformanceTable.tsx`
  - `TrendStrip.tsx`
  - `PersonDetail.tsx`
  - `PersonWeekChart.tsx`
- Modify: `qaqc.less`
- Test: `__tests__/performance.test.tsx`

Steps:
- [ ] **`TrendStrip`.** Tiny bars for volume, with NCR weeks in the bad colour. It is `aria-hidden`.
- [ ] **`PerformanceTable`:**
  - **Columns:** for QCR, Name (with E/M tag chips), Finals, SORs, NCRs, NCR rate, Trend. For welders, Welder, Welds, NCRs, NCR rate, Trend.
  - **Blocks:** ranked rows, then a disclosure row reading "Below minimum (n people)" that expands the group, then Not recorded.
  - **Sorting:** every column sorts within each block (Trend sorts by NCR week count). Blocks never mix. Use `aria-sort`, and `tableSort.ts` with precomputed ranks.
  - **Rows:** `useVirtualRows` with a sticky header. A row's accessible name includes "NCRs in n of the last 30 weeks".
  - **Opening a person:** clicking a name or pressing Enter on a row calls `onOpenPerson(key)`.
  - **Tests:**
    - Block order is preserved while sorting.
    - The disclosure.
    - Keyboard open.
    - 5,000 rows give bounded DOM rows.
- [ ] **`PersonWeekChart`:**
  - Bars for Finals or welds, with NCR bars beside them in red.
  - A running NCR rate line on a right axis.
  - Selection is not needed.
  - Reuse the `IssuesTrendChart` label layout approach.
  - Test that labels don't collide at 30 and 520 weeks.
- [ ] **`PersonDetail`:** the page content, with 3 period cards and 3 all-time cards, the chart, and a windowed, sortable NCR table. It calls `buildPersonDetail` only while it is mounted.
- [ ] Commit as `feat: add performance table and person detail`.

### Task 9: `PerformanceDashboard` and the `qaqc-performance` package

**Files:**
- Create: `packages/qaqc-shared/src/components/PerformanceDashboard.tsx`
- Create: the whole `packages/qaqc-performance/` tree, copied from `packages/qaqc-overview/`
- Modify: `footnotes.ts` (`buildPerformanceFootnotes`), `scripts/make-qaqc-icon.mjs` (a `people` shape) and `launch.json` (`qaqc-performance-dev`, port 5195)

Steps:
- [ ] **Dashboard:**
  - **Header controls:** `DashboardHeader`, with a `QCR / FE | Welders` switch as a leading child.
  - **State:** `useWeekWindow` for the period.
  - **Summary strip:** a `KpiGroup` of 4 cards.
  - **Body:** the `PerformanceTable`.
  - **Person overlay:** a `kind: 'page'` panel whose `renderExpanded` returns `PersonDetail` for the open key. Opening it from a table row grows from that row's rect, and focus returns to the row.
  - **Modes:** compact and cards-only. Cards-only shows the summary strip only.
- [ ] **Footnotes, `buildPerformanceFootnotes(index, group, rowLimitReached)`:**
  - "n inspections have no QCR/FE".
  - "n welds list more than one welder; each welder is credited".
  - Unknown Source.
  - Skipped rows.
  - The row limit.
- [ ] **Package:**
  - **Identity:** GUID, class, name, version and icon from the spec table. Description: "NCR performance by QCR/FE and by welder, ranked by NCR rate with a 30-week trend."
  - **Capabilities:** the `PERFORMANCE_SLOTS` roles, the same objects as Overview, plus a `ranking` object with `minimumFinals` and `minimumWelds` (numeric, defaults 5 and 10, range 1–100).
  - **Settings:** `settings.ts` gains a `RankingSettings` card.
  - **`visual.ts`:** uses the strings from the spec's Error states section.
  - **Harness:** dev harness on port 5195.
- [ ] **Tests:**
  - Dashboard tests using the fixture: both groups, the period switch, the minimum settings, person open and close with focus return, compact mode and cards-only mode.
  - `visual.test.ts`: the setup state, the WW42 summary strip, the ranking settings wiring, interactions off, high contrast and the failure path.
- [ ] **Checks:** `npm install` adds only the workspace, the build prints `[verify] ok`, and `review:business` shows 0 issues.
- [ ] Commits:
  - `feat: add the QAQC performance dashboard`
  - `feat: add QAQC Performance visual package`

### Task 10: Preview, verification and release

- [ ] **Visual verification**, done by the controller in the browser for Overview (5194) and Performance (5195):
  - all four presets and high contrast
  - compact, cards-only and 800×300
  - each chart expanded, and person detail open
  - 500k synthetic rows
  - year markers
  - the Electrical, Mechanical, Welding and Issues harnesses spot-checked for year labels
- [ ] **Version bumps** (`pbiviz.json` and `package.json`): Electrical 1.1.1, Mechanical 1.0.1, Welding 1.0.1, Issues 1.0.1. Each setup guide gets a line about year-qualified labels.
- [ ] **Build and check:** build all six QAQC packages, each printing `[verify] ok`. Then run the full `npx vitest run` and `npm run review:business` (0 issues for all six QAQC packages).
- [ ] **Setup guides:**
  - `QAQC_Combined_SETUP.md` has the full Power Query M script from the spec's Combined table section. The four source query names sit at the top as `let` bindings the user edits. The guide also covers how to add the query, the Row ID index, and what each column holds.
  - `QAQC_Overview_SETUP.md` and `QAQC_Performance_SETUP.md` cover the slots, Green tags, modes, rules, charts, ranking, the minimum settings and person detail.
  - Write all three in both `LotusWorks_Package/` and `Business_Package/`.
- [ ] **Sync and release:**
  - Run `npm run sync:business && npm run sync:lotusworks`. Only these files may change: the two new `.pbiviz`, the four re-versioned QAQC `.pbiviz` (old versions removed, if that is what the sync script does; check it), the guides and the reports. Stop and restore if anything else changes.
  - Zip `releases/LotusWorks_Package_2026-10-16_QAQC-Overview-Performance-1.0.0.zip`.
  - Commit as `feat: package QAQC Overview and Performance 1.0.0 with setup guides`.
