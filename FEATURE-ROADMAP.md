# Feature Roadmap — Power BI Custom Visuals

## Bar Chart Pro X-Axis Label Fix (Completed)

**Root cause:** `visual.less:37` had `text-anchor: end` which anchors labels to their right edge at the tick position, shifting them left of the bar center. Changed to `text-anchor: middle`. The rotation code in `visual.ts` already overrides this correctly for rotated labels.

---

## Tier 1: Universal Quick Wins (Low complexity, apply to many charts)

| Feature | Charts | Complexity | Status |
|---------|--------|------------|--------|
| **Number format / display units** (Auto/K/M/B/%, decimals, prefix/suffix) | Bar, Area, Waterfall, Box, Scatter, KPI, Gauges | Low | |
| **Hover highlight/dim** (hover a series, dim all others) | Bump, Slope, Dumbbell, Area, Stream, Network | Low | |
| **Missing legends** | Polar, Chord, Waffle | Low | |
| **Sort order controls** | Polar, Chord, Health Bar, Dumbbell, Stream, Ring Stack | Low | |
| **Rounded arc caps** (Apple Watch style) | Ring Stack, Gauge Cluster, Radial Gauge | Low | |

---

## Tier 2: High-Impact Per-Chart Features (Medium complexity)

| Feature | Chart | Why |
|---------|-------|-----|
| **100% stacked mode** | Bar Chart Pro | Trivial — stacked exists, just normalize to % |
| **Reference lines & bands** | Bar, Area, Box Plot | Huge storytelling value |
| **Stacked/100% stacked area** | Morphing Area | Most common area variant, currently missing |
| **Crosshair/trackball** | Area, Bump, Stream | Essential for multi-series comparison |
| **Subtotals/intermediate sums** | Waterfall | #1 most requested waterfall feature |
| **Gap/delta labels** | Dumbbell | The primary insight — currently not shown |
| **% change labels** | Slope | Core purpose of the chart |
| **Mean marker + jittered points** | Box Plot | Standard in Plotly/D3 gallery |
| **Quadrant lines/zones** | Scatter Bubble | BCG matrix, risk matrix — major differentiator |
| **Multi-stop color scale + legend** | Heatmap Calendar | Current 2-stop gradient with no legend is biggest gap |
| **Conditional value coloring** | KPI Card | #1 feature in Inforiver/xViz |
| **Target/goal markers** | Gauge Cluster, Radial Gauge, Health Bar, Progress Bar | Essential for KPI dashboards |
| **Needle/pointer** | Radial Gauge | Classic gauge look, currently missing |
| **Semi-donut (start/end angle)** | Animated Donut | Low effort, visual variety |
| **Top N / Others grouping** | Donut, Bar Chart | Prevents clutter with many categories |
| **Pyramid mode toggle** | Funnel Pro | Simple toggle, doubles use cases |
| **Timestamp/period display** | Bar Race | THE iconic bar race element |
| **Center content** | Ring Stack, Sunburst | Show total/KPI in the center |
| **Zoom & pan** | Network Graph, Scatter Bubble | Essential for large datasets |
| **Shape type (polygon vs circle)** | Radar | Low effort, major visual differentiation |
| **Per-ring max value** | Ring Stack | Needed when rings represent different KPIs |
| **Custom threshold values** | Status Indicator | Makes the visual actually usable |

---

## Tier 3: Premium Differentiators (High complexity, major competitive edge)

| Feature | Chart | Why |
|---------|-------|-----|
| **Drill-down with breadcrumb** | Treemap, Sunburst, Bar, Waterfall | Table stakes for premium hierarchical visuals |
| **Trendline/regression** | Scatter Bubble | Most requested analytical scatter feature |
| **Task dependencies (arrows)** | Gantt | THE defining premium Gantt feature |
| **Collapsible task hierarchy** | Gantt | Expected in any "Pro" Gantt |
| **Icon/pictogram mode** | Waffle | Most differentiating waffle feature |
| **Play/pause/scrub controls** | Bar Race | Professional playback UX |
| **Brush/range selection** | Area | Mini-chart zoom control |
| **Small multiples/trellis** | Bar Chart Pro | Major differentiator vs. native PBI |

---

## Detailed Research by Chart

### Bar Chart Pro

