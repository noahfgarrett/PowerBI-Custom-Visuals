# QAQC Expanded Chart View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let every QAQC chart panel expand to fill the visual, animating from its grid position and back, with extra information when expanded. The work goes in `qaqc-shared`, so Electrical and Mechanical both get it.

**Architecture:** The view model gains `allBuildings`, `windowTotals`, and a per-point `issuesFound`. The charts gain two opt-in options: bar value labels and NCR-week rate labels. Three detail components are added: `WindowSummary`, `IssueWeekList`, and `BuildingTable`. `ChartPanel` gets an expand button. A new `ExpandedPanel` overlay animates its box with the Web Animations API from the grid panel's rectangle to the root's visible rectangle and back. `InspectionDashboard` owns which panel is expanded.

**Spec:** "Expanded chart view" section of `docs/superpowers/specs/2026-10-15-qaqc-electrical-visual-design.md`.

**Branch:** `feat/qaqc-mechanical`. This work lands before Mechanical is packaged, so both visuals ship with it.

---

## Conventions

- Conventions from `docs/superpowers/plans/2026-10-15-qaqc-electrical-visual.md` lines 17–39 apply.
- Use TDD for every behavior change.
- After each task, run all of these and confirm the results:
  - `npx vitest run --project qaqc-shared --project qaqc-electrical --project qaqc-mechanical`: all pass, with 0 "not wrapped in act" warnings.
  - `npm run typecheck`: clean.
  - `npx lessc packages/qaqc-shared/src/qaqc.less > /dev/null`: clean.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- jsdom has no `Element.prototype.animate`. Code must treat a missing `animate` as "no animation" (instant), and tests rely on that.

---

### Task 1: View-model additions

**Files:** `packages/qaqc-shared/src/types.ts`, `packages/qaqc-shared/src/inspections.ts`, tests in `inspectionModel.test.ts`, `electricalFixture.test.ts`, `mechanicalFixture.test.ts`

- [ ] **Step 1: Write the failing tests.**
  - `inspectionModel.test.ts`, using `syntheticIndex()`:
    - `model.windowTotals` for the default view equals the sums over `model.window`: `{ finals, sors, issuesFound, weeks: 30 }`. Compute the expected values in the test by reducing `model.window`.
    - In the building test (10 buildings), `model.allBuildings` has all 10 in ranked order, and `model.buildings` still has the top 8.
    - `passRateTrend` points carry `issuesFound`. The WW40 point has `issuesFound: 1`.
  - `electricalFixture.test.ts`, default view:
    - `windowTotals.weeks === 30`
    - `allBuildings.length === 19`
    - `allBuildings[0]` is `{ building: 'F63.2', finals: 138, sors: 15 }`
  - `mechanicalFixture.test.ts`, default view:
    - `allBuildings.length === 19` (after case-insensitive building grouping)
    - `windowTotals.issuesFound === 0`
- [ ] **Step 2: Implement.**
  - In `types.ts`:
    - Add `issuesFound: number` to `PassRatePoint`, keeping `hadIssue`.
    - Add `export interface WindowTotals { finals: number; sors: number; issuesFound: number; weeks: number }`.
    - Add `allBuildings: BuildingBar[]` and `windowTotals: WindowTotals` to `InspectionModel`.
  - In `inspections.ts`:
    - `summarizeBuildings` also returns `ranked` as `allBuildings`.
    - `buildInspectionModel` sets `allBuildings`.
    - `windowTotals` is a single reduce over `window`, with `weeks: window.length`.
    - Each trend point gets `issuesFound: item.issuesFound`.
- [ ] **Step 3: Verify and commit:** `feat: add full building list, window totals, and per-week issues to the model`.

---

### Task 2: Chart detail options

**Files:** `packages/qaqc-shared/src/components/StackedBarChart.tsx`, `LineChart.tsx`, and their tests

