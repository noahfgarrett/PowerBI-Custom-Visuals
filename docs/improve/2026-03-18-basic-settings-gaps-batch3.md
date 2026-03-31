# Basic Settings Gaps -- Batch 3

**Visuals audited:** kpi-card, morphing-area-chart, network-graph, polar-chart, progress-bar-stack, radar-chart

**Date:** 2026-03-18

**Method:** Read `settings.ts` and `visual.ts` for each visual. Cross-referenced shared cards from `core/src/shared-settings.ts` (`AxisFormattingCard`, `LegendFormattingCard`, `DataLabelFormattingCard`, `TitleFormattingCard`, `LineStrokeFormattingCard`, `SeriesFormattingCard`, `NumberFormattingCard`, `AccessibilityFormattingCard`, `ConditionalFormattingCard`, `ColorThemeFormattingCard`, `DateFilterFormattingCard`). Listed only gaps -- settings that a typical Power BI user would expect but cannot configure today.

---

## 1. kpi-card

### Labels / Text
- **No axis label rotation** -- N/A for a card visual (not a gap).
- **No axis titles** -- N/A for a card visual.
- **Trend font family missing** -- Trend arrow section has fontSize and colors but no fontFamily or fontWeight.
- **Comparison font family missing** -- KpiComparisonSettings has fontSize and fontColor but no fontFamily or fontWeight.
- **Sparkline min/max label font controls missing** -- showMinMax renders colored dots but no font size/color control for min/max text (there are no text labels, only dots -- minor).

### Colors
- **No per-KPI-slot color control** -- Multi-KPI grid uses the same settings for all slots; user cannot assign different colors per KPI.
- **No sparkline bar color per-bar** -- Bar sparkline uses a single strokeColor for all bars; no per-bar or conditional coloring.

### Axes
- N/A -- card visual has no axes.

### Legend
- **No legend** -- Multi-KPI mode shows up to 4 KPIs but no legend to identify them.

### Layout / Chrome
- **No padding/margin control** -- Wrapper uses hardcoded `gap: 6px`, `gap: 8px` for multi-KPI grid. No user-facing padding setting.
- **No subtitle on the card itself** -- TitleFormattingCard provides subtitle, but there is no card-level subtitle distinct from the label.

### Interaction
- **Cross-filter is basic** -- Click on the value row fires `selectionManager.select`, but there is no toggle to disable cross-filtering.
- **No tooltip customization** -- Tooltips are hardcoded (label, value, target, delta). No user toggle to show/hide tooltip fields.

---

## 2. morphing-area-chart

### Labels / Text
- (Covered) Data labels: toggle, font size, color, family, weight, position -- all via `DataLabelFormattingCard`. OK.
- (Covered) Axis labels: rotation, font size, color, family, weight -- all via `AxisFormattingCard`. OK.
- (Covered) Axis titles -- via `AxisFormattingCard`. OK.

### Colors
- **No individual series color picker in local settings** -- Relies on shared `SeriesFormattingCard` dynamic groups. Per-series color requires the series card, which works, but there is no simple "Series 1 Color" picker in local settings.
- **No dot fill color control** -- `dotStrokeColor` and `dotStrokeWidth` exist but no `dotFillColor`. Dots inherit the series color with no override.

### Axes
- (Covered) Show/hide X/Y, min/max, grid lines -- all present via local `AxisSettingsCard` + shared `AxisFormattingCard`.
- **Local axis card duplicates shared card** -- `AxisSettingsCard` has `showXAxis`, `showYAxis`, `gridLines` toggles that overlap with `AxisFormattingCard.showXAxis`, `showYAxis`, `showGridLines`. User sees both cards. This is confusing, not a missing setting per se, but a UX gap.

### Legend
- (Covered) Show/hide, position, font size, color, family, weight -- all via `LegendFormattingCard`. OK.

### Layout / Chrome
- **No chart padding/margin control** -- Margins are hardcoded in `visual.ts`. User cannot adjust inner padding.

### Interaction
- **No cross-filter toggle** -- Click-to-select fires `selectionManager.select` but there is no setting to disable it.
- **No tooltip field customization** -- Tooltips show series name and value. No toggle for additional fields.

---

## 3. network-graph

