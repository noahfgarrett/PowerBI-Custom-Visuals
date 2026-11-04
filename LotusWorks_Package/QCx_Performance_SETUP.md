# QCx Performance visual: setup

NCR performance per person: each QCR / FE across Electrical and Mechanical final inspections, and, separately, each welder. People are ranked by NCR Pass Rate, lowest first, over a period you choose, and each has their own page.

**Version 1.2.0:** a **Filter** menu in the header filters the page by date range and field. Four new optional slots feed it, and read the longer QCx Combined table, so re-paste its script (see [QCx_Combined_SETUP.md](QCx_Combined_SETUP.md)). Its identity is unchanged, so importing the new file updates existing reports in place and keeps your field bindings.

## 1. Import the visual (once per report)

1. In Power BI Desktop, open the Visualizations pane, select the three dots (…), then **Import a visual from a file**.
2. Choose `qaqcPerformance_AD661934E05F.1.2.0.0.pbiviz`.
3. To update later, import the newer file the same way. It replaces the old version in place and keeps your field bindings.

## 2. Add the QCx Combined table (once per report, required)

The visual reads one table that holds all four sheets. Follow [QCx_Combined_SETUP.md](QCx_Combined_SETUP.md) to add the **QCx Combined** query. It already includes the Row ID, so you don't need to add an index column for this visual. If you added the table before version 1.2.0, re-paste the script so it has the 39 columns.

## 3. Bind the columns

The first nine slots are required. The visual shows its setup screen, listing the slots still empty, until every one is bound. The other four are optional: they add fields to the Filter menu, and a report that doesn't bind them keeps working.

| Field slot | QCx Combined column |
|---|---|
| Source | Source |
| Row ID | Row ID |
| Work Week | Work Week |
| Inspection Phase | Inspection Phase |
| Issue | Issue |
| Building | Building |
| QCR/FE | QCR/FE |
| Welder | Welder |
| Tag No | Tag No |
| General Contractor (optional) | General Contractor |
| Discipline (optional) | Discipline |
| Pipe Spec (optional) | Pipe Spec |
| Fluid Code (optional) | Fluid Code |

Set every field to **Don't summarize**. The visual is designed to fill a full report page.

## 4. Use it

The header holds four controls:

- **`QCR / FE | Welders`** switches between the two groups. QCR / FE (the default) ranks the people on Electrical and Mechanical finals; Welders ranks the welders on the welding log. The two groups are never mixed.
- **Filter** narrows the page by date range and by field (see Filter menu below).
- **`30 WW | All`** sets the ranking period: the 30 weeks ending at the selected week, or every week from the start of the data up to it.
- **The week dropdown** opens on the current work week every time the report opens. The period ends at the week you pick.

Format pane: **Colors → Preset** (QCx, Blue, LotusWorks, Grayscale), **Background** (color, background opacity, card opacity), **Animation**, **Accessibility**, and **Ranking**:

| Ranking setting | Default | Range | What it does |
|---|---|---|---|
| Minimum finals | 5 | 1 to 100 | A QCR / FE needs at least this many finals in the period to be ranked |
| Minimum welds | 10 | 1 to 100 | A welder needs at least this many welds in the period to be ranked |

Week labels include the year, for example `WW41'2026`. Chart axes show `WW41` ticks, with the year under the first labelled week and under the first labelled week of each new year.

### Filter menu

Select **Filter** in the header, before `30 WW | All`.

- **Date range:** From and To work-week dropdowns, labelled `(start)` and `(now)` at the data's limits, and the presets Last 4 WW, Last 13 WW and This year. Presets end at the current work week.
- **Fields** depend on the group on screen, and appear when their slots are bound:

| Group | Filters offered |
|---|---|
| QCR / FE | Contractor (from the General Contractor slot), Building, Discipline |
| Welders | Building (taken from Tag No), Pipe Spec, Fluid Code |

