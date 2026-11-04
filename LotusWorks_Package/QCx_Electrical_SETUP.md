# QCx Electrical Inspections visual: setup

**Version 1.2.0:** a **Filter** menu in the header filters the page by date range and field, and clicking a week with issues lists them. Twelve new optional slots feed both. Its identity is unchanged, so importing the new file updates existing reports in place and keeps your field bindings.

**Version 1.1.1:** week labels now include the year (`WW41'2026`). Chart axes keep `WW41` ticks and show the year under the first labelled week and under the first labelled week of each new year.

## 1. Import the visual (once per report)

1. In Power BI Desktop, open the Visualizations pane, select the three dots (…), then **Import a visual from a file**.
2. Choose `qaqcElectrical_6B2E9D4A1C7F.1.2.0.0.pbiviz`.
3. To update later, import the newer file the same way. It replaces the old version in place and keeps your field bindings.

## 2. Add a Row ID (Power Query, once per report, required)

Power BI merges rows that are identical in every bound column (on the October export that hides 151 of 238 Finals). The visual shows its setup screen until a Row ID is bound. To add one:

1. **Home → Transform data**, select the Electrical Inspection Log query.
2. **Add Column → Index Column → From 1**.
3. **Close & Apply**.

## 3. Bind the columns

| Field slot | Smartsheet column |
|---|---|
| Work Week | Work Week Observed |
| Inspection Phase | Inspection Phase |
| Issue? | Issue? |
| Building | Building |
| Row ID | Index |
| General Contractor (optional) | General Contractor |
| Trade Supplier (optional) | Trade Supplier |
| Discipline (optional) | Discipline |
| Inspection Category (optional) | Inspection Category |
| Status (optional) | Status |
| Inspection ID (optional) | Inspection ID |
| Equipment ID / Tag Number (optional) | Equipment ID / Tag Number |
| Issue ID (optional) | Issue ID |
| Finding Type (optional) | Finding Type |
| Date Observed (optional) | Date Observed |
| QCR/FE (optional) | QCR/FE |
| Notes (optional) | Notes |

The first five slots are required. The optional ones add fields to the Filter menu and columns to the week's issue list, and a report that doesn't bind them keeps working.

Set every field to **Don't summarize**. The visual is designed to fill a full report page.

**Date fields:** bind Date Observed as the plain date, not Power BI's Date Hierarchy. In the field well, use the drop-down on the field and choose the field name.

**Row limit:** if the footnote `Showing the first n rows (Power BI data limit)` appears, Power BI stopped sending rows. Unbind **Notes** first: it's the longest column, so it takes up the most of what Power BI will send.

## 4. Use it

- The week dropdown opens on the current work week every time the report opens.
- `30 WW | All` switches the charts between the last 30 weeks and full history.
- Click a bar, or a point on NCR Pass Rate Trend, to see that week's cards without moving the chart. If the week has issues, its list opens too (see section 6).
- **Filter** narrows the page by date range and by field (see section 5).
- Click the expand icon on any chart to fill the visual with more detail; press Esc or the collapse icon to return. The icon is hidden on empty charts and in read-only views.
- Format pane: **Colors → Preset** (QCx, Blue, LotusWorks, Grayscale), **Background** (color, background opacity, card opacity), **Animation**, **Accessibility**.

## 5. Filter menu

Select **Filter** in the header, before `30 WW | All`.

- **Date range:** From and To work-week dropdowns, labelled `(start)` and `(now)` at the data's limits, and the presets Last 4 WW, Last 13 WW and This year. Presets end at the current work week.
- **Fields,** in this order, when their slots are bound: General Contractor, Trade Supplier, Building, Discipline, Inspection Category and Status. Building is required, so it's always there. A blank Building reads Unspecified, as on the charts, and a blank General Contractor reads Unassigned, as on the QCx Overview and QCx Performance. Each field has a search box and tick boxes with row counts, most rows first.
- **Changes apply at once.** There's no Apply button. Press Esc or click outside to close the menu.
- **Ticks:** within a field, a row matches any ticked value. Across fields, it must match all of them. Ticking nothing in a field means no filter on it. The footer's **Showing X of Y rows** updates as you tick.
- **Chips:** each active filter shows as a chip under the header. Click a chip's × to remove it, or **Clear all** to remove every filter. The Filter button shows how many filters are active.
- **Grouping:** values are grouped ignoring letter case and extra spaces, so `Electrical` and `ELECTRICAL` are one choice. On Trade Supplier, Discipline, Inspection Category and Status, blank, `N/A`, `NA`, `None` and `-` are one **Not recorded** choice, listed last. On General Contractor they're one **Unassigned** choice, listed last. Building matches the chart: a blank is **Unspecified**, listed last, and `N/A`, `NA`, `None` and `-` each stay their own choice.
- **Typos:** a typo in the sheet appears as a separate choice. Nothing corrects spelling; fix it in the sheet.
- **No matching rows:** the cards and charts give way to a message with a **Clear filters** button, so zeros can't be read as real results.
- **Keeping filters:** filters survive a data refresh, and a ticked value no longer in the data is dropped. They reset when the report is reopened. They apply to this visual only.
- **Read-only views:** the Filter button is disabled when interactions are off.

### In range

Setting a date range changes the page to read that range:

- `30 WW | All` is disabled, and the charts show exactly the weeks in the range.
- The week dropdown offers only the weeks in the range, and the selected week stays inside it. **This WW** cards follow the selected week.
- **Project to date** becomes **In range**, with the subtitle `WW.. to WW..`. Its cards read **Finals in Range**, **SORs in Range** and **NCR Pass Rate**, all counted over the range.
- **NCR Pass Rate Trend** restarts at From, so its last point equals the In range card.
- A range from the first week of the data to the current week is the same as no range, so it isn't counted as a filter.

## 6. See a week's issues

Click a week on **Finals + SORs by Work Week** or **NCR Pass Rate Trend**, or focus the chart and press Enter. That selects the week. If the week has issues, a list of them opens too; a week with none is only selected.

- The title names the week, for example `Issues · WW23'2026`, and the line under it gives the count. The rows are the ones behind the week's Issue found count, under the active filters.
- Columns: Building, Phase, Issue, Inspection ID, Equipment ID / Tag Number, Issue ID, Finding Type, Status, Date Observed, QCR/FE and Notes. A column whose slot isn't bound is hidden.
- Click a column header to sort. Long text is cut short; hover it for the full value.
- Press Esc or **Back** to return, with the focus back on the chart.

## Counting rules

- **Final:** Inspection Phase is Final (any case), starts with "Final ", or contains "final inspection". **SOR:** contains "SOR".
- **Issues Found:** Final rows whose Issue? is filled in and is not "No Issue Found". SOR rows never count.
- **NCR Pass Rate:** Finals with no issue ÷ all Finals, through the selected week, or over the range when a date range is set.
