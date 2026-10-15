# Five QoL Passes Audit — All 31 Power BI Custom Visuals
**Date:** 2026-04-08
**Scope:** `packages/*`

This audit is based on the current source, not the older March notes. The baseline is strong now:

- All 31 visuals have `selectionManager` wiring.
- All 31 visuals use `tooltipService`.
- All 31 visuals expose title, number-formatting, date-filter, and accessibility settings.
- The remaining backlog is primarily **quality-of-life breadth**, not broken fundamentals.

To keep the backlog actionable, this audit is split into five focused passes:

1. `P1` Layout & density controls
2. `P2` Ordering & reduction controls
3. `P3` Series, legend, and color-governance controls
4. `P4` Analytical overlays and reading aids
5. `P5` Navigation and discovery controls

## Pass 1 — Layout & Density Controls

### Status
Implemented on 2026-04-08 for the visuals that were still missing `contentPadding`:

- `animated-donut-pro`
- `animated-waterfall`
- `box-plot`
- `bullet-chart-pro`
- `dumbbell-chart`
- `funnel-pro`
- `heatmap-calendar`
- `sunburst-chart`
- `timeline-milestone`
- `treemap-pro`
- `waffle-chart`

### Current gap
The highest-frequency QoL omission is still a missing `contentPadding` control on a subset of visuals.

**Missing `contentPadding`:**
- None remaining from the 2026-04-08 baseline audit.

### Why it matters
This is one of the most report-author-visible polish controls:

- It lets authors tune whitespace without resizing the visual.
- It helps dense labels avoid clipping.
- It reduces the need for hard-coded “just right” layouts.

### Recommended batch
Treat `contentPadding` as a near-standard capability. Unless the visual is intentionally edge-to-edge, it should exist.

**Highest-value `P1` targets:**
- `treemap-pro`
- `sunburst-chart`
- `heatmap-calendar`
- `timeline-milestone`
- `waffle-chart`

## Pass 2 — Ordering & Reduction Controls

### Current gap
Only a minority of visuals expose shared sort controls, and Top N / reduction controls are even rarer.

**Has `SortFormattingCard`:**
- `box-plot`
- `bullet-chart-pro`
- `chord-diagram`
- `dumbbell-chart`
- `health-bar`
- `polar-chart`
- `progress-bar-stack`
- `ring-stack`
- `status-indicator`

**Top N exists in only:**
- `animated-donut-pro`
- `bar-chart-pro`
- `bar-race`
- `bump-chart`

### Where this is missing in ways users will feel
These visuals are category-heavy or ranking-heavy enough that sort / reduction is a practical QoL feature, not just “nice to have”:

- `animated-waterfall`
- `bar-race`
- `bump-chart`
- `funnel-pro`
- `morphing-area-chart`
- `radar-chart`
- `scatter-bubble`
- `slope-chart`
- `stream-graph`
- `timeline-milestone`
- `treemap-pro`
- `waffle-chart`

### Recommended batch

**Add sort first to:**
- `radar-chart`
- `slope-chart`
- `stream-graph`
- `treemap-pro`
- `waffle-chart`
- `timeline-milestone`

**Add Top N / “Others” style reduction next to:**
- `treemap-pro`
- `sunburst-chart`
- `heatmap-calendar`
- `progress-bar-stack`
- `funnel-pro`
- `waffle-chart`

## Pass 3 — Series, Legend, and Color Governance

### Current gap
The repo now has strong shared legend support overall, but per-series/per-category override depth is still uneven.

**Has `SeriesFormattingCard`:**
- `bar-chart-pro`
- `box-plot`
- `bump-chart`
- `dumbbell-chart`
- `morphing-area-chart`
- `polar-chart`
- `radar-chart`
- `scatter-bubble`
- `slope-chart`
- `stream-graph`

That leaves many multi-item visuals relying on global styling only.

### Strong candidates for `SeriesFormattingCard` or equivalent local override groups
- `animated-waterfall`
- `bar-race`
- `bullet-chart-pro`
- `gauge-cluster`
- `network-graph`
- `sankey-diagram`
- `sunburst-chart`
- `timeline-milestone`
- `treemap-pro`
- `waffle-chart`

