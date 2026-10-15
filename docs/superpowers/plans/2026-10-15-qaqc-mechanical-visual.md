# QAQC Mechanical / Process Inspections Visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `packages/qaqc-mechanical` (the Mechanical / Process `.pbiviz`) by reusing the Electrical visual's shared code, after moving the dashboard, the field-slot reader, the CSS build guard, and the icon generator into shared locations.

**Architecture:** Task 1 is a behavior-preserving refactor: Electrical keeps working through the new shared pieces with its existing tests green. Tasks 2–5 add the Mechanical package as a thin per-package layer (`visual.ts`, `settings.ts`, `capabilities.json`, strings, icon) over `qaqc-shared`.

**Tech Stack:** Same as Electrical: TypeScript strict, React 19.2.7, lucide-react 1.24.0, pbiviz 5.6.0, powerbi-visuals-api 5.3.0, formattingmodel 6.x, Vitest + jsdom, Vite (preview), Less.

**Spec:** `docs/superpowers/specs/2026-10-15-qaqc-mechanical-visual-design.md` (and the Electrical spec it builds on).

**Branch:** `feat/qaqc-mechanical` (already created from `main`).

---

## Conventions

- Run commands from `/Users/noahgarrett/Codebase/PowerBI`.
- The conventions in `docs/superpowers/plans/2026-10-15-qaqc-electrical-visual.md` lines 17–39 apply: import grouping, no `any`, explicit return types, `ReactElement` returns, no em dashes in UI copy, no runtime access to `powerbi-visuals-api` enums, the review-gate facts.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- After each task, run `npx vitest run --project qaqc-shared --project qaqc-electrical` (plus `--project qaqc-mechanical` once it exists) and `npm run typecheck`. Both must be clean, with 0 "not wrapped in act" warnings.

---

### Task 1: Move the dashboard and field-slot reader into `qaqc-shared`

**Files:**
- Create: `packages/qaqc-shared/src/components/InspectionDashboard.tsx` (from `packages/qaqc-electrical/src/ElectricalDashboard.tsx`)
- Create: `packages/qaqc-shared/src/dataView.ts` (from `packages/qaqc-electrical/src/dataView.ts`)
- Create: `packages/qaqc-shared/src/__tests__/InspectionDashboard.test.tsx` (from `packages/qaqc-electrical/src/__tests__/ElectricalDashboard.test.tsx`)
- Create: `packages/qaqc-shared/src/__tests__/dataView.test.ts` (from `packages/qaqc-electrical/src/__tests__/dataView.test.ts`)
- Delete: `packages/qaqc-electrical/src/ElectricalDashboard.tsx`, `packages/qaqc-electrical/src/dataView.ts`, and their two test files
- Modify: `packages/qaqc-electrical/src/visual.ts`, `packages/qaqc-electrical/src/__tests__/visual.test.ts`, `packages/qaqc-electrical/dev/main.tsx`

- [ ] **Step 1: Create `InspectionDashboard.tsx`.** Use `git mv packages/qaqc-electrical/src/ElectricalDashboard.tsx packages/qaqc-shared/src/components/InspectionDashboard.tsx`, then edit:
  - Rename `ElectricalDashboard` to `InspectionDashboard` and `ElectricalDashboardProps` to `InspectionDashboardProps`.
  - Add props `title: string` and `icon: LucideIcon` (import `type LucideIcon` from `lucide-react`). Destructure `icon` as `icon: Icon`.
  - Replace the hard-coded `<Zap size={16} aria-hidden="true" />` with `<Icon size={16} aria-hidden="true" />`, and the `<h2>Electrical Inspections</h2>` text with `{title}`. Remove `Zap` from the lucide import.
  - Rewrite the shared imports from `../../qaqc-shared/src/X` to relative paths inside `qaqc-shared`: `../chartTypes`, `./ChartPanel`, `./Footnotes`, `./HorizontalBarChart`, `./KpiCard`, `./KpiGroup`, `./LineChart`, `./LoadingBar`, `./RangeToggle`, `./StackedBarChart`, `./WorkWeekPicker`, `../format`, `../inspections`, `../theme`, `../types`, `../workWeeks`.
  - Change nothing else.
