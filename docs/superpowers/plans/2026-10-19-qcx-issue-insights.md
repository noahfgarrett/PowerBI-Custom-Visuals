# QCx Issue Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `docs/superpowers/specs/2026-10-19-qcx-issue-insights-design.md`:
- the **Issues by Root Cause Pareto** page and the **Issue Aging** page in QCx BIM Issues
- two new QCx Overview cards
- the optional Root Cause data

**Architecture:**
- **`issueBenchmarks.ts` (new):** computes everything "as of week W" for both visuals: the typical close, the close window, the slowest close, open-as-of ages, age buckets, the aging profile and quarterly medians. Its input is the existing `IssueIndex`. Per-W work must be O(issues), bounded and memoized, and is computed only while a page is open.
- **`rootCauses.ts` (new):** builds the Pareto from the index, given a window, a scope and W.
- **Pages:** both are `kind: 'page'` panels in `ChartExpansionFrame`, opened from `HeaderOverlayButton`s, like Issue Detail.

**Tech stack:** TypeScript strict, React 19, Vitest, LESS, pbiviz 5.6.0, lucide-react.

**Branch:** `feat/qcx-issue-insights`, created off `feat/qaqc-overview-performance`. The spec is at `c6d5821`.

**Visual reference:** the scratchpad folder `/private/tmp/claude-501/-Users-noahgarrett-Codebase-QAQC-Weekly-Report/758b0a9f-4c45-496f-be89-b387c5cbd742/scratchpad/mockups/` holds:
- the mockup `qcx-designs.html`
- the screenshots `design-1-bim-issues-header.png`, `design-2-root-cause-pareto.png`, `design-2b-root-cause-pareto-open-only.png`, `design-3-overview.png`, `design-3b-overview-todate.png`, `design-4-issue-aging-page.png` and `design-6-past-window-issues.png`
- the Python ports `compute2.py` and `rootcauses.py`, plus `rulesdir/`
- the mockup's React sources, inside the folder `real/` (read them before building any UI; they are the closest reference)

---

## Conventions

- **Earlier rules apply.** The conventions in `docs/superpowers/plans/2026-10-16-qaqc-overview-performance.md` still hold:
  - TDD
  - TypeScript strict: no `any`, and no `as` except `as const` (the test-harness `ConstructorOptions` cast is the one exception)
  - explicit return types, `interface` for object shapes and `type` for unions
  - no `console.log` and no new dependencies
  - lucide icons only
  - after every task, run every Vitest project, `npm run typecheck` and lessc
- **Commits.** Add new commits only, and end each message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Expected numbers.** The spec's Expected numbers are the acceptance test. If the code disagrees, re-derive the value with the Python ports (run with `python3 -I`, and import from `rulesdir/`, never from the `expected/` folder) and report the discrepancy. Don't edit expectations to match the code.
- **Personal data.** No personal names may appear in fixtures or tests.
- **Concurrent agents.** When agents run concurrently, stage only your own files by explicit path. Re-read shared files (`types.ts`, `qaqc.less`, `IssuesDashboard.tsx`) right before editing them.

### Task 1: Root Cause data

- [ ] **Shared slot reader.** In `dataView.ts`, add optional `rootCause` and `rootCauseCategory` roles to `ISSUE_SLOTS`/`readIssueTable`. They are never required, so follow the same pattern as `OPTIONAL_COMBINED_ROLES`. Add `rootCause` and `rootCauseCategory` positions, with −1 meaning unbound, to `IssueColumns`.
- [ ] **Issue index.** In `issues.ts`, add `rootCause: string` (trimmed, `''` when blank or unbound) and `rootCauseCategory: string` to `IssueRecord`. Also add `hasRootCause` and `hasRootCauseCategory` booleans to `IssueIndex`.
- [ ] **Issue fixture.** Add Root Cause and Root Cause Category to `__tests__/fixtures/issueRows.ts`. It is positional, so append the two columns at the end so existing positions keep working. Regenerate it with a scratchpad script from the xlsx, the same way the original was made, and verify the 208 rows.
- [ ] **Combined schema.** Add `Root Cause` to the combined schema:
  - `COMBINED_COLUMNS` and `combinedRows.ts` (append at the end; BIM rows only)
  - `CombinedColumns.rootCause`
  - an optional `rootCause` in `OVERVIEW_SLOTS`
  - `issueColumnsOf` mapping it
