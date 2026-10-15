# QAQC BIM Issues Visual — Design

## Scope

The fourth QAQC visual, built on the Smartsheet **BIM Issues Log**. It ports the HTML app's issue logic (source of truth: the HTML app, `src/calculations/report.ts`, `src/utils/issueOwnership.ts`, `src/App.tsx` on `origin/main` of `qaqc-weekly-report-dashboard`). The OAC/Justine/Manual reporting modes are dropped: the week picker selects the **current week** (default: today's ISO week), and "previous week" is the week before it.

It shares the Electrical foundation (`2026-10-15-qaqc-electrical-visual-design.md`): the look, presets, Format pane, week picker and `30 WW | All`, bar-click selection, the **expanded chart view** (`ChartExpansionFrame`), the release gate, the CSS build guard, and per-package `visual.ts` / `settings.ts`. Charts match the HTML app; DESIGN.md's single-axis rule does not apply (user decision 2026-10-15).

Package: `packages/qaqc-issues`, GUID `qaqcIssues_<12 hex chosen at scaffold time>`, class `QaqcIssuesVisual`, display name "QAQC BIM Issues", version 1.0.0, header icon lucide `CircleAlert`, Fields-pane icon a new `alert` shape (circle with an exclamation cut out) in `scripts/make-qaqc-icon.mjs`.

## Field slots

| Slot (role) | Smartsheet column | Required |
|---|---|---|
| ID (`id`) | ID | yes |
| Title (`title`) | Title | yes |
| Status (`status`) | Status | yes |
| Type (`type`) | Type | yes |
| Contractor (`contractor`) | Contractor | yes |
| Created On (`createdOn`) | Created On | yes |
| Updated On (`updatedOn`) | Updated On | yes |
| Due Date (`dueDate`) | Due Date | yes |
| Created By (`createdBy`) | Created By | yes |

All 9 slots are required, validated in code. Discipline is not used by any card, chart or column, so it has no slot (Power BI slicers on the page still filter by it). Issue IDs are unique, so no Row ID slot is needed: Power BI can't merge two issues that differ in ID.

## Rules (ported from the HTML app)

- **Included issues:** `Created By` passes `isLotusWorksIssueCreator`. After normalizing to lower case with non-alphanumerics collapsed to single spaces, it contains `lotusworks`, or it contains `removed` together with `samuel leach` or `aaron harwood`. A blank Created By is excluded. The BIM360_* legacy columns are not supported (not in the Smartsheet export).
- **Status kind:** trimmed and lower-cased; `void` → void, `closed` → closed, `pending` → pending, anything else (blank, "Open", "Not approved", "Ready to Inspect") → open. Void issues are excluded everywhere. Pending issues display as "Open" in the detail table.
- **Dates:** Power BI may deliver Date objects, ISO strings, `M/D/YYYY` strings, or Excel serial numbers. Port the HTML `parseDate` behavior (local noon). Created week = ISO week of Created On; issues without a Created On are skipped (and footnoted). **Closed week** = ISO week of Updated On, only for closed issues with an Updated On; closed issues without one count as neither closed-through nor closed-in-week.
- **Contractor:** trimmed; when blank, `Bayside` if the ID's trailing digits are exactly `1021`, otherwise `Unassigned`.
- **Subtype:** Type, else `Uncategorized`. **Title:** else `Untitled issue`.
- Future-dated created weeks are excluded from the dropdown and totals, like the other visuals.

## Cards

*W* = selected week, *W−1* = the week before.

| Group | Card | Value | Delta and tone |
|---|---|---|---|
| This WW | Issues Opened | created in W | vs W−1; warn amber when up, else neutral |
| This WW | Issues Closed | closed in W | vs W−1; good green when ≥ previous and above 0, else neutral |
| Project to date | Total Opened | created through W | vs through W−1; bad red when up, good green when down |
| Project to date | Total Closed | closed through W | vs through W−1; good green when up, neutral when unchanged |
| Project to date | Remaining Open | Total Opened − Total Closed | vs through W−1; bad when up, good when down |
| Project to date | Closure Rate | Total Closed ÷ Total Opened | points vs through W−1; good when up, bad when down; `n/a` with no opened |

## Charts

### Issues by Work Week (large) — matches the HTML `RangeChart`

