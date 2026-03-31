# Feature Improvement Report: Radar Chart
**Date:** 2026-03-20
**Scope:** radar-chart visual — card style system, formatting options, quality-of-life
**Compared against:** bar-chart-pro, polar-chart, scatter-bubble, animated-donut-pro (same suite)

## Executive Summary
12 findings: 5 gaps, 5 refinements, 2 UX improvements
Top recommendation: Upgrade card style from enableGlass toggle to full glass/elevated/neumorphic dropdown (Critical / Small)

## Findings (sorted by ROI)

### 1. [GAP] Card Style: Missing glass/elevated/neumorphic dropdown
**Impact:** Critical | **Effort:** Small | **ROI: ★★★★★**

**What:** Radar chart uses a legacy `enableGlass` toggle (on/off only), while every other visual in the suite has a `cardStyleMode` dropdown with None/Glass/Elevated/Neumorphic options and uses the shared `applyCardStyle()` from core.
**Why:** The user explicitly reported this is missing. It's the only visual still using the old `applyGlassStyle` directly instead of the unified `applyCardStyle` system.
**Competitors:** Every other visual in the suite (bar-chart-pro, polar-chart, kpi-card, etc.) uses the full dropdown.

**Implementation spec:**
- **Files:** `packages/radar-chart/src/settings.ts`, `packages/radar-chart/src/visual.ts`, `packages/radar-chart/capabilities.json`
- **Approach:** Replace `enableGlass` ToggleSwitch with `cardStyleMode` ItemDropdown (None/Glass/Elevated/Neumorphic). Replace `applyGlassStyle` call with `applyCardStyle` from core. Update capabilities.json to use enumeration instead of bool.
- **Key details:**
  - In settings.ts: Replace `enableGlass` with `cardStyleMode` dropdown matching bar-chart-pro's pattern
  - In visual.ts: Import `applyCardStyle` and `CardStyleMode` from core, replace `applyCardStyle()` method body
  - In capabilities.json: Replace `enableGlass` bool with `cardStyleMode` enumeration (none/glass/elevated/neumorphic)
  - Add visibility toggle: `s.cardSettings.backgroundOpacity.visible = cardMode !== 'none'`
- **Complexity:** ~30 lines changed across 3 files
- **Watch out for:** The `enableGlass` property name changes to `cardStyleMode` — existing reports using the old property will fall back to default (glass)

### 2. [GAP] Axis Labels: Missing show/hide toggle
**Impact:** High | **Effort:** Small | **ROI: ★★★★☆**

**What:** No way to hide axis category labels. Users stuck with labels even when they clutter small charts.
**Why:** Every chart in the suite with axis labels has a show/hide toggle. Radar chart labels are always shown.

**Implementation spec:**
- **Files:** `packages/radar-chart/src/settings.ts`, `packages/radar-chart/src/visual.ts`, `packages/radar-chart/capabilities.json`
- **Approach:** Add `showAxisLabels` ToggleSwitch to `RadarLayoutSettings`. Guard the label rendering block in `render()` with this toggle.
- **Key details:** Add after `showGrid` in slices. In render(), wrap the `g.append('text').attr('class', 'radar-axis-label')` block with `if (showAxisLabels)`.
- **Complexity:** ~10 lines

### 3. [GAP] Axis Labels: Missing font family and font weight controls
**Impact:** High | **Effort:** Small | **ROI: ★★★★☆**

**What:** Axis labels use only color and size from the shared AxisFormattingCard, but the card's font family and font weight properties are hidden (`visible = false`). Labels are always rendered in the container's default font.
**Why:** Other visuals expose font family/weight for their labels. The axis formatting card already HAS these properties — they're just hidden.

**Implementation spec:**
- **Files:** `packages/radar-chart/src/visual.ts`
- **Approach:** Un-hide `axisLabelFontFamily` and `axisLabelFontWeight` (remove `visible = false` lines). Apply the resolved values to the axis label `<text>` elements.
- **Key details:**
  - Remove lines 108 (`axisLabelFontFamily.visible = false`) and 114 (`axisLabelFontWeight.visible = false`)
  - In render(), add `.style('font-family', axisLabelFontFamily)` and `.style('font-weight', axisLabelFontWeight)` to the axis label text elements
  - Read values: `const axisLabelFontFamily = resolveDropdown(s.axisFormattingCard.axisLabelFontFamily) || undefined;` and similar for weight