- [ ] **Power Query script and guides.** Update `QCx_Combined.pq` and `QCx_Combined_SETUP.md` in both package folders. Select BIM `Root Cause`, keep it in the final column order after `Created By`, and give it type text.
- [ ] **Tests.** Cover the optional slots (unbound gives −1 and no "missing"), the record fields, and the fixture's Root Cause counts: Installation 48 among included issues.
- [ ] Commit: `feat: optional Root Cause data for BIM issues and the combined table`.

### Task 2: Issue benchmarks (`issueBenchmarks.ts`)

- [ ] **Types first.** Define these interfaces:
  - `IssueBenchmarks { asOf: WorkWeek; closures: number; typical: number | null; window: number | null; slowest: number | null; open: OpenIssueAge[]; pastWindow: number; olderThanAny: number; medianOpenAge: number | null; openDelta: number }`
  - `OpenIssueAge { issue: IssueRecord; age: number; timesWindow: number | null }`
  - `AgeBucket { key; label; range; count; tone: 'good' | 'warn' | 'bad'; issues: OpenIssueAge[] }`
  - `ProfilePoint { week; median: number | null; open }`
  - `QuarterPoint { key; label; median: number | null; closed; slowest: number | null }`
- [ ] **`endOfWeek(week, today)`.** Returns the Sunday of the week, never later than `today`.
- [ ] **`quantile(sorted, p)`.** Port it exactly from `compute2.py`. It must give 32, 77 and 314 on the fixture.
- [ ] **`buildIssueBenchmarks(index, weekKey, today)`.** Implement it per the spec's "Issue benchmarks (shared)" section. Precompute and cache each issue's time to close and its created and closed day numbers once per index, so each call is a linear pass.
- [ ] **`ageBuckets(benchmarks)`.** Use the spec's six buckets with the window edge, and the five-bucket fallback with an amber straddling bucket.
- [ ] **`agingProfile(index, window, today)`.** The median open age for each week in the window. It must not be O(weeks × issues²). Sort by created date and sweep, or accept O(weeks × issues) when it is still under budget at 200k issues.
- [ ] **`quarterMedians(index, weekKey, today)`.** One point per calendar quarter, from the first quarter with a closure through the quarter of W.
- [ ] **Tests:**
  - quantile cases
  - as-of reconstruction: an issue closed after W counts as open as of W
  - bucket boundaries, including 77 and 78 days
  - the fallback
  - no closures, which gives nulls
  - end of week capped at today
