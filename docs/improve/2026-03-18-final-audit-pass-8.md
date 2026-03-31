# Pass 8: Cross-Visual Consistency Check

**Date**: 2026-03-18
**Scope**: All 31 Power BI visuals in `packages/`

---

## Master Consistency Table

| # | Visual | destroy() | selectionMgr | tooltipService | Card Style | Title | Accessibility | Color Theme | Empty State |
|---|--------|-----------|-------------|----------------|------------|-------|---------------|-------------|-------------|
| 1 | animated-donut-pro | PASS | PASS | PASS | PASS (applyCardStyle) | PASS | PASS | PASS | PASS |
| 2 | animated-waterfall | PASS | PASS | PASS | PASS (applyGlassStyle) | PASS | PASS | MISS | PASS |
| 3 | bar-chart-pro | PASS | PASS | PASS | PASS (applyCardStyle) | PASS | PASS | PASS | PASS |
| 4 | bar-race | PASS | PASS | PASS | PASS (applyGlassStyle) | PASS | PASS | PASS | PASS |
| 5 | box-plot | PASS | PASS | PASS | PASS (applyGlassStyle) | PASS | PASS | PASS | PASS |
| 6 | bullet-chart-pro | PASS | PASS | PASS | PASS (applyGlassStyle) | PASS | PASS | MISS | PASS |
| 7 | bump-chart | WARN | PASS | MISS | PASS (applyGlassStyle) | PASS | PASS | PASS | PASS |
| 8 | chord-diagram | WARN | PASS | MISS | PASS (applyGlassStyle) | PASS | PASS | PASS | PASS |
| 9 | dumbbell-chart | PASS | PASS | PASS | PASS (applyGlassStyle) | PASS | PASS | PASS | PASS |
| 10 | funnel-pro | PASS | PASS | PASS | PASS (applyGlassStyle) | PASS | PASS | PASS | PASS |
| 11 | gantt-chart-pro | WARN | PASS | PASS | PASS (applyGlassStyle) | PASS | PASS | PASS | PASS |
| 12 | gauge-cluster | WARN | PASS | PASS | PASS (applyGlassStyle) | PASS | PASS | MISS | PASS |
| 13 | health-bar | PASS | PASS | MISS | PASS (applyCardStyle) | PASS | PASS | MISS | PASS |
| 14 | heatmap-calendar | PASS | PASS | MISS | PASS (applyGlassStyle) | PASS | PASS | MISS | PASS |
| 15 | kpi-card | WARN | PASS | PASS | PASS (applyCardStyle) | PASS | PASS | PASS | PASS |
| 16 | morphing-area-chart | PASS | PASS | PASS | PASS (applyGlassStyle) | PASS | PASS | PASS | PASS |
| 17 | network-graph | PASS | PASS | PASS | PASS (applyGlassStyle) | PASS | PASS | PASS | PASS |
| 18 | polar-chart | WARN | PASS | PASS | PASS (applyGlassStyle) | PASS | PASS | PASS | PASS |
| 19 | progress-bar-stack | WARN | PASS | PASS | PASS (applyGlassStyle) | PASS | PASS | PASS | PASS |
| 20 | radar-chart | PASS | PASS | PASS | PASS (applyGlassStyle) | PASS | PASS | PASS | PASS |
| 21 | radial-gauge | FAIL | MISS | PASS | PASS (applyGlassStyle) | PASS | WARN | MISS | PASS |
| 22 | ring-stack | WARN | PASS | PASS | PASS (applyGlassStyle) | PASS | PASS | PASS | PASS |
| 23 | sankey-diagram | WARN | PASS | MISS | PASS (applyCardStyle) | PASS | PASS | PASS | PASS |
| 24 | scatter-bubble | PASS | PASS | PASS | PASS (applyGlassStyle) | PASS | PASS | PASS | PASS |
| 25 | slope-chart | WARN | PASS | MISS | PASS (applyGlassStyle) | PASS | PASS | PASS | PASS |
| 26 | status-indicator | WARN | PASS | PASS | PASS (applyGlassStyle) | PASS | PASS | MISS | PASS |
| 27 | stream-graph | WARN | PASS | MISS | PASS (applyGlassStyle) | PASS | PASS | PASS | PASS |
| 28 | sunburst-chart | WARN | PASS | PASS | PASS (applyGlassStyle) | PASS | PASS | PASS | PASS |
| 29 | timeline-milestone | WARN | PASS | PASS | PASS (applyGlassStyle) | PASS | PASS | PASS | PASS |
| 30 | treemap-pro | PASS | PASS | PASS | PASS (applyCardStyle) | PASS | PASS | PASS | PASS |
| 31 | waffle-chart | WARN | PASS | PASS | PASS (applyGlassStyle) | PASS | PASS | PASS | MISS |

**Legend**: PASS = fully compliant, WARN = partially compliant (minor gap), MISS = feature absent, FAIL = significant gap

---

## 1. destroy() Completeness

