# Improvement Report -- Batch 4

**Date:** 2026-03-18
**Visuals:** progress-bar-stack, radar-chart, radial-gauge, ring-stack, sankey-diagram

---

## Deliverable 1: Luxury Feature Additions

---

### 1. Progress Bar Stack

#### 1A. Shimmer Highlight on Completion

When a bar reaches 100% (or exceeds the target), play a single left-to-right shimmer highlight across the filled bar -- a subtle translucent white sweep that signals "goal achieved."

- **Files to modify:** `packages/progress-bar-stack/src/visual.ts`, `packages/core/src/animations.ts`
- **Effort:** Small

#### 1B. Hover Tooltip Card with Sparkline

Replace the plain hover opacity change with a rich floating card that shows the category name, formatted value, percentage, and a mini inline sparkline if historical data is available. The card should fade in with a slight scale-up.

- **Files to modify:** `packages/progress-bar-stack/src/visual.ts`, `packages/progress-bar-stack/style/visual.less`
- **Effort:** Medium

#### 1C. Threshold Pulse Animation

When a bar's value crosses a milestone marker or hits a conditional formatting boundary, pulse that section of the bar with a brief radial glow -- drawing the viewer's eye to the status change.

- **Files to modify:** `packages/progress-bar-stack/src/visual.ts`, `packages/core/src/animations.ts`
- **Effort:** Medium

#### 1D. Auto-Highlight Best/Worst Bars

Automatically detect the highest and lowest completion percentage bars and render a subtle icon badge (crown for best, flag for worst) next to the label. Controlled by a toggle in settings.

- **Files to modify:** `packages/progress-bar-stack/src/visual.ts`, `packages/progress-bar-stack/src/settings.ts`, `packages/progress-bar-stack/capabilities.json`
- **Effort:** Medium

#### 1E. Hover Scale Effect on Rows

When hovering over a progress row, gently scale it up by 2-3% with a drop shadow, making it visually "lift" off the card -- a material design touch that gives tactile feedback.

- **Files to modify:** `packages/progress-bar-stack/src/visual.ts`, `packages/progress-bar-stack/style/visual.less`
- **Effort:** Small

---

### 2. Radar Chart

#### 2A. Glow Aura on Series Hover

When hovering over a radar polygon, add a soft colored glow (CSS filter or SVG feGaussianBlur) behind the hovered series while dimming the others. This makes comparison effortless.

- **Files to modify:** `packages/radar-chart/src/visual.ts`, `packages/radar-chart/style/visual.less`
- **Effort:** Small

#### 2B. Animated Dot Pulse on Peak Values

For each series, identify the axis with the maximum value and animate that dot with a slow, perpetual pulse (scale 1.0 to 1.3, repeating). This acts as an instant "where am I strongest?" indicator.

- **Files to modify:** `packages/radar-chart/src/visual.ts`, `packages/core/src/animations.ts`
- **Effort:** Small

#### 2C. Click-to-Isolate Series

Clicking a radar polygon isolates it -- all other series fade to 5% opacity, the selected one fills fully, and a summary card appears in the corner showing min/max/avg for that series. Click the background to reset.

- **Files to modify:** `packages/radar-chart/src/visual.ts`, `packages/radar-chart/src/settings.ts`
- **Effort:** Medium

#### 2D. Gradient Polygon Fill

Instead of flat color fills, offer a radial gradient fill option per series -- the color intensifies from the center outward, giving the chart a premium data-ink look.

- **Files to modify:** `packages/radar-chart/src/visual.ts`, `packages/radar-chart/src/settings.ts`, `packages/radar-chart/capabilities.json`
- **Effort:** Medium

#### 2E. Axis Value Callout Badges

When `showAxisValues` is on, render the value inside a small rounded pill/badge at each axis tip instead of plain text. The badge uses the series color and has a subtle drop shadow, making values pop against any background.

- **Files to modify:** `packages/radar-chart/src/visual.ts`, `packages/radar-chart/style/visual.less`
- **Effort:** Small

---

### 3. Radial Gauge

#### 3A. Elastic Needle Overshoot

When the needle animates to the target value, overshoot by 3-5 degrees then spring back with elastic easing. This gives the gauge a mechanical, analog-instrument feel.

- **Files to modify:** `packages/radial-gauge/src/visual.ts`, `packages/core/src/animations.ts`
- **Effort:** Small

#### 3B. Inner Glow on Zone Transition