- [ ] **Step 2: Move the dashboard tests.** Use `git mv packages/qaqc-electrical/src/__tests__/ElectricalDashboard.test.tsx packages/qaqc-shared/src/__tests__/InspectionDashboard.test.tsx`, then update the imports:
  - `./fixtures/electricalRows`
  - `./render`
  - `../inspections`
  - `../theme`
  - `../workWeeks`, if used
  - `../components/InspectionDashboard`

  Pass `title="Electrical Inspections"` and `icon={Zap}` (import `Zap` from `lucide-react`) everywhere the component is rendered.

  Add one test: rendering with `title="Mechanical / Process Inspections"` and `icon={Cog}` shows that text in the `h2`. All existing expectations stay unchanged.
- [ ] **Step 3: Create the shared `dataView.ts`.** Use `git mv packages/qaqc-electrical/src/dataView.ts packages/qaqc-shared/src/dataView.ts`, then remove the `powerbi-visuals-api` dependency by replacing the parameter type with a structural one:

```ts
export interface TableColumnLike {
  roles?: { [role: string]: boolean }
}

export interface InspectionTableSource {
  columns: ReadonlyArray<TableColumnLike>
  rows?: InspectionRows
}

export function readInspectionTable(table: InspectionTableSource | undefined): TableReadResult {
```

  Inside the function, use `table` directly where it previously read `dataView?.table`. Update the types import to `./types`. `FieldSlot`, `REQUIRED_SLOTS`, and `TableReadResult` keep their current shapes and exports.
- [ ] **Step 4: Move the `dataView` tests.** Use `git mv packages/qaqc-electrical/src/__tests__/dataView.test.ts packages/qaqc-shared/src/__tests__/dataView.test.ts`.
  - Replace the `tableDataView(...)` helper calls with a local plain-object helper in that test file:

```ts
type SlotRole = 'workWeek' | 'phase' | 'issue' | 'building' | 'rowId'
const ALL_ROLES: SlotRole[] = ['workWeek', 'phase', 'issue', 'building', 'rowId']

function table(rows: ReadonlyArray<ReadonlyArray<string | null>>, roles: SlotRole[] = ALL_ROLES): InspectionTableSource {
  return {
    columns: roles.map((role) => ({ roles: { [role]: true } })),
    rows: rows.map((row, rowIndex) => roles.map((role) => (role === 'rowId' ? rowIndex + 1 : row[ALL_ROLES.indexOf(role)] ?? ''))),
  }
}
```

  - Calls change from `readInspectionTable(tableDataView(rows, { roles }))` to `readInspectionTable(table(rows, roles))`, and the "no data view" case becomes `readInspectionTable(undefined)`. Expectations are unchanged.
  - `packages/qaqc-electrical/src/__tests__/tableDataView.ts` stays in place; `visual.test.ts` still uses it.
- [ ] **Step 5: Point Electrical at the shared modules.**
  - In `packages/qaqc-electrical/src/visual.ts`:
    - Import `InspectionDashboard` from `../../qaqc-shared/src/components/InspectionDashboard`, and `readInspectionTable`, `FieldSlot`, `TableReadResult` from `../../qaqc-shared/src/dataView`.
    - Add `Zap` to the lucide import.
    - Render `InspectionDashboard` with `title: 'Electrical Inspections'` and `icon: Zap` added to the props.
    - Call `readInspectionTable(dataView?.table)`.
  - In `visual.test.ts`, change the `vi.mock('../ElectricalDashboard', ...)` target to `'../../../qaqc-shared/src/components/InspectionDashboard'` and the export name to `InspectionDashboard`, keeping the same throw-on-flag behavior.
  - In `dev/main.tsx`, import `InspectionDashboard` from the shared path and `REQUIRED_SLOTS` from `../../qaqc-shared/src/dataView`, and pass `title="Electrical Inspections"` and `icon={Zap}`.
