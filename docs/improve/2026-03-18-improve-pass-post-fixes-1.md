# Post-Fixes Pass 1 -- Remaining Settings Gaps

Date: 2026-03-18
Scope: All 31 visuals in `packages/`

After the massive fix round (tooltipService to 7, legends to 10, cross-filter to 3, axis titles to 5, ColorThemeFormattingCard to 8, font family/weight to 8, waterfall/lollipop to bar-chart-pro), this document captures **remaining** gaps only.

---

## Summary of What's Covered

Shared cards from `core/shared-settings.ts` already provide full font customization:
- **AxisFormattingCard**: show/hide axes, titles, label color, label font size, font family, font weight, grid lines, Y-axis min/max
- **LegendFormattingCard**: show/hide, position, font size, font color, font family, font weight
- **DataLabelFormattingCard**: show/hide, font size, font color, font weight, font family, position
- **TitleFormattingCard**: title text, font size, font color, font family, font weight, alignment
- **ColorThemeFormattingCard**: palette selection
- **NumberFormattingCard**: display units, decimal places, prefix, suffix

All 31 visuals have `selectionManager` (cross-filtering).
28/31 visuals have PBI `tooltipService`; 3 use custom tooltip implementations.
All 31 have `ColorThemeFormattingCard`.

---

## GAP 1: Missing Font Family/Weight on Local Text Settings

These visuals have local text properties (fontSize, fontColor) on custom cards but **lack fontFamily and/or fontWeight** for those same local text elements. The shared DataLabelFormattingCard/LegendFormattingCard cover *their* own text, but visual-specific text cards need their own font controls.

| Visual | Card Missing fontFamily/fontWeight | Has fontSize | Has fontColor |
|--------|-----------------------------------|-------------|---------------|
| **animated-donut-pro** | DonutSettings (labelColor, labelFontSize) -- no fontFamily/fontWeight | YES | YES |
| **animated-donut-pro** | ValueSettings (fontSize, fontColor) -- no fontFamily/fontWeight | YES | YES |
| **box-plot** | (all text via shared cards) | OK | OK |
| **bump-chart** | BumpRankChangeSettings (fontSize) -- no fontColor, fontFamily, fontWeight | YES | NO |
| **dumbbell-chart** | DeltaLabelSettings (fontSize, fontColor) -- no fontFamily/fontWeight | YES | YES |
| **morphing-area-chart** | (all text via shared cards) | OK | OK |
| **progress-bar-stack** | BarAppearance (labelColor only) -- no labelFontSize, fontFamily, fontWeight | NO | YES |
| **ring-stack** | CenterContent (fontSize, fontColor, labelFontSize) -- no fontFamily/fontWeight | YES | YES |
| **treemap-pro** | TreemapSettings (showLabels/showValues but no font controls for tile text) | NO | NO |
| **treemap-pro** | DrillDown breadcrumb -- has fontSize, color, but no fontFamily/fontWeight | YES | YES |
| **network-graph** | NodeSettings (showLabels) -- no label fontSize, fontColor, fontFamily, fontWeight | NO | NO |
| **scatter-bubble** | QuadrantSettings (labelFontSize) -- no fontColor, fontFamily, fontWeight | YES | NO |
| **scatter-bubble** | TrendlineSettings (labelFontSize) -- no fontColor, fontFamily, fontWeight | YES | NO |
| **heatmap-calendar** | CalendarLayout (showMonthLabels, showDayLabels) -- no font controls for those labels | NO | NO |
| **slope-chart** | LabelsChange (fontSize, fontColor, labelColor) -- no fontFamily/fontWeight on change labels | YES | YES |

### Priority: MEDIUM
Users expect to match their report's brand fonts. The shared cards cover data labels, legend, axis, and title -- but visual-specific text (center values, rank indicators, breadcrumbs, node labels, calendar labels) can't be styled consistently without local fontFamily/fontWeight.

---

## GAP 2: Missing PBI tooltipService (using custom HTML tooltips instead)

These 3 visuals use custom-built tooltip UI rather than PBI's native `tooltipService`:

| Visual | Current Implementation |
|--------|----------------------|
| **network-graph** | SVG `<title>` elements on nodes |
| **sankey-diagram** | SVG `<title>` elements on nodes and links |
| **scatter-bubble** | Custom `<div class="scatter-bubble-tooltip">` positioned manually |

### Why it matters
PBI's `tooltipService` integrates with:
- Report page tooltips (custom tooltip pages)
- Drillthrough from tooltips
- Consistent tooltip styling across all visuals in a report
- Accessibility (keyboard-triggered tooltips)