When the value moves from one color zone to another, briefly flash a soft inner glow at the zone boundary. The glow color matches the zone being entered, giving instant visual feedback on status changes.

- **Files to modify:** `packages/radial-gauge/src/visual.ts`
- **Effort:** Medium

#### 3C. Frosted Glass Value Panel

Render the center value text on top of a frosted glass panel (backdrop-filter: blur + semi-transparent background) that sits inside the gauge arc. This creates a premium layered-glass aesthetic.

- **Files to modify:** `packages/radial-gauge/src/visual.ts`, `packages/radial-gauge/style/visual.less`
- **Effort:** Small

#### 3D. Animated Min/Max Boundary Labels

When scale labels are enabled, animate the min and max labels counting up from 0 to their respective values with the same easing as the needle. This creates a cohesive "powering up" entrance effect.

- **Files to modify:** `packages/radial-gauge/src/visual.ts`
- **Effort:** Small

#### 3E. Hover Arc Detail

When hovering anywhere on the value arc, display a rich tooltip showing: value, target, delta (with color-coded arrow), and percentage of range consumed. The tooltip fades in with a slight upward slide.

- **Files to modify:** `packages/radial-gauge/src/visual.ts`
- **Effort:** Small

---

### 4. Ring Stack

#### 4A. Value-in-Center on Ring Hover

When the user hovers over a specific ring arc, the center content temporarily transitions to show that ring's name, value, and percentage. When the hover ends, it smoothly transitions back to the aggregate display.

- **Files to modify:** `packages/ring-stack/src/visual.ts`, `packages/ring-stack/style/visual.less`
- **Effort:** Medium

#### 4B. Ring Pop on Hover

On hover, the targeted ring scales outward by 4px (both inner and outer radii increase) and gains a subtle drop shadow, making it visually "pop" out of the concentric stack while the others dim slightly.

- **Files to modify:** `packages/ring-stack/src/visual.ts`
- **Effort:** Medium

#### 4C. Sparkline-in-Tooltip

When hovering a ring, show a rich tooltip card containing a mini sparkline of the ring's historical values (if a category/date dimension is present), the current value, and the delta from the previous period.

- **Files to modify:** `packages/ring-stack/src/visual.ts`, `packages/ring-stack/src/settings.ts`, `packages/ring-stack/capabilities.json`
- **Effort:** Large

#### 4D. Completion Burst Animation

When a ring reaches 100% (value >= max), trigger a one-time subtle particle burst at the 12 o'clock position -- small colored circles that radiate outward and fade. This celebrates goal completion.

- **Files to modify:** `packages/ring-stack/src/visual.ts`, `packages/core/src/animations.ts`
- **Effort:** Medium

#### 4E. Gradient Ring Fill with Configurable Endpoints

Upgrade the current simple gradient (base color to 50% opacity) to a user-configurable two-color gradient with start/end color pickers, giving full control over the gradient aesthetic.

- **Files to modify:** `packages/ring-stack/src/visual.ts`, `packages/ring-stack/src/settings.ts`, `packages/ring-stack/capabilities.json`
- **Effort:** Medium

---

### 5. Sankey Diagram

#### 5A. Animated Flow Particles

On hover over a link, animate small circles traveling along the link path from source to target. The speed and density correspond to the flow's weight, giving an intuitive "flow" metaphor.

- **Files to modify:** `packages/sankey-diagram/src/visual.ts`, `packages/core/src/animations.ts`
- **Effort:** Large

#### 5B. Node Glow on Hover

When hovering a node, apply a soft outer glow (SVG feDropShadow or feGaussianBlur) in the node's color. Connected links brighten while unconnected elements dim, making the full flow path unmistakable.

- **Files to modify:** `packages/sankey-diagram/src/visual.ts`, `packages/sankey-diagram/style/visual.less`
- **Effort:** Small

#### 5C. Click-to-Expand Layer Detail

Clicking a node expands a floating detail panel showing: total inflow, total outflow, net balance, top 3 sources, and top 3 targets -- all with mini horizontal bar charts. Click elsewhere to dismiss.

- **Files to modify:** `packages/sankey-diagram/src/visual.ts`, `packages/sankey-diagram/style/visual.less`
- **Effort:** Large

#### 5D. Auto-Highlight Critical Path

Automatically detect the highest-weight path from the leftmost layer to the rightmost layer and render it with a brighter, slightly wider link. Optionally add a small "Critical Path" badge at the top.

