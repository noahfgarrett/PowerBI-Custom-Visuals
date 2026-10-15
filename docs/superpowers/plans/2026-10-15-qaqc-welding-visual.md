# QAQC Welding Visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `packages/qaqc-welding` (`.pbiviz`) per `docs/superpowers/specs/2026-10-15-qaqc-welding-visual-design.md`, reusing `qaqc-shared` and making the chart expansion reusable across dashboards.

**Architecture:** Pure model functions (`welds.ts`) feed a `WeldingDashboard` React component built from shared pieces (`KpiCard`, `KpiGroup`, `ChartPanel`, `ExpandedPanel`, the new expansion host) plus three new charts. The per-package layer (`visual.ts`, `settings.ts`, `capabilities.json`, strings, icon) follows the Electrical/Mechanical packages exactly, with welding field slots.

**Branch:** `feat/qaqc-welding` in `/Users/noahgarrett/Codebase/PowerBI`.

---

## Conventions

- Conventions in `docs/superpowers/plans/2026-10-15-qaqc-electrical-visual.md` lines 17–39 apply: imports, no `any`, explicit return types, `ReactElement` returns, no em dashes in UI copy, and no runtime `powerbi-visuals-api` enums. The review-gate facts there apply too.
- Use TDD for every behavior.
- After every task, run:
  - `npx vitest run --project qaqc-shared --project qaqc-electrical --project qaqc-mechanical` (plus `--project qaqc-welding` once it exists), with 0 "not wrapped in act" warnings
  - `npm run typecheck`
  - `npx lessc packages/qaqc-shared/src/qaqc.less > /dev/null`
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Expected numbers come from the spec. If a test disagrees, STOP and re-derive from the xlsx with Python. Report actual vs expected, and never edit expectations to match output.
- Welding xlsx: `"/Users/noahgarrett/Downloads/OneDrive_2026-10-14 (1)/Smartsheet Exports/Welding_Inspections_Signoffs.xlsx"`. It is data only.

---

### Task 1: Reusable chart-expansion host (refactor)

**Files:** `packages/qaqc-shared/src/components/InspectionDashboard.tsx`, new `packages/qaqc-shared/src/components/useChartExpansion.tsx` (or a `ChartExpansionFrame` component; pick the smaller clean API), tests.

- [ ] Extract the expansion machinery from `InspectionDashboard` into a reusable hook or component that any dashboard can use. That machinery is:
  - the non-scrolling `.qaqc-frame` wrapper
  - `expanded` state and per-panel section refs
  - frame and origin boxes
  - the `ExpandedPanel` render with `key`
  - focus restore (expand button, then section, then frame)
  - `onHover(null)` cleanup
  - `inert` on the root while expanded
  - cards-only suppression
- [ ] The API must let a dashboard:
  - register panels by id;
  - wire each grid `ChartPanel`'s `sectionRef` and `onExpand`;
  - render the overlay with per-panel title, icon, legend, empty message, and expanded content.
- [ ] Rewrite `InspectionDashboard` on top of it. Behavior must not change: every existing `InspectionDashboard` test passes unchanged.
- [ ] Add focused tests for the host itself using a tiny two-panel test dashboard: expand, Esc, focus return, and cards-only suppression.
- [ ] Commit: `refactor: share the chart expansion host across dashboards`.

### Task 2: Welding model

**Files:** `packages/qaqc-shared/src/welds.ts`, `packages/qaqc-shared/src/types.ts` (welding types), tests `welds.test.ts`, and the generated fixture `__tests__/fixtures/weldingRows.ts` with test `weldingFixture.test.ts`.

- [ ] **Rules (spec "Rules").** Implement and unit-test:
  - `isWeldIssue(value)`
  - `weldBuilding(tag)`: test every example in the spec, plus blank and lower-case input. The regex is case-sensitive on purpose, so `bk1xx…` → `Site General`.
  - a signed check
  - system and pipe-spec normalization with `Unspecified`
  - case- and space-insensitive grouping keys (reuse the approach in `inspections.ts`)
