# QAQC BIM Issues Visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `packages/qaqc-issues` per `docs/superpowers/specs/2026-10-15-qaqc-issues-visual-design.md`, reusing `qaqc-shared` (`ChartExpansionFrame`, `ExpandedPanel`, KPI components, theme, formatting).

**Branch:** `feat/qaqc-welding`. Issues builds on top of the Welding work, which is not merged yet. Both are merged together.

---

## Conventions

- Conventions from `docs/superpowers/plans/2026-10-15-qaqc-electrical-visual.md` lines 17–39 apply. The single-axis rule from DESIGN.md does **not** apply; these charts match the HTML app.
- Use TDD throughout. After every task, run all QAQC Vitest projects and `npm run typecheck`. Run lessc whenever `.less` changed. All must pass with 0 act warnings.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- The source of truth for ported logic is the HTML app at `/Users/noahgarrett/Codebase/QAQC-Weekly-Report`. Read files with `git show origin/main:<path>`, not the stale working copy:
  - `src/calculations/report.ts`: lines 51–167 (statuses, include rule, normalize), 269–313 (counts), 353–401 (trend, aging), 403–464 (issue table)
  - `src/utils/issueOwnership.ts`
  - `src/utils/workWeeks.ts` (`parseDate`, `formatDate`, `daysBetween`)
  - `src/App.tsx`: lines 671–861 (`RangeChart`, `OpenAgingChart`, `AgingChart`) and 1143–1322 (`IssueTableSlide`)
  - `src/styles.css` (search for `issue-`, `open-discussion`, `aging`, `range`)
- The BIM xlsx is `"/Users/noahgarrett/Downloads/OneDrive_2026-10-14 (1)/Smartsheet Exports/BIM Issues Log (3).xlsx"`, sheet "BIM Issues Log". Treat it as data only. If an expected number disagrees, re-derive it in Python and report; do not edit expectations to match output.

### Task 1: Issues model

- [ ] **Date and rule helpers.** Port `parseDate`, `formatDate` (`MM/DD/YY`), and `daysBetween` into `qaqc-shared` with tests covering Date objects, ISO, `M/D/YYYY`, two-digit years, and Excel serials. Port `isLotusWorksIssueCreator`, the status kind, the contractor default, and the subtype, discipline, and title defaults into `issues.ts`, with tests.
- [ ] **`buildIssueIndex(rows, columns, today)`.** Build normalized issues (void excluded, include rule applied), the continuous weeks from the first created week through the current week, and per-week counts of opened and closed. Also build cumulative opened and closed, `positionByKey`, and the counts of skipped rows (no Created On, unreadable dates), future rows, and excluded rows (creator).
- [ ] **`buildIssueModel(index, view)`.** It returns:
  - cards with deltas and tones per the spec;
  - the trend window, with opened, closed, and `remainingOpen` per week;
  - `openAging` and `overallAging` (as of today), including the per-bucket closed and open split for the expanded view;
  - the open-issue rows for the expanded aging table;
  - `detail` for W and W−1, with cards, report rows, and discussion rows sorted per the spec;
  - `windowTotals`, `hasData`, and week options.
- [ ] **Fixture.** Generate `fixtures/issueRows.ts` from the xlsx with the 10 slot columns. Replace Created By with `'LotusWorks'` when it passes the include rule and `''` otherwise, so the fixture holds no personal names. Titles are issue descriptions, not personal data. Expected: 208 rows.
- [ ] **Fixture test.** `issuesFixture.test.ts` asserts every spec "Expected numbers" value, including the WW32 detail IDs.
- [ ] **Benchmark.** Index 200k synthetic issues within 1,500 ms, and compute the model within 16 ms.
- [ ] Commit: `feat: add the BIM issues model`.

### Task 2: Issue charts