- **Files to modify:** `packages/sankey-diagram/src/visual.ts`, `packages/sankey-diagram/src/settings.ts`, `packages/sankey-diagram/capabilities.json`
- **Effort:** Medium

#### 5E. Smooth Link Hover Transitions

Instead of the current instant opacity jump between `opacity` and `hoverOpacity`, add a 150ms CSS transition on the link paths. This creates a silky, polished interaction feel with zero code complexity.

- **Files to modify:** `packages/sankey-diagram/src/visual.ts` (add `style('transition', 'opacity 0.15s ease')` to link paths)
- **Effort:** Small

---

## Deliverable 2: Settings Organization Audit

---

### 1. Progress Bar Stack

**Current card count:** 18 top-level cards
**Current card order:**
1. Bar Settings (8 slices -- mixes layout, display toggles, and colors)
2. Colors (2 slices -- barColor + trackColor, but trackColor is hidden as duplicate)
3. Target
4. Card Style
5. Animation
6. Data Labels
7. Chart Title
8. Axis Formatting
9. Reference Line
10. Trend Line
11. Conditional Formatting
12. Annotations
13. Accessibility
14. Milestones
15. Gradient Fill
16. Color Theme
17. Number Format
18. Date Filter

**Issues found:**

1. **Scattered color settings** -- `barColor` is in "Colors", `trackColor` is in both "Bar Settings" AND "Colors" (one is hidden), `labelColor` is in "Bar Settings", and gradient colors are in "Gradient Fill". All color controls are spread across 4 cards.
2. **Too many top-level cards (18)** -- The format pane is an extremely long flat list. Users must scroll through Reference Line, Trend Line, Annotations, Milestones, and Gradient Fill just to find Number Format.
3. **Bar Settings is overloaded** -- It mixes dimensional properties (barHeight, gap, cornerRadius, barCornerRadius), display toggles (showValue, showPercent), and colors (trackColor, labelColor) into one card.
4. **Milestones and Gradient Fill are orphaned** -- These are visual polish features that should be grouped near other bar appearance settings, not buried at positions 14 and 15.
5. **Illogical ordering** -- "Accessibility" (card 13) is sandwiched between "Annotations" and "Milestones", which are both visual feature cards.

**Proposed reorganization:**

| # | Card Name | Contents |
|---|-----------|----------|
| 1 | **Bar Layout** | barHeight, gap, cornerRadius, barCornerRadius, roundedCaps (if added) |
| 2 | **Bar Appearance** | barColor, trackColor, labelColor, gradient toggle + start/end colors |
| 3 | **Labels & Values** | showValue, showPercent, number format (displayUnits, decimals, prefix, suffix) |
| 4 | **Target** | show, color, lineWidth |
| 5 | **Milestones** | show, positions, color |
| 6 | **Chart Title** | (shared card, unchanged) |
| 7 | **Conditional Formatting** | (shared card, unchanged) |
| 8 | **Card Style** | glass, backgroundColor, opacity, borderRadius |
| 9 | **Color Theme** | theme picker |
| 10 | **Animation** | enabled, duration |
| 11 | **Reference Line** | (shared card, unchanged) |
| 12 | **Trend Line** | (shared card, unchanged) |
| 13 | **Annotations** | (shared card, unchanged) |
| 14 | **Axis Labels** | axisLabelColor, axisLabelSize (only the 2 used) |
| 15 | **Date Filter** | (shared card, unchanged) |
| 16 | **Accessibility** | (shared card, unchanged) |

**Key changes:** Merge "Colors" into "Bar Appearance", merge "Gradient Fill" into "Bar Appearance", pull number format settings up into "Labels & Values", reorder so appearance comes first and advanced/niche features are at the bottom. Drops from 18 to 16 cards, with logical grouping.

---

### 2. Radar Chart

**Current card count:** 17 top-level cards
**Current card order:**
1. Radar (10 slices -- showGrid, gridLevels, gridShape, fillOpacity, showDots, dotRadius, webStrokeColor, webStrokeWidth, webFillOpacity, areaOpacity)
2. Colors (1 slice -- useChartPalette)
3. Card Style
4. Animation
5. Benchmark
6. Radar Display (showAxisValues, startAngle, independentScales)
7. Interaction (hoverDim)
8. Axis Formatting
9. Legend
10. Data Labels
11. Chart Title
12. Conditional Formatting
13. Accessibility
14. Series
15. Color Theme
16. Number Format
17. Date Filter

