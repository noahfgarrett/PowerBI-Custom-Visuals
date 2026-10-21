# QCx FFU Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a layout script, which turns the FFU MAP PDF into a layout CSV, and a generic Power BI visual, "QCx FFU Map". The visual draws each FFU as a node that is green when energized and red when not, draws the group lines in their colours, and cross-filters the page when you click an FFU or a line.

**Architecture:**
- **Script.** A stdlib-plus-PyMuPDF Python script under `scripts/ffu-layout/` produces the CSV on the user's machine.
- **Visual logic in `qaqc-shared`.** Pure TypeScript modules in `packages/qaqc-shared/src/`, following the existing pattern, handle:
  - reading the table into an index;
  - geometry and hit-testing;
  - filters and the summary counts;
  - canvas drawing.
- **React dashboard.** `FfuMapDashboard` composes those modules.
- **The package.** `packages/qaqc-ffu-map` is a thin Power BI shell: `visual.ts` and `settings.ts`, plus selection IDs built with `withTable`.

**Tech Stack:**
- **Script:** Python 3 with PyMuPDF (`fitz`) and stdlib `unittest`.
- **Visual:**
  - TypeScript strict, React 19.2.7 and lucide-react 1.24.0;
  - powerbi-visuals-api ~5.3.0 with pbiviz 5;
  - vitest and jsdom for tests;
  - Canvas 2D for drawing.

**Spec:** `docs/superpowers/specs/2026-10-21-qcx-ffu-map-design.md`

## Global Constraints

- **IP rule:** nothing derived from the real drawing goes in the repo, fixtures, docs, screenshots or release zips. All test data is synthetic, and the tags in tests use made-up values such as `FFU900-ZZ01-F01-A`.
- **Dependencies:**
  - No new npm dependencies.
  - PyMuPDF (`fitz`) is the only Python dependency (approved 2026-10-21).
  - Script tests use `unittest`, not pytest.
- **Names:**
  - The package is `packages/qaqc-ffu-map`, pbiviz name `qaqcFfuMap`, display name `QCx FFU Map`, class `QaqcFfuMapVisual`, version `1.0.0.0`.
  - The GUID follows the pattern `qaqcFfuMap_<12 uppercase hex>`; generate it once.
- **Row limit:** `dataReductionAlgorithm.window.count = 30000`.
- **Icons:** lucide-react only, never emoji.
- **Shared files:** per-package `visual.ts` and `settings.ts` stay per package, because the review gate greps them.
- **Colours:**
  - Status colours come from the theme (`good`, `bad`).
  - Unknown and No tracker row use the theme's `faint`.
  - Dimmed nodes and lines use the theme's `border`.
- **Energized values:**
  - True: `TRUE`, `true`, boolean `true`, `Yes`, `Y`, `1` (string or number).
  - False: `FALSE`, `false`, boolean `false`, `No`, `N`, `0`.
  - Matching is trimmed and case-insensitive. Anything else, or blank, is Unknown.
- **No persistence:** zoom, search and filters aren't persisted.
- **Code rules:**
  - Strict TypeScript, with no `any` and no `as` except the existing JSON-import pattern.
  - Explicit return types.
  - Exhaustive switches with `never`.

## Review Focus

These are the cases most likely to bite a real user. Each is pinned by a test in the task named.

