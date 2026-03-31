# Pass 7: Enum Drift + Orphaned Capabilities Deep Check

**Date**: 2026-03-18
**Scope**: All 31 Power BI visuals at `packages/`
**Methodology**: Automated Python analysis comparing every `ItemDropdown` in `settings.ts` against `capabilities.json` enumerations, cross-referencing shared cards from `packages/core/src/shared-settings.ts`, and verifying `cards[]` array completeness on every Model class.

---

## 1. Enum Drift

**Result: 0 drift issues found across all 31 visuals.**

Every `ItemDropdown` in every settings card (both local and shared) was compared against its matching `enumeration` in `capabilities.json`. Item counts and exact values match in all cases.

### Methodology

- Extracted all `ItemDropdown` definitions from each visual's `settings.ts`, including shared cards imported from `core/src/shared-settings.ts`
- For shared cards, resolved reference-based items arrays (`FONT_FAMILY_ITEMS`, `FONT_WEIGHT_ITEMS`, `COLOR_THEME_ITEMS`)
- Compared per-card/per-object (not globally by property name) to avoid false positives from same-named properties across different objects (e.g., `lineStyle` exists in both `quadrantSettings` and `trendlineSettings` in scatter-bubble)
- Verified all 31 visuals

---

## 2. Orphaned Capabilities

### 2a. Object-Level Orphans

**Result: 0 object-level orphans in either direction.**

Every capability object in every `capabilities.json` has a matching card in `settings.ts` (either local or imported from shared). Every card in `settings.ts` has a matching capability object.

### 2b. Property-Level Orphans

**4 findings across 4 visuals.**

#### Finding 1: `seriesLineStyle` and `seriesLineWidth` in capabilities but not in settings (3 visuals)

| Visual | Object | Orphan Properties |
|--------|--------|-------------------|
| `radar-chart` | `seriesFormatting` | `seriesLineStyle`, `seriesLineWidth` |
| `slope-chart` | `seriesFormatting` | `seriesLineStyle`, `seriesLineWidth` |
| `stream-graph` | `seriesFormatting` | `seriesLineStyle`, `seriesLineWidth` |

**Root cause**: These 3 visuals have `seriesFormatting` capability objects with 7 properties, while the shared `SeriesFormattingGroup` (from `core/src/shared-settings.ts`) only defines 5 properties: `seriesColor`, `seriesOpacity`, `showDataLabels`, `lineStyle`, `lineWidth`. The extra `seriesLineStyle` and `seriesLineWidth` properties in capabilities are dead weight -- they can never be set by the user because no corresponding setting control exists.

**Impact**: Low. The extra properties are inert. No data loss, but they add noise to the capabilities schema.

**Fix**: Remove `seriesLineStyle` and `seriesLineWidth` from `capabilities.json` in all 3 visuals.

**Other visuals with `seriesFormatting`** (bar-chart-pro, box-plot, bump-chart, dumbbell-chart, morphing-area-chart, polar-chart, scatter-bubble) correctly have only 5 properties matching the shared group.

#### Finding 2: `referenceBandWidth` in settings but not in capabilities (1 visual)

| Visual | Object | Orphan Property |
|--------|--------|-----------------|
| `stream-graph` | `referenceLineFormatting` | `referenceBandWidth` |

**Root cause**: The shared `ReferenceLineFormattingCard` defines 12 properties including `referenceBandWidth`, but `stream-graph/capabilities.json` only declares 11 of them (missing `referenceBandWidth`).

**Impact**: Medium. The "Band Width (%)" slider appears in the format pane for stream-graph but changes will NOT persist -- Power BI ignores property values that have no matching capability declaration.

**Fix**: Add `referenceBandWidth` property to `stream-graph/capabilities.json` under `referenceLineFormatting.properties`:
```json
"referenceBandWidth": {
  "type": { "numeric": true }
}
```

**Other visuals with `referenceLineFormatting`** (animated-waterfall, bar-chart-pro, bar-race, box-plot, bullet-chart-pro, bump-chart, dumbbell-chart, funnel-pro, gantt-chart-pro, morphing-area-chart, polar-chart, scatter-bubble, slope-chart) all correctly include `referenceBandWidth`.

---

## 3. Cards Array Completeness

**4 findings, all intentional legacy patterns.**

| Visual | Field | Type | In `cards[]`? | Status |
|--------|-------|------|---------------|--------|
| `animated-waterfall` | `axisSettings` | `AxisSettingsCard` | No | Superseded by `axisFormattingCard` |
| `box-plot` | `axisSettings` | `AxisSettingsCard` | No | Intentional -- comment says "hidden from pane, superseded by axisFormattingCard" |
| `heatmap-calendar` | `_legacyCalendarSettings` | `_LegacyCalendarSettings` | No | Intentional -- comment says "Legacy card -- kept for backward compat" |
| `sankey-diagram` | `scrollFormattingCard` | via IIFE | Yes* | False positive -- uses IIFE pattern `= (() => { ... })()` |

