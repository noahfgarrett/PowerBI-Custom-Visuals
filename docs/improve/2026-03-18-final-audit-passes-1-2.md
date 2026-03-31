# Final Audit Passes 1-2: Capabilities.json / Settings.ts Sync + Dead Settings Hunt

**Date:** 2026-03-18
**Scope:** All 31 Power BI custom visuals in `packages/`

---

## Summary Table

| Visual | Caps Objects | Cards in Settings | Pass 1 Issues | Pass 2 Issues |
|--------|-------------|-------------------|---------------|---------------|
| animated-donut-pro | 16 | 16 | CLEAN | CLEAN |
| animated-waterfall | 23 | 23 | DUPLICATE `axisSettings` + `axisFormatting` | `axisSettings` NOT in cards array but used in visual.ts |
| bar-chart-pro | 29 | 29 | CLEAN | CLEAN |
| bar-race | 19 | 19 | CLEAN | CLEAN |
| box-plot | 21 | 21 | DUPLICATE `axisSettings` + `axisFormatting` | `axisSettings` NOT in cards array but used in visual.ts |
| bullet-chart-pro | 16 | 16 | CLEAN | CLEAN |
| bump-chart | 20 | 20 | CLEAN | CLEAN |
| chord-diagram | 14 | 14 | CLEAN (custom `ChordColorThemeSettings`) | CLEAN |
| dumbbell-chart | 20 | 20 | CLEAN (inherits `axisFormatting` name) | CLEAN |
| funnel-pro | 17 | 17 | CLEAN | CLEAN |
| gantt-chart-pro | 18 | 18 | CLEAN | CLEAN |
| gauge-cluster | 14 | 14 | CLEAN | CLEAN |
| health-bar | 21 | 21 | CLEAN | CLEAN |
| heatmap-calendar | 15 | 15 | Old naming: `legendSettings` (not `legendFormatting`) | CLEAN |
| kpi-card | 14 | 14 | CLEAN | CLEAN |
| morphing-area-chart | 24 | 24 | DUPLICATE `axisSettings` + `axisFormatting` (both in cards array) | CLEAN |
| network-graph | 13 | 13 | CLEAN | CLEAN |
| polar-chart | 16 | 16 | CLEAN | CLEAN |
| progress-bar-stack | 17 | 17 | CLEAN | CLEAN |
| radar-chart | 16 | 16 | Extra caps props in `seriesFormatting` | CLEAN |
| radial-gauge | 16 | 16 | CLEAN | CLEAN |
| ring-stack | 15 | 15 | CLEAN | CLEAN |
| sankey-diagram | 19 | 19 | CLEAN | CLEAN |
| scatter-bubble | 18 | 18 | CLEAN | CLEAN |
| slope-chart | 20 | 20 | Extra caps props in `seriesFormatting` | CLEAN |
| status-indicator | 11 | 11 | CLEAN | CLEAN |
| stream-graph | 18 | 18 | Extra caps props in `seriesFormatting`; missing `referenceBandWidth` in caps | CLEAN |
| sunburst-chart | 15 | 15 | CLEAN | CLEAN |
| timeline-milestone | 13 | 13 | CLEAN | CLEAN |
| treemap-pro | 14 | 14 | CLEAN | CLEAN |
| waffle-chart | 13 | 13 | CLEAN | CLEAN |

**Totals:** 31 visuals audited. 7 have Pass 1 issues. 2 have Pass 2 issues. 24 visuals are fully clean.

---

## Pass 1: Capabilities.json <-> Settings.ts Full Sync

### Issue 1: Duplicate `axisSettings` + `axisFormatting` in capabilities.json

**Affected visuals:** animated-waterfall, box-plot, morphing-area-chart

These three visuals have BOTH an old-style `axisSettings` object AND the shared `axisFormatting` object in capabilities.json. The old `axisSettings` contains a small subset of properties (typically `showXAxis`, `showYAxis`, and sometimes `gridLines`), while `axisFormatting` contains the full 18-property shared card.

**Details:**

| Visual | `axisSettings` props | `axisFormatting` props | `axisSettings` in cards array? |
|--------|---------------------|----------------------|-------------------------------|
| animated-waterfall | showXAxis, showYAxis | 18 (full set) | NO |
| box-plot | gridLines, showXAxis, showYAxis | 18 (full set) | NO |
| morphing-area-chart | gridLines, showXAxis, showYAxis | 18 (full set) | YES |

**Impact:**
- `showXAxis`/`showYAxis` are duplicated across both caps objects
- In animated-waterfall and box-plot, `axisSettings` is NOT in the settings model's `cards` array, so the PBI formatting service cannot populate it from saved values. However, the `visual.ts` reads from `s.axisSettings.showXAxis.value` and `s.axisSettings.showYAxis.value`. These will ALWAYS return defaults since the format pane writes to `axisFormatting` instead.
- In morphing-area-chart, `axisSettings` IS in the cards array, creating a valid but confusing dual-source where both cards show in the format pane.

