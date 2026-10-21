# QCx FFU Map visual: setup

A floor map of every Fan Filter Unit (FFU). Each FFU is a square: green when energized, red when not, grey when unknown. The coloured lines join each FFU Group from its home run to its finish. Click an FFU or a line to cross-filter the rest of the page.

The visual is a generic renderer. It ships with no drawing data: you build the layout from your own copy of the FFU MAP PDF, on your own machine, and load it into your report.

## 1. Build the layout file from the PDF

The layout script reads the FFU MAP PDF and writes `ffu_layout.csv`: one row per FFU with its position, its line and its grid bay. It ships in this package's `ffu-layout/` folder (`extract_ffu_layout.py`, with a `README.md`) and needs Python 3 and PyMuPDF. From the package folder:

```bash
python3 -m pip install pymupdf
python3 ffu-layout/extract_ffu_layout.py "<path to your FFU MAP.pdf>" -o "<folder outside this package>/ffu_layout.csv"
```

The script prints a short report: tags found, duplicate tags, lines traced, FFUs on no line, and lines without a home run or finish. Check it before you load the file.

**The drawing is client intellectual property.** Keep the PDF and `ffu_layout.csv` on your own machine or in the project's controlled storage. Never commit them, attach them to a ticket, or add them to a release zip. Write the CSV outside this package folder and outside any source repository.

The CSV columns are:

| Column | What it holds |
|---|---|
| FFU Tag | The tag printed on the drawing; the join key |
| X, Y | The centre of the FFU's box, in PDF points (origin top-left, Y pointing down) |
| Line | The traced line id (`L001`, `L002`, …), stable for the same PDF |
| Line Order | Position along the line, starting at 1 for the home run |
| Line Colour | The line's colour as `#RRGGBB` |
| Home Run, Finish | TRUE on the line's first and last FFU |
| Grid Column, Grid Row | The grid bay, read from the tag |

An FFU on no line keeps its X and Y; its Line, Line Order and Line Colour are blank.

## 2. Import the visual (once per report)

1. In Power BI Desktop, open the Visualizations pane, select the three dots (…), then **Import a visual from a file**.
2. Choose `qaqcFfuMap_A99D48C1F994.1.0.0.0.pbiviz`.
3. To update later, import the newer file the same way. It replaces the old version in place and keeps your field bindings.

## 3. Load the two tables

1. **Get data → Text/CSV**, choose your `ffu_layout.csv`, then **Transform Data**. Set the column types:
   - **X** and **Y**: **Decimal Number**.
   - **Line Order**: **Whole Number**.
   - **FFU Tag**, **Line**, **Line Colour**, **Grid Column** and **Grid Row**: **Text**. Power Query may detect Grid Row as a number; set it back to Text so labels like `01` keep their leading zero.
   - **Home Run** and **Finish**: **True/False** or Text; the visual reads either.

   Name the query **FFU Layout** and select **Close & Apply**.
2. Load the **Master FFU Tracker** the way your team already does (Excel or SharePoint). The visual reads these columns from it: FFU Tag Name, FFU Group, FFU Shutdown Zone, RIO Panel, Card, Channel, Node, PWR Panel, Circuit # and FFU Energized.

## 4. Relate the tables

In **Model view**, create a relationship from **FFU Layout[FFU Tag]** to **Master FFU Tracker[FFU Tag Name]**:

- **Cardinality:** One to one (1:1).
- **Cross filter direction:** Both.

Each tag must appear once in each table. If Power BI refuses one-to-one, one table has a duplicate or blank tag: the layout script's report lists duplicate tags, and the tracker needs its own clean-up.

## 5. Bind the columns

FFU Tag, X and Y are required. The visual shows its setup screen, listing the slots still empty, until those three are bound. Bind the layout slots from **FFU Layout** and the tracker slots from **Master FFU Tracker**.

