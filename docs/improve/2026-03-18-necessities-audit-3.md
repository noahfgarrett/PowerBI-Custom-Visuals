# Pass 5: Complete Element Audit -- Missing Necessities

Date: 2026-03-18

Every visible element checked against four questions:
1. Can the user change its **color**?
2. Can the user change its **size/thickness**?
3. Can the user **toggle it on/off**?
4. Can the user change its **position**?

Also checked: does each visual use `NumberFormattingCard` where it displays numbers?

---

## 1. Sankey Diagram

| Element | Color | Size/Thickness | Toggle | Position | Gaps |
|---------|-------|----------------|--------|----------|------|
| **Nodes** | Via color theme/series | Width, padding, minHeight, corner radius, opacity | No toggle (always shown) | Alignment (justify/left/right/center) | MISSING: no per-node color picker (relies on theme only) |
| **Node borders** | nodeBorderColor | nodeBorderWidth | Off when width=0 | -- | OK |
| **Node labels** | labelColor (all) + per-layer colors | fontSize | labelPosition=none hides | Position (inside/beside/above/below/none) | OK |
| **Links** | colorMode (source/target/gradient/custom) + customColor | curvature | No toggle | -- | MISSING: no link thickness/width control (thickness is data-driven only) |
| **Link labels** | linkLabelFontColor | linkLabelFontSize | showLinkLabels toggle | -- | OK |
| **Layer totals** | totalFontColor | totalFontSize | showLayerTotals toggle | layerTotalPosition (top/bottom) | OK |
| **Arrows** | -- | -- | -- | -- | NOT IMPLEMENTED -- no arrow feature exists |
| **Number formatting** | -- | -- | -- | -- | OK -- has NumberFormattingCard, used in visual.ts |

**Missing necessities:**
- (M1) **Node fill color** -- no per-node or global fill color override; users must rely on theme palette. Need at least a single "Node Color" fallback picker.
- (M2) **Segment opacity** -- segment opacity exists for nodes but NOT for the overall visual to control individual node opacity beyond the global.
- (M3) **Link labels font family** -- link labels have font size, color, weight but no font family picker.

---

## 2. Scatter Bubble

| Element | Color | Size/Thickness | Toggle | Position | Gaps |
|---------|-------|----------------|--------|----------|------|
| **Bubbles** | Color scale (categorical/sequential), series card | minRadius, maxRadius, opacity | No toggle (always shown) | -- | OK |
| **Bubble stroke** | bubbleStrokeColor | bubbleStrokeWidth | Off when width=0 | -- | OK |
| **X-Axis** | axisLabelColor, axisLineColor | axisLineWidth, axisLabelSize | showXAxis | -- | OK |
| **Y-Axis** | axisLabelColor, axisLineColor | axisLineWidth, axisLabelSize | showYAxis | -- | OK |
| **Grid lines** | gridLineColor | gridLineWidth, gridLineOpacity | showGridLines | -- | OK |
| **Quadrant lines** | lineColor | lineWidth | show toggle | -- | OK |
| **Quadrant labels** | labelFontColor | labelFontSize | showLabels | -- | OK |
| **Trendline** | lineColor | lineWidth | show toggle | -- | OK |
| **Legend** | legendFontColor | legendFontSize | showLegend | legendPosition | OK |
| **Number formatting** | -- | -- | -- | -- | OK -- has NumberFormattingCard, used in visual.ts |

**Missing necessities:**
- (M4) **X-Axis Min** -- Y-axis has min/max but X-axis has NO min/max controls. Users cannot set custom X-axis bounds.
- (M5) **Trendline font color** -- trendline equation/R-squared labels have font size but no font color control.

---

## 3. Slope Chart

| Element | Color | Size/Thickness | Toggle | Position | Gaps |
|---------|-------|----------------|--------|----------|------|
| **Lines** | Direction colors (positive/negative/neutral) or series | lineWidth | No toggle (always shown) | -- | OK |
| **Dots** | Inherits line color | dotRadius | No toggle | -- | MISSING: no toggle to hide dots |
| **Dot stroke** | dotStrokeColor | No stroke width control | -- | -- | MISSING: no dot stroke width |
| **Labels (category)** | Via DataLabelFormattingCard | Via DataLabelFormattingCard | Via DataLabelFormattingCard | DataLabelFormattingCard position | OK |
| **Column headers** | labelColor | Via axis font size | -- | Left/right labels customizable | OK |
| **Change labels** | fontColor | fontSize | show toggle | position (center/above/below) | OK |
| **Confidence intervals** | -- | -- | showConfidenceInterval toggle | -- | MISSING: no color/opacity controls for confidence intervals |
| **Area fill** | Inherits line color | fillOpacity | showArea toggle | -- | OK |
| **Number formatting** | -- | -- | -- | -- | OK -- has NumberFormattingCard, used in visual.ts |

