# Improvement Report: Morphing Area Chart

**Date:** 2026-03-24
**Target:** `packages/morphing-area-chart/`
**Version:** 1.0.0 (per `package.json`)
**Stack:** D3.js v7.9, Power BI Visuals API v5.3, TypeScript, LESS

---

## 1. Current Capability Inventory

### 1.1 Data Model
- **Data Roles:** Category (Grouping, max 1) + Measure (up to 10 series)
- **Data Reduction:** Top 500 categories (`capabilities.json:38`)
- **Null Handling:** Skip / Connect Adjacent / Interpolate (`settings.ts:313-327`)
- **Date Filtering:** Start/end date range filter with "end at current date" option
- **Cross-highlighting:** `supportsHighlight: true` + `supportsMultiVisualSelection: true`

### 1.2 Visual Features
| Feature | Status | File:Line |
|---------|--------|-----------|
| Line rendering (monotoneX, linear, step curves) | Done | `visual.ts:692-726` |
| Area fill with gradient (3-stop linear gradient) | Done | `visual.ts:629-690` |
| Stacked area (normal, stacked, 100% stacked) | Done | `visual.ts:426-454` |
| Threshold zone coloring (above/below with clip paths) | Done | `visual.ts:876-945` |
| Data point dots with hover enlargement | Done | `visual.ts:729-780` |
| Dot pop-in animation + line draw animation | Done | `visual.ts:716-723, 770-778` |
| Area fade-in animation | Done | `visual.ts:674-689` |
| Brush/zoom context mini-chart (d3.brushX) | Done | `visual.ts:1078-1219` |
| Crosshair/trackball (shared core) | Done | `visual.ts:970-999` |
| Forecast/projection (linear regression + confidence band) | Done | `visual.ts:801-874` |
| Reference line (custom/mean/median/min/max/percentile + band) | Done | `visual.ts:1341-1383` |
| Trend line (linear/polynomial/exponential/logarithmic/power + R^2) | Done | `visual.ts:1470-1507` |
| Annotations (3 configurable callouts) | Done | `visual.ts:1509-1570` |
| Conditional formatting (3-color threshold-based) | Done | `visual.ts:1424-1443` |
| Series hover highlight/dim (non-hovered to 20% opacity) | Done | `visual.ts:1021-1047` |
| Cross-highlight dimming | Done | `visual.ts:1001-1019` |
| Per-series formatting (color, opacity, line style, line width, labels) | Done | `visual.ts:203-215` |
| Data labels with number formatting (Auto/K/M/B/%, decimals, prefix/suffix) | Done | `visual.ts:782-798` |
| Legend (top/bottom/left/right, font customization) | Done | `visual.ts:1385-1422` |
| Scroll support (horizontal, min category width) | Done | `visual.ts:392-401` |
| Card style (glass/elevated/neumorphic/none) | Done | `visual.ts:291-308` |
| Chart title + subtitle | Done | `visual.ts:328` |
| Axis titles (X and Y) | Done | `visual.ts:513-538` |
| Keyboard navigation + ARIA labels | Done | `visual.ts:1445-1468` |
| Color themes (7 themes: default, ocean, sunset, forest, berry, monochrome, earth) | Done | `settings.ts:362` |
| Tooltips (category + series name + formatted value) | Done | `visual.ts:1587-1624` |
| Selection + cross-filtering (click dot) | Done | `visual.ts:755-768` |
| Context menu (right-click) | Done | `visual.ts:761-768` |

### 1.3 Formatting Cards (24 total)
Line & Points, Area Fill, Axes, Card Style, Animation, Interaction, Forecast/Projection, Data Handling, Axis Formatting, Legend, Data Labels, Chart Title, Line Stroke, Scroll, Number Format, Reference Line, Trend Line, Conditional Formatting, Crosshair, Annotations, Accessibility, Series Formatting, Color Theme, Date Filter.

### 1.4 What's Missing (vs. Roadmap)
The FEATURE-ROADMAP.md listed 10 missing features for Morphing Area Chart. Current status:

| Roadmap Item | Status |
|---|---|
| Stacked / 100% Stacked Area | DONE |
| Range Area / Confidence Band | **MISSING** |
| Reference Lines | DONE |
| Reference Areas | DONE (band on reference line) |
| Threshold / Zone Coloring | DONE |
| Crosshair / Trackball | DONE |
| Brush / Range Selection | DONE |
| Null Handling Options | DONE |
| Series Highlight on Hover | DONE |
| Number Format / Display Units | DONE |

Only **Range Area / Confidence Band** remains unaddressed.

---

## 2. Research Findings

### 2.1 Competitor Analysis

