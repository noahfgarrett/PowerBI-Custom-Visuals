# Deep Audit D -- 7 Visuals (2026-03-18)

Visuals audited: status-indicator, stream-graph, sunburst-chart, timeline-milestone, treemap-pro, waffle-chart, bar-chart-pro

---

## 1. status-indicator

### BUG: `statusFontWeight` default value does not match any dropdown item
- **File:** `packages/status-indicator/src/settings.ts` line 166
- **Issue:** Default value is `{ value: '500', displayName: 'Normal' }` but the items list only contains `'normal'`, `'bold'`, and `'600'`. The value `'500'` is not a valid option in the dropdown. Power BI will silently fall back, but the user sees "Normal" while the actual CSS value is `500` (which renders differently from `normal` on some fonts).
- **Fix:** Change `value: '500'` to `value: 'normal'` to match the first item.

### BUG: `level5Color.visible` uses wrong threshold
- **File:** `packages/status-indicator/src/visual.ts` line 112
- **Issue:** `this.settings.thresholdSettings.level5Color.visible = levelCountNum > 3;` -- this shows the Level 5 Color picker when level count is 4, but level 5 is only used when level count is 5. The picker is misleadingly visible for a setting that has no effect.
- **Fix:** Change to `levelCountNum > 4`.

### Clean on other checks
- capabilities.json <-> settings.ts: Synced. All 10 objects match.
- visual.ts references: Valid.
- Tooltip: Complete (label, value, status, thresholds).
- Legend: Renders good/warning/critical -- missing level4/level5 items when levelCount > 3.
- Color theme wiring: Wired via `resolveColorTheme` + `getHostChartColor`.

---

## 2. stream-graph

### BUG: capabilities.json missing `crosshairOpacity` property
- **File:** `packages/stream-graph/capabilities.json` object `crosshairFormatting`
- **Issue:** The shared `CrosshairFormattingCard` in `core/shared-settings.ts` defines `crosshairOpacity` (a NumUpDown), and the card includes it in its `slices` array. But stream-graph's `capabilities.json` `crosshairFormatting` object only has 5 properties (`showCrosshair`, `crosshairLineColor`, `crosshairLineWidth`, `crosshairLineStyle`, `showCrosshairValues`) and is missing `crosshairOpacity`. This means the opacity setting exists in the formatting model but Power BI cannot persist it -- the value will always reset to default on reload.
- **Fix:** Add `"crosshairOpacity": { "displayName": "Opacity (%)", "type": { "numeric": true } }` to `crosshairFormatting.properties`.

### Clean on other checks
- capabilities.json <-> settings.ts: Synced except for the crosshairOpacity gap above.
- visual.ts references: Valid.
- `.visible = false`: Properly hides axis duplicates, reference line axis, trend line axis, annotation sub-settings.
- Tooltip: Complete.
- Legend: Renders from series names.
- Color theme wiring: Wired.

---

## 3. sunburst-chart

### Clean
- capabilities.json <-> settings.ts: All objects synced.
- visual.ts references: Valid.
- `.visible = false`: Comprehensive -- hides center content sub-settings, percentOf, breadcrumb sub-settings, animation duration, data label showDataLabels and position.
- Tooltip: Complete (node, value, % of total, % of parent).
- Legend: Renders from level-1 nodes.
- Color theme wiring: Wired.
- Null safety: Proper guards throughout.

---

## 4. timeline-milestone

### Clean
- capabilities.json <-> settings.ts: All objects synced.
- visual.ts references: Valid.
- `.visible = false`: Comprehensive -- hides date format when showDates off, today line sub-settings, cluster threshold, duration bar sub-settings, animation duration, axis properties.
- Tooltip: Complete.
- Legend: Renders from categories.
- Color theme wiring: Wired.

---

## 5. treemap-pro