**Issues found:**

1. **"Radar" card is overloaded (10 slices)** -- Mixes grid configuration (showGrid, gridLevels, gridShape), web appearance (webStrokeColor, webStrokeWidth, webFillOpacity), and data series appearance (fillOpacity, areaOpacity, showDots, dotRadius). These are three distinct concerns in one card.
2. **"Colors" card has only 1 slice** -- A single toggle (`useChartPalette`) does not warrant its own top-level card.
3. **"Radar Display" and "Radar" card overlap** -- Both control radar-specific visual properties. `showAxisValues` and `startAngle` feel like they belong with the main Radar card, not in a separate card.
4. **"Interaction" card has only 1 slice** -- Just `hoverDim`. Too thin for a top-level card.
5. **Unclear name: "Radar Display"** -- Not clear how it differs from the "Radar" card.

**Proposed reorganization:**

| # | Card Name | Contents |
|---|-----------|----------|
| 1 | **Grid & Web** | showGrid, gridLevels, gridShape, webStrokeColor, webStrokeWidth, webFillOpacity |
| 2 | **Series Appearance** | fillOpacity, areaOpacity, showDots, dotRadius, useChartPalette |
| 3 | **Axis** | showAxisValues, startAngle, independentScales, axisLabelColor, axisLabelSize, axisLineColor, axisLineWidth, showGridLines, gridLineColor, gridLineStyle |
| 4 | **Benchmark** | show, dashPattern, color |
| 5 | **Chart Title** | (shared card, unchanged) |
| 6 | **Legend** | (shared card, unchanged) |
| 7 | **Data Labels** | (shared card, unchanged) |
| 8 | **Conditional Formatting** | (shared card, unchanged) |
| 9 | **Series Formatting** | (shared card, unchanged) |
| 10 | **Card Style** | glass, backgroundColor, opacity, borderRadius |
| 11 | **Color Theme** | theme picker |
| 12 | **Animation** | enabled, duration |
| 13 | **Interaction** | hoverDim (keep but consider adding more interaction options like click-to-isolate before promoting) |
| 14 | **Number Format** | (shared card, unchanged) |
| 15 | **Date Filter** | (shared card, unchanged) |
| 16 | **Accessibility** | (shared card, unchanged) |

**Key changes:** Split "Radar" mega-card into "Grid & Web" and "Series Appearance". Absorb "Colors" (1 slice) into "Series Appearance". Merge "Radar Display" settings into the appropriate cards (axis-related into "Axis", dot-related into "Series Appearance"). Merge Axis Formatting shared card content with the radar-specific axis settings.

---

### 3. Radial Gauge

**Current card count:** 16 top-level cards
**Current card order:**
1. Arc (7 slices -- thickness, trackColor, trackOpacity, zoneBorderWidth, zoneBorderOpacity, roundedCaps, startAngle)
2. Color Zones (5 slices)
3. Value (6 slices -- fontSize, fontColor, fontFamily, fontWeight, deltaPositiveColor, deltaNegativeColor)
4. Target (2 slices)
5. Needle (5 slices)
6. Card Style (4 slices)
7. Animation (2 slices)
8. Scale (6 slices -- showTicks, showLabels, majorTicks, minorTicks, majorTickColor, minorTickColor)
9. Arc Display (3 slices -- arcRange, segmented, segmentCount)
10. Comparison (2 slices -- showDelta, showSparkline)
11. Data Labels
12. Chart Title
13. Number Format
14. Conditional Formatting
15. Accessibility
16. Date Filter

**Issues found:**

1. **"Arc" and "Arc Display" are confusing siblings** -- Both control arc appearance but are separated by 7 other cards. `arcRange` (in Arc Display) is more fundamental than zone borders (in Arc), yet it is buried at position 9.
2. **"Value" card mixes font settings with delta colors** -- Delta positive/negative colors are comparison-related, not value font settings. They should live in "Comparison".
3. **"Comparison" card is too thin (2 slices)** -- `showDelta` and `showSparkline` without their related colors feels incomplete. The delta colors are stranded in "Value".
4. **Illogical ordering** -- "Scale" (card 8) and "Arc Display" (card 9) are deep in the list but are primary visual configuration. Users will likely configure these first.

**Proposed reorganization:**

