# QCx Filter Menu and Week Drill-Down — Design

## Why

Report users want more ways to see what they want without building slicers: filter any QCx dashboard by contractor, date range, building and similar fields, and click a week on a chart to see the issues behind its number. The owner also wants QCx Issues to show other companies' issues on demand, since it shows only LotusWorks-created issues today, and to carry the NCR Pass Rate.

The approved reference is the clickable mockup, `/private/tmp/claude-501/-Users-noahgarrett-Codebase-QAQC-Weekly-Report/758b0a9f-4c45-496f-be89-b387c5cbd742/scratchpad/filter-mockup/filter-mockup.html` (not committed; it holds real rows). This document is authoritative where the two differ.

## Goals

1. A **Filter** button in the header of all six QCx dashboards: Electrical, Mechanical, Welding, Issues, Overview, Performance.
2. A **week drill-down** on the charts that show issues.
3. **QCx Issues**: a multi-select Created By (Company) filter, defaulting to LotusWorks, and an NCR Pass Rate card.

## Non-goals

- QCx FFU Map keeps its own filters.
- No Created By (Company) filter on the Overview. It keeps counting LotusWorks-created issues only.
- Filters and drill-down state aren't persisted. They reset when the report reopens, like the other in-visual controls.
- No spelling correction. Typos such as `F632`, `STRUCURE` and `CONA` stay separate values; the owner fixes them in the sheets.
- Bookmarks and cross-visual sync of the in-visual filters are out of scope.
- No new npm dependencies.

## Decisions from the owner

- Metric name is **NCR Pass Rate**: the share of inspections that pass without an NCR, `100% − (NCRs ÷ Finals)`. No small print on its cards.
- LotusWorks is its own Created By (Company) choice, ticked by default.
- The mockup's behaviour and the recommendations below are approved ("go with your recommendations and build it").

## Filter menu

**Button.** Lucide `ListFilter` icon and the label "Filter", placed in the header before the `30 WW | All` toggle and the week picker. When filters are active it takes the accent state and shows a count badge of active filter groups (date range counts as one, each field counts as one). With interactions disallowed (`allowInteractions` false) the button is disabled.

**Popover.** Anchored right-aligned under the button, its height limited to the tile with an internal scroll, closed by Esc and by an outside click. Esc closes the menu first, before any open page. Contents, top to bottom:

1. **Date range:** From and To work-week dropdowns, labelled with `(start)` and `(now)` at the data's limits, and presets Last 4 WW, Last 13 WW and This year.
2. **One collapsible section per field,** each with a value search box and a checkbox list showing row counts, sorted by count descending. A field's value counts come from the unfiltered rows, so they don't change as other filters are ticked.
3. **Footer:** "Clear all" and live "Showing X of Y rows".

Changes apply immediately; there's no Apply button.

**Chips.** Under the header while any filter is active: one removable chip per active group ("Building: F63.1, F63.2 ×", "Date range: WW10'2026 to WW30'2026 ×"), then "Clear all".

**Matching.** Within a field values are OR; across fields AND. Selecting nothing in a field means no filter on it.

**Value grouping.** Values group trimmed and case-insensitively, shown in their most common spelling. Blank, `N/A`, `n/a`, `NA`, `None` and `-` group into one **Not recorded** value, always listed last. Filtering uses the groups, so ticking "Electrical" also matches `ELECTRICAL`.

**Same value as the charts.** A filter must never disagree with what the dashboard shows. A field a chart already labels uses the chart's value, through the same reader: blank Building is "Unspecified", blank Contractor is "Unassigned", and the existing Contractor defaults (`issues.ts:57-61`) apply. For these fields that label replaces "Not recorded" and is still listed last. Status is the exception: it lists the sheet's values grouped as above, so Pending can be picked apart from Open even though both count as open on the cards.

**Unbound fields.** A field whose slot isn't bound doesn't appear in the menu. A dashboard with no optional filter slots bound still shows Date range. All new slots are optional, so existing reports keep working and only gain the fields once bound.

**No matching rows.** The dashboard shows a clear empty state with a "Clear filters" action, not zeros that read as real data. A percentage with no denominator shows `n/a`.

**Data refresh.** Filters survive a refresh; ticked values no longer in the data are dropped. If a date range limit is no longer in the data, it clamps to the data.