Every visual has a `destroy()` method. The expected pattern is:
- Cancel animations (`cancelAnimations` array)
- Remove `handleBackgroundClick` event listener
- Clear container children (`while (firstChild) removeChild`)

### Fully Complete (cancel + remove listener + clear children): 13 visuals

animated-donut-pro, animated-waterfall, bar-chart-pro, box-plot, bullet-chart-pro, dumbbell-chart, funnel-pro, health-bar, heatmap-calendar, morphing-area-chart, network-graph, radar-chart, scatter-bubble, treemap-pro

### Missing Container Clear (cancel + remove listener, NO child clearing): 15 visuals

| Visual | Cancels Anims | Removes Listener | Clears Children | Extra Cleanup |
|--------|--------------|-----------------|-----------------|---------------|
| bump-chart | Yes | Yes | **No** | Sets svg = null |
| chord-diagram | Yes | Yes | **No** | Sets svg = null |
| gantt-chart-pro | Yes | Yes | **No** | Calls hideTooltip |
| gauge-cluster | Yes | Yes | **No** | Calls hideTooltip, clears previousValues |
| kpi-card | Yes | Yes | **No** | Calls hideTooltip |
| polar-chart | Yes | Yes | **No** | Calls hideTooltip |
| progress-bar-stack | Yes | Yes | **No** | Calls keyboardNavCleanup |
| ring-stack | Yes | Yes | **No** | Calls hideTooltip |
| sankey-diagram | Yes | Yes | **No** | Sets svg = null |
| slope-chart | Yes | Yes | **No** | Sets svg = null |
| status-indicator | Yes | Yes | **No** | Calls hideTooltip |
| stream-graph | Yes | Yes | **No** | Sets svg = null |
| sunburst-chart | Yes | Yes | **No** | Calls hideTooltip |
| timeline-milestone | Yes | Yes | **No** | Calls hideTooltip |
| waffle-chart | Yes | Yes | **No** | Calls hideTooltip |

### Missing Listener Removal: 1 visual

| Visual | Cancels Anims | Removes Listener | Clears Children | Notes |
|--------|--------------|-----------------|-----------------|-------|
| **radial-gauge** | Yes | **No** (no handleBackgroundClick exists) | **No** | Also no selectionManager |

**Impact**: Low for Power BI visuals since the host manages lifecycle, but leaving orphaned DOM nodes in `destroy()` is a hygiene concern. The container is typically discarded by the host anyway.

**Recommendation**: Add `while (this.container.firstChild) this.container.removeChild(this.container.firstChild)` to the 16 visuals missing it.

---

## 2. selectionManager

**30 of 31 visuals** create a `selectionManager` in the constructor via `host.createSelectionManager()`.

### Missing: 1 visual

- **radial-gauge** -- Does not create a selectionManager. This is the only single-value gauge visual; it has no clickable data points that would need cross-filtering. Acceptable for its use case but inconsistent with the rest of the codebase.

---

## 3. tooltipService

**21 of 31 visuals** use the standard `host.tooltipService.show/move/hide` pattern.

### Using SVG `<title>` elements instead of tooltipService: 4 visuals

| Visual | Tooltip Method | Details |
|--------|---------------|---------|
| **bump-chart** | `path.append('title')` | Line + dot tooltips use SVG title text |
| **chord-diagram** | `document.createElementNS('title')` | Group arcs + ribbons use SVG title elements |
| **sankey-diagram** | `.append('title')` | Link paths + node groups use SVG title |
| **stream-graph** | `layers.append('title')` | Layer areas use SVG title |
| **slope-chart** | `path.append('title')` | Line paths use SVG title |

### No tooltip at all: 2 visuals

| Visual | Notes |
|--------|-------|
| **heatmap-calendar** | No tooltip mechanism found in visual.ts |
| **health-bar** | No tooltip mechanism found in visual.ts |

**Impact**: SVG `<title>` provides browser-native tooltips (plain text, no formatting, delayed appearance). The Power BI `tooltipService` provides rich, themed tooltips consistent with the platform.

**Recommendation**: Migrate the 5 SVG-title visuals to `tooltipService.show/move/hide`. Add basic tooltips to heatmap-calendar and health-bar.

---

## 4. Card Style (glass/elevated)

**All 31 visuals** call either `applyCardStyle()` or `applyGlassStyle()`.

### Using newer `applyCardStyle` API (from core): 7 visuals
animated-donut-pro, bar-chart-pro, health-bar, kpi-card, sankey-diagram, treemap-pro

(Note: animated-donut-pro calls the core `applyCardStyle` with a `CardStyleMode` parameter supporting glass/elevated/none)

### Using older `applyGlassStyle` API: 24 visuals
All remaining visuals use `applyGlassStyle()` with a boolean `enableGlass` toggle.

**Inconsistency**: Two different APIs for the same feature. The newer `applyCardStyle` supports `glass`, `elevated`, and `none` modes; the older `applyGlassStyle` only supports glass on/off.