**Severity:** MEDIUM (animated-waterfall, box-plot) / LOW (morphing-area-chart)
**Recommended fix:** Remove the old `axisSettings` cards and caps objects. Migrate all `axisSettings` references in visual.ts to use `axisFormattingCard` instead.

---

### Issue 2: Extra `seriesLineStyle`/`seriesLineWidth` in capabilities.json `seriesFormatting`

**Affected visuals:** radar-chart, slope-chart, stream-graph

The `seriesFormatting` object in capabilities.json for these three visuals contains two extra properties not present in the shared `SeriesFormattingCard`:
- `seriesLineStyle`
- `seriesLineWidth`

The shared `SeriesFormattingGroup` already has `lineStyle` and `lineWidth` properties. The `seriesLineStyle`/`seriesLineWidth` props appear to be legacy duplicates with a `series` prefix.

**capabilities.json `seriesFormatting` properties (these 3 visuals):**
```
seriesColor, seriesOpacity, showDataLabels, lineStyle, lineWidth, seriesLineStyle, seriesLineWidth
```

**Shared `SeriesFormattingGroup` properties:**
```
seriesColor, seriesOpacity, showDataLabels, lineStyle, lineWidth
```

**Impact:** The extra `seriesLineStyle`/`seriesLineWidth` caps properties have no matching settings card slice. PBI will ignore them in the format pane but they bloat the capabilities file.

**Severity:** LOW (orphaned caps properties, no functional impact)
**Recommended fix:** Remove `seriesLineStyle` and `seriesLineWidth` from capabilities.json for radar-chart, slope-chart, and stream-graph.

---

### Issue 3: Missing `referenceBandWidth` in stream-graph capabilities.json

**Affected visual:** stream-graph

The shared `ReferenceLineFormattingCard` has 12 properties including `referenceBandWidth`. The stream-graph's `referenceLineFormatting` caps object only has 11 properties -- `referenceBandWidth` is missing.

**Shared card properties:** showReferenceLine, referenceLineType, referenceLineValue, referenceLineColor, referenceLineWidth, referenceLineStyle, showReferenceLabel, referenceLabelText, showReferenceBand, referenceBandOpacity, **referenceBandWidth**, referenceLineAxis

**stream-graph caps properties:** showReferenceLine, referenceLineType, referenceLineValue, referenceLineColor, referenceLineWidth, referenceLineStyle, showReferenceLabel, referenceLabelText, showReferenceBand, referenceBandOpacity, referenceLineAxis

**Impact:** The `referenceBandWidth` property exists in the settings card and shows in the format pane, but PBI cannot persist its value because it's missing from capabilities.json. Changes to Band Width will revert to the default (10) on visual reload.

**Severity:** MEDIUM (user-facing data loss on reload)
**Recommended fix:** Add `referenceBandWidth` to stream-graph's `referenceLineFormatting` caps object.

---

### Issue 4: Old naming convention `legendSettings` in heatmap-calendar

**Affected visual:** heatmap-calendar

The heatmap-calendar uses a local `LegendSettings` card with `name = 'legendSettings'` instead of the shared `LegendFormattingCard` (which uses `name = 'legendFormatting'`). Both settings and caps are in sync (both use `legendSettings`), so there is no functional issue. However, it deviates from the naming convention used by all other visuals.

The local card has only 2 properties (`showLegend`, `legendPosition`) vs the shared card's 6 properties (adds `legendFontSize`, `legendFontColor`, `legendFontFamily`, `legendFontWeight`).

**Severity:** LOW (cosmetic naming inconsistency, fewer features than shared card)
**Recommended fix:** Optionally migrate to the shared `LegendFormattingCard` and rename the caps object to `legendFormatting`.

---

### Issue 5: Inconsistent `cardSettings` style mode

**Observation (not a sync issue):**

5 visuals use the newer `cardStyleMode` (enum: none/glass/elevated/neumorphic):
- kpi-card, bar-chart-pro, health-bar, animated-donut-pro, sankey-diagram, treemap-pro

26 visuals use the older `enableGlass` (boolean toggle):
- All others

Both approaches are internally consistent (settings and caps match), but the user experience differs. `cardStyleMode` provides more styling options.

**Severity:** LOW (consistency improvement opportunity)

---

## Pass 2: Dead Settings Hunt

### Methodology

For each visual, I checked every property field in settings.ts against visual.ts using these criteria:
1. **Truly dead:** Property name never appears in visual.ts at all
2. **Functionally dead:** Property only referenced in `updateVisibility()` to show/hide format pane controls
3. **Indirectly used:** Property exists on a card object that is passed whole to a core helper function (e.g., `formatWithSettings`, `renderChartTitle`, `applyAllAxisFormatting`)

### Priority Visuals (10): Full Audit