**Already has:** 5 modes (grouped/stacked/combo/horizontal/diverging), bar styling (corner radius, spacing, border, opacity, gradient fill), data labels (none/above/inside), combo line settings, axes (show/hide X/Y, secondary Y, rotation), target line, legend, glass card style, animations, scroll.

**Top missing features:**
1. **Conditional Color Rules** — Color bars by value thresholds (red below target, green above). AG Charts "Item Stylers", Highcharts "zones". (Medium)
2. **Variance / Change Indicators** — Delta arrows or +/- labels comparing to benchmark. xViz Variance Chart. (Medium)
3. **Reference Bands (Plot Bands)** — Shaded horizontal regions (danger zone, good zone). Highcharts Plot Bands. (Low)
4. **Number Format / Display Units** — Auto/K/M/B/%, decimals, prefix/suffix. (Low)
5. **Smart Label Positioning** — Auto-detect collisions, reposition. ECharts label collision avoidance. (Medium)
6. **Pattern / Texture Fill** — SVG patterns for accessibility in print/grayscale. Highcharts pattern-fill. (Medium)
7. **100% Stacked Mode** — Normalize to percentages. Trivial since stacked exists. (Low)
8. **Sort Options** — Sort by value asc/desc, by name, by data order. (Low)
9. **Top N / Bottom N Filter** — Show top N, aggregate rest as "Others". (Medium)
10. **Error Bars** — Confidence intervals on bar values. Plotly error bars. (Medium)
11. **Lasso / Box Selection** — Draw region to select bars for cross-filtering. (Medium)

### Morphing Area Chart

**Already has:** Line settings (width, curve type, dots, area fill, dot styling), area settings (opacity, gradient), axes (X/Y, grid), legend (4 positions), glass card, animations, scroll.

**Top missing features:**
1. **Stacked / 100% Stacked Area** — Stack multiple series. Highcharts stacking. (Medium)
2. **Range Area / Confidence Band** — Shaded band between high/low bounds. Highcharts arearange. (Medium)
3. **Reference Lines** — Horizontal/vertical lines at average, target, min, max. ECharts markLine. (Low)
4. **Reference Areas** — Shaded zones highlighting date ranges or value ranges. ECharts markArea. (Low)
5. **Threshold / Zone Coloring** — Change fill color by Y-value zones. Highcharts zones. (Medium)
6. **Crosshair / Trackball** — Vertical line following cursor, show all series values. (Low)
7. **Brush / Range Selection** — Mini chart for zooming. Recharts Brush. (High)
8. **Null Handling Options** — Skip, connect, or interpolate through gaps. (Low)
9. **Series Highlight on Hover** — Dim non-hovered series to 20% opacity. (Low)
10. **Number Format / Display Units** — K/M/B/%, decimals, prefix/suffix. (Low)

### Animated Waterfall

**Already has:** Show connectors/total, bar styling (width, radius, border), colors (positive/negative/total), value labels, axes, glass card, animations (stagger), connector formatting, scroll.

**Top missing features:**
1. **Subtotals / Intermediate Sums** — Mark bars as subtotals that reset running total. Highcharts isIntermediateSum. (Medium)
2. **Breakdown / Stacked Waterfall** — Subdivide bars by category. xViz Breakdown Analysis. (High)
3. **Starting Value Column** — First bar as opening balance. Plotly measure="absolute". (Low)
4. **Horizontal Orientation** — Flip to horizontal. xViz. (Medium)
5. **Number Format / Display Units** — Critical for financial waterfalls. (Low)
6. **Running Total Line** — Overlay line showing cumulative total. (Medium)
7. **Connector Labels** — Running total value at each connector. (Low)
8. **Sort by Contribution** — Largest positive to smallest negative (bridge chart). (Low)
9. **Annotations / Callouts** — Text labels on specific bars. (Medium)
10. **Summary Metrics Banner** — Header showing Starting, +Total, -Total, Net, Ending. (Low)

### Box Plot

**Already has:** Box width, outliers toggle, median line, median color, box/whisker styling, axes/grid, legend, glass card, animations, scroll.