- [ ] **Step 6: Verify.** Run both QAQC projects plus typecheck. Expected: the same number of tests as before plus one new title test, all passing. Then run `rg -n "ElectricalDashboard|qaqc-electrical/src/dataView" packages` and expect no matches.
- [ ] **Step 7: Commit:** `refactor: share the inspection dashboard and field-slot reader`.

---

### Task 2: Shared build scripts (CSS guard and icon generator)

**Files:**
- Create: `scripts/verify-pbiviz-css.mjs` (from `packages/qaqc-electrical/scripts/verify-package.mjs`)
- Create: `scripts/make-qaqc-icon.mjs` (from `packages/qaqc-electrical/scripts/make-icon.mjs`)
- Delete: `packages/qaqc-electrical/scripts/verify-package.mjs`, `packages/qaqc-electrical/scripts/make-icon.mjs`
- Modify: `packages/qaqc-electrical/package.json`

- [ ] **Step 1: Create `scripts/verify-pbiviz-css.mjs`.** Use `git mv packages/qaqc-electrical/scripts/verify-package.mjs scripts/verify-pbiviz-css.mjs`, then change it to take two CLI arguments, `node scripts/verify-pbiviz-css.mjs <packageDir> <requiredSelector>`:
  - `packageDir` is resolved against `process.cwd()`, and the `dist` directory is `<packageDir>/dist`.
  - `requiredSelector` is the CSS selector the bundle must contain, for example `.qaqc-root`.
  - Missing arguments exit 1 with `[verify] usage: node scripts/verify-pbiviz-css.mjs <packageDir> <requiredSelector>`.
  - All other behavior stays the same.
- [ ] **Step 2: Create `scripts/make-qaqc-icon.mjs`.** Use `git mv packages/qaqc-electrical/scripts/make-icon.mjs scripts/make-qaqc-icon.mjs`, then generalize it to `node scripts/make-qaqc-icon.mjs <outputPng> <shape>`:
  - `SHAPES` is a record of polygon lists on the 24×24 grid. A pixel sample is filled when it is inside an odd number of polygons (even-odd fill), which lets a hole be cut:

```js
function regularPolygon(cx, cy, radius, sides, rotation) {
  return Array.from({ length: sides }, (_, i) => {
    const angle = rotation + (i * 2 * Math.PI) / sides;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  });
}

const SHAPES = {
  zap: [[[13, 2], [3, 14], [12, 14], [11, 22], [21, 10], [12, 10]]],
  'hex-nut': [regularPolygon(12, 12, 10.5, 6, Math.PI / 6), regularPolygon(12, 12, 4.2, 20, 0)],
};
```

  - `inside(x, y)` tests each polygon with the existing ray-cast and XORs the results.
  - An unknown shape or missing argument exits 1 with a usage message.
  - Keep the 20×20 size, 4×4 supersampling, `#2E5AAC` color, and PNG writer.
  - Write the file to the given path, creating its directory, and log `[icon] wrote <relative path>`.
- [ ] **Step 3: Update Electrical's `package.json` scripts:**
  - `"build": "node scripts/ensure-api.cjs && pbiviz package --all-locales && node ../../scripts/verify-pbiviz-css.mjs . .qaqc-root"`
  - `"icon": "node ../../scripts/make-qaqc-icon.mjs assets/icon.png zap"`
- [ ] **Step 4: Verify.**
  - Run `npm run icon -w @pbi/qaqc-electrical`, then `git diff --stat packages/qaqc-electrical/assets/icon.png`. Expect no change; the zap output must be byte-identical. If it differs, compare by viewing both images and report.
  - Run `npm run build -w @pbi/qaqc-electrical`. Expect `[verify] ok css=… js=…`.
  - Do not sync `Business_Package` or `LotusWorks_Package` in this task, and restore any tracked files the build changes (none expected).
- [ ] **Step 5: Commit:** `build: share the QAQC CSS guard and icon generator`.

---

### Task 3: Mechanical fixture and expected numbers