**Tile size.** The menu works at the visuals' existing compact sizes. On cards-only tiles (under the existing `CARDS_ONLY_HEIGHT`) the button stays and the popover scrolls within the tile.

### Fields per dashboard

| Dashboard | Fields, in menu order |
|---|---|
| Electrical, Mechanical | General Contractor, Trade Supplier, Building, Discipline, Inspection Category, Status |
| Welding | Building, Pipe Spec, Fluid Code, Welder, Work Package |
| Issues | Created By (Company), Contractor, Status, Type, Discipline, Root Cause |
| Overview | Contractor, Building, Discipline |
| Performance | Contractor, Building, Discipline (Pipe Spec and Fluid Code on the Welders group) |

Welding Building is the value the visual already derives from Tag No (`welds.ts`). Welder is comma-separated. Split it the way Performance does, so a weld listing several IDs matches any of them and is counted once per weld in the "Showing" count.

**Performance group.** Performance shows only the fields that apply to the group on screen. Filters on a field of the other group stay set but don't apply.

### Date range

- Work weeks, not calendar dates. All sources already carry them.
- It replaces the `30 WW | All` window: the toggle is disabled while a range is set. Charts show exactly the weeks in the range.
- The week picker's options are limited to the range. The selected week clamps inside it, and This WW cards follow the selected week.
- "To date" card groups are retitled **In range** with the subtitle `WW.. to WW..`, and their totals restate to the range. Card labels follow the existing wording with "in Range" where they said "to date" (e.g. "Finals in Range").
- A range whose From is the first data week and To is the current week is equal to no range and isn't active.
- Presets end at the current work week. Last 4 WW covers 4 weeks including the current one. This year starts at the first work week of the current year.

### Charts in a date range

- **Cumulative rates restart at From:** NCR Pass Rate Trend's last point equals the In Range card. Lines already showing a rate per week don't change.
- **Remaining Open line:** stays the true open count each week, so its last point equals the Remaining Open card.
- **Not restated by date range:** Issue Aging, Open Aging, the Pareto and building tables that carry their own period. They do follow field filters. Issue Detail follows the selected week as today.
- **Building charts and tables** that read the 30 WW window read the range instead.

### Issue cards in a date range

- **Total Opened:** opened in range.
- **Total Closed:** closed in range.
- **Remaining Open:** the open count at the end of the range. It's not restated to the range, because that could go negative.
- **Closure Rate:** the share of issues opened in the range that are now closed. Closed ÷ opened could pass 100%. This can't come from the opened and closed series: the index needs a count of currently closed issues per created week.

With no range set, all four behave as they do today.

### Sources without a field (Overview, Performance)

Welding rows have no Contractor or Discipline, and BIM rows have no Building. Those filters leave that source's numbers unfiltered, and a small note on the affected dashboard says so ("Welding isn't filtered by Contractor"). The note appears only while such a filter is active. Building does filter welding rows, through the derived Building.

**DWN rate.** Green tags is a single unfiltered measure, so a filtered or in-range DWN rate would mislead. While any filter is active on the Overview, the DWN rate shows `n/a` with "Not available with filters".

**Overview's Contractor** is one menu field reading two slots, General Contractor on inspection rows and Contractor on BIM rows, merged into one list.

## Created By (Company) on QCx Issues

Per issue:
- If the existing include rule (`isIncludedIssue` in `issues.ts`) says LotusWorks-created, the value is **LotusWorks**.
- Otherwise it's the trimmed `Created By (Company)` value, and blank is Not recorded.

Behaviour:
- The index must now read all issues; the LotusWorks-only rule moves out of indexing and becomes this filter's default. Void and undated exclusions are unchanged.
- First section after Date range. Default selection: LotusWorks only. The opening view equals today's visual.
- The default isn't an active filter: no badge and no chip while only LotusWorks is ticked. Any other selection is active.
- Unticking everything falls back to the default. "Clear all" restores the default. A **Select all** link in this section ticks every company. "Showing X of Y" counts every issue row.
- All cards, charts, Issue Detail, the Pareto and Issue Aging recalculate for the selected companies.
- If the `Created By (Company)` slot isn't bound, the field doesn't appear and the visual behaves exactly as it does today. The footnote "excluded issues" count, if shown, follows the selection.
- The Overview and Performance keep the fixed LotusWorks rule. Sharing the code must not change their numbers.