### Clean
- capabilities.json <-> settings.ts: All objects synced. Correctly uses `cardStyleMode` enumeration.
- visual.ts references: Valid.
- `.visible = false`: Properly hides drill-down sub-settings, heat color sub-settings, percentage sub-settings, animation duration.
- Tooltip: Complete.
- Legend: Renders from level-1 nodes.
- Color theme wiring: Wired.

---

## 6. waffle-chart

### Clean
- capabilities.json <-> settings.ts: All 14 objects synced.
- visual.ts references: Valid.
- `.visible = false`: Properly hides pictogram sub-settings, value sub-settings, animation duration.
- Tooltip: Complete.
- Legend: Renders filled/empty categories.
- Color theme wiring: Wired.

---

## 7. bar-chart-pro

### ISSUE: Missing `varianceFontSize.visible` when variance is off
- **File:** `packages/bar-chart-pro/src/visual.ts`
- **Issue:** When `varianceSettings.show` is false, the code hides `compareAgainst`, `customValue`, `showDelta`, `showArrow`, `positiveColor`, and `negativeColor` -- but omits `varianceFontSize`. The font size picker remains visible in the format pane even when variance indicators are disabled.
- **Fix:** Add `s.varianceSettings.varianceFontSize.visible = varianceOn;` alongside the other variance visibility controls (after line 222).

### ISSUE: Missing `cellTitleFontSize.visible` and `cellTitleFontColor.visible` when small multiples is off
- **File:** `packages/bar-chart-pro/src/visual.ts`
- **Issue:** When `smallMultiplesSettings.enabled` is false, the code hides `columns` and `syncYAxis` but not `cellTitleFontSize` and `cellTitleFontColor`. These font settings remain visible even when small multiples is disabled.
- **Fix:** Add `s.smallMultiplesSettings.cellTitleFontSize.visible = smEnabled;` and `s.smallMultiplesSettings.cellTitleFontColor.visible = smEnabled;` alongside the other small multiples visibility controls (after line 269).

### ISSUE: Missing `minCategoryWidth.visible` when scroll is off
- **File:** `packages/bar-chart-pro/src/visual.ts`
- **Issue:** The `scrollFormattingCard.minCategoryWidth` setting is always visible even when `enableScroll` is false. The min width setting is meaningless when scrolling is disabled.
- **Fix:** Add `s.scrollFormattingCard.minCategoryWidth.visible = s.scrollFormattingCard.enableScroll.value;`.

### ISSUE: Crosshair sub-settings not hidden when `showCrosshair` is off
- **File:** `packages/bar-chart-pro/src/visual.ts`
- **Issue:** No visibility controls for crosshair sub-settings. When `showCrosshair` is off, `crosshairLineColor`, `crosshairLineWidth`, `crosshairLineStyle`, `crosshairOpacity`, and `showCrosshairValues` remain visible.
- **Fix:** Add visibility gating for all crosshair sub-settings keyed to `s.crosshairFormattingCard.showCrosshair.value`.

### Clean on other checks
- capabilities.json <-> settings.ts: All 30 objects synced. Waterfall, lollipop, crosshair, pareto, small multiples, zoom -- all have matching capabilities.json entries.
- visual.ts references: Valid.
- Tooltip: Complete.
- Legend: Renders from series.
- Color theme wiring: Wired.
- Null safety: Proper guards.

---

## Summary

| Visual | Issues Found |
|---|---|
| status-indicator | 2 bugs (statusFontWeight default mismatch, level5Color visibility threshold) |
| stream-graph | 1 bug (missing crosshairOpacity in capabilities.json) |
| sunburst-chart | Clean |
| timeline-milestone | Clean |
| treemap-pro | Clean |
| waffle-chart | Clean |
| bar-chart-pro | 4 issues (varianceFontSize, cellTitleFont*, minCategoryWidth, crosshair sub-settings -- all missing `.visible` gating) |

**Total: 7 issues across 3 visuals. 4 visuals clean.**
