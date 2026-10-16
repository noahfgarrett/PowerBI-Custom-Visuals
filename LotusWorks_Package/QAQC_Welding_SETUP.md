# QAQC Welding Signoffs visual: setup

## 1. Import the visual (once per report)

1. In Power BI Desktop, open the Visualizations pane, select the three dots (…), then **Import a visual from a file**.
2. Choose `qaqcWelding_8A4CE54C5018.<version>.pbiviz`.
3. To update later, import the newer file the same way. It replaces the old version in place and keeps your field bindings.

## 2. Add a Row ID (Power Query, once per report, required)

Power BI merges rows that are identical in every bound column. The visual shows its setup screen until a Row ID is bound. To add one:

1. **Home → Transform data**, select the Welding Inspections / Signoffs query.
2. **Add Column → Index Column → From 1**.
3. **Close & Apply**.

## 3. Bind the columns

All eight slots are required.

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

Set every field to **Don't summarize**. The visual is designed to fill a full report page.

## 4. Use it

- The week dropdown opens on the current work week every time the report opens.
- `30 WW | All` switches the charts between the last 30 weeks and full history.
- Click a bar to see that week's cards without moving the chart.
- Click the expand icon on any chart to fill the visual with more detail; press Esc or the collapse icon to return. The icon is hidden on empty charts and in read-only views.
- **Sign-off by System** drills down: click a system bar (or press Enter on the focused row) to see that system's pipe specs. A breadcrumb such as `All systems › AW` appears above the bars; select **All systems** to go back. The "Other" row is not clickable. The drill resets when the report is reopened and stays in place when you change weeks.
- **Issues by Building** ranks only buildings with enough welds. Change the cutoff in Format pane → **Hotspots** → **Minimum welds** (default 10, range 1 to 100). Smaller buildings are grouped into "Other".
- Format pane: **Colors → Preset** (QAQC, Ivory, LotusWorks, Grayscale), **Background** (color, background opacity, card opacity), **Animation**, **Accessibility**, **Hotspots**.

## Counting rules

- **Weld:** a row whose WELD WORK WEEK can be read as a work week. Unreadable or future weeks are skipped and noted in a footnote.
- **Signed:** SIGNATURE is filled in.
- **Signed This Week:** signed welds counted by WORK WEEK SIGNED, not by weld week. A signed weld whose WORK WEEK SIGNED can't be read still counts as signed for its weld week, but not in Signed This Week.
- **Sign-off %:** signed ÷ logged for the latest weld week (up to the selected week) that has welds.
- **Overall Sign-off %:** all signed welds ÷ all welds through the selected week. Its status line is red below 10%, amber from 10% to below 15%, and green at 15% and above.
- **Issue:** ISSUE CREATED? is filled in and is not "no", "n/a", "na", "none" or "-". QAQC Advisory Items are not used.
- **Building:** taken from TAG NO (for example BK1, F631, WR1, PS1, F632). A leading "P4-" is ignored. Anything else is grouped as Site General.
- **System and Pipe Spec:** FLUID CODE and PIPE SPEC, with blanks shown as Unspecified. Names are grouped ignoring case and extra spaces.
