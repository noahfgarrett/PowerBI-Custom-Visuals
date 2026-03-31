# Deep Audit Pass C -- 8 Visuals (2026-03-18)

**Visuals:** polar-chart, progress-bar-stack, radar-chart, radial-gauge, ring-stack, sankey-diagram, scatter-bubble, slope-chart

---

## 1. polar-chart

### Check 3 -- Missing `.visible = false` on hidden shared properties
- **ISSUE**: `axisFormattingCard.axisLabelFontWeight` is not hidden. Polar-chart hides most axis sub-properties but forgets `axisLabelFontWeight`. Since font-family and rotation are hidden, font-weight should be too for consistency.
- **ISSUE**: `axisFormattingCard.axisLabelColor` and `axisFormattingCard.axisLabelSize` remain visible but polar-chart renders its own radial labels from `labelSettings`. These shared axis label color/size controls only apply to the value-labels-outside-petals block, which could confuse users seeing two separate "label color" controls.

### Check 5 -- TypeScript null safety
- **ISSUE**: `visual.ts:562` -- `s.dataLabelFormattingCard.showDataLabels.value` is checked to render value labels, but line 116 sets `showDataLabels.visible = false`, meaning the toggle is hidden from the user. The user cannot control whether value labels appear because the toggle is invisible, yet the rendering path still relies on it. The toggle's default is `true` in the shared card, so labels always render -- but the user cannot disable them from the pane.

### All other checks: Clean

---

## 2. progress-bar-stack

### Check 3 -- Missing `.visible = false` on hidden shared properties
- **ISSUE**: `axisFormattingCard.axisLabelFontWeight` is not hidden. All other axis sub-properties are hidden except `axisLabelColor` and `axisLabelSize` (which are used for category label styling). The font-weight control remains visible but is never applied to anything, since `applyAxisLabelFormatting()` only reads `axisLabelColor` and `axisLabelSize`.

### Check 5 -- TypeScript null safety
- **ISSUE**: `visual.ts:640` -- `ref.referenceLabelText.value.length` -- no null guard. If the value property of the `TextInput` is `undefined`, this will throw. Should use optional chaining: `(ref.referenceLabelText.value?.length ?? 0) > 0`.

### All other checks: Clean

---

## 3. radar-chart

### Check 3 -- Missing `.visible = false` on hidden shared properties
- **ISSUE**: `axisFormattingCard.axisLabelFontWeight` is not hidden. Other inapplicable axis sub-properties are hidden, but font-weight remains visible. Radar-chart never reads `axisLabelFontWeight` for rendering.
- **ISSUE**: `axisFormattingCard.axisLineColor` and `axisFormattingCard.axisLineWidth` remain visible and are used for axis spoke lines. However `axisFormattingCard.showGridLines` also remains visible and is used. `gridLineColor` and `gridLineStyle` remain visible and used too. This is correct behavior -- these ARE used. No issue here upon further review.

### Check 7 -- Legend correctness
- **ISSUE**: Legend only renders when `series.length > 1` (line 576). For a single-series radar chart, the legend is completely suppressed even if the user enables `showLegend`. This is inconsistent with other visuals that always show legend when the toggle is on.

### All other checks: Clean

---

## 4. radial-gauge

### Check 1 -- capabilities.json vs settings.ts sync
- Clean. All objects in capabilities.json have corresponding cards in settings.ts.

### Check 3 -- Missing `.visible = false` on hidden shared properties
- **ISSUE**: `dataLabelFormattingCard.dataLabelPosition` is not hidden. The gauge sets `showDataLabels.visible = false` but does not hide `dataLabelPosition`. While `showDataLabels` being hidden means the position control has no effect, it's still visible in the pane and confusing.

### Check 5 -- TypeScript null safety
- **ISSUE**: `visual.ts:518` -- `fmt` function casts `v as number` without null guard: `formatWithSettings(v as number, ...)`. If `v` is null/undefined (from the `number | null | undefined` type), `formatWithSettings` could receive an unexpected input. The function signature accepts `number` only.

### Check 8 -- Color theme wiring
- Clean. Color theme properly overrides zone colors when non-default theme is selected (lines 298-306).

### All other checks: Clean

---

## 5. ring-stack

### Check 3 -- Missing `.visible = false` on hidden shared properties
- **ISSUE**: `dataLabelFormattingCard` shows `showDataLabels` as hidden (line 142) and `dataLabelPosition` as hidden (line 144), but the remaining sub-properties (`dataLabelFontSize`, `dataLabelFontColor`, `dataLabelFontWeight`, `dataLabelFontFamily`) remain visible. These are applied to `.ring-label-pct` via `applyDataLabelFormatting`, so they DO have an effect -- however, the `showDataLabels` toggle being hidden means users can never disable data labels from that card. The toggle defaulting to `true` silently controls the font styling. This is technically functional but unintuitive.

### All other checks: Clean

---

## 6. sankey-diagram

### Check 1 -- capabilities.json vs settings.ts sync
- **ISSUE**: `capabilities.json` has `titleFormatting.properties.titleFontWeight` but **not** `titleFormatting.properties.titleFontFamily` -- wait, re-checking... Actually it DOES have `titleFontFamily`. And `titleFontWeight` is also present. The sankey also adds `titleFontWeight` to capabilities but uses the `TitleFormattingCard` shared card which includes it. Clean on review.

