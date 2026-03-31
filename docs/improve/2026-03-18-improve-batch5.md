# Improvement Report -- Batch 5

**Visuals:** scatter-bubble, slope-chart, status-indicator, stream-graph, sunburst-chart
**Date:** 2026-03-18

---

## Deliverable 1: Luxury Feature Additions

---

### 1. Scatter Bubble

#### 1A. Magnetic Hover Lens

**Description:** When hovering over a dense region of bubbles, display a circular magnification lens that enlarges the local area so overlapping points separate and become individually selectable. The lens follows the cursor with a smooth ease-out lag and renders with a frosted-glass border ring.

**Files to modify:** `packages/scatter-bubble/src/visual.ts`, `packages/scatter-bubble/style/visual.less`
**Effort:** Large

#### 1B. Outlier Auto-Annotation

**Description:** Automatically detect statistical outliers (beyond 1.5 IQR or 2 standard deviations from the cluster center) and render a subtle animated callout badge next to them -- a small pulsing diamond icon with a label like "Outlier: +3.2 sigma." Users can toggle this in the format pane and choose between IQR and z-score detection methods.

**Files to modify:** `packages/scatter-bubble/src/visual.ts`, `packages/scatter-bubble/src/settings.ts`, `packages/scatter-bubble/capabilities.json`
**Effort:** Medium

#### 1C. Bubble Glow on Hover

**Description:** When a bubble is hovered, apply a radial glow effect (SVG feGaussianBlur filter) in the bubble's color that pulses softly, combined with a 10% scale-up via a spring ease transform. On mouseout, the glow fades and the bubble settles back to its original size with a slight elastic bounce, giving the visual a premium tactile feel.

**Files to modify:** `packages/scatter-bubble/src/visual.ts`, `packages/scatter-bubble/style/visual.less`
**Effort:** Small

#### 1D. Lasso Selection Mode

