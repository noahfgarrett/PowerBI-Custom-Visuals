# QAQC Overview and Performance Visuals — Design

## Scope

Two new QAQC visuals that read one shared **QAQC Combined** table, plus one shared change to week labels across all QAQC visuals.

1. **QAQC Overview** (`packages/qaqc-overview`): a one-stop page with Electrical, Mechanical, Welding and BIM Issues side by side, a quality strip, and two charts.
2. **QAQC Performance** (`packages/qaqc-performance`): NCR performance per QCR/FE (Electrical and Mechanical) and, separately, per welder.
3. **Year-qualified week labels** in every QAQC visual.

Both visuals share the Electrical foundation (`2026-10-15-qaqc-electrical-visual-design.md`): the look, presets, Format pane (background, card opacity, animation, accessibility), the week picker, `30 WW | All`, bar-click week selection, the expanded chart view (`ChartExpansionFrame`), required Row ID, performance targets, error states, the release gate, the CSS build guard, and per-package `visual.ts` / `settings.ts`. Charts follow the HTML app's style. DESIGN.md's single-axis rule does not apply (user decision 2026-10-15).

All counting rules are the ones the existing visuals already use (`inspections.ts`, `welds.ts`, `issues.ts`). The new visuals split the combined rows by Source and reuse those rules, so their numbers match the discipline visuals exactly.

| Package | GUID | Class | Display name | Version | Header icon | Fields-pane icon | Dev port |
|---|---|---|---|---|---|---|---|
| `qaqc-overview` | `qaqcOverview_AE84E1DA71E7` | `QaqcOverviewVisual` | QAQC Overview | 1.0.0 | lucide `LayoutDashboard` | new `dashboard` shape | 5194 |
| `qaqc-performance` | `qaqcPerformance_AD661934E05F` | `QaqcPerformanceVisual` | QAQC Performance | 1.0.0 | lucide `Users` | new `people` shape | 5195 |

## The QAQC Combined table

A custom visual sees only one table, and the four Smartsheet sheets are unrelated tables. The user adds one Power Query query, **QAQC Combined**, that appends the four existing queries into one table with fixed column names. The setup guide ships the script. The user edits only the four query names at the top.

The script does the following:
- **Select and rename** each source's columns into the schema below, and add `Source`. Columns that don't apply to a source are `null` on that source's rows.
- **Fail loudly** when an expected column is missing. It uses `Table.SelectColumns` with `MissingField.Error`, so a renamed Smartsheet column fails the refresh with Power Query's own "column not found" message instead of producing zeros.
- **Set types:** text for every text column, date for `Created On` and `Updated On`.
- **Append** the four tables and add a 1-based index column `Row ID` after the append.

