# QCx Overview visual: setup

One page with Electrical, Mechanical, Welding and BIM Issues side by side, a quality strip, and two charts. Its numbers match the four discipline visuals for the same week.

**Version 1.2.0:** the BIM issues come from the **enriched Autodesk export** through QCx Combined. Four new optional slots, BIM360 Created By, BIM360 Created On, BIM360 Closed On and Closed At, carry the real creator and dates of the issues migrated from BIM 360.

**Version 1.1.0:** the BIM Issues row's fourth card is now **Past normal close window**, with the closure rate in its sub-line. The quality strip gains a sixth card, **Top root cause**, fed by a new optional Root Cause slot.

## 1. Import the visual (once per report)

1. In Power BI Desktop, open the Visualizations pane, select the three dots (…), then **Import a visual from a file**.
2. Choose `qaqcOverview_AE84E1DA71E7.1.2.0.0.pbiviz`.
3. To update later, import the newer file the same way. It replaces the old version in place and keeps your field bindings.

## 2. Add the QCx Combined table (once per report, required)

The visual reads one table that holds all four sources: the Electrical, Mechanical and Welding sheets and the enriched Autodesk issues export. Follow [QCx_Combined_SETUP.md](QCx_Combined_SETUP.md) to add the **QCx Combined** query. It already includes the Row ID, so you don't need to add an index column for this visual.

## 3. Bind the columns

The first 14 column slots are required. The visual shows its setup screen, listing the slots still empty, until every one is bound. Root Cause, the four BIM360 and Closed At slots, and Green tags are optional.

| Field slot | QCx Combined column |
|---|---|
| Source | Source |
| Row ID | Row ID |
| Work Week | Work Week |
| Inspection Phase | Inspection Phase |
| Issue | Issue |
| Building | Building |
| Signature | Signature |
| Work Week Signed | Work Week Signed |
| ID | ID |
| Status | Status |
| Type | Type |
| Created On | Created On |
| Updated On | Updated On |
| Created By | Created By |
| Root Cause (optional) | Root Cause |
| BIM360 Created By (optional) | BIM360 Created By |
| BIM360 Created On (optional) | BIM360 Created On |
| BIM360 Closed On (optional) | BIM360 Closed On |
| Closed At (optional) | Closed At |
| Green tags (optional) | your Green tags measure (see below) |

Set every column to **Don't summarize**. The visual is designed to fill a full report page.

### Root Cause (optional)

Bind the QCx Combined **Root Cause** column to show the most common root cause in the **Top root cause** card. Without it, the card reads `Add Root Cause`, and everything else works as before. The column comes from the enriched export's Root cause column; see [QCx_Combined_SETUP.md](QCx_Combined_SETUP.md).

### BIM360 and Closed At (optional, but bind them for the enriched export)

About 1,000 issues in the enriched export were migrated from BIM 360. Autodesk stamped each with its migration account as the creator and the late-July 2026 migration date as the created date. The real creator and dates are in the export's BIM360 columns, which QCx Combined carries as **BIM360 Created By**, **BIM360 Created On** and **BIM360 Closed On**. Without these slots, every migrated issue is excluded from the BIM Issues row and the quality strip, because its creator is not LotusWorks. Its dates would also land in WW30–WW31.

- **BIM360 Created By:** for a migrated issue, decides whether LotusWorks created it, in place of Created By.
- **BIM360 Created On:** a migrated issue is opened on this date, in place of Created On.
- **BIM360 Closed On:** a migrated closed issue is closed on this date, in place of Closed At and Updated On.
- **Closed At:** a closed issue is closed on this date, in place of Updated On.

These are the same rules as the QCx BIM Issues visual; see its guide's Counting rules.

### Green tags (optional)

The DWNs card shows the DWN rate: DWNs to date ÷ your green tag count. To get it, create a measure and bind it to **Green tags**. The measure must be wrapped in `COALESCE`, like this:

```DAX
Green tags = COALESCE([Your green tag count], 0)
```

Replace `[Your green tag count]` with your own measure or expression for the total number of green tags.

Why the wrapper matters: Power BI drops every row on which all of a visual's measures are blank. If the green tag count is BLANK (for example, a filter leaves nothing to count), Power BI sends the visual no rows at all, and every discipline row shows "Not connected". `COALESCE(…, 0)` turns a blank into 0, so the rows still arrive. A value of 0 (or no Green tags measure at all) shows the DWN rate as n/a: `DWN rate n/a: add Green tags`.

