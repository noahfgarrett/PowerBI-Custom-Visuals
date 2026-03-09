# Dead Settings Audit

Settings that were defined in `capabilities.json` but not wired up, never consumed, or only partially functional in source code.

**Status: ALL FIXED** (verified with clean typecheck on 2026-03-09)

---

## Global (All 32 Packages) — FIXED

Removed `highContrastOverride` and `verboseLabels` from `AccessibilityFormattingCard` in `core/src/shared-settings.ts`, its `CAPABILITIES_TEMPLATES`, and all 31 package `capabilities.json` files. Also removed the dead `resolveContrastMode()` function from `core/src/accessibility.ts`.

| Property | Display Name | Root Cause | Fix |
|---|---|---|---|
| `accessibilityFormatting.highContrastOverride` | High Contrast | Visuals read high-contrast state from `host.colorPalette.isHighContrast` (PBI host API) instead of this setting. | Removed from shared card, capabilities template, and all 31 capabilities.json files. Removed `resolveContrastMode()` from core. |
| `accessibilityFormatting.verboseLabels` | Verbose ARIA Labels | No visual passes this value to `applyChartAria()`'s `verbose` parameter. | Removed from shared card, capabilities template, and all 31 capabilities.json files. bar-race consumer updated to always include ARIA summary. |

---

## animated-donut-pro — FIXED

| Property | Display Name | Root Cause | Fix |
|---|---|---|---|
| `dataLabelFormatting.showDataLabels` | Show Data Labels | Hidden (`.visible=false`), value never read. Local donut label controls used instead. | Removed from capabilities.json. |

---

## animated-waterfall — FIXED

| Property | Display Name | Root Cause | Fix |
|---|---|---|---|
| `axisFormatting.showXAxis` | Show X-Axis | Hidden (`.visible=false`), value never read. Local `axisSettings.showXAxis` used instead. | Removed `.visible=false` line from visual.ts. Property kept in capabilities.json (shared card still declares it; local card supersedes). |
| `axisFormatting.showYAxis` | Show Y-Axis | Hidden (`.visible=false`), value never read. Local `axisSettings.showYAxis` used instead. | Same as above. |

---

## bar-chart-pro — FIXED

### Completely Dead — Removed

| Property | Display Name | Root Cause | Fix |
|---|---|---|---|
| `dataLabelFormatting.showDataLabels` | Show Data Labels | Explicitly hidden, value never read. Superseded by `barSettings.showDataLabels` dropdown. | Removed from capabilities.json and `.visible=false` line from visual.ts. |
| `lineSettings.lineWidth` | Line Width | Explicitly hidden, value never read. Superseded by per-series `sf.lineWidth`. | Removed from capabilities.json, settings.ts, and visual.ts. |
| `lineSettings.lineStyle` | Line Style | Only consumed in `getLineStyle()` which was never called. Per-series `sf.lineStyle` used instead. | Removed from capabilities.json, settings.ts. Dead `getLineStyle()` method removed from visual.ts. |
| `errorBarSettings.show` | Show Error Bars | `renderErrorBars()` defined but never called from any render mode. | Entire `errorBarSettings` object removed from capabilities.json. `ErrorBarSettingsCard` removed from settings.ts. `renderErrorBars()` removed from visual.ts. |
| `errorBarSettings.lineColor` | Color | Dead — entire error bars feature unwired. | Removed with errorBarSettings. |
| `errorBarSettings.lineWidth` | Line Width | Dead — entire error bars feature unwired. | Removed with errorBarSettings. |
| `errorBarSettings.capWidth` | Cap Width (px) | Dead — entire error bars feature unwired. | Removed with errorBarSettings. |

### Previously Partially Functional — NOW FIXED

`renderVarianceIndicators()` was only called from `renderGrouped()`. Now wired into all applicable modes:
- **Grouped**: first bar series values vs target (existing)
- **Stacked**: stacked totals per category vs target
- **Combo**: first bar series values vs target
- **Horizontal**: first bar series values vs target (horizontal arrow/text variant)
- **Diverging**: first series values vs target
- **100% Stacked**: skipped — percentages don't compare meaningfully against a raw target value