**Recommendation**: Migrate the 24 `applyGlassStyle` visuals to `applyCardStyle` for consistency and the richer mode options.

---

## 5. Title Rendering

**All 31 visuals** call `renderChartTitle(this.container, this.settings.titleFormattingCard)`.

No gaps found.

---

## 6. Accessibility

**All 31 visuals** import and call the accessibility trio: `attachKeyboardNav`, `applyChartAria`, `ensureFocusRingStyles`.

### One partial gap:

- **radial-gauge** -- Imports `applyChartAria` and `ensureFocusRingStyles` but does NOT import or call `attachKeyboardNav`. This means the gauge renders ARIA attributes and focus ring styles, but keyboard navigation between focusable elements is not wired up.

All other 30 visuals have all three functions.

---

## 7. Color Theme

**23 of 31 visuals** support color themes via `resolveColorTheme()` / `getHostChartColor()` / `colorThemeFormattingCard`.

### Missing color theme support: 8 visuals

| Visual | Notes |
|--------|-------|
| **animated-waterfall** | No `resolveColorTheme` or `colorThemeFormattingCard` usage |
| **bullet-chart-pro** | No color theme support; uses hardcoded colors from settings |
| **gauge-cluster** | No `resolveColorTheme` usage |
| **health-bar** | No `resolveColorTheme` usage |
| **heatmap-calendar** | No `resolveColorTheme` usage |
| **radial-gauge** | No `resolveColorTheme` usage |
| **status-indicator** | No `resolveColorTheme` usage |
| **slope-chart** | Uses `getHostChartColor` but does NOT use `resolveColorTheme` or `colorThemeFormattingCard` |

**Note**: `slope-chart` calls `getHostChartColor` directly but always passes the default theme -- it never resolves a user-selected theme.

**Recommendation**: Add `colorThemeFormattingCard` settings and `resolveColorTheme()` calls to the 8 missing visuals so users can switch color palettes.

---

## 8. Empty State

**30 of 31 visuals** render a helpful empty-state message when no data is provided.

### Missing empty state: 1 visual

| Visual | Behavior When No Data |
|--------|----------------------|
| **waffle-chart** | Renders a grid of empty cells (all using `emptyColor`). No text message indicates that data fields need to be added. The visual shows the waffle grid structure but with 0% fill. |

All other 30 visuals display a text message like "Add a Category and Value to get started." or similar.

**Recommendation**: Add an explicit empty-state div with instructional text to waffle-chart when `data.value === null`.

---

## Summary of Critical Findings

### High Priority (functional gaps)

| Issue | Affected Visuals | Count |
|-------|-----------------|-------|
| Missing `tooltipService` (SVG title fallback) | bump-chart, chord-diagram, sankey-diagram, stream-graph, slope-chart | 5 |
| Missing tooltips entirely | heatmap-calendar, health-bar | 2 |
| Missing color theme support | animated-waterfall, bullet-chart-pro, gauge-cluster, health-bar, heatmap-calendar, radial-gauge, status-indicator, slope-chart | 8 |

### Medium Priority (consistency gaps)

| Issue | Affected Visuals | Count |
|-------|-----------------|-------|
| `destroy()` does not clear container children | bump-chart, chord-diagram, gantt-chart-pro, gauge-cluster, kpi-card, polar-chart, progress-bar-stack, ring-stack, sankey-diagram, slope-chart, status-indicator, stream-graph, sunburst-chart, timeline-milestone, waffle-chart, radial-gauge | 16 |
| Using older `applyGlassStyle` instead of `applyCardStyle` | 24 visuals (all except animated-donut-pro, bar-chart-pro, health-bar, kpi-card, sankey-diagram, treemap-pro, and the ones using local wrappers) | 24 |
| Missing empty state message | waffle-chart | 1 |

### Low Priority (edge cases)

| Issue | Affected Visuals | Count |
|-------|-----------------|-------|
| No `selectionManager` | radial-gauge | 1 |
| No `attachKeyboardNav` (partial a11y) | radial-gauge | 1 |
| No `handleBackgroundClick` in destroy | radial-gauge | 1 |

---

## Overall Score: 31 Visuals

| Check | Pass | Warn | Miss/Fail |
|-------|------|------|-----------|
| destroy() completeness | 14 | 16 | 1 |
| selectionManager | 30 | 0 | 1 |
| tooltipService | 21 | 3 | 7 |
| Card style | 31 | 0 | 0 |
| Title rendering | 31 | 0 | 0 |
| Accessibility | 30 | 1 | 0 |
| Color theme | 23 | 0 | 8 |
| Empty state | 30 | 0 | 1 |

**Most consistent visual**: animated-donut-pro, bar-chart-pro, box-plot, funnel-pro, morphing-area-chart, network-graph, scatter-bubble, treemap-pro (all 8 checks pass).

**Least consistent visual**: radial-gauge (fails destroy, selectionManager, color theme, partial accessibility).