### Priority: HIGH for scatter-bubble and network-graph (interactive charts where users expect rich tooltips). MEDIUM for sankey-diagram (already has configurable tooltip card with showPercentage/valueFormat).

---

## GAP 3: Missing Label Font Controls on Specific Visuals

These are the most impactful "can't style visible text" gaps:

### 3a. animated-donut-pro -- Center Value missing fontFamily/fontWeight
- `ValueSettings` has fontSize + fontColor but no fontFamily/fontWeight
- Center value is a prominent text element, always visible

### 3b. animated-donut-pro -- Donut Labels missing fontFamily/fontWeight
- `DonutSettings` has labelColor + labelFontSize but no fontFamily/fontWeight
- Slice labels are always visible when enabled

### 3c. ring-stack -- Center Content missing fontFamily/fontWeight
- `CenterContentSettings` has fontSize + fontColor + labelFontSize but no fontFamily/fontWeight
- Center value and label are the primary information display

### 3d. treemap-pro -- Tile Labels have zero font controls
- `TreemapSettings` has showLabels/showValues toggles only
- No fontSize, fontColor, fontFamily, or fontWeight for the tile text
- This is a major gap -- tile labels are the primary readable element

### 3e. network-graph -- Node Labels missing all font controls
- `NodeSettings` has showLabels toggle + radius/border settings only
- No fontSize, fontColor, fontFamily, fontWeight for node labels
- Labels are critical for node identification

### 3f. heatmap-calendar -- Month/Day Labels missing all font controls
- Layout card has show/hide toggles for month and day labels
- No fontSize, fontColor, fontFamily, fontWeight for these labels
- The legacy `labelColor` exists but is hidden

### 3g. bump-chart -- Rank Change indicators missing fontColor
- `BumpRankChangeSettings` has fontSize but no fontColor, fontFamily, fontWeight

### 3h. progress-bar-stack -- Bar labels missing fontSize/fontFamily/fontWeight
- `BarAppearance` has labelColor but no labelFontSize, labelFontFamily, labelFontWeight

### Priority: HIGH -- These are visible text elements that users cannot customize.

---

## GAP 4: Missing Legend on visuals that arguably need one

All 31 visuals now have `LegendFormattingCard` EXCEPT:
- (none -- all 31 now have it after the fix round)

However, some visuals have a **local legend** that differs from the shared card:
- **heatmap-calendar** -- Has its own `LegendSettings` card (showLegend, position) but does NOT use the shared `LegendFormattingCard`. Missing: legendFontSize, legendFontColor, legendFontFamily, legendFontWeight.

### Priority: LOW -- The heatmap-calendar's color legend is a gradient bar, not a typical category legend, so full font controls are less critical.

---

## GAP 5: Specific Color Gaps

### 5a. Connector/line colors that default to empty string
Many visuals use `value: { value: '' }` for stroke/line colors, falling back to theme. This is fine behavior, but users may not realize they CAN customize these. The real gap:

### 5b. scatter-bubble -- Missing quadrant label fontColor
- QuadrantSettings has labelFontSize but no label fontColor -- labels inherit from unknown default

### 5c. animated-waterfall -- Value labels missing fontColor
- ValueSettingsCard has fontSize, fontFamily, fontWeight but **no fontColor**
- Users can't change value label color

### Priority: MEDIUM

---

## GAP 6: Axis Configuration Completeness

All visuals that use axes now have `AxisFormattingCard` from shared settings, which includes:
- show/hide X/Y axes
- axis titles
- label color, size, font family, font weight
- grid lines
- Y-axis min/max

**No remaining axis gaps** -- the shared card covers everything needed.

---

## Recommended Fix Priorities

### Batch 1 (HIGH -- visible text with zero font controls)
1. **treemap-pro** -- Add fontSize, fontColor, fontFamily, fontWeight to TreemapSettings for tile labels
2. **network-graph** -- Add label fontSize, fontColor, fontFamily, fontWeight to NodeSettings
3. **heatmap-calendar** -- Add fontSize, fontColor, fontFamily, fontWeight for month/day labels
4. **progress-bar-stack** -- Add labelFontSize, labelFontFamily, labelFontWeight to BarAppearance

### Batch 2 (HIGH -- prominent text elements missing fontFamily/fontWeight)
5. **animated-donut-pro** -- Add fontFamily, fontWeight to ValueSettings (center value)
6. **animated-donut-pro** -- Add fontFamily, fontWeight to DonutSettings (slice labels)
7. **ring-stack** -- Add fontFamily, fontWeight to CenterContentSettings
8. **animated-waterfall** -- Add fontColor to ValueSettingsCard