**Native Power BI Area Chart:**
- Basic area, stacked area, 100% stacked area
- No gradient fills, no animation, no threshold zones
- No brush/zoom, no crosshair, limited formatting
- The morphing area chart already significantly exceeds native capabilities

**Highcharts Area Charts:**
- `arearange` / `areasplinerange` — dedicated range area series type with high/low values (critical gap in this visual)
- Zones — color changes at Y-value thresholds (already implemented here)
- Pattern fills — SVG patterns for print/grayscale accessibility
- Plot bands — shaded horizontal/vertical regions
- Boost module — canvas-based rendering for 100K+ data points
- Drilldown — click to navigate into sub-data

**Apache ECharts:**
- `markArea` — shaded rectangular regions on chart (e.g., highlight a date range)
- `markLine` — reference lines at specific values
- `dataZoom` — both inside (scroll/pinch) and slider zoom controls
- Rich tooltip formatting with custom HTML templates
- Large dataset mode with progressive rendering

**Recharts / Nivo / Tremor:**
- Recharts: brush component, reference areas/lines, gradient area, stacked area, custom tooltips
- Nivo: SVG/Canvas/HTML rendering, theming, responsive containers
- Tremor: high-level API, accessibility-first, keyboard navigation built-in

**Deneb (Vega-Lite in Power BI):**
- Fully declarative, infinite flexibility but steep learning curve
- Supports layered views, faceting, selections
- No pre-built interactions — everything must be authored in JSON

### 2.2 D3.js Advanced Techniques Available

- **d3.area with y0/y1** — already used for stacked; can also render range/band areas
- **d3.stack with diverging offsets** — `d3.stackOffsetWiggle` for stream graph layout
- **Custom interpolators / tweens** — shape morphing between data states
- **d3.zoom** — pinch/scroll zoom with automatic transform management
- **Pattern fills** — SVG `<pattern>` defs for texture encoding (accessibility)
- **Voronoi overlay** — efficient nearest-point hover detection for dense data

### 2.3 UX Best Practices

- **Tooltip enrichment:** Show all series values at the hovered X position (trackball-style), not just the hovered dot. Essential for multi-series comparison.
- **Color-blind safe defaults:** Use patterns/textures as secondary encoding alongside color. WCAG 2.1 requires 3:1 contrast for non-text elements.
- **Progressive disclosure:** Don't overwhelm users — show summary first, details on hover/click.
- **Responsive sizing:** Charts must remain readable at small viewport sizes. Auto-hide axis labels, reduce dot sizes, simplify ticks.
- **Keyboard accessibility:** WCAG 2.1.1 — all interactive functionality must be keyboard-operable. Currently partially implemented via `attachKeyboardNav`.

### 2.4 Construction Industry Context

For estimators, engineers, architects, and contractors:
- **Budget vs. Actual tracking** — range area showing budget band with actual line overlay
- **Cash flow projections** — forecast with confidence bands (partially done)
- **Schedule S-curves** — cumulative progress curves (planned vs. actual)
- **Material cost trends** — threshold zones for price alert levels (done)
- **Weather/seasonal overlays** — vertical reference bands marking seasons or weather events (needs vertical reference bands)

---

## 3. Improvement Recommendations (Ranked by ROI)

### R1: Range Area / Confidence Band (HIGH Impact, MEDIUM Effort)

**What:** Add a dedicated "Range Area" mode where users bind two measures — a high value and a low value — to render a shaded band between them, with an optional center line.

**Why:** This is the #1 remaining gap from the roadmap. Highcharts' `arearange` is one of their most-used series types. For construction: budget range bands, schedule tolerance bands, and confidence intervals on cost projections are table-stakes visualizations.

**Evidence:** Highcharts `areasplinerange` docs; Power BI community requests for confidence interval visualizations; ECharts band area support.

**Implementation:**
1. Add two new data roles in `capabilities.json`: `measureHigh` (optional Measure) and `measureLow` (optional Measure)
2. In `extractData()` (`visual.ts:219`), extract high/low values alongside primary measure
3. When both high/low are bound, render `d3.area().y0(low).y1(high)` as a semi-transparent band behind the primary line
4. Add "Range Band" toggle + opacity + color settings in `AreaFillCard` (`settings.ts:78`)
5. Ensure stacking mode is disabled when range mode is active (mutually exclusive)

**ROI Score: 9/10** — High differentiation, fills the last roadmap gap, directly serves construction use cases.

---

### R2: Vertical Reference Bands / Date Range Highlighting (HIGH Impact, LOW Effort)

