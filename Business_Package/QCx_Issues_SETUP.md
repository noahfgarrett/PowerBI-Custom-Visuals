# QCx BIM Issues visual: setup

**Version 1.1.0:** two new pages, **Issues by Root Cause Pareto** and **Issue Aging**, open from the header. Two optional slots, Root Cause and Root Cause Category, feed the Pareto. Reports that don't bind them keep working.

**Version 1.0.1:** week labels now include the year (`WW41'2026`). Chart axes keep `WW41` ticks and show the year under the first labelled week and under the first labelled week of each new year.

## 1. Import the visual (once per report)

1. In Power BI Desktop, open the Visualizations pane, select the three dots (…), then **Import a visual from a file**.
2. Choose `qaqcIssues_1999F247C7D6.<version>.pbiviz`.
3. To update later, import the newer file the same way. It replaces the old version in place and keeps your field bindings.

## 2. Bind the columns

The first nine slots are required. The visual shows its setup screen until every one is bound. Root Cause and Root Cause Category are optional.

| Field slot | BIM Issues Log column |
|---|---|
| ID | ID |
| Title | Title |
| Status | Status |
| Type | Type |
| Contractor | Contractor |
| Created On | Created On |
| Updated On | Updated On |
| Due Date | Due Date |
| Created By | Created By |
| Root Cause (optional) | Root Cause |
| Root Cause Category (optional) | Root Cause Category |

Set every field to **Don't summarize**. The visual is designed to fill a full report page.

### Root Cause slots (optional)

- **Root Cause** adds the **Issues by Root Cause Pareto** page. Without it, the page's header button is hidden.
- **Root Cause Category** adds the category panel to that page. Without it, the panel is hidden and the read-out sits under the chart.
- Causes and categories are trimmed and grouped ignoring letter case and extra spaces. Each group shows the spelling of its earliest created issue.
- A blank Root Cause (or Root Cause Category) counts as **Not recorded**.

There is no Row ID slot: issue IDs are unique, so Power BI cannot merge two different issues. Discipline is not a slot because no card, chart or column uses it, but a slicer on Discipline (or any other column of the table) still filters the visual.

## 3. Use it

- The week dropdown opens on the current work week every time the report opens. Cards and Issue Detail read "as of" the selected week. The two aging charts always measure from today.
- `30 WW | All` switches the Issues by Work Week chart between the last 30 weeks and full history.
- Click a bar to see that week's cards without moving the chart.
- Click the expand icon on any chart to fill the visual with more detail; press Esc or the collapse icon to return. The icon is hidden on empty charts and in read-only views.
- Format pane: **Colors → Preset** (QCx, Blue, LotusWorks, Grayscale), **Background** (color, background opacity, card opacity), **Animation**, **Accessibility**.

### Cards

**This WW** shows the selected week; each card also shows its change from the week before.

| Card | Colour |
|---|---|
| Issues Opened | Amber when up from last week, otherwise neutral |
| Issues Closed | Green when at or above last week and above 0, otherwise neutral |

**Project to date** counts everything through the selected week.

| Card | Colour |
|---|---|
| Total Opened | Red when up, green when down |
| Total Closed | Green when up, neutral when unchanged |
| Remaining Open | Red when up, green when down (Total Opened minus Total Closed) |
| Closure Rate | Green when up, red when down; `n/a` when nothing has been opened (Total Closed ÷ Total Opened, change shown in points) |

### Charts

- **Issues by Work Week:** red Opened bars and green Closed bars for each week, plus an amber **Remaining Open** line read on the right axis. The selected week is highlighted. Hover for the week's Remaining, Opened and Closed.
  - Expanded: adds value labels on every line point that fits, and a summary strip for the window (opened, closed, net change in remaining, and closure rate at the window end).
- **Open Issue Aging:** open and pending issues as of today, in five age buckets: 0-1 (under 7 days), 1-2, 2-3, 3-4 and 4+ weeks.
  - Expanded: shows a sortable table of the open issues in place of the chart (ID, Title, Contractor, Created On, Age in days, Status), oldest first.