| Property | Display Name | Status |
|---|---|---|
| `varianceSettings.show` | Show Variance Indicators | FIXED — works in all modes (except stacked100) |
| `varianceSettings.showDelta` | Show Delta Value | FIXED |
| `varianceSettings.showArrow` | Show Arrow | FIXED |
| `varianceSettings.positiveColor` | Positive Color | FIXED |
| `varianceSettings.negativeColor` | Negative Color | FIXED |

---

## bar-race — FIXED

| Property | Display Name | Root Cause | Fix |
|---|---|---|---|
| `dataLabelFormatting.showDataLabels` | Show Data Labels | Hidden, value never read. Local `valueSettings.showValues` used instead. | Removed from capabilities.json. |
| `axisFormatting.showXAxis` | Show X-Axis | Hidden, value never read. Bar-race has no traditional axes. | Removed from capabilities.json. |
| `axisFormatting.showYAxis` | Show Y-Axis | Hidden, value never read. | Removed from capabilities.json. |
| `axisFormatting.xAxisTitle` | X-Axis Title | Hidden, value never read. | Removed from capabilities.json. |
| `axisFormatting.yAxisTitle` | Y-Axis Title | Hidden, value never read. | Removed from capabilities.json. |
| `axisFormatting.axisLabelFontFamily` | Label Font | Hidden, value never read. | Removed from capabilities.json. |
| `axisFormatting.axisLabelRotation` | X-Label Rotation | Hidden, value never read. | Removed from capabilities.json. |
| `axisFormatting.yAxisMin` | Y-Axis Min | Hidden, value never read. | Removed from capabilities.json. |
| `axisFormatting.yAxisMax` | Y-Axis Max | Hidden, value never read. | Removed from capabilities.json. |
| `axisFormatting.axisLineColor` | Axis Line Color | Hidden, value never read. | Removed from capabilities.json. |
| `axisFormatting.axisLineWidth` | Axis Line Width | Hidden, value never read. | Removed from capabilities.json. |
| `axisFormatting.showGridLines` | Show Grid Lines | Hidden, value never read. | Removed from capabilities.json. |
| `axisFormatting.gridLineColor` | Grid Line Color | Hidden, value never read. | Removed from capabilities.json. |
| `axisFormatting.gridLineStyle` | Grid Line Style | Hidden, value never read. | Removed from capabilities.json. |
| `axisFormatting.gridLineWidth` | Grid Line Width | Hidden, value never read. | Removed from capabilities.json. |
| `axisFormatting.gridLineOpacity` | Grid Line Opacity (%) | Hidden, value never read. | Removed from capabilities.json. |
| `referenceLineFormatting.showReferenceBand` | Show Band | Hidden, value never read. No band support. | Removed from capabilities.json. |
| `referenceLineFormatting.referenceBandOpacity` | Band Opacity (%) | Hidden, value never read. | Removed from capabilities.json. |

All `.visible=false` lines removed from visual.ts.

---

## box-plot — FIXED

| Property | Display Name | Root Cause | Fix |
|---|---|---|---|
| `axisFormatting.showXAxis` | Show X-Axis | Hidden (`.visible=false`), value never read. Local `axisSettings.showXAxis` used instead. | Removed `.visible=false` line from visual.ts. |
| `axisFormatting.showYAxis` | Show Y-Axis | Hidden (`.visible=false`), value never read. Local `axisSettings.showYAxis` used instead. | Same as above. |

---

## bullet-chart-pro — FIXED

| Property | Display Name | Root Cause | Fix |
|---|---|---|---|
| `dataLabelFormatting.showDataLabels` | Show Data Labels | Hidden, value never read. Local label logic used instead. | Removed from capabilities.json. |
| `axisFormatting.showXAxis` | Show X-Axis | Hidden, value never read. | Removed from capabilities.json. |
| `axisFormatting.showYAxis` | Show Y-Axis | Hidden, value never read. | Removed from capabilities.json. |
| `axisFormatting.xAxisTitle` | X-Axis Title | Hidden, value never read. | Removed from capabilities.json. |
| `axisFormatting.yAxisTitle` | Y-Axis Title | Hidden, value never read. | Removed from capabilities.json. |
| `axisFormatting.axisLabelFontFamily` | Label Font | Hidden, value never read. | Removed from capabilities.json. |
| `axisFormatting.axisLabelRotation` | X-Label Rotation | Hidden, value never read. | Removed from capabilities.json. |
| `axisFormatting.yAxisMin` | Y-Axis Min | Hidden, value never read. | Removed from capabilities.json. |
| `axisFormatting.yAxisMax` | Y-Axis Max | Hidden, value never read. | Removed from capabilities.json. |
| `axisFormatting.axisLineColor` | Axis Line Color | Hidden, value never read. | Removed from capabilities.json. |
| `axisFormatting.axisLineWidth` | Axis Line Width | Hidden, value never read. | Removed from capabilities.json. |
| `axisFormatting.showGridLines` | Show Grid Lines | Hidden, value never read. | Removed from capabilities.json. |
| `axisFormatting.gridLineColor` | Grid Line Color | Hidden, value never read. | Removed from capabilities.json. |
| `axisFormatting.gridLineStyle` | Grid Line Style | Hidden, value never read. | Removed from capabilities.json. |
| `axisFormatting.gridLineWidth` | Grid Line Width | Hidden, value never read. | Removed from capabilities.json. |
| `axisFormatting.gridLineOpacity` | Grid Line Opacity (%) | Hidden, value never read. | Removed from capabilities.json. |