### Details

**animated-waterfall `axisSettings`**: This local `AxisSettingsCard` (with `name = 'axisSettings'`) is declared on the Model but NOT in `cards[]`. The visual code (`visual.ts` lines 1213, 1246) reads `s.axisSettings.showXAxis.value` and `s.axisSettings.showYAxis.value`. Since the card isn't in the format pane, users cannot toggle these axes. The shared `axisFormattingCard` IS in the cards array and provides much richer axis control. However, there's a subtle issue: the local card's `name` is `'axisSettings'` while the shared card's `name` is `'axisFormatting'` -- these map to DIFFERENT capability objects. The visual code reads from `axisSettings` (which exists in capabilities) but the pane shows `axisFormatting`.

**Recommendation**: The animated-waterfall visual.ts should be updated to read from `axisFormattingCard` instead of `axisSettings`, then the local `AxisSettingsCard` can be removed entirely. Currently, toggling "Show X-Axis" in the format pane (which writes to `axisFormatting.showXAxis`) has no effect because the visual reads from `axisSettings.showXAxis`.

**box-plot `axisSettings`**: Same pattern, explicitly documented with a comment. Confirmed: `visual.ts` has 9 references to `s.axisSettings` (lines 440, 441, 444, 445, 513, 538, 544, 557, 564) reading `showXAxis`, `showYAxis`, and `gridLines`. The format pane writes to `axisFormatting` (shared card) but the visual reads from `axisSettings` (local hidden card). Same fix needed as animated-waterfall.

**heatmap-calendar `_legacyCalendarSettings`**: Prefixed with underscore, explicitly documented as legacy. The `labelColor` property is mapped in capabilities to maintain backward compatibility with saved reports.

**sankey-diagram**: Not actually missing. The `scrollFormattingCard` is in `cards[]` (line 561). The automated detection flagged it because it uses an IIFE initialization pattern (`= (() => { ... })()`) instead of a plain `new ScrollFormattingCard()`, which the regex didn't match.

---

## 4. Cross-Reference: Capability Object vs Card Name Mapping

All 31 visuals were verified. For reference, these are the shared cards from `core/src/shared-settings.ts` and their usage counts:

| Shared Card | `name` field | Visuals using it |
|-------------|-------------|------------------|
| `TitleFormattingCard` | `titleFormatting` | 31/31 |
| `ConditionalFormattingCard` | `conditionalFormatting` | 31/31 |
| `AccessibilityFormattingCard` | `accessibilityFormatting` | 31/31 |
| `DateFilterFormattingCard` | `dateFilterFormatting` | 31/31 |
| `DataLabelFormattingCard` | `dataLabelFormatting` | 29/31 |
| `NumberFormattingCard` | `numberFormatting` | 25/31 |
| `ColorThemeFormattingCard` | `colorThemeFormatting` | 22/31 |
| `AxisFormattingCard` | `axisFormatting` | 19/31 |
| `LegendFormattingCard` | `legendFormatting` | 18/31 |
| `ReferenceLineFormattingCard` | `referenceLineFormatting` | 14/31 |
| `TrendLineFormattingCard` | `trendLineFormatting` | 13/31 |
| `AnnotationFormattingCard` | `annotationFormatting` | 10/31 |
| `SeriesFormattingCard` | `seriesFormatting` | 10/31 |
| `ScrollFormattingCard` | `scrollFormatting` | 9/31 |
| `SortFormattingCard` | `sortFormatting` | 5/31 |
| `CrosshairFormattingCard` | `crosshairFormatting` | 4/31 |
| `LineStrokeFormattingCard` | `lineStrokeFormatting` | 4/31 |

---

## Summary of Actionable Findings

| # | Severity | Visual(s) | Issue | Fix |
|---|----------|-----------|-------|-----|
| 1 | Low | radar-chart, slope-chart, stream-graph | `seriesLineStyle` and `seriesLineWidth` orphaned in capabilities.json | Remove from capabilities.json |
| 2 | Medium | stream-graph | `referenceBandWidth` missing from capabilities.json | Add property to capabilities.json |
| 3 | Medium | animated-waterfall | visual.ts reads `axisSettings` but format pane writes `axisFormatting` | Update visual.ts to use axisFormattingCard |
| 4 | Medium | box-plot | visual.ts reads `axisSettings` (9 refs) but format pane writes `axisFormatting` | Update visual.ts to use axisFormattingCard |

**Total issues found: 4 actionable items (0 enum drift, 4 property-level orphans/mismatches, 0 true missing-from-cards)**

### Files examined
- 31 `capabilities.json` files
- 31 `settings.ts` files
- 1 `core/src/shared-settings.ts` (17 shared card definitions)
- 2 `visual.ts` files (animated-waterfall, box-plot) for read-path verification