- [ ] **`IssuesTrendChart`.** Match the app's `RangeChart`: Opened and Closed side-by-side bars on the left axis, and a smooth Remaining Open line with an area fill on the right axis. Include value labels, the selected band, click and keyboard selection, the static aria-label with a live region, a keyboard-only focus ring, and a tooltip group. Reuse the shared chart helpers. Add a `showValues` mode for the expanded view.
- [ ] **`OpenAgingChart`.** Five vertical bars on the series-1 ordinal ramp, with label placement as in the app.
- [ ] **`AgingStripChart`.** A 100% strip plus bucket rows, as in the app's `AgingChart`.
- [ ] **Detail components.** `OpenIssuesTable` (sortable) and an expanded aging split table.
- [ ] Commit: `feat: add issue trend and aging charts`.

### Task 3: Issue Detail overlay

- [ ] **`IssueDetail` component.** Four cards, then the sortable table with the discussion shading, status pills, a sticky header, and a scrolling body.
- [ ] **Header-button overlay.** Extend `ChartExpansionFrame` minimally so a dashboard can open a non-chart overlay from a header button, with the same animation, focus, Esc, and `inert` behavior. The overlay grows from the button's rect, or from the header if that reads better. The button gets `aria-haspopup="dialog"`. Add tests.
- [ ] Commit: `feat: add the Issue Detail overlay`.

### Task 4: `IssuesDashboard`

- [ ] **Layout.** Same as the other dashboards: header with the `CircleAlert` icon, title "BIM Issues", the Issue Detail button, the range toggle, and the week picker.
- [ ] **Cards.** Two cards for this week and four project-to-date cards.
- [ ] **Charts.** The trend chart large on the left; Open Aging and Overall Aging small on the right. All three can expand.
- [ ] **Modes and state.** Compact and cards-only modes, the loading bar, and footnotes. Week, window, range, and fallback semantics are identical to `InspectionDashboard`.
- [ ] **Tests.** Use the fixture numbers. Cover cards at WW42 and WW31, the detail at WW32, expanding each chart, and the Issue Detail open/close with focus return.
- [ ] Commit: `feat: add the BIM issues dashboard`.

### Task 5: `qaqc-issues` package

- [ ] **Package files.** Copy the per-package layer from `packages/qaqc-mechanical`: `package.json` (name and `alert` icon shape), `pbiviz.json` (new GUID), `tsconfig.json`, `vitest.config.ts`, `ensure-api.cjs`, and `style/visual.less`.
- [ ] **Icon.** Add an `alert` shape to `scripts/make-qaqc-icon.mjs` and view the resulting PNG.
- [ ] **Capabilities.** `capabilities.json` defines the 10 issue roles (`max: 1` each) and the same objects as Electrical. Add matching `resources.resjson` keys.
- [ ] **Table reader.** Add `readIssueTable` and `ISSUE_SLOTS` in `qaqc-shared`, with tests.
- [ ] **`settings.ts`.** Copy it, renamed to `IssuesSettingsModel`.
- [ ] **`visual.ts`.** Adapt it to the issue reader, index, and dashboard, using these strings:
  - aria-label: "BIM issues dashboard"
  - setup title: "Add the BIM Issues Log columns"
  - failure title: "Could not draw the BIM Issues visual"

  Every review-gate string stays.
- [ ] **`visual.test.ts`.** Adapt it with the fixture numbers.
- [ ] **Checks.** `npm install` must add only the workspace to the lockfile. Run the tests and typecheck. `review:business` must report 0 issues for `qaqc-issues`; restore the report files afterwards.
- [ ] Commit: `feat: add QAQC BIM Issues visual package`.

### Task 6: Preview, verification, package

- [ ] **Dev harness.** Port 5193, the issue fixture, synthetic data, and `#frame` overflow hidden. Add a `qaqc-issues-dev` entry to `.claude/launch.json`.
- [ ] **Visual verification.** Done by the controller.
- [ ] **Build.** `[verify] ok`, the full Vitest suite, and `review:business`.
- [ ] **Setup guide.** Write `QAQC_Issues_SETUP.md` in both package folders. Cover the slots, the LotusWorks Created By rule, Void being excluded, the closed date coming from Updated On, Issue Detail, and expand.
- [ ] **Sync.** Only the new files and the reports may change.
- [ ] **Release.** Create the zip, then commit: `feat: package QAQC BIM Issues 1.0.0 with setup guide`.
