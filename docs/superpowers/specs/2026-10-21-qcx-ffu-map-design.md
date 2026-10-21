# QCx FFU Map — Design

## Why

The FFU MAP drawing is a dense Bluebeam vector PDF. It shows every Fan Filter Unit (FFU) on the floor, with its tag and the coloured line (one line per FFU Group) that connects the FFUs from a home run to a finish. The team wants to see this map in Power BI:

- Each FFU is its own node, joined to the Master FFU Tracker.
- Nodes are green when energized and red when not.
- The group lines are drawn in their colours.
- Clicking an FFU or a line filters the rest of the report page.

## Intellectual property rule

The drawing is client intellectual property. Nothing derived from it goes into the visual, the repo, test fixtures, docs or release zips: no tags, no positions, no layout files and no screenshots of real data.

- **The visual** is a generic renderer. It draws whatever nodes and lines are bound to it.
- **The user creates the data.** They run the layout script on their own machine against their own copy of the PDF, and load the output into Power BI themselves.
- **Script tests** build small synthetic PDFs at test time.
- **Guardrails.** `.gitignore` excludes `*.pdf` and `ffu_layout*.csv` under the script folder.

## Parts

| Part | Location | Purpose |
|---|---|---|
| Layout script | `scripts/ffu-layout/extract_ffu_layout.py` | PDF → layout CSV |
| Script tests | `scripts/ffu-layout/test_extract_ffu_layout.py` | stdlib `unittest`, synthetic PDFs |
| Visual | `packages/qaqc-ffu-map` | Display name "QCx FFU Map". Same QCx look, themes and format-pane presets as the other visuals; React + `qaqc-shared`. |

## Layout script

Usage: `python3 scripts/ffu-layout/extract_ffu_layout.py "<pdf>" -o <csv>`. The output goes wherever the user points it, never into the repo. The script prints a stats report: tags found, lines traced, FFUs on no line, and duplicate tags.

**Dependency.** It needs PyMuPDF (`fitz`), which the user approved on 2026-10-21. If it isn't installed, the script exits with a clear install message.

**Method** (ported from the proof of concept):

1. **Tags.** Read the text spans that match the FFU tag pattern. Grid column, grid row, field and level are parsed from the tag.
2. **FFU boxes.** Find each tag's box among the thin vector strokes, where the span colour matches the box colour (the level). The node position is the box centre, in PDF points with the origin top-left and y pointing down.
3. **Line segments.** These are the coloured strokes of string-line width. Endpoints closer than the join tolerance are merged into graph vertices.
4. **Assignment.** An FFU belongs to the line whose polyline passes through its fan symbol.
5. **Splitting lines.** Lines are separated by connectivity, not colour, because colours repeat across the sheet.
6. **Order.** FFUs are ordered along each line starting from its home run.
7. **Ends.** The home run is the box with a thick green outline and the finish is the box with a thick blue outline.

**CSV columns:**

| Column | Notes |
|---|---|
| FFU Tag | The join key. |
| X, Y | Box centre in PDF points. |
| Line | Traced line id (`L001`…), stable for the same PDF. |
| Line Order | 1-based position from the home run. |
| Line Colour | `#RRGGBB` from the PDF. |
| Home Run, Finish | TRUE/FALSE |
| Grid Column, Grid Row | Parsed from the tag. |

**Unassigned FFUs.** An FFU on no line keeps its X and Y, and its Line, Line Order and Line Colour are left blank.

## Power BI setup

The user loads `ffu_layout.csv` and the Master FFU Tracker, then creates a one-to-one relationship on FFU Tag Name. The visual uses a table mapping with `dataReductionAlgorithm.window.count = 30000`, the same as the existing visuals. A real map has about 6,000 FFUs.

### Field slots

| Slot (role) | Source | Required |
|---|---|---|
| FFU Tag (`tag`) | layout | yes |
| X (`x`), Y (`y`) | layout | yes |
| Line (`line`), Line Order (`lineOrder`) | layout | no; without them no lines are drawn |
| Line Colour (`lineColor`) | layout | no; a fixed palette is used by line index |
| Home Run (`homeRun`), Finish (`finish`) | layout | no |
| Grid Column (`gridColumn`), Grid Row (`gridRow`) | layout | no; without them no grid is drawn |
| FFU Group (`group`) | tracker | no |
| FFU Shutdown Zone (`zone`) | tracker | no |
| RIO Panel (`rioPanel`), Card (`card`), Channel (`channel`), Node (`node`) | tracker | no |
| PWR Panel (`pwrPanel`), Circuit # (`circuit`) | tracker | no |
| FFU Energized (`energized`) | tracker | no; without it every node is grey |

