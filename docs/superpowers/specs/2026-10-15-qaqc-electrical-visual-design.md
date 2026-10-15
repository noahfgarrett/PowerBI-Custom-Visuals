# QAQC Electrical Inspections Visual — Design

## Scope

This is the first of the QAQC Power BI custom visuals ported from the QAQC Weekly Report Dashboard (HTML app, v1.3.4, repo `noahfgarrett/qaqc-weekly-report-dashboard`). It covers two packages:

- `packages/qaqc-shared`: shared work-week logic, inspection rules, theme, and React chart components.
- `packages/qaqc-electrical`: the Electrical Inspections visual (`.pbiviz`).

Later visuals reuse `qaqc-shared`, and each gets its own spec: Mechanical (same layout as Electrical), Welding, Issues (with an Issue Detail view behind a button), and Overview (totals across all sheets, this WW vs previous WW, combined Mechanical + Electrical charts). They are out of scope here.

All logic lives inside the visual. The user connects the Smartsheet Electrical Inspection Log in Power BI, drags the named columns into the field slots, and the visual computes everything.

## Look and feel

The visual matches the QAQC HTML app's design (`DESIGN.md` in that repo), not the other visuals in this repo. It is a light, white, professional data tool. Icons are lucide-react; no emoji anywhere.

The HTML app's OAC and Justine reporting modes do not exist in the visual.

## Architecture

### Packages

```
packages/
  qaqc-shared/                no pbiviz.json, so the sync scripts skip it (like core/)
    src/workWeeks.ts          ported from the HTML app's src/utils/workWeeks.ts
    src/inspections.ts        row normalization, Final/SOR/issue rules, Electrical model
    src/theme.ts              presets + fixed status colors
    src/qaqc.css              design tokens and component styles
    src/components/           KpiCard, WorkWeekPicker, RangeToggle, ChartPanel,
                              StackedBarChart, LineChart, HorizontalBarChart, EmptyState
    src/__tests__/
  qaqc-electrical/
    capabilities.json         field slots, Format pane objects, data reduction
    pbiviz.json               stable GUID, version bumped on every build
    src/visual.ts             Power BI adapter (IVisual), mounts the React root
    src/ElectricalDashboard.tsx
    dev/                      Vite preview harness rendering the dashboard from the fixture
```

`qaqc-shared` has no Power BI dependency, so it can be unit-tested and previewed in a plain browser.

### Dependencies

The packages use the repo's existing Power BI tooling (`powerbi-visuals-tools` 5.6.0, `powerbi-visuals-api` 5.3.0, `powerbi-visuals-utils-formattingmodel` 6.x). New dependencies, approved by the user: `react`, `react-dom`, and `lucide-react`. They are pinned to exact versions matching the QAQC app's lockfile.

### Data flow

On every Power BI `update()`:

1. The adapter reads the table data view and maps columns by **role**, not by column name.
2. It validates the slots. If any required slot is missing, it renders the setup state.
3. It normalizes rows: trims text, parses the work week, and normalizes phase case.
4. `buildElectricalModel(rows, selectedWeek, range, today)` returns everything the UI needs. It is a pure, tested function.
5. React renders `<ElectricalDashboard>` with the model, settings, and callbacks.

The selected work week and the range toggle are React state inside the visual. They are not saved into the report. On open they default to the current WW and "30 WW". When data refreshes, the selected week is kept if it still exists.

### Data volume

The table mapping uses `dataReductionAlgorithm: { window: { count: 30000 } }`. When Power BI reports more rows, the visual calls `fetchMoreData()` until all segments load, and shows a thin loading bar meanwhile.

## Field slots

| Slot (role) | User's column | Required |
|---|---|---|
| Work Week | Work Week Observed | yes |
| Inspection Phase | Inspection Phase | yes |
| Issue? | Issue? | yes |
| Building | Building | yes |
| Row ID | Index column added in Power Query | no |

Without a Row ID, Power BI merges rows that are identical across the bound columns. The visual shows a small footnote recommending the Index column when the Row ID slot is empty.

## Rules

- **Work week:** parsed with the HTML app's `parseWorkWeek` (accepts `WW42'2026`, `WW 42 - 2026`, `Week 42 2026`, two-digit years). Weeks are ISO weeks. A week number that does not exist in its year (e.g. `WW53'2025`) is unreadable. Rows with an unreadable work week are skipped, and a footnote shows the count.
- **Current week:** the ISO week of today's date at render time.
- **Final:** phase equals `final` (case-insensitive, trimmed), starts with `final `, or contains `final inspection`.
- **SOR:** phase contains `sor` (case-insensitive).
- **Other phases** (N/A, Pressure Test, blank, etc.) are not counted anywhere.
- **Issue found:** a **Final** row whose `Issue?` is not blank and not `No Issue Found` (case-insensitive). SOR rows never count as issues.
- **Future rows:** rows with a work week after the current week are excluded from the dropdown, to-date totals, and charts.

## Layout

The visual is designed to fill a full report page (about 1280×720).