- **Overall Issue Aging:** every counted issue, aged to its closed date if closed, otherwise to today, in three buckets: 0-14, 14-28 and 28+ days. A stacked strip with a row per bucket shows the count and percent.
  - Expanded: adds the closed and still-open split for each bucket.

### Issue Detail

Select **Issue Detail** in the header to open the QCx BIM Issues Detail view for the selected week. Esc or the back button returns. The button is hidden when interactions are off (read-only views).

- Cards: Opened This Week, Closed This Week, Opened Last Week, Closed Last Week.
- Table, in two blocks:
  1. **Reporting-week rows:** issues created or closed in the selected week or the week before.
  2. **Open for discussion rows (shaded):** every other open or pending issue created by the selected week.
  Each block is sorted by ID, newest first.
- Click a column header to sort the whole table by it; click again to reverse. The shading stays on the discussion rows.
- Columns: ID, Subtype, Status, Title, Contractor, Work Week (created), Created On, Work Week Closed (`Open` when not closed), Due Date. Pending issues show as Open.

### Issues by Root Cause Pareto

Select **Issues by Root Cause Pareto** in the header (after Issue Detail) to open the page. Its title shows the period, for example `Issues by Root Cause Pareto · WW13'2026 to WW42'2026`. Esc or the back button returns. The button is hidden when Root Cause isn't bound, and when interactions are off (read-only views).

- **Period:** issues **created** from the first week of the dashboard's `30 WW | All` window through the selected week. The page has its own `30 WW | All` and week picker, which change the dashboard's selection too.
- **`All issues | Open only`:** Open only counts just the issues still open as of the selected week.
- **Bars:** one per cause, largest first (ties by name), with a count label on each.
  - The top 9 causes get their own bars. When there are more than 9, the rest are folded into one **Other (n causes)** bar.
  - Issues with a blank Root Cause form a grey **Not recorded** bar, always last. It appears only when there are any, and it is left out of the cumulative %.
- **Cumulative % line:** read on the right axis, 0 to 100%, with a dashed 80% line. The line is labelled where it reaches 80% and at its end.
- **Full and muted bars:** bars up to and including the one where the cumulative % reaches 80% are in full colour (**Issues up to 80%**). The bars after it are muted (**Beyond 80%**).
- **Hover** a bar for its issues, share and cumulative %. Other also lists its largest causes.
- **Root Cause Category panel** (only when Root Cause Category is bound):
  - a 100% strip, and one row per category with its count and %
  - **Inside Other (n causes):** the causes folded into Other with their counts, up to 10 rows, then `n more causes`
- **Read-out:** in the category panel, or under the chart when there is no panel. For example:
  - `The top 9 causes cover 82.4%.` when 80% is reached within the top 9 causes (for example with Open only)
  - `The top 9 causes cover 79.1%; 80% is reached only inside Other.` when it isn't
  - then the top cause, for example `Installation is 48 of 177 (27.1%).`
- **Drill-down:** click a bar, or move along the bars with the arrow keys and press Enter, to list its issues in the table below. The top bar is selected when the page opens.
  - The heading shows the cause, its issue count and `x open · y closed`.
  - Columns: ID, Title, Status, Contractor, Created On, and Age / To close. Issues open as of the selected week show `n d old`; closed issues show `n d to close`.
  - Open issues come first, oldest first, then closed issues. Click any column header to sort by it; click again to reverse.

### Issue Aging

Select **Issue Aging** in the header (the last button) to open the page. Its title shows the selected week, for example `Issue Aging · as of WW42'2026`. The button needs no extra slot. It is hidden only when interactions are off (read-only views).

The page has its own `30 WW | All` and week picker, because the dashboard header is behind it. They change the dashboard's selection too.

**What the benchmarks mean.** Each closed issue's **time to close** is Updated On minus Created On, in whole days.