## Week drill-down

**Trigger.** Clicking a week on a chart that shows issues selects the week, as most charts do today. If that week has issues, it also opens the drill-down. Clicking a week with none only selects it. Keyboard selection (Enter on the focused week) behaves the same. `LineChart` (NCR Pass Rate Trend) has no click or keyboard selection today, so it gains both.

**Where.**

| Dashboard | Charts | List shows |
|---|---|---|
| Electrical, Mechanical | Finals + SORs by Work Week; NCR Pass Rate Trend | The rows behind that week's "Issue found" count |
| Welding | Weekly charts that show issues | Welds with an issue that week |
| Issues | Issues by Work Week | Opened that week and closed that week, as two labelled groups |
| Overview | The weekly activity charts (a click hits the whole week, not one line) | That week's NCRs from Electrical, Mechanical and Welding, labelled by source. BIM rows aren't listed, because the Overview doesn't count BIM NCRs |

Performance's person page already lists NCRs below its chart, so it doesn't change. Charts inside Issue Aging and the Pareto don't change.

**Rule for inclusion.** The drill-down's rows always equal the count the chart shows for that week, under the active filters. A test pins this for every dashboard.

**View.** A page over the visual using `ChartExpansionFrame` `kind: 'page'`, with a Back button and Esc to return. Focus returns to the chart. Title: `Issues · WW23'2026`, with the count. The table is sortable and virtualised using the shared table code, and each row shows:

| Source | Columns |
|---|---|
| Electrical, Mechanical | Building, Phase, Issue (cell text), Inspection ID, Equipment ID / Tag Number, Issue ID, Finding Type, Status, Date Observed, QCR/FE, Notes |
| Welding | Tag No, Welder, Pipe Spec, Fluid Code, Issue Created, Signature |
| Issues | Existing Issue Detail columns |

Long text wraps or truncates with the full value as a title, following `IssueDetailTable`. Columns whose slot is unbound are hidden, and the required slots alone still give a useful list.

## NCR Pass Rate on QCx Issues

A visual reads one table, and the issues export has no inspections. So QCx Issues gains optional **Source**, **Work Week**, **Inspection Phase** and **Issue** slots, and can be bound to QCx Combined in place of the issues table:

- With Source bound, rows split by Source. BIM rows drive the dashboard; Electrical and Mechanical finals drive the card. Welding rows are ignored.
- The card **NCR Pass Rate** joins the Project to date group, using the same calculation as the Overview's "Inspection NCR pass rate" through the selected week, or in range when a range is set.
- Unbound, the card is hidden and the visual works from the issues table alone, as today.
- Issue filters don't apply to the card's inspection rows, except Date range. While any issue field filter is active, the card shows a small note "All inspections".

## Data: slots and QCx Combined

All new roles are optional, added to `capabilities.json`, `settings` where needed, and `dataView.ts`'s optional sets.

| Visual | New optional slots |
|---|---|
| Electrical, Mechanical | General Contractor, Trade Supplier, Discipline, Inspection Category, Status, Inspection ID, Equipment ID / Tag Number, Issue ID, Finding Type, Date Observed, QCR/FE, Notes |
| Welding | Welder, Work Package (Pipe Spec, Fluid Code and Tag No are already required) |
| Issues | Created By (Company), Discipline, Source, Row ID, Work Week, Inspection Phase, Issue |
| Overview | General Contractor, Contractor, Discipline, Tag No, Welder, Pipe Spec, Fluid Code, plus the inspection drill-down columns above |
| Performance | Contractor, Discipline, Pipe Spec, Fluid Code |