| # | Card Name | Contents |
|---|-----------|----------|
| 1 | **Arc Shape** | thickness, roundedCaps, startAngle (preset), arcRange (degrees), segmented, segmentCount |
| 2 | **Arc Colors** | trackColor, trackOpacity, zoneBorderWidth, zoneBorderOpacity |
| 3 | **Color Zones** | zone1Threshold, zone1Color, zone2Threshold, zone2Color, zone3Color |
| 4 | **Center Value** | fontSize, fontColor, fontFamily, fontWeight |
| 5 | **Target** | show, color |
| 6 | **Needle** | show, color, width, showHub, hubRadius |
| 7 | **Scale & Ticks** | showTicks, showLabels, majorTicks, minorTicks, majorTickColor, minorTickColor |
| 8 | **Comparison** | showDelta, deltaPositiveColor, deltaNegativeColor, showSparkline |
| 9 | **Chart Title** | (shared card, unchanged) |
| 10 | **Conditional Formatting** | (shared card, unchanged) |
| 11 | **Card Style** | glass, backgroundColor, opacity, borderRadius |
| 12 | **Number Format** | (shared card, unchanged) |
| 13 | **Animation** | enabled, duration |
| 14 | **Date Filter** | (shared card, unchanged) |
| 15 | **Accessibility** | (shared card, unchanged) |

**Key changes:** Merge "Arc" + "Arc Display" into "Arc Shape" (all geometry together). Move delta colors from "Value" to "Comparison". Rename "Value" to "Center Value" for clarity. Reorder so shape/color/zones come first, then features, then shared cards. Drops from 16 to 15 cards.

---

### 4. Ring Stack

**Current card count:** 17 top-level cards
**Current card order:**
1. Ring (8 slices -- thickness, gap, maxValue, showLabels, trackColor, trackOpacity, ringStrokeColor, roundedCaps)
2. Ring Colors (6 slices -- ring1Color through ring6Color)
3. Center Content (7 slices)
4. Card Style (4 slices)
5. Animation (2 slices)
6. Per-Ring Scale (3 slices)
7. Ring Display (2 slices -- showArcLabels, showOverflow)
8. Ring Gradient (1 slice -- enabled toggle only)
9. Legend
10. Data Labels
11. Chart Title
12. Sort
13. Conditional Formatting
14. Accessibility
15. Color Theme
16. Number Format
17. Date Filter

**Issues found:**

1. **"Ring Gradient" card has only 1 slice** -- A single toggle with no configurable gradient endpoints is far too thin for a top-level card. Should be a toggle within the colors card.
2. **"Ring Display" card has only 2 slices** -- `showArcLabels` and `showOverflow` are orphaned features without enough weight for a card.
3. **"Ring" card mixes layout and colors** -- `thickness`, `gap`, `maxValue` are layout; `trackColor`, `trackOpacity`, `ringStrokeColor` are appearance; `showLabels` is a display toggle.
4. **Color-related settings are scattered across 4 cards** -- Ring Colors, Ring (trackColor, ringStrokeColor), Ring Gradient, Color Theme. Users hunting for color control must check 4 places.
5. **"Per-Ring Scale" is distant from "Ring"** -- These are related ring configuration features separated by 4 cards.

**Proposed reorganization:**

| # | Card Name | Contents |
|---|-----------|----------|
| 1 | **Ring Layout** | thickness, gap, maxValue, roundedCaps, perRingScale toggle, perRingMaxValues, showPercentage |
| 2 | **Ring Appearance** | ring1-6 colors, trackColor, trackOpacity, ringStrokeColor, gradient toggle + gradient start/end colors |
| 3 | **Labels & Display** | showLabels, showArcLabels, showOverflow |
| 4 | **Center Content** | show, displayMode, customText, fontSize, fontColor, showLabel, labelFontSize |
| 5 | **Chart Title** | (shared card, unchanged) |
| 6 | **Legend** | (shared card, unchanged) |
| 7 | **Conditional Formatting** | (shared card, unchanged) |
| 8 | **Card Style** | glass, backgroundColor, opacity, borderRadius |
| 9 | **Color Theme** | theme picker |
| 10 | **Sort** | (shared card, unchanged) |
| 11 | **Animation** | enabled, duration |
| 12 | **Number Format** | (shared card, unchanged) |
| 13 | **Data Labels** | (shared card, unchanged) |
| 14 | **Date Filter** | (shared card, unchanged) |
| 15 | **Accessibility** | (shared card, unchanged) |

**Key changes:** Absorb "Ring Gradient" (1 slice) and "Ring Colors" into "Ring Appearance". Merge "Per-Ring Scale" into "Ring Layout". Merge "Ring Display" (2 slices) into "Labels & Display". Drops from 17 to 15 cards, with all color controls in one place.