**What:** Allow users to shade vertical regions on the chart (e.g., highlight Q4, mark a project phase, flag a date range) similar to ECharts `markArea` and Highcharts `plotBands`.

**Why:** The current reference line is horizontal only. Construction professionals need to highlight project phases, weather delays, or bid windows as vertical bands. This is a top-requested feature in BI dashboards.

**Evidence:** ECharts `markArea` feature; Highcharts plot bands; Recharts `ReferenceArea` component.

**Implementation:**
1. Add a new "Reference Band" formatting card with: start category, end category, band color, band opacity, label text
2. Support 2-3 configurable bands (similar to annotation slots pattern in `annotationFormattingCard`)
3. Render as a `<rect>` in the chart group between the x-positions of start/end categories
4. Place behind data series but above grid lines

**ROI Score: 8/10** — Low effort (follows existing annotation pattern), high storytelling value.

---

### R3: Stream Graph Layout Mode (MEDIUM Impact, LOW Effort)

**What:** Add a "Stream" option to the Stack Mode dropdown, which uses D3's `d3.stackOffsetWiggle` + `d3.stackOrderInsideOut` to create a streamgraph layout.

**Why:** Stream graphs are visually striking and increasingly popular for showing composition over time. This is a one-line change to the stacking computation — D3 handles the math.

**Evidence:** D3 Graph Gallery streamgraph examples; Observable D3 streamgraph implementations; used by NYT and other data journalism outlets.

**Implementation:**
1. Add `{ value: 'stream', displayName: 'Stream Graph' }` to the `mode` dropdown in `AreaFillCard` (`settings.ts:97-106`)
2. Add the same enum entry in `capabilities.json` under `areaFillSettings.mode`
3. In the stacking computation (`visual.ts:433-454`), when mode is `'stream'`, use `d3.stack().offset(d3.stackOffsetWiggle).order(d3.stackOrderInsideOut)` instead of the manual loop
4. Hide the Y-axis when stream mode is active (stream graphs have no meaningful Y origin)

**ROI Score: 8/10** — Minimal code change, visually impressive, strong differentiation vs. native PBI.

---

### R4: Pattern / Texture Fill for Accessibility (MEDIUM Impact, MEDIUM Effort)

**What:** Add an option to apply SVG pattern fills (hatching, dots, crosshatch, diagonal lines) to area fills, either alongside or instead of color fills.

**Why:** WCAG 2.1 requires non-color-only encoding. Construction reports are frequently printed in grayscale. Pattern fills make series distinguishable without color. Highcharts has a dedicated `pattern-fill` module for this.

**Evidence:** Highcharts pattern-fill module; WCAG 1.4.1 Use of Color (Level A); Smashing Magazine accessibility article on chart design.

**Implementation:**
1. Add a `patternFill` dropdown to per-series formatting: None, Diagonal, Dots, Crosshatch, Horizontal Lines
2. Define SVG `<pattern>` elements in `<defs>` per series (similar to existing gradient defs)
3. When pattern is enabled, use `fill: url(#pattern-id)` instead of solid/gradient fill
4. Keep the line color as-is for additional differentiation

**ROI Score: 7/10** — Important for accessibility compliance and print use cases.

---

### R5: Tooltip Enrichment — All-Series Trackball (MEDIUM Impact, LOW Effort)

**What:** Enhance the crosshair tooltip to show all series values at the hovered X position in a single tooltip card, not just the individual dot's value.

**Why:** The current tooltip only shows one series at a time (on dot hover). The crosshair shows values if `showCrosshairValues` is enabled, but this uses simple text labels near the line. A unified tooltip card (like Highcharts' shared tooltip or Recharts' custom tooltip) is the standard for multi-series area charts.

**Evidence:** Highcharts `tooltip.shared: true`; ECharts tooltip trigger: 'axis'; Recharts shared tooltip; every major BI tool does this.

**Implementation:**
1. In the crosshair handler (`visual.ts:970-999`), when the crosshair snaps to a category, build a composite tooltip with all series values
2. Use the Power BI `host.tooltipService.show()` API with multiple `VisualTooltipDataItem` entries (one per series at that category)
3. Add a "Shared Tooltip" toggle to the Crosshair formatting card
4. Include series color swatches in tooltip data items

**ROI Score: 7/10** — Low effort, significantly improves multi-series comparison UX.

---

### R6: Data Point Count Increase (500 to 30,000) (HIGH Impact, LOW Effort)

**What:** Increase the `dataReductionAlgorithm.top.count` from 500 to 30,000 in `capabilities.json:38`.

**Why:** 500 data points is extremely limiting for time-series data. A daily series over 2 years exceeds this. Construction projects span years with daily cost/progress data. Power BI supports up to 30,000 rows for categorical data views.