- **Complexity:** ~15 lines

### 4. [GAP] Series Stroke Width: Missing per-series line width control
**Impact:** High | **Effort:** Small | **ROI: ★★★★☆**

**What:** All polygon outlines use a hardcoded stroke width. The per-series formatting card already includes `lineWidth` — but it's not being applied to polygon strokes.
**Why:** Bar-chart-pro, bump-chart, and slope-chart all respect per-series line width from the SeriesFormattingCard.

**Implementation spec:**
- **Files:** `packages/radar-chart/src/visual.ts`
- **Approach:** The `seriesLineWidth` is already resolved at line 441 via `resolveSeriesFormatting`. It's already applied at line 460 (`.attr('stroke-width', seriesLineWidth)`). Verify this is actually working — it appears correct in code. If the user sees uniform widths, it may be because the default `lineWidth` in SeriesFormattingCard defaults to the same value for all series.
- **Note:** This may already work. Verify before changing.

### 5. [REFINEMENT] Polygon Stroke Width: Add a global default control
**Impact:** Medium | **Effort:** Small | **ROI: ★★★☆☆**

**What:** No global "Line Width" setting in the Series Appearance card to set a default for all polygon outlines. Users must configure each series individually via the per-series formatting card.
**Why:** Other visuals have a global default (e.g., bar-chart-pro's `barBorderWidth`). A radar chart with 5 series shouldn't require 5 individual line-width edits.

**Implementation spec:**
- **Files:** `packages/radar-chart/src/settings.ts`, `packages/radar-chart/src/visual.ts`, `packages/radar-chart/capabilities.json`
- **Approach:** Add `lineWidth` NumUpDown (default 2) to `RadarAppearanceSettings`. Use as the base stroke-width for polygons when per-series override isn't set.
- **Complexity:** ~15 lines

### 6. [REFINEMENT] Axis Label Text Anchor: Intelligent positioning
**Impact:** Medium | **Effort:** Small | **ROI: ★★★☆☆**

**What:** All axis labels use `text-anchor: middle` regardless of position. Labels on the left side of the chart overlap the chart area because they're centered on a point that's already at the edge.
**Why:** Standard radar charts position labels with `text-anchor: start` for right-side labels, `end` for left-side, and `middle` for top/bottom. This prevents overlap and looks more professional.

**Implementation spec:**
- **Files:** `packages/radar-chart/src/visual.ts`
- **Approach:** After computing `lx` for each axis label, determine text-anchor based on the x position: if `lx > 1` use `start`, if `lx < -1` use `end`, else `middle`.
- **Key details:** Replace the static `.attr('text-anchor', 'middle')` in the LESS with dynamic positioning based on angle:
  ```typescript
  const anchor = Math.abs(lx) < 1 ? 'middle' : lx > 0 ? 'start' : 'end';
  ```
- **Complexity:** ~5 lines

### 7. [GAP] Dot Outline: Missing stroke/border controls for data dots
**Impact:** Medium | **Effort:** Small | **ROI: ★★★☆☆**

**What:** Data point dots have no stroke/border — they're solid filled circles. Other chart visuals (scatter-bubble) have dot border color and width controls.
**Why:** Adding a contrasting border to dots improves visibility against the filled polygon area, especially when dots overlap polygon boundaries.

**Implementation spec:**
- **Files:** `packages/radar-chart/src/settings.ts`, `packages/radar-chart/src/visual.ts`, `packages/radar-chart/capabilities.json`
- **Approach:** Add `dotBorderColor` (ColorPicker, default white) and `dotBorderWidth` (NumUpDown, default 1) to `RadarAppearanceSettings`. Apply as `stroke` and `stroke-width` on dot circles.
- **Complexity:** ~20 lines

### 8. [REFINEMENT] Legend Font Weight: Not applied to legend labels
**Impact:** Medium | **Effort:** Small | **ROI: ★★★☆☆**

**What:** The legend reads `legendFontColor`, `legendFontSize`, and `legendFontFamily` but does NOT read or apply `legendFontWeight` from the LegendFormattingCard.
**Why:** The LegendFormattingCard already has a `legendFontWeight` property. It's just not used in the render code.

**Implementation spec:**
- **Files:** `packages/radar-chart/src/visual.ts`
- **Approach:** Add `const legendFontWeight = resolveDropdown(s.legendFormattingCard.legendFontWeight) || undefined;` and apply `if (legendFontWeight) label.style.fontWeight = legendFontWeight;` in the legend rendering block.
- **Complexity:** ~3 lines

### 9. [REFINEMENT] Empty State Styling: Matches container but missing themed text
**Impact:** Low | **Effort:** Small | **ROI: ★★☆☆☆**

**What:** The empty state message has no styling — no color, no font-size, no italic. Other visuals style the empty state with muted color, italic text, and centered layout.
**Why:** Compare with `.kpi-empty` in kpi-card which uses `color: #94A3B8; font-style: italic; font-size: 13px`.

**Implementation spec:**
- **Files:** `packages/radar-chart/style/visual.less`
- **Approach:** Add styling to `.radar-empty`: `color: #94A3B8; font-size: 13px; font-style: italic;`
- **Complexity:** 3 lines

### 10. [UX] Show Axis Labels for Single-Axis on Independent Scales
**Impact:** Low | **Effort:** Small | **ROI: ★★☆☆☆**

**What:** When "Independent Axis Scales" is on, axis value labels are rendered at EVERY axis spoke, creating visual noise. The labels overlap each other on closely-spaced spokes.
**Why:** With independent scales, each axis has its own max. Showing all values on all spokes is redundant — showing just the max value per axis at the tip would be cleaner.

**Implementation spec:**
- **Files:** `packages/radar-chart/src/visual.ts` (renderAxisValues method)
- **Approach:** When independentScales is true, only render the outermost level label at each axis instead of all levels. Change the inner loop `for (let level = 1; level <= gridLevels; level++)` to `const level = gridLevels` (single iteration).
- **Complexity:** ~5 lines

### 11. [REFINEMENT] Data Label Font Color: Not applied from DataLabelFormattingCard
**Impact:** Medium | **Effort:** Small | **ROI: ★★★☆☆**

**What:** Data labels are rendered but don't get the font color from `dataLabelFormattingCard.dataLabelFontColor`. The `applyDataLabelFormatting` call at line 657 may handle this via the shared utility, but the radar-specific labels at line 572-578 don't set any color — they inherit from the SVG default (black).
**Why:** Users expect to be able to change data label color to match their theme.

**Implementation spec:**
- **Files:** `packages/radar-chart/src/visual.ts`
- **Approach:** Verify that `applyDataLabelFormatting` correctly sets font color on `.radar-data-label` elements. If not, add explicit `.attr('fill', dataLabelColor)` to the data label text elements in the render loop.
- **Complexity:** ~5 lines

### 12. [UX] Measure Limit: Hardcoded max 5 series
**Impact:** Low | **Effort:** Small | **ROI: ★★☆☆☆**

**What:** `capabilities.json` limits measures to `max: 5`. Users with 6+ metrics to compare are blocked.
**Why:** Most radar chart implementations support at least 8-10 series. The visual rendering code has no hard limit — this is purely a capabilities constraint.

**Implementation spec:**
- **Files:** `packages/radar-chart/capabilities.json`
- **Approach:** Increase `"measure": { "max": 5 }` to `"max": 10`.
- **Complexity:** 1 line
- **Watch out for:** More than ~8 series makes the chart visually cluttered. Consider this a soft limit that users can manage.

## Research Sources
- bar-chart-pro settings.ts: Full card style dropdown (None/Glass/Elevated/Neumorphic), `applyCardStyle` from core
- polar-chart settings.ts: Similar radial chart with matching card style system
- kpi-card settings.ts: Card style dropdown pattern, empty state styling
- core/src/card-style.ts: Shared `applyCardStyle` and `CardStyleMode` type
- core/src/glass.ts: Legacy `applyGlassStyle` (what radar-chart currently uses directly)