### Labels / Text
- **No node label font size control** -- `showLabels` toggle exists, and `DataLabelFormattingCard` is applied to `.network-label`, giving font size/color/weight/family. However, `showDataLabels` is hidden (`visible = false`), so the main toggle is local `showLabels` only. The shared card's font controls still apply. Minor: showDataLabels and showLabels are disconnected.
- **No link label / weight label** -- Links have no visible weight label. If a user has weighted edges, they cannot see the weight on the link.

### Colors
- **No per-node color control** -- Nodes are colored by palette index or cluster. No way to set a specific node's color.
- **No per-link color control** -- All links share one `linkColor`. No way to color individual links differently (except via conditional formatting on weight).

### Axes
- N/A -- force-directed graph has no axes.

### Legend
- **No legend at all** -- When clustering is enabled, different clusters get different colors, but there is no legend mapping cluster to color. Also no legend for node groups.

### Layout / Chrome
- **No chart padding control** -- `MARGIN` is hardcoded `{ top: 8, right: 8, bottom: 8, left: 8 }`. Not user-configurable.

### Interaction
- **No cross-filter toggle** -- Click-to-select on nodes fires `selectionManager.select` but there is no setting to disable it.
- **No tooltip font/style customization** -- Node tooltips are SVG `<title>` elements (browser-native). No rich tooltip with formatting.
- **No link tooltip** -- Hovering a link shows no tooltip with source/target/weight info.

---

## 4. polar-chart

### Labels / Text
- **No label font size control in local LabelSettings** -- `LabelSettings` has `showLabels`, `showRadialLabels`, `showInnerLabels`, and `labelColor`, but no `fontSize`, `fontFamily`, or `fontWeight`. Inner labels inherit a hardcoded CSS class. Radial labels use `axisFormattingCard.axisLabelSize` which is indirect and confusing.
- **No label position override** -- Label position is computed from geometry (inside petals at 65% radius). User cannot adjust offset.

### Colors
- **No per-segment color picker** -- `baseColor` sets one color for all segments (with auto-lightening). `SeriesFormattingCard` enables per-series overrides, but there is no simple per-segment color array.

### Axes
- **Axis card properties are mostly hidden** -- `showXAxis`, `showYAxis`, `xAxisTitle`, `yAxisTitle`, `axisLabelFontFamily`, `axisLabelRotation`, `yAxisMin`, `yAxisMax`, `gridLineWidth`, `gridLineOpacity` are all set to `visible = false`. This is correct for a polar chart, but it means the Axis Formatting card appears in the pane with only a few visible options -- could confuse users.

### Legend
- (Covered) Show/hide, position, font size, color, family -- via `LegendFormattingCard`. OK.

### Layout / Chrome
- **No chart padding control** -- Padding is hardcoded at `24px`. Not user-configurable.
- **No inner-radius label** -- When `innerRadius > 5`, a decorative center dot is rendered but the user cannot place text in the center (e.g., a total).

### Interaction
- **No cross-filter toggle** -- Click-to-select on petals fires `selectionManager.select` but no setting to disable it.
- **No tooltip customization** -- Tooltip shows "Category" and "Value". No user control over which fields appear.

---

## 5. progress-bar-stack

### Labels / Text
- **No category label font family control** -- `applyAxisLabelFormatting()` applies `axisLabelColor` and `axisLabelSize` to `.progress-label`, but `axisLabelFontFamily` is hidden. Users cannot change the category label font.
- **No value label font family/weight in local settings** -- Value labels (`.progress-value`) get formatting from `DataLabelFormattingCard`, which has font size/color/weight/family. But `showDataLabels` is hidden. The local `showValue`/`showPercent` toggles control visibility. The disconnect means font family from `DataLabelFormattingCard` applies but the user may not find it.
- **No label position control** -- Category labels are always on the left, value labels always on the right. No option for inside-bar labels.

### Colors
- **No per-bar color when not using conditional formatting** -- `barColor` is a single color. The visual falls back to chart palette per row, but only when `barColor` equals the default `#3B82F6`. There is no explicit "color by category" toggle.
- **No track border/stroke** -- Track has `backgroundColor` but no border color or border width.

### Axes
- **All axis properties hidden** -- The shared `AxisFormattingCard` is included but every single property is set to `visible = false` except `axisLabelColor` and `axisLabelSize`. This is correct for a bar-only visual, but the card still shows up with a confusing near-empty state.