**Evidence:** Power BI documentation on data reduction algorithms; native area chart supports 30,000 points; user complaints about data truncation in custom visuals.

**Implementation:**
1. Change `capabilities.json:39` from `"count": 500` to `"count": 30000`
2. Add performance guard in `render()`: if categories > 2000, auto-disable dot rendering and reduce animation to prevent performance issues
3. Consider adding a "High Density" mode that renders area + line only (no dots) for large datasets

**ROI Score: 9/10** — Trivial change, removes a critical limitation.

---

### R7: Responsive Label Management (MEDIUM Impact, MEDIUM Effort)

**What:** Auto-detect X-axis label collisions and apply progressive strategies: rotate 45 degrees, then rotate 90 degrees, then show every Nth label, then hide labels entirely.

**Why:** The current approach hard-codes rotation at 12+ categories (`visual.ts:493-499`). With 500+ categories and brush zoom, labels can still overlap or become illegible. Responsive label management is standard in Tableau and ECharts.

**Evidence:** ECharts automatic label collision avoidance; Highcharts `xAxis.labels.autoRotation`; AG Charts smart label positioning.

**Implementation:**
1. After rendering X-axis labels, measure the actual rendered widths using `getBBox()`
2. If any labels overlap, try 45-degree rotation
3. If still overlapping, try 90-degree rotation
4. If still overlapping, show every 2nd/3rd/Nth label
5. Apply this logic both in initial render and in brush update

**ROI Score: 6/10** — Medium effort, prevents visual ugliness with many categories.

---

### R8: Export / Screenshot Support (MEDIUM Impact, LOW Effort)

**What:** Register the `supportsExportToImage` capability in `capabilities.json` so Power BI's built-in "Export data" and "Copy as image" features work correctly with the visual.

**Why:** Construction reports are frequently exported to PDF or PowerPoint. Power BI supports visual-level export, but custom visuals must opt in.

**Evidence:** Power BI Visuals API documentation on `supportsExportToImage`.

**Implementation:**
1. Add `"supportsExportToImage": true` to `capabilities.json` (one line)
2. Verify that the SVG renders correctly without animation state issues when captured

**ROI Score: 7/10** — Near-zero effort, enables a workflow construction users depend on.

---

### R9: Small Multiples / Trellis Layout (HIGH Impact, HIGH Effort)

**What:** When a "Small Multiple" grouping field is bound, render a grid of mini area charts — one per group value — sharing axes for comparison.

**Why:** Small multiples are one of the most powerful comparison techniques in data visualization. They solve the readability problem of 5+ overlapping series. Power BI's native small multiples support is limited to basic charts.

**Evidence:** Tier 3 feature in FEATURE-ROADMAP.md; Tableau's small multiples; Edward Tufte's visualization principles.

**Implementation:**
1. Add a new data role `smallMultiple` (Grouping) in `capabilities.json`
2. Partition data into groups by the small multiple field
3. Compute a shared Y-axis domain across all groups
4. Render a responsive grid of mini SVGs, each using the existing render pipeline
5. Add formatting options: columns count, show shared axes, individual vs. shared Y scale

**ROI Score: 6/10** — High impact but very high effort. Best as a v2 feature.

---

### R10: Sparkline / Mini Chart Mode (LOW Impact, LOW Effort)

**What:** When the visual is resized below a threshold (e.g., 200x100px), switch to a minimal "sparkline" rendering: area + line only, no axes, no dots, no labels.

**Why:** Area charts are commonly embedded in KPI cards or small dashboard tiles. At tiny sizes, axes and labels add noise. A clean sparkline mode makes the visual usable in more contexts.

**Evidence:** KPI Card sparklines in other Power BI visuals; Tremor's SparkAreaChart component; common dashboard pattern.

**Implementation:**
1. At the top of `render()`, check if `viewport.width < 200 || viewport.height < 100`
2. If true, skip axes, dots, labels, legend rendering — just draw the area + line with full gradient
3. Reduce margins to near-zero

**ROI Score: 5/10** — Nice polish, low effort, improves versatility.

---

## 4. Priority Matrix

| Priority | Recommendation | Impact | Effort | ROI |
|----------|---------------|--------|--------|-----|
| **P0** | R6: Data Point Count (500 -> 30K) | High | Trivial | 9/10 |
| **P0** | R1: Range Area / Confidence Band | High | Medium | 9/10 |
| **P1** | R3: Stream Graph Layout | Medium | Low | 8/10 |
| **P1** | R2: Vertical Reference Bands | High | Low | 8/10 |
| **P1** | R8: Export to Image | Medium | Trivial | 7/10 |
| **P2** | R5: Tooltip Enrichment | Medium | Low | 7/10 |
| **P2** | R4: Pattern / Texture Fill | Medium | Medium | 7/10 |
| **P3** | R7: Responsive Label Management | Medium | Medium | 6/10 |
| **P3** | R9: Small Multiples | High | High | 6/10 |
| **P3** | R10: Sparkline Mode | Low | Low | 5/10 |

