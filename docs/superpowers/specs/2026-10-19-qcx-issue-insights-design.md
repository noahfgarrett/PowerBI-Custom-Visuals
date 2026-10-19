# QCx Issue Insights — Design

## Scope

This design adds three things, with the rule that **every chart lives in exactly one place**:

1. **Issues by Root Cause Pareto.** A full page in QCx BIM Issues, opened from a header button.
2. **Issue Aging.** A full page in QCx BIM Issues, opened from a header button.
3. **Overview cards.** Two new top-level cards on QCx Overview, "Past normal close window" and "Top root cause".

The approved interactive mockup is `scratchpad/mockups/qcx-designs.html` (built from the October export). It is the visual reference, and its screenshots are `design-1` to `design-6-*.png` in the same folder. The implementation must match it.

All counting rules are the existing ones in `issues.ts`:
- **Included issues** are LotusWorks-created and not void, and have a Created On.
- **Closed week** comes from Updated On.
- **Contractor defaults:** a blank contractor becomes Bayside when the ID ends in exactly 1021, otherwise Unassigned.

The page overlays reuse `ChartExpansionFrame` `kind: 'page'` and `HeaderOverlayButton`, the same as Issue Detail.

### Versions

| Visual | Change |
|---|---|
| QCx BIM Issues | 1.0.1 → **1.1.0** |
| QCx Overview | 1.0.0 → **1.1.0** |
| Others | Unchanged |

## Data

### BIM Issues: two new optional slots

| Slot (role) | Smartsheet column | Required |
|---|---|---|
| Root Cause (`rootCause`) | Root Cause | no |
| Root Cause Category (`rootCauseCategory`) | Root Cause Category | no |

- Both slots are optional and validated in code, so existing reports keep working.
- When Root Cause is unbound, the Pareto button is hidden.
- When Root Cause Category is unbound, the Pareto's category panel is hidden.
- Root cause text is trimmed. Grouping ignores case and whitespace, and the first spelling is shown, as with buildings.
- A blank value counts as **Not recorded**.

### QCx Combined: one new column

The script gains `Root Cause`, taken from the BIM `Root Cause` column (`null` on other sources). It sits in the final column order after `Created By`.

The Overview gains an optional `rootCause` slot, which feeds the Top root cause card. Performance is unchanged.

## Issue benchmarks (shared)

A new shared module computes the benchmarks **as of week W**. QCx BIM Issues and QCx Overview both use it, so the numbers always agree.

- **Closures as of W:** included issues that are closed with a closed date on or before the end of W.
- **Time to close:** Updated On minus Created On, in whole days. Closed issues without an Updated On are left out and footnoted.
- **Typical close:** the median of times to close, using the existing `quantile` convention. Port it from the mockup's `compute2.py`; it must reproduce **32 d**.
- **Normal close window:** the 90th percentile of times to close (**77 d**).
- **Slowest close:** the maximum time to close (**314 d**).
- **Open as of W:**
  - The issue was created on or before the end of W.
  - It was not closed by the end of W, either because it is not closed or because its closed date is after W.
  - **Age** is the end of W minus Created On, in days. The end of W is never later than today.
- **Past the normal close window:** open as of W, with age greater than the window.
- **Older than any closure:** open as of W, with age greater than the slowest close.
- **No closures as of W:** typical, window and slowest are null. Cards show `n/a`, and the window band is not drawn.

## 1. Issues by Root Cause Pareto (QCx BIM Issues)

### Header button

- **Label:** "Issues by Root Cause Pareto", with the lucide `ChartColumnDecreasing` icon.
- **Position:** after Issue Detail.
- **Visibility:** hidden when Root Cause is unbound or interactions are off.
- **Overlay:** opens a `kind: 'page'` overlay titled `Issues by Root Cause Pareto · <first week> to <W>`.
- **Behaviour:** the grow animation, Back/Esc and focus return work the same as Issue Detail.

### Period and filter

- **Period:** follows the dashboard's `30 WW | All` and W. Issues are those **created** in the window.
- **Page controls:** the page has its own `30 WW | All` and week picker in the chart's title bar, beside the scope switch, because the dashboard header is hidden behind the page. They share the dashboard's `useWeekWindow` state, so changing them moves the dashboard too, and the overlay title follows.
- **Scope switch:** `All issues | Open only`. Open only means open as of W.

### Chart

- **Bars:** sorted by count, descending.
  - The top 9 causes come first.
  - Then **Other (n causes)**, if more than 9 causes exist.
  - Then a grey **Not recorded** bar, only when its count is above 0. It is kept out of the cumulative calculation and always sits last.
- **Cumulative line:** a cumulative % line on a right axis from 0 to 100%, with a dashed 80% line. The line is labelled where it reaches 80% and at the end.
- **Bar colour:** bars up to and including the one where the cumulative % reaches 80% are series 1. Bars after it are muted (series 2).
- **Labels:** a count label on every bar.
- **Tooltip:** cause, count, share and cumulative %.
- **Keyboard:** arrow keys move between bars and Enter selects, as with `useWeekFocus`.
- **Long labels:** axis labels wrap to three lines. They shrink together only if one still won't fit.