**Top missing features:**
1. **Horizontal orientation** — Flip to horizontal. Highcharts, Plotly. (Medium)
2. **Mean marker** — Diamond/cross at arithmetic mean. Plotly boxmean. (Low)
3. **Notched box plot** — 95% CI notches at median. Plotly notched. (Medium)
4. **Jittered data points overlay** — Individual points scattered alongside box. Plotly boxpoints='all'. (Medium)
5. **Violin overlay mode** — KDE shape around box. Plotly violin. (High)
6. **Custom whisker calculation** — 1.5xIQR, min/max, percentile, std dev. (Medium)
7. **Grouped/side-by-side boxes** — Multiple series per category. (Medium)
8. **Reference lines/bands** — Target, SLA thresholds. (Low)
9. **Per-category colors** — Each box its own color. (Low)

### Scatter Bubble

**Already has:** Min/max bubble radius, opacity, stroke styling, axes/grid, legend, glass card, animations.

**Top missing features:**
1. **Trendline / Regression** — OLS, log, exponential with R-squared. (High)
2. **Quadrant lines / zones** — BCG matrix, risk matrix. (Medium)
3. **Reference lines and bands** — Target, range bands. (Low)
4. **Lasso / rectangular selection** — Draw to select for cross-filtering. (High)
5. **Color scale (continuous)** — Map measure to gradient. (Medium)
6. **Bubble shape encoding** — Circle, square, diamond, triangle. (Medium)
7. **Zoom and pan** — Scroll-to-zoom, drag-to-pan. (Medium)
8. **Play axis / animation slider** — Gapminder-style animation over time. (High)
9. **Cluster markers** — Auto-cluster nearby points when zoomed out. (Medium)
10. **Size legend** — Bubble-size reference circles. (Low)
11. **Log scale axes** — For data spanning multiple orders of magnitude. (Low)

### Heatmap Calendar

**Already has:** Cell size/gap, month/day labels, cell stroke/radius, low/high color (2-stop), glass card, animations.

**Top missing features:**
1. **Multi-stop color scale** — 3+ stops, diverging scales with midpoint. (Medium)
2. **Empty cell color** — Distinct from low-value. (Low)
3. **Color legend / scale bar** — Gradient bar with ticks. (Medium)
4. **Week start day** — Sunday vs Monday. (Low)
5. **Multi-year navigation** — Previous/next buttons. (Medium)
6. **Discrete color bins** — GitHub-style contribution buckets. (Medium)
7. **Click-to-filter** — Cross-filter on day/date range. (Medium)
8. **Cell shape options** — Square, rounded rect, circle. (Low)

### Treemap Pro

**Already has:** Tiling algorithm (squarify/binary/slice/dice), labels/values, tile styling, palette, glass card, animations.

**Top missing features:**
1. **Drill-down with breadcrumb** — Click to zoom into children. Highcharts, ECharts. (High)
2. **Color axis / heatmap mode** — Second measure mapped to color. (Medium)
3. **Nested level headers** — Persistent parent borders. (Medium)
4. **Color variation by depth** — Auto shade children lighter/darker. (Low)
5. **Label overflow handling** — Auto-hide/truncate labels that don't fit. (Medium)
6. **Percentage display** — % of total or % of parent. (Low)
7. **Tooltip with hierarchy path** — Full path in tooltip. (Low)
8. **Legend** — Currently missing entirely. (Low)

### Sunburst Chart

**Already has:** Labels, min angle, segment stroke, palette, glass card, animations, legend.

**Top missing features:**
1. **Drill-down with breadcrumb** — Click segment to drill in. (High)
2. **Center text / total display** — Dynamic text in center. (Medium)
3. **Inner radius control** — Donut-style hole size. (Low)
4. **Percentage labels** — % of parent or % of total. (Low)
5. **Highlight ancestors/descendants on hover** — Dim unrelated segments. (Medium)
6. **Level-specific styling** — Different config per ring level. (Medium)
7. **Sort order** — By value, alphabetical, or data order. (Low)
8. **Start angle** — Configure first segment position. (Low)

### Bump Chart

**Already has:** Line width, dot radius, rank numbers, dot stroke, palette, X-axis, legend (right/bottom), glass card, animations, line stroke style, scroll.

**Top missing features:**
1. **Highlight/Dim on Hover** — Dim non-hovered series. (Low)
2. **Top-N / Filter by Rank** — Show only top N items. (Medium)
3. **Rank Change Annotations** — "+3"/"-2" callouts at each point. (Medium)
4. **Crosshair / Vertical Hover Line** — Show all ranks at position. (Low)
5. **Tooltip with Full Ranking Table** — Mini-table at hovered time point. (Medium)
6. **Series-Level Color Override** — Per-series color. (Low)