**Files:**
- Create: `packages/qaqc-shared/src/__tests__/fixtures/mechanicalRows.ts` (generated)
- Test: `packages/qaqc-shared/src/__tests__/mechanicalFixture.test.ts`

- [ ] **Step 1: Generate the fixture.** Use the same Python generator as the Electrical plan's Task 6 Step 1, with these changes:
  - Input: `"/Users/noahgarrett/Downloads/OneDrive_2026-10-14 (1)/Smartsheet Exports/Mechanical_Process_Inspection_Log.xlsx"`
  - Output: `packages/qaqc-shared/src/__tests__/fixtures/mechanicalRows.ts`
  - Constant name: `MECHANICAL_ROWS`
  - Header comment: `// Generated from Mechanical_Process_Inspection_Log.xlsx (2026-10-14 export).`

  Keep only the same four columns. Expected printed count: `138`.
- [ ] **Step 2: Write `mechanicalFixture.test.ts`.**

```ts
import { describe, expect, it } from 'vitest'

import { buildInspectionIndex, buildInspectionModel, defaultViewState } from '../inspections'
import { MECHANICAL_ROWS } from './fixtures/mechanicalRows'

const COLUMNS = { workWeek: 0, phase: 1, issue: 2, building: 3 }
const TODAY = new Date(2026, 9, 15) // WW42'2026
const index = buildInspectionIndex(MECHANICAL_ROWS, COLUMNS, TODAY)

describe('Mechanical export (2026-10-14)', () => {
  it('reads every row with no skipped or future weeks', () => {
    expect(index.totalRows).toBe(138)
    expect(index.skippedRows).toBe(0)
    expect(index.futureRows).toBe(0)
  })

  it("spans WW02'2026 through WW42'2026", () => {
    expect(index.weeks[0].week.label).toBe("WW02'2026")
    expect(index.weeks[index.weeks.length - 1].week.label).toBe("WW42'2026")
    expect(index.weeks).toHaveLength(41)
  })

  it('matches the WW42 cards and to-date totals', () => {
    const model = buildInspectionModel(index, defaultViewState(index))
    expect(model.thisWeek.finals).toEqual({ value: 0, delta: 0 })
    expect(model.thisWeek.sors).toEqual({ value: 0, delta: -2 })
    expect(model.thisWeek.issuesFound).toEqual({ value: 0, delta: 0 })
    expect(model.toDate.finals).toBe(44)
    expect(model.toDate.sors).toBe(91)
    expect(model.toDate.cleanFinals).toBe(43)
    expect(model.toDate.passRate).toBeCloseTo(97.727, 3)
    expect(model.toDate.passRateDeltaPoints).toBe(0)
  })

  it('flags only WW08 as an NCR week, outside the default window', () => {
    const recent = buildInspectionModel(index, defaultViewState(index))
    expect(recent.passRateTrend.some((point) => point.hadIssue)).toBe(false)
    const all = buildInspectionModel(index, { ...defaultViewState(index), range: 'all' })
    expect(all.passRateTrend.filter((point) => point.hadIssue).map((point) => point.week.label)).toEqual(["WW08'2026"])
  })

  it('ranks F63.2 first and groups 12 smaller buildings as Other', () => {
    const model = buildInspectionModel(index, defaultViewState(index))
    expect(model.buildings[0]).toEqual({ building: 'F63.2', finals: 14, sors: 2 })
    expect(model.buildings).toHaveLength(8)
    expect(model.otherBuildings?.count).toBe(12)
    expect((model.otherBuildings?.finals ?? 0) + (model.otherBuildings?.sors ?? 0)).toBe(14)
  })
})
```

- [ ] **Step 3: Run it.** Run `npx vitest run --project qaqc-shared mechanicalFixture`. Expected: PASS, 5 tests. If any expectation fails, STOP and re-derive the value from the xlsx with Python. Report actual vs. expected and do not edit expectations to match output.
- [ ] **Step 4: Commit:** `test: verify inspection model against the real Mechanical export`.

---

### Task 4: `qaqc-mechanical` package