- [ ] **Step 1: Add `showValues` to `StackedBarChart`.** Add an optional prop `showValues?: boolean` (default `false`).
  - When it is true and `band >= 18`, render a `<text className="qaqc-value-text qaqc-bar-value">` with the total (`finals + sors`), centered over each bar.
    - Its y is `totalTop - 4`. When the week has an issue badge, use `badgeCenterY - BADGE_RADIUS - 3` instead.
    - Fill with `colors.ink`. Skip weeks whose total is 0.
  - When `band < 18`, render no value labels.
  - Tests:
    - With the 3-week fixture at width 600 and `showValues`, three `.qaqc-bar-value` elements read `5`, `9`, `6`.
    - Without `showValues`, there are none.
    - With 120 weeks at width 600, there are none.
- [ ] **Step 2: Add `labelIssueWeeks` to `LineChart`.** Add an optional prop `labelIssueWeeks?: boolean` (default `false`).
  - When it is true, every `hadIssue` point with a rate gets a `<text className="qaqc-value-text qaqc-issue-rate">` showing `formatPercent(rate)`, 10 px above the dot. Clamp it so it stays at least 10 px below the top margin.
  - Test: the existing 3-point fixture with `labelIssueWeeks` renders one `.qaqc-issue-rate` element reading `99.1%`.
- [ ] **Step 3: Verify and commit:** `feat: add value and NCR-week labels for expanded charts`.

---

### Task 3: Detail components

**Files:**
- Create: `packages/qaqc-shared/src/components/WindowSummary.tsx`, `IssueWeekList.tsx`, `BuildingTable.tsx`
- Test: `packages/qaqc-shared/src/__tests__/details.test.tsx`

- [ ] **Step 1: Write the failing tests.** In `details.test.tsx`:
  - `WindowSummary` with `{ finals: 238, sors: 48, issuesFound: 2, weeks: 30 }` renders four items, in order:
    - `Finals` = `238`
    - `SORs` = `48`
    - `Issues found` = `2`
    - `Avg per week` = `9.5`, from (238 + 48) ÷ 30 = 9.53, which rounds to one decimal
    - With `weeks: 0`, the average reads `n/a`.
  - `IssueWeekList` with three points (WW22 `issuesFound: 1` rate 99.2, WW23 `issuesFound: 1` rate 98.8, WW24 `issuesFound: 0`) renders two rows, newest first: `WW23'2026 · 1 issue · 98.8%`, then `WW22'2026 …`. Check the text cells; the `·` separators are only an illustration. With no issue points it renders `No NCR weeks in this range`.
  - `BuildingTable` with `[{ building: 'B', finals: 1, sors: 5 }, { building: 'A', finals: 4, sors: 0 }, { building: 'C', finals: 2, sors: 2 }]`:
    - Default rows are ordered by total, descending, with ties broken by name: B (6), then A (4) and C (4). The `Total` header has `aria-sort="descending"`.
    - Clicking the `Building` header button sorts A, B, C, and `aria-sort` becomes `ascending`. Clicking it again sorts C, B, A, descending.
    - Clicking `Finals` sorts descending first: A (4), C (2), B (1).
    - Each row's Total cell contains a `.qaqc-share-bar` whose `style.width` is that row's percentage of the largest total. B is `100%`.
- [ ] **Step 2: Implement the components.**
  - `WindowSummary({ totals }: { totals: WindowTotals })` returns `<dl className="qaqc-summary">` with four `<div>` items, each holding a `<dt>` and a `<dd>`. Use `formatCount`. The average is `totals.weeks > 0 ? ((totals.finals + totals.sors) / totals.weeks).toFixed(1) : 'n/a'`.
  - `IssueWeekList({ points }: { points: PassRatePoint[] })` returns `<ol className="qaqc-issue-list" aria-label="NCR weeks">`, newest first. Each `<li>` holds:
    - `<strong>{week.label}</strong>`
    - `<span>{n} {pluralize(n, 'issue', 'issues')}</span>`
    - `<span>{formatPercent(rate)}</span>`

    When the list is empty, render `<p className="qaqc-chart-empty">No NCR weeks in this range</p>`.
  - `BuildingTable({ rows }: { rows: BuildingBar[] })`:
    - Sort state is `{ key: 'building' | 'finals' | 'sors' | 'total'; direction: 'ascending' | 'descending' }`, defaulting to total, descending.
    - Clicking a new numeric column sorts it descending first; clicking a new `building` column sorts it ascending first; clicking the current column toggles the direction.
    - Ties sort by building name, ascending.
    - Render `<div className="qaqc-table-wrap"><table className="qaqc-table">` with a `<thead>` whose `<th scope="col" aria-sort=…>` cells contain `<button type="button">` labels. Only the active column gets `aria-sort`; the others omit it.
    - The Total `<td>` contains the number and `<span className="qaqc-share-bar" style={{ width: \`${pct}%\` }} />`, where `pct = Math.round((total / maxTotal) * 100)` and `maxTotal` is at least 1.
