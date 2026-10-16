# QCx BIM Issues visual: setup

**Version 1.0.1:** week labels now include the year (`WW41'2026`). Chart axes keep `WW41` ticks and show the year under the first labelled week and under the first labelled week of each new year.

## 1. Import the visual (once per report)

1. In Power BI Desktop, open the Visualizations pane, select the three dots (…), then **Import a visual from a file**.
2. Choose `qaqcIssues_1999F247C7D6.<version>.pbiviz`.
3. To update later, import the newer file the same way. It replaces the old version in place and keeps your field bindings.

## 2. Bind the columns

All nine slots are required. The visual shows its setup screen until every slot is bound.

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

Set every field to **Don't summarize**. The visual is designed to fill a full report page.

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

## Counting rules

- **Counted issues:** Created By contains "LotusWorks" in any letter case, ignoring punctuation (it must be one word, so "Lotus Works" is not counted), or is a removed-user record for Samuel Leach or Aaron Harwood. Anything else, including a blank Created By, is excluded and noted in a footnote.
- **Void:** issues with Status Void are excluded everywhere.
- **Work week:** an issue's work week is the week of its Created On. Issues with a blank or unreadable Created On are skipped and noted in a footnote.
- **Closed:** an issue is closed when its Status is Closed. Its closed week is the week of Updated On. A closed issue with no Updated On counts as opened but is not counted as closed in any week.
- **Open:** every other status (blank, Open, Pending, Not approved, Ready to Inspect).
- **Contractor:** a blank Contractor shows as Bayside when the ID's number is 1021, otherwise Unassigned.
- **Subtype and Title:** a blank Type shows as Uncategorized and a blank Title as Untitled issue.
- **Future weeks:** issues created after the current work week are not counted and are noted in a footnote.