| Column | Electrical | Mechanical | Welding | BIM |
|---|---|---|---|---|
| Source | `"Electrical"` | `"Mechanical"` | `"Welding"` | `"BIM"` |
| Work Week | Work Week Observed | Work Week Observed | WELD WORK WEEK | — |
| Inspection Phase | Inspection Phase | Inspection Phase | — | — |
| Issue | Issue? | Issue? | ISSUE CREATED? (Put BIM # If Yes) | — |
| Building | Building | Building | — | — |
| QCR/FE | QCR/FE | QCR / FE | — | — |
| Welder | — | — | WELDER | — |
| Tag No | — | — | TAG NO | — |
| Signature | — | — | SIGNATURE | — |
| Work Week Signed | — | — | WORK WEEK SIGNED | — |
| ID | — | — | — | ID |
| Status | — | — | — | Status |
| Type | — | — | — | Type |
| Created On | — | — | — | Created On |
| Updated On | — | — | — | Updated On |
| Created By | — | — | — | Created By |

Note the Mechanical header spelling `QCR / FE`, which differs from Electrical's `QCR/FE`.

**Source matching.** The visual reads `Source` trimmed and case-insensitively. Rows with any other value are skipped and footnoted (`n rows with an unknown Source`).

### Field slots

The two visuals bind to the same table but declare only the slots they use. Every listed slot is required and validated in code, except where marked optional.

| Slot (role) | Column | Overview | Performance |
|---|---|---|---|
| Source (`source`) | Source | yes | yes |
| Row ID (`rowId`) | Row ID | yes | yes |
| Work Week (`workWeek`) | Work Week | yes | yes |
| Inspection Phase (`phase`) | Inspection Phase | yes | yes |
| Issue (`issue`) | Issue | yes | yes |
| Building (`building`) | Building | yes | yes |
| QCR/FE (`qcr`) | QCR/FE | — | yes |
| Welder (`welder`) | Welder | — | yes |
| Tag No (`tagNo`) | Tag No | — | yes |
| Signature (`signature`) | Signature | yes | — |
| Work Week Signed (`signedWeek`) | Work Week Signed | yes | — |
| ID (`id`) | ID | yes | — |
| Status (`status`) | Status | yes | — |
| Type (`type`) | Type | yes | — |
| Created On (`createdOn`) | Created On | yes | — |
| Updated On (`updatedOn`) | Updated On | yes | — |
| Created By (`createdBy`) | Created By | yes | — |
| Green tags (`greenTags`) | the user's DAX measure | optional | — |

`Green tags` is a measure role. The measure isn't related to the combined table, so it evaluates to the same total on every row. The visual reads the first finite number in that column. If the value is missing, blank or not a number, the DWN rate shows `n/a`.

### Reading the combined rows

- `readCombinedTable` in `qaqc-shared/src/dataView.ts` returns the column positions for the bound roles. It is shared by both visuals, each passing its own slot list.
- `splitCombinedRows(rows, sourceColumn)` makes one pass and returns `{ electrical, mechanical, welding, bim, unknownSource }` as row arrays. Rows are shared by reference, never copied.
- Each discipline is indexed with the existing builders, given the combined table's column positions:
  - `buildInspectionIndex` for Electrical and Mechanical
  - `buildWeldIndex` for Welding
  - `buildIssueIndex` for BIM
- The Overview's current week is the current ISO week. The four discipline indexes span different week ranges, so the overview model aligns them by week key, using the union of their weeks.

## Shared change: year-qualified week labels

This applies to every QAQC visual (Electrical, Mechanical, Welding, BIM Issues, Overview, Performance).

- Every text label of a week reads `WW41'2026`. That covers card sub-lines ("vs WW41'2026"), group titles, tooltips, live regions, table cells, footnotes and the picker. `shortWeekLabel` stays only for chart axis ticks.
- Chart axes keep `WW41` ticks. A small year label (`2026`) sits under the first labelled tick and under the first labelled tick of each new year. This replaces the current `spansYears` switch to `WW41'26` ticks.
- The shipped visuals get patch releases: Electrical 1.1.1, Mechanical 1.0.1, Welding 1.0.1, BIM Issues 1.0.1. Their setup guides note the change.

## QAQC Overview

### Header

`LayoutDashboard` icon, title "QAQC Overview". The controls, from left to right:
- **`This WW | To date`** sets the card mode. The default is This WW. The choice is per session and isn't persisted.
- **`30 WW | All`** sets the chart range.
- **The week picker** defaults to the current week. Its week, window and fallback semantics are identical to the other dashboards (`useWeekWindow`).

### Discipline rows

There are four rows, each with a label (lucide icon and name), four cards, and a 30-week sparkline. *W* is the selected week and *W−1* the week before.

| Row | Card 1 | Card 2 | Card 3 | Card 4 | Sparkline |
|---|---|---|---|---|---|
| Electrical (`Zap`) | Finals | SORs | NCRs | NCR pass rate | Finals + SORs per week |
| Mechanical (`Wrench`) | Finals | SORs | NCRs | NCR pass rate | Finals + SORs per week |
| Welding (`Flame`) | Welds logged | Signed | Sign-off % | NCRs | Welds logged per week |
| BIM Issues (`CircleAlert`) | Opened | Closed | Remaining open | Closure rate | Remaining open per week |

The NCRs cards count issues found on finals for Electrical and Mechanical, and issue welds for Welding.

Values in **This WW** mode:
- **Electrical, Mechanical, BIM Opened, BIM Closed:** the value in W, with the change against W−1.
- **Welding Signed:** counted by signed week ("Signed This Week").
- **Welding Sign-off %:** uses the latest weld week ≤ W that has welds, as in the Welding visual.
- **Rates:** the change is shown in points.

Values in **To date** mode:
- **Counts:** cumulative through W, with `+n this WW` underneath.
- **Rates:** cumulative through W, with the points change against through W−1.
- **Welding Sign-off %:** shows the overall sign-off % to date.

**Remaining open** is always a to-date value in both modes.

BIM Closure rate is always to date, like Remaining open.

**Tones** match the discipline visuals:
- **Electrical and Mechanical:** NCRs are amber when up. NCR pass rate is green when up and red when down.
- **Welding:** NCRs are amber when up. Sign-off % is red below 10%.
- **BIM:** Opened is amber when up in This WW and red when up in To date, as in BIM Issues. Closed is green when it is at least the previous value and above 0 in This WW, and green when it rose in To date. Remaining open is red when up and green when down. Closure rate is green when up and red when down.

**Sparklines:**
- 30 weeks ending at W, as a line with the W point marked.
- Decorative. They carry `aria-hidden`, and each row's label states the trend in text for screen readers ("up 4 vs WW41'2026").

**No data:** when a source has no rows, its row shows "Not connected: no Electrical rows in QAQC Combined" in place of the cards.

### Quality strip

One row of five cards.

| Card | This WW | To date | Tone |
|---|---|---|---|
| CORs | BIM issues with Type `COR` created in W | through W | amber when up |
| NCRs | Electrical + Mechanical + Welding NCRs in W | through W | amber when up |
| Inspection NCR pass rate | 1 − (Elec + Mech NCRs ÷ Elec + Mech finals) in W | through W | green up, red down |
| Welding NCR pass rate | 1 − (issue welds ÷ welds) in W | through W | green up, red down |
| DWNs | BIM issues with Type `DWN` created in W; sub-line shows the DWN rate | through W; sub-line shows the DWN rate | neutral |

Rules for these cards:
- **Type matching.** `COR` and `DWN` are matched on Type, trimmed and case-insensitive. Only included BIM issues count: the LotusWorks creator rule applies and void issues are excluded, exactly as in BIM Issues.
- **BIM NCRs are not counted.** BIM issues typed `NCR` aren't included in NCRs. NCRs come only from final walks.
- **Empty pass rates.** A pass rate shows `n/a` when its denominator is 0.
- **DWN rate.** This is DWNs through W ÷ Green tags. It is always to date, and the sub-line says so: `2.1% of green tags (to date)`. Without a Green tags value, the sub-line reads `DWN rate n/a: add Green tags`.

### Charts

**Inspection activity by Work Week (large)**
- **Lines:** two smooth lines with dots. Electrical is preset series 1 and Mechanical is preset series 3, so they differ in every preset and in high contrast (dashed Mechanical line). Each point is that discipline's Finals + SORs for the week.
- **Axes:** one left axis on a nice scale, with gridlines.
- **Labels:** the last point and the selected point.
- **Selection:** a highlight band on the selected week. Click or keyboard selects the week (`useWeekFocus`).
- **Tooltip:** the week, Electrical (Finals, SORs, total), and Mechanical (Finals, SORs, total).
- **Legend:** Electrical, Mechanical.
- **Expanded:** a label on every point that fits, and a sortable table below with Week, Electrical Finals, Electrical SORs, Mechanical Finals and Mechanical SORs.

**Quality rates by Work Week (small)**
- **Lines:** the Inspection NCR pass rate and the Welding NCR pass rate as two lines. A week with no finals (or no welds) has no point, and the line breaks there.
- **Axis:** zoomed to the data with `passRateDomain`, as the existing pass-rate charts are.
- **Selection:** same as the activity chart (band, click, keyboard).
- **Tooltip:** the week, each rate, and its counts ("2 NCRs of 14 finals").
- **Legend:** Inspection NCR pass rate, Welding NCR pass rate.
- **Expanded:** labels on every point that fits, and a table of the weekly rates with their counts.

### Modes

- **Compact:** rows stack and the charts drop below them.
- **Cards-only:** the discipline rows and the quality strip, with no charts. The Overview uses its own height thresholds: at 660 px and up it shows full cards plus charts; from 480 to 660 px it shows full cards without charts; below 480 px, or on narrow tiles (under 900 px wide), it uses a dense one-line layout. In the dense layout each row is the label, four values (each with a tone-coloured trend arrow and no detail line), then the sparkline, and the strip is one line of five values. Full details stay in each value's `aria-label` and `title`. An 800×300 tile fits without scrolling.
- **Loading bar and footnotes:**
  - Skipped rows per source: unreadable week, future week, no Created On, excluded creator.
  - Unknown Source rows.
  - The row limit.

## QAQC Performance

### Header

`Users` icon, title "QAQC Performance". The controls:
- **`QCR / FE | Welders` switch.** The default is QCR / FE. The two groups are never mixed.
- **`30 WW | All`.** The ranking period, ending at the picked week.
- **Week picker.** `useWeekWindow` semantics.

A summary strip under the header shows, for the group and period: people ranked, total Finals (or welds), total NCRs, and the overall NCR rate.

### QCR / FE view

**Who's counted**
- Electrical and Mechanical rows in the period.
- People are keyed on QCR/FE, trimmed and grouped ignoring case and whitespace; the first spelling is shown.
- A person who appears in both disciplines is one row, with `E` and `M` tags.
- A blank value, or one of `n/a`, `na`, `none`, `-` (trimmed, case-insensitive), is Not recorded.

**Per person**
- **Finals:** final-phase rows.
- **SORs:** SOR-phase rows.
- **NCRs:** finals with an issue found.
- **NCR rate:** NCRs ÷ Finals.

**Ranking**
- **Order:** NCR rate descending, then NCRs descending, then name.
- **Eligibility:** only people with at least **Minimum finals** are ranked. This is a Format pane setting under Ranking, numeric, default 5, range 1–100.
- **Below the minimum:** everyone else goes in a collapsed **Below minimum (n people)** group at the bottom, with a disclosure button.
- **Not recorded:** rows with a blank QCR/FE form one **Not recorded** row, shown last, never ranked, and footnoted (`n inspections have no QCR/FE`).

**Columns:** Name, Finals, SORs, NCRs, NCR rate, Trend.

### Welders view

**Who's counted**
- Welding rows in the period.
- The Welder cell is split on commas, and each part is trimmed and grouped ignoring case.
- A blank value, or one of `n/a`, `na`, `none`, `-` (trimmed, case-insensitive), is Not recorded.
- This applies to each comma-split part. A weld with no other part is Not recorded.
- A weld counts once for each listed welder, and its NCR counts for each of them.
- The footnote says `n welds list more than one welder; each welder is credited`.

**Ranking**
- **Minimum welds:** a separate Format pane setting under Ranking, default 10, range 1–100.
- **Not recorded:** blank Welder rows form a **Not recorded** row, like QCR/FE.

**Columns:** Welder, Welds, NCRs, NCR rate, Trend.

### Trend column

- A 30-week strip ending at the picked week: one tiny bar per week for the person's Finals (or welds), with weeks that had an NCR drawn in the bad red.
- It is decorative (`aria-hidden`). The row's accessible text includes "NCRs in n of the last 30 weeks".
- A weekly NCR-rate line was rejected because most people have a handful of finals a week, so the rate would swing between 0% and 100%.

### Person detail

Clicking a name, or pressing Enter on a focused row, opens a full-visual page overlay (`ChartExpansionFrame` `kind: 'page'`) titled with the person's name and group. It uses the same animation, focus, Esc and inert rules as Issue Detail, and the Back button returns focus to the row.

The overlay contains:
- **Cards:** Finals (or welds), NCRs, and NCR rate for the period, plus the same three for the person's whole history.
- **Chart:** the person's week-by-week bars for Finals (or welds) over the period, with NCR counts as red bars beside them. A running NCR rate (cumulative within the period) is drawn as a line on a right axis. Reuse the trend-chart patterns.
- **NCR table:** Work Week, Source (Electrical, Mechanical or Welding), Building (inspections) or Tag No (welds), and Issue (the cell text). It is sorted newest first and sortable, using `useVirtualRows`.

### Table behaviour

- **Sorting:** every column header sorts, with `aria-sort` on the active header. Ranked people, the below-minimum group and Not recorded each stay together, and sorting works within each block.
- **Scrolling:** the rows are windowed with `useVirtualRows`, and the header is sticky.

### Format pane

Same cards as Electrical, plus a **Ranking** card (`ranking` object) with **Minimum finals** and **Minimum welds**.

## Performance targets

- **Overview:** index 500k combined rows within 1,500 ms, and build the model within 16 ms.
- **Performance:**
  - Build the ranking for 500k rows within 300 ms.
  - Index once per data update.
  - Group per period from per-person week buckets, so switching `30 WW | All` or the week costs O(people × weeks), not O(rows).

## Error states

- **Missing slots:** the setup state lists the missing slots and links to the setup guide name (`QAQC_Overview_SETUP.md` or `QAQC_Performance_SETUP.md`).
- **Failures:** "Could not draw the QAQC Overview visual" or "Could not draw the QAQC Performance visual".
- **Aria-labels:** "QAQC overview dashboard" and "QAQC performance dashboard".
- **Setup titles:** "Add the QAQC Combined columns" for both visuals.

## Expected numbers (October exports, today = 2026-10-15)

These were worked out in Python from the four 2026-10-14 Smartsheet exports. The Python is a port of `classifyPhase`, `isIssueFound`, `parseWorkWeek`, `isWeldSigned`, `isWeldIssue`, `isLotusWorksIssueCreator`, `issueStatusKind` and `parseDate`, with the future-week skip. It reproduces every number in the Electrical, Mechanical, Welding and BIM Issues fixture tests. The current week is WW42'2026. Rates are rounded to 2 decimals. Point changes are given to 4 decimals when they aren't zero. `(±n)` is the change against W−1, and `+n` is `+n this WW`.

### Combined rows

| Source | Electrical | Mechanical | Welding | BIM | Total |
|---|---|---|---|---|---|
| Rows | 288 | 138 | 1,751 | 208 | **2,385** |

No row has an unreadable week, a future week or a missing Created On, and none has an unknown Source. The indexes drop some rows without a footnote, as the discipline visuals do:
- Electrical: 2 rows with phase `N/A`.
- Mechanical: 3 rows with phases `Pressure Test`, `Borescope` and `Reciept Inspection`.
- BIM: 5 rows from excluded creators (footnoted) and 26 void issues.

### Overview discipline rows

| Row | Card | WW42 This WW | WW42 To date | WW41 This WW | WW41 To date |
|---|---|---|---|---|---|
| Electrical | Finals | 3 (−3) | 238 (+3) | 6 (+2) | 235 (+6) |
| | SORs | 3 (±0) | 48 (+3) | 3 (+2) | 45 (+3) |
| | NCRs | 0 (±0) | 2 (+0) | 0 (±0) | 2 (+0) |
| | NCR pass rate | 100.00%, 3/3 (0.00 pts) | 99.16%, 236/238 (+0.0107 pts) | 100.00%, 6/6 (0.00 pts) | 99.15%, 233/235 (+0.0223 pts) |
| Mechanical | Finals | 0 (±0) | 44 (+0) | 0 (−1) | 44 (+0) |
| | SORs | 0 (−2) | 91 (+0) | 2 (+2) | 91 (+2) |
| | NCRs | 0 (±0) | 1 (+0) | 0 (±0) | 1 (+0) |
| | NCR pass rate | n/a, 0 finals (change n/a) | 97.73%, 43/44 (0.00 pts) | n/a, 0 finals (change n/a) | 97.73%, 43/44 (0.00 pts) |
| Welding | Welds logged | 0 (−84) | 1,751 (+0) | 84 (−42) | 1,751 (+84) |
| | Signed | 70 (+24) | 1,054 (+70 signed this WW) | 46 (−21) | 1,054 (+46 signed this WW) |
| | Sign-off % | 79.76%, `67 of 84 · WW41'2026` | 60.19% (0.00 pts) | 79.76%, `67 of 84 · WW41'2026` | 60.19% (+0.9860 pts) |
| | NCRs | 0 (±0) | 11 (+0) | 0 (±0) | 11 (+0) |
| BIM Issues | Opened | 0 (±0) | 177 (+0) | 0 (±0) | 177 (+0) |
| | Closed | 0 (±0) | 126 (+0) | 0 (±0) | 126 (+0) |
| | Remaining open | 51 (±0) | 51 (±0) | 51 (±0) | 51 (±0) |
| | Closure rate | 71.19% (0.00 pts) | 71.19% (0.00 pts) | 71.19% (0.00 pts) | 71.19% (0.00 pts) |

### Quality strip

| Card | WW42 This WW | WW42 To date | WW41 This WW | WW41 To date |
|---|---|---|---|---|
| CORs | 0 (±0) | 171 (+0) | 0 (±0) | 171 (+0) |
| NCRs | 0 (±0) | 14 (+0): E 2, M 1, W 11 | 0 (±0) | 14 (+0): E 2, M 1, W 11 |
| Inspection NCR pass rate | 100.00%, 0 NCRs of 3 finals (0.00 pts) | 98.94%, 3 of 282 (+0.0114 pts) | 100.00%, 0 of 6 (0.00 pts) | 98.92%, 3 of 279 (+0.0236 pts) |
| Welding NCR pass rate | n/a, 0 welds (change n/a) | 99.37%, 11 of 1,751 (0.00 pts) | 100.00%, 0 of 84 (0.00 pts) | 99.37%, 11 of 1,751 (+0.0317 pts) |
| DWNs | 0 (±0) | 0 (+0) | 0 (±0) | 0 (+0) |

- Without a Green tags value, the DWN sub-line reads `DWN rate n/a: add Green tags`. With one, it reads `0.0% of green tags (to date)`.
- The included BIM types are COR 171, NCR 5 and Inspection 1. The export has no DWN issues.

### Chart spot checks

| Week | Elec Finals | Elec SORs | Mech Finals | Mech SORs | Inspection NCR pass rate | Welding NCR pass rate |
|---|---|---|---|---|---|---|
| WW19'2026 | 6 | 1 | 0 | 3 | 100.00% (0 NCRs of 6 finals) | 94.34% (3 of 53 welds) |
| WW22'2026 | 6 | 0 | 1 | 0 | 85.71% (1 of 7) | 100.00% (0 of 29) |
| WW23'2026 | 5 | 0 | 2 | 3 | 85.71% (1 of 7) | 97.67% (2 of 86) |
| WW42'2026 | 3 | 3 | 0 | 0 | 100.00% (0 of 3) | no point (0 welds) |

On the activity chart, WW19 is Electrical 7 and Mechanical 3, WW22 is 6 and 1, and WW23 is 5 and 5. WW42 shows where the welding line breaks.

### Performance

**Pseudonyms**
- **Not recorded.** A blank value, or one of `n/a`, `na`, `none` or `-` after trimming and lower-casing, is Not recorded and gets no pseudonym. The exports hold `N/A` 32 times (18 Electrical, 14 Mechanical) and `NA` 30 times (Mechanical). No welder part is one of these values.
- **QCR/FE.** Every Electrical and Mechanical sheet row with a recorded QCR/FE counts, whatever its phase. Names are trimmed and grouped by lower case with runs of whitespace collapsed. The groups are ordered by all-time row count descending, then by that grouping key in code-point order, and numbered `QCR 01` to `QCR 17`.
- **Welders.** The Welder cell is split on commas, and each recorded part is trimmed and grouped the same way. A weld counts once for each distinct welder it lists. The groups are ordered by all-time welds descending, then by key, and numbered `Welder 001` to `Welder 074`.
- **Ties.** Ranking ties are broken by pseudonym, which is the name the fixture holds.

**QCR / FE, minimum finals 5.** Rows are ranked by NCR rate, then NCRs, then name.

| # | 30 WW (WW13–WW42) | Tags | Finals | SORs | NCRs | NCR rate |
|---|---|---|---|---|---|---|
| 1 | QCR 02 | E | 65 | 0 | 2 | 3.08% |
| 2 | QCR 01 | E | 94 | 0 | 0 | 0.00% |
| 3 | QCR 04 | E | 22 | 0 | 0 | 0.00% |
| 4 | QCR 05 | M | 12 | 2 | 0 | 0.00% |
| 5 | QCR 06 | M | 13 | 1 | 0 | 0.00% |
| 6 | QCR 07 | M | 5 | 0 | 0 | 0.00% |

- **Below minimum:** 10 people, with 10 finals, 11 SORs and 0 NCRs between them.
- **Not recorded:** 70 inspections, all of them SORs (57 blank and 13 `N/A`).

| # | All (WW51'2025–WW42) | Tags | Finals | SORs | NCRs | NCR rate |
|---|---|---|---|---|---|---|
| 1 | QCR 02 | E | 70 | 0 | 2 | 2.86% |
| 2 | QCR 01 | E | 94 | 0 | 0 | 0.00% |
| 3 | QCR 03 | E | 39 | 0 | 0 | 0.00% |
| 4 | QCR 04 | E | 31 | 0 | 0 | 0.00% |
| 5 | QCR 05 | M | 12 | 2 | 0 | 0.00% |
| 6 | QCR 06 | M | 14 | 1 | 0 | 0.00% |
| 7 | QCR 07 | M | 5 | 0 | 0 | 0.00% |

- **Below minimum:** 10 people, with 10 finals, 11 SORs and 0 NCRs between them.
- **Not recorded:** 132 inspections (48 Electrical, 84 Mechanical): 7 finals, 125 SORs and 1 NCR. That NCR is the WW08'2026 Mechanical NCR, logged under `NA`.
- **Both disciplines:** only QCR 09 has rows in both, and it is below the minimum.

**Welders, minimum welds 10.** This is the top 10 in each period.

| # | 30 WW | Welds | NCRs | NCR rate | All | Welds | NCRs | NCR rate |
|---|---|---|---|---|---|---|---|---|
| 1 | Welder 024 | 22 | 3 | 13.64% | Welder 024 | 27 | 3 | 11.11% |
| 2 | Welder 028 | 22 | 2 | 9.09% | Welder 028 | 22 | 2 | 9.09% |
| 3 | Welder 043 | 12 | 1 | 8.33% | Welder 043 | 12 | 1 | 8.33% |
| 4 | Welder 016 | 41 | 2 | 4.88% | Welder 016 | 41 | 2 | 4.88% |
| 5 | Welder 020 | 29 | 1 | 3.45% | Welder 020 | 29 | 1 | 3.45% |
| 6 | Welder 019 | 30 | 1 | 3.33% | Welder 019 | 30 | 1 | 3.33% |
| 7 | Welder 006 | 72 | 1 | 1.39% | Welder 006 | 72 | 1 | 1.39% |
| 8 | Welder 001 | 165 | 0 | 0.00% | Welder 001 | 179 | 0 | 0.00% |
| 9 | Welder 002 | 111 | 0 | 0.00% | Welder 002 | 111 | 0 | 0.00% |
| 10 | Welder 003 | 102 | 0 | 0.00% | Welder 003 | 102 | 0 | 0.00% |

| Welders | 30 WW | All |
|---|---|---|
| Ranked | 38 | 45 |
| Below minimum | 27 | 29 |
| Not recorded welds | 1 | 1 |
| Welds listing more than one welder | 89 | 131 |

No issue weld lists more than one welder, so the credited NCRs add up to the 11 issue welds. The one Not recorded weld has a blank Welder.

**Summary strip.** The totals cover the whole group in the period: distinct finals or welds, including people below the minimum and Not recorded. They match the discipline windows. The bracketed figures sum only the ranked people (credited welds for welders).

| Group | Period | People ranked | Finals / Welds | NCRs | NCR rate |
|---|---|---|---|---|---|
| QCR / FE | 30 WW | 6 | 221 (211) | 2 (2) | 0.90% (0.95%) |
| QCR / FE | All | 7 | 282 (265) | 3 (2) | 1.06% (0.75%) |
| Welders | 30 WW | 38 | 1,570 (1,542) | 11 (11) | 0.70% (0.71%) |
| Welders | All | 45 | 1,751 (1,762) | 11 (11) | 0.63% (0.62%) |

### Rule ambiguities resolved

- **Closure rate in This WW (decided 2026-10-16).** BIM Closure rate is always to date, like Remaining open.
- **This WW pass rates.** These use only W's finals or welds. The rate is n/a when W has none, and the change is n/a when either week is n/a.
- **To-date Signed.** The `+n` is Signed This Week, counted by signing week, as in the Welding visual.
- **Quality strip sub-lines.** Count cards follow the discipline rows: the change against W−1 in This WW, and `+n this WW` in To date. Rate cards show the points change against W−1, or against through W−1.
- **Placeholder names (decided 2026-10-16).** `n/a`, `na`, `none` and `-` (trimmed, case-insensitive) are Not recorded for QCR/FE and for each welder part. This is the same set as the welding no-issue values. It moves the `N/A` and `NA` QCR/FE values into Not recorded. One consequence: in All, Mechanical's only NCR now sits in Not recorded, not with a ranked person.
- **Who's counted for QCR/FE.** Performance counts Final and SOR rows with a readable, non-future week, as the inspection index does. E/M tags come from the rows in the period. Not recorded counts Final and SOR rows with a Not recorded QCR/FE. Pseudonym ordering counts every sheet row, including the 5 rows whose phase is neither Final nor SOR.
- **Summary strip totals.** These are whole-group totals, not sums over the ranked people (see the bracketed figures above).
- **Welder grouping.** Grouping collapses whitespace as well as case, the same as for QCR/FE. No welder or QCR/FE spelling in the exports differs only by case or whitespace, and no weld cell repeats a welder, so this changes nothing here.

## Testing

**Fixture**
- `fixtures/combinedRows.ts` is built in the combined schema from the four October exports with today = 2026-10-15.
- It reuses the existing fixtures' rows where they exist, and adds the columns the existing fixtures lack (QCR/FE, Welder, Tag No).
- Personal names in QCR/FE and Welder are replaced with stable pseudonyms (`QCR 01`…, `Welder 001`…), so the fixture holds no names. The same name always maps to the same pseudonym.
- Comma lists keep their structure.

**Expected numbers**
- The Overview's discipline cards must equal the numbers the four discipline visuals show for the same week. The test asserts this against the existing fixtures' expectations.
- The quality strip and Performance numbers are derived independently in Python from the xlsx exports and listed in Expected numbers above.

**Benchmarks:** the two targets above, using synthetic combined rows.

**Visual verification** in the browser for each visual covers:
- presets, high contrast, compact and cards-only
- each chart expanded, and person detail open
- 500k synthetic rows
- year labels across all six visuals
