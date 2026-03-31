# Final Deep Audit A -- 8 Visuals

**Date:** 2026-03-18
**Visuals:** animated-donut-pro, animated-waterfall, bar-race, box-plot, bullet-chart-pro, bump-chart, chord-diagram, dumbbell-chart

---

## 1. animated-donut-pro

### capabilities.json <-> settings.ts sync
Clean -- all 16 capability objects map to settings cards (8 local + 8 shared).

### Missing `.visible = false`
Clean -- all conditional visibility toggles are wired.

### TypeScript safety (`.value.value` without `?.`)
Clean -- all `.value?.value` patterns use optional chaining.

### Tooltip completeness
Clean -- segments have tooltipService show/move/hide with formatted values + percentages.

### Legend wired correctly
Clean -- `renderSharedLegend` builds items from segment data with correct colors and passes to shared `renderLegend`.

### Color theme wired
Clean -- `resolveColorTheme(this.settings.colorThemeFormattingCard)` called in `extractData`, result passed to `getHostChartColor`.

### Issues: **None**

---

## 2. animated-waterfall

### capabilities.json <-> settings.ts sync
Clean -- all 24 capability objects map to settings cards (12 local + 12 shared).

### Missing `.visible = false`
Clean -- subtotal, drill-down, value label, summary, connector, and total-bar sub-settings all gated.

### TypeScript safety
Clean.

### Tooltip completeness
Clean -- bars have tooltipService with Step, Change/Total/Subtotal, Running Total, all formatted.

### Legend wired correctly
Clean -- legend renders Increase/Decrease/Total items with theme-resolved colors.

### Color theme wired
Clean -- `resolveColorTheme` called, result applied to positive/negative/total/subtotal colors.

### Issues: **None**

---

## 3. bar-race

### capabilities.json <-> settings.ts sync
Clean -- all 20 capability objects map to settings cards (8 local + 12 shared).

### Missing `.visible = false`
Clean -- timestamp, playback, period label sub-settings all gated.

### TypeScript safety
Clean -- `ts.position.value?.value` uses optional chaining (line 583).

### Tooltip completeness
Clean -- bars have tooltipService with Category, Value, Period, all formatted.

### Legend wired correctly
Clean -- legend renders category names with palette colors.

### Color theme wired
Clean -- `resolveColorTheme` called in `extractData`, result used for palette assignment.

### Issues: **None**

---

## 4. box-plot

### capabilities.json <-> settings.ts sync
Clean -- all 21 capability objects map to settings cards (8 local + 13 shared). Note: local `axisSettings` card is declared but intentionally excluded from the `cards` array (backward compat only).

### Missing `.visible = false`

**BUG: `meanMarkerSettings.strokeWidth` not hidden when mean marker is off**

File: `packages/box-plot/src/visual.ts` lines 234-236
When `show` is false, `shape`, `color`, and `size` are hidden, but `strokeWidth` is left visible. The user sees a "Stroke Width" slider with no effect when the mean marker is turned off.

**Fix:** Add `this.settings.meanMarkerSettings.strokeWidth.visible = meanOn;` after line 236.

### TypeScript safety
Clean.

### Tooltip completeness
Clean -- box tooltips show Category, Max, Q3, Median, Q1, Min, Outliers count. Outlier tooltips show individual values. All formatted.

### Legend wired correctly
Clean -- legend renders category names; per-category colors resolved from theme.

### Color theme wired
Clean -- `resolveColorTheme` used in `populateSeriesGroups`, `renderSharedLegend`, and `applyPerCategoryColors`.

### Issues found: **1**

---

## 5. bullet-chart-pro

### capabilities.json <-> settings.ts sync
Clean -- all 18 capability objects map to settings cards (5 local + 13 shared).

### Missing `.visible = false`
Clean -- forecast, comparison sub-settings all gated.

### TypeScript safety
Clean.

### Tooltip completeness
Clean -- bars have Category, Value, Target, Poor, Satisfactory, Good, all formatted.

### Legend wired correctly
Clean -- legend renders Poor/Satisfactory/Good items with theme-resolved colors.

### Color theme wired
Clean -- `resolveColorTheme` called, result applied to all range and bar colors.

### Issues: **None**

---

## 6. bump-chart

### capabilities.json <-> settings.ts sync
Clean -- all 21 capability objects map to settings cards (5 local + 16 shared).

### Missing `.visible = false`

