# QAQC Mechanical / Process Inspections visual: setup

## 1. Import the visual (once per report)

1. In Power BI Desktop, open the Visualizations pane, select the three dots (…), then **Import a visual from a file**.
2. Choose `qaqcMechanical_7064EE749149.<version>.pbiviz`.
3. To update later, import the newer file the same way. It replaces the old version in place and keeps your field bindings.

## 2. Add a Row ID (Power Query, once per report, required)

Power BI merges rows that are identical in every bound column. The visual shows its setup screen until a Row ID is bound. To add one:

1. **Home → Transform data**, select the Mechanical / Process Inspection Log query.
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

Set every field to **Don't summarize**. The visual is designed to fill a full report page.

## 4. Use it

- The week dropdown opens on the current work week every time the report opens.
- `30 WW | All` switches the charts between the last 30 weeks and full history.
- Click a bar to see that week's cards without moving the chart.
- Click the expand icon on any chart to fill the visual with more detail; press Esc or the collapse icon to return.
- Format pane: **Colors → Preset** (QAQC, Ivory, LotusWorks, Grayscale), **Background** (color, background opacity, card opacity), **Animation**, **Accessibility**.

## Counting rules

- **Final:** Inspection Phase is Final (any case), starts with "Final ", or contains "final inspection". **SOR:** contains "SOR".
- **Issues Found:** Final rows whose Issue? is filled in and is not "No Issue Found". SOR rows never count.
- **NCR Pass Rate:** Finals with no issue ÷ all Finals, through the selected week.
- **Pass / Fail column:** not used. NCR Pass Rate comes from Issue? so it matches the Electrical visual.