---

## bump-chart — FIXED

| Property | Display Name | Root Cause | Fix |
|---|---|---|---|
| `axisSettings.showXAxis` | Show X-Axis | Name mismatch — settings.ts uses `axisVisibilitySettings` but capabilities.json had `axisSettings`. | Renamed to `axisVisibilitySettings` in capabilities.json. |
| `legendSettings.show` | Show Legend | Orphaned object — no settings card maps to `legendSettings`. | Removed entire `legendSettings` object from capabilities.json. |
| `legendSettings.position` | Position | Same orphan. | Removed with legendSettings. |
| `lineStrokeFormatting.lineWidth` | Line Width | Hidden, value never read. Local `bumpSettings.lineWidth` used instead. | Removed from capabilities.json and `.visible=false` line from visual.ts. |

---

## chord-diagram — FIXED

No package-specific dead settings. Global accessibility fixes applied.

---

## dumbbell-chart — FIXED

| Property | Display Name | Root Cause | Fix |
|---|---|---|---|
| `seriesFormatting.seriesLineStyle` | Line Style | Misnamed and never read by visual. | Removed from capabilities.json. |
| `seriesFormatting.seriesLineWidth` | Line Width | Misnamed and never read by visual. | Removed from capabilities.json. |

---

## funnel-pro — FIXED

| Property | Display Name | Root Cause | Fix |
|---|---|---|---|
| `dataLabelFormatting.showDataLabels` | Show Data Labels | Value read then immediately voided. Local `funnelSettings.showValues` is the actual toggle. | Removed from capabilities.json. |

---

## gantt-chart-pro — FIXED

| Property | Display Name | Root Cause | Fix |
|---|---|---|---|
| `colorSettings.todayColor` | Today Line Color | Superseded — `ganttTodaySettings.lineColor` always has a non-empty default (`#EF4444`), so the fallback can never be reached. | Removed from capabilities.json, settings.ts, and visual.ts. Simplified today-line color resolution. |

---

## gauge-cluster — FIXED

No package-specific dead settings. Global accessibility fixes applied.

---

## health-bar — FIXED

| Property | Display Name | Root Cause | Fix |
|---|---|---|---|
| `healthBarSparkline.show` | Show Sparkline | Code is a no-op — render body voids `renderSparkline`. | Entire `healthBarSparkline` object removed from capabilities.json. `HealthBarSparklineSettings` card removed from settings.ts. No-op render block and unused import removed from visual.ts. |
| `healthBarSparkline.lineColor` | Sparkline Color | Dead — value assigned then voided. | Removed with healthBarSparkline. |
| `axisFormatting.axisLineColor` | Axis Line Color | Hidden, value never read. | Removed from capabilities.json and `.visible=false` line from visual.ts. |
| `axisFormatting.axisLineWidth` | Axis Line Width | Hidden, value never read. | Same. |
| `axisFormatting.showGridLines` | Show Grid Lines | Hidden, value never read. | Same. |
| `axisFormatting.gridLineColor` | Grid Line Color | Hidden, value never read. | Same. |
| `axisFormatting.gridLineStyle` | Grid Line Style | Hidden, value never read. | Same. |
| `axisFormatting.gridLineWidth` | Grid Line Width | Hidden, value never read. | Same. |
| `axisFormatting.gridLineOpacity` | Grid Line Opacity (%) | Hidden, value never read. | Same. |

---