**BUG: `bumpRankChangeSettings` -- positiveColor, negativeColor, and showComparison not hidden when `show` is off**

File: `packages/bump-chart/src/visual.ts` lines 157-161
When `bumpRankChangeSettings.show` is false, the following properties are hidden: `fontSize`, `fontColor`, `fontFamily`, `fontWeight`. However, `positiveColor`, `negativeColor`, and `showComparison` remain visible in the formatting pane even though they have no effect when rank change indicators are turned off.

**Fix:** Add after line 161:
```typescript
this.settings.bumpRankChangeSettings.positiveColor.visible = rcShow;
this.settings.bumpRankChangeSettings.negativeColor.visible = rcShow;
this.settings.bumpRankChangeSettings.showComparison.visible = rcShow;
```

### TypeScript safety
Clean.

### Tooltip completeness
Clean -- lines and dots both have tooltipService with Series, Time, Rank, Value (formatted via `formatWithSettings`).

### Legend wired correctly
Clean -- `renderBumpLegend` builds items from data with correct colors, passed to shared `renderLegend`.

### Color theme wired
Clean -- `resolveColorTheme` called in `extractData`, result used for palette color assignment.

### Issues found: **1**

---

## 7. chord-diagram

### capabilities.json <-> settings.ts sync
Clean -- all 14 capability objects map to settings cards (6 local + 8 shared). Note: chord uses its own `ChordColorThemeSettings` (with `useChartPalette` + `colorTheme` properties) instead of the shared `ColorThemeFormattingCard` which only has `colorTheme`. This is intentional since chord needs palette toggling.

### Missing `.visible = false`
Clean -- `dimOpacity` hidden when filtering disabled.

### TypeScript safety
Clean.

### Tooltip completeness
Clean -- arcs show Entity + Total Flow (formatted). Ribbons show Source, Target, Value, % of Total, % of Source, all formatted.

### Legend wired correctly
Clean -- legend renders entity names with resolved colors.

### Color theme wired
Clean -- chord's custom implementation uses `resolveDropdown(this.settings.colorThemeFormattingCard.colorTheme)` directly, bypassing `resolveColorTheme`. Functionally correct.

### Memory leak: keyboard nav cleanup not stored

**BUG: `attachKeyboardNav` return value discarded -- event listeners leak on re-render**

File: `packages/chord-diagram/src/visual.ts` line 718
The call to `attachKeyboardNav({...})` returns a cleanup function, but the return value is not captured or pushed into `cancelAnimations`. Every time `update()` is called, new keyboard event listeners are attached to the container without removing the old ones. This causes accumulating event listeners (memory leak) and potentially duplicated keyboard navigation behavior.

**Fix:** Change line 718 to:
```typescript
const kbCleanup = attachKeyboardNav({
```
And add after line 724:
```typescript
this.cancelAnimations.push(kbCleanup);
```

### Issues found: **1**

---

## 8. dumbbell-chart

### capabilities.json <-> settings.ts sync
Clean -- all 20 capability objects map to settings cards (6 local + 14 shared).

### Missing `.visible = false`
Clean -- arrow, grouping separator, and delta label sub-settings all gated.

### TypeScript safety
Clean.

### Tooltip completeness
Clean -- dots have tooltipService with Category, Start/End label, value (formatted).

### Legend wired correctly
Clean -- legend renders Start/End items with theme-resolved colors.

### Color theme wired
Clean -- `resolveColorTheme` called, result used for start/end color defaults.

### Issues: **None**

---

## Summary

| Visual | Status | Issues |
|--------|--------|--------|
| animated-donut-pro | Clean | 0 |
| animated-waterfall | Clean | 0 |
| bar-race | Clean | 0 |
| box-plot | **Bug** | 1 -- `meanMarkerSettings.strokeWidth` not hidden when mean marker off |
| bullet-chart-pro | Clean | 0 |
| bump-chart | **Bug** | 1 -- `bumpRankChangeSettings` positiveColor/negativeColor/showComparison not hidden when show off |
| chord-diagram | **Bug** | 1 -- `attachKeyboardNav` cleanup not stored, leaks event listeners |
| dumbbell-chart | Clean | 0 |

**Total issues: 3**

All three bugs are low-to-medium severity:
- Box-plot and bump-chart issues are cosmetic (extra properties visible in format pane when parent toggle is off).
- Chord-diagram issue is a functional memory leak that accumulates keyboard event listeners on each re-render.