**Missing necessities:**
- (M6) **Dot toggle** -- cannot hide dots without setting radius to 0 (no explicit toggle).
- (M7) **Dot stroke width** -- dot stroke color exists but no stroke width control.
- (M8) **Confidence interval color/opacity** -- can toggle on/off but cannot customize appearance.

---

## 4. Status Indicator

| Element | Color | Size/Thickness | Toggle | Position | Gaps |
|---------|-------|----------------|--------|----------|------|
| **Icons** | goodColor/warningColor/criticalColor | iconSize | Always shown | -- | OK |
| **Labels** | labelColor | size | No toggle | Layout (vertical/horizontal/grid) | MISSING: no label font family or font weight |
| **Sparklines** | Uses status color | -- | showSparkline toggle | -- | MISSING: no sparkline color override, no sparkline height/width control |
| **Status text** | Hardcoded fontWeight=500 | Hardcoded fontSize=size-2 | showStatusText toggle | -- | MISSING: no status text color, font size, font family, font weight controls |
| **Pulse effect** | Uses critical color | -- | enablePulse toggle | -- | OK |
| **Value display** | -- | valueFontSize | showValue toggle | -- | MISSING: no value font color, font family, font weight |
| **Number formatting** | -- | -- | -- | -- | OK -- has NumberFormattingCard, used in visual.ts |

**Missing necessities:**
- (M9) **Label font family** -- labelColor and size exist but no font family or font weight picker.
- (M10) **Status text formatting** -- toggle exists but no color, font size, font family, or font weight controls (all hardcoded).
- (M11) **Value font color** -- value font size exists but no color, font family, or font weight.
- (M12) **Sparkline customization** -- no color override (inherits status color), no height/width controls.

---

## 5. Stream Graph

| Element | Color | Size/Thickness | Toggle | Position | Gaps |
|---------|-------|----------------|--------|----------|------|
| **Layers (streams)** | Series card, color theme | streamOpacity | No toggle (always shown) | -- | OK |
| **Layer stroke** | streamStrokeColor | streamStrokeWidth | Off when width=0 | -- | OK |
| **X-Axis** | axisLabelColor, axisLineColor | axisLabelSize, axisLineWidth | showXAxis | -- | OK |
| **Y-Axis** | axisLabelColor, axisLineColor | axisLabelSize, axisLineWidth | showYAxis | -- | OK |
| **Value labels** | Via DataLabelFormattingCard | Via DataLabelFormattingCard | showDataLabels | -- | OK |
| **Crosshair** | crosshairLineColor | crosshairLineWidth | showCrosshair | -- | OK |
| **Legend** | legendFontColor | legendFontSize | showLegend | legendPosition | OK |
| **Number formatting** | -- | -- | -- | -- | **MISSING** -- no NumberFormattingCard in settings |

**Missing necessities:**
- (M13) **NumberFormattingCard** -- stream-graph has no NumberFormattingCard at all. Values displayed in tooltips, hover labels, and crosshair values are not formatted through the card. This is a significant gap since all other visuals in this batch have one.

---

## 6. Sunburst Chart

| Element | Color | Size/Thickness | Toggle | Position | Gaps |
|---------|-------|----------------|--------|----------|------|
| **Segments** | Color theme, chart palette | -- | No toggle (always shown) | -- | MISSING: no segment opacity control |
| **Segment stroke** | segmentStrokeColor | segmentStrokeWidth | Off when width=0 | -- | OK |
| **Segment labels** | Via DataLabelFormattingCard | Via DataLabelFormattingCard | showLabels + labelMinAngle | -- | MISSING: no label font family in Labels & Percentages card (relies on DataLabelFormattingCard which does have it) |
| **Center content** | fontColor | fontSize | show toggle | -- | OK |
| **Center label** | Inherits fontColor | labelFontSize | showLabel | -- | OK |
| **Breadcrumb** | breadcrumbColor | breadcrumbFontSize | showBreadcrumb | -- | MISSING: no breadcrumb font family or font weight |
| **Drill arrows** | -- | -- | enabled toggle | -- | OK (inherits breadcrumb styling) |
| **Number formatting** | -- | -- | -- | -- | OK -- has NumberFormattingCard, used in visual.ts |

