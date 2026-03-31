# Deep Audit — Consolidated Findings (Pass 1)
**Date:** 2026-03-18

## Critical Bugs

### health-bar: Capabilities.json card name mismatch (SETTINGS WON'T PERSIST)
After the settings reorg, card names changed but capabilities.json still uses old names:
- `healthBarSettings` (caps) → `barShapeSettings` (settings.ts)
- `healthBarScale` (caps) → `scaleRangeSettings` (settings.ts)
- `healthBarValuePosition` (caps) → `valueLabelsSettings` (settings.ts)

### bar-chart-pro: Dead CrosshairFormattingCard (5 props)
Imported and registered but never referenced in visual.ts. Has its own custom crosshair implementation instead.

## Systemic Dead Settings (across ALL visuals that import these shared cards)

### 1. `legendFontWeight` — dead in ALL visuals
Visuals affected: animated-donut-pro, box-plot, bump-chart, chord-diagram, dumbbell-chart, funnel-pro, gantt-chart-pro, morphing-area-chart, polar-chart, radar-chart, ring-stack, scatter-bubble, slope-chart
**Root cause:** `renderLegend()` in core accepts `fontWeight` param, but NO visual passes it.

### 2. `dataLabelPosition` — dead/meaningless in most visuals
Visuals affected: polar-chart, progress-bar-stack, radar-chart, ring-stack, sankey-diagram, sunburst-chart, treemap-pro, timeline-milestone, waffle-chart
**Root cause:** Each visual hardcodes label positions based on chart geometry. The dropdown (auto/above/below/inside) is meaningless for radial/tile/node charts.

### 3. `axisLabelFontWeight` — dead everywhere
Visuals affected: ALL that import AxisFormattingCard
**Root cause:** Never read in any visual.ts.

### 4. `referenceLineAxis` / `trendLineAxis` — dead in non-dual-axis visuals
Visuals affected: ALL except bar-chart-pro combo mode
**Root cause:** Only relevant for combo charts with secondary Y axis.

### 5. `referenceBandWidth` — dead AND missing from capabilities.json
Visuals affected: animated-waterfall, bar-race, box-plot, bullet-chart-pro, bump-chart, dumbbell-chart, funnel-pro, morphing-area-chart, health-bar, progress-bar-stack

## Entirely Dead Cards (100% of properties unused)

| Visual | Dead Card | Properties |
|--------|-----------|-----------|
| bump-chart | NumberFormattingCard | 4 |
| gantt-chart-pro | NumberFormattingCard | 4 |
| network-graph | NumberFormattingCard | 4 |
| stream-graph | NumberFormattingCard | 4 |
| timeline-milestone | NumberFormattingCard | 4 |
| waffle-chart | NumberFormattingCard | 4 |
| status-indicator | LegendFormattingCard | 6 |
| slope-chart | LegendFormattingCard | 6 |
| bar-chart-pro | CrosshairFormattingCard | 5 |

**Total: 41 completely dead properties across 9 visuals**

## AxisFormattingCard Bloat (worst offenders)

| Visual | Used | Hidden/Dead | Waste % |
|--------|------|------------|---------|
| heatmap-calendar | 2 of 18 | 16 | 89% |
| bullet-chart-pro | 2 of 18 | 16 | 89% |
| bar-race | 2 of 18 | 16 | 89% |
| health-bar | 3 of 18 | 15 | 83% |
| polar-chart | 3 of 18 | 12 | 80% |
| radar-chart | 4 of 18 | 11 | 73% |
| morphing-area-chart | 6 of 18 | 12 | 67% |
| bump-chart | 7 of 18 | 11 | 61% |

## Condense Opportunities

### Cards with 1-2 settings that should merge
- stream-graph: ColorsAndThemeSettings (1 prop) → merge into StreamSettings
- sunburst-chart: ColorsAndThemeSettings (1 prop) → merge into SegmentAppearance
- status-indicator: LayoutSettings (1 prop) → merge into IndicatorAppearance
- kpi-card: KpiLayoutSettings (1 prop, after sparklineType moved) → merge into CardSettings
- radial-gauge: ValueRangeSettings (2 props) → merge into ArcSettings

### Redundant/overlapping settings
- animated-donut-pro: valueSettings vs numberFormattingCard (both format numbers)
- radar-chart: fillOpacity vs areaOpacity (both control polygon opacity)
- sankey-diagram: colorMode "gradient" vs gradientLinks toggle (overlap)
- status-indicator: ConditionalFormattingCard vs ThresholdsColorsSettings (both do threshold colors)
- radial-gauge: zoneSettings vs conditionalFormattingCard (both do color-by-value)
- scatter-bubble: local trendlineSettings AND shared TrendLineFormattingCard (duplicate cards)

### Visible-but-dead settings confusing users
- bar-race: 10 axis properties visible but never read
- bump-chart: 5 grid properties visible but no grids rendered