---

### 5. Sankey Diagram

**Current card count:** 19 top-level cards
**Current card order:**
1. Nodes (18 slices!)
2. Links (6 slices)
3. Link Labels (5 slices)
4. Totals (6 slices)
5. Layout (3 slices)
6. Tooltips (3 slices)
7. Card Style (4 slices)
8. Animation (2 slices)
9. Interaction (3 slices)
10. Link Features (3 slices)
11. Legend
12. Data Labels
13. Scroll
14. Chart Title
15. Conditional Formatting
16. Accessibility
17. Color Theme
18. Number Format
19. Date Filter

**Issues found:**

1. **"Nodes" card is extremely overloaded (18 slices)** -- Mixes node dimensions (width, padding, cornerRadius, opacity, minHeight), label typography (fontSize, fontFamily, fontWeight, fontStyle), label position, a global label color, 6 per-step label colors, and node border settings. This is the worst offender in all 5 visuals.
2. **"Links" and "Link Features" are confusing duplicates** -- "Links" has opacity/hoverOpacity/colorMode/curvature, and "Link Features" has gradientLinks/opacityByValue/showFlowLabels. Both control link behavior. Users will not know which card to open.
3. **"Link Labels" is a separate card from "Links"** -- These are conceptually the same feature area. "Link Labels" could be a sub-section of "Links".
4. **Too many top-level cards (19)** -- The longest flat list of all visuals analyzed.
5. **Per-step label colors are a labeling concern, not a node concern** -- Having 6 step-specific color pickers mixed with node width/padding/borderWidth creates a confusing 18-item card.

**Proposed reorganization:**

| # | Card Name | Contents |
|---|-----------|----------|
| 1 | **Node Shape** | width, padding, cornerRadius, opacity, minHeight, nodeBorderColor, nodeBorderWidth |
| 2 | **Node Labels** | labelPosition, labelFontSize, labelFontFamily, labelFontWeight, labelFontStyle, labelColor (global), sourceLabelColor, step2-5LabelColor, targetLabelColor |
| 3 | **Links** | opacity, hoverOpacity, dimOpacity, colorMode, customColor, curvature, gradientLinks, opacityByValue |
| 4 | **Link Labels** | showLinkLabels, linkLabelFontSize, linkLabelFontColor, linkLabelFontWeight, linkLabelFormat, showFlowLabels (moved from Link Features) |
| 5 | **Totals** | showNodeValues, nodeValueFormat, showLayerTotals, layerTotalPosition, totalFontSize, totalFontColor |
| 6 | **Layout** | nodeAlign, sortOrder, iterations |
| 7 | **Chart Title** | (shared card, unchanged) |
| 8 | **Legend** | (shared card, unchanged) |
| 9 | **Tooltips** | showTooltips, showPercentage, valueFormat |
| 10 | **Interaction** | highlightFlows, enableDrag, enableFiltering |
| 11 | **Conditional Formatting** | (shared card, unchanged) |
| 12 | **Card Style** | cardStyleMode, backgroundColor, opacity, borderRadius |
| 13 | **Color Theme** | theme picker |
| 14 | **Animation** | enabled, duration |
| 15 | **Scroll** | (shared card, unchanged) |
| 16 | **Number Format** | (shared card, unchanged) |
| 17 | **Date Filter** | (shared card, unchanged) |
| 18 | **Accessibility** | (shared card, unchanged) |

**Key changes:** Split mega "Nodes" (18 slices) into "Node Shape" (7 slices) and "Node Labels" (11 slices). Merge "Link Features" into "Links" and "Link Labels" respectively. Drops from 19 to 18 cards but the real win is breaking the 18-slice Nodes card and eliminating the confusing Links/Link Features split.

---

## Summary Table

| Visual | Current Cards | Proposed Cards | Worst Issue |
|--------|:---:|:---:|---|
| progress-bar-stack | 18 | 16 | Color settings scattered across 4 cards |
| radar-chart | 17 | 16 | "Radar" card overloaded with 10 mixed-concern slices |
| radial-gauge | 16 | 15 | "Arc" and "Arc Display" confusingly split |
| ring-stack | 17 | 15 | "Ring Gradient" card has 1 lonely slice |
| sankey-diagram | 19 | 18 | "Nodes" card has 18 slices mixing 4 concerns |