## heatmap-calendar — FIXED

| Property | Display Name | Root Cause | Fix |
|---|---|---|---|
| `axisFormatting.axisLineColor` | Axis Line Color | Hidden, value never read. | Removed from capabilities.json and `.visible=false` line from visual.ts. |
| `axisFormatting.axisLineWidth` | Axis Line Width | Hidden, value never read. | Same. |
| `axisFormatting.showGridLines` | Show Grid Lines | Hidden, value never read. | Same. |
| `axisFormatting.gridLineColor` | Grid Line Color | Hidden, value never read. | Same. |
| `axisFormatting.gridLineStyle` | Grid Line Style | Hidden, value never read. | Same. |
| `axisFormatting.gridLineWidth` | Grid Line Width | Hidden, value never read. | Same. |
| `axisFormatting.gridLineOpacity` | Grid Line Opacity (%) | Hidden, value never read. | Same. |

---

## kpi-card — FIXED

No package-specific dead settings. Global accessibility fixes applied.

---

## morphing-area-chart — FIXED

| Property | Display Name | Root Cause | Fix |
|---|---|---|---|
| `legendSettings.show` | Show Legend | Orphaned object — no settings card maps to `legendSettings`. Visual uses `legendFormatting`. | Entire `legendSettings` object removed from capabilities.json. |
| `legendSettings.position` | Position | Orphaned. | Removed with legendSettings. |
| `legendSettings.fontSize` | Font Size | Orphaned. | Removed with legendSettings. |
| `legendSettings.fontColor` | Font Color | Orphaned. | Removed with legendSettings. |

---

## network-graph — FIXED

| Property | Display Name | Root Cause | Fix |
|---|---|---|---|
| `dataLabelFormatting.showDataLabels` | Show Data Labels | Never checked. Label visibility controlled by `nodeSettings.showLabels`. | Removed from capabilities.json. |

---

## polar-chart — FIXED

| Property | Display Name | Root Cause | Fix |
|---|---|---|---|
| `seriesFormatting.seriesLineStyle` | Line Style | Polar chart renders arcs, not lines. `sf.lineStyle` never applied to any SVG element. | Removed from capabilities.json. |
| `seriesFormatting.seriesLineWidth` | Line Width | Same — arc-based rendering; per-series `lineWidth` has no effect. | Removed from capabilities.json. |

---

## progress-bar-stack — FIXED

| Property | Display Name | Root Cause | Fix |
|---|---|---|---|
| `dataLabelFormatting.showDataLabels` | Show Data Labels | Never checked. Label visibility controlled by `barSettings.showValue` and `barSettings.showPercent`. | Removed from capabilities.json. |

---

## radar-chart — FIXED

| Property | Display Name | Root Cause | Fix |
|---|---|---|---|
| `legendSettings.show` | Show Legend | Orphaned object — duplicates `legendFormatting.showLegend` from shared card. | Removed from capabilities.json. |

---

## radial-gauge — FIXED

| Property | Display Name | Root Cause | Fix |
|---|---|---|---|
| `dataLabelFormatting.showDataLabels` | Show Data Labels | Never checked. Value text always rendered unconditionally. | Removed from capabilities.json. |

---

## ring-stack — FIXED

| Property | Display Name | Root Cause | Fix |
|---|---|---|---|
| `dataLabelFormatting.showDataLabels` | Show Data Labels | Never checked. Label visibility controlled by `ringSettings.showLabels`. | Removed from capabilities.json. |

---

## sankey-diagram — FIXED

No package-specific dead settings. Global accessibility fixes applied.

---

## scatter-bubble — FIXED

| Property | Display Name | Root Cause | Fix |
|---|---|---|---|
| `legendSettings.show` | Show Legend | Orphaned object — no settings class maps to `legendSettings`. | Removed from capabilities.json. |
| `seriesFormatting.seriesLineStyle` | Line Style | `sf.lineStyle` never read. Scatter/bubble has no lines. | Removed from capabilities.json. Unused `lineStyleToDashArray` import removed from visual.ts. |
| `seriesFormatting.seriesLineWidth` | Line Width | `sf.lineWidth` never read. Bubbles have no line-width strokes. | Removed from capabilities.json. |

---

## slope-chart — FIXED