**Missing necessities:**
- (M14) **Segment opacity** -- no opacity control for segments. Cannot make segments semi-transparent.
- (M15) **Breadcrumb font family/weight** -- breadcrumb has color and font size but no font family or font weight.

---

## 7. Timeline / Milestone

| Element | Color | Size/Thickness | Toggle | Position | Gaps |
|---------|-------|----------------|--------|----------|------|
| **Markers** | colorByCategory (uses theme) | size | No toggle (always shown) | -- | MISSING: no explicit marker color picker for non-category mode |
| **Marker stroke** | markerStrokeColor | No stroke width control | -- | -- | MISSING: no marker stroke width |
| **Spine** | lineColor | lineWidth | No toggle (always shown) | orientation | OK |
| **Connectors** | Inherits lineColor | Hardcoded width=1 | showConnectors | -- | MISSING: no separate connector color or connector width controls |
| **Labels** | Inherits axis label formatting | axisLabelSize | -- | layout (alternating/top/bottom/staggered) | OK |
| **Dates** | Inherits label formatting | -- | showDates | -- | OK |
| **Duration bars** | Inherits marker color | durationBarHeight, durationBarOpacity | showDurationBars | -- | MISSING: no explicit duration bar color |
| **Swimlanes** | labelColor | -- | showSwimlanes | -- | MISSING: no swimlane divider color or width |
| **Number formatting** | -- | -- | -- | -- | **MISSING** -- no NumberFormattingCard in settings. Timeline is primarily date-based, but if any measure values are shown, they cannot be formatted. |

**Missing necessities:**
- (M16) **Marker stroke width** -- marker stroke color exists but no stroke width control.
- (M17) **Connector customization** -- connectors inherit spine color and have hardcoded width=1. Need separate connector color and width.
- (M18) **Duration bar color** -- opacity and height exist but no explicit color (inherits from marker, which may be undesirable).
- (M19) **Marker fill color** -- when colorByCategory is off, there is no fallback color picker for markers.
- (M20) **Label font family** -- timeline labels use axis font family, which works, but there is no dedicated label font color control in the timeline card itself (relies on axis card).

---

## 8. Treemap Pro

| Element | Color | Size/Thickness | Toggle | Position | Gaps |
|---------|-------|----------------|--------|----------|------|
| **Tiles** | Color theme, heat coloring, chart palette | tilePadding | No toggle (always shown) | -- | MISSING: no tile opacity control, no tile corner radius |
| **Tile stroke** | tileStrokeColor | tileStrokeWidth | Off when width=0 | -- | OK |
| **Labels** | fontColor | fontSize | showLabels | -- | OK |
| **Values** | Inherits fontColor | Inherits fontSize | showValues | -- | MISSING: no separate value font size or color |
| **Breadcrumb** | breadcrumbColor | breadcrumbFontSize | showBreadcrumb | -- | OK (has font family and weight too) |
| **Drill** | -- | -- | enabled toggle | -- | OK |
| **Percentages** | -- | -- | showPercentage | -- | OK |
| **Number formatting** | -- | -- | -- | -- | OK -- has NumberFormattingCard, used in visual.ts |

**Missing necessities:**
- (M21) **Tile opacity** -- no opacity control for tiles. Useful for layered/overlapping views.
- (M22) **Tile corner radius** -- no corner radius for individual tiles (only card border radius exists).
- (M23) **Separate value font size/color** -- values and labels share the same font settings. Users cannot make values smaller or a different color than labels.

---

## 9. Waffle Chart

| Element | Color | Size/Thickness | Toggle | Position | Gaps |
|---------|-------|----------------|--------|----------|------|
| **Filled cells** | fillColor | Cell size (via rows/cols + autoFit) | No toggle (always shown) | fillDirection | OK |
| **Empty cells** | emptyColor | Same as filled cells | No toggle (always shown) | -- | OK |
| **Cell stroke** | cellStrokeColor | No stroke width control | -- | -- | MISSING: no cell stroke width |
| **Cell shape** | -- | cellCornerRadius | shape (square/circle) | -- | OK |
| **Percentage text** | fontColor | fontSize | show toggle | -- | MISSING: no position control (above/below/overlay) |
| **Icon/Pictogram** | Inherits fillColor | iconSize | enabled toggle | -- | OK |
| **Grid** | -- | rows, cols, gap | -- | -- | OK |
| **Number formatting** | -- | -- | -- | -- | **MISSING** -- no NumberFormattingCard in settings. The waffle displays raw values (value/max) in the percentage text but has no way to format them. |