### Slope Chart

**Already has:** Line width, dot radius, direction colors (positive/negative/neutral), area fill, column labels (left/right text), glass card, animations, line stroke.

**Top missing features:**
1. **Highlight/Dim on Hover** — Dim non-hovered lines. (Low)
2. **Percentage Change Labels** — Show +12% or delta on each line. (Low)
3. **Sort by Change Magnitude** — Largest change first. (Medium)
4. **Multi-Column (3+ Points)** — Beyond before/after. (High)
5. **Label Collision Avoidance** — Dodge overlapping labels. (Medium)
6. **Series-Level Color Override** — Per-item color beyond direction. (Low)

### Dumbbell Chart

**Already has:** Dot radius, line width, start/end colors, dot stroke, line color, axes, glass card, animations, scroll.

**Top missing features:**
1. **Sort by Gap / Value** — Sort by magnitude, start, end, or alpha. (Medium)
2. **Directional Color** — Green if end>start, red if end<start. (Low)
3. **Gap/Delta Label** — Numeric difference on connector. (Low)
4. **Reference Line / Target** — Vertical benchmark line. (Medium)
5. **Connector Arrow** — Arrowhead showing direction. (Medium)
6. **Highlight/Dim on Hover** — Highlight single row. (Low)

### Gantt Chart Pro

**Already has:** Bar height, progress, today line, labels, bar styling (opacity, radius, row gap, label width), today line styling, glass card, animations.

**Top missing features:**
1. **Task Dependencies (Arrows)** — Arrows between tasks. THE premium Gantt feature. (High)
2. **Milestones** — Diamond markers for zero-duration events. (Medium)
3. **Collapsible Task Groups / Hierarchy** — Parent/child with expand/collapse. (High)
4. **Timeline Zoom Levels** — Day/week/month/quarter/year. (High)
5. **Baseline (Planned vs Actual)** — Shadow bar for planned schedule. (Medium)
6. **Critical Path Highlighting** — Auto-identify and highlight. (High)
7. **Per-Task Color** — Color by category/priority/status. (Medium)
8. **Multi-Level Timeline Header** — Months on top, weeks below. (Medium)

### Timeline Milestone

**Already has:** Orientation (H/V), dates, date format, line styling, marker settings (shape/size/color by category), glass card, animations.

**Top missing features:**
1. **Zoom and Pan** — Interactive time navigation. (High)
2. **Alternating / Staggered Layout** — Events above/below spine. (Medium)
3. **Event Grouping / Swimlanes** — Rows by category. (Medium)
4. **Event Duration Ranges** — Span-type events, not just points. (Medium)
5. **Today Marker** — Vertical "now" line. (Low)
6. **Event Description / Subtitle** — Second line of text. (Low)

### Animated Donut Pro

**Already has:** Inner radius, center value (font/color/prefix/suffix/decimals), labels, segment stroke, glass card, animations, legend.

**Top missing features:**
1. **Semi-donut (start/end angle)** — Half-circle or custom arc. (Low)
2. **Slice Explode / Pull-out** — Selected slices pull outward. (Low)
3. **Border Radius on Slices** — Rounded corners. (Low)
4. **Top N / Others Grouping** — Group small slices. (Medium)
5. **Data Label Format Options** — Category, value, %, or combos. (Medium)
6. **Connector Lines for Labels** — Lines from slice to external label. (Medium)
7. **Gradient Fill per Slice** — Radial or linear gradient. (Medium)

### Funnel Pro

**Already has:** Style (symmetric/left-aligned), conversion rate, gap, values, segment stroke, label color, base color + gradient, glass card, animations.

**Top missing features:**
1. **Pyramid Mode** — Reverse funnel (widest at bottom). (Low)
2. **Neck Width / Height** — Control narrow bottom portion. (Low)
3. **Drop-off / Conversion Labels** — Configurable drop-off display. (Medium)
4. **Dynamic Height per Stage** — Height proportional to value. (Medium)
5. **Per-Segment Color** — Individual color per stage. (Medium)
6. **Border Radius on Segments** — Rounded corners. (Low)