- [ ] **Fixture test.** Assert every Benchmarks and Quarterly expected number, including WW30 (50 open, 39 past, buckets 5/6/0/6/33/0).
- [ ] **Benchmark.** 200k synthetic issues (use the existing synthetic issue generator, adding created and updated dates if they're missing). `buildIssueBenchmarks`, `agingProfile` for 30 WW, and `quarterMedians` must each take ≤ 50 ms after indexing. Report the timings.
- [ ] Commit: `feat: issue close-time benchmarks and aging as of a week`.

### Task 3: Root cause Pareto model (`rootCauses.ts`)

- [ ] **Types.**
  - `ParetoBar { key; label; count; share; cumulative: number | null; vital: boolean; kind: 'cause' | 'other' | 'notRecorded'; causes: string[] }`
  - `ParetoModel { bars; total; distinct; topNShare; crossIndex: number | null; categories: CategorySlice[] | null; otherCauses: Array<{label; count}>; readout: string }`
- [ ] **`buildRootCausePareto(index, view, scope: 'all' | 'open', today)`.**
  - **Selection:** include issues created in the window ending at W. For `open`, keep only issues open as of W (reuse `issueBenchmarks` helpers).
  - **Grouping:** group causes ignoring case and whitespace, keeping the first spelling (reuse `createNameGrouper` from `grouping.ts`).
  - **Bars:** the top 9, then Other (n causes), then Not recorded only when its count is above 0. Not recorded is excluded from the cumulative.
  - **Vital:** a bar is vital up to and including the one where the cumulative first reaches 80% or more.
  - **Ties:** break by label using `NAME_COLLATOR`.
- [ ] **`paretoIssues(index, bar, view, scope, today)`.** The drill rows: open issues first, oldest first, then closed issues. Each row carries age or time to close.
- [ ] **Category slices.** Only when `hasRootCauseCategory`.
- [ ] **Read-out text.** Exactly as the spec words it.
- [ ] **Tests.** Cover grouping, Other, Not recorded, the 80% split, ties and open-only, plus a fixture test asserting the spec's Pareto numbers (All: 177 issues, 27 causes, the bar values, 79.1%, the categories, Installation 48 = 18 open and 30 closed; Open only crosses at Incomplete Work, 82.4%).
- [ ] Commit: `feat: root cause Pareto model`.

### Task 4: Pareto page UI and the BIM Issues header buttons

- [ ] **`ParetoChart.tsx`.**
  - Bars with a cumulative line on a right 0–100% axis, plus the dashed 80% line.
  - Vital bars in series 1, the rest in series 2, and Not recorded in grey.
  - Count labels. Line labels at the 80% crossing and at the end, with collision avoidance through `chartLabels.ts`.
  - Wrapped axis labels.
  - The selected bar is highlighted. Clicking a bar or pressing Enter selects it; arrow keys move between bars.
  - A tooltip and a static aria-label with a live region.
  - Use `useElementSize`.
  - Tests: no label collisions at 3 sizes; selection; keyboard.
- [ ] **`RootCauseCategoryPanel.tsx`.** The strip, the category rows and the "Inside Other" list.
- [ ] **`RootCauseParetoPage.tsx`.**
  - The `All issues | Open only` toggle (`SegmentedToggle`), the chart, the panel, the read-out, and the drill-down table.
  - The table is windowed and sortable: build it on `tableSort.ts` and `useVirtualRows`, reusing the IssueDetailTable patterns and the status pill.
  - The model is memoized on `[index, view, scope]` and computed only while the page is mounted.
- [ ] **`IssuesDashboard.tsx` header.**
  - Header order: Issue Detail, Issues by Root Cause Pareto (lucide `ChartColumnDecreasing`), Issue Aging (lucide `Hourglass`).
  - Both new buttons open `kind: 'page'` panels.
  - The Pareto button is hidden when `!index.hasRootCause`, and every button is hidden when interactions are off.
  - The Issue Aging panel renders a placeholder until Task 5. In this task add only the button and its panel, with `renderExpanded` returning `<IssueAgingPage …>`; Task 5 builds that component. If Task 5 hasn't landed yet, create a minimal stub exported from `IssueAgingPage.tsx` that Task 5 replaces.
- [ ] **Tests.**
  - The buttons appear in order.
  - The Pareto button is hidden when Root Cause is unbound.
  - Pages open and close with focus return.
  - Fixture: the Pareto page shows Installation 48 and the read-out.
- [ ] Commit: `feat: Issues by Root Cause Pareto page`.

### Task 5: Issue Aging page UI

- [ ] **`AgeBucketsChart.tsx`.**
  - The window band with its label, the typical marker, coloured bars and count labels.
  - Clickable bars: pointer, hover outline, tooltip hint, and Enter. Empty buckets aren't clickable.
  - A caption below the chart.
  - Tests: bucket colours; clicks; empty buckets not clickable; no band when there's no window.
- [ ] **`BacklogAgeChart.tsx`.** The median-age line, a dashed window line with its label, the last point labelled, `WeekAxisTick`, and a tooltip.
- [ ] **`QuarterCloseChart.tsx`.** Bars coloured against typical, median labels, a `closed` count row, empty "no closures" slots, a typical line labelled on the axis, and a tooltip.
- [ ] **`AgingIssueList.tsx`.**
  - An in-page slide-up panel with a title and a filter chip, and a windowed, sortable table: ID, Title, Contractor, Created On, Age, and vs normal.
  - Back and Esc close it, and focus returns to the opener.
  - Tests: the filter chip clears; sorting; focus return.
- [ ] **`IssueAgingPage.tsx`.**
  - Page controls: `RangeToggle` and the week picker, using the dashboard's week window, which is passed in.
  - The cards. The red card is clickable and opens the list filtered to past-window issues.
  - The three charts in the mockup layout. The expand icon on chart 1 opens the unfiltered list.
  - Memoize the benchmarks on `[index, selectedKey]` and the profile on `[index, view]`.
  - Footnotes.
- [ ] **Fixture test.** At WW42: 51, 32 days, 51 past and 28. Clicking 12+ months lists 19 issues. At WW30: 50 open and 39 past.
- [ ] Commit: `feat: Issue Aging page`.

### Task 6: Overview cards

- [ ] **`overview.ts`.**
  - BIM card 4 becomes "Past normal close window", with `buildIssueBenchmarks` as of W (the same value in both modes) and the sub-line and tone from the spec.
  - The quality strip gains the sixth card, "Top root cause", in both modes with the "Add Root Cause" state.
  - Benchmarks are only computed as of W, and memoized.
- [ ] **`OverviewDashboard.tsx` and `qaqc.less`.**
  - Six strip cards, including the dense layout.
  - Truncate long cause names with a `title`.
  - The strip must fit at 1280×720 and 1340×790 in both modes without truncating a detail line. Rerun the earlier truncation sweep across weeks.
- [ ] **Tests.** Fixture values: 51, `of 51 open · 28 older than any closure · 71.2% closed`, Installation `48 of 177 issues · 27%`, and `None opened this WW`. Also cover the unbound state.
- [ ] Commit: `feat: Overview past-window and top root cause cards`.

### Task 7: Package, versions, guides, release

- [ ] **`packages/qaqc-issues`.**
  - Add the optional `rootCause` and `rootCauseCategory` roles to `capabilities.json` (`max: 1`) and their resjson keys.
  - `visual.ts` needs no new required-slot handling.
  - Add visual tests for bound and unbound states.
  - Bump the version to 1.1.0 in `pbiviz.json` and `package.json`.
- [ ] **`packages/qaqc-overview`.** Add the optional `rootCause` role and resjson, a visual test, and bump the version to 1.1.0.
- [ ] **Guides.**
  - `QCx_Issues_SETUP.md`: the two optional slots, and the Pareto and Issue Aging pages (period, scope, click-through, what "normal close window" means).
  - `QCx_Overview_SETUP.md`: the new cards and the Root Cause slot.
  - `QCx_Combined_SETUP.md`: the new column (done in Task 1; verify it).
  - Keep both package folders identical.
- [ ] **Build and checks.**
  - Build all six QCx packages and confirm `[verify] ok`, with one `.pbiviz` per `dist/` (remove the stale old-version file pbiviz leaves behind).
  - Run the full `npx vitest run`.
  - `review:business` must show 0 issues.
- [ ] **Sync and zip.**
  - Run `sync:business` and `sync:lotusworks`. Only the QCx `.pbiviz` files, the guides, `.pq` and the reports may change. The old Issues 1.0.1 and Overview 1.0.0 files must be gone.
  - Zip to `releases/LotusWorks_Package_2026-10-19_QCx-Issue-Insights.zip`.
- [ ] Commit: `feat: package QCx BIM Issues 1.1.0 and Overview 1.1.0`.

### Task 8: Visual verification (controller)

- [ ] **Coverage.** In the browser, compare the Issues harness (port 5193) and the Overview harness (port 5194) with the mockup screenshots. Check:
  - the presets and high contrast
  - compact and 800×300
  - both pages
  - every click path
  - WW30
  - 200k synthetic issues