### Root Cause Category panel

Shown only when the category slot is bound. It has:
- a 100% strip;
- one row per category with swatch, label, count and %;
- an **Inside Other (n causes)** list showing the causes folded into Other and their counts, up to 10 rows plus "n more causes".

### Drill-down table

- **Selection:** clicking a bar, or pressing Enter, selects it. The top bar is selected by default.
- **Heading:** `<cause> · n issues` with "x open · y closed".
- **Columns:** ID, Title, Status pill, Contractor, Created On (`MM/DD/YY`), and Age / To close. Age is shown for open issues as `n d old`, and To close for closed issues as `n d to close`.
- **Order:** open issues first, oldest first, then closed issues. Every column sorts.
- **Rows:** windowed with `useVirtualRows`.

### Read-out

A short line under the panel:
- **When 80% is reached inside the top 9:** `The top n causes cover x%`.
- **Otherwise:** `The top 9 causes cover x%; 80% is reached only inside Other`.
- **Always:** `<top cause> is n of N (p%)`.

## 2. Issue Aging (QCx BIM Issues)

### Header button

- **Label:** "Issue Aging", with the lucide `Hourglass` icon.
- **Position:** after the Pareto button.
- **Visibility:** always shown, unless interactions are off. It needs no new slot.
- **Overlay:** a `kind: 'page'` overlay titled `Issue Aging · as of <W>`.
- **Page controls:** the page has its own `30 WW | All` and week picker, because the dashboard header is hidden behind it. They share the dashboard's `useWeekWindow` state.

### Cards

One group titled "As of W", on the plain card colour.

| Card | Value | Sub-line |
|---|---|---|
| Open issues | open as of W | change vs W−1 |
| Most issues close within | typical, e.g. `32 days` | `90% within 77 days · from 126 closed` |
| Past the normal close window | count | `n are older than any issue ever closed` |

The third card is always bad red when its value is above 0. It is clickable: it opens the issue list filtered to past-window issues and shows a `View issues ›` hint.

### Chart 1: "How old are the open issues?" (large)

- **Buckets:** six vertical bars, with the window edge W90 recomputed for W.
  - `Under 1 month` (0–29 d)
  - `1 month – W90 d` (30–W90 d)
  - `W90+1 d – 3 months` (W90+1 to 89 d)
  - `3–6 months` (90–179 d)
  - `6–12 months` (180–364 d)
  - `12+ months` (365+ d)
- **When the window is under 31 d or over 88 d:** fall back to the five month buckets (`Under 1 month`, `1–3 months`, `3–6 months`, `6–12 months`, `12+ months`). A bucket that straddles the window edge is coloured warn amber. The reason: the window edge splits `1–3 months` (30–89 d) in two, and outside 31–88 d one part would be degenerate. At 30 d or less, `1 month – W90 d` would be at most one day wide; at 89 d or more, `W90+1 d – 3 months` would be empty.
- **Background:** a light good-green band behind the 0–W90 region, labelled "Normal close window: 90% of issues close within W90 days". A dashed marker sits at typical (`typical: 32 d`).
- **Bar colour:** buckets inside the window are good green, buckets past it are bad red, and a straddling bucket is warn amber. Every bar has a count label.
- **Caption:**
  - All past: `All n open issues are older than the normal close window.`
  - Some past: `n of m open issues are older than the normal close window.`
  - Both are followed by a muted `Click a bar to see its issues.`
- **Clicking:**
  - A bar, or Enter on a focused bar, opens **the issue list** filtered to that bucket. Empty buckets aren't clickable.
  - Bars show a pointer, a hover outline and a tooltip ending "Click to view these issues".
  - The expand icon opens the unfiltered list.
- **Tooltip:** the count, plus the oldest issue ID(s) and age.

### The issue list

- **Appearance:** an in-page panel that slides up over the chart area.
- **Title:** `<bucket or filter> · n open issues`, with a removable filter chip (`Showing: 12+ months ✕`). Clearing the chip shows all open issues.
- **Columns:** ID, Title, Contractor, Created On, Age (days), and **vs normal** (`5.4× the 77-day window`).
- **Order and rows:** oldest first, every column sortable, windowed rows.
- **Closing:** Back or Esc closes the list only, and focus returns to its opener. A second Esc closes the page.

### Chart 2: "Is the backlog getting older?" (small)

- **Line:** one line of the median age of open issues as of each week in the range (30 WW or All). Weeks with no open issues have no point.
- **Reference:** a dashed good-green line at the window (W90 as of W), labelled `normal close window W90 d`.
- **Labels:** the last point is labelled, e.g. `351 d`.
- **Tooltip:** the week, median age and open count.