**Files (all new, under `packages/qaqc-mechanical/`):** `package.json`, `pbiviz.json`, `tsconfig.json`, `vitest.config.ts`, `capabilities.json`, `stringResources/en-US/resources.resjson`, `scripts/ensure-api.cjs`, `style/visual.less`, `assets/icon.png`, `src/settings.ts`, `src/visual.ts`, `src/__tests__/settings.test.ts`, `src/__tests__/visual.test.ts`, `src/__tests__/tableDataView.ts`.

- [ ] **Step 1: Copy the unchanged files from Electrical.** Copy these verbatim:
  - `tsconfig.json`
  - `capabilities.json`
  - `stringResources/en-US/resources.resjson`
  - `scripts/ensure-api.cjs`
  - `style/visual.less`
  - `src/__tests__/tableDataView.ts`

  Copy `vitest.config.ts` and change only `name: 'qaqc-mechanical'`.
- [ ] **Step 2: Create `package.json`.** Copy Electrical's, then:
  - `"name": "@pbi/qaqc-mechanical"`
  - `"build": "node scripts/ensure-api.cjs && pbiviz package --all-locales && node ../../scripts/verify-pbiviz-css.mjs . .qaqc-root"`
  - `"icon": "node ../../scripts/make-qaqc-icon.mjs assets/icon.png hex-nut"`
  - Keep the `dev` script and the same dependency versions.
- [ ] **Step 3: Create `pbiviz.json`.** Copy Electrical's, then set:
  - `visual.name`: `qaqcMechanical`
  - `displayName`: `QAQC Mechanical / Process Inspections`
  - `guid`: `qaqcMechanical_7064EE749149`
  - `visualClassName`: `QaqcMechanicalVisual`
  - `version`: `1.0.0.0`
  - `description`: `Weekly Mechanical / Process inspection Finals, SORs, NCR pass rate, and building breakdown from the Smartsheet Mechanical / Process Inspection Log.`

  Everything else is identical.
- [ ] **Step 4: Generate the icon.** Run `npm install` (it links the workspace; review the lockfile diff and confirm only the `@pbi/qaqc-mechanical` workspace entries were added). Then run `npm run icon -w @pbi/qaqc-mechanical`. View the PNG with the Read tool and confirm a blue hexagon with a round hole.
- [ ] **Step 5: Create `src/settings.ts`.** Copy Electrical's verbatim, then rename `ElectricalSettingsModel` to `MechanicalSettingsModel`. Copy `settings.test.ts` with the same rename.
- [ ] **Step 6: Create `src/visual.ts`.** Copy Electrical's current `visual.ts`, then change only:
  - the class name, to `QaqcMechanicalVisual`;
  - the settings model, to `MechanicalSettingsModel`;
  - the host error message, to `QAQC Mechanical / Process requires a Power BI visual host.`;
  - the `aria-label`, to `Mechanical / Process inspections dashboard`;
  - the setup title, to `Add the Mechanical / Process Inspection Log columns`;
  - the render-failure title, to `Could not draw the Mechanical / Process visual`;
  - the dashboard props, to `title: 'Mechanical / Process Inspections'` and `icon: Cog`, swapping `Zap` for `Cog` in the lucide import.

  Every review-gate string must remain.
- [ ] **Step 7: Create `src/__tests__/visual.test.ts`.** Copy Electrical's, then:
  - Import `MECHANICAL_ROWS` from the shared fixture and use it in place of `ELECTRICAL_ROWS`.
  - Rename the visual class and change the aria-label expectation.
  - Update value expectations to the Mechanical numbers:
    - "renders the dashboard": Final Inspections `0`, NCR Pass Rate `97.7%`.
    - The row-limit footnote: `Showing the first 138 rows (Power BI data limit)`.
    - The middle-row-edit test: change the `Issue?` of the first WW08'2026 Final row that reads `No Issue Found` to `NCR`, and assert the NCR Pass Rate card changes from `97.7%` to `95.5%` (42/44). No week selection is needed.
  - Keep the setup-card and render-failure title expectations in sync with Step 6.