- [ ] **Step 3: Verify and commit:** `feat: add window summary, NCR week list, and sortable building table`.

---

### Task 4: Expand button and animated overlay

**Files:**
- Modify: `packages/qaqc-shared/src/components/ChartPanel.tsx`
- Create: `packages/qaqc-shared/src/components/ExpandedPanel.tsx`
- Modify: `packages/qaqc-shared/src/qaqc.less`
- Test: `packages/qaqc-shared/src/__tests__/expanded.test.tsx`

- [ ] **Step 1: Write the failing tests.** In `expanded.test.tsx`:
  - `ChartPanel` with `onExpand` renders a button with `aria-label="Expand Inspections by Building"` that calls `onExpand` on click. Without `onExpand`, no button renders. With `emptyMessage` set, no button renders either.
  - `ExpandedPanel`, rendered with `getRootRect`/`getOriginRect` stubs and `animate`:
    - It renders `role="dialog"`, `aria-modal="true"`, and `aria-label` equal to the title.
    - Because jsdom has no `Element.prototype.animate`, it reaches the open state immediately: the body has the `is-revealed` class, and the children function is called with the measured size. Stub `getBoundingClientRect` as `panels.test.tsx` does.
    - Focus is on the `Collapse <title>` button.
    - Clicking collapse calls `onClosed` once. Pressing Esc on the dialog also calls `onClosed` once.
    - With `animate: true` and a stubbed `HTMLElement.prototype.animate` that returns `{ finished: Promise.resolve(), cancel(): void {} }`, the open animation runs: `animate` is called with keyframes whose first frame `width` equals the origin width in px. Restore the stub afterwards.
- [ ] **Step 2: Extend `ChartPanel`.** Add two optional props:
  - `onExpand?: () => void`
  - `sectionRef?: (element: HTMLElement | null) => void`

  Attach `ref={sectionRef}` to the `<section>`. When `onExpand` is set and `emptyMessage === null`, append this to the `<header>`:

```tsx
<button type="button" className="qaqc-icon-button qaqc-expand-button" aria-label={`Expand ${title}`} onClick={onExpand}>
  <Maximize2 size={14} aria-hidden="true" />
</button>
```

- [ ] **Step 3: Implement `ExpandedPanel.tsx`.**

