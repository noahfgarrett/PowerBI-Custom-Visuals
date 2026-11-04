# QCx Welding Signoffs visual: setup

**Version 1.1.0:** a **Filter** menu in the header filters the page by date range and field, and clicking a week with issues lists them. Two new optional slots, Welder and Work Package, add to the menu. Its identity is unchanged, so importing the new file updates existing reports in place and keeps your field bindings.

**Version 1.0.1:** week labels now include the year (`WW41'2026`). Chart axes keep `WW41` ticks and show the year under the first labelled week and under the first labelled week of each new year.

## 1. Import the visual (once per report)

1. In Power BI Desktop, open the Visualizations pane, select the three dots (…), then **Import a visual from a file**.
2. Choose `qaqcWelding_8A4CE54C5018.1.1.0.0.pbiviz`.
3. To update later, import the newer file the same way. It replaces the old version in place and keeps your field bindings.

## 2. Add a Row ID (Power Query, once per report, required)

Power BI merges rows that are identical in every bound column. The visual shows its setup screen until a Row ID is bound. To add one:

1. **Home → Transform data**, select the Welding Inspections / Signoffs query.
2. **Add Column → Index Column → From 1**.
3. **Close & Apply**.

## 3. Bind the columns

The first eight slots are required. Welder and Work Package are optional: they add fields to the Filter menu, and Welder adds a column to the week's issue list. A report that doesn't bind them keeps working.

| Field slot | Smartsheet column |
|---|---|
| Weld Work Week | WELD WORK WEEK |
| Signature | SIGNATURE |
| Work Week Signed | WORK WEEK SIGNED |
| Issue Created | ISSUE CREATED? (Put BIM # If Yes) |
| Fluid Code | FLUID CODE |
| Pipe Spec | PIPE SPEC |
| Tag No | TAG NO |
| Row ID | Index |
| Welder (optional) | WELDER |
| Work Package (optional) | WORK PKG |

Set every field to **Don't summarize**. The visual is designed to fill a full report page.

## 4. Use it

- The week dropdown opens on the current work week every time the report opens.
- `30 WW | All` switches the charts between the last 30 weeks and full history.
- Click a bar to see that week's cards without moving the chart. If the week has issues, its list opens too (see section 6).
- **Filter** narrows the page by date range and by field (see section 5).
- Click the expand icon on any chart to fill the visual with more detail; press Esc or the collapse icon to return. The icon is hidden on empty charts and in read-only views.
- **Sign-off by System** drills down: click a system bar (or press Enter on the focused row) to see that system's pipe specs. A breadcrumb such as `All systems › AW` appears above the bars; select **All systems** to go back. The "Other" row is not clickable. The drill resets when the report is reopened and stays in place when you change weeks.
- **Issues by Building** ranks only buildings with enough welds. Change the cutoff in Format pane → **Hotspots** → **Minimum welds** (default 10, range 1 to 100). Smaller buildings are grouped into "Other".
- Format pane: **Colors → Preset** (QCx, Blue, LotusWorks, Grayscale), **Background** (color, background opacity, card opacity), **Animation**, **Accessibility**, **Hotspots**.

## 5. Filter menu

Select **Filter** in the header, before `30 WW | All`.

- **Date range:** From and To work-week dropdowns, labelled `(start)` and `(now)` at the data's limits, and the presets Last 4 WW, Last 13 WW and This year. Presets end at the current work week.
- **Fields,** in this order: Building, Pipe Spec, Fluid Code, Welder and Work Package. Welder and Work Package appear when their slots are bound. Each field has a search box and tick boxes with row counts, most rows first.
- **Building** is the value the charts use, taken from TAG NO (see Counting rules).
- **Welder** is split on commas. A weld listing several welders matches any of them, and counts once in **Showing X of Y rows**.
- **Changes apply at once.** There's no Apply button. Press Esc or click outside to close the menu.
- **Ticks:** within a field, a row matches any ticked value. Across fields, it must match all of them. Ticking nothing in a field means no filter on it. The footer's **Showing X of Y rows** updates as you tick.
- **Chips:** each active filter shows as a chip under the header. Click a chip's × to remove it, or **Clear all** to remove every filter. The Filter button shows how many filters are active.
- **Grouping:** values are grouped ignoring letter case and extra spaces, so `Electrical` and `ELECTRICAL` are one choice. On Welder and Work Package, blank, `N/A`, `NA`, `None` and `-` are one **Not recorded** choice, listed last. Pipe Spec and Fluid Code match the charts: a blank is **Unspecified**, listed last, and `N/A`, `NA`, `None` and `-` each stay their own choice. Building always has a value, because it's taken from TAG NO.
- **Typos:** a typo in the sheet appears as a separate choice. Nothing corrects spelling; fix it in the sheet.
- **No matching rows:** the cards and charts give way to a message with a **Clear filters** button, so zeros can't be read as real results.
- **Keeping filters:** filters survive a data refresh, and a ticked value no longer in the data is dropped. They reset when the report is reopened. They apply to this visual only.
- **Read-only views:** the Filter button is disabled when interactions are off.

### In range

Setting a date range changes the page to read that range:

- `30 WW | All` is disabled, and the charts show exactly the weeks in the range. The building and system charts read the range too.
- The week dropdown offers only the weeks in the range, and the selected week stays inside it. **This WW** cards follow the selected week.
- **Project to date** becomes **In range**, with the subtitle `WW.. to WW..`. Total Welds, Welds Signed and Overall Sign-off % count over the range.
- A range from the first week of the data to the current week is the same as no range, so it isn't counted as a filter.

## 6. See a week's issues

Click a week on **Signoffs by Work Week**, or focus the chart and press Enter. That selects the week. If the week has welds with an issue, a list of them opens too; a week with none is only selected.

- The title names the week, for example `Issues · WW23'2026`, and the line under it gives the count. The rows are the week's issue welds under the active filters.
- Columns: Tag No, Welder, Pipe Spec, Fluid Code, Issue Created and Signature. Welder is hidden when its slot isn't bound.
- Click a column header to sort. Long text is cut short; hover it for the full value.
- Press Esc or **Back** to return, with the focus back on the chart.

## Counting rules

- **Weld:** a row whose WELD WORK WEEK can be read as a work week. Unreadable or future weeks are skipped and noted in a footnote.
- **Signed:** SIGNATURE is filled in.
- **Signed This Week:** signed welds counted by WORK WEEK SIGNED, not by weld week. A signed weld whose WORK WEEK SIGNED can't be read still counts as signed for its weld week, but not in Signed This Week.
- **Sign-off %:** signed ÷ logged for the latest weld week (up to the selected week) that has welds.
- **Overall Sign-off %:** all signed welds ÷ all welds through the selected week. Its status line is red below 10%, amber from 10% to below 15%, and green at 15% and above.
- **Issue:** ISSUE CREATED? is filled in and is not "no", "n/a", "na", "none" or "-". The QAQC Advisory Item column is not used.
- **Building:** taken from TAG NO (for example BK1, F631, WR1, PS1, F632). A leading "P4-" is ignored. Anything else is grouped as Site General.
- **System and Pipe Spec:** FLUID CODE and PIPE SPEC, with blanks shown as Unspecified. Names are grouped ignoring case and extra spaces.