- Per week in the window: **Opened** (bad red) and **Closed** (good green) bars side by side, value labels on bars with a count above 0.
- **Remaining Open** (cumulative opened − cumulative closed, through each week) as a smooth amber (warn) line with dots and a light area fill, on a **right axis** with its own nice scale; value labels on every 3rd point and the last point.
- The selected week has the highlight band; bar click and keyboard select the week like the other charts. Tooltip: week, Remaining, Opened, Closed. Legend: Remaining Open, Opened, Closed.
- Expanded: value labels on every line point that fits, and a summary strip for the window (opened, closed, net change in remaining, closure rate at the window end).

### Open Issue Aging (small) — matches the HTML `OpenAgingChart`

- Open and pending issues (with a Created On) as of **today**, in five buckets by age in days: `0-1` (<7), `1-2` (<14), `2-3` (<21), `3-4` (<28), `4+` weeks. Vertical bars, value label inside when ≥ 24 px tall, else above. Colors are an ordinal ramp of the preset's series 1 (opacity 0.35 → 1.0), fixed in high contrast to foreground.
- Expanded: a sortable table of the open issues (ID, Title, Contractor, Created On, Age in days, Status), oldest first.

### Overall Issue Aging (small) — matches the HTML `AgingChart`

- Every included issue with a Created On: age to its closed date (closed) or to today. Buckets `0-14 Days`, `14-28 Days`, `28+ Days`. A 100% stacked strip plus one row per bucket (swatch, label, proportional bar, count, percent).
- Expanded: the same plus counts split into closed and still open per bucket.

## Issue Detail

- A header button **"Issue Detail"** (lucide `TableProperties`, `aria-label` "Open Issue Detail") opens a full-visual overlay with the same animation and focus rules as an expanded chart (Esc or a back button returns). It is hidden when interactions are not allowed.
- Title "BIM Issues Detail" and the selected week label.
- **Cards:** Opened This Week (created in W), Closed This Week (closed in W), Opened Last Week (created in W−1), Closed Last Week (closed in W−1).
- **Table:** every included issue created or closed in W or W−1 ("report rows"), then every other open or pending issue created in or before W, since the week picker reads "as of W" ("Open for discussion" rows, shaded like the app: `#edf3f7`-style tint from the preset, inset left bar, `title="Open for discussion"`). Report rows first, then discussion rows; each block sorted by ID descending (numeric-aware). Clicking a column header sorts the whole table by that column (discussion shading stays); clicking again reverses; `aria-sort` on the active header.
- **Columns:** ID, Subtype, Status (pill), Title, Contractor, Work Week (created), Created On (`MM/DD/YY`), Work Week Closed (label, `Open` when not closed, blank when closed without a date), Due Date (`MM/DD/YY`).
- The table scrolls inside the overlay (sticky header); no pagination.

## Format pane

Same cards as Electrical. (No hotspot settings.)

## Expected numbers (October export, today = 2026-10-15)

- 208 rows; 203 have a LotusWorks creator (excluded: `#1021`–`#1024` blank Created By, `#920` "No"); 26 of those are Void; **177 included issues**. First created week WW46'2024.
- Through WW42: Total Opened 177, Total Closed 126, Remaining Open 51, Closure Rate 71.19%. WW42 and WW41 cards: 0 opened, 0 closed (no activity after WW31 in this export).
- WW31: Issues Opened 2, Issues Closed 1. WW30: opened 1, closed 1. WW28: opened 3, closed 4.
- Open Issue Aging (today): all 51 open issues in `4+`.
- Overall Issue Aging (today): `0-14 Days` 38, `14-28 Days` 19, `28+ Days` 120.
- Issue Detail at W = WW42: 0 report rows, 51 discussion rows. At W = WW32: 3 report rows (`#1020`, `#1019`, `#1004`), 49 discussion rows.
- Status labels among included issues: Closed 126, Open 43, Not approved 6, Ready to Inspect 1, Ready to inspect 1.

## Shared pieces

- The Issue Detail overlay reuses `ExpandedPanel` and the `ChartExpansionFrame` focus/inert/animation behavior. If `ChartExpansionFrame` can't open a non-chart panel from a header button, extend it with a minimal, tested addition rather than duplicating the machinery.
- `parseDate` (port) lives in `qaqc-shared/src/workWeeks.ts` (or a sibling `dates.ts`) with tests.