```tsx
import { Minimize2, type LucideIcon } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react'

import { useElementSize, type ElementSize } from '../hooks/useElementSize'
import type { LegendItem } from './ChartPanel'

const OPEN_MS = 250
const CLOSE_MS = 220
const FADE_OUT_MS = 100
const EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

/** A box in the overlay's coordinate space: relative to the scrolling root's content origin. */
export interface PanelBox {
  top: number
  left: number
  width: number
  height: number
}

type Phase = 'opening' | 'open' | 'closing'

export interface ExpandedPanelProps {
  title: string
  icon: LucideIcon
  legend: LegendItem[]
  emptyMessage: string | null
  animate: boolean
  /** The visible area of the dashboard root (the box to expand into). */
  getRootBox: () => PanelBox
  /** The grid panel's current box; null when it is not on screen. */
  getOriginBox: () => PanelBox | null
  onClosed: () => void
  children: (size: ElementSize) => ReactNode
}

function boxFrame(box: PanelBox): Keyframe {
  return { top: `${box.top}px`, left: `${box.left}px`, width: `${box.width}px`, height: `${box.height}px` }
}

function canAnimate(element: HTMLElement): boolean {
  return typeof element.animate === 'function'
}

export function ExpandedPanel({
  title,
  icon: Icon,
  legend,
  emptyMessage,
  animate,
  getRootBox,
  getOriginBox,
  onClosed,
  children,
}: ExpandedPanelProps): ReactElement {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const collapseRef = useRef<HTMLButtonElement | null>(null)
  const [phase, setPhase] = useState<Phase>('opening')
  const [rootBox] = useState<PanelBox>(() => getRootBox())
  const [bodyRef, size] = useElementSize<HTMLDivElement>()

  useLayoutEffect(() => {
    const element = boxRef.current
    const origin = getOriginBox()
    if (!element || !animate || !origin || !canAnimate(element)) {
      setPhase('open')
      return undefined
    }
    const animation = element.animate([boxFrame(origin), boxFrame(rootBox)], { duration: OPEN_MS, easing: EASING })
    let cancelled = false
    animation.finished.then(() => {
      if (!cancelled) setPhase('open')
    }, () => undefined)
    return () => {
      cancelled = true
      animation.cancel()
    }
    // Runs once on mount: the opening animation.
  }, [])

  useEffect(() => {
    if (phase === 'open') collapseRef.current?.focus()
  }, [phase])

  function collapse(): void {
    if (phase === 'closing') return
    const element = boxRef.current
    const origin = getOriginBox()
    if (!element || !animate || !origin || !canAnimate(element)) {
      onClosed()
      return
    }
    setPhase('closing')
    window.setTimeout(() => {
      const shrink = element.animate([boxFrame(rootBox), boxFrame(origin)], { duration: CLOSE_MS, easing: EASING, fill: 'forwards' })
      shrink.finished.then(onClosed, onClosed)
    }, FADE_OUT_MS)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      collapse()
    }
  }

  const isRevealed = phase === 'open'
  return (
    <div
      ref={boxRef}
      className="qaqc-expanded"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
      style={boxFrame(rootBox)}
      onKeyDown={handleKeyDown}
    >
      <header className="qaqc-panel-title">
        <Icon size={15} aria-hidden="true" />
        <h3>{title}</h3>
        <button ref={collapseRef} type="button" className="qaqc-icon-button" aria-label={`Collapse ${title}`} onClick={collapse}>
          <Minimize2 size={14} aria-hidden="true" />
        </button>
      </header>
      {legend.length > 0 && (
        <ul className={isRevealed ? 'qaqc-legend qaqc-reveal is-revealed' : 'qaqc-legend qaqc-reveal'}>
          {legend.map((item) => (
            <li key={item.label}>
              <span className={`qaqc-legend-swatch is-${item.shape}`} style={{ background: item.color }} />
              {item.label}
            </li>
          ))}
        </ul>
      )}
      <div ref={bodyRef} className={isRevealed ? 'qaqc-expanded-body qaqc-reveal is-revealed' : 'qaqc-expanded-body qaqc-reveal'}>
        {emptyMessage !== null
          ? <p className="qaqc-chart-empty">{emptyMessage}</p>
          : isRevealed && size.width > 0 && size.height > 0 ? children(size) : null}
      </div>
    </div>
  )
}
```

  Keep `react-hooks/exhaustive-deps` out of the picture: the repo has no ESLint config for it. The comment documents why the dependency list is empty.
- [ ] **Step 4: Add the styles to `qaqc.less`.**