- **Switching groups:** a filter on the other group's field stays set but doesn't apply, and its chip is hidden until you switch back. **Clear all** clears both groups' fields.
- **Building** is one field across both groups, and treats `F63.1` and `F631` as one choice, because inspection rows spell a building one way and the building taken from a weld's Tag No another.
- **Showing X of Y rows** counts the group on screen: every Electrical and Mechanical row on QCR / FE, and every Welding row on Welders. See the QCx Combined guide.
- Each field has a search box and tick boxes with row counts, most rows first.
- **Changes apply at once.** There's no Apply button. Press Esc or click outside to close the menu.
- **Ticks:** within a field, a row matches any ticked value. Across fields, it must match all of them. Ticking nothing in a field means no filter on it. The footer's **Showing X of Y rows** updates as you tick.
- **Chips:** each active filter shows as a chip under the header. Click a chip's × to remove it, or **Clear all** to remove every filter. The Filter button shows how many filters are active.
- **Grouping:** values are grouped ignoring letter case and extra spaces, so `Electrical` and `ELECTRICAL` are one choice. Blank, `N/A`, `NA`, `None` and `-` are one **Not recorded** choice, listed last.
- **Typos:** a typo in the sheet appears as a separate choice. Nothing corrects spelling; fix it in the sheet.
- **No matching rows:** the cards and charts give way to a message with a **Clear filters** button, so zeros can't be read as real results.
- **Keeping filters:** filters survive a data refresh, and a ticked value no longer in the data is dropped. They reset when the report is reopened. They apply to this visual only.
- **Read-only views:** the Filter button is disabled when interactions are off.

Rankings, cards, minimums and the Below minimum and Not recorded blocks all restate to the filtered rows. So does the Person page's **This period**, its week-by-week chart and its NCR table. The Person page's **All time** cards stay unfiltered.

### In range

Setting a date range makes the range the ranking period:

- `30 WW | All` is disabled. Ranks, cards and the Trend column read exactly the weeks in the range.
- Past 30 weeks, the Trend column fits every week of the range into its width.
- The week dropdown offers only the weeks in the range. No number reads the selected week while a range is set; your pick is kept for when the range is cleared.
- A range from the first week of the data to the current week is the same as no range, so it isn't counted as a filter.

## 5. What the page shows

### Summary strip

Four cards for the shown group and period:

- **QCR/FE ranked** (or **Welders ranked**): how many people are ranked, with the minimum and how many are below it.
- **Finals** (or **Welds**): every final (or weld) in the period for the whole group, including people below the minimum and Not recorded.
- **NCRs:** the whole group's NCRs in the period.
- **NCR Pass Rate:** 100% − (NCRs ÷ Finals), or 100% − (NCRs ÷ welds), for the whole group. 100 finals with 2 NCRs shows 98.00%.

### The table

| QCR / FE columns | Welders columns |
|---|---|
| Name, Finals, NCRs, NCR Pass Rate, Trend | Welder, Welds, NCRs, NCR Pass Rate, Trend |

The table has three blocks, in this order:

1. **Ranked people:** everyone with at least the minimum finals (or welds) in the period, ordered by NCR Pass Rate (lowest first), then NCRs (most first), then name. QCR / FE names carry `E` and `M` tags for the disciplines of their finals in the period.
2. **Below minimum (n people):** a collapsed group with a disclosure button. Open it to see everyone under the minimum, ordered by finals (or welds), most first. They are listed but never ranked.
3. **Not recorded:** a single row totalling every final (or weld) with no name recorded, shown last and never ranked. It only appears when there is at least one.

A 100.00% NCR Pass Rate is muted, so anything below it stands out.

Click any column header to sort by it; click again to reverse. NCR Pass Rate starts lowest first, the same way the ranking does. The three blocks stay in their order and each sorts within itself. The header stays in place as you scroll.

### Trend