### Gauge Cluster

**Already has:** Gauges per row, arc range, min/max, labels/values, track opacity, color zones (3 with thresholds), glass card, animations.

**Top missing features:**
1. **Target/Goal Marker** — Target line on each gauge arc. (Medium)
2. **Needle/Pointer** — Pointer indicator. (Medium)
3. **Rounded Arc Caps** — Apple Watch style linecap. (Low)
4. **Arc Segmentation** — Discrete segments with gaps. (Low)
5. **Secondary Label** — Subtitle under value. (Low)
6. **Per-Gauge Min/Max** — Each gauge its own scale. (Medium)

### Radial Gauge

**Already has:** Arc thickness (thin/medium/thick), arc range (180/270), track opacity, zone borders, 3 color zones with thresholds, value display (font/color/prefix/suffix/decimals), target (show/color), glass card, animations.

**Top missing features:**
1. **Needle / Pointer** — Classic rotating needle. (Medium)
2. **Scale Tick Marks** — Major/minor ticks around arc. (Medium)
3. **Scale Labels** — Numeric labels around arc. (Medium)
4. **Rounded Arc Caps** — Modern linecap style. (Low)
5. **Custom Arc Range (numeric)** — Any angle, not just 180/270. (Low)
6. **Target Marker Shape/Style** — Line, triangle, diamond options. (Low)
7. **Arc Segmentation** — Discrete segments with gaps. (Low)

### Ring Stack

**Already has:** Ring thickness, gap, max value, labels, track color/opacity, stroke, 6 hardcoded colors, glass card, animations, legend.

**Top missing features:**
1. **Rounded End Caps** — Apple Watch style. (Low)
2. **Gradient Fill per Ring** — Angular gradient. (Medium)
3. **Per-Ring Max Value** — Each ring its own target. (Medium)
4. **Overflow Indicator (>100%)** — Wrap past 360deg. (Medium)
5. **Center Content** — Total/KPI in center. (Low)
6. **Dynamic Color from Data** — Auto-assign palette, not 6 hardcoded pickers. (Medium)

### Radar Chart

**Already has:** Grid (levels, stroke), fill opacity, dots (show/radius), web styling, area opacity, legend, palette, glass card, animations.

**Top missing features:**
1. **Shape Type (polygon vs circle)** — Toggle grid shape. (Low)
2. **Independent Axis Scales** — Per-axis min/max. (Medium)
3. **Start Angle** — Configurable first axis position. (Low)
4. **Series Line Style** — Per-series dash, point shape. (Low)
5. **Highlight/Dim on Hover** — Focus hovered series. (Medium)
6. **Target/Benchmark Overlay** — Reference polygon. (Medium)

### Polar Chart

**Already has:** Inner radius, labels, start angle, segment stroke, base color, glass card, animations.

**Top missing features:**
1. **Legend** — Missing entirely. (Low)
2. **Sort Order** — By value or data order. (Low)
3. **Segment Padding / Gap** — Angular gap between segments. (Low)
4. **Gradient Fill Mode** — Radial/linear per segment. (Medium)
5. **End Angle / Arc Range** — Semicircle option. (Low)
6. **Tooltip with Value + %** — Show both. (Low)

### Chord Diagram

**Already has:** Arc padding, ribbon opacity (hover/dim), arc stroke, palette, glass card, animations.

**Top missing features:**
1. **Directed Flow (Arrows)** — Arrow heads on ribbons. (Medium)
2. **Gradient Ribbons** — Color transition source to destination. (Medium)
3. **Legend** — Missing entirely. (Low)
4. **Tooltip Templating** — Source, target, value, % of total. (Low)
5. **Sort Order** — By size, alpha, or input order. (Low)
6. **Min Arc Angle** — Prevent invisible small nodes. (Low)

### Network Graph

**Already has:** Force physics (strength, distance, charge), node styling (radius, labels, border), link styling (opacity, arrows, color, width), palette, glass card, animations.

**Top missing features:**
1. **Zoom & Pan** — Interactive navigation. (Medium)
2. **Node Drag** — Reposition nodes by dragging. (Medium)
3. **Node Size by Metric** — Scale by data measure. (Medium)
4. **Link Width by Weight** — Thickness by relationship strength. (Low)
5. **Collision Radius** — Prevent node overlap. (Low)
6. **Search/Highlight Node** — Find and focus a node. (Medium)