```less
.qaqc-panel-title .qaqc-icon-button {
  margin-left: auto;
}

.qaqc-icon-button {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--qaqc-muted);
  cursor: pointer;
  transition: background-color 150ms ease-out, color 150ms ease-out;
}

.qaqc-icon-button:hover {
  background: var(--qaqc-accent-soft);
  color: var(--qaqc-accent);
}

.qaqc-icon-button:focus-visible {
  outline: 2px solid var(--qaqc-accent);
  outline-offset: 2px;
}

.qaqc-root.is-expanded {
  overflow: hidden;
}

.qaqc-expanded {
  position: absolute;
  z-index: 5;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 14px 16px;
  overflow: hidden;
  border: 1px solid var(--qaqc-border);
  border-radius: 14px;
  background: var(--qaqc-card-solid);
  box-shadow: 0 12px 34px rgba(27, 37, 48, 0.16);
  outline: none;
}

.qaqc-expanded-body {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  margin-top: 6px;
}

.qaqc-reveal {
  opacity: 0;
  transition: opacity 120ms ease-out;
}

.qaqc-reveal.is-revealed {
  opacity: 1;
}

.qaqc-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin: 0 0 8px;
}

.qaqc-summary div {
  padding: 6px 10px;
  border: 1px solid var(--qaqc-border);
  border-radius: 10px;
  background: var(--qaqc-week-card);
}

.qaqc-summary dt {
  color: var(--qaqc-muted);
  font-size: 11px;
  font-weight: 600;
}

.qaqc-summary dd {
  margin: 2px 0 0;
  color: var(--qaqc-ink);
  font-size: 18px;
  font-weight: 650;
}

.qaqc-issue-list {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.qaqc-issue-list li {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 10px;
  padding: 6px 10px;
  border: 1px solid var(--qaqc-border);
  border-radius: 8px;
  color: var(--qaqc-ink-2);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.qaqc-issue-list strong {
  color: var(--qaqc-ink);
}

.qaqc-table-wrap {
  height: 100%;
  overflow-y: auto;
}

.qaqc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
}

.qaqc-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 0;
  border-bottom: 1px solid var(--qaqc-border);
  background: var(--qaqc-card-solid);
  text-align: right;
}

.qaqc-table th:first-child,
.qaqc-table td:first-child {
  text-align: left;
}

.qaqc-table th button {
  width: 100%;
  padding: 8px 10px;
  border: 0;
  background: transparent;
  color: var(--qaqc-muted);
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-align: inherit;
  text-transform: uppercase;
}

.qaqc-table th[aria-sort] button {
  color: var(--qaqc-accent);
}

.qaqc-table td {
  padding: 7px 10px;
  border-bottom: 1px solid var(--qaqc-hairline);
  color: var(--qaqc-ink);
  text-align: right;
}

.qaqc-share-bar {
  display: block;
  height: 3px;
  margin-top: 4px;
  margin-left: auto;
  border-radius: 2px;
  background: var(--qaqc-series-1);
}

.qaqc-expanded-split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 14px;
  height: 100%;
}

.qaqc-expanded-stack {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.qaqc-expanded-stack > .qaqc-chart-fill,
.qaqc-expanded-split > .qaqc-chart-fill {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
}
```

- [ ] **Step 5: Verify and commit:** `feat: add chart expand button and animated expanded panel`.

---

### Task 5: Wire expansion into `InspectionDashboard`

**Files:** `packages/qaqc-shared/src/components/InspectionDashboard.tsx`, `packages/qaqc-shared/src/__tests__/InspectionDashboard.test.tsx`, `packages/qaqc-shared/src/hooks/useElementSize.ts` (reuse only)

- [ ] **Step 1: Write the failing tests.** In `InspectionDashboard.test.tsx`, in the describe block that stubs element size:
  - Each of the three panels has an expand button.
  - Clicking `Expand Inspections by Building` opens a dialog labelled `Inspections by Building` that contains a `table.qaqc-table` with 19 body rows (all Electrical buildings in the window).
  - Pressing Esc closes the dialog and moves focus back to the `Expand Inspections by Building` button.
  - Expanding `Finals + SORs by Work Week` shows `.qaqc-summary` and `.qaqc-bar-value` labels.
  - Expanding `NCR Pass Rate Trend` shows `.qaqc-issue-list` with 2 items, WW23'2026 first.
  - With `interactive={false}`, no expand buttons render.
  - While expanded, changing the week dropdown keeps the dialog open and updates the cards.
- [ ] **Step 2: Implement.**
  - Add `type PanelId = 'trend' | 'passRate' | 'buildings'`, state `expanded: PanelId | null`, a `rootRef` on the `.qaqc-root` div, and `panelRefs = useRef<Record<PanelId, HTMLElement | null>>({ trend: null, passRate: null, buildings: null })`.
  - Box helpers, relative to the root's scroll content:

```ts
function rootBox(root: HTMLElement): PanelBox {
  return { top: root.scrollTop, left: 0, width: root.clientWidth, height: root.clientHeight }
}

function originBox(root: HTMLElement, panel: HTMLElement | null): PanelBox | null {
  if (!panel) return null
  const rootRect = root.getBoundingClientRect()
  const rect = panel.getBoundingClientRect()
  return { top: rect.top - rootRect.top + root.scrollTop, left: rect.left - rootRect.left, width: rect.width, height: rect.height }
}
```

  - Each `ChartPanel` gets `sectionRef={(element) => { panelRefs.current[id] = element }}`. It also gets `onExpand={interactive ? () => setExpanded(id) : undefined}`.
  - Add `is-expanded` to the root class while `expanded !== null`.
  - After the charts grid, when `expanded !== null` and `!isCardsOnly`, render `<ExpandedPanel key={expanded} …>`:
    - title, icon, and legend come from the same per-panel config as the grid panels. Factor that config into one `PANELS` lookup built inside the component, so it isn't duplicated.
    - `emptyMessage` is the same as for that panel.
    - `animate`
    - `getRootBox={() => rootBox(rootRef.current)}`, guarding against a null root with a zero box.
    - `getOriginBox={() => originBox(rootRef.current, panelRefs.current[expanded])}`
    - `onClosed`: call `setExpanded(null)`, then focus `panelRefs.current[id]?.querySelector('.qaqc-expand-button')` in a `requestAnimationFrame`.
  - Detail content:
    - `trend`: a `<div className="qaqc-expanded-stack">` holding `<WindowSummary totals={model.windowTotals} />`, then `<div className="qaqc-chart-fill">` containing `<StackedBarChart … showValues />`. Size the chart from the fill div with `useElementSize` inside a small local component, `ExpandedTrend`, so the chart gets the fill's size rather than the whole body's.
    - `passRate`: `<div className="qaqc-expanded-split">` holding a fill div with `<LineChart … labelIssueWeeks />` and `<IssueWeekList points={model.passRateTrend} />`.
    - `buildings`: `<BuildingTable rows={model.allBuildings} />`.
  - When `isCardsOnly` turns true while a panel is expanded, render nothing for the overlay. Keep `expanded` unchanged; it reappears if the size grows again.
- [ ] **Step 3: Verify and commit:** `feat: expand any QAQC chart to fill the visual`.

---

### Task 6: Preview, verification, and release prep

- [ ] **Step 1: Preview containing block.** In both `packages/qaqc-electrical/dev/index.html` and the Mechanical harness (added in Mechanical plan Task 5 Step 1), `#frame` already has `position: relative`. Add `overflow: hidden` to it so the expanded overlay is clipped to the frame like the Power BI visual's iframe.
- [ ] **Step 2: Visual verification (controller).** For each of the three charts, expand and collapse at 1280×720. Expect:
  - smooth growth from the panel's spot, with no content reflow during the animation;
  - detail content that fades in;
  - collapse that returns to the same spot;
  - Esc and focus return working.

  Also check:
  - compact width 800, after scrolling;
  - Ivory and LotusWorks presets;
  - high contrast;
  - the All range with 500k synthetic rows;
  - `prefers-reduced-motion` emulation, which must be instant.
- [ ] **Step 3: Electrical version bump.** Set `packages/qaqc-electrical/package.json` to `1.1.0` and `pbiviz.json` `visual.version` to `1.1.0.0`. Update `LotusWorks_Package/QAQC_Electrical_SETUP.md` (and the Business copy) under "Use it" with: `Click the expand icon on any chart to fill the visual with more detail; press Esc or the collapse icon to return.`

  Then the Mechanical plan's Task 5 runs as written, with these additions: Electrical's `.pbiviz` is rebuilt and synced as 1.1.0, not restored, and a second zip is created, `releases/LotusWorks_Package_2026-10-15_QAQC-Electrical-1.1.0.zip`. The sync then changes the Electrical and Mechanical files only. Remove the old `qaqcElectrical_…1.0.0.0.pbiviz` from both package folders (the sync scripts clear old `.pbiviz` files automatically) and confirm that only `1.1.0.0` remains.