1. **A tracker joined with blanks** (layout rows with no tracker match have every tracker cell `null`) must show grey and count as "No tracker row", not crash or count as de-energized. *(Task 2)*
2. **X and Y arriving as text** (`"803.03"`) because the CSV column was typed as Text in Power Query must still place the node; `""`, `"abc"`, `NaN` and `Infinity` must not. *(Task 2)*
3. **Every FFU sitting on one grid column or row,** or a single FFU, must not divide by zero in fit or grid derivation. *(Tasks 2 and 3)*
4. **Data refreshes while a selection is open:** the panel must close and the selection clear rather than point at a stale node index. *(Task 6)*
5. **A Line value bound without Line Order** (or the reverse) must draw no lines but still draw the nodes, not throw. *(Task 2)*

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/ffu-layout/extract_ffu_layout.py` | PDF to layout CSV, plus the stats report |
| `scripts/ffu-layout/test_extract_ffu_layout.py` | Synthetic-PDF tests |
| `scripts/ffu-layout/.gitignore` | Blocks `*.pdf` and `ffu_layout*.csv` |
| `scripts/ffu-layout/README.md` | How to run the script, and the IP note |
| `packages/qaqc-shared/src/ffuMap.ts` | Slots, `readFfuTable`, `parseEnergized`, `buildFfuIndex` (nodes, lines, groups, mismatches, grid, not placed) |
| `packages/qaqc-shared/src/ffuGeometry.ts` | View transform, fit and zoom, the node and segment spatial grids, `nodeAt`, `lineAt` |
| `packages/qaqc-shared/src/ffuFilters.ts` | Filter state, `nodeMatches`, `summarize`, `filterOptions`, `searchTags` |
| `packages/qaqc-shared/src/ffuMapCanvas.ts` | `drawFfuMap` (culling, dimming, highlight, labels, grid), `readableLineColor` |
| `packages/qaqc-shared/src/components/FfuMapDashboard.tsx` | Header, search, filters, summary strip, canvas host, pointer and keyboard handling, panels |
| `packages/qaqc-shared/src/components/FfuDetailPanel.tsx` | The FFU panel and the group panel |
| `packages/qaqc-shared/src/__tests__/fixtures/syntheticFfu.ts` | `syntheticFfuTable(count)`: a deterministic fake table for tests, timing and the dev harness |
| `packages/qaqc-shared/src/qaqc.less` | `.qaqc-ffu-*` rules |
| `packages/qaqc-ffu-map/*` | pbiviz shell, mirroring `qaqc-performance` |
| `LotusWorks_Package/QCx_FFU_Map_SETUP.md`, `Business_Package/QCx_FFU_Map_SETUP.md` | User setup guide |

---

### Task 1: Layout script

**Files:**
- Create: `scripts/ffu-layout/extract_ffu_layout.py`
- Create: `scripts/ffu-layout/test_extract_ffu_layout.py`
- Create: `scripts/ffu-layout/.gitignore`
- Create: `scripts/ffu-layout/README.md`

**Reference:**
- **Read:** the proof of concept is `/private/tmp/claude-501/-Users-noahgarrett-Codebase-QAQC-Weekly-Report/758b0a9f-4c45-496f-be89-b387c5cbd742/scratchpad/ffu/extract_ffu.py`. Port its method: tag spans, level-coloured boxes, string-width segments with join tolerance, assignment through the fan symbol, connectivity components, home-run ordering, and the thick green and blue end boxes.
- **Don't open** `ffu_layout.csv`, `ffu_layout.json` or `ffu-map.html` in that folder. They hold real drawing data, and nothing from them may be copied anywhere.

**Interfaces:**
- **CLI:** `python3 scripts/ffu-layout/extract_ffu_layout.py <pdf> -o <csv>`. It prints the stats report to stdout and exits 0.
  - Exit 2 with `PyMuPDF is required: python3 -m pip install pymupdf` if `fitz` can't be imported.
  - Exit 1 if the PDF has zero matching tags.
- **Importable function:** `extract(pdf_path: str) -> tuple[list[dict], dict]`, returning the rows and the stats.
- **CSV header,** in this exact order: `FFU Tag,X,Y,Line,Line Order,Line Colour,Home Run,Finish,Grid Column,Grid Row`.
  - X and Y are rounded to 2 decimals.
  - Booleans are `TRUE`/`FALSE`.
  - Line ids are `L001`, `L002`…, numbered by the line's home-run position (top to bottom, then left to right). Unassigned FFUs have blank Line, Line Order and Line Colour.
  - Rows are sorted by tag.
- **Stats keys:** `tags`, `duplicate_tags` (dict), `lines`, `ffus_on_lines`, `unassigned` (list of tags), `lines_without_home_run`, `lines_without_finish`.

- [ ] **Step 1: Write the failing tests** in `test_extract_ffu_layout.py`.
  - **The fixture:** a `setUpClass` builds a synthetic one-page PDF with `fitz` in a `tempfile.TemporaryDirectory()`:
    - Six tagged FFU boxes using the made-up tag pattern, each drawn in the same style the extractor reads.
    - Line A: magenta, joining boxes 1→2→3. Box 1 has the thick green home-run outline and box 3 the thick blue finish outline.
    - Line B: the same magenta colour, not touching line A, joining 4→5. Box 4 is the home run and box 5 the finish.
    - Box 6 is on no line.
  - **The tests:**
    - `test_writes_header_in_order`: the CSV header equals the exact header above.
    - `test_same_colour_lines_split_by_connectivity`: two distinct Line ids, both with Line Colour `#FF00FF`.
    - `test_line_order_starts_at_home_run`: the tags of box 1, 2 and 3 have Line Order 1, 2 and 3. Home Run is `TRUE` only on box 1, and Finish is `TRUE` only on box 3.
    - `test_unassigned_ffu_keeps_position`: box 6 has a numeric X and Y and a blank Line, and `stats['unassigned'] == [tag6]`.
    - `test_grid_fields_parsed_from_tag`: Grid Column and Grid Row equal the tag's grid parts.
    - `test_missing_pdf_tags_exits_1`: a blank PDF makes the CLI exit with code 1.

- [ ] **Step 2: Run the tests and check they fail.**
  Run `python3 -m unittest scripts/ffu-layout/test_extract_ffu_layout.py -v`. Expected: an ImportError or failures.

- [ ] **Step 3: Implement `extract_ffu_layout.py`.**
  - Port the proof of concept into `extract()`, with an `argparse` CLI that wraps it and writes the CSV with `csv.DictWriter`.
  - Keep the tolerances as named constants at the top. Drop the JSON output and the grid-line geometry; the visual derives the grid itself.
  - Write `.gitignore` with `*.pdf` and `ffu_layout*.csv`.
  - Write the README:
    - the usage line;
    - "Run against your own copy of the drawing; never commit the PDF or its CSV";
    - the PyMuPDF install line.

- [ ] **Step 4: Run the tests and check they pass.**
  Same command. Expected: all OK.

- [ ] **Step 5: Run it against the user's real PDF, keeping the output outside the repo.**
  Run `python3 scripts/ffu-layout/extract_ffu_layout.py "/Users/noahgarrett/Downloads/FFU MAP.pdf" -o "$SCRATCH/ffu_layout.csv"`, where `$SCRATCH` is the session scratchpad.
  Expected: the counts match the proof of concept's `stats.json` in the same scratchpad folder (tags, lines, FFUs on lines and unassigned). Read only the count fields from it. Report only counts, never rows.

- [ ] **Step 6: Commit.**
  Run `git status` first to confirm no PDF or CSV is staged.
  ```bash
  git add scripts/ffu-layout
  git commit -m "feat: add FFU layout extraction script"
  ```

---

### Task 2: Table reader and index (`ffuMap.ts`)

**Files:**
- Create: `packages/qaqc-shared/src/ffuMap.ts`
- Create: `packages/qaqc-shared/src/__tests__/fixtures/syntheticFfu.ts`
- Test: `packages/qaqc-shared/src/__tests__/ffuMap.test.ts`

**Interfaces:**
- **Consumes:** `FieldSlot` and `InspectionTableSource` from `dataView.ts`.
- **Produces:**
```ts
export type FfuRole = 'tag' | 'x' | 'y' | 'line' | 'lineOrder' | 'lineColor' | 'homeRun' | 'finish'
  | 'gridColumn' | 'gridRow' | 'group' | 'zone' | 'rioPanel' | 'card' | 'channel' | 'node'
  | 'pwrPanel' | 'circuit' | 'energized'
export type FfuColumns = Record<FfuRole, number> // -1 when the slot is unbound
export const FFU_SLOTS: readonly FieldSlot<FfuRole>[] // slot names and columns from the spec table; column = layout CSV header or tracker header
export const REQUIRED_FFU_ROLES: ReadonlySet<FfuRole> // tag, x, y
export type FfuTableReadResult =
  | { kind: 'missing'; missing: FieldSlot<FfuRole>[] }
  | { kind: 'ready'; rows: ReadonlyArray<ReadonlyArray<unknown>>; columns: FfuColumns }
export function readFfuTable(table: InspectionTableSource | undefined): FfuTableReadResult
export type Energized = 'on' | 'off' | 'unknown'
export function parseEnergized(value: unknown): Energized
export interface FfuNode {
  row: number          // index into the table rows, used for selection IDs
  tag: string; x: number; y: number
  line: number         // index into FfuIndex.lines, -1 when on no line
  lineOrder: number    // 1-based position within its line after sorting, 0 when on no line
  homeRun: boolean; finish: boolean
  gridColumn: string; gridRow: string
  group: string; zone: string; rioPanel: string; card: string; channel: string; node: string
  pwrPanel: string; circuit: string
  energized: Energized
  hasTracker: boolean  // any tracker cell (group..energized) non-blank
  mismatch: boolean
}
export interface FfuLine {
  id: string; label: string; group: string; color: string // '' when no valid #RRGGBB was given
  nodes: number[]      // node indices in line order
  homeRun: number; finish: number // node index or -1
}
export interface GridAxis { labels: { label: string; at: number }[]; dividers: number[] }
export interface FfuIndex {
  nodes: FfuNode[]; lines: FfuLine[]
  gridColumns: GridAxis | null; gridRows: GridAxis | null
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null
  notPlaced: number
}
export function buildFfuIndex(rows: ReadonlyArray<ReadonlyArray<unknown>>, columns: FfuColumns): FfuIndex
```
- **Fixture:** `syntheticFfuTable(count: number): { columns: { roles: Record<string, boolean>; displayName: string }[]; rows: unknown[][] }`.
  - All 19 roles are bound.
  - It's deterministic, with no randomness: nodes sit on a grid laid out in snake-shaped lines of 47.
  - Energized cycles through on, off, on, on, …, with every 50th row having blank tracker cells.

- [ ] **Step 1: Write the failing tests** in `ffuMap.test.ts`, one behaviour each.
  - `readFfuTable lists Tag, X and Y as missing when unbound`, and returns `ready` with `-1` for unbound optional roles.
  - `parseEnergized` is table-driven over the Global Constraints values. `' yes '` gives `on`, while `'Maybe'`, `null` and `''` give `unknown`.
  - `places nodes from numeric strings`: `'803.03'` gives 803.03. Blank, `'abc'`, `NaN` and `Infinity` X or Y each add 1 to `notPlaced`. *(Review Focus 2)*
  - `blank tag is not placed; duplicate tag keeps the first row` (notPlaced 1).
  - `node with all tracker cells null has hasTracker false and energized unknown`. *(Review Focus 1)*
  - `orders line nodes by Line Order, then by row`. Home run and finish are the first node flagged with each.
  - `line group is the most common non-blank group; ties go alphabetically first`. The label is the group, or the Line id when no node has a group.
  - `flags a mismatch only when a node's non-blank group differs from its line group`.
  - `Line bound without Line Order draws no lines but keeps the nodes` (and the reverse). *(Review Focus 5)*
  - `invalid Line Colour leaves color empty`. `'#ff00ff'` is normalised to `'#FF00FF'`.
  - **Grid:**
    - `grid columns sorted by mean X, divider halfway between neighbour extents, label at bay centre`: bays `AA` with X 0–10 and `AB` with X 30–40 give divider 20 and labels at 5 and 35.
    - `single grid column has no dividers and one label`. *(Review Focus 3)*
    - The grid axis is `null` when its slot is unbound.
  - `bounds is null when nothing is placed`.

- [ ] **Step 2: Run the tests and check they fail.**
  Run `npx vitest run packages/qaqc-shared/src/__tests__/ffuMap.test.ts`. Expected: FAIL, because the module is missing.

- [ ] **Step 3: Implement `ffuMap.ts` and the fixture.**
  - Build the index in one O(N) pass plus one sort per line.
  - Read text cells as `String(value).trim()`, with `null` and `undefined` read as `''`.

- [ ] **Step 4: Run the tests and check they pass.**

- [ ] **Step 5: Commit.**
  `git commit -m "feat: read and index FFU map rows"`

---

### Task 3: Geometry and hit-testing (`ffuGeometry.ts`)

**Files:**
- Create: `packages/qaqc-shared/src/ffuGeometry.ts`
- Test: `packages/qaqc-shared/src/__tests__/ffuGeometry.test.ts`
- Test: `packages/qaqc-shared/src/__tests__/ffuMapBenchmark.test.ts`
- Modify: `packages/qaqc-shared/vitest.timing.config.ts` (add the benchmark to `TIMING_TESTS`)

**Interfaces:**
- **Consumes:** `FfuIndex` and `FfuNode` from Task 2.
- **Produces:**
```ts
export interface View { scale: number; offsetX: number; offsetY: number } // screen = world * scale + offset
export interface Size { width: number; height: number }
export const FIT_PADDING_PX = 24
export const MAX_SCALE_FACTOR = 60   // max scale = fit scale * 60
export const MIN_SCALE_FACTOR = 0.5  // min scale = fit scale * 0.5
export function fitView(bounds: FfuIndex['bounds'], size: Size): View // null bounds or zero size → { 1, 0, 0 }; zero-extent bounds centre the point at scale 1
export function zoomAt(view: View, factor: number, sx: number, sy: number, fitScale: number): View // keeps (sx, sy) fixed, clamps scale
export function toWorld(view: View, sx: number, sy: number): { x: number; y: number }
export function nodeSizeOf(index: FfuIndex): number // 0.7 × median nearest-neighbour distance, min 1; 10 when fewer than 2 nodes
export interface HitGrid { nodeAt(x: number, y: number, tolerance: number): number; lineAt(x: number, y: number, tolerance: number): number } // -1 when none
export function buildHitGrid(index: FfuIndex, nodeSize: number): HitGrid
```

- [ ] **Step 1: Write the failing tests.**
  - `fitView centres bounds with padding`: bounds 0–100 × 0–50 in a 224×124 viewport give scale 2 and offset (12, 12).
  - `fitView handles a single point and an empty index` without NaN. *(Review Focus 3)*
  - `zoomAt keeps the cursor's world point fixed` and `clamps to fit × 60 and fit × 0.5`.
  - `nodeSizeOf is 0.7 × median nearest-neighbour distance`: nodes spaced 10 apart give 7.
  - `nodeAt returns the node whose square contains the point, -1 just outside half-size + tolerance`. Where two nodes overlap, the nearest centre wins.
  - `lineAt returns the line whose segment passes within tolerance, nearest first, -1 otherwise`.
  - **Benchmark,** in `ffuMapBenchmark.test.ts` using `bestOf(TIMING_RUNS, …)` on `syntheticFfuTable(30000)`:
    - `readFfuTable`, then `buildFfuIndex`, `nodeSizeOf` and `buildHitGrid` together, under 250 ms;
    - 10,000 `nodeAt` and `lineAt` calls under 50 ms.

- [ ] **Step 2: Run the tests and check they fail.**
  Run `npx vitest run packages/qaqc-shared/src/__tests__/ffuGeometry.test.ts`.

- [ ] **Step 3: Implement the module.**
  - **Hit grid:** uniform buckets with cell size `nodeSize * 2`.
  - **Nodes:** each node goes in its own bucket.
  - **Segments:** each segment between consecutive line nodes goes in every bucket its bounding box touches.
  - **Nearest neighbour:** use the same bucket idea, searching neighbouring cells outward until a candidate is found.

- [ ] **Step 4: Run both test files and check they pass.**
  - `npx vitest run packages/qaqc-shared/src/__tests__/ffuGeometry.test.ts`
  - `npx vitest run --project qaqc-shared-timing`

- [ ] **Step 5: Commit.**
  `git commit -m "feat: add FFU map view transform and hit-testing"`

---

### Task 4: Filters, summary and search (`ffuFilters.ts`)

**Files:**
- Create: `packages/qaqc-shared/src/ffuFilters.ts`
- Test: `packages/qaqc-shared/src/__tests__/ffuFilters.test.ts`

**Interfaces:**
- **Consumes:** `FfuIndex`, `FfuNode` and `Energized` from Task 2.
- **Produces:**
```ts
export interface FfuFilters { zone: string | null; group: string | null; rioPanel: string | null; energized: Energized | null }
export const NO_FILTERS: FfuFilters
export function effectiveGroup(index: FfuIndex, node: FfuNode): string // node.group, else its line's group, else ''
export function nodeMatches(index: FfuIndex, node: FfuNode, filters: FfuFilters): boolean
export function matchMask(index: FfuIndex, filters: FfuFilters): Uint8Array // 1 = matches; line drawn in colour when any of its nodes match
export interface FfuSummary { total: number; energized: number; deEnergized: number; percentEnergized: number | null; noTracker: number; groups: number; mismatches: number; notPlaced: number }
export function summarize(index: FfuIndex, mask: Uint8Array): FfuSummary
export interface FilterOptions { zones: string[]; groups: string[]; rioPanels: string[] } // distinct non-blank, natural sort ('G2' before 'G10')
export function filterOptions(index: FfuIndex): FilterOptions
export const SEARCH_LIMIT = 8
export function searchTags(index: FfuIndex, query: string): number[] // node indices; case-insensitive substring; prefix matches first, then alphabetical; '' → []
```

- [ ] **Step 1: Write the failing tests.**
  - `no filters match every node`.
  - `filters combine with AND`.
  - `group filter matches on effective group` (a node with a blank group matches through its line's group).
  - `summary counts only matching nodes`:
    - `percentEnergized` = energized ÷ total × 100;
    - `null` when total is 0;
    - `groups` counts distinct lines with at least one match;
    - `notPlaced` is passed through from the index.
  - `noTracker counts nodes with hasTracker false`.
  - `filterOptions sorts naturally and drops blanks`.
  - `searchTags puts prefix matches first and caps at 8`.
  - `searchTags ignores case and trims`.

- [ ] **Step 2: Run the tests and check they fail.**
  Run `npx vitest run packages/qaqc-shared/src/__tests__/ffuFilters.test.ts`.

- [ ] **Step 3: Implement the module.**
  For the natural sort, use `Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })`.

- [ ] **Step 4: Run the tests and check they pass.**

- [ ] **Step 5: Commit.**
  `git commit -m "feat: add FFU map filters, summary and search"`

---

### Task 5: Canvas renderer (`ffuMapCanvas.ts`)

**Files:**
- Create: `packages/qaqc-shared/src/ffuMapCanvas.ts`
- Test: `packages/qaqc-shared/src/__tests__/ffuMapCanvas.test.ts`

**Interfaces:**
- **Consumes:**
  - `FfuIndex` (Task 2);
  - `View`, `Size` and `nodeSizeOf` (Task 3);
  - the `matchMask` output (Task 4);
  - `contrastRatio` from `theme.ts`.
- **Produces:**
```ts
export interface FfuMapColors { good: string; bad: string; unknown: string; dim: string; ink: string; muted: string; accent: string; grid: string; card: string; palette: readonly string[] }
export function ffuMapColorsFromTheme(theme: ResolvedTheme): FfuMapColors // unknown = faint, dim = border, grid = hairline, palette = 12 fixed hues
export const LINE_MIN_CONTRAST = 2.5
export function readableLineColor(color: string, background: string): string // mixes toward black in 10% steps until contrastRatio ≥ 2.5 (max 10 steps)
export const LABEL_MIN_NODE_PX = 36 // tag labels drawn when nodeSize * scale ≥ 36
export interface DrawState {
  view: View; size: Size; nodeSize: number; mask: Uint8Array
  hoverLine: number; selected: ReadonlySet<number>; selectedLine: number // -1 when none
  colors: FfuMapColors
}
export function lineColorOf(index: FfuIndex, line: number, colors: FfuMapColors): string // readable line colour, else palette[line % 12]
export function drawFfuMap(ctx: CanvasRenderingContext2D, index: FfuIndex, state: DrawState): void
```
- **Draw order:**
  1. The grid dividers, as hairlines.
  2. Lines: dimmed lines first, then lines in colour, then the hovered or selected line at twice the width.
  3. Nodes: squares of `nodeSize` filled by status, or `dim` when masked out.
  4. Home-run and finish markers: an outlined square at 1.6 × node size, in `ink`.
  5. Selected nodes: an `accent` 2 px ring.
  6. Tag labels, when zoomed in far enough.
  7. Grid labels pinned to the top and left edges, on a `card` backing.
- **Culling:** skip nodes and segments outside the viewport plus a one-node margin.

- [ ] **Step 1: Write the failing tests,** using a recording fake context (an object that records `fillStyle` per `fillRect` call and counts `fillText`).
  - `readableLineColor darkens a lime line on white to contrast ≥ 2.5 and leaves a dark line unchanged`.
  - `masked-out nodes are filled with the dim colour; matching nodes with good, bad or unknown`.
  - `nodes outside the viewport are not drawn` (the number of `fillRect` calls equals the visible count).
  - `tag labels are drawn only at or above LABEL_MIN_NODE_PX`.
  - `lineColorOf falls back to the palette when the colour is empty`.

- [ ] **Step 2: Run the tests and check they fail.**
  Run `npx vitest run packages/qaqc-shared/src/__tests__/ffuMapCanvas.test.ts`.

- [ ] **Step 3: Implement the renderer.**
  - The caller sets the device-pixel-ratio transform; the renderer works in CSS pixels.
  - Batch each colour into one `beginPath` and one `fill` or `stroke` where possible. In that case the node-count test should count path rects instead of `fillRect` calls; adjust the fake to record `rect` calls.

- [ ] **Step 4: Run the tests and check they pass.**

- [ ] **Step 5: Commit.**
  `git commit -m "feat: draw the FFU map on canvas"`

---

### Task 6: Dashboard component

**Files:**
- Create: `packages/qaqc-shared/src/components/FfuMapDashboard.tsx`
- Create: `packages/qaqc-shared/src/components/FfuDetailPanel.tsx`
- Modify: `packages/qaqc-shared/src/qaqc.less` (add the `.qaqc-ffu-*` rules)
- Test: `packages/qaqc-shared/src/__tests__/FfuMapDashboard.test.tsx`

**Interfaces:**
- **Consumes:**
  - Tasks 2–5;
  - `StatusPanel`, `LoadingBar` and `useElementSize` from qaqc-shared;
  - `TooltipHandler` from `chartTypes.ts`;
  - `ResolvedTheme`.
- **Produces:**
```ts
export interface FfuMapDashboardProps {
  title: string; icon: LucideIcon; theme: ResolvedTheme; interactive: boolean; loading: boolean
  index: FfuIndex
  dataVersion: number                 // bumps on every data update; resets selection, panel, search and view
  onSelect: (nodes: number[], multi: boolean) => void // node indices
  onClear: () => void
  onHover: TooltipHandler
}
export function FfuMapDashboard(props: FfuMapDashboardProps): ReactElement
```
- **Layout:**
  - **Header:** the title, the search combobox (`role="combobox"`, a listbox of up to 8 tags), then the Zone, Group, RIO Panel and Energized `<select>`s. Each select's first option is "All".
  - **Summary strip:** compact stat items for Total FFUs, Energized (with %), De-energized, No tracker row, Groups, Group mismatches, and Not placed (only when above 0).
  - **Map and panel:** the canvas fills the remaining height. Zoom in, zoom out and fit buttons sit in the corner, using lucide `ZoomIn`, `ZoomOut` and `Maximize`. The panel is on the right when open.
- **Interaction:**
  - **Scroll:** `zoomAt` with a factor of 1.2 per wheel notch, centred on the cursor.
  - **Drag:** pans, once the pointer has moved more than 3 px from where it went down.
  - **Click:**
    - **On a node:** selects it and opens the node panel.
    - **Off a node but on a line:** selects the line's nodes and opens the group panel.
    - **On empty space:** calls `onClear` and closes the panel.
    - **Ctrl or Meta held:** adds to the current selection; the panel shows the last item clicked.
  - **Hover:** a node calls `onHover` with title = tag, rows Group, Energized (Energized / De-energized / Unknown) and Line position (`#k of n`), and sets the hover line. Leaving calls `onHover(null)`.
  - **Esc:** clears, the same as clicking empty space.
  - **Choosing a search result:** zooms to `nodeSize * scale = LABEL_MIN_NODE_PX * 1.5` centred on the node, then selects it.
  - **`interactive` false:** pointer selection and the filter controls are disabled, but zoom still works.
- **Panels** (`FfuDetailPanel.tsx`):
  - **Node panel:** a `<dl>` with Tag, FFU Group, Shutdown Zone, RIO Panel, Card, Channel, Node, PWR Panel, Circuit # and Energized (blank shows `—`), then Line position, Home run tag and Finish tag.
    - With `hasTracker` false it shows a "No tracker row" note.
    - With `mismatch` true it shows "Group differs from its line (<line group>)".
  - **Group panel:** the label, energized/total, the mismatch count, and a list of the de-energized tags as buttons. Clicking one selects that node and opens its node panel.
  - **Both panels:** a close button (lucide `X`).
- **States:**
  - An index with no nodes and `notPlaced` 0 shows `StatusPanel` "No FFUs to show".
  - No nodes but `notPlaced` above 0 shows "No FFUs could be placed", listing `${notPlaced} rows have a blank tag or a missing X or Y`.

- [ ] **Step 1: Write the failing tests** with the existing `render.tsx` helper and `syntheticFfuTable(200)`.
  - `summary strip shows totals for the unfiltered index`.
  - `choosing a zone filter updates the summary but keeps every node drawn` (assert on the `drawFfuMap` call through a `vi.mock` passthrough recording `state.mask`).
  - `clicking a node calls onSelect with that node and opens its panel`. Stub `getBoundingClientRect` and compute the click point from the node's world position through the view.
  - `ctrl-click adds to the selection (multi true)`.
  - `clicking a line between nodes selects the whole line and opens the group panel`.
  - `clicking empty space and pressing Esc both call onClear and close the panel`.
  - `a de-energized tag in the group panel opens that node's panel`.
  - `search lists up to 8 matches and choosing one selects it`.
  - `a dataVersion change clears the selection and closes the panel`. *(Review Focus 4)*
  - `non-interactive mode disables selection`.
  - `empty and unplaceable states render their status panels`.

- [ ] **Step 2: Run the tests and check they fail.**
  Run `npx vitest run packages/qaqc-shared/src/__tests__/FfuMapDashboard.test.tsx`.

- [ ] **Step 3: Implement the component.**
  - **Memoisation:** `matchMask` on `(index, filters)`, and `nodeSizeOf`, `buildHitGrid` and `filterOptions` on `index`.
  - **Redraws:** redraw in `requestAnimationFrame` whenever the view, size, mask, hover or selection changes.
  - **Canvas size:** backing size = CSS size × `devicePixelRatio`, capped at 4096 px per side.
  - **Styling:** add `.qaqc-ffu-*` rules in `qaqc.less`, reusing the existing tokens (`--qaqc-card`, `--qaqc-border` and so on).

- [ ] **Step 4: Run the tests and check they pass.**
  Also run `npx vitest run packages/qaqc-shared` to confirm nothing else broke, including `theme.test.ts` stylesheet checks.

- [ ] **Step 5: Commit.**
  `git commit -m "feat: add FFU map dashboard"`

---

### Task 7: Power BI package `qaqc-ffu-map`

**Files:**
- Create the package by mirroring `packages/qaqc-performance`:
  - `packages/qaqc-ffu-map/{package.json,pbiviz.json,capabilities.json,tsconfig.json,vitest.config.ts}`
  - `packages/qaqc-ffu-map/scripts/ensure-api.cjs`, `style/visual.less`, `stringResources/en-US/resources.resjson`
  - `packages/qaqc-ffu-map/assets/icon.png`
  - `packages/qaqc-ffu-map/src/{visual.ts,settings.ts}`
  - `packages/qaqc-ffu-map/dev/{index.html,main.tsx,vite.config.ts,vite-env.d.ts}`
- Test: `packages/qaqc-ffu-map/src/__tests__/{visual.test.ts,settings.test.ts,tableDataView.ts}`

**Interfaces:**
- **Consumes:** `readFfuTable`, `buildFfuIndex`, `FFU_SLOTS` (Task 2) and `FfuMapDashboard` (Task 6).
- **Produces:** `QaqcFfuMapVisual`.

- [ ] **Step 1: Write the failing tests** in `visual.test.ts`, following `qaqc-performance/src/__tests__/visual.test.ts`.
  - `renders the setup panel listing FFU Tag → FFU Tag, X → X, Y → Y when unbound`.
  - `capabilities declare the 19 roles in FFU_SLOTS order, a table mapping, and window count 30000`.
  - `pbiviz name, display name, class and version are qaqcFfuMap, QCx FFU Map, QaqcFfuMapVisual, 1.0.0.0`.
  - `selecting nodes calls selectionManager.select with the withTable selection ID of each node's row, multi passed through`.
  - `onClear calls selectionManager.clear`.
  - `indexes once per data update, not on resize`.
  - `render errors report renderingFailed and show the failure panel`.
  - `a data update bumps dataVersion`.
  - `settings.test.ts`: the preset, background and card opacity defaults match `qaqc-performance`.

- [ ] **Step 2: Run the tests and check they fail.**
  Run `npx vitest run --project qaqc-ffu-map`.

- [ ] **Step 3: Implement the package.**
  - **`capabilities.json`:**
    - One Grouping data role per slot in `FFU_SLOTS`, each with `displayName`, `displayNameKey`, `description` and `descriptionKey`.
    - A table mapping (`rows.select` of every role) with `dataReductionAlgorithm.window.count: 30000`.
    - `privileges: []`.
    - The same `objects` as Performance for colours, card settings and animation, minus any minimums.
  - **`visual.ts`:** mirror `QaqcPerformanceVisual`, including the segment fetch loop, theme, context menu and failure state. The differences:
    - Keep `selectionIds: powerbi.visuals.ISelectionId[]`, built once per data update with `host.createSelectionIdBuilder().withTable(dataView.table, row).createSelectionId()`.
    - `onSelect` maps node indices to `index.nodes[i].row`, then to the IDs, and calls `selectionManager.select(ids, multi)`.
    - Increment `dataVersion` on each data update.
    - Use title `QCx FFU Map` and icon lucide `Map` (check that it exists in lucide-react 1.24.0, otherwise use `MapPinned`).
    - The setup panel reads "Add the FFU layout and tracker columns", with message "Drag the columns into the matching field slots. See QCx_FFU_Map_SETUP.md." and items `${slot.column} → ${slot.slot}`.
  - **Icon:** `node ../../scripts/make-qaqc-icon.mjs assets/icon.png map` (the `icon` npm script).
  - **Dev harness:** renders `FfuMapDashboard` from `syntheticFfuTable(Number(params.get('n') ?? 6000))`, never real data.

- [ ] **Step 4: Run the tests and the build.**
  - `npx vitest run --project qaqc-ffu-map`: expected PASS.
  - `npm run build -w @pbi/qaqc-ffu-map`: expected a `.pbiviz` in `dist/`, plus `[verify] ok`.
  - `npm run typecheck`: expected zero errors.
  - `npm run review:business`: expected no errors for `qaqcFfuMap`.

- [ ] **Step 5: Commit.**
  `git commit -m "feat: add QCx FFU Map visual package"`

---

### Task 8: Setup guide, packaging and visual check

**Files:**
- Create: `LotusWorks_Package/QCx_FFU_Map_SETUP.md`
- Create: `Business_Package/QCx_FFU_Map_SETUP.md` (identical)

- [ ] **Step 1: Write the setup guide.** It covers, in order:
  1. Running the script on your own copy of the PDF, with the IP note.
  2. Loading `ffu_layout.csv` (with X and Y typed as Decimal Number) and the Master FFU Tracker.
  3. Creating a one-to-one relationship on FFU Tag ↔ FFU Tag Name, with cross filter direction Both.
  4. The slot table from the spec.
  5. What grey, red and green mean, plus No tracker row, Not placed and Mismatch.
  6. Updating when the drawing changes: re-run the script, then refresh.

- [ ] **Step 2: Run the full checks.**
  - `npm test`: all projects pass, including `qaqc-shared-timing`.
  - `python3 -m unittest scripts/ffu-layout/test_extract_ffu_layout.py`
  - `npm run qa:business`: zero errors.

- [ ] **Step 3: Do a visual check locally with the real layout.**
  - Load the Task 1 scratchpad CSV into the dev harness through a local-only query parameter path. Add `?file=` support that reads the CSV with `fetch` from a vite `server.fs.allow` scratch path; this is dev only and isn't bundled.
  - Screenshot these states into the scratchpad only:
    - fit;
    - zoomed in with labels;
    - hover;
    - a node selected;
    - a line selected;
    - Zone filter dimming;
    - search.
  - Check:
    - lines join node centres;
    - no line is lost against the background;
    - grid labels are readable and pinned to the edges;
    - the panel doesn't overlap the corner controls;
    - fit frame time is under 16 ms (measure with `performance.now()` around `drawFfuMap` in the harness, behind `?debug=1`).
  - Then run the synthetic dataset at `?n=30000` and confirm the frame time is under 16 ms there too.

- [ ] **Step 4: Sync and confirm nothing from the drawing leaked.**
  - Run `npm run package:business`.
  - Run `git status --short`. Expected: no PDF or CSV staged.
  - Run `grep -rIhoE "FFU[0-9]{3}-[A-Z]{2}[0-9]{2}-[A-Z][0-9]{2}-[A-Z]" --exclude-dir=node_modules . | grep -v "^FFU900" | head`. Expected: empty, because only the synthetic `FFU900` tags exist in the repo.

- [ ] **Step 5: Commit.**
  ```bash
  git add LotusWorks_Package/QCx_FFU_Map_SETUP.md Business_Package/QCx_FFU_Map_SETUP.md LotusWorks_Package/qaqcFfuMap_*.pbiviz Business_Package/qaqcFfuMap_*.pbiviz
  git commit -m "chore: package QCx FFU Map 1.0.0 with setup guide"
  ```