### Batch 3 (MEDIUM -- secondary text elements)
9. **bump-chart** -- Add fontColor, fontFamily, fontWeight to BumpRankChangeSettings
10. **dumbbell-chart** -- Add fontFamily, fontWeight to DeltaLabelSettings
11. **scatter-bubble** -- Add fontColor, fontFamily, fontWeight to QuadrantSettings labels
12. **scatter-bubble** -- Add fontColor, fontFamily, fontWeight to TrendlineSettings labels
13. **slope-chart** -- Add fontFamily, fontWeight to LabelsChangeSettings
14. **treemap-pro** -- Add fontFamily, fontWeight to DrillDownSettings breadcrumb

### Batch 4 (MEDIUM -- tooltipService migration)
15. **scatter-bubble** -- Migrate custom tooltip to PBI tooltipService
16. **network-graph** -- Migrate SVG title tooltips to PBI tooltipService
17. **sankey-diagram** -- Migrate SVG title tooltips to PBI tooltipService

---

## Per-Visual Status Matrix

Legend:
- F = Full (fontSize + fontColor + fontFamily + fontWeight on all visible text)
- P = Partial (has fontSize/fontColor but missing fontFamily/fontWeight)
- X = Missing (visible text with no font controls at all)
- S = Shared card handles it adequately
- n/a = not applicable (no such element)

| # | Visual | Local Text | Legend | Tooltip | Axes | Cross-Filter | ColorTheme |
|---|--------|-----------|--------|---------|------|-------------|------------|
| 1 | animated-donut-pro | **P** (center val + labels missing fontFamily/weight) | S | S | n/a | S | S |
| 2 | animated-waterfall | **P** (value labels missing fontColor) | S | S | S | S | S |
| 3 | bar-chart-pro | F | S | S | S | S | S |
| 4 | bar-race | F | S | S | S | S | S |
| 5 | box-plot | S (all via shared cards) | S | S | S | S | S |
| 6 | bullet-chart-pro | S | S | S | S | S | S |
| 7 | bump-chart | **P** (rank change: no fontColor/family/weight) | S | S | S | S | S |
| 8 | chord-diagram | S | S | S | n/a | S | S |
| 9 | dumbbell-chart | **P** (delta labels: no fontFamily/weight) | S | S | S | S | S |
| 10 | funnel-pro | F | S | S | S | S | S |
| 11 | gantt-chart-pro | S | S | S | S | S | S |
| 12 | gauge-cluster | F | S | S | n/a | S | S |
| 13 | health-bar | F | S | S | S | S | S |
| 14 | heatmap-calendar | **X** (month/day labels: no font controls) | partial (own card, no font size/color/family) | S | S | S | S |
| 15 | kpi-card | F | n/a | S | n/a | S | S |
| 16 | morphing-area-chart | S | S | S | S | S | S |
| 17 | network-graph | **X** (node labels: no font controls) | S | **custom SVG title** | n/a | S | S |
| 18 | polar-chart | F | S | S | S | S | S |
| 19 | progress-bar-stack | **X** (bar labels: only labelColor, no size/family/weight) | n/a | S | S | S | S |
| 20 | radar-chart | S | S | S | S | S | S |
| 21 | radial-gauge | F | S | S | n/a | S | S |
| 22 | ring-stack | **P** (center: no fontFamily/weight) | S | S | n/a | S | S |
| 23 | sankey-diagram | F (node labels have full font controls) | S | **custom SVG title** | n/a | S | S |
| 24 | scatter-bubble | **P** (quadrant + trendline labels: partial) | S | **custom HTML tooltip** | S | S | S |
| 25 | slope-chart | **P** (change labels: no fontFamily/weight) | S | S | S | S | S |
| 26 | status-indicator | S | S | S | n/a | S | S |
| 27 | stream-graph | S | S | S | S | S | S |
| 28 | sunburst-chart | F (center content has fontFamily/weight) | S | S | n/a | S | S |
| 29 | timeline-milestone | S | S | S | S | S | S |
| 30 | treemap-pro | **X** (tile labels: zero font controls) | S | S | n/a | S | S |
| 31 | waffle-chart | F | S | S | n/a | S | S |

---

## Totals

- **Fully covered (F or S everywhere)**: 18/31 visuals
- **Partial gaps (P -- has some font props, missing family/weight)**: 7 visuals
- **Major gaps (X -- visible text with no font controls)**: 4 visuals (treemap-pro, network-graph, heatmap-calendar, progress-bar-stack)
- **Custom tooltip (not using PBI tooltipService)**: 3 visuals (network-graph, sankey-diagram, scatter-bubble)

### Total fix items: 17 items across 4 priority batches