- **Typical** ("Most issues close within") is the median time to close: half of the closed issues closed faster.
- The **normal close window** is the 90% mark: 90% of closed issues closed within this many days.
- Both are worked out from **your own closed issues as of the selected week**: only issues closed by the end of that week count. Pick an earlier week and they are recalculated as they stood then.
- The end of a week is its Sunday, or today for the current week.
- An issue is **open as of the week** when it was created by the end of the week and not closed by then. Its **age** is the end of the week minus Created On.
- Closed issues with no Updated On are left out of close times, and a footnote gives how many.

**Cards,** under `As of WWnn`:

| Card | Value | Sub-line |
|---|---|---|
| Open issues | Issues open as of the selected week | Change from the week before; red when up, green when down |
| Most issues close within | Typical, for example `32 days` | `90% within 77 days · from 126 closed` |
| Past the normal close window | Open issues older than the window | `n are older than any issue ever closed` |

Past the normal close window is red when it is above 0. Then it shows `View issues ›`: click it to list those issues. With no closures yet, the window cards show `n/a`.

**How old are the open issues?** (the large chart)

- The open issues as of the selected week, in age buckets: `Under 1 month`, `1 month – 77 days`, `78 days – 3 months`, `3–6 months`, `6–12 months` and `12+ months`. The two middle buckets split at the normal close window, so `77` changes with it.
- When the window is under 31 days or over 88 days, the five month buckets are used instead (`1–3 months` in place of the split).
- A light green band covers the normal close window, labelled `90% of issues close within 77 days`. A dashed marker sits at typical, for example `typical: 32 d`.
- **Bar colours:** green inside the window, red past it, and amber for a month bucket that straddles the window's edge. Every bar shows its count.
- A caption under the chart sums it up, for example `All 51 open issues are older than the normal close window.`
- Hover a bar for its count and its oldest issue IDs with their age.

**The issue list.** Click a bar (or focus it and press Enter) to list that bucket's issues. The list slides up over the charts. Empty buckets can't be clicked. The expand icon on the chart lists every open issue.

- The title shows the bucket and count, for example `12+ months · 19 open issues`, with a `Showing: 12+ months` chip. Click the chip to show every open issue.
- Columns: ID, Title, Contractor, Created On, Age (days), and **vs normal**, for example `5.4× the 77-day window`.
- Oldest first. Click any column header to sort by it.
- Back or Esc closes the list and returns to the chart. A second Esc closes the page.

**Is the backlog getting older?** One line of the median age of the open issues, as of each week in the `30 WW | All` range. Weeks with no open issues have no point.

- A dashed green line marks the normal close window as of the selected week, labelled, for example, `normal close window 77 d`.
- The last point is labelled.
- Hover a week for its median age and open count; click it to select that week.

**Is closing getting faster or slower?** One bar per calendar quarter, from the first quarter with a closure through the quarter of the selected week. Only closures by the end of the selected week count.

- Each bar is the median time to close of the issues closed that quarter, labelled on the bar.
- Bars are green at or under typical, and amber when slower. A dashed line marks typical.
- A quarter with no closures is an empty dashed slot labelled `no closures`.
- The `closed` row under the axis gives each quarter's closed count.
- Hover a quarter for its closed count, median, slowest close and difference from typical.

## Counting rules

- **Counted issues:** Created By contains "LotusWorks" in any letter case, ignoring punctuation (it must be one word, so "Lotus Works" is not counted), or is a removed-user record for Samuel Leach or Aaron Harwood. Anything else, including a blank Created By, is excluded and noted in a footnote.
- **Void:** issues with Status Void are excluded everywhere.
- **Work week:** an issue's work week is the week of its Created On. Issues with a blank or unreadable Created On are skipped and noted in a footnote.
- **Closed:** an issue is closed when its Status is Closed. Its closed week is the week of Updated On. A closed issue with no Updated On counts as opened but is not counted as closed in any week.
- **Open:** every other status (blank, Open, Pending, Not approved, Ready to Inspect).
- **Contractor:** a blank Contractor shows as Bayside when the ID's number is 1021, otherwise Unassigned.
- **Subtype and Title:** a blank Type shows as Uncategorized and a blank Title as Untitled issue.
- **Future weeks:** issues created after the current work week are not counted and are noted in a footnote.