### Legend surface gaps
Most visuals now use the shared `LegendFormattingCard`, but there are three exceptions:

- `heatmap-calendar`
- `kpi-card`
- `progress-bar-stack`

Nuance:

- `kpi-card` is usually fine without a legend.
- `heatmap-calendar` already has a custom legend, but it misses the shared font/alias/polish surface.
- `progress-bar-stack` is the stronger candidate for a true shared legend when multiple semantics are shown.

### Recommended batch

**Highest-value `P3` targets:**
- `treemap-pro`: per-depth or per-node override groups
- `sunburst-chart`: segment-level override groups
- `network-graph`: node/link override groups
- `sankey-diagram`: node/link override groups
- `progress-bar-stack`: shared legend support
- `heatmap-calendar`: upgrade custom legend formatting

## Pass 4 — Analytical Overlays and Reading Aids

### Current gap
Analytical support is good in the strongest Cartesian visuals, but still inconsistent across comparable charts.

**Has `ReferenceLineFormattingCard`:**
- `animated-waterfall`
- `bar-chart-pro`
- `bar-race`
- `box-plot`
- `bullet-chart-pro`
- `bump-chart`
- `dumbbell-chart`
- `funnel-pro`
- `health-bar`
- `morphing-area-chart`
- `progress-bar-stack`
- `scatter-bubble`
- `slope-chart`
- `stream-graph`

**Has `TrendLineFormattingCard`:**
- `animated-waterfall`
- `bar-chart-pro`
- `bar-race`
- `box-plot`
- `bullet-chart-pro`
- `bump-chart`
- `dumbbell-chart`
- `funnel-pro`
- `health-bar`
- `morphing-area-chart`
- `progress-bar-stack`
- `slope-chart`
- `stream-graph`

**Has `AnnotationFormattingCard`:**
- `animated-waterfall`
- `bar-chart-pro`
- `bar-race`
- `bullet-chart-pro`
- `bump-chart`
- `health-bar`
- `morphing-area-chart`
- `progress-bar-stack`
- `slope-chart`
- `stream-graph`

**Has `CrosshairFormattingCard`:**
- `bar-chart-pro`
- `bump-chart`
- `morphing-area-chart`
- `slope-chart`
- `stream-graph`

### Best QoL opportunities

**Reference/benchmark candidate adds:**
- `radar-chart`
- `polar-chart`
- `radial-gauge`
- `timeline-milestone`

**Trend/overlay candidate adds:**
- `scatter-bubble`
- `radar-chart`
- `polar-chart`

**Annotation candidate adds:**
- `dumbbell-chart`
- `box-plot`
- `scatter-bubble`
- `timeline-milestone`

**Crosshair candidate adds:**
- `scatter-bubble`
- `box-plot`
- `dumbbell-chart`
- `animated-waterfall`

### Recommended batch
The most coherent next analytics batch would be:

- `scatter-bubble`: trendline + annotations + optional crosshair
- `radar-chart`: benchmark/reference overlay
- `polar-chart`: benchmark/reference overlay
- `dumbbell-chart`: annotations and/or crosshair

## Pass 5 — Navigation and Discovery Controls

### Current gap
Discovery features are still concentrated in a few visuals.

**Has drill-down settings:**
- `animated-waterfall`
- `bar-chart-pro`
- `gantt-chart-pro`
- `sunburst-chart`
- `treemap-pro`

**Has zoom controls:**
- `network-graph`
- `scatter-bubble`

**Has search controls:**
- `network-graph`

### Best QoL opportunities

**Zoom / pan candidate visuals:**
- `timeline-milestone`
- `heatmap-calendar`
- `stream-graph`
- `gantt-chart-pro`

**Search / focus candidate visuals:**
- `treemap-pro`
- `sunburst-chart`
- `timeline-milestone`
- `heatmap-calendar`

**Hierarchy-navigation candidate visuals:**
- `waffle-chart` if used as grouped tile navigation
- `sankey-diagram` if node exploration becomes a roadmap area

### Recommended batch

**Highest-value `P5` targets:**
- `timeline-milestone`: zoom/windowing controls
- `heatmap-calendar`: large-range navigation aids
- `treemap-pro`: search/focus within large hierarchies
- `sunburst-chart`: search/focus within large hierarchies