- [ ] **`buildWeldIndex(rows, columns, today)`.** Do a single pass with cached week parsing. It produces:
  - a continuous `weeks` range, from the first week with welds to the current week. Each entry holds `logged`, `signed`, `issues`, and `signedInWeek` (counted by signed week).
  - cumulative arrays for logged, signed, and issues
  - `positionByKey`
  - per-week system tallies: `Map<system, { total, signed, specs: Map<spec, { total, signed }> }>`
  - per-week building tallies: `Map<building, { welds, issues }>`
  - counts for total, skipped, and future rows

  Signed rows whose signed week falls outside the weeks range, or is in the future, don't count toward `signedInWeek`.
- [ ] **`buildWeldModel(index, view, drillSystem: string | null, minWelds: number)`.** It returns:
  - week options
  - this-week cards: logged, `signedThisWeek`, latest-weld-week sign-off `{ signed, total, week, rate }`, and issues, each with a delta vs W−1
  - to-date totals: total, signed, overall rate, and points delta
  - the window
  - `systems`: ranked, top 8 plus Other, with an `allSystems` full list that nests specs
  - `drill`: the drilled system's spec bars, or `null` when that system isn't in the window
  - `buildings`: ranked by rate, with min-weld filtering and Other; plus `allBuildings` and `overallIssueRate`
  - `windowTotals`
  - `hasData`

  Ties sort by `NAME_COLLATOR`.
- [ ] **Fixture.** Generate it like the Mechanical one, keeping only the 7 slot columns: WELD WORK WEEK, SIGNATURE, WORK WEEK SIGNED, ISSUE CREATED?, FLUID CODE, PIPE SPEC, TAG NO. Then:
  - Check the head for names. SIGNATURE holds inspector names, so replace each non-blank SIGNATURE with `'signed'` in the generator. Only presence matters.
  - Expected row count: 1,751.
  - `weldingFixture.test.ts` asserts every number in the spec's "Expected numbers" section.
- [ ] **Benchmark.** Add to `benchmark.test.ts`: 500k synthetic weld rows index in under 1,500 ms, and the All-range model in under 16 ms.
- [ ] Commit: `feat: add the welding model`.

### Task 3: Welding charts and detail components

**Files:** new `packages/qaqc-shared/src/components/SignoffBarChart.tsx`, `SystemDrillChart.tsx`, `IssueRateChart.tsx`, `SystemTable.tsx`, `BuildingIssueTable.tsx`, tests, and `qaqc.less` additions.

- [ ] **`SignoffBarChart`.** Signed bars within total, a 10% tick, rate labels (red under 10%), issue badges, and the selected band.
  - Hover, click, keyboard, the static `aria-label` plus live region, keyboard-only focus ring, and tooltip-leave group all follow `StackedBarChart` exactly.
  - Supports `showValues` for the expanded view.
  - Reuse `chartMath` helpers.
- [ ] **`SystemDrillChart`.**
  - Horizontal signed-within-total bars with an `x / y · z%` end label.
  - Rows are buttons (keyboard-activatable) when drillable; `Other` is not.
  - Breadcrumb with an "All systems" button when drilled, firing `onDrill(system | null)`.
- [ ] **`IssueRateChart`.**
  - Horizontal rate bars with an `n issues · x.x%` label.
  - Amber when the rate is at least 2× overall.
  - Overall-rate hairline.
  - Empty message per the spec.
- [ ] **`SystemTable`.** Sortable like `BuildingTable`, with disclosure buttons (`aria-expanded`) revealing indented spec rows.
- [ ] **`BuildingIssueTable`.** Sortable columns: Building, Welds, Issues, Issue rate.
- [ ] Test each component's behavior: labels, colors by class, drill callbacks, sorting, disclosure, and empty states.
- [ ] Commit: `feat: add welding charts and detail tables`.

### Task 4: `WeldingDashboard`

**Files:** `packages/qaqc-shared/src/components/WeldingDashboard.tsx`, tests.

- [ ] **Layout and controls.**
  - Same layout as `InspectionDashboard`: header (`Flame` icon, title "Welding Signoffs", range toggle, week picker), 4 + 3 cards per the spec, and charts in the same grid (main left, two small right).
  - Compact and cards-only modes, loading bar, and footnotes.
  - Week, window-end, range, and fallback state semantics are identical to `InspectionDashboard`, including the range-toggle window move.
- [ ] **Drill.** Drill state lives in the dashboard and resets to All when the drilled system leaves the window.
- [ ] **Expansion.** Use the Task 1 host. Expanded content:
  - main: summary strip plus `showValues`
  - systems: `SystemTable`
  - buildings: `BuildingIssueTable`
