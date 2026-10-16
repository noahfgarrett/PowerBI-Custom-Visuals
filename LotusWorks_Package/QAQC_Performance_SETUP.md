# QCx Performance visual: setup

NCR performance per person: each QCR / FE across Electrical and Mechanical final inspections, and, separately, each welder. People are ranked by NCR rate over a period you choose, and each has their own page.

## 1. Import the visual (once per report)

1. In Power BI Desktop, open the Visualizations pane, select the three dots (…), then **Import a visual from a file**.
2. Choose `qaqcPerformance_AD661934E05F.1.0.0.0.pbiviz`.
3. To update later, import the newer file the same way. It replaces the old version in place and keeps your field bindings.

## 2. Add the QAQC Combined table (once per report, required)

The visual reads one table that holds all four sheets. Follow [QAQC_Combined_SETUP.md](QAQC_Combined_SETUP.md) to add the **QAQC Combined** query. It already includes the Row ID, so you don't need to add an index column for this visual.

## 3. Bind the columns

All nine slots are required. The visual shows its setup screen, listing the slots still empty, until every one is bound.

| Field slot | QAQC Combined column |
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

Set every field to **Don't summarize**. The visual is designed to fill a full report page.

## 4. Use it

The header holds three controls:

- **`QCR / FE | Welders`** switches between the two groups. QCR / FE (the default) ranks the people on Electrical and Mechanical finals; Welders ranks the welders on the welding log. The two groups are never mixed.
- **`30 WW | All`** sets the ranking period: the 30 weeks ending at the selected week, or every week from the start of the data up to it.
- **The week dropdown** opens on the current work week every time the report opens. The period ends at the week you pick.

Format pane: **Colors → Preset** (QAQC, Ivory, LotusWorks, Grayscale), **Background** (color, background opacity, card opacity), **Animation**, **Accessibility**, and **Ranking**:

| Ranking setting | Default | Range | What it does |
|---|---|---|---|
| Minimum finals | 5 | 1 to 100 | A QCR / FE needs at least this many finals in the period to be ranked |
| Minimum welds | 10 | 1 to 100 | A welder needs at least this many welds in the period to be ranked |

Week labels include the year, for example `WW41'2026`. Chart axes show `WW41` ticks, with the year under the first labelled week and under the first labelled week of each new year.

## 5. What the page shows

### Summary strip

Four cards for the shown group and period:

- **QCR/FE ranked** (or **Welders ranked**): how many people are ranked, with the minimum and how many are below it.
- **Finals** (or **Welds**): every final (or weld) in the period for the whole group, including people below the minimum and Not recorded.
- **NCRs:** the whole group's NCRs in the period.
- **NCR rate:** NCRs ÷ Finals (or welds) for the whole group.

### The table

| QCR / FE columns | Welders columns |
|---|---|
| Name, Finals, NCRs, NCR rate, Trend | Welder, Welds, NCRs, NCR rate, Trend |

The table has three blocks, in this order:

1. **Ranked people:** everyone with at least the minimum finals (or welds) in the period, ordered by NCR rate (highest first), then NCRs (most first), then name. QCR / FE names carry `E` and `M` tags for the disciplines of their finals in the period.
2. **Below minimum (n people):** a collapsed group with a disclosure button. Open it to see everyone under the minimum, ordered by finals (or welds), most first. They are listed but never ranked.
3. **Not recorded:** a single row totalling every final (or weld) with no name recorded, shown last and never ranked. It only appears when there is at least one.

Click any column header to sort by it; click again to reverse. The three blocks stay in their order and each sorts within itself. The header stays in place as you scroll.

### Trend

The Trend column is a strip of the 30 weeks ending at the selected week: one tiny bar per week for the person's finals (or welds), with weeks that had an NCR drawn in red and flagged above the bar. Screen readers hear the same as text: "NCRs in n of the last 30 weeks".

It is not a weekly NCR-rate line on purpose. Most people have a handful of finals a week, so a weekly rate would jump between 0% and 100% and hide the pattern; bars plus NCR weeks show both volume and when NCRs happened.

### Person page

Click a person's row, or press Enter on their name, to open their page over the whole visual. The title names the person and the group, plus their disciplines for a QCR / FE, for example `QCR 02 · QCR / FE · Electrical`. Below-minimum people open the same way; the Not recorded row doesn't. Press Esc or **Back** to return to the table, with the focus back on that person's name.

The page shows:

- **Cards:** Finals (or Welds), NCRs and NCR rate for **This period**, and the same three for **All time**.
- **Week by week:** a bar per week for the person's finals (or welds) over the period, with NCRs as red bars beside them, and the **Running NCR rate** within the period as a line on the right axis. Hover a week for its numbers.
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
- **NCR rate:** NCRs ÷ Finals.

### Welders

- **Who's counted:** Welding rows in the period whose Work Week can be read and isn't after the current work week.
- **Welder lists:** the Welder cell is split on commas, and each name is trimmed and grouped ignoring letter case and extra spaces. A weld that lists several welders counts once for **each** welder it lists, and its NCR counts for each of them. The footnote says how many welds in the period list more than one welder. Because of this, the welds in the table can add up to more than the Welds card, which counts each weld once.
- **NCRs:** welds whose Issue is filled in and is not "no", "n/a", "na", "none" or "-".
- **NCR rate:** NCRs ÷ welds.

### Not recorded

A QCR/FE or Welder cell that is blank, or is `n/a`, `na`, `none` or `-` (trimmed, any letter case), is **Not recorded**. For welders this applies to each comma-separated part; a weld with no recorded welder goes to Not recorded. For QCR / FE only finals go to Not recorded, and the footnote says `n finals have no QCR/FE`. It's hidden when there are none.

## Footnotes

The footnotes at the bottom report, for the shown group:

- rows skipped because the work week can't be read
- rows dated after the current work week, which aren't counted
- finals with no QCR/FE (QCR / FE), or welds listing more than one welder (Welders)
- rows with an unknown Source (see the QAQC Combined guide)
- `Showing the first n rows (Power BI data limit)`, if Power BI stopped sending rows