### Chart 3: "Is closing getting faster or slower?" (small)

- **Bars:** one per calendar quarter, from the first quarter with a closure through the quarter containing W. Only closures as of W count.
- **Bar height:** the median time to close of issues closed that quarter.
- **Empty quarters:** an empty dashed slot labelled "no closures".
- **Bar colour:** good green when the median is at or below typical, warn amber when above.
- **Labels and rows:** a median label on each bar. A row under the axis reads `closed` followed by each quarter's count.
- **Reference:** a dashed line at typical, labelled `typical` on the axis.
- **Tooltip:** quarter, closed count, median, slowest, and the difference from typical.

### Footnotes

Existing issue footnotes, plus `n closed issues have no Updated On and are left out of close times` when n > 0.

## 3. QCx Overview cards

- **BIM Issues row, card 4:** **"Past normal close window"** replaces Closure rate.
  - **Value:** the past-window count as of W, the same in both modes, like Remaining open.
  - **Sub-line:** `of n open · m older than any closure · x% closed`, using the existing closure rate.
  - **Tone:** bad when the value is above 0.
- **Quality strip, sixth card:** **"Top root cause"**.
  - **To date:** the cause with the most included issues created through W, shown as `<cause>` with `n of N issues · p%`.
  - **This WW:** the top cause among issues created in W, or `None` with `None opened this WW`.
  - **Root Cause unbound:** `Add Root Cause`.
  - **Ties:** broken by name.
  - **Long names:** truncated with a full-text `title`.
- **Fit:** at 1280×720 and 1340×790, in both modes, the six-card strip must not truncate any detail line.

## Expected numbers (October export, today = 2026-10-15, W = WW42'2026)

The Pareto and benchmark numbers are derived independently in Python by the mockup's `compute2.py` and `rootcauses.py`. The plan's fixture tests re-derive anything not listed here from those scripts.

### Benchmarks

| Measure | Value |
|---|---|
| Closures as of W | 126 |
| Typical close | 32 d |
| Normal close window | 77 d |
| Slowest close | 314 d |
| Open as of W | 51 |
| Past window | 51 |
| Older than any closure | 28 |
| Median open age | 351 d |
| Oldest open | 413 d (#759 and #760) |

- **Age buckets** (Under 1 month / 1 month–77 d / 78 d–3 months / 3–6 / 6–12 / 12+): 0 / 0 / 3 / 10 / 19 / 19.
- **As of WW30'2026:** 50 open, 39 past the window, buckets 5 / 6 / 0 / 6 / 33 / 0.

### Quarterly median days to close (as of W)

| Quarter | Median | Closed |
|---|---|---|
| Q4'24 | 30 d | 2 |
| Q1'25 | 19 d | 3 |
| Q2'25 | 14 d | 8 |
| Q3'25 | 22.5 d | 32 |
| Q4'25 | 59 d (amber) | 45 |
| Q1'26 | 13.5 d | 10 |
| Q2'26 | 16 d | 17 |
| Q3'26 | 32 d | 9 |
| Q4'26 | no closures | 0 |

### Pareto (All, All issues, 177 issues, 27 causes)

- **Bars:** Installation 48, Coordination 21, Casting/Pouring/Erection 19, Incomplete Work 18, Trade Damage 10, Housekeeping 9, Bonding 5, Documentation Incomplete 5, Quality 5, Other (18 causes) 37. Not recorded is 0, so it is hidden.
- **Cumulative:** the top 9 cover 79.1%.
- **Categories:** Quality 162 (91.5%), Design 10, Coordination 4, Safety 1.
- **Installation:** 48 issues, 18 open and 30 closed.
- **Open only:** 80% is crossed at Incomplete Work (82.4%).

### Overview cards

- **Past normal close window:** 51, with `of 51 open · 28 older than any closure · 71.2% closed`.
- **Top root cause:**
  - **To date:** `Installation`, with `48 of 177 issues · 27%`.
  - **This WW:** `None opened this WW`.

## Testing

- **Unit tests** for the benchmarks module, covering quantiles, as-of open reconstruction, the age boundaries, no closures, and the end of W capped at today.
- **Pareto model:** grouping, Other, Not recorded, the 80% split and Open only.
- **Quarter medians.**
- **Fixture tests** asserting the expected numbers above. Add Root Cause and Root Cause Category to the issue fixture and the combined fixture, with no personal data.
- **Component tests** for both pages:
  - opening and closing, with focus return;
  - bar selection and keyboard navigation;
  - the filter chip;
  - the red card click;
  - table sorting;
  - hidden states: Root Cause unbound, interactions off, no closures.
- **Benchmarks:**
  - 200k issues: the benchmarks, aging profile and Pareto take ≤ 50 ms per W change after indexing.
  - The issue list stays windowed.
- **Visual check** in the browser against the mockup screenshots. Cover the presets, high contrast, compact and 800×300 (where the buttons still open their pages).