| Field slot | Column | Required | If left empty |
|---|---|---|---|
| FFU Tag | FFU Layout[FFU Tag] | yes | |
| X | FFU Layout[X] | yes | |
| Y | FFU Layout[Y] | yes | |
| Line | FFU Layout[Line] | no | No lines are drawn (Line Order is needed too) |
| Line Order | FFU Layout[Line Order] | no | No lines are drawn (Line is needed too) |
| Line Colour | FFU Layout[Line Colour] | no | Lines use a fixed palette, by line |
| Home Run | FFU Layout[Home Run] | no | No home-run marker |
| Finish | FFU Layout[Finish] | no | No finish marker |
| Grid Column | FFU Layout[Grid Column] | no | No column dividers or labels |
| Grid Row | FFU Layout[Grid Row] | no | No row dividers or labels |
| FFU Group | Master FFU Tracker[FFU Group] | no | Lines are labelled by Line id; no mismatches |
| FFU Shutdown Zone | Master FFU Tracker[FFU Shutdown Zone] | no | The Zone filter is empty |
| RIO Panel | Master FFU Tracker[RIO Panel] | no | The RIO Panel filter is empty |
| Card | Master FFU Tracker[Card] | no | Shown as — in the FFU panel |
| Channel | Master FFU Tracker[Channel] | no | Shown as — in the FFU panel |
| Node | Master FFU Tracker[Node] | no | Shown as — in the FFU panel |
| PWR Panel | Master FFU Tracker[PWR Panel] | no | Shown as — in the FFU panel |
| Circuit # | Master FFU Tracker[Circuit #] | no | Shown as — in the FFU panel |
| FFU Energized | Master FFU Tracker[FFU Energized] | no | Every FFU is grey |

Set every field to **Don't summarize**. The visual is designed to fill a full report page. It reads up to 30,000 rows; a full floor is about 6,000.

## 6. What the colours mean

| Square | Meaning |
|---|---|
| Green | FFU Energized is `TRUE`, `Yes`, `Y` or `1` (any letter case) |
| Red | FFU Energized is `FALSE`, `No`, `N` or `0` (any letter case) |
| Grey | Unknown: FFU Energized is blank or anything else, or the FFU has no tracker row |
| Light grey | Filtered out by the visual's own filters (see Use it) |

Lines are drawn in their Line Colour. Very light colours are darkened so they stay readable on the card. A home run or finish FFU has an outlined square around it.

The summary strip and panels also use these terms:

- **No tracker row:** a layout tag with every tracker field blank, usually because the tracker has no row for that tag. It's drawn grey.
- **Not placed:** a row the visual can't draw: its tag is blank, or its X or Y is blank or not a number. A tracker row whose tag isn't in the layout comes through with no X or Y, so it counts here too. A repeated tag keeps its first row; the rest count as Not placed. The card only shows when the count is above 0.
- **Mismatch:** an FFU whose FFU Group differs from its line's group. A line's group is the most common FFU Group among its FFUs (ties go to the alphabetically first). The FFU panel flags it, and **Group mismatches** counts them.

## 7. Use it

**Header:**

- **Search tag:** type part of a tag to list up to 8 matches. Choose one (click, or arrow keys and Enter) to zoom to that FFU and select it.
- **Zone, Group, RIO Panel, Energized:** in-visual filters. FFUs and lines that don't match turn light grey but stay in place, and the summary strip counts only the matching FFUs. Group matches the FFU's own group, or its line's group when it has none.

**Summary strip:** Total FFUs, Energized (with % energized), De-energized, No tracker row, Groups (lines with a matching FFU), Group mismatches and, when above 0, Not placed.

**Map:**

- Scroll to zoom and drag to pan. The corner buttons zoom in, zoom out and fit the whole floor.
- Tag labels appear once you zoom in far enough to read them. Grid labels stay pinned to the top and left edges.
- Hover an FFU to highlight its whole line and see its tag, group, energized state and line position (for example `#31 of 48`).

**Selection** cross-filters the rest of the page:

| Action | Effect |
|---|---|
| Click an FFU | Selects it and opens the FFU panel: every tracker field, line position, and the line's home-run and finish tags |
| Click a line | Selects every FFU on it and opens the group panel: group, energized / total, mismatches, and the de-energized FFUs listed (click one to select it) |
| Ctrl-click (Cmd-click on a Mac) | Adds to the selection |
| Click empty space, or press Esc | Clears the selection and closes the panel |

Zoom, search and the in-visual filters aren't saved. They reset when the report reopens.

Format pane: **Colors → Preset** (QCx, Blue, LotusWorks, Grayscale) and **Background** (color, background opacity, card opacity). The status colours stay green, red and grey in every preset.

## 8. When the drawing changes

1. Run the layout script again on the new PDF, writing over your `ffu_layout.csv` (step 1).
2. Check the script's report for new duplicate tags or FFUs on no line.
3. In Power BI, select **Refresh**.

Line ids (`L001`, …) are stable for the same PDF, but can change when the drawing's lines change. Nothing in the visual depends on them staying the same.