## Chart-by-Chart Next Best QoL Add

This table is intentionally pragmatic: one or two “best next” QoL adds per visual, not a full wish list.

| Visual | Best Next QoL Add |
|--------|--------------------|
| `animated-donut-pro` | `P1` Add `contentPadding`; `P2` add shared sort surface beyond Top N |
| `animated-waterfall` | `P1` Add `contentPadding`; `P3` add per-series override groups |
| `bar-chart-pro` | `P2` Add shared sort surface for broader mode parity |
| `bar-race` | `P2` Add shared sort controls; `P3` add series override groups |
| `box-plot` | `P1` Add `contentPadding`; `P4` add annotations/crosshair |
| `bullet-chart-pro` | `P1` Add `contentPadding`; `P3` add richer series/zone overrides |
| `bump-chart` | `P2` Add shared sort controls |
| `chord-diagram` | `P3` Add richer chord/group override groups |
| `dumbbell-chart` | `P1` Add `contentPadding`; `P4` add annotations/crosshair |
| `funnel-pro` | `P1` Add `contentPadding`; `P2` add shared sort/reduction controls |
| `gantt-chart-pro` | `P5` Add zoom/windowing controls |
| `gauge-cluster` | `P3` Add per-gauge override groups |
| `health-bar` | `P3` Add richer per-bar override groups if multi-measure scenarios expand |
| `heatmap-calendar` | `P1` Add `contentPadding`; `P3` upgrade legend formatting; `P5` add navigation aids |
| `kpi-card` | No high-priority QoL gap surfaced in this pass set |
| `morphing-area-chart` | `P2` Add shared sort controls |
| `network-graph` | `P3` Add richer node/link override groups |
| `polar-chart` | `P4` Add benchmark/reference overlays |
| `progress-bar-stack` | `P3` Add shared legend; `P2` add reduction controls |
| `radar-chart` | `P2` Add shared sort controls; `P4` add benchmark/reference overlays |
| `radial-gauge` | `P4` Add richer benchmark/threshold guidance surface |
| `ring-stack` | `P3` Add per-ring override groups |
| `sankey-diagram` | `P3` Add node/link override groups |
| `scatter-bubble` | `P4` Add trendline/annotations/crosshair bundle |
| `slope-chart` | `P2` Add shared sort controls |
| `status-indicator` | `P2` Add reduction controls for long status lists |
| `stream-graph` | `P2` Add shared sort controls; `P5` add navigation aids |
| `sunburst-chart` | `P1` Add `contentPadding`; `P2` add Top N/focus reduction; `P5` add search |
| `timeline-milestone` | `P1` Add `contentPadding`; `P5` add zoom/windowing |
| `treemap-pro` | `P1` Add `contentPadding`; `P2` add Top N; `P3` add deeper per-node overrides |
| `waffle-chart` | `P1` Add `contentPadding`; `P2` add reduction controls; `P3` add stronger per-group overrides |

## Recommended Implementation Order

If this audit turns into execution work, the cleanest next batches would be:

### Batch A — Universal polish
- Add `contentPadding` to the 11 visuals still missing it

### Batch B — Category control
- Add `SortFormattingCard` to the most comparison-heavy visuals:
  `radar-chart`, `slope-chart`, `stream-graph`, `treemap-pro`, `waffle-chart`, `timeline-milestone`

### Batch C — Dense-data management
- Add Top N / reduction controls to:
  `treemap-pro`, `sunburst-chart`, `heatmap-calendar`, `progress-bar-stack`, `waffle-chart`

### Batch D — Richer override depth
- Add `SeriesFormattingCard` or equivalent local override groups to:
  `treemap-pro`, `sunburst-chart`, `network-graph`, `sankey-diagram`, `gauge-cluster`

### Batch E — Reading aids
- Add analytical overlays to:
  `scatter-bubble`, `radar-chart`, `polar-chart`, `dumbbell-chart`

## Bottom Line

The repo no longer has a “missing basics everywhere” problem. The next gains are about **authoring flexibility**:

- more spacing control
- more ordering/reduction control
- more per-series override depth
- more reference/trend/annotation aids
- better navigation for dense visuals

That is a good place to be: the backlog has shifted from foundational fixes to real product polish.