The Trend column is a strip of the 30 weeks ending at the selected week, or of the weeks in a date range: one tiny bar per week for the person's finals (or welds), with weeks that had an NCR drawn in red and flagged above the bar. Screen readers hear the same as text, for example "NCRs in n of the last 30 weeks".

It is not a weekly NCR Pass Rate line on purpose. Most people have a handful of finals a week, so a weekly pass rate would jump between 0% and 100% and hide the pattern; bars plus NCR weeks show both volume and when NCRs happened.

### Person page

Click a person's row, or press Enter on their name, to open their page over the whole visual. The title names the person and the group, plus their disciplines for a QCR / FE, for example `QCR 02 · QCR / FE · Electrical`. Below-minimum people open the same way; the Not recorded row doesn't. Press Esc or **Back** to return to the table, with the focus back on that person's name.

The page shows:

- **Cards:** Finals (or Welds), NCRs and NCR Pass Rate for **This period**, and the same three for **All time**, which filters don't change.
- **Week by week:** a bar per week for the person's finals (or welds) over the period, with NCRs as red bars beside them, and the **Running NCR Pass Rate** within the period as a line on the right axis, which always runs from 0% to 100%. Hover a week for its numbers.
- **NCR table:** each NCR in the period, with Work Week, Source (Electrical, Mechanical or Welding), Building (inspections) or Tag No (welds), and Issue (the cell text). It opens newest first; click a header to sort.

### Tile sizes

- Under 900 px wide, the summary cards sit two by two and the page scrolls, with the table kept at least 300 px tall.
- Under 420 px tall, only the summary strip shows; the table is hidden.

## Counting rules

### QCR / FE

- **Who's counted:** Electrical and Mechanical **finals** in the period whose Work Week can be read and isn't after the current work week. Only finals count. SORs aren't tracked against QCR / FE: an SOR row isn't credited to anyone, and someone whose rows in the period are all SORs doesn't appear in the table.
- **Names** are trimmed and grouped ignoring letter case and extra spaces, so `Jane  Smith` and `jane smith` are one person. The first spelling found is shown.
- **One row per person:** someone with finals in both Electrical and Mechanical has one row, with both `E` and `M` tags.
- **Finals:** Inspection Phase is Final (any case), starts with "Final ", or contains "final inspection". Every other phase, SORs included, isn't counted.
- **NCRs:** finals whose Issue is filled in and is not "No Issue Found".
- **NCR Pass Rate:** 100% − (NCRs ÷ Finals). A period with no finals shows n/a.

### Welders

- **Who's counted:** Welding rows in the period whose Work Week can be read and isn't after the current work week.
- **Welder lists:** the Welder cell is split on commas, and each name is trimmed and grouped ignoring letter case and extra spaces. A weld that lists several welders counts once for **each** welder it lists, and its NCR counts for each of them. The footnote says how many welds in the period list more than one welder. Because of this, the welds in the table can add up to more than the Welds card, which counts each weld once.
- **NCRs:** welds whose Issue is filled in and is not "no", "n/a", "na", "none" or "-".
- **NCR Pass Rate:** 100% − (NCRs ÷ welds). A period with no welds shows n/a.

### Not recorded

A QCR/FE or Welder cell that is blank, or is `n/a`, `na`, `none` or `-` (trimmed, any letter case), is **Not recorded**. For welders this applies to each comma-separated part; a weld with no recorded welder goes to Not recorded. For QCR / FE only finals go to Not recorded, and the footnote says `n finals have no QCR/FE`. It's hidden when there are none.

## Footnotes

The footnotes at the bottom report, for the shown group:

- rows skipped because the work week can't be read
- rows dated after the current work week, which aren't counted
- finals with no QCR/FE (QCR / FE), or welds listing more than one welder (Welders)
- rows with an unknown Source (see the QCx Combined guide)
- `Showing the first n rows (Power BI data limit)`, if Power BI stopped sending rows