### KPI Card

**Already has:** Value (font/color/prefix/suffix/decimals), label (show/font/color/text), trend arrow (colors), sparkline (color/fill/width/divider), glass card, animations.

**Top missing features:**
1. **Conditional Color on Value** — Threshold-based coloring. (Medium)
2. **Target/Comparison Value** — Secondary value with variance. (Medium)
3. **Number Display Units** — Auto/K/M/B. (Low)
4. **Sparkline Type** — Line, area, bar, win/loss. (Medium)
5. **Trend Percentage Display** — "+12.5%" alongside arrow. (Low)
6. **Font Family Selection** — User-selectable fonts. (Low)

### Status Indicator

**Already has:** Shape (circle/square/diamond), size, layout (vertical/horizontal/grid), thresholds (good/warning/critical with direction), pulse animation, glass card.

**Top missing features:**
1. **Custom Threshold Values** — User-defined breakpoints. (Medium)
2. **4+ Status Levels** — Beyond 3-level system. (Medium)
3. **Value Display** — Show numeric value alongside indicator. (Low)
4. **Custom Status Text** — "On Track", "At Risk", etc. (Low)
5. **Tooltip with Details** — Value, ranges, label. (Low)

### Progress Bar Stack

**Already has:** Bar height, row gap, corner radius, show value/%, bar/track colors, glass card, animations.

**Top missing features:**
1. **Conditional Color Thresholds** — Auto-color by value range. (Medium)
2. **Target/Goal Marker** — Target line on each bar. (Medium)
3. **Gradient Fill** — Left-to-right gradient. (Low)
4. **Segment Labels Inside Bar** — Values inside filled portion. (Low)
5. **Min/Max Value Configuration** — User-defined scale. (Low)

### Waffle Chart

**Already has:** Grid (rows/columns/gap), cell shape (square/circle), cell stroke/radius, empty color, % display (font/color), glass card, animations.

**Top missing features:**
1. **Multi-Category Support** — Multiple colors per grid. (Medium)
2. **Icon/Pictogram Mode** — Replace squares with icons. (High)
3. **Fill Direction** — Rows, columns, radial, diagonal. (Low)
4. **Legend** — Missing entirely. (Low)
5. **Cell Size Auto-Fit** — Optimal rows/columns for space. (Medium)

### Stream Graph

**Already has:** Stack offset (wiggle/silhouette/expand/none), curve type (basis/monotone/cardinal), opacity, stroke, palette, X-axis, glass card, animations, legend.

**Top missing features:**
1. **Hover Highlight with Tooltip** — Highlight layer, show values. (Medium)
2. **Interactive Layer Isolation** — Click to solo a layer. (High)
3. **Y-Axis Display** — Currently only X-axis toggle. (Low)
4. **Sort Order** — Inside-out, by max, by appearance. (Low)
5. **Crosshair / Vertical Cursor** — Show all values at X position. (Medium)

### Health Bar

**Already has:** Bar width/radius/gap, show value/%, max value, fill mode (gradient/solid), Y-axis, low/mid/high colors, track color/opacity, category labels, glass card, animations, scroll.

**Top missing features:**
1. **Threshold Markers** — Reference lines at threshold values. (Medium)
2. **Segmented / Banded Zones** — Color-coded background bands. (Medium)
3. **Target Line** — Goal line across each bar. (Low)
4. **Value Position** — Above, inside, or below bar. (Low)
5. **Sort Order** — By value or data order. (Low)

### Bar Race

**Already has:** Top N, auto-play, play speed, bar styling (height/radius/opacity), label color, palette, value display (show/font), glass card, animations.

**Top missing features:**
1. **Timestamp / Period Display** — Large current-period label. (Low)
2. **Play/Pause/Scrub Controls** — Timeline scrubber. (Medium)
3. **Bar Image/Icon** — Flags, logos per bar. (High)
4. **Cumulative vs Non-Cumulative** — Toggle mode. (Low)
5. **Value Counter Animation** — Smooth count-up on values. (Medium)
6. **Rank Number Display** — #1, #2, #3 alongside bars. (Low)
7. **Loop / Repeat Mode** — Auto-restart at end. (Low)