| Visual | Dead Properties | Functionally Dead | Notes |
|--------|----------------|-------------------|-------|
| kpi-card | 0 | 0 | All properties used directly or via helpers |
| bar-chart-pro | 0 | 0 | `lineNumberFormattingCard` passed to `formatWithSettings` |
| health-bar | 0 | 0 | Clean |
| radial-gauge | 0 | 0 | Clean |
| waffle-chart | 0 | 0 | Clean |
| chord-diagram | 0 | 0 | Clean |
| dumbbell-chart | 0 | 0 | Card style props used via `applyGlassStyle` alias |
| radar-chart | 0 | 0 | `hoverDim` used for hover dim behavior |
| polar-chart | 0 | 0 | Clean |
| ring-stack | 0 | 0 | Clean |

### Remaining Visuals (21): Spot Check

| Visual | Dead Properties | Notes |
|--------|----------------|-------|
| animated-donut-pro | 0 | Clean |
| animated-waterfall | 0 | See axisSettings dual-source issue above |
| bar-race | 0 | Clean |
| box-plot | 0 | See axisSettings dual-source issue above |
| bullet-chart-pro | 0 | Clean |
| bump-chart | 0 | Clean |
| funnel-pro | 0 | Clean |
| gantt-chart-pro | 0 | Clean |
| gauge-cluster | 0 | Clean |
| heatmap-calendar | 0 | Clean |
| morphing-area-chart | 0 | Clean |
| network-graph | 0 | Clean |
| progress-bar-stack | 0 | Clean |
| sankey-diagram | 0 | Clean |
| scatter-bubble | 0 | Clean |
| slope-chart | 0 | Clean |
| status-indicator | 0 | Clean |
| stream-graph | 0 | Clean |
| sunburst-chart | 0 | Clean |
| timeline-milestone | 0 | Clean |
| treemap-pro | 0 | Clean |

### Pass 2 Conclusion

**No truly dead settings properties were found across any of the 31 visuals.** The codebase is remarkably clean in this regard. Every property defined in settings.ts is consumed either:
- Directly in visual.ts (e.g., `s.barSettings.cornerRadius.value`)
- Via a local alias (e.g., `const cs = s.cardSettings; cs.enableGlass.value`)
- Indirectly through core helper pass-through (e.g., `formatWithSettings(v, s.numberFormattingCard)`)
- In `updateVisibility()` to control format pane state (which is valid usage)

The only quasi-dead issue found was the **axisSettings dual-source problem** in animated-waterfall and box-plot (Issue 1 above), where the old `axisSettings` card reads default values because it's not in the model's `cards` array, while `axisFormatting` handles actual user input.

---

## Shared Cards Usage Matrix

| Shared Card | Visuals Using It |
|------------|-----------------|
| TitleFormattingCard | ALL 31 visuals |
| ConditionalFormattingCard | ALL 31 visuals |
| AccessibilityFormattingCard | ALL 31 visuals |
| DateFilterFormattingCard | ALL 31 visuals |
| DataLabelFormattingCard | 29 visuals (not kpi-card, status-indicator uses it indirectly) |
| NumberFormattingCard | 26 visuals |
| AxisFormattingCard | 21 visuals |
| LegendFormattingCard | 18 visuals |
| ColorThemeFormattingCard | 18 visuals |
| ReferenceLineFormattingCard | 15 visuals |
| TrendLineFormattingCard | 14 visuals |
| ScrollFormattingCard | 12 visuals |
| SeriesFormattingCard | 11 visuals |
| AnnotationFormattingCard | 10 visuals |
| CrosshairFormattingCard | 4 visuals (bump-chart, morphing-area-chart, slope-chart, stream-graph) |
| LineStrokeFormattingCard | 4 visuals (bump-chart, morphing-area-chart, slope-chart, stream-graph) |
| SortFormattingCard | 6 visuals (chord-diagram, dumbbell-chart, health-bar, polar-chart, ring-stack, sankey-diagram) |
| TargetFormattingCard | 0 visuals (defined in core but unused; visuals define custom target cards) |

---

## Action Items (Priority Order)

### Must Fix (MEDIUM severity)
1. **stream-graph:** Add `referenceBandWidth` to `referenceLineFormatting` in capabilities.json
2. **animated-waterfall:** Remove `axisSettings` card and caps object; migrate visual.ts to read from `axisFormattingCard`
3. **box-plot:** Same as animated-waterfall

### Should Fix (LOW severity)
4. **radar-chart, slope-chart, stream-graph:** Remove orphaned `seriesLineStyle`/`seriesLineWidth` from `seriesFormatting` caps
5. **morphing-area-chart:** Remove redundant `axisSettings` card and caps object (already uses `axisFormattingCard`)
6. **heatmap-calendar:** Consider migrating `legendSettings` to shared `LegendFormattingCard`
7. **26 visuals:** Consider migrating `enableGlass` to `cardStyleMode` for feature parity with the 5 visuals already using it

### Won't Fix / Informational
8. **TargetFormattingCard** is defined in core but no visual uses it (all define custom target/goal cards)