**Description:** Add a toolbar button that activates freehand lasso selection. The user draws a closed loop on the scatter plot, and all bubbles within the polygon become selected (forwarded to Power BI's selection manager for cross-filtering). The lasso path renders as a dashed animated line with a soft fill, and snaps closed when the user releases the mouse.

**Files to modify:** `packages/scatter-bubble/src/visual.ts`, `packages/scatter-bubble/src/settings.ts`, `packages/scatter-bubble/capabilities.json`, `packages/scatter-bubble/style/visual.less`
**Effort:** Large

#### 1E. Sparkline-in-Tooltip

**Description:** When hovering a bubble, the Power BI tooltip includes a tiny inline sparkline SVG showing that category's trend over the play axis timeline (if play axis data is available). This gives instant temporal context without needing to animate the entire chart, and renders as a 60x16px micro-chart inside the tooltip data items.

**Files to modify:** `packages/scatter-bubble/src/visual.ts`
**Effort:** Medium

---

### 2. Slope Chart

#### 2A. Animated Slope Draw-In

**Description:** On data load, each slope line draws itself from left-dot to right-dot using a stroke-dasharray/dashoffset animation with staggered delays per line. Lines that changed the most animate first, creating a visual hierarchy that naturally draws attention to the biggest movers. The dots pop in with a spring scale at each endpoint.

**Files to modify:** `packages/slope-chart/src/visual.ts`, `packages/slope-chart/style/visual.less`
**Effort:** Medium

#### 2B. Hover Spotlight with Dimming

**Description:** When hovering a slope line, all other lines dim to 15% opacity with a 200ms smooth transition, while the hovered line brightens to full opacity, gains a soft drop shadow, and its change label scales up by 10%. This creates a natural spotlight effect that makes comparison effortless in dense slope charts.

**Files to modify:** `packages/slope-chart/src/visual.ts`, `packages/slope-chart/style/visual.less`
**Effort:** Small

#### 2C. Rank Change Badges

**Description:** Add small circular rank badges at each endpoint showing the item's ordinal rank (1st, 2nd, 3rd...). When the rank changes between left and right columns, display a small arrow indicator next to the right badge showing how many positions were gained or lost (e.g., a green up-arrow with "+3"). This makes rank shift patterns immediately visible without mental math.

**Files to modify:** `packages/slope-chart/src/visual.ts`, `packages/slope-chart/src/settings.ts`, `packages/slope-chart/capabilities.json`
**Effort:** Medium

#### 2D. Gradient Direction Fill

**Description:** When "Show Area Fill" is enabled, replace the flat color fill with a horizontal gradient that transitions from the start-value color to the end-value color along the slope. For lines that go up, the gradient shifts from a muted tone to a vibrant green; for declining lines, it shifts to a warm red. This adds visual depth and makes direction immediately obvious even at a glance.

**Files to modify:** `packages/slope-chart/src/visual.ts`
**Effort:** Small

#### 2E. Benchmark Overlay Line

**Description:** Add an optional benchmark line that appears as a thick dashed horizontal rule at a user-specified value on both columns, with a frosted-glass label. Lines that cross the benchmark get a small "crossed threshold" icon at the intersection point, making it easy to identify which items moved above or below a target.

**Files to modify:** `packages/slope-chart/src/visual.ts`, `packages/slope-chart/src/settings.ts`, `packages/slope-chart/capabilities.json`
**Effort:** Medium

---

### 3. Status Indicator

#### 3A. Status Transition Morph

**Description:** When a status level changes (e.g., from "warning" to "critical" on data refresh), the icon smoothly morphs its color through an intermediate blend over 400ms, and the shape performs a subtle shake animation to draw attention. This makes status changes impossible to miss during live dashboard monitoring.

**Files to modify:** `packages/status-indicator/src/visual.ts`, `packages/status-indicator/style/visual.less`
**Effort:** Medium

#### 3B. Progress Ring Indicator

**Description:** Replace or augment the solid shape icons with an optional circular progress ring mode. Each indicator renders as a thin arc that fills proportionally to the value relative to the thresholds (0-100%). The ring uses the status color, and the center displays the actual value. This adds a quantitative dimension to what is currently a purely categorical display.

**Files to modify:** `packages/status-indicator/src/visual.ts`, `packages/status-indicator/src/settings.ts`, `packages/status-indicator/capabilities.json`, `packages/status-indicator/style/visual.less`
**Effort:** Large

#### 3C. Tooltip with Threshold Gauge

**Description:** When hovering a status row, display a rich tooltip that includes a small horizontal gauge bar showing where the current value sits relative to the warning and critical thresholds. The gauge renders three colored zones (critical, warning, good) with a needle marker at the current value position, providing instant context about how close a metric is to changing status.

**Files to modify:** `packages/status-indicator/src/visual.ts`
**Effort:** Medium

#### 3D. Glow Halo on Warning Items

**Description:** In addition to the existing critical pulse, add a softer amber glow halo effect around warning-status items that breathes gently (opacity oscillation between 0.3 and 0.6 over 2s). This creates a visual urgency hierarchy: critical items pulse aggressively, warning items glow softly, and good items rest static. The effect is subtle enough not to distract but visible enough to catch the eye.

**Files to modify:** `packages/status-indicator/src/visual.ts`, `packages/core/src/index.ts` (if adding a new animation helper)
**Effort:** Small

#### 3E. Historical Trend Sparkline

**Description:** Enhance the existing mini sparkline from a simple proportional bar into a true multi-point sparkline that shows the last N values as a tiny line chart (when a time-series data role is added). The sparkline renders with the status color, includes a subtle area fill below the line, and shows a small dot at the current (latest) value. This transforms the indicator from a point-in-time snapshot into a trend-aware display.

**Files to modify:** `packages/status-indicator/src/visual.ts`, `packages/status-indicator/src/settings.ts`, `packages/status-indicator/capabilities.json`
**Effort:** Large

---

### 4. Stream Graph

#### 4A. Layer Highlight with Elastic Expand

**Description:** When hovering a stream layer, that layer elastically expands in height by 15% (pushing adjacent layers apart with a spring ease), while all other layers desaturate to 30% opacity. A frosted-glass floating label appears next to the cursor showing the layer name, current value, and percentage of total. This creates a dramatic, premium hover interaction.

**Files to modify:** `packages/stream-graph/src/visual.ts`, `packages/stream-graph/style/visual.less`
**Effort:** Medium

#### 4B. Time Scrubber with Vertical Crosshair

**Description:** Add an animated vertical crosshair line that follows the cursor across the time axis. As it moves, a floating tooltip panel displays a stacked breakdown of all layers at that time point, sorted by value, with color swatches and percentages. The crosshair line renders with a soft glow effect and snaps to the nearest data point for precision.

**Files to modify:** `packages/stream-graph/src/visual.ts`, `packages/stream-graph/style/visual.less`
**Effort:** Medium

#### 4C. Animated Flow-In Entrance

**Description:** On initial render, each stream layer grows from a flat zero-height line at the center baseline, expanding outward with a staggered wave effect. Layers animate in order from the center outward (matching the inside-out sort), creating an organic "blooming" entrance that emphasizes the stream metaphor. Each layer uses a different stagger delay for a cascading reveal.

**Files to modify:** `packages/stream-graph/src/visual.ts`
**Effort:** Medium

#### 4D. Gradient Depth Shading

**Description:** Apply a subtle vertical gradient to each stream layer, lighter at the outer edges and slightly darker toward the center baseline. This creates a 3D ribbon effect that makes the streams look like physical flowing ribbons rather than flat colored areas. The gradient intensity is controllable via the format pane (0-100% depth effect).

**Files to modify:** `packages/stream-graph/src/visual.ts`, `packages/stream-graph/src/settings.ts`, `packages/stream-graph/capabilities.json`
**Effort:** Small

#### 4E. Peak Value Callouts

**Description:** Automatically detect the peak value point for each stream layer and render a small annotated marker at that position -- a tiny dot with a connecting line to a label showing the peak value and date. Only the top N peaks are shown (configurable) to avoid clutter. The callouts fade in after the entrance animation completes.

**Files to modify:** `packages/stream-graph/src/visual.ts`, `packages/stream-graph/src/settings.ts`, `packages/stream-graph/capabilities.json`
**Effort:** Medium

---

### 5. Sunburst Chart

#### 5A. Animated Zoom Transition

**Description:** When clicking a segment to drill down or zoom, animate the transition with a smooth radial morph where the clicked segment expands to fill the full ring while sibling segments shrink and fade out. The center content value counter animates (counts up/down) to the new subtotal. This replaces the current instant re-render with a cinematic zoom that preserves spatial context.

**Files to modify:** `packages/sunburst-chart/src/visual.ts`
**Effort:** Large

#### 5B. Segment Glow on Hover with Depth Shadow

**Description:** When hovering a segment, apply a layered effect: the segment brightens by 15%, gains an outer glow in its own color (SVG filter), and a subtle drop shadow appears beneath it creating a "lifted" effect. Adjacent segments at the same depth slightly recede (darken by 5%). The spring scale hover that already exists becomes smoother with these additions.

**Files to modify:** `packages/sunburst-chart/src/visual.ts`, `packages/sunburst-chart/style/visual.less`
**Effort:** Small

#### 5C. Path Highlight on Hover

**Description:** When hovering any segment, highlight its entire ancestry path from root to the hovered node by brightening all ancestor segments and drawing a subtle connecting arc line between them. All non-ancestor segments dim to 40% opacity. This makes hierarchical relationships instantly visible and helps users understand the nesting structure at a glance.

**Files to modify:** `packages/sunburst-chart/src/visual.ts`, `packages/sunburst-chart/style/visual.less`
**Effort:** Medium

#### 5D. Tooltip with Mini Hierarchy Tree

**Description:** When hovering a segment, display a rich tooltip that includes a tiny tree diagram showing the segment's position in the hierarchy (parent > current > children preview), with the current segment highlighted. Include the value, percentage of parent, and percentage of total. This gives full context without requiring the user to mentally trace the rings.

**Files to modify:** `packages/sunburst-chart/src/visual.ts`
**Effort:** Medium

#### 5E. Patterned Segment Fill for Accessibility

**Description:** Add an optional accessibility mode that overlays distinct SVG patterns (diagonal lines, dots, crosshatch, waves) on each top-level segment in addition to color. The patterns propagate to child segments with lighter variants. This makes the chart fully readable for colorblind users and in grayscale print, going beyond the existing keyboard navigation accessibility.

**Files to modify:** `packages/sunburst-chart/src/visual.ts`, `packages/sunburst-chart/src/settings.ts`, `packages/sunburst-chart/capabilities.json`
**Effort:** Medium

---

## Deliverable 2: Settings Organization Audit

---

### 1. Scatter Bubble

#### Current Card Structure (21 top-level cards)

| # | Card Name | Slices |
|---|-----------|--------|
| 1 | Scatter Settings | minRadius, maxRadius, opacity, bubbleStrokeColor, bubbleStrokeWidth |
| 2 | Axes | showXAxis, showYAxis, gridLines |
| 3 | Card Style | enableGlass, backgroundColor, backgroundOpacity, borderRadius |
| 4 | Animation | enabled, duration |
| 5 | Quadrant Lines | show, xValue, yValue, lineColor, lineWidth, lineStyle, showLabels, topRightLabel, topLeftLabel, bottomRightLabel, bottomLeftLabel, labelFontSize, zoneFillOpacity |
| 6 | Trendline | show, type, polynomialOrder, lineColor, lineWidth, lineStyle, showEquation, showR2, labelFontSize |
| 7 | Clustering | enabled, clusters, showHulls |
| 8 | Scatter Animation | enableTransitions, enablePlayAxis, playSpeed |
| 9 | Zoom & Pan | enableZoom, enablePan |
| 10 | Color Scale | colorScale, startColor, endColor |
| 11 | Axis Formatting (shared) | ~15 properties |
| 12 | Legend (shared) | ~6 properties |
| 13 | Data Labels (shared) | ~6 properties |
| 14 | Chart Title (shared) | ~10 properties |
| 15 | Number Format (shared) | 4 properties |
| 16 | Reference Line (shared) | ~9 properties |
| 17 | Conditional Formatting (shared) | ~7 properties |
| 18 | Accessibility (shared) | 1 property |
| 19 | Series (shared) | ~5 properties |
| 20 | Color Theme (shared) | 1 property |
| 21 | Date Filter (shared) | 4 properties |

#### Issues Identified

1. **Duplicate animation cards.** "Animation" (card 4) and "Scatter Animation" (card 8) split animation concerns across two cards. The generic card has enable/duration while the scatter-specific card has transitions/play axis/speed -- users must look in two places.

2. **Duplicate axis cards.** "Axes" (card 2) has showXAxis/showYAxis/gridLines while "Axis Formatting" (card 11, shared) has its own showXAxis/showYAxis/showGridLines plus detailed styling. The local card is redundant.

3. **Too many top-level cards (21).** Users must scroll through a very long format pane. Cards like "Zoom & Pan" (2 slices), "Clustering" (3 slices), and "Color Scale" (3 slices) are too small to justify being standalone.

4. **Color settings fragmented.** Color-related settings live in three places: "Color Scale" (card 10), "Color Theme" (card 20), and "Series" (card 19). Users looking to change colors must check all three.

#### Proposed Reorganization

| # | Card Name | Contents |
|---|-----------|----------|
| 1 | **Bubble Appearance** | minRadius, maxRadius, opacity, bubbleStrokeColor, bubbleStrokeWidth |
| 2 | **Colors & Theme** | colorScale, startColor, endColor, colorTheme (merged from Color Scale + Color Theme) |
| 3 | **Axes** | Remove local card; use shared Axis Formatting only (it already has showXAxis/showYAxis/gridLines) |
| 4 | **Quadrant Lines** | (unchanged -- 13 slices is justified for this complex feature) |
| 5 | **Trendline** | (unchanged) |
| 6 | **Analytics** | Clustering + Zoom & Pan merged: enabled, clusters, showHulls, enableZoom, enablePan |
| 7 | **Animation & Playback** | Merge both animation cards: enabled, duration, enableTransitions, enablePlayAxis, playSpeed |
| 8 | **Chart Title** | (shared, unchanged) |
| 9 | **Legend** | (shared, unchanged) |
| 10 | **Data Labels** | (shared, unchanged) |
| 11 | **Series Formatting** | (shared, unchanged) |
| 12 | **Reference Line** | (shared, unchanged) |
| 13 | **Conditional Formatting** | (shared, unchanged) |
| 14 | **Number Format** | (shared, unchanged) |
| 15 | **Card Style** | (unchanged) |
| 16 | **Date Filter** | (shared, unchanged) |
| 17 | **Accessibility** | (shared, unchanged) |

**Result:** 21 cards reduced to 17. Eliminated duplicate axis/animation cards and consolidated color settings.

---

### 2. Slope Chart

#### Current Card Structure (20 top-level cards)

| # | Card Name | Slices |
|---|-----------|--------|
| 1 | Slope Lines | lineWidth, dotRadius, colorByDirection, positiveColor, negativeColor, neutralColor, dotStrokeColor, labelColor, showArea, fillOpacity |
| 2 | Columns | leftLabel, rightLabel |
| 3 | Change Labels | show, fontSize, fontColor, format, position |
| 4 | Card Style | enableGlass, backgroundColor, backgroundOpacity, borderRadius |
| 5 | Animation | enabled, duration |
| 6 | Slope Display | showPercentChange, sortByMagnitude, showConfidenceInterval |
| 7 | Threshold Highlight | show, threshold, glowColor |
| 8 | Legend (shared) | ... |
| 9 | Series (shared) | ... |
| 10 | Data Labels (shared) | ... |
| 11 | Chart Title (shared) | ... |
| 12 | Line Stroke (shared) | ... |
| 13 | Axis Formatting (shared) | ... |
| 14 | Reference Line (shared) | ... |
| 15 | Trend Line (shared) | ... |
| 16 | Conditional Formatting (shared) | ... |
| 17 | Crosshair (shared) | ... |
| 18 | Annotation (shared) | ... |
| 19 | Accessibility (shared) | ... |
| 20 | Number Format (shared) | ... |
| 21 | Date Filter (shared) | ... |

#### Issues Identified

1. **Scattered label settings.** "Change Labels" (card 3) handles change-percentage labels, "Slope Lines" (card 1) has `labelColor` for endpoint labels, and the shared "Data Labels" card (card 10) has generic label styling. Three different places for label configuration.

2. **"Columns" card is too thin.** Only 2 slices (leftLabel, rightLabel). This could be a subsection of another card.

3. **Overlap between "Slope Display" and "Change Labels."** `showPercentChange` in Slope Display overlaps with the Change Labels card that already controls change label visibility and format. Users may toggle one and not the other, creating confusion.

4. **"Slope Lines" card is overloaded.** 10 slices mixing line geometry (width, dotRadius), colors (positive/negative/neutral/dotStroke/label), and area fill. These are distinct concerns.

#### Proposed Reorganization

| # | Card Name | Contents |
|---|-----------|----------|
| 1 | **Slope Lines** | lineWidth, dotRadius, dotStrokeColor, showArea, fillOpacity |
| 2 | **Direction Colors** | colorByDirection, positiveColor, negativeColor, neutralColor |
| 3 | **Labels & Change** | Merge Columns + Change Labels: leftLabel, rightLabel, show, fontSize, fontColor, labelColor, format, position, showPercentChange |
| 4 | **Slope Behavior** | sortByMagnitude, showConfidenceInterval (remaining from Slope Display) |
| 5 | **Threshold Highlight** | (unchanged) |
| 6 | **Animation** | (unchanged) |
| 7 | **Chart Title** | (shared) |
| 8 | **Legend** | (shared) |
| 9 | **Series Formatting** | (shared) |
| 10 | **Data Labels** | (shared) |
| 11 | **Line Stroke** | (shared) |
| 12 | **Axis Formatting** | (shared) |
| 13 | **Reference Line** | (shared) |
| 14 | **Trend Line** | (shared) |
| 15 | **Conditional Formatting** | (shared) |
| 16 | **Crosshair** | (shared) |
| 17 | **Annotation** | (shared) |
| 18 | **Number Format** | (shared) |
| 19 | **Card Style** | (unchanged) |
| 20 | **Date Filter** | (shared) |
| 21 | **Accessibility** | (shared) |

**Result:** Eliminated the thin "Columns" card and merged related label/change settings. Split the overloaded "Slope Lines" card into geometry and color cards.

---

### 3. Status Indicator

#### Current Card Structure (13 top-level cards)

| # | Card Name | Slices |
|---|-----------|--------|
| 1 | Indicator | shape, size, layout, iconSize, labelColor |
| 2 | Thresholds | goodColor, warningColor, criticalColor, direction, useCustomThresholds, threshold1, threshold2, showValue, valueFontSize |
| 3 | Pulse | enablePulse |
| 4 | Card Style | enableGlass, backgroundColor, backgroundOpacity, borderRadius |
| 5 | Animation | enabled, duration |
| 6 | Status Display | showSparkline, showStatusText, iconSet |
| 7 | Status Levels | levelCount, level4Color, level5Color |
| 8 | Legend (shared) | ... |
| 9 | Chart Title (shared) | ... |
| 10 | Conditional Formatting (shared) | ... |
| 11 | Accessibility (shared) | ... |
| 12 | Number Format (shared) | ... |
| 13 | Date Filter (shared) | ... |

#### Issues Identified

1. **"Pulse" card has only 1 slice.** A single toggle switch does not justify a standalone card. It belongs with animation or the indicator card.

2. **Redundant shape settings.** "Indicator" has a `shape` dropdown and "Status Display" has an `iconSet` dropdown. In `visual.ts`, the code sets `shape.visible = false` because iconSet supersedes it. The shape property should be removed entirely from Indicator.

3. **Threshold colors split from level colors.** "Thresholds" has goodColor/warningColor/criticalColor while "Status Levels" has level4Color/level5Color. These are the same concept (status level colors) split across two cards.

4. **"Indicator" card mixes appearance and layout.** Shape/size/iconSize are appearance settings while `layout` (vertical/horizontal/grid) is a structural setting.

5. **Value display settings in wrong card.** `showValue` and `valueFontSize` are in "Thresholds" but they control label display, not threshold logic.

#### Proposed Reorganization

| # | Card Name | Contents |
|---|-----------|----------|
| 1 | **Indicator Appearance** | iconSet (moved from Status Display), iconSize, size, labelColor |
| 2 | **Layout** | layout (vertical/horizontal/grid) |
| 3 | **Thresholds & Colors** | Merge Thresholds + Status Levels: direction, useCustomThresholds, threshold1, threshold2, goodColor, warningColor, criticalColor, levelCount, level4Color, level5Color |
| 4 | **Value Display** | showValue, valueFontSize, showStatusText, showSparkline (extracted from Thresholds + Status Display) |
| 5 | **Animation & Effects** | Merge Animation + Pulse: enabled, duration, enablePulse |
| 6 | **Chart Title** | (shared) |
| 7 | **Legend** | (shared) |
| 8 | **Conditional Formatting** | (shared) |
| 9 | **Number Format** | (shared) |
| 10 | **Card Style** | (unchanged) |
| 11 | **Date Filter** | (shared) |
| 12 | **Accessibility** | (shared) |

**Result:** 13 cards reduced to 12. Eliminated the 1-slice "Pulse" card, removed the dead "shape" property, consolidated threshold/level colors, and separated value display from threshold logic.

---

### 4. Stream Graph

#### Current Card Structure (21 top-level cards)

| # | Card Name | Slices |
|---|-----------|--------|
| 1 | Stream | offset, curve, streamOpacity, streamStrokeColor, streamStrokeWidth, useGradient |
| 2 | Colors | useChartPalette |
| 3 | Axis Visibility | showXAxis |
| 4 | Card Style | enableGlass, backgroundColor, backgroundOpacity, borderRadius |
| 5 | Animation | enabled, duration |
| 6 | Stream Display | showYAxis, showPercentages, showValues |
| 7 | Layer Sort Order | sortOrder |
| 8 | Axis Formatting (shared) | ... |
| 9 | Legend (shared) | ... |
| 10 | Data Labels (shared) | ... |
| 11 | Chart Title (shared) | ... |
| 12 | Line Stroke (shared) | ... |
| 13 | Sort (shared) | ... |
| 14 | Reference Line (shared) | ... |
| 15 | Trend Line (shared) | ... |
| 16 | Conditional Formatting (shared) | ... |
| 17 | Crosshair (shared) | ... |
| 18 | Annotation (shared) | ... |
| 19 | Accessibility (shared) | ... |
| 20 | Series (shared) | ... |
| 21 | Color Theme (shared) | ... |
| 22 | Number Format (shared) | ... |
| 23 | Date Filter (shared) | ... |

#### Issues Identified

1. **"Colors" card has only 1 slice.** A single toggle for useChartPalette does not need its own card.

2. **"Axis Visibility" card has only 1 slice (showXAxis).** Meanwhile, "Stream Display" has `showYAxis`. The two axis toggles are in different cards, which is confusing.

3. **"Layer Sort Order" card has only 1 slice.** A single dropdown does not justify a standalone card, especially since there is already a shared "Sort" card (card 13).

4. **Duplicate sort cards.** "Layer Sort Order" (card 7) and "Sort" (card 13, shared) both deal with ordering. Users may configure one thinking it controls the other.

5. **Axis settings scattered across 3 cards.** showXAxis in "Axis Visibility," showYAxis in "Stream Display," and detailed axis formatting in the shared "Axis Formatting" card.

#### Proposed Reorganization

| # | Card Name | Contents |
|---|-----------|----------|
| 1 | **Stream Shape** | offset, curve, streamOpacity, streamStrokeColor, streamStrokeWidth, useGradient |
| 2 | **Colors & Theme** | Merge Colors + Color Theme: useChartPalette, colorTheme |
| 3 | **Stream Display** | Absorb Axis Visibility + Layer Sort: showXAxis, showYAxis, showPercentages, showValues, sortOrder |
| 4 | **Animation** | (unchanged) |
| 5 | **Chart Title** | (shared) |
| 6 | **Legend** | (shared) |
| 7 | **Data Labels** | (shared) |
| 8 | **Series Formatting** | (shared) |
| 9 | **Axis Formatting** | (shared) |
| 10 | **Line Stroke** | (shared) |
| 11 | **Reference Line** | (shared) |
| 12 | **Trend Line** | (shared) |
| 13 | **Conditional Formatting** | (shared) |
| 14 | **Crosshair** | (shared) |
| 15 | **Annotation** | (shared) |
| 16 | **Number Format** | (shared) |
| 17 | **Card Style** | (unchanged) |
| 18 | **Date Filter** | (shared) |
| 19 | **Accessibility** | (shared) |

**Result:** 23 cards reduced to 19. Eliminated three 1-slice cards (Colors, Axis Visibility, Layer Sort Order) and the duplicate Sort card by merging them into logical groups.

---

### 5. Sunburst Chart

#### Current Card Structure (15 top-level cards)

| # | Card Name | Slices |
|---|-----------|--------|
| 1 | Sunburst | showLabels, labelMinAngle, segmentStrokeColor, segmentStrokeWidth, labelColor |
| 2 | Colors | useChartPalette |
| 3 | Center Content | show, displayMode, customText, fontSize, fontColor, showLabel, labelFontSize |
| 4 | Card Style | enableGlass, backgroundColor, backgroundOpacity, borderRadius |
| 5 | Animation | enabled, duration |
| 6 | Drill-Down | enabled, showBreadcrumb, breadcrumbFontSize, breadcrumbColor |
| 7 | Sunburst Display | showPercentages, percentOf, innerRadius, startAngle, sortOrder |
| 8 | Legend (shared) | ... |
| 9 | Data Labels (shared) | ... |
| 10 | Chart Title (shared) | ... |
| 11 | Conditional Formatting (shared) | ... |
| 12 | Accessibility (shared) | ... |
| 13 | Color Theme (shared) | ... |
| 14 | Number Format (shared) | ... |
| 15 | Date Filter (shared) | ... |

#### Issues Identified

1. **"Colors" card has only 1 slice.** Same issue as stream-graph: a single toggle needs no standalone card.

2. **Label settings split across 3 cards.** "Sunburst" has showLabels/labelMinAngle/labelColor, "Sunburst Display" has showPercentages/percentOf (which affect label content), and the shared "Data Labels" card has font styling. The visual's code even hides `labelColor` and redirects to the shared card, making the local setting dead weight.

3. **"Sunburst" card mixes labels and segment stroke.** segmentStrokeColor/segmentStrokeWidth are segment appearance settings, while showLabels/labelMinAngle are label settings. These are unrelated concerns.

4. **"Sunburst Display" card name is vague.** It contains geometry settings (innerRadius, startAngle), display options (showPercentages), and sort order -- three different concerns under a generic name.

5. **Illogical ordering.** "Center Content" (card 3) appears before "Card Style" (card 4) and "Animation" (card 5), but center content is a secondary feature while appearance and animation are primary. The most impactful settings should come first.

#### Proposed Reorganization

| # | Card Name | Contents |
|---|-----------|----------|
| 1 | **Segment Appearance** | segmentStrokeColor, segmentStrokeWidth (extracted from Sunburst) |
| 2 | **Colors & Theme** | Merge Colors + Color Theme: useChartPalette, colorTheme |
| 3 | **Geometry** | innerRadius, startAngle, sortOrder (extracted from Sunburst Display -- renamed for clarity) |
| 4 | **Labels & Percentages** | showLabels, labelMinAngle, showPercentages, percentOf (consolidated from Sunburst + Sunburst Display) |
| 5 | **Center Content** | (unchanged -- well-organized internally) |
| 6 | **Drill-Down** | (unchanged) |
| 7 | **Animation** | (unchanged) |
| 8 | **Chart Title** | (shared) |
| 9 | **Legend** | (shared) |
| 10 | **Data Labels** | (shared -- handles font styling for labels) |
| 11 | **Conditional Formatting** | (shared) |
| 12 | **Number Format** | (shared) |
| 13 | **Card Style** | (unchanged) |
| 14 | **Date Filter** | (shared) |
| 15 | **Accessibility** | (shared) |

**Result:** 15 cards reduced to 15 (same count, but reorganized). Eliminated the 1-slice "Colors" card, split the mixed "Sunburst" card into focused cards, renamed the vague "Sunburst Display" to "Geometry," and consolidated all label settings into one card. Removed the dead `labelColor` from the local card.

---

## Summary Table

| Visual | Current Cards | Proposed Cards | Issues Found |
|--------|:------------:|:--------------:|:------------:|
| scatter-bubble | 21 | 17 | Duplicate animation cards, duplicate axis cards, fragmented colors, too many top-level cards |
| slope-chart | 21 | 21 | Scattered label settings, 2-slice "Columns" card, overlapping percent-change settings, overloaded "Slope Lines" card |
| status-indicator | 13 | 12 | 1-slice "Pulse" card, dead "shape" property, split threshold/level colors, misplaced value display settings |
| stream-graph | 23 | 19 | Three 1-slice cards, axis toggles in different cards, duplicate sort cards, fragmented axis settings |
| sunburst-chart | 15 | 15 | 1-slice "Colors" card, label settings in 3 places, mixed concerns in "Sunburst" card, vague "Sunburst Display" name |