```
┌───────────────────────────────────────────────────────────────────────┐
│ [Zap] Electrical Inspections            [30 WW | All]  [WW42'2026 ▾]  │
├───────────────────────────────────────────────────────────────────────┤
│ WW42'2026                          │ Project to date                  │
│ [Finals] [SORs] [Issues Found]     │ [Finals] [SORs] [NCR Pass Rate]  │  ≤ ~15% height
├────────────────────────────────────┬──────────────────────────────────┤
│ Finals + SORs by Work Week         │ NCR Pass Rate Trend              │
│ (≈ 2/3 width, full chart height)   ├──────────────────────────────────┤
│                                    │ Inspections by Building          │
└────────────────────────────────────┴──────────────────────────────────┘
  footnotes (skipped rows, Row ID hint) in small muted text when needed
```

- The cards sit in **one compact row at the top** and take at most about 15% of the visual height.
- Under about 900px wide, everything stacks into one column. Under about 420px tall, only the header and cards show.

### Header

- A lucide `Zap` icon and the title "Electrical Inspections".
- **Range toggle:** `30 WW | All`, a segmented control.
- **Work week dropdown:** lists weeks from the earliest week in the data to the current week, newest first.

## Cards

*W* is the selected week. *W−1* is the ISO week before it.

| Group | Card | Value | Sub-line |
|---|---|---|---|
| This WW | Final Inspections | Finals in W | change vs W−1 |
| This WW | SORs | SORs in W | change vs W−1 |
| This WW | Issues Found | Finals with an issue in W | change vs W−1 |
| Project to date | Finals to Date | Finals with week ≤ W | `+n this WW` |
| Project to date | SORs to Date | SORs with week ≤ W | `+n this WW` |
| Project to date | NCR Pass Rate | clean Finals ÷ Finals with week ≤ W | `236 / 238 Finals`, change in points vs through W−1 |

- The "This WW" group is labeled with the selected week (e.g. `WW42'2026`). "Project to date" is labeled `Through WW42'2026`.
- Deltas are muted gray, with two exceptions: Issues Found going up is **warn amber**, and NCR Pass Rate going down is **bad red**. NCR Pass Rate going up is **good green**.
- With zero Finals, NCR Pass Rate shows `—`.

## Charts

**Window:** with the toggle on "30 WW", the window is the 30 weeks ending at the window end (W after a dropdown pick; see bar click below), starting no earlier than the first week in the data. With "All", it runs from the first week in the data to W. Every week in the window appears, including weeks with no rows (zero-height bars). Axis labels thin out so they never overlap, and W is always labeled.

### Finals + SORs by Work Week (large)

- Stacked bars: Finals on the bottom (series 1 color), SORs on top (series 2 color).
- A marker dot above the bar on weeks with at least one issue found (NCR marker color).
- The selected week's column is shaded with the accent color at low opacity.
- Hover shows a Power BI tooltip: work week, Finals, SORs, Issues Found.
- **Clicking a bar selects that week.** The dropdown and the "This WW" cards update, and the "Project to date" cards recompute through that week. The chart window stays where it is, so the clicked bar doesn't jump; the window end only changes when a week is picked from the dropdown. Internally, the selected week and the window end are separate pieces of state: the dropdown sets both, and a bar click sets only the selected week.

### NCR Pass Rate Trend (small)

- A line with one point per week: the cumulative NCR pass rate through that week (counting all Finals since the first week, not only those in the window).
- Dots in the NCR marker color on weeks with an issue found.
- The y-axis zooms automatically: lower bound is the window minimum rounded down to the nearest whole percent, minus 1 point, and never below 0. The upper bound is 100%.
- Hover tooltip: work week, pass rate, `clean / total Finals`.

### Inspections by Building (small)

- Horizontal bars per building for rows in the window, split into Finals and SORs, sorted by total, descending.
- Top 8 buildings shown. The remainder is grouped as `Other (n buildings)`. A blank building shows as `Unspecified`.
- Hover tooltip: building, Finals, SORs.

## Format pane

| Card | Setting | Default |
|---|---|---|
| Colors | Preset: QAQC / Ivory / LotusWorks / Grayscale | QAQC |
| Background | Background opacity (0–100%) | 100 |
| Background | Card opacity (0–100%) | 100 |

- **Background opacity** applies to the area behind the cards and charts. **Card opacity** applies to the card and chart panel fills. Borders stay visible at 0%.

### Presets

| Preset | Page | Card | Text | Accent | Series 1 (Finals) | Series 2 (SORs) | NCR marker |
|---|---|---|---|---|---|---|---|
| QAQC | `#EDF1F6` | `#FDFEFF` | `#1B2530` | `#2E5AAC` | `#2E5AAC` | `#86B6EF` | `#B45309` |
| Ivory | `#F7F8FA` | `#FFFFFF` | `#00325B` | `#0071C5` | `#0071C5` | `#9CCBEE` | `#B45309` |
| LotusWorks | `#F3F5F8` | `#FFFFFF` | `#003459` | `#E85D04` | `#003459` | `#0077B6` | `#E85D04` |
| Grayscale | `#F2F2F2` | `#FFFFFF` | `#1E1E1E` | `#3A3A3A` | `#3A3A3A` | `#A6A6A6` | `#000000` |

