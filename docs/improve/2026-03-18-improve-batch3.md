# Improvement Report -- Batch 3

**Date:** 2026-03-18
**Visuals:** health-bar, heatmap-calendar, morphing-area-chart, network-graph, polar-chart

---

## Deliverable 1: Luxury Feature Additions

---

### 1. Health Bar

#### 1A. Glow Pulse on Threshold Breach

**Description:** When a bar's value falls below a configurable "danger" threshold (e.g., 25%), apply a soft pulsing glow animation around the bar fill using an SVG filter with `feGaussianBlur` and `feColorMatrix`. The pulse fades in and out on a 2-second CSS animation loop, drawing immediate attention to critical values without requiring the user to scan every bar.

**Files to modify:**
- `packages/health-bar/src/visual.ts` -- add SVG filter definition, apply filter + CSS animation class to bars below threshold
- `packages/health-bar/src/settings.ts` -- add `glowOnDanger` toggle and `dangerThreshold` NumUpDown to HealthBarSettingsCard
- `packages/health-bar/capabilities.json` -- register new properties

**Effort:** Medium

#### 1B. Hover Brightness Shift with Drop Shadow

**Description:** On mouseenter, smoothly brighten the fill bar by 15% and add a colored drop shadow (matching the bar's current gradient color) via a CSS `filter: brightness(1.15) drop-shadow(...)` transition. On mouseleave, ease back to normal over 200ms. This gives each bar a "lifted" tactile feel on hover without changing the data representation.

**Files to modify:**
- `packages/health-bar/src/visual.ts` -- add mouseenter/mouseleave event listeners to each fill rect, apply inline style transitions

**Effort:** Small

#### 1C. Sparkline-in-Tooltip (Trend Context)

**Description:** When hovering a bar, render a tiny inline SVG sparkline inside a custom HTML tooltip showing that category's value history over time (if temporal data is available). If the data has no time dimension, show a mini comparison bar against the average. This gives users instant trend context without needing a separate chart.

**Files to modify:**
- `packages/health-bar/src/visual.ts` -- implement custom tooltip with embedded SVG sparkline, use `host.tooltipService` for positioning
- `packages/health-bar/capabilities.json` -- optionally add a "trend" data role for historical values

**Effort:** Large

#### 1D. Auto-Abbreviate Long Category Labels

**Description:** When category labels would overlap or be truncated with ellipsis, automatically apply smart abbreviation rules: drop common suffixes ("Department" -> "Dept"), use first-word + initials for multi-word labels ("Customer Service" -> "Cust. Svc"), or rotate labels to 45 degrees. The truncation logic already exists but only uses character-level truncation -- this adds semantic awareness.

**Files to modify:**
- `packages/health-bar/src/visual.ts` -- enhance the category label rendering block (around line 564-587) with smart abbreviation logic
- `packages/core/src/` -- optionally extract as a shared `smartTruncate()` utility

**Effort:** Medium

#### 1E. Peak/Valley Callout Markers

**Description:** Automatically identify the highest and lowest bars in the chart and render small callout badges above them ("Peak: 95%" / "Low: 12%") with a subtle connector line. These markers update dynamically as data changes, turning the health bar into a storytelling visual that surfaces key takeaways at a glance.

**Files to modify:**
- `packages/health-bar/src/visual.ts` -- compute min/max from items array, render callout SVG text + connector lines
- `packages/health-bar/src/settings.ts` -- add `showPeakValley` toggle to HealthBarSettingsCard
- `packages/health-bar/capabilities.json` -- register new property

**Effort:** Medium

---

### 2. Heatmap Calendar

#### 2A. Cell Hover Magnification with Value Tooltip

**Description:** On mouseenter, scale the hovered cell to 1.8x its normal size with a smooth CSS transform transition (150ms ease-out), lifting it above adjacent cells via `z-index`. Display a rich tooltip showing the date, exact value, and delta from the previous day. On mouseleave, spring back to 1.0x. This makes individual cells easy to inspect even at small cell sizes.

**Files to modify:**
- `packages/heatmap-calendar/src/visual.ts` -- add mouseenter/mouseleave handlers to each `.heatmap-cell`, implement tooltip using `host.tooltipService`
- `packages/heatmap-calendar/style/visual.less` -- add CSS transition rules for `.heatmap-cell:hover`

**Effort:** Small

#### 2B. Auto-Highlight Outlier Days

**Description:** Compute the interquartile range (IQR) of all cell values and automatically apply a distinct outline or badge to cells that fall outside 1.5x IQR (outliers). Users can toggle this on/off and choose the highlight style (outline, dot marker, or glow). This surfaces anomalous days without manual threshold configuration.

**Files to modify:**
- `packages/heatmap-calendar/src/visual.ts` -- compute IQR after data extraction, apply outlier styling during cell rendering
- `packages/heatmap-calendar/src/settings.ts` -- add new `CalendarOutlierSettings` card with toggle, style dropdown, sensitivity slider
- `packages/heatmap-calendar/capabilities.json` -- register new properties

**Effort:** Medium

#### 2C. Smooth Month-to-Month Transition Animation

**Description:** When data updates (e.g., slicer change adds/removes months), animate cells using a coordinated ripple: outgoing cells fade out with a slight scale-down, then incoming cells ripple in from top-left. Currently the entire grid is rebuilt from scratch -- this adds a morphing transition that preserves spatial context.

**Files to modify:**
- `packages/heatmap-calendar/src/visual.ts` -- implement diff-based rendering that compares old and new date keys, animate only changed cells

**Effort:** Large

#### 2D. Today Marker

**Description:** Automatically highlight the current date's cell with a distinctive ring (configurable color, default: accent blue) and optionally display a small "Today" label beneath the cell. This anchors the user temporally within the calendar, which is especially valuable for dashboards showing rolling date windows.

**Files to modify:**
- `packages/heatmap-calendar/src/visual.ts` -- after cell rendering, find today's date key and apply special styling
- `packages/heatmap-calendar/src/settings.ts` -- add `showTodayMarker` toggle and `todayMarkerColor` color picker to CalendarSettings
- `packages/heatmap-calendar/capabilities.json` -- register new properties

**Effort:** Small

#### 2E. Value-in-Cell with Auto-Hide at Small Sizes

**Description:** Display the formatted value directly inside each cell when cell size is large enough (>= 24px). Below that threshold, automatically hide the text to avoid visual clutter. The text uses a contrast-aware color (white on dark cells, dark on light cells) computed from the cell's background. This eliminates the need to hover for basic value reading.

**Files to modify:**
- `packages/heatmap-calendar/src/visual.ts` -- during cell rendering, conditionally append a `<span>` with the formatted value; compute text color using luminance formula
- `packages/heatmap-calendar/style/visual.less` -- add styles for `.heatmap-cell-value`

**Effort:** Small

---

### 3. Morphing Area Chart

#### 3A. Crosshair Snap-to-Nearest with Vertical Highlight Band

**Description:** Enhance the existing crosshair to snap to the nearest data point on the x-axis (instead of free-floating), and render a translucent vertical band behind the snapped column to visually separate the highlighted region. Show all series values in a multi-row tooltip anchored to the crosshair position. This makes the crosshair precise and informative for dense time-series data.

**Files to modify:**
- `packages/morphing-area-chart/src/visual.ts` -- enhance the crosshair attachment logic to add snap-to-nearest behavior and vertical band rendering
- `packages/morphing-area-chart/src/settings.ts` -- add `snapToNearest` toggle and `highlightBandColor` picker to a crosshair sub-group
- `packages/morphing-area-chart/capabilities.json` -- register new properties

**Effort:** Medium

#### 3B. Gradient Area with Inner Shadow

**Description:** Add an optional inner shadow effect at the top edge of the area fill, creating a sense of depth. Implement as an SVG `feFlood` + `feComposite` + `feGaussianBlur` filter applied to the area path. Combined with the existing gradient fill, this gives the area a "frosted glass" premium appearance. The shadow color auto-derives from the series color at 40% opacity.

**Files to modify:**
- `packages/morphing-area-chart/src/visual.ts` -- add SVG filter definition to defs, conditionally apply to area paths
- `packages/morphing-area-chart/src/settings.ts` -- add `innerShadow` toggle to AreaSettingsCard
- `packages/morphing-area-chart/capabilities.json` -- register new property

**Effort:** Medium

#### 3C. Animated Data Point Pulse on Peak Values

**Description:** Automatically detect local peaks (values higher than both neighbors) and render a subtle pulsing ring animation around those data points. The ring uses the series color at 30% opacity and scales between 1.0x and 1.4x on a 2-second loop. Users can toggle this on/off. This draws attention to peaks without annotations.

**Files to modify:**
- `packages/morphing-area-chart/src/visual.ts` -- after dot rendering, identify peaks and apply CSS animation class
- `packages/morphing-area-chart/src/settings.ts` -- add `highlightPeaks` toggle to LineSettingsCard
- `packages/morphing-area-chart/capabilities.json` -- register new property

**Effort:** Small

#### 3D. Smooth Series Entry/Exit Transitions

**Description:** When a series is added or removed (e.g., dragging a new measure into the field well), animate the new series path by drawing it from left to right (using `stroke-dashoffset` animation), while the area fill fades in from 0 opacity. Removed series paths shrink to the baseline and fade out. Currently, the entire chart rebuilds -- this adds continuity.

**Files to modify:**
- `packages/morphing-area-chart/src/visual.ts` -- implement series-level diff detection and coordinated enter/exit animations

**Effort:** Large

#### 3E. Auto-Rotate X-Axis Labels When Cramped

**Description:** Detect when x-axis labels overlap (by measuring text bounding boxes after render) and automatically rotate them to 45 degrees with an adjusted bottom margin. If still cramped at 45 degrees, switch to 90 degrees. Includes a smooth CSS transition when the rotation changes between updates. This eliminates the manual "X-Label Rotation" setting for most use cases.

**Files to modify:**
- `packages/morphing-area-chart/src/visual.ts` -- add post-render overlap detection after axis rendering, dynamically apply rotation transform
- `packages/core/src/` -- optionally extract as shared `autoRotateLabels()` utility

**Effort:** Medium

---

### 4. Network Graph

#### 4A. Node Hover Glow with Neighbor Fade

**Description:** On mouseenter, apply a radial glow effect around the hovered node using an SVG `feGaussianBlur` filter with the node's color. Simultaneously, dim non-neighbor nodes to 15% opacity (currently 20%) and non-connected links to 8% (currently also handled). The glow makes the hovered node "pop" dramatically, creating a premium interaction feel beyond the current simple opacity toggle.

**Files to modify:**
- `packages/network-graph/src/visual.ts` -- add SVG filter definition, apply on mouseenter, enhance the existing neighbor highlight logic
- `packages/network-graph/style/visual.less` -- add transition rules for the glow filter

**Effort:** Small

#### 4B. Animated Link Particle Flow

**Description:** For directed graphs (when arrows are enabled), render small animated dots that travel along link paths from source to target, indicating data flow direction. Particle speed scales with link weight. Particles use the link color at 60% opacity and are 3px circles animated along the link path using `getPointAtLength()`. This transforms the static graph into a living, breathing visualization.

**Files to modify:**
- `packages/network-graph/src/visual.ts` -- after link rendering, create particle circles and animate them along paths using requestAnimationFrame
- `packages/network-graph/src/settings.ts` -- add `showParticles` toggle and `particleSpeed` NumUpDown to LinkSettings
- `packages/network-graph/capabilities.json` -- register new properties

**Effort:** Large

#### 4C. Spring Physics on Node Drag Release

**Description:** When a dragged node is released, instead of immediately unfixing its position (causing an abrupt snap), apply a spring-physics easing that gradually releases the node back into the simulation. The node oscillates briefly (2-3 bounces over 400ms) before settling into its natural force-directed position. This adds a tactile, satisfying feel to drag interactions.

**Files to modify:**
- `packages/network-graph/src/visual.ts` -- modify the drag `end` handler to use a spring interpolation before setting `fx`/`fy` to null

**Effort:** Medium

#### 4D. Double-Click Expand/Collapse (Focus Mode)

**Description:** Double-clicking a node enters "focus mode": the graph smoothly zooms to center on that node, dims all nodes beyond 2-hop distance, and expands the immediate neighborhood with increased link distance for clarity. Double-clicking the background exits focus mode with a smooth zoom-out transition. This enables drill-down exploration of dense graphs.

**Files to modify:**
- `packages/network-graph/src/visual.ts` -- add dblclick handler on nodes, implement BFS for N-hop distance, use d3-zoom for animated zoom transition
- `packages/network-graph/src/settings.ts` -- add `enableFocusMode` toggle to NetworkInteractionSettings
- `packages/network-graph/capabilities.json` -- register new property

**Effort:** Medium

#### 4E. Link Tooltip with Weight and Connection Stats

**Description:** On hover over a link, display a rich tooltip showing: source name, target name, link weight, and (if clustering is enabled) whether the link is inter-cluster or intra-cluster. The link itself brightens to full opacity and thickens by 2px during hover. Currently links have no hover interaction -- this surfaces link-level data that is otherwise hidden.

**Files to modify:**
- `packages/network-graph/src/visual.ts` -- add mouseenter/mouseleave handlers to link elements, use `host.tooltipService` for tooltip display

**Effort:** Small

---

### 5. Polar Chart

#### 5A. Petal Hover Inner Glow with Value Callout

**Description:** On mouseenter, apply an inner glow effect to the hovered petal using an SVG filter (inset shadow simulation via `feFlood` + `feComposite`) and simultaneously display a floating value callout at the petal's centroid with the formatted value, percentage of total, and category name. The existing springScale bloom is retained -- this layers additional polish on top.

**Files to modify:**
- `packages/polar-chart/src/visual.ts` -- add SVG filter definition, apply on hover alongside existing springScale, render callout text element
- `packages/polar-chart/style/visual.less` -- add transition styles for the filter

**Effort:** Medium

#### 5B. Center Summary Statistic

**Description:** When innerRadius > 0 (donut mode), render a summary statistic in the center hole: total, average, or a custom KPI value. The number formats using the existing number formatting settings and includes a small label underneath (e.g., "Total" or "Avg"). The text auto-sizes to fit the inner circle. This turns empty center space into valuable data real estate.

**Files to modify:**
- `packages/polar-chart/src/visual.ts` -- after petal rendering, compute and render center text group
- `packages/polar-chart/src/settings.ts` -- add new `PolarCenterSettings` card with `show` toggle, `statType` dropdown (total/average/max/min), `customLabel` text
- `packages/polar-chart/capabilities.json` -- register new properties

**Effort:** Medium

#### 5C. Percentage Rings (Concentric Progress)

**Description:** Add an optional concentric ring behind each petal showing the "100% reference" outline -- a thin, dashed ring at the maximum outer radius for that petal's angle. This gives viewers an immediate sense of how close each category is to the maximum value, similar to how health bars show the track. The ring color is the petal color at 15% opacity.

**Files to modify:**
- `packages/polar-chart/src/visual.ts` -- before petal rendering, draw reference arcs at maxOuterRadius for each segment
- `packages/polar-chart/src/settings.ts` -- add `showReferenceRings` toggle to PolarDisplaySettings
- `packages/polar-chart/capabilities.json` -- register new property

**Effort:** Small

#### 5D. Smooth Petal Morphing on Data Change

**Description:** When data updates (values change, categories added/removed), morph existing petals to their new radii using smooth d3 arc interpolation instead of rebuilding the entire SVG. New petals expand from zero radius; removed petals collapse to zero. This creates a fluid, "living" visualization that maintains visual continuity during slicer interactions.

**Files to modify:**
- `packages/polar-chart/src/visual.ts` -- implement data-join pattern with enter/update/exit transitions using d3's `attrTween` for arc paths

**Effort:** Large

#### 5E. Ripple Click Effect

**Description:** When a petal is clicked (for selection), render a brief ripple animation emanating from the click point: a circle that expands from 0 to the petal's outer radius at 0% opacity over 300ms. The ripple uses the petal's color at 30% opacity. This provides satisfying tactile feedback confirming the selection action, similar to Material Design ripple effects.

**Files to modify:**
- `packages/polar-chart/src/visual.ts` -- in the click handler, create a temporary SVG circle element with expanding radius animation, remove after completion

**Effort:** Small

---

## Deliverable 2: Settings Organization Audit

---

### 1. Health Bar -- Settings Audit

**Current card count:** 21 top-level cards
**Current card order:** Health Bar Settings, Colors, Target, Card Style, Animation, Category Labels, Axis Formatting, Data Labels, Chart Title, Scroll, Sort Order, Reference Line, Trend Line, Conditional Formatting, Annotations, Accessibility, Zone Background, Scale, Value Position, Number Format, Date Filter

#### Issues Found

1. **Too many top-level cards (21).** Users must scroll through a very long flat list. Several cards have only 1 setting (Scale has only `minValue`, Value Position has only `position`) -- these should be merged into a parent card.

2. **Scattered bar appearance settings.** Bar shape (width, corner radius, gap) is in "Health Bar Settings" but bar fill color logic (gradient/solid, low/mid/high) is in a separate "Colors" card, and fill mode (gradient vs solid) is back in "Health Bar Settings". These are conceptually one group.

3. **Scale settings split across two cards.** `maxValue` lives in "Health Bar Settings" while `minValue` lives in a separate "Scale" card. These should be together.

4. **Value display settings scattered across three cards.** Whether to show values is in "Health Bar Settings" (`showValue`, `showPercent`), where to position them is in "Value Position", and how they look is in "Data Labels". This forces users to visit 3 separate cards to configure value labels.

5. **Illogical ordering.** Zone Background and Scale are buried at positions 17-18, after Annotations and Accessibility. Scale is fundamental and should be near the top with core bar settings.

6. **Unclear card name.** "Health Bar Settings" is too generic -- it's the catch-all for bar width, gap, fill mode, max value, show Y-axis, etc. These should be split into focused groups.

#### Proposed Reorganization (11 cards)

| # | Card Name | Settings |
|---|-----------|----------|
| 1 | **Bar Shape** | Bar Width, Bar Corner Radius, Gap Between Bars, Fill Mode |
| 2 | **Scale & Range** | Min Value, Max Value, Show Y-Axis Ticks |
| 3 | **Colors** | Low Color, Mid Color, High Color, Track Color, Track Opacity |
| 4 | **Value Labels** | Show Value, Show % Symbol, Value Position, (inherits Data Label font/size/color) |
| 5 | **Category Labels** | Show, Font Size, Font Color, Font Family, Font Weight |
| 6 | **Target** | Show, Color, Line Width, Marker Style |
| 7 | **Chart Title** | (shared TitleFormattingCard -- no change) |
| 8 | **Card Style** | Card Style Mode, Background Color, Background Opacity, Border Radius |
| 9 | **Animation** | Enable, Duration, Stagger Delay |
| 10 | **Analytics** | _Sub-groups:_ Reference Line, Trend Line, Conditional Formatting, Zone Background, Annotations |
| 11 | **Advanced** | _Sub-groups:_ Sort Order, Scroll, Number Format, Date Filter, Accessibility |

---

### 2. Heatmap Calendar -- Settings Audit

**Current card count:** 14 top-level cards
**Current card order:** Calendar, Colors, Card Style, Animation, Granularity, Streak Highlighting, Color Scale, Data Labels, Chart Title, Axis Formatting, Conditional Formatting, Accessibility, Number Format, Date Filter

#### Issues Found

1. **Color settings split across three cards.** "Colors" has low/high/mid colors + legend, "Color Scale" has continuous/discrete mode + bins, and "Conditional Formatting" overrides everything. A user trying to set up the color scheme must visit all three.

2. **Granularity is a single-setting card.** "Granularity" contains only one dropdown. It should be part of the main Calendar card since it fundamentally changes how the calendar renders.

3. **Week Start buried in the wrong card.** "Week Start Day" is in "Color Scale" -- it has nothing to do with color scaling. It's a calendar layout setting.

4. **Calendar card is a grab bag.** It mixes layout settings (cell size, cell gap) with visual styling (stroke color, stroke width, corner radius) and label toggles (show month labels, show day labels) all in one card with 8 slices.

5. **Axis Formatting misleading for a heatmap.** Most axis formatting properties are hidden at runtime, but the card still appears. The remaining useful properties (label color, label size) could be merged into the Calendar card's label sub-group.

#### Proposed Reorganization (9 cards)

| # | Card Name | Settings |
|---|-----------|----------|
| 1 | **Calendar Layout** | Cell Size, Cell Gap, Granularity, Week Start Day, Show Month Labels, Show Day Labels |
| 2 | **Cell Style** | Cell Corner Radius, Cell Stroke Color, Cell Stroke Width |
| 3 | **Color Scale** | Low Color, High Color, Use 3-Stop Gradient, Mid Color, Mid Point, Color Mode, Discrete Bins, Empty Cell Color |
| 4 | **Legend** | Show Color Legend, Legend Position |
| 5 | **Labels** | Label Color, Label Font Size (from axis card), Data Labels toggle + font settings |
| 6 | **Chart Title** | (shared TitleFormattingCard) |
| 7 | **Card Style** | Glass Effect, Background Color, Background Opacity, Border Radius |
| 8 | **Animation** | Enable, Duration |
| 9 | **Advanced** | _Sub-groups:_ Streak Highlighting, Conditional Formatting, Number Format, Date Filter, Accessibility |

---

### 3. Morphing Area Chart -- Settings Audit

**Current card count:** 25 top-level cards
**Current card order:** Line Settings, Area Settings, Axes (local), Card Style, Animation, Forecast, Area Stacking, Gap Handling, Threshold Zone, Brush/Zoom, Axis Formatting (shared), Legend, Data Labels, Chart Title, Line Stroke, Scroll, Number Format, Reference Line, Trend Line, Conditional Formatting, Crosshair, Annotations, Accessibility, Series Formatting, Color Theme, Date Filter

#### Issues Found

1. **Extreme card count (25).** This is the longest format pane in the suite. Users face heavy scrolling to find settings. Many cards have 1-2 settings.

2. **Duplicate axis cards.** There is both a local "Axes" card (Show X-Axis, Show Y-Axis, Grid Lines) and a shared "Axis Formatting" card (colors, fonts, line widths, grid styles). These should be a single unified card.

3. **Line Settings contains dot settings.** Dot Radius, Dot Stroke Color, and Dot Stroke Width are in "Line Settings", but they configure data points, not lines. These should be a "Data Points" sub-group.

4. **Single-setting cards.** "Area Stacking" (1 dropdown), "Gap Handling" (1 dropdown), and "Color Theme" (1 dropdown) each occupy a full card for a single setting.

5. **Line Stroke card is redundant.** The shared `LineStrokeFormattingCard` overlaps with the local "Line Settings" card which already has `lineWidth`. This creates confusion about which setting controls what.

6. **Analytics cards scattered.** Reference Line, Trend Line, Conditional Formatting, Crosshair, and Annotations are all separate top-level cards interspersed with unrelated cards.

#### Proposed Reorganization (13 cards)

| # | Card Name | Settings |
|---|-----------|----------|
| 1 | **Line & Points** | Line Width, Curve Type, Line Stroke Style (from shared), Show Dots, Dot Radius, Dot Stroke Color, Dot Stroke Width |
| 2 | **Area Fill** | Show Area Fill, Fill Opacity, Gradient Fill, Stack Mode, Threshold Zone (show, threshold, above/below colors) |
| 3 | **Axes** | Show X-Axis, Show Y-Axis, Grid Lines, all shared axis formatting (colors, fonts, rotation, min/max) |
| 4 | **Data Labels** | (shared DataLabelFormattingCard) |
| 5 | **Legend** | (shared LegendFormattingCard) |
| 6 | **Chart Title** | (shared TitleFormattingCard) |
| 7 | **Card Style** | Glass Effect, Background Color, Background Opacity, Border Radius |
| 8 | **Colors & Theme** | Color Theme, Series Formatting |
| 9 | **Animation** | Enable, Duration |
| 10 | **Interaction** | Brush/Zoom (enable, context height, color, opacity), Crosshair, Scroll |
| 11 | **Analytics** | _Sub-groups:_ Reference Line, Trend Line, Annotations, Forecast |
| 12 | **Data Handling** | Gap Handling (null handling), Number Format, Date Filter |
| 13 | **Advanced** | Conditional Formatting, Accessibility |

---

### 4. Network Graph -- Settings Audit

**Current card count:** 17 top-level cards
**Current card order:** Force Physics, Nodes, Links, Colors, Card Style, Animation, Zoom & Pan, Layout Features, Interaction Features, Link Features, Data Labels, Chart Title, Conditional Formatting, Accessibility, Color Theme, Number Format, Date Filter

#### Issues Found

1. **Link settings split across two cards.** "Links" has opacity, show arrows, link color, link width. "Link Features" has width-by-weight, min/max width. These are the same topic -- link appearance.

2. **Colors card has a single toggle.** "Colors" contains only `useChartPalette` -- a single boolean. This should be merged with "Color Theme" which also has a single dropdown.

3. **Layout Features and Interaction Features unclear names.** "Layout Features" (clustering, size-by-degree, collision, edge bundling) and "Interaction Features" (drag, search, highlight neighbors) are vague. Better names would communicate their purpose directly.

4. **Force Physics is too prominent.** Most users won't adjust link strength, link distance, or charge strength. These are advanced tuning parameters that should be lower in the card order, not first.

5. **Data Labels misleading.** `showDataLabels` is hidden at runtime since labels are controlled by `nodeSettings.showLabels`. The card appears but its primary toggle is invisible.

#### Proposed Reorganization (10 cards)

| # | Card Name | Settings |
|---|-----------|----------|
| 1 | **Nodes** | Node Radius, Show Labels, Node Border Color, Node Border Width, Size by Degree |
| 2 | **Links** | Link Color, Link Width, Opacity, Show Arrows, Width by Weight, Min/Max Width |
| 3 | **Colors & Theme** | Use Chart Palette, Color Theme, Cluster Detection & Coloring |
| 4 | **Node Labels** | Font Size, Font Color, Font Weight, Font Family (from shared Data Labels card) |
| 5 | **Chart Title** | (shared TitleFormattingCard) |
| 6 | **Card Style** | Glass Effect, Background Color, Background Opacity, Border Radius |
| 7 | **Interaction** | Enable Node Drag, Enable Search, Highlight Neighbors on Hover, Enable Zoom & Pan, Min/Max Zoom |
| 8 | **Physics & Layout** | Link Strength, Link Distance, Charge Strength, Collision Prevention, Edge Bundling |
| 9 | **Animation** | Enable, Duration |
| 10 | **Advanced** | _Sub-groups:_ Conditional Formatting, Number Format, Date Filter, Accessibility |

---

### 5. Polar Chart -- Settings Audit

**Current card count:** 17 top-level cards
**Current card order:** Polar, Colors, Card Style, Animation, Polar Display, Gradient Fill, Axis Formatting (shared), Data Labels, Chart Title, Legend, Sort Order, Conditional Formatting, Accessibility, Series Formatting, Color Theme, Number Format, Date Filter

#### Issues Found

1. **Polar settings split across three cards.** "Polar" has inner radius, show labels, start angle, stroke, label color. "Polar Display" has radial labels, inner labels, segment padding, end angle. "Gradient Fill" has just an enable toggle. These are all petal/segment configuration and should be unified.

2. **Start Angle and End Angle separated.** Start Angle is in "Polar" (card 1) while End Angle is in "Polar Display" (card 5). Users configuring the arc range must jump between cards.

3. **Colors card has a single picker.** "Colors" contains only `baseColor`. This should be combined with Color Theme and Series Formatting.

4. **Gradient Fill is a single-toggle card.** "Gradient Fill" only contains `enabled`. This is a checkbox that belongs in the color/fill section.

5. **Label settings scattered.** `showLabels` and `labelColor` are in "Polar", `showRadialLabels` and `showInnerLabels` are in "Polar Display", and data label formatting (font, size) is in "Data Labels". Three cards for label configuration.

6. **Axis Formatting misleading.** Most axis properties are hidden at runtime. The remaining useful properties (grid lines, grid color, grid style, axis line color/width) control concentric rings and radial dividers -- should be named accordingly.

#### Proposed Reorganization (10 cards)

| # | Card Name | Settings |
|---|-----------|----------|
| 1 | **Segments** | Inner Radius, Start Angle, End Angle, Segment Padding, Segment Stroke Color, Segment Stroke Width |
| 2 | **Colors & Fill** | Base Color, Color Theme, Enable Gradient Fill, Series Formatting |
| 3 | **Labels** | Show Labels (inner), Show Radial Labels, Label Color, Data Label font/size/color/weight |
| 4 | **Grid & Axes** | Show Grid Lines, Grid Line Color, Grid Line Style, Axis Line Color, Axis Line Width |
| 5 | **Legend** | (shared LegendFormattingCard) |
| 6 | **Chart Title** | (shared TitleFormattingCard) |
| 7 | **Card Style** | Glass Effect, Background Color, Background Opacity, Border Radius |
| 8 | **Animation** | Enable, Duration |
| 9 | **Sort Order** | Sort By |
| 10 | **Advanced** | _Sub-groups:_ Conditional Formatting, Number Format, Date Filter, Accessibility |

---

## Summary of Key Findings

### Feature Additions -- Priority Matrix

| Visual | Quick Wins (Small) | High Impact (Medium) | Ambitious (Large) |
|--------|--------------------|----------------------|--------------------|
| Health Bar | Hover brightness + shadow | Glow pulse on danger, Peak/valley markers, Smart label abbreviation | Sparkline-in-tooltip |
| Heatmap Calendar | Cell hover magnification, Today marker, Value-in-cell | Auto-highlight outliers | Smooth month transition |
| Morphing Area Chart | Peak pulse animation | Crosshair snap, Inner shadow, Auto-rotate labels | Smooth series transitions |
| Network Graph | Node hover glow, Link tooltip | Spring drag release, Focus mode | Animated link particles |
| Polar Chart | Percentage rings, Ripple click | Hover inner glow, Center summary | Petal morphing |

### Settings Organization -- Severity Ranking

| Visual | Current Cards | Proposed Cards | Reduction | Worst Issue |
|--------|---------------|----------------|-----------|-------------|
| Morphing Area Chart | 25 | 13 | 48% | Duplicate axis cards + 25 flat cards |
| Health Bar | 21 | 11 | 48% | 3 single-setting cards + scattered scale |
| Polar Chart | 17 | 10 | 41% | Start/End angle in different cards |
| Network Graph | 17 | 10 | 41% | Link settings split across 2 cards |
| Heatmap Calendar | 14 | 9 | 36% | Color settings in 3 cards + misplaced weekStart |