- [ ] **Props.** Same as `InspectionDashboard`, but takes a weld index and `minWelds`.
- [ ] **Tests.** Mirror `InspectionDashboard.test.tsx`'s structure, using the welding fixture and spec numbers. Cover: cards at WW42 and WW41, dropdown, bar click not moving the window, range toggle, drill and breadcrumb, expand for each chart, and compact/cards-only.
- [ ] Commit: `feat: add the welding dashboard`.

### Task 5: `qaqc-welding` package

- [ ] **Copy the per-package layer from `packages/qaqc-mechanical`:**
  - `package.json`: name `@pbi/qaqc-welding`, icon script shape `flame`
  - `pbiviz.json`: name `qaqcWelding`, a new 12-hex GUID, class, display name, and description
  - `tsconfig`, `vitest.config` (name `qaqc-welding`), `ensure-api.cjs`, `style/visual.less`
- [ ] **Icon.** Add a `flame` shape to `scripts/make-qaqc-icon.mjs`: a simple flame polygon on the 24 grid. View the generated PNG.
- [ ] **`capabilities.json`.**
  - The 8 welding roles (spec "Field slots"), each with displayName/description plus keys, and `max: 1` conditions.
  - Table mapping with a window of 30,000.
  - The same objects as Electrical, plus `hotspots.minWelds` (numeric).
  - Matching `resources.resjson` keys.
- [ ] **`settings.ts`.** `WeldingSettingsModel` = the Electrical cards plus a `HotspotsCard` (`minWelds` NumUpDown, 1–100, default 10, clamped in `readDisplaySettings`). Keep `class CardStyleSettings` and `animationSettings =` for the gate.
- [ ] **Field-slot reader.** Add `readWeldTable(table)` to qaqc-shared next to `readInspectionTable`, with its own `WELD_SLOTS` (8 slots including Row ID) and tests.
- [ ] **`visual.ts`.** Copy Mechanical's, then swap in the weld reader, index, and dashboard, `Flame`, and welding titles and aria labels:
  - aria-label "Welding signoffs dashboard"
  - setup title "Add the Welding Signoffs columns"
  - failure title "Could not draw the Welding visual"

  Pass `minWelds`. Every review-gate string stays.
- [ ] **`visual.test.ts`.** Adapt from Mechanical, using the welding fixture and spec numbers (e.g. Signed This Week `70`, Total Welds `1,751`).
- [ ] **Verify.**
  - Run `npm install` and check the lockfile adds only the workspace.
  - Run tests and typecheck.
  - Run `npm run review:business`: `qaqc-welding` must show 0 issues. Restore the report files after.
- [ ] Commit: `feat: add QAQC Welding visual package`.

### Task 6: Preview, verification, package

- [ ] **Dev harness.** Copy Mechanical's `dev/` to `packages/qaqc-welding/dev/`:
  - port 5192
  - welding fixture
  - `WeldingDashboard`
  - synthetic welding rows for `data=synthetic`
  - `#frame` with `overflow: hidden`

  Add a `qaqc-welding-dev` entry to `.claude/launch.json`. Commit: `chore: add Welding preview harness`.
- [ ] **Visual verification.** The controller does this in the browser: presets, opacity, compact, cards-only, setup/empty/high-contrast, synthetic 500k rows, drill, and expand for all three charts.
- [ ] **Package.**
  - Build: `npm run build -w @pbi/qaqc-welding` must print `[verify] ok`.
  - `npx vitest run`.
  - `npm run review:business`: 0 issues for `qaqc-welding`, 0 errors.
  - Write `QAQC_Welding_SETUP.md` in both package folders, modeled on the Mechanical guide. Cover the slots, Row ID, the drill, expand, the issue rule ("no" doesn't count), and the building rule (Site General).
  - Run `npm run sync:business && npm run sync:lotusworks` (36 each). Only the new `qaqcWelding_…` files, the guides, and the review reports may change; otherwise STOP and restore.
  - Zip `releases/LotusWorks_Package_2026-10-15_QAQC-Welding-1.0.0.zip` from `LotusWorks_Package`.
  - Commit: `feat: package QAQC Welding 1.0.0 with setup guide`.