- Each preset also defines border and muted text colors, taken from the preview mockups.
- **Status colors are fixed across every preset:** good / closed `#0A7A0A`, bad / opened `#D03B3B`, warn `#B45309`. Later visuals use the same rule (closed issues green, opened issues red).

## Error and empty states

| Situation | Shown |
|---|---|
| Required slot empty | A setup card listing each missing slot by name, with a lucide icon |
| No rows after report filters | Cards show 0; each chart shows "No inspections match the current filters" |
| Unreadable work weeks | Footnote: `n rows skipped: unreadable work week` |
| Row ID slot empty | Footnote recommending an Index column |
| More than 30,000 rows | Thin loading bar until all segments load |
| High-contrast mode | Colors switch to the host's high-contrast foreground and background |

## Performance

These visuals must stay fast and polished with very large logs. Targets are measured on the dev Mac with a production build:

| Operation | Data size | Target |
|---|---|---|
| Normalize + aggregate on data update | 100,000 rows | < 150 ms |
| Normalize + aggregate on data update | 500,000 rows | < 750 ms |
| Change selected week, range toggle, or bar click | any size | < 16 ms model work, one React render |
| Resize | any size | no layout thrash; at most one render per animation frame |

How the design meets them:

- **Aggregate once per data update.** One pass over the rows builds a per-week index: for each work week, counts of Finals, SORs, and issues found, plus per-building counts. Raw rows are never touched again until Power BI sends new data.
- **Interactions read only the index.** Selecting a week, toggling the range, or clicking a bar recomputes from the per-week index (at most a few hundred weeks), never from rows. To-date totals use cumulative sums over the sorted weeks.
- **Charts draw aggregates, not rows.** SVG element counts are bounded by weeks in the window plus top-8 buildings, so the chart size is independent of row count. In "All" mode with hundreds of weeks, bar width shrinks to a 2px minimum and labels thin out.
- **Memoization.** The index is keyed on the Power BI data view identity. The view model is memoized on index, selected week, window end, range, and settings.
- **Incremental loading.** `fetchMoreData` appends segments to an accumulating buffer and rebuilds the index once all segments arrive. The loading bar shows progress and the previous render stays visible meanwhile.
- **Resize** goes through a `requestAnimationFrame`-throttled handler. Size-dependent layout is computed from the latest viewport only.
- **No per-row React components and no per-row DOM nodes**, anywhere.

A benchmark test generates synthetic logs of 100,000 and 500,000 rows and asserts the aggregation targets (with headroom for CI variance). The same synthetic data is also loaded in the browser preview to check interaction smoothness and the "All" range with several years of weeks.

## Power BI integration

These satisfy the repo's `review:business` gate, with zero warnings as the target:

- **Selection manager** for the right-click context menu (`showContextMenu`).
- **Host tooltip service** for chart hovers, with `supportEnhancedTooltips: true`.
- **High-contrast** handling via `colorPalette.isHighContrast`.
- An explicit **empty state**.
- A **`dataReductionAlgorithm`** in `capabilities.json`.

Clicking a bar changes the visual's own selected week. It does not cross-filter other visuals.

## Testing

1. **Unit tests** (Vitest, `packages/qaqc-shared/src/__tests__/`):
   - Work-week parsing, ISO week of a date, WW52'2026 → WW53'2026 → WW01'2027, rejecting `WW53'2025`.
   - Final, SOR, and issue rules, including case and whitespace variants.
   - The Electrical model against a fixture built from the real export: only the Work Week, Inspection Phase, Issue?, and Building columns, with no names. Expected values for WW42'2026: 3 Finals, 3 SORs, 0 Issues Found. Through WW42'2026: 238 Finals, 48 SORs, NCR pass rate 236/238 (99.2%).
   - Window logic: 30 WW vs All, short history, empty weeks, future rows.
   - Performance benchmark: synthetic 100,000- and 500,000-row logs against the targets in Performance.
2. **Browser preview** (`npm run dev` in `qaqc-electrical`): the dashboard rendered from the fixture. Screenshots are checked at 1280×720 for each preset, both opacity sliders at 0, a narrow tile, the setup state, the empty state, the All range, and a bar click.
3. **Build gate:** `npm run typecheck`, the package build, `npm run review:business` with zero warnings, then sync to `Business_Package/` and `LotusWorks_Package/`, and a dated zip in `releases/`.
4. **User smoke test** in Power BI Desktop on the work laptop. Power BI Desktop is Windows-only, so it can't run on the dev Mac.

## Delivery

- A one-page setup guide shipped with the package: add an Index column in Power Query, bind each column to its slot, import the `.pbiviz`.
- Updates: re-import the new `.pbiviz` in each report. The GUID stays fixed and the version increases, so re-importing upgrades in place.
- When all QAQC visuals are done, the zipped package is emailed to the user (confirmed with them before sending).
- Work happens on the `feat/qaqc-electrical` branch, based on `chore/visual-package-updates` (the previously uncommitted visual work, committed on its own branch).