Required roles are validated in code, as in the other visuals.

## Data rules

- **Energized.** These values count as true: `TRUE`, `true`, boolean true, `Yes`, `Y` and `1`. These count as false: `FALSE`, `false`, boolean false, `No`, `N` and `0`. Anything else, or blank, is **Unknown**.
- **No tracker row.** A tag whose tracker fields are all blank is counted as **No tracker row** and shown grey.
- **Not placed.** A row with a blank tag, or a non-numeric X or Y, is skipped and counted as **Not placed**.
- **Duplicate tags.** The first row is kept and the rest are counted as Not placed.
- **Line group.** A line's group is the most common non-blank FFU Group among its FFUs. Ties go to the alphabetically first group. The line is labelled with that group, falling back to its Line id.
- **Mismatches.** An FFU whose non-blank FFU Group differs from its line's group is a **mismatch**.
- **Grid.**
  - Grid columns are ordered by the mean X of their FFUs, and grid rows by the mean Y.
  - A grid line is drawn halfway between the FFU extents of neighbouring bays.
  - Labels sit at the bay centres, pinned to the plot edges.
- **Aggregation** runs once per data update. Drawing reads the prepared arrays.

## Interface

**Header:**
- the title;
- a search box: typing part of a tag lists matches, and choosing one zooms to that FFU and selects it;
- dropdown filters for Zone, Group, RIO Panel and Energized (Energized / De-energized / Unknown).

**Summary strip.** These counts reflect the in-visual filters:
- Total FFUs
- Energized, with % energized
- De-energized
- No tracker row
- Groups
- Group mismatches
- Not placed, shown only when above 0

**Map:**
- **Drawing.** It's drawn on a canvas. It starts fitted to all placed FFUs, and you scroll to zoom and drag to pan. Corner buttons zoom in, zoom out and fit.
- **Nodes and lines.**
  - FFU squares are green (energized), red (de-energized) or grey (Unknown or no tracker row), using the fixed status colours.
  - Lines are drawn in Line Colour, with very light colours darkened for readability.
  - Home-run and finish ends get an outlined marker.
- **Labels.** Tag labels appear once the zoom makes them legible. Grid labels stay pinned to the edges.
- **Filtered-out FFUs.** In-visual filters dim non-matching FFUs and lines to grey but leave them in place.

**Hover.** Hovering an FFU highlights its whole line and shows a tooltip: tag, group, energized state and line position ("#31 of 48").

**Selection.** Selection uses Power BI selection IDs and cross-filters the page.

| Action | Effect |
|---|---|
| Click an FFU | Selects that FFU and opens the detail panel: all tracker fields, line position, home-run and finish tags. |
| Click a line | Selects every FFU on it and opens the group panel: group, energized/total, mismatches, and the de-energized FFUs listed (each one clickable). |
| Ctrl/Cmd-click | Adds to the selection. |
| Click empty space, or Esc | Clears the selection and closes the panel. |

**Resets.** Zoom, search and in-visual filters aren't persisted. They reset when the report reopens.

**States:**
- **Required slots unbound:** a setup message lists the missing slots.
- **No rows:** "No FFUs to show".
- **Every row unplaceable:** "No FFUs could be placed", with the count.

## Performance

- Aggregation is O(N) once per update.
- Hit-testing uses a uniform spatial grid, so it is O(1) per pointer move.
- Drawing culls to the viewport, and tag labels are drawn only when zoomed in.
- The target is under 16 ms per frame at 30,000 nodes, fitted.

## Testing

**Visual unit tests** (vitest):
- energized parsing;
- Not placed and duplicate handling;
- line group majority and ties;
- mismatches;
- grid derivation;
- spatial-index hit-testing (node and line);
- filter dimming;
- summary counts;
- selection rules.

**Timing test.** A test in the `qaqc-shared-timing` project builds a 30,000-node synthetic dataset and measures aggregation plus hit-testing with `bestOf`.

**Script tests** (`unittest`). Each test builds a synthetic PDF with PyMuPDF (a handful of tagged boxes, two coloured lines with home-run and finish boxes, one FFU on no line) and asserts:
- the CSV rows;
- the line membership and order;
- the colours and flags;
- the grid fields;
- the stats report.

**Visual check.** It runs locally only, against the user's real layout file, and the screenshots stay out of the repo. It also checks that the review gate (`scripts/review-business-package.mjs`) and the CSS verify step pass.

## Version

QCx FFU Map 1.0.0. It's synced to LotusWorks_Package and Business_Package like the other QCx visuals.
