# Feature Improvement Report: KPI Card Pro & Bar Chart Pro
**Date:** 2026-03-18
**Scope:** packages/kpi-card, packages/bar-chart-pro
**Competitors analyzed:** Zebra BI Cards, Zebra BI Charts, Inforiver Analytics+, Deneb (Vega-Lite), Power KPI (Microsoft), MAQ Software KPI Grid, xViz Advanced Bar Chart

## Executive Summary
22 findings: 8 gaps, 9 refinements, 5 UX improvements
Top recommendation: Add Voronoi-based crosshair tooltip for bar chart combo mode line overlays

---

## KPI Card Pro Findings

### 1. [GAP] Sparkline Tooltip on Hover
**Impact:** High | **Effort:** Medium | **ROI: ★★★★☆**

**What:** No tooltip appears when hovering over the sparkline — users can't see individual trend values.
**Why:** Zebra BI Cards, Inforiver, and Power KPI all show tooltips on sparkline hover with the exact value at that data point. Users with trend data need to see point-level detail without a separate table visual.
**Competitors:** Zebra BI Cards shows value + date on sparkline hover. Inforiver shows value + category.

**Implementation spec:**
- **Files:** `packages/kpi-card/src/visual.ts` (renderSparkline method, lines 482-604)
- **Approach:** Add invisible hover circles at each data point with `r=8`, `opacity=0`, `pointer-events=all`. Attach `mouseover` handlers that call `host.tooltipService.show()` with the trend value and index.
- **Key details:** Use D3 Voronoi (`d3.Delaunay.from()`) for efficient nearest-point detection across the sparkline, or simpler: append transparent circles at each `x(i)` position.
- **Watch out for:** Bar sparkline type needs different hit areas (rects not circles). Multi-KPI grid needs unique tooltip per slot.

### 2. [GAP] Min/Max Markers on Sparkline
**Impact:** Medium | **Effort:** Small | **ROI: ★★★★☆**

**What:** No visual indication of the minimum and maximum values along the sparkline trend.
**Why:** Zebra BI and Power KPI highlight min/max points with colored dots. This gives instant context — users see the range without reading numbers. Especially valuable for construction KPIs where outlier weeks matter.
**Competitors:** Zebra BI shows min (red dot) and max (green dot). Power KPI shows just the max point.