**Missing necessities:**
- (M24) **Cell stroke width** -- cellStrokeColor exists but no width control. Users cannot adjust border thickness.
- (M25) **NumberFormattingCard** -- waffle-chart has no NumberFormattingCard. When displaying values (not just percentage), they cannot be formatted with display units, decimal places, prefix, or suffix.
- (M26) **Percentage text position** -- no option to place percentage text above, below, center, or as overlay on the grid.
- (M27) **Show raw value option** -- the percentage text only shows "X%" but users cannot display the raw value (e.g., "75 / 100") without the percentage.

---

## 10. Bar Chart Pro

### Mode-by-Mode Element Audit

#### Grouped Mode
| Element | Color | Size/Thickness | Toggle | Position | Gaps |
|---------|-------|----------------|--------|----------|------|
| **Bars** | Series card, color theme | cornerRadius, barSpacing, barOpacity | No toggle (always shown) | -- | OK |
| **Bar borders** | barBorderColor | barBorderWidth | Off when width=0 | -- | OK |
| **Data labels** | Via DataLabelFormattingCard | Via DataLabelFormattingCard | showDataLabels (none/above/inside) | Position | OK |
| **Axes** | Full axis card | Full axis card | showX/showY | -- | OK |
| **Legend** | Full legend card | Full legend card | showLegend | Position | OK |

#### Stacked Mode
- Same as Grouped. OK.

#### 100% Stacked Mode
- Same as Grouped. OK.

#### Combo Mode
| Element | Color | Size/Thickness | Toggle | Position | Gaps |
|---------|-------|----------------|--------|----------|------|
| **Bars** | Same as grouped | Same as grouped | -- | -- | OK |
| **Line** | Per-series color via SeriesFormattingCard | Per-series lineWidth via SeriesFormattingCard | -- | -- | MISSING: no global line width default in LineSettings card |
| **Line dots** | Inherits line color | lineDotRadius | showDots | -- | OK |
| **Line data labels** | -- | -- | showLineDataLabels | -- | MISSING: no line data label font size/color/weight controls |
| **Line gradient fill** | Inherits line color | lineGradientOpacity | lineGradientFill toggle | -- | OK |
| **Secondary Y-axis** | Inherits axis formatting | -- | showSecondaryYAxis | -- | OK |

#### Horizontal Mode
- Same elements as Grouped, rotated. OK.

#### Diverging Mode
| Element | Color | Size/Thickness | Toggle | Position | Gaps |
|---------|-------|----------------|--------|----------|------|
| **Bars** | Series card | Same as grouped | -- | -- | MISSING: no baseline value control (always 0) |
| **Center line** | -- | -- | -- | -- | MISSING: no center/baseline line color or style controls |

#### Waterfall Mode
| Element | Color | Size/Thickness | Toggle | Position | Gaps |
|---------|-------|----------------|--------|----------|------|
| **Positive bars** | positiveColor | Same as grouped | -- | -- | OK |
| **Negative bars** | negativeColor | Same as grouped | -- | -- | OK |
| **Total bar** | totalColor | Same as grouped | -- | -- | OK |
| **Connectors** | connectorColor | connectorWidth | No toggle (always shown) | -- | MISSING: no connector toggle, no connector line style (solid/dashed) |

#### Lollipop Variant (any mode)
| Element | Color | Size/Thickness | Toggle | Position | Gaps |
|---------|-------|----------------|--------|----------|------|
| **Dot** | Inherits bar color | lollipopDotRadius | barStyle=lollipop | -- | MISSING: no separate lollipop dot color |
| **Stem** | Inherits bar color | lollipopStemWidth | -- | -- | MISSING: no separate lollipop stem color |

#### Cross-Mode Elements
| Element | Color | Size/Thickness | Toggle | Position | Gaps |
|---------|-------|----------------|--------|----------|------|
| **Target line** | color | -- | show toggle | -- | MISSING: no target line width or line style beyond dashed/solid |
| **Pareto line** | lineColor | -- | show toggle + showThreshold | -- | MISSING: no Pareto line width control |
| **Benchmark band** | bandColor | bandOpacity | show toggle | -- | OK |
| **Variance indicators** | positiveColor, negativeColor | -- | show toggle | -- | MISSING: no variance font size control |
| **Number formatting** | -- | -- | -- | -- | OK -- has NumberFormattingCard + LineNumberFormattingCard, both used extensively |