### Legend
- **No legend** -- Progress bar stack has no legend. When multiple bars have palette-assigned colors, there is no legend to identify them. Users must rely on the category label.

### Layout / Chrome
- **No overall padding control** -- Wrapper uses `gap` from `barSettings.gap` for row spacing, which is good. But there is no outer padding/margin control.

### Interaction
- **No cross-filter toggle** -- Click fires `selectionManager.select`. No setting to disable.
- **No tooltip** -- Bars do not show tooltips on hover. Only the fill bar has a brightness hover effect. This is a significant gap -- users expect to hover and see value/target/percentage.

---

## 6. radar-chart

### Labels / Text
- **No axis label font family** -- `axisLabelFontFamily` from `AxisFormattingCard` is hidden (`visible = false`). Users cannot change the category label font around the radar.
- **No axis label font weight** -- `axisLabelFontWeight` from `AxisFormattingCard` is hidden (not explicitly set to hidden in code but inherited from the shared card -- checking: it is NOT hidden, so it should be visible). Actually, re-reading: only specific fields are hidden. `axisLabelFontWeight` is not hidden, so it should be visible. OK -- not a gap.

### Colors
- **No per-axis web stroke color** -- One `webStrokeColor` applies to all grid levels. No way to vary color by level.
- **No polygon stroke width in local settings** -- Polygon stroke width comes from `SeriesFormattingCard` (`sf.lineWidth`). This is correct but indirect. The local `radarAppearance` card has no `strokeWidth` property.

### Axes
- **Axis min/max hidden** -- `yAxisMin` and `yAxisMax` from `AxisFormattingCard` are hidden. For a radar chart with `independentScales` mode, letting users override per-axis max would be useful but is not available.

### Legend
- **Legend only shows for multi-series** -- `showLegend && series.length > 1` gates the legend. Single-series radar charts never get a legend. This is standard behavior but worth noting.
- **Legend font weight missing** -- The radar builds its own legend HTML instead of using the shared `renderLegend()` helper. The custom HTML applies `legendFontSize`, `legendFontColor`, and `legendFontFamily`, but does not apply `legendFontWeight`.

### Layout / Chrome
- **No chart padding control** -- Margin is hardcoded at `40`. Not user-configurable.

### Interaction
- **No cross-filter toggle** -- Dots fire `selectionManager.select`. No setting to disable.
- **No tooltip customization** -- Series tooltip shows only "Series: name". Point tooltip shows category/series/value. No user toggle for fields.

---

## Cross-Visual Summary of Most Common Gaps

| Gap | KPI | Area | Network | Polar | Progress | Radar |
|-----|-----|------|---------|-------|----------|-------|
| No chart padding control | X | X | X | X | X | X |
| No cross-filter toggle | X | X | X | X | X | X |
| No tooltip customization | X | X | X | X | -- | X |
| No tooltips at all | -- | -- | -- | -- | X | -- |
| No legend | -- | -- | X | -- | X | -- |
| Label font family missing on some elements | -- | -- | -- | X | X | -- |
| No per-element color control | X | -- | X | -- | -- | -- |
| Duplicated/confusing axis card | -- | X | -- | X | X | X |
| No link/weight tooltip | -- | -- | X | -- | -- | -- |

### Priority Fixes (highest impact, lowest effort)

1. **progress-bar-stack: Add hover tooltips** -- Only visual in the batch with zero tooltip support. Users expect value/target/% on hover.
2. **network-graph: Add a legend** -- When clustering is on, colors are meaningless without a legend.
3. **All visuals: Add a chart padding control** -- A simple `NumUpDown` for inner padding in the Card Style card. One shared setting, 6 visuals fixed.
4. **All visuals: Add a cross-filter toggle** -- A `ToggleSwitch` "Enable Cross-Filter" in the Interaction card. Prevents unwanted report-level filtering.
5. **polar-chart: Add label font size/family/weight** -- The local `LabelSettings` card is missing basic font controls. Users cannot style polar labels.
6. **radar-chart: Apply legendFontWeight** -- One-line fix in the custom legend builder.
7. **progress-bar-stack: Add a legend** -- When bars use palette colors, a legend is needed.
8. **network-graph: Add link tooltips** -- Hovering a link should show source, target, and weight.