The measure doesn't need a relationship to QCx Combined; the visual reads its value once.

## 4. Use it

The header holds three controls:

- **`This WW | To date`** sets what the cards show. **This WW** (the default) shows the selected week. **To date** shows everything through the selected week. The choice resets to This WW when the report is reopened.
- **`30 WW | All`** switches the two charts between the last 30 weeks and full history.
- **The week dropdown** opens on the current work week every time the report opens. Pick any week to see its cards.

You can also click a week on either chart, or move along a chart with the arrow keys and press Enter, to select that week without moving the chart. The selected week is highlighted on both charts.

Click the expand icon on a chart to fill the visual with more detail; press Esc or the collapse icon to return. The icon is hidden on empty charts and in read-only views.

Format pane: **Colors → Preset** (QCx, Blue, LotusWorks, Grayscale), **Background** (color, background opacity, card opacity), **Animation**, **Accessibility**.

Week labels include the year, for example `WW41'2026`. Chart axes show `WW41` ticks, with the year under the first labelled week and under the first labelled week of each new year.

## 5. What the page shows

### Discipline rows

Each row has the discipline's name, four cards, and a sparkline of the 30 weeks ending at the selected week, with the selected week marked.

| Row | Card 1 | Card 2 | Card 3 | Card 4 | Sparkline |
|---|---|---|---|---|---|
| Electrical | Finals | SORs | NCRs | NCR pass rate | Finals + SORs per week |
| Mechanical | Finals | SORs | NCRs | NCR pass rate | Finals + SORs per week |
| Welding | Welds logged | Signed | Sign-off % | NCRs | Welds logged per week |
| BIM Issues | Opened | Closed | Remaining open | Past normal close window | Remaining open per week |

**This WW:**

- Counts show the selected week, with the change against the week before.
- **Welding Signed** counts welds by the week they were signed (WORK WEEK SIGNED), as the QCx Welding Signoffs visual's Signed This Week does.
- **Welding Sign-off %** is signed ÷ logged for the latest weld week, up to the selected week, that has welds. Its sub-line names that week.
- **NCR pass rate** uses only the selected week's finals. It shows `n/a` when that week has no finals.
- Rates show their change in points.

**To date:**

- Counts are totals through the selected week, with `+n this WW` underneath. Welding Signed shows `+n signed this WW`.
- Rates are through the selected week, with the points change against the total through the week before.
- **Welding Sign-off %** is the overall sign-off % to date.

**Always to date,** in both modes:

- **BIM Remaining open:** opened minus closed through the selected week.
- **BIM Past normal close window:** the BIM issues open as of the selected week that are older than the normal close window. The window is the 90% mark of your own close times: 90% of the BIM issues closed by the end of that week closed within it. It matches the Past the normal close window card on the QCx BIM Issues visual's Issue Aging page.
  - The sub-line reads, for example, `of 51 open · 28 older than any closure · 71.2% closed`: the open issues, those older than the slowest close so far, and the closure rate (closed ÷ opened through the selected week).
  - With no closures yet it shows `n/a`.

**Colours** match the discipline visuals:

- **Electrical and Mechanical:** NCRs amber when up. NCR pass rate green when up, red when down.
- **Welding:** NCRs amber when up. Sign-off % in red below 10%.
- **BIM Issues:** Opened amber when up in This WW, red when up in To date. Closed green in This WW when at least last week's count and above 0, and green in To date when it rose. Remaining open red when up, green when down. Past normal close window red when above 0.

### Quality strip

| Card | What it counts | Colour |
|---|---|---|
| CORs | BIM issues with Type `COR` created in the week (This WW) or through it (To date) | Amber when up |
| NCRs | Electrical + Mechanical + Welding NCRs. The sub-line splits them: `E · M · W` | Amber when up |
| Inspection NCR pass rate | 1 − (Electrical + Mechanical NCRs ÷ Electrical + Mechanical finals), pooled across both | Green up, red down |
| Welding NCR pass rate | 1 − (issue welds ÷ welds logged) | Green up, red down |
| DWNs | BIM issues with Type `DWN`. The sub-line shows the DWN rate | Neutral |
| Top root cause | The most common Root Cause among BIM issues created in the week (This WW) or through it (To date) | Neutral |