---

## 5. Existing Bugs / Code Quality Issues

### 5.1 X-Axis Label text-anchor
`style/visual.less:34` sets `.area-axis-x .tick text { text-anchor: end; }` which is correct for rotated labels but wrong for non-rotated labels (fewer than 12 categories). This shifts non-rotated labels to the left of their tick position. Should be `text-anchor: middle` by default, with `end` applied only when rotation is active.

### 5.2 Band Calculation Uses Fixed 10% of Reference Value
`visual.ts:1380` computes `bandUpperValue: refValue * 1.1` — this means the band is always 10% above the reference value with no lower bound. The band should use a configurable width (e.g., +/- N% or +/- absolute value) and should also have a `bandLowerValue`.

### 5.3 Brush Update Drops Gradient Fills
`updateMainChartPaths()` (`visual.ts:1225-1339`) uses `withOpacity(sf.color, fillOpacity)` for area fills during brush updates but does not recreate gradient defs. After brushing, gradient fills revert to flat colors.

### 5.4 Forecast Extends Beyond SVG Viewport
Forecast points (`visual.ts:835-841`) can extend beyond `chartWidth`, but the SVG has no clip path — forecast lines may render outside the chart area and overlap with the legend or card edges.

### 5.5 Accessibility Selector Mismatch
`visual.ts:1464` uses selector `.area-path` but the actual class used on line paths is `.area-line`. This means keyboard navigation may miss the line elements.

---

## 6. Quick Wins (< 1 hour each)

1. **Fix data point limit** — Change `capabilities.json:39` `count: 500` to `count: 30000`
2. **Fix x-axis text-anchor** — Change `visual.less:34` from `text-anchor: end` to `text-anchor: middle`
3. **Fix accessibility selector** — Change `.area-path` to `.area-line` in `visual.ts:1464`
4. **Add export support** — Add `"supportsExportToImage": true` to `capabilities.json`
5. **Add stream graph option** — Add `stream` to stack mode dropdown (capabilities.json + settings.ts + visual.ts stacking logic)

---

## 7. Research Sources

### Competitor Analysis
- [Highcharts Area Chart Docs](https://www.highcharts.com/docs/chart-and-series-types/area-chart)
- [Highcharts Area Spline Range](https://www.highcharts.com/demo/stock/areasplinerange)
- [Apache ECharts Area Chart Handbook](https://echarts.apache.org/handbook/en/how-to/chart-types/line/area-line/)
- [Apache ECharts Features Overview](https://echarts.apache.org/en/feature.html)
- [Deneb: Declarative Visualization in Power BI](https://deneb-viz.github.io/)
- [Tremor Area Chart](https://www.tremor.so/docs/visualizations/area-chart)
- [Nivo vs Recharts Comparison](https://www.speakeasy.com/blog/nivo-vs-recharts)
- [Power BI Area Chart Docs](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-basic-area-chart)

### D3.js Techniques
- [D3 Graph Gallery - Area Charts](https://d3-graph-gallery.com/area.html)
- [D3 Graph Gallery - Stacked Area](https://d3-graph-gallery.com/stackedarea.html)
- [D3 Area Shape API](https://d3js.org/d3-shape/area)
- [D3 Transition API](https://d3js.org/d3-transition)
- [D3 Area Chart with Gradient (GitHub Gist)](https://gist.github.com/d3noob/49570a3cd70390c257c80ac75c5049f1)

### UX Best Practices
- [Accessibility Standards for Chart Design - Smashing Magazine](https://www.smashingmagazine.com/2024/02/accessibility-standards-empower-better-chart-visual-design/)
- [10 Guidelines for DataViz Accessibility - Highcharts](https://www.highcharts.com/blog/tutorials/10-guidelines-for-dataviz-accessibility/)
- [Accessible Charts Checklist - A11Y Collective](https://www.a11y-collective.com/blog/accessible-charts/)
- [Dashboard UX Patterns - Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-data-dashboards)
- [NNGroup - Choosing Chart Types](https://www.nngroup.com/articles/choosing-chart-types/)
- [Dashboard Design Best Practices - DataCamp](https://www.datacamp.com/tutorial/dashboard-design-tutorial)