### Check 3 -- Missing `.visible = false` on hidden shared properties
- Clean. Sankey has the most comprehensive conditional visibility logic of all visuals audited. Link label sub-settings, total sub-settings, legend sub-settings, title sub-settings, card sub-settings, and conditional formatting sub-settings are all properly gated.

### Check 5 -- TypeScript null safety
- **ISSUE**: `visual.ts:429` -- `s.cardSettings.backgroundColor?.value?.value` uses optional chaining correctly, but in the same block, `s.cardSettings.backgroundOpacity.value` is accessed without null check. Since `NumUpDown` always has a value, this is fine in practice.

### All other checks: Clean

---

## 7. scatter-bubble

### Check 3 -- Missing `.visible = false` on hidden shared properties
- **ISSUE**: `axisFormattingCard.showXAxis` and `showYAxis` are set to `visible = false` (lines 413-414), but the visual still reads these values to gate axis rendering (lines 765, 769). Since they're hidden, the user cannot toggle axes on/off. The default is `true`, so axes always render. If the intent is "always show axes", hiding the toggle is correct, but it creates a dead code path where the condition can never be false.
- **ISSUE**: `axisFormattingCard.showGridLines` is set to `visible = false` (line 415), but the visual reads it at line 736 to gate grid rendering. Same pattern -- the user can never disable grids because the toggle is hidden, but the default is `true` so grids always render.
- **ISSUE**: Quadrant zone colors (`zone1Color` through `zone4Color`) are not gated by `quadrantSettings.show.value`. When quadrants are off, these 4 color pickers remain visible in the pane but have no effect.

### Check 6 -- Tooltip completeness
- **ISSUE**: Scatter-bubble uses a custom DOM tooltip (lines 1468-1515) instead of the PBI `host.tooltipService`. This means tooltips will not follow the PBI tooltip theme, won't support report-level tooltip pages, and won't work correctly with touch events on mobile. All other visuals in this batch use `host.tooltipService.show()`.

### All other checks: Clean

---

## 8. slope-chart

### Check 3 -- Missing `.visible = false` on hidden shared properties
- **ISSUE**: `axisFormattingCard.gridLineStyle` is hidden (via `.visible = false` implied by code at line 124: `showGridLines.visible = false`), but actually `showGridLines` IS visible (it's not in the hidden list). Wait -- re-reading: line 124 sets `this.settings.axisFormattingCard.showGridLines.visible = false`. So grid lines toggle IS hidden. But the visual still reads it at line 412: `if (showGridLines)`. The `gridLineColor` (line 125) is hidden. But `gridLineStyle` is NOT explicitly hidden -- it's set via line 125: `gridLineColor.visible = false`. Let me re-read... Lines 124-125 hide `axisLineColor`, `axisLineWidth`, `showGridLines`, `gridLineColor`. But `gridLineStyle`, `gridLineWidth`, `gridLineOpacity` are NOT hidden. These remain visible in the pane but have no effect since `showGridLines` is hidden (defaults to `true` in the shared card).
  - Actually, wait -- `showGridLines` defaults to `true` in the shared `AxisFormattingCard`. So even though the toggle is hidden, grids DO render (line 412 checks `showGridLines` which defaults to true). So `gridLineStyle` being visible IS useful. But `gridLineWidth` and `gridLineOpacity` are visible yet never read by slope-chart's grid rendering code (it hardcodes `stroke-opacity: 0.6` at line 425). **`gridLineWidth` and `gridLineOpacity` are visible but never applied.** This is a bug.

### Check 5 -- TypeScript null safety
- **ISSUE**: `visual.ts:339-341` and similar patterns -- `lineStyleValue` is extracted then type-narrowed with a ternary. While functional, this pattern appears many times and the `as { value?: string }` cast is unsafe if the SDK changes the shape. A helper like `resolveDropdown()` is used elsewhere in the same file but not consistently here.

### Check 7 -- Legend correctness
- Clean. Legend shows "Increase" and "Decrease" items with direction colors. Appropriate for slope chart.

### All other checks: Clean

---

## Summary Table

| Visual | Issues Found |
|---|---|
| **polar-chart** | `axisLabelFontWeight` not hidden; `showDataLabels` hidden but still gates rendering |
| **progress-bar-stack** | `axisLabelFontWeight` not hidden; `referenceLabelText.value.length` missing null guard |
| **radar-chart** | `axisLabelFontWeight` not hidden; legend suppressed for single-series |
| **radial-gauge** | `dataLabelPosition` not hidden; `fmt()` casts potentially-null value |
| **ring-stack** | Clean (minor: `showDataLabels` hidden but font sub-props visible) |
| **sankey-diagram** | Clean |
| **scatter-bubble** | Quadrant zone colors not gated; custom DOM tooltip instead of PBI tooltipService |
| **slope-chart** | `gridLineWidth` and `gridLineOpacity` visible but never applied |

### Cross-cutting pattern: `axisLabelFontWeight` not hidden
Affects: **polar-chart**, **progress-bar-stack**, **radar-chart** (3 visuals). All three hide most axis sub-properties but miss `axisLabelFontWeight`. This is a shared card property that should be hidden alongside `axisLabelFontFamily` when the visual doesn't use it.