- [ ] **Step 8: Verify.** Run `npx vitest run --project qaqc-mechanical` (all pass, 0 act warnings) and `npm run typecheck`. Then run `npm run review:business` and confirm `qaqc-mechanical` has 0 issues. Restore the two `review-report.json` files with `git checkout --` afterwards, because they are committed in Task 5.
- [ ] **Step 9: Commit:** `feat: add QAQC Mechanical / Process visual package`.

---

### Task 5: Preview, build, package

**Files:**
- Create: `packages/qaqc-mechanical/dev/` (`vite.config.ts`, `vite-env.d.ts`, `index.html`, `main.tsx`)
- Create: `LotusWorks_Package/QAQC_Mechanical_SETUP.md`, `Business_Package/QAQC_Mechanical_SETUP.md`
- Modify: `Business_Package/*`, `LotusWorks_Package/*` (sync)

- [ ] **Step 1: Create the preview harness.** Copy Electrical's `dev/` folder, then change:
  - the port, to `5191`;
  - the page title, to `QAQC Mechanical preview`;
  - the fixture, to `MECHANICAL_ROWS`;
  - the dashboard props, to `title="Mechanical / Process Inspections"` and `icon={Cog}`;
  - the setup panel title, to match Task 4 Step 6.

  Then add to `/Users/noahgarrett/Codebase/PowerBI/.claude/launch.json` an entry `qaqc-mechanical-dev` that runs `npm run dev -w @pbi/qaqc-mechanical` on port 5191. Run typecheck, and commit as `chore: add Mechanical visual preview harness`.
- [ ] **Step 2: Visual verification.** The controller does this step in the browser using the URL matrix from the Electrical plan's Task 19 Step 7, with Mechanical numbers.
- [ ] **Step 3: Build and check.**
  - Run `npm run build -w @pbi/qaqc-mechanical`. The verify step must pass.
  - Run `npm run review:business`. `qaqc-mechanical` must have 0 issues and errors must be 0.
  - Run `npx vitest run`. The full suite must pass.
- [ ] **Step 4: Write the setup guide.** Copy `LotusWorks_Package/QAQC_Electrical_SETUP.md` to `QAQC_Mechanical_SETUP.md` in both package folders, then:
  - Replace "Electrical Inspections" with "Mechanical / Process Inspections".
  - Change the import file name to `qaqcMechanical_7064EE749149.<version>.pbiviz`.
  - Change the Power Query step to "the Mechanical / Process Inspection Log query".
  - Drop the sentence quoting the October Electrical numbers.
  - Add to Counting rules: `**Pass / Fail column:** not used. NCR Pass Rate comes from Issue? so it matches the Electrical visual.`
- [ ] **Step 5: Sync.**
  - Run `npm run sync:business && npm run sync:lotusworks`. Each should copy 35 files.
  - Run `git status --short Business_Package LotusWorks_Package`. Only the new `qaqcMechanical_…pbiviz` files, the setup guides, and the review reports may change. If any other `.pbiviz` changed, including Electrical, STOP: restore with `git checkout -- Business_Package LotusWorks_Package` and report.
  - Electrical's `dist` was rebuilt in Task 2, so sync will copy a rebuilt Electrical file that is behavior-identical but not byte-identical. If `qaqcElectrical_…pbiviz` shows as modified, restore just that file in both folders (`git checkout -- Business_Package/qaqcElectrical_* LotusWorks_Package/qaqcElectrical_*`). Electrical 1.0.0 stays as shipped.
- [ ] **Step 6: Create the release zip.** Run `(cd LotusWorks_Package && zip -qr ../releases/LotusWorks_Package_2026-10-15_QAQC-Mechanical-1.0.0.zip .)`, then confirm the listing contains `qaqcMechanical_7064EE749149.1.0.0.0.pbiviz` and `QAQC_Mechanical_SETUP.md`.
- [ ] **Step 7: Commit:** `feat: package QAQC Mechanical / Process visual 1.0.0 with setup guide`.