**QCx Combined** grows. Each new column uses `MissingField.UseNull`, so older sources still load:
- From Electrical and Mechanical, spelled exactly as the sheets spell them: `General Contractor`, `Trade Supplier`, `Discipline`, `Inspection Category`, `Status`, `Equipment ID / Tag Number`, `Issue ID`, `Finding Type`, `Date Observed`, `Notes`. `Inspection ID` exists only on Electrical, so it's null on Mechanical rows. `Status` shares the BIM status column; the row's Source tells them apart.
- From Welding: `PIPE SPEC`, `FLUID CODE`, `WORK PKG` (headers as the sheet spells them, renamed `Pipe Spec`, `Fluid Code`, `Work Package`). `combined.ts`, which hardcodes Pipe Spec and Fluid Code as absent, changes to read them.
- From the enriched export: `Title`, `Contractor`, `Due date`, `Discipline`, `Created By (Company)`.
- `General Contractor` (inspections) and `Contractor` (BIM) stay separate columns; the Overview merges them.
- Root Cause Category isn't added: the enriched export has no such column, so nothing is lost.
- The existing 22 columns keep their names and order; new ones go after them. The owner re-pastes the script and edits the same four source names at the top.

## Architecture

- **Shared filter core** in `packages/qaqc-shared/src`: value grouping, catalogue building, row matching. Pure and unit-tested.
- **Shared UI:** `FilterMenu` and `FilterChips` components, used by every dashboard through `DashboardHeader`.
- **Rebuild on change.** Today `visual.ts` builds the index once per data update. Field filters change the rows, so the index must rebuild when they change, inside a memo keyed by rows and filter state. Date range doesn't change the rows: it's a view concern handled through `useWeekWindow` and `ViewState`, and models restate from the cumulative series.
- **Row retention for drill-down.** The index keeps enough per-week information to list a week's rows (row positions per week, not copies), keeping the existing O(N) once-per-update cost and memory bound.
- `visual.ts` and `settings.ts` stay per package, because the review gate greps them.
- Follow existing patterns: `useWeekWindow`, `ChartExpansionFrame`, `SegmentedToggle`, `WindowedIssueTable`, `tableSort.ts`, `HeaderOverlayButton`.

## Performance

The user priority is unchanged: handle massive data. Budgets, in the `qaqc-shared-timing` project with `bestOf`, at 100,000 rows: matching rows against filters under 50 ms, and a filter change's index rebuild within the existing 300 ms index budget (`benchmark.test.ts`) for a single-source visual. Existing budgets must keep passing. The Overview rebuilds only the sources a filter touches. Opening a drill-down for a week must not scan all rows.

## Testing

- Unit tests for grouping (case, trim, Not recorded), matching (OR within, AND across), comma-separated Welder, and date range clamping and presets.
- **Numbers don't move:** with no filters set, every dashboard's existing fixture tests pass unchanged. That includes the enriched fixture's 231 issues, 175 closed, 56 remaining.
- **Created By (Company)** fixture test, adding the company column to the enriched fixture (company names aren't personal data; creator names stay reduced to LotusWorks/Other). The real distribution: LotusWorks 231, Ivory - QA 515, Ivory - Ops 256, Ivory 23, Greyfox 17, Bayside 21, Larch 4, Not recorded 10 (total 1,077). LotusWorks + Greyfox + Bayside gives 269 opened, 211 closed, 58 remaining, 78.4%, matching the mockup at the same `today`.
- In-range cards, including Closure Rate and Remaining Open.
- Drill-down row count equals the chart's count for every dashboard, with and without filters.
- QCx Issues bound to QCx Combined needs Row ID so identical inspection rows aren't merged; a test pins the finals count.
- Keyboard and accessibility: popover focus, Esc order, chips, aria for checkboxes.
- Visual check of the menu, chips, in-range state, empty state and drill-down, in each dashboard, at normal and compact sizes.

## Delivery

| Visual | From | To |
|---|---|---|
| QCx Electrical Inspections | 1.1.1 | 1.2.0 |
| QCx Mechanical | 1.0.1 | 1.1.0 |
| QCx Welding | 1.0.1 | 1.1.0 |
| QCx Issues | 1.2.1 | 1.3.0 |
| QCx Overview | 1.2.0 | 1.3.0 |
| QCx Performance | 1.1.0 | 1.2.0 |

All GUIDs stay the same, so re-importing updates reports in place. Setup guides in both package folders document the new slots, the filter menu, the drill-down and the new `QCx_Combined.pq`. No drawing data or real names go in fixtures or docs.

## Left to the builder

Internal names and file layout, within the patterns above; the exact wording of notes and empty states, in the guides' voice; the popover's internal layout details, matching the mockup.