**Implementation spec:**
- **Files:** `packages/kpi-card/src/visual.ts` (renderSparkline, ~line 582), `packages/kpi-card/src/settings.ts` (SparklineSettings)
- **Approach:** After the end dot, find `d3.min/max` indices and append additional circles with distinct colors. Add a toggle `showMinMax` to SparklineSettings.
- **Key details:** Use `d3.minIndex(trend)` and `d3.maxIndex(trend)`. Min dot = red (#F87171), max dot = green (#34D399). Same radius as end dot (3).
- **Watch out for:** If min or max IS the last point, don't double-render. If min === max (flat line), skip.

### 3. [REFINEMENT] Responsive Sparkline Height
**Impact:** Medium | **Effort:** Small | **ROI: ★★★★☆**

**What:** Sparkline height is fixed at 32px (CSS `.kpi-sparkline { height: 32px }`), which looks too small in large cards and wastes space.
**Why:** Inforiver and Zebra BI scale sparkline height proportionally to the card size. A 400px-tall card with a tiny 32px sparkline looks unbalanced.
**Competitors:** Zebra BI Cards allocate ~30-40% of card height to sparkline. Inforiver uses flex-grow.

**Implementation spec:**
- **Files:** `packages/kpi-card/style/visual.less` (line 46), `packages/kpi-card/src/visual.ts` (renderSparkline)
- **Approach:** Change `.kpi-sparkline` from `height: 32px` to `flex: 1; min-height: 24px; max-height: 100px;`. The wrapper already uses `display: flex; flex-direction: column;` so the sparkline will grow to fill remaining space.
- **Key details:** Update viewBox height dynamically: read `sparkDiv.clientHeight` after DOM insertion, then set `viewBox: '0 0 200 ${actualHeight}'`. Adjust yScale range accordingly.
- **Watch out for:** Multi-KPI grid cells have less height — the flex approach handles this naturally. Area sparkline's `y0` must use actual height, not hardcoded 32.

### 4. [REFINEMENT] Period-over-Period Comparison Value
**Impact:** High | **Effort:** Medium | **ROI: ★★★☆☆**

**What:** Comparison text only shows "vs target" but doesn't support period-over-period (e.g., "vs last week", "vs same period last year").
**Why:** Zebra BI Cards and Inforiver both support previous period comparison natively. In construction, weekly/monthly comparisons are more common than target comparisons. Users currently need a separate DAX measure to get this.
**Competitors:** Zebra BI shows both absolute and % change vs previous period. Inforiver supports configurable comparison periods.

**Implementation spec:**
- **Files:** `packages/kpi-card/src/visual.ts` (renderComparison, lines 701-725), `packages/kpi-card/src/settings.ts` (KpiComparisonSettings)
- **Approach:** Add a `compareMode` dropdown to KpiComparisonSettings: "vs Target" (current), "vs Previous" (trend[n-1] vs trend[n-2]), "vs First" (latest vs first trend value). In renderComparison, compute delta based on selected mode using the trend array.
- **Key details:** "vs Previous" uses `trend[trend.length-1] - trend[trend.length-2]`. "vs First" uses `trend[trend.length-1] - trend[0]`. Both show absolute and % change.
- **Watch out for:** Trend array might have <2 values — guard against that. If comparing vs target AND period, consider showing both.

### 5. [UX] Conditional Color on Progress Bar
**Impact:** Medium | **Effort:** Small | **ROI: ★★★★☆**

**What:** The progress bar uses a single color for "met" and "unmet" but doesn't show gradient progress (e.g., yellow at 50%, green at 100%).
**Why:** Inforiver and dashboard best practices use multi-stop color gradients on progress bars (red → yellow → green) for instant visual scanning. A binary color is less informative.
**Competitors:** Inforiver uses red/yellow/green gradient. Zebra BI uses conditional formatting rules on bars.

**Implementation spec:**
- **Files:** `packages/kpi-card/src/visual.ts` (renderGoalProgressBar, lines 664-697), `packages/kpi-card/src/settings.ts` (KpiGoalSettings)
- **Approach:** Add a `gradientProgress` toggle. When enabled, compute color by interpolating between unmetColor → a midColor (yellow/amber) → metColor based on progress %. Use `d3.interpolateRgb`.
- **Key details:** `d3.scaleLinear().domain([0, 50, 100]).range([unmetColor, '#F59E0B', metColor])` gives a smooth transition. Apply to `barFill.style.background` as a CSS linear-gradient for smooth visual.
- **Watch out for:** Progress > 100% should stay green, not extrapolate.

### 6. [UX] Click-to-Filter on KPI Card
**Impact:** High | **Effort:** Medium | **ROI: ★★★☆☆**

**What:** Clicking the KPI card clears selection (`selectionManager.clear()`) but doesn't support click-to-filter for cross-filtering other visuals on the report page.
**Why:** All major competitor KPI cards support cross-filtering. This is table stakes for Power BI interactivity — users expect clicking a KPI to filter the entire dashboard to that metric's context.
**Competitors:** Zebra BI Cards, Inforiver, and Power KPI all support cross-filtering on click.

**Implementation spec:**
- **Files:** `packages/kpi-card/src/visual.ts` (handleBackgroundClick, renderSingleKpi)
- **Approach:** Build selection IDs during `extractData` using `host.createSelectionIdBuilder().withMeasure(measureCol.source)`. On KPI click, call `selectionManager.select(selectionId)` instead of `selectionManager.clear()`. Toggle selection on repeat click.
- **Key details:** For multi-KPI grid, each slot needs its own selectionId. Use the measure column's queryName as the selection basis.
- **Watch out for:** The background click handler should still clear on empty-space clicks. Need to distinguish KPI click vs background click (stopPropagation on KPI wrapper).

---

## Bar Chart Pro Findings

### 7. [GAP] Crosshair / Hover Line for Combo Mode
**Impact:** Critical | **Effort:** Medium | **ROI: ★★★★★**

**What:** No vertical crosshair line appears when hovering the chart — users must hover directly on individual bars or dots to see values. In combo mode with line overlays, it's hard to correlate bar and line values at the same category.
**Why:** Every major charting library (Zebra BI, Inforiver, native Power BI) shows a crosshair with all series values when hovering anywhere on the chart. This is the #1 expected interaction pattern for combo charts.
**Competitors:** Zebra BI Charts, Inforiver, and native Power BI all show a vertical hover line with a multi-series tooltip. This is true table stakes.

**Implementation spec:**
- **Files:** `packages/bar-chart-pro/src/visual.ts` (renderCombo method + new crosshair helper), `packages/core/src/crosshair.ts` (already exists but unused by bar chart)
- **Approach:** Append a transparent overlay rect covering the chart area. On `mousemove`, find the nearest category using `d3.scaleBand.invert` equivalent (bisect the band domain). Draw a vertical line at that category's x center. Show a multi-series tooltip with all bar + line values for that category.
- **Key details:** Use D3 Voronoi/Delaunay for line series nearest-point detection. For band scales, compute nearest category as `Math.round((mouseX / width) * (categories.length - 1))`. Render the crosshair line with `pointer-events: none`.
- **Watch out for:** Must work in all 6 chart modes. Horizontal mode needs a horizontal crosshair. Performance: use `requestAnimationFrame` to throttle redraws.

### 8. [GAP] Hover-Dim (Highlight on Hover)
**Impact:** High | **Effort:** Small | **ROI: ★★★★★**

**What:** Hovering a bar doesn't dim the other bars — all bars stay at full opacity. Series-level hover dimming (hover one series, dim others) isn't implemented.
**Why:** Zebra BI, Inforiver, and native Power BI all dim non-hovered elements. The core library already has `createHoverDim()` in `shared-helpers.ts` (lines 488-520) but it's not wired up in the bar chart.
**Competitors:** All competitors do this. It's the most basic chart interaction after tooltips.

**Implementation spec:**
- **Files:** `packages/bar-chart-pro/src/visual.ts` (end of each render mode method, e.g., renderGrouped)
- **Approach:** After all bars are rendered, call `createHoverDim({ elements: container.querySelectorAll('.bar-chart-bar'), dimOpacity: 0.25 })`. Push the cleanup function to `cancelAnimations`.
- **Key details:** The utility already exists in core. Just wire it up: `const cleanup = createHoverDim({ elements: this.container.querySelectorAll('.bar-chart-bar') }); this.cancelAnimations.push(cleanup);`
- **Complexity:** ~5 lines of code per render mode, or extract to a shared method called at the end of `render()`.
- **Watch out for:** Don't apply hover-dim to non-bar elements (labels, grid, reference lines). The selector `.bar-chart-bar` already scopes correctly.

### 9. [GAP] Small Multiples (Trellis Charts)
**Impact:** High | **Effort:** Large | **ROI: ★★★☆☆**

**What:** No support for small multiples — can't break one chart into a grid of mini-charts by a secondary category.
**Why:** Zebra BI Charts' flagship feature is small multiples. Inforiver also supports them. This is the most requested feature for enterprise dashboards when comparing performance across sites/teams/regions.
**Competitors:** Zebra BI Charts has best-in-class small multiples with highlighting, TopN within each, and synchronized axes. Inforiver supports them too.

**Implementation spec:**
- **Files:** New `SmallMultiplesSettingsCard` in `settings.ts`, new `renderSmallMultiples` method in `visual.ts`
- **Approach:** When a second category column is present AND small multiples is enabled, partition data by the first category and render independent mini-charts in a CSS grid. Each mini-chart calls the existing `renderGrouped/Stacked/etc.` with subset data and scaled-down dimensions.
- **Key details:** Use CSS grid: `grid-template-columns: repeat(auto-fill, minmax(120px, 1fr))`. Each mini-chart gets its own SVG. Synchronized Y-axis across all multiples for accurate comparison. Show the facet label above each mini-chart.
- **Watch out for:** This overlaps with drill-down (which also uses sub-categories). Add a toggle to switch between drill-down and small multiples mode. Performance: limit to 20 multiples max, show "Too many categories" warning beyond that.

### 10. [GAP] Waterfall Chart Mode
**Impact:** High | **Effort:** Large | **ROI: ★★★☆☆**

**What:** No waterfall/bridge chart mode. The 6 existing modes don't include this common financial visualization.
**Why:** Zebra BI Charts and Inforiver both offer waterfall as a core mode. It's extremely common in construction finance for showing how costs/revenues accumulate. Users currently need a separate visual.
**Competitors:** Zebra BI has 5+ waterfall variants. Inforiver has waterfall, stacked waterfall, variance waterfall. Even the Power BI built-in has a waterfall chart.

**Implementation spec:**
- **Files:** `packages/bar-chart-pro/src/visual.ts` (new `renderWaterfall` method), `packages/bar-chart-pro/src/settings.ts` (add 'waterfall' to ChartModeSettings)
- **Approach:** Add `{ value: 'waterfall', displayName: 'Waterfall' }` to the mode dropdown. Implement `renderWaterfall` that computes running totals: each bar starts where the previous one ended. Use green for positive, red for negative, gray for subtotals. The final bar extends from 0 to the total.
- **Key details:** Running total: `cumulative[i] = cumulative[i-1] + values[i]`. Bar Y = `min(cumulative[i-1], cumulative[i])`, height = `abs(values[i])`. Connector lines between bars at the cumulative level. Use the existing conditional formatting to override colors.
- **Watch out for:** Need a way to mark "total" bars (sum bars that start from 0). Could use a convention: if value is null, render as a total bar from 0 to the running sum.

### 11. [REFINEMENT] Smart Data Label Collision Avoidance
**Impact:** High | **Effort:** Medium | **ROI: ★★★★☆**

**What:** Data labels can overlap each other when bars are narrow or values are close together. No collision detection or auto-repositioning.
**Why:** Zebra BI and Inforiver both have smart label placement that hides or repositions overlapping labels. Overlapping labels are worse than no labels — they're unreadable and look broken.
**Competitors:** Zebra BI auto-hides labels that would overlap. Inforiver repositions with leader lines. Native Power BI also does collision avoidance.

**Implementation spec:**
- **Files:** `packages/bar-chart-pro/src/visual.ts` (renderDataLabel, renderHorizontalDataLabel)
- **Approach:** After all labels are rendered, run a collision detection pass. For each pair of adjacent labels, check if their bounding boxes overlap (using `getBBox()`). If they overlap, try: (1) alternate above/below, (2) reduce font size by 1px, (3) hide the less important label.
- **Key details:** After all labels are appended, collect all `.bar-chart-label` elements. Compute BBox for each. Sort by x position. For overlapping pairs, remove the one with the smaller absolute value (less important).
- **Watch out for:** Must run after animations complete (or use final positions). `getBBox()` requires the element to be in the DOM. Run the collision check in a `requestAnimationFrame` callback.

### 12. [REFINEMENT] Lollipop Chart Variant
**Impact:** Medium | **Effort:** Medium | **ROI: ★★★☆☆**

**What:** No lollipop chart mode (circle + thin line instead of filled bar).
**Why:** Lollipop charts are a popular modern alternative to bar charts that work well with many categories (less visual clutter). Zebra BI and Inforiver both offer them.
**Competitors:** Zebra BI Charts has lollipop/dot plot. Inforiver has Lollipop Plot. They're trending in modern dashboards.

**Implementation spec:**
- **Files:** `packages/bar-chart-pro/src/visual.ts` (new method or modify renderGrouped), `packages/bar-chart-pro/src/settings.ts` (add to mode or bar settings)
- **Approach:** Add a `barStyle` dropdown: "Bar" (default), "Lollipop". In lollipop mode, render a thin line (`stroke-width: 2`) from y(0) to y(value), then a circle (`r: 5-8`) at y(value). Reuse existing color/gradient/animation logic.
- **Key details:** Line: `g.append('line')` from `(cx, y(0))` to `(cx, y(val))`. Circle: `g.append('circle')` at `(cx, y(val))` with `r=6`. Apply the same fill/gradient as bars. Tooltip attaches to the circle.
- **Watch out for:** Works differently in horizontal mode (horizontal line + circle). Stacked mode doesn't make sense for lollipops — auto-switch to grouped.

### 13. [REFINEMENT] Pareto Line (80/20 Overlay)
**Impact:** Medium | **Effort:** Medium | **ROI: ★★★☆☆**

**What:** No built-in Pareto analysis overlay (cumulative % line on sorted bar chart).
**Why:** Pareto charts are a standard quality analysis tool in construction (defect analysis, cost drivers). Inforiver supports Pareto natively. Currently users need to create a separate calculated measure.
**Competitors:** Inforiver has Pareto as a chart type. Zebra BI achieves it through combo mode.

**Implementation spec:**
- **Files:** `packages/bar-chart-pro/src/visual.ts` (new `renderParetoOverlay` method), `packages/bar-chart-pro/src/settings.ts` (new toggle in a ParetoSettings card)
- **Approach:** Add a "Show Pareto Line" toggle. When enabled: (1) sort categories by value descending, (2) compute cumulative % for each bar, (3) draw a line overlay on a 0-100% secondary Y-axis, (4) draw an 80% threshold line.
- **Key details:** Cumulative: `cumPct[i] = sum(values[0..i]) / totalSum * 100`. Use a secondary Y-axis (0-100%). Line uses `d3.curveMonotoneX`. 80% threshold is a dashed horizontal reference line.
- **Watch out for:** Only meaningful for single-series, non-negative data. Auto-sort conflicts with user's sort order — add a note that Pareto implies value-desc sorting.

### 14. [REFINEMENT] Selection Highlight Persistence
**Impact:** Medium | **Effort:** Small | **ROI: ★★★★☆**

**What:** When a bar is selected (cross-filtered), there's no persistent visual indicator — just the hover brightness change. Selected vs non-selected bars look identical after the mouse moves away.
**Why:** Native Power BI dims non-selected bars to 40% opacity on cross-filter. This is expected behavior that all custom visuals should replicate.
**Competitors:** Every PBI visual (native and custom) does this. It's core to the Power BI cross-filtering UX.

**Implementation spec:**
- **Files:** `packages/bar-chart-pro/src/visual.ts` (attachSelection method, ~line 2900)
- **Approach:** After `selectionManager.select()`, check `selectionManager.hasSelection()`. If true, iterate all `.bar-chart-bar` elements and dim those whose selectionId doesn't match to `opacity: 0.3`. On clear, restore all to full opacity.
- **Key details:** Store selectionIds as data attributes on bars: `rect.attr('data-sel-id', selectionId.getKey())`. On selection change, compare each bar's stored ID against the active selection.
- **Watch out for:** Need to handle multi-select (Ctrl+click). The `selectionManager.getSelectionIds()` returns current selections. Also apply dimming to line dots in combo mode.

### 15. [REFINEMENT] Animated Transitions on Data Update
**Impact:** Medium | **Effort:** Medium | **ROI: ★★★☆☆**

**What:** When data changes (e.g., slicer filter), the entire chart is torn down and rebuilt from scratch. No smooth transition between states.
**Why:** Zebra BI and native Power BI smoothly animate bars growing/shrinking to new values on data change. The current approach (`while (container.firstChild) container.removeChild(...)`) causes a flash. D3's key-based transitions can interpolate between old and new states.
**Competitors:** Zebra BI, Inforiver, and native Power BI all animate between data states.

**Implementation spec:**
- **Files:** `packages/bar-chart-pro/src/visual.ts` (render method and each mode renderer)
- **Approach:** Instead of clearing and rebuilding, use D3 enter/update/exit pattern. Key bars by `category + series` and use `.transition().duration(300)` to animate `y`, `height`, and `fill` changes. New bars grow from zero; removed bars shrink to zero.
- **Key details:** The current architecture rebuilds everything from scratch each render. A lighter approach: cache previous bar positions in a `Map<string, {x, y, w, h}>`. On re-render, if a bar existed before, animate from old position to new. D3 `.join()` simplifies this.
- **Watch out for:** This is a significant refactor of the rendering pipeline. Start with grouped mode only, then expand. Chart mode changes (e.g., grouped → stacked) should still do a full rebuild.

### 16. [GAP] Export to Image / Copy to Clipboard
**Impact:** Medium | **Effort:** Medium | **ROI: ★★★☆☆**

**What:** No built-in export-to-image or copy-to-clipboard functionality from the visual's context menu.
**Why:** Construction professionals frequently need to paste charts into reports, emails, and presentations. Zebra BI supports direct PowerPoint export. Copy-to-clipboard is a quick win that saves users from screenshotting.
**Competitors:** Zebra BI exports to PowerPoint/Excel. Inforiver has image export. Even native Power BI has "Export data" and "Copy visual as image" in the context menu.

**Implementation spec:**
- **Files:** `packages/bar-chart-pro/src/visual.ts` (new export method), `packages/kpi-card/src/visual.ts` (same)
- **Approach:** Use the `html2canvas` library or native `SVGElement.outerHTML` → `<canvas>` → `canvas.toBlob()` → `navigator.clipboard.write()`. Add a "Copy as Image" option via PBI's context menu API or a small icon button overlay.
- **Key details:** For SVG charts: serialize SVG → create an Image → draw to Canvas → toBlob. For KPI card (HTML-based): use `html2canvas`. The PBI API supports `host.launchUrl()` but not clipboard directly — this would be a DOM-level feature.
- **Watch out for:** PBI sandboxing may block `navigator.clipboard.write()`. Test in both PBI Desktop and Service. Fallback: download as PNG using a Blob URL.

### 17. [UX] Responsive Font Sizing
**Impact:** Medium | **Effort:** Small | **ROI: ★★★★☆**

**What:** KPI Card: font sizes are fixed pixel values. A 32px value font looks fine in a 200x150 card but is way too large in a 100x80 card, and too small in a 400x300 card.
**Why:** Zebra BI and Inforiver auto-scale text to fit the card size. This is expected behavior for dashboard cards that get resized frequently.
**Competitors:** Zebra BI Cards auto-scales all text. Power KPI also auto-sizes.

**Implementation spec:**
- **Files:** `packages/kpi-card/src/visual.ts` (renderSingleKpi, value/label font sizing)
- **Approach:** Compute a scale factor: `scaleFactor = Math.min(containerWidth / 200, containerHeight / 150)` (200x150 is the "design size"). Multiply all font sizes by `clamp(0.5, scaleFactor, 2.0)`. Apply via `style.fontSize`.
- **Key details:** Read `this.container.clientWidth` and `clientHeight` at the start of render. Scale value font, label font, trend font, and comparison font proportionally. Use the user's configured size as the base, not a hardcoded value.
- **Watch out for:** Don't scale below a minimum readable size (8px). Multi-KPI grid cells are smaller — the scale factor per cell, not per container.

### 18. [UX] Bar Chart Zoom and Pan
**Impact:** Medium | **Effort:** Medium | **ROI: ★★★☆☆**

**What:** Large datasets rely on scroll (via `createScrollableChart`), but there's no zoom/pan capability for exploring dense data.
**Why:** D3's `d3.zoom()` provides native zoom/pan behavior. Inforiver supports 30K+ data points with zoom. For construction dashboards with hundreds of work items, zoom is essential for drilling into specific regions.
**Competitors:** Inforiver supports zoom on dense charts. Deneb (Vega) has built-in zoom. Zebra BI relies on scroll but has "axis break" for discontinuous data.

**Implementation spec:**
- **Files:** `packages/bar-chart-pro/src/visual.ts` (render method, after SVG creation), `packages/bar-chart-pro/src/settings.ts` (new ZoomSettings)
- **Approach:** Add a `enableZoom` toggle. When enabled, apply `d3.zoom().scaleExtent([1, 5]).on('zoom', ...)` to the SVG. In the zoom handler, update `transform` on the chart group and rescale axes using `event.transform.rescaleX/Y`.
- **Key details:** Use `d3.zoom()` with `translateExtent` to prevent panning outside the chart bounds. Rescale the x-axis on zoom. Add reset-zoom button (small icon in the top-right corner). Double-click to reset.
- **Watch out for:** Zoom conflicts with the existing scroll wrapper. When zoom is enabled, disable scroll. Touch events on mobile. Zoom should not affect the legend, title, or breadcrumb.

### 19. [REFINEMENT] Y-Axis Padding Prevents Top Bar Clipping
**Impact:** Medium | **Effort:** Small | **ROI: ★★★★☆**

**What:** The Y-axis domain uses `yMax * 1.1` padding, but data labels above the tallest bar can still get clipped if the label text is tall.
**Why:** Data labels positioned "above" bars at `barY - 6` can extend above the chart area. The 10% padding may not be enough for formatted numbers like "$1,234,567".

**Implementation spec:**
- **Files:** `packages/bar-chart-pro/src/visual.ts` (renderGrouped and other mode methods, Y-axis domain computation)
- **Approach:** When `showDataLabels` is "above", increase the Y-axis padding from `yMax * 1.1` to `yMax * 1.15`. This gives 5% more headroom for labels. Also add `overflow: visible` to the SVG's clip path if one exists.
- **Key details:** Check `this.getDataLabelMode() !== 'none'` before applying extra padding. Only add it when labels are enabled.
- **Watch out for:** This shifts the zero line down slightly, reducing chart area. The tradeoff is acceptable.

### 20. [GAP] Stacked Bar Segment Labels
**Impact:** Medium | **Effort:** Medium | **ROI: ★★★☆☆**

**What:** In stacked mode, data labels only show the total at the top — individual segment values within each stack are not shown.
**Why:** Zebra BI and Inforiver show segment values inside each stack segment. Without them, users can't read individual series contributions in a stacked chart without hovering each segment.
**Competitors:** Zebra BI shows segment values inside stacks. Inforiver shows both segment values and totals.

**Implementation spec:**
- **Files:** `packages/bar-chart-pro/src/visual.ts` (renderStacked method, inside the inner forEach loop)
- **Approach:** Add per-segment labels inside stacked bars when `showDataLabels` is "inside". In the inner loop, after creating each rect, check if `barH > 16` (enough space for text). If so, append a text element at `(barX + barW/2, barY + barH/2)` with the segment value.
- **Key details:** Use `dominant-baseline: central` for vertical centering. Skip labels for segments shorter than 16px. Use white text color when the fill is dark (compute luminance).
- **Watch out for:** Label color needs to contrast with the segment fill. Use a simple luminance check: `lum = 0.299*R + 0.587*G + 0.114*B`, white text if lum < 128.

### 21. [UX] Legend Click-to-Filter
**Impact:** High | **Effort:** Small | **ROI: ★★★★★**

**What:** The legend is display-only — clicking a legend item does nothing. Users expect to toggle series visibility by clicking legend items.
**Why:** This is a universal chart interaction pattern. Zebra BI, Inforiver, native Power BI, and virtually every charting library support legend click-to-filter. The core `renderLegend` function already accepts an `onItemClick` callback (shared-helpers.ts line 372) — it's just not wired up.
**Competitors:** All competitors support this. It's true table stakes.

**Implementation spec:**
- **Files:** `packages/bar-chart-pro/src/visual.ts` (renderLegend method, ~line 2776)
- **Approach:** Pass `onItemClick` and `onItemHover` callbacks to `renderLegend()`. Track hidden series in a `Set<string>`. On click, toggle the series name in/out. On re-render, skip series in the hidden set. On hover, call `createHoverDim` for that series.
- **Key details:** The `renderLegend` already supports `onItemClick` and `onItemHover`. Just add: `onItemClick: (item) => { this.toggleSeriesVisibility(item.label); this.reRenderWithDrill(); }`. Store `hiddenSeries: Set<string>` as an instance field.
- **Watch out for:** Must persist hidden series across data updates (don't reset on each `update()`). Clear hidden set when data structure changes (new columns added/removed).

### 22. [GAP] Negative Value Handling in Horizontal Data Labels
**Impact:** Medium | **Effort:** Small | **ROI: ★★★★☆**

**What:** Horizontal data labels always position to the right of the bar end (`barW + 6`). For negative values, the bar extends left from zero but the label still positions based on `barW` which is the positive width — labels appear at the wrong position.
**Why:** This is a rendering bug in `renderHorizontalDataLabel`. Negative bars in horizontal mode start at `x=0` with positive width, but the label should be to the left of the bar start, not to the right.

**Implementation spec:**
- **Files:** `packages/bar-chart-pro/src/visual.ts` (renderHorizontalDataLabel, lines 2746-2770, and renderHorizontal where it's called)
- **Approach:** Pass the actual value to `renderHorizontalDataLabel` and check if `value < 0`. For negative values, position the label at `barX - 6` (left of the bar) with `text-anchor: end`. For positive values, keep current behavior.
- **Key details:** The horizontal bar rendering already computes `barW = x(val)` which for negative vals produces a small or zero width since x domain starts at a negative value. Need to also pass the bar's actual X position and handle negative bars that extend leftward from the zero line.
- **Watch out for:** Must check how horizontal mode handles negative values currently — the `barW` calculation on line 1792 uses `x(val)` directly, which may already be incorrect for negative values.

---

## Research Sources
- **Zebra BI Charts:** Small multiples, waterfall variants, auto-variance, IBCS compliance, 1-click axis break, TopN+Others, dynamic comments, lollipop/dot charts
- **Zebra BI Cards:** Sparkline tooltips, min/max markers, auto-scaling text, period-over-period comparison, cross-filtering, PowerPoint export
- **Inforiver Analytics+:** 30K+ data points, 30+ chart types (waterfall variants, Pareto, tornado, lollipop, dumbbell), zoom capability, conditional formatting, IBCS certification
- **Deneb:** Full Vega/Vega-Lite grammar, unlimited customization, certified by Microsoft, free (MIT), but requires Vega knowledge
- **D3 v7:** Voronoi/Delaunay for hover detection, zoom/pan behavior, brush selection, transition chaining, enter/update/exit pattern
- **Power BI API:** Selection manager, tooltip service, context menu, rendering events, accessibility (ARIA)
- **Core library:** `createHoverDim` exists unused, `renderLegend` has unused `onItemClick`/`onItemHover` callbacks, `crosshair.ts` exists but unused by bar chart