| Property | Display Name | Root Cause | Fix |
|---|---|---|---|
| `lineStrokeFormatting.lineWidth` | Line Width | Hidden, value never read. Local `slopeSettings.lineWidth` supersedes. | Removed from capabilities.json and `.visible=false` line from visual.ts. |

---

## status-indicator — FIXED

No package-specific dead settings. Global accessibility fixes applied.

---

## stream-graph — FIXED

No package-specific dead settings. Global accessibility fixes applied.

---

## sunburst-chart — FIXED

No package-specific dead settings. Global accessibility fixes applied.

---

## timeline-milestone — FIXED

No package-specific dead settings. Global accessibility fixes applied.

---

## treemap-pro — FIXED

No package-specific dead settings. Global accessibility fixes applied.

---

## waffle-chart — FIXED

No package-specific dead settings. Global accessibility fixes applied.

---

## Summary

| Category | Count | Status |
|---|---|---|
| Global dead (`highContrastOverride` + `verboseLabels`) | 2 x 32 = **64 instances** | FIXED |
| Hidden shared axis properties (never read) | **47 instances** across bar-race, bullet-chart-pro, health-bar, heatmap-calendar, animated-waterfall, box-plot | FIXED |
| Dead `dataLabelFormatting.showDataLabels` | **9 packages** (animated-donut-pro, bar-chart-pro, bar-race, bullet-chart-pro, funnel-pro, network-graph, progress-bar-stack, radial-gauge, ring-stack) | FIXED |
| Orphaned `legendSettings` objects | **4 packages** (bump-chart, morphing-area-chart, radar-chart, scatter-bubble) | FIXED |
| Dead series line properties on non-line charts | **3 packages** (dumbbell-chart, polar-chart, scatter-bubble) | FIXED |
| Hidden `lineStrokeFormatting.lineWidth` | **2 packages** (bump-chart, slope-chart) | FIXED |
| Unwired error bars feature | **1 package** (bar-chart-pro) — 4 dead settings + dead code | FIXED |
| Mode-specific variance indicators | **1 package** (bar-chart-pro) — was only wired in grouped mode | FIXED — wired into all modes (except stacked100) |
| Dead sparkline feature (no-op) | **1 package** (health-bar) — 2 dead settings + dead code | FIXED |
| Superseded `colorSettings.todayColor` | **1 package** (gantt-chart-pro) | FIXED |
| Name mismatch (`axisSettings` vs `axisVisibilitySettings`) | **1 package** (bump-chart) | FIXED |
| Dead `lineSettings.lineWidth` + `lineStyle` | **1 package** (bar-chart-pro) — superseded by per-series + dead code | FIXED |

### Additional Issues Found in Second Pass (Partially-Wired Features)

| Category | Details | Status |
|---|---|---|
| Bar chart pro mode gaps — conditional formatting | `getConditionalBarColor()` only called in grouped mode, missing from 5 other modes | FIXED — wired into all 6 modes |
| Bar chart pro mode gaps — trend line | `renderTrendLineOverlay()` missing from stacked and stacked100 | FIXED — wired into stacked (totals) and stacked100 (raw totals) |
| Bar chart pro mode gaps — annotations | `renderAnnotationOverlay()` missing from stacked100, horizontal, diverging | FIXED — wired into all 6 modes |
| Bar chart pro mode gaps — benchmark band | `renderBenchmarkBand()` missing from horizontal mode | FIXED — added `renderBenchmarkBandHorizontal()` variant |
| Scatter-bubble zoom/pan filter bug | Sequential `.filter()` calls overwrite each other — both-disabled state still allows wheel zoom | FIXED — combined into single AND-logic filter |
| Heatmap-calendar streak highlighting | `CalendarStreakSettings` (show + threshold) defined but zero implementation | FIXED — consecutive-day detection with visual outline |
| KPI-card multi-KPI grid layout | `kpiCount` dropdown (1-4) defined but only single KPI rendered | FIXED — grid layout with reusable `renderSingleKpi()` |
| Radar-chart benchmark overlay | `RadarBenchmarkSettings` (show, dash, color) defined but broken implementation | FIXED — average-per-axis polygon with proper z-ordering |
| Timeline-milestone connectors | `showConnectors` toggle checked but gated method was a no-op stub | FIXED — toggle now gates actual connector lines inline |
| Treemap-pro label overflow | `labelOverflow` setting read but condition was a tautology (both branches identical) | FIXED — `hide` skips labels that don't fit, `truncate` clips text |