- **CORs and DWNs** match Type ignoring case and extra spaces. Only counted BIM issues are included (see Counting rules), so void issues and issues not created by LotusWorks are left out.
- **NCRs come from final walks only:** Electrical and Mechanical finals with an issue found, and welds with an issue. BIM issues typed `NCR` are **not** counted here.
- **Pass rates** show `n/a` when there are no finals (or no welds) to divide by.
- **Top root cause** shows the cause's name, with `n of N issues · p%` in To date and `n of N opened this WW` in This WW. A week with no new issues reads `None` with `None opened this WW`, and To date before the first issue reads `None` with `No issues to date`. When none of the counted issues has a Root Cause, the card reads `None` with `n issues · none recorded` (To date) or `n opened this WW · none recorded` (This WW). Causes are grouped ignoring letter case and extra spaces, ties go to the name that sorts first, and a long name is cut short (hover it for the full name). Only counted BIM issues are included. Without the Root Cause slot the card reads `Add Root Cause`.
- **DWN rate** is always to date: DWNs through the selected week ÷ Green tags, shown as, for example, `2.1% of green tags (to date)`. Without a Green tags value it reads `DWN rate n/a: add Green tags`.

### Charts

The charts follow `30 WW | All`.

- **Inspection activity by Work Week:** one line each for Electrical and Mechanical, each point that discipline's Finals + SORs for the week. The last point and the selected week are labelled. Hover for the week's Finals, SORs and total for each discipline. In high contrast the Mechanical line is dashed.
  - Expanded: a label on every point that fits, and a sortable table of Week, Electrical Finals, Electrical SORs, Mechanical Finals and Mechanical SORs.
- **Quality rates by Work Week:** the Inspection NCR pass rate and the Welding NCR pass rate, one line each. A week with no finals (or no welds) has no point, so the line breaks there. The axis zooms to the data. Hover for each rate and its counts, for example `2 NCRs of 14 finals`.
  - Expanded: a label on every point that fits, and a table of the weekly rates with their counts.

## 6. Tile sizes

- **Full page (660 px tall and up):** the discipline rows and quality strip as full cards, with the two charts below.
- **Narrow (under 900 px wide, 660 px tall and up):** each row's cards sit two by two, the two charts stack one above the other, and the page scrolls.
- **Cards only (under 660 px tall):** the charts are hidden.
  - From 480 to 660 px tall, and at least 900 px wide: full cards, no charts.
  - Under 480 px tall, or under 900 px wide: a dense one-line layout. Each discipline row is its name, four values with a coloured trend arrow, and the sparkline; the quality strip is one line of six values. Hover a value (or use a screen reader) for its full detail. An 800 × 300 tile fits without scrolling.

## 7. Not connected and footnotes

**"Not connected: no Electrical rows in QCx Combined"** (or Mechanical, Welding, BIM Issues) replaces a row's cards when QCx Combined has no rows for that source. Check that the source query is named correctly at the top of the QCx Combined script and returns rows, and that no report filter or slicer removes that source. If every row says Not connected, check the Green tags measure is wrapped in `COALESCE` (see above).

The footnotes at the bottom report, per source:

- rows skipped because the work week can't be read
- rows dated after the current work week, which aren't counted
- BIM issues not created by LotusWorks, which are excluded
- BIM issues with a blank or unreadable created date (BIM360 Created On, or Created On), which are skipped

They also report rows with an unknown Source (see the QCx Combined guide), and `Showing the first n rows (Power BI data limit)` if Power BI stopped sending rows.

## Counting rules

The Overview uses the same rules as the discipline visuals.

- **Final:** Inspection Phase is Final (any case), starts with "Final ", or contains "final inspection". **SOR:** contains "SOR". Other phases aren't counted.
- **Inspection NCR:** a Final whose Issue is filled in and is not "No Issue Found". SORs never count.
- **Weld:** a Welding row whose Work Week can be read as a work week.
- **Signed weld:** Signature is filled in.
- **Weld NCR (issue weld):** Issue is filled in and is not "no", "n/a", "na", "none" or "-".
- **LotusWorks creator:** the creator contains "LotusWorks" (any letter case, as one word), or is a removed-user record for Samuel Leach or Aaron Harwood.
- **Counted BIM issues:** an issue with any of BIM360 Created By, BIM360 Created On or BIM360 Closed On filled in counts when BIM360 Created By is a LotusWorks creator. Any other issue counts when Created By is one. Issues with Status Void are excluded everywhere.
- **BIM week:** an issue opens in the week of BIM360 Created On, or of Created On when that is blank. A Closed issue closes in the week of the first filled-in value of BIM360 Closed On, Closed At and Updated On.
- **Future weeks:** rows dated after the current work week aren't counted.