**Missing necessities:**
- (M28) **Combo line width default** -- LineSettings card has no global line width property. Line width only comes from per-series formatting.
- (M29) **Line data label formatting** -- showLineDataLabels toggle exists but no font size, color, or weight controls for line data labels.
- (M30) **Diverging baseline value** -- no control to set the center/baseline value (always 0). Users with non-zero baselines cannot use this mode properly.
- (M31) **Diverging center line styling** -- no color/width/style for the center baseline line.
- (M32) **Waterfall connector toggle** -- connectors always shown, no way to hide them.
- (M33) **Waterfall connector line style** -- only color and width; no solid/dashed/dotted option.
- (M34) **Pareto line width** -- Pareto line has color and show/hide but no line width control.
- (M35) **Target line width** -- target line has color and style (solid/dashed) but no width control.
- (M36) **Lollipop dot/stem color** -- both inherit bar color. Users cannot set separate colors for the dot and stem.

---

## Number Formatting Card Summary

| Visual | Has NumberFormattingCard | Used in visual.ts | Status |
|--------|------------------------|-------------------|--------|
| Sankey Diagram | Yes | Yes | OK |
| Scatter Bubble | Yes | Yes | OK |
| Slope Chart | Yes | Yes | OK |
| Status Indicator | Yes | Yes | OK |
| Stream Graph | **NO** | **NO** | **GAP** |
| Sunburst Chart | Yes | Yes | OK |
| Timeline/Milestone | **NO** | **NO** | **GAP** (lower priority -- date-focused) |
| Treemap Pro | Yes | Yes | OK |
| Waffle Chart | **NO** | **NO** | **GAP** |
| Bar Chart Pro | Yes (x2) | Yes | OK |

---

## Priority Summary (Top Gaps)

### HIGH -- Core usability gaps
| ID | Visual | Missing Feature | Impact |
|----|--------|----------------|--------|
| M13 | Stream Graph | NumberFormattingCard | Values in tooltips/crosshair unformatted |
| M25 | Waffle Chart | NumberFormattingCard | Raw values cannot be formatted |
| M10 | Status Indicator | Status text formatting controls | Hardcoded style cannot be customized |
| M11 | Status Indicator | Value font color/family/weight | Incomplete text customization |
| M30 | Bar Chart Pro | Diverging baseline value | Cannot use non-zero baselines |
| M29 | Bar Chart Pro | Line data label formatting | Toggle exists but no style controls |

### MEDIUM -- Expected customization missing
| ID | Visual | Missing Feature | Impact |
|----|--------|----------------|--------|
| M3 | Sankey | Link labels font family | Inconsistent font control |
| M6 | Slope Chart | Dot toggle | Must set radius=0 as workaround |
| M7 | Slope Chart | Dot stroke width | Stroke color without width |
| M8 | Slope Chart | Confidence interval styling | Feature exists but uncustomizable |
| M9 | Status Indicator | Label font family/weight | Incomplete text stack |
| M14 | Sunburst | Segment opacity | Cannot make semi-transparent |
| M15 | Sunburst | Breadcrumb font family/weight | Inconsistent with treemap which has it |
| M16 | Timeline | Marker stroke width | Stroke color without width |
| M17 | Timeline | Connector color/width | Hardcoded, inherits spine |
| M21 | Treemap | Tile opacity | No transparency control |
| M23 | Treemap | Separate value font size/color | Labels and values forced identical |
| M24 | Waffle | Cell stroke width | Color without width |
| M28 | Bar Chart Pro | Combo line width default | Per-series only, no global default |
| M34 | Bar Chart Pro | Pareto line width | No thickness control |
| M35 | Bar Chart Pro | Target line width | No thickness control |

### LOW -- Nice to have
| ID | Visual | Missing Feature | Impact |
|----|--------|----------------|--------|
| M1 | Sankey | Node fill color override | Theme-only is often sufficient |
| M4 | Scatter | X-axis min/max | Y-axis has it, X does not |
| M5 | Scatter | Trendline label font color | Minor styling gap |
| M12 | Status Indicator | Sparkline customization | Sparkline is secondary feature |
| M18 | Timeline | Duration bar color | Inheriting marker color usually OK |
| M19 | Timeline | Marker fill color (non-category) | Edge case |
| M22 | Treemap | Tile corner radius | Purely cosmetic |
| M26 | Waffle | Percentage text position | Single position usually fine |
| M27 | Waffle | Raw value display option | Percentage mode covers most cases |
| M31 | Bar Chart Pro | Diverging center line styling | Cosmetic |
| M32 | Bar Chart Pro | Waterfall connector toggle | Usually wanted on |
| M33 | Bar Chart Pro | Waterfall connector line style | Cosmetic |
| M36 | Bar Chart Pro | Lollipop dot/stem color | Inheriting bar color usually OK |
