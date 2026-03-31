# Multi-Chart Enhancements Design

**Date:** 2026-03-31
**Packages:** bar-chart-pro, kpi-card, morphing-area-chart, core

---

## 1. Bar Chart Pro — Fix Rotated X-Axis Label Clipping

**Problem:** Rotated x-axis labels are clipped at the bottom of the chart. The bottom margin is a fixed 20px and never accounts for label rotation height.

**Fix:** After margin initialization in `render()`, compute the projected height of rotated labels using `labelWidth * sin(angle)` and add it to `margin.bottom`. Same approach already used in morphing-area-chart (lines 359-369).

**Files:** `packages/bar-chart-pro/src/visual.ts`

---

## 2. Bar Chart Pro — Integer-Only Y-Axis Ticks

**Problem:** With small integer datasets (1, 2, 3), D3's `.ticks(6)` produces fractional ticks like 1.5, 2.5.

**Fix:** Add `integerTicks` toggle to the shared `AxisFormattingCard` in core (default: off). When enabled, replace D3's auto ticks with only integers within the Y domain using `d3.range(ceil(yMin), floor(yMax) + 1)`.

**Files:** `packages/core/src/shared-settings.ts`, `packages/bar-chart-pro/src/visual.ts`, `packages/bar-chart-pro/capabilities.json`

---

## 3. KPI Card — Goal Text with Centering

**Current state:** Goal section renders only a progress bar, no text.

**Fix:** Add goal text (e.g., "75% of Goal") below the progress bar. New settings on `KpiGoalSettings`:
- `showGoalText` (toggle, default: true)
- `goalTextAlignment` (dropdown: left/center/right, default: center)

**Files:** `packages/kpi-card/src/settings.ts`, `packages/kpi-card/src/visual.ts`, `packages/kpi-card/capabilities.json`

---

## 4. Shared Core — Inline End-of-Line Labels

**Feature:** Text labels placed at the rightmost data point of each line, colored to match the series. Works independently of the traditional legend.

**Settings on `LegendFormattingCard`:**
- `showInlineLabels` (toggle, default: off)
- `inlineLabelFontSize` (NumUpDown, default: 11)
- `inlineLabelOffset` (NumUpDown, px from line end, default: 4)

**Shared helper:** `renderInlineLabels()` in core — accepts a D3 SVG group, array of `{ label, x, y, color }`, and font settings. Renders text labels and handles vertical overlap by nudging labels apart.

**Files:** `packages/core/src/shared-settings.ts`, `packages/core/src/shared-helpers.ts`, `packages/core/src/index.ts`

---

## 5. Morphing Area Chart — Inline Labels + Gap Indicators

### 5a. Inline Labels
Use the shared `renderInlineLabels()` helper after rendering lines. Pass each series' last valid point.

### 5b. Gap/Distance Indicators
New `GapIndicatorCard`:
- `showGapIndicator` (toggle, default: off)
- `gapSeriesA` / `gapSeriesB` (NumUpDown, 1-indexed series numbers, defaults 1 and 2)
- `gapInterval` (NumUpDown, show every N points, default: 1)
- `gapColor` (ColorPicker, default: #94A3B8)
- `gapLineWidth` (NumUpDown, default: 1)
- `showGapValue` (toggle, default: true)
- `gapFontSize` (NumUpDown, default: 10)

Renders vertical dashed lines between two series at intervals, with optional numeric gap value label.

**Files:** `packages/morphing-area-chart/src/settings.ts`, `packages/morphing-area-chart/src/visual.ts`, `packages/morphing-area-chart/capabilities.json`

---

## 6. Bar Chart Pro — Inline Labels (Combo Mode)

Use the shared `renderInlineLabels()` helper in `renderCombo()` for line series endpoints.

**Files:** `packages/bar-chart-pro/src/visual.ts`
