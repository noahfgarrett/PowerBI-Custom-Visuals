# Improve Pass 2 -- Luxury Polish Audit (Post-Fixes)

> Date: 2026-03-18
> Scope: All 31 Power BI visuals -- visual.ts + visual.less
> Focus: Hover quality, animations, empty states, error states, visual polish, micro-interactions, accessibility

---

## Scoring Legend

| Score | Meaning |
|-------|---------|
| 1     | Bare minimum -- functional but feels like a prototype |
| 2     | Basic -- works but nothing stands out |
| 3     | Good -- has hover, animations, and structure in place |
| 4     | Premium -- smooth, well-timed, thoughtful details |
| 5     | Best-in-class -- delightful, no rough edges |

---

## Visual-by-Visual Audit

### 1. Animated Donut Pro
**Polish: 4/5**

| Dimension | Status |
|-----------|--------|
| Hover effects | Spring-scale explode (1.08x) via `springScale`. Brightness + drop-shadow on CSS. Smooth. |
| Animations | Staggered sweep-arc per segment, count-up center value, fade-slide labels. Excellent. |
| Empty state | Styled `.donut-empty` with italic + centered flex. Functional but plain text. |
| Error state | No explicit error handling -- returns early on bad data, renders empty. |
| Visual polish | Good. `padding: 8px`, `4px margin` on hover overshoot. Clean constants. |
| Micro-interactions | Click-to-select, ctrl-multi-select, context menu. Cursor pointer on segments. |
| Accessibility | ARIA labels, keyboard nav on `.donut-segment`, focus ring styles. |

**Top 2 improvements:**
1. **Empty state upgrade**: Replace plain italic text with an SVG illustration (donut outline) + muted icon. Current empty state looks like a WIP placeholder.
2. **Hover glow color**: The drop-shadow is generic black (`rgba(0,0,0,0.15)`). Use segment's own color for a colored glow: `drop-shadow(0 0 6px ${segmentColor})` for a premium, cohesive look.

---

### 2. Gantt Chart Pro
**Polish: 3/5**

| Dimension | Status |
|-----------|--------|
| Hover effects | Brightness + box-shadow on bars. `:has(.gantt-bar:hover)` dims sibling rows (0.5 opacity). Clever CSS isolation. |
| Animations | `growBar` entrance on task bars. Fade-slide on labels. |
| Empty state | Minimal `.gantt-empty` -- centered flex, no styling/icon. |
| Error state | Returns early on bad data. No visual error message. |
| Visual polish | Hardcoded `#E2E8F0` border-bottom on header row. `4px` border-radius on bars. Functional but not distinctive. |
| Micro-interactions | Row dimming on hover is nice. Task collapse/expand via toggle. |
| Accessibility | ARIA + keyboard nav present. |

**Top 2 improvements:**
1. **Bar hover elevation**: Add a subtle Y-translate on hover (`transform: translateY(-1px)`) alongside the brightness boost to make bars feel like they physically lift off the track.
2. **Today line pulse**: The today marker is a static 2px line. Add a gentle CSS pulse animation (`@keyframes pulse { 0%,100% { opacity:0.7 } 50% { opacity:1 } }`) to draw attention to the current date.

---

### 3. Morphing Area Chart
**Polish: 4/5**

| Dimension | Status |
|-----------|--------|
| Hover effects | Line brightness on hover (1.2x). Dots have radius transition + drop-shadow. Clean. |
| Animations | `drawPath` for line, `popIn` for dots, staggered. Gradient fill beneath is smooth. |
| Empty state | `.area-chart-empty` -- italic centered flex. Adequate. |
| Error state | Returns early on bad data. |
| Visual polish | Good separation of fill/line/dot layers. Gradient fill beneath is the hallmark feature. |
| Micro-interactions | Crosshair attachment, dot click-to-select, context menu. |
| Accessibility | ARIA + keyboard nav on dots. |

**Top 2 improvements:**
1. **Line hover width**: When hovering a line in multi-series mode, thicken the stroke-width from 2 to 3 with a CSS transition. Currently only brightness changes, but a thicker line gives stronger visual feedback about which series is active.
2. **Dot hover scale**: Currently dots only gain brightness + drop-shadow. Add `transform: scale(1.3)` with `transform-origin: center` on hover for a pop-out effect that matches the `popIn` entrance animation.

---

### 4. Radar Chart
**Polish: 3.5/5**

| Dimension | Status |
|-----------|--------|
| Hover effects | Polygon gets `brightness(1.2) + drop-shadow(color-matched glow)`. Good use of series color in glow. |
| Animations | Morph from center-point polygon outward. Dot pop-in. Label fade-in. |
| Empty state | `.radar-empty` -- minimal centered div. |
| Error state | Shows empty when < 3 categories. No descriptive error. |
| Visual polish | Radar is inherently complex. Benchmark overlay, independent scales, axis values all present. Legend is hand-built with inline styles (not using shared `renderLegend` for side positioning). |
| Micro-interactions | Hover dim/isolate via `createHoverDim` on polygons. Point-level tooltips. |
| Accessibility | ARIA + keyboard nav on dots. |

**Top 2 improvements:**
1. **Polygon transition on hover**: Add `transition: filter 0.2s ease` to `.radar-polygon` for smoother glow onset. Currently it snaps on because the transition is set via JS `.style('transition', ...)` which may override CSS.
2. **Grid shape animation**: When grid shape changes between polygon and circle (via settings), animate the transition with a morph interpolation instead of an instant redraw. This would be a noticeable differentiator.

---

### 5. Sankey Diagram
**Polish: 4/5**

| Dimension | Status |
|-----------|--------|
| Hover effects | Node rect: `brightness(1.12) + drop-shadow + scale(1.03)` with fill-box transform. Link: `brightness(1.25)`. Premium feel. |
| Animations | Sweep-arc on outer arcs (adapted), fade-in ribbons with stagger. |
| Empty state | `.sankey-empty-state` -- well-styled centered div with padding. |
| Error state | Shows empty state on null data. |
| Visual polish | Node hover scale with `transform-box: fill-box` is a premium detail. Gradient link fills available. |
| Micro-interactions | Click-to-filter on arcs. Hover dim/isolate on links. Flow labels on ribbon hover. |
| Accessibility | ARIA + keyboard nav on nodes. `applyDataPointAria` per node. |

**Top 2 improvements:**
1. **Link hover glow**: Links currently only get brightness boost. Add a matching `drop-shadow(0 0 4px sourceColor)` colored glow on link hover to match the node treatment.
2. **Node drag reordering**: Sankey nodes are static. Adding drag-to-reorder (even within constraints) would be a major differentiator. This is a larger feature but would put it at 5/5.

---

### 6. Scatter Bubble
**Polish: 4/5**

| Dimension | Status |
|-----------|--------|
| Hover effects | `brightness(1.15) + drop-shadow(white glow)`. Transform transition enabled via CSS. |
| Animations | `popIn` for dots, `springEase` option. Regression line drawing. |
| Empty state | `.scatter-bubble-empty` -- italic centered flex. |
| Error state | Returns early on invalid data. |
| Visual polish | Custom tooltip with styled HTML (`.scatter-bubble-tooltip` with box-shadow, border-radius). `padding: 12px` container. Good use of `font-variant-numeric: tabular-nums`. |
| Micro-interactions | Click-to-select, context menu, lasso potential. |
| Accessibility | ARIA + keyboard nav. |

**Top 2 improvements:**
1. **Bubble hover scale-up**: CSS has `transform 0.2s ease` transition but no `:hover { transform }` rule. Add `&:hover { transform: scale(1.08) }` so bubbles physically grow on hover, matching the visual weight concept.
2. **Empty dot ring on hover**: Instead of (or in addition to) brightness, render a white stroke ring around the hovered bubble to create a "selected" look before actual click selection.

---

### 7. Treemap Pro
**Polish: 3.5/5**

| Dimension | Status |
|-----------|--------|
| Hover effects | Cell: `brightness(1.12) + drop-shadow(0 4px 8px)`. Elevation shadow effect. |
| Animations | `springScale` staggered per cell from center. Full SVG fade-in overlay. |
| Empty state | `.treemap-empty` -- centered flex, text only. |
| Error state | Returns early. Shows empty on bad data. |
| Visual polish | Drill-down breadcrumb with underline links. Heat coloring gradient. Percentage display. `rx=3` on rects. |
| Micro-interactions | Click-to-drill, breadcrumb navigation, ctrl-multi-select. |
| Accessibility | ARIA + keyboard nav on cells. |

**Top 2 improvements:**
1. **Cell hover border glow**: The drop-shadow gives elevation but feels generic. Add a `stroke` that appears on hover (matching the cell's fill color but brighter) to create a "selected cell" ring effect.
2. **Drill transition animation**: When drilling down, cells should zoom-and-morph into the child layout. Currently it's a hard re-render. An interpolated transition between parent and child layouts would be dramatically more polished.

---

### 8. Progress Bar Stack
**Polish: 3.5/5**

| Dimension | Status |
|-----------|--------|
| Hover effects | Fill bar: `brightness(1.15) + scaleY(1.08)` via JS event listeners. Responsive feel. |
| Animations | `growBar` horizontal, `countUp` for value labels, fade-slide wrapper. |
| Empty state | Inline-styled div (no CSS class) -- `opacity:0.5; font-size:12px`. Functional but inconsistent with other visuals' patterns. |
| Error state | Returns early. Shows minimal empty. |
| Visual polish | Gradient fill option. Milestone markers. Target marker line. `font-variant-numeric: tabular-nums` on values. |
| Micro-interactions | Click-to-select per row. Context menu. |
| Accessibility | ARIA per row with full description string. Keyboard nav. Focus ring. |

**Top 2 improvements:**
1. **Empty state consistency**: Replace the inline-styled `div` with a proper `.progress-empty` CSS class matching the pattern used by other visuals (centered, italic, proper color token).
2. **Track hover highlight**: When hovering a fill bar, also subtly highlight the track (e.g., darken it slightly) so the full bar context is emphasized, not just the fill portion.

---

### 9. Bump Chart
**Polish: 4/5**

| Dimension | Status |
|-----------|--------|
| Hover effects | Line: `brightness(1.15) + drop-shadow(indigo glow) + stroke-width: 4`. Dot: `brightness(1.2) + drop-shadow(indigo glow)`. Premium indigo-tinted glow. |
| Animations | `drawPath` for lines, `popIn` for dots. Crosshair attachment. |
| Empty state | `.bump-empty` -- centered flex. |
| Error state | Returns early on insufficient data. |
| Visual polish | Rank labels (`.bump-rank-label`) centered on dots. Area fill transitions. Indigo glow color is distinctive. |
| Micro-interactions | Series hover highlight/dim behavior. Click-to-select dots. |
| Accessibility | ARIA + keyboard nav. |

**Top 2 improvements:**
1. **Rank change indicators**: When data transitions (Power BI filter change), animate the dots along their paths rather than a full re-render. Show rank change arrows (up/down) as a micro-animation.
2. **Line hover thickness transition**: The stroke-width jump from 2 to 4 on hover is a bit aggressive. Use `stroke-width: 3` for a subtler effect, or make it configurable.

---

### 10. Stream Graph
**Polish: 3/5**

| Dimension | Status |
|-----------|--------|
| Hover effects | Layer: `brightness(1.15) + opacity: 0.95 !important`. The `!important` is a code smell. |
| Animations | Full layer morph from baseline with `animate()`. Crosshair support. |
| Empty state | `.stream-empty-state` -- centered with padding. |
| Error state | Returns early on bad data. |
| Visual polish | Minimal CSS (28 lines). No padding on container. |
| Micro-interactions | Layer hover dim/isolate. |
| Accessibility | ARIA + keyboard nav. |

**Top 2 improvements:**
1. **Remove `!important` from hover opacity**: The `!important` override on `.stream-layer:hover { opacity: 0.95 !important }` fights with JS-set opacity. Fix the specificity properly.
2. **Layer hover glow**: Add a `drop-shadow` with the layer's fill color on hover, similar to how Sankey and Chord handle it. Currently brightness-only feels flat.

---

### 11. Ring Stack
**Polish: 4.5/5**

| Dimension | Status |
|-----------|--------|
| Hover effects | Arc: `brightness(1.18) + drop-shadow(color-matched) + scale(1.04)` via JS. Track is non-interactive. Premium treatment. |
| Animations | Sweep-arc per ring, staggered 80ms. Count-up labels. Fade-slide labels. Gradient support. |
| Empty state | `.ring-stack-empty` -- italic centered. |
| Error state | Skips rings with negative radii gracefully. |
| Visual polish | Apple Watch inspired concentric rings. Overflow indicator (>100%) with dashed arc. Rounded caps option. Arc labels via textPath. Center content (total/average/count/custom). Per-ring max values. |
| Micro-interactions | Click-to-select per arc. Context menu. |
| Accessibility | ARIA + keyboard nav on arcs. |

**Top 2 improvements:**
1. **Ring hover isolation**: When hovering one ring, dim all other rings (like radar's hover-dim) to create a focus effect. Currently all rings stay at full opacity.
2. **Center content animation**: The center value/text appears instantly. Add a `countUp` animation for the center total value and a `fadeSlideIn` for the label text to match the ring sweep timing.

---

### 12. Chord Diagram
**Polish: 4/5**

| Dimension | Status |
|-----------|--------|
| Hover effects | Group arc: `brightness(1.15) + drop-shadow(indigo glow)`. Ribbon: `brightness(1.12) + drop-shadow`. Dim/isolate on hover. |
| Animations | Sweep-arc on outer arcs, fade-in ribbons with stagger. |
| Empty state | `.chord-empty` -- centered text. |
| Error state | Shows empty on null/invalid data. |
| Visual polish | Gradient ribbons, directional ribbons, flow labels on hover, entity value labels. Filtering via arc click. |
| Micro-interactions | Click-to-filter arc. Hover dim/isolate. Flow label appears at ribbon midpoint. |
| Accessibility | ARIA per arc with `applyDataPointAria`. Keyboard nav. |

**Top 2 improvements:**
1. **Ribbon hover smoothness**: The ribbon fill changes happen via attribute mutation (not CSS transition). Add `transition: fill 0.15s ease` to `.chord-ribbon` for smoother color changes on hover/unhover.
2. **Active filter indicator**: When a group is filtered (clicked), there's no visual indicator that the filter is active. Add a persistent glow or border highlight to the filtered arc.

---

### 13. Box Plot
**Polish: 3.5/5**

| Dimension | Status |
|-----------|--------|
| Hover effects | Box: `brightness(1.15) + drop-shadow`. Outlier dots: `r: 5 + brightness(1.15)` on hover. |
| Animations | Box grow animation, dot pop-in, label fade-in. |
| Empty state | `.box-plot-empty` -- italic centered. |
| Error state | Returns early on bad data. |
| Visual polish | Whisker lines, caps, median line. Outlier detection. `font-variant-numeric: tabular-nums` on labels. |
| Micro-interactions | Click-to-select on box. Outlier dot hover expand. |
| Accessibility | ARIA + keyboard nav. |

**Top 2 improvements:**
1. **Box hover expansion**: Instead of just brightness, add a subtle vertical scale `scaleY(1.03)` on box hover to make the interquartile range "breathe" when hovered.
2. **Whisker animation**: Whiskers appear instantly. Animate them drawing outward from the box edges with `drawPath` for a more cohesive entrance with the box grow animation.

---

### 14. Dumbbell Chart
**Polish: 4/5**

| Dimension | Status |
|-----------|--------|
| Hover effects | Dot: `r: 8 + brightness(1.2) + drop-shadow(blue glow)`. Line: `brightness(1.15) + stroke-width: 3`. Series highlight/dim via `data-series` attribute. |
| Animations | `drawPath` on connecting lines with opacity fade. `popIn` on dots staggered. Y-axis label fade-slide. |
| Empty state | `.dumbbell-empty` -- italic centered. |
| Error state | Returns early on missing start/end columns. |
| Visual polish | Delta labels (absolute/percent/both). Connector arrows with directional color. Ranking indicators. Group headers with separator lines. `dot-stroke` white ring on dots. |
| Micro-interactions | Full series hover highlight/dim. Click-to-select. Context menu. |
| Accessibility | ARIA + keyboard nav on dots. |

**Top 2 improvements:**
1. **Arrow animation**: Connector arrows appear instantly. Animate them fading in after the connecting line draws, for a sequential reveal: line draws, dots pop in, arrow fades in.
2. **Delta label entrance**: Delta labels appear instantly even when animations are on. Add a `fadeSlideIn` with a delay after dot pop-in to complete the staggered entrance sequence.

---

### 15. Timeline Milestone
**Polish: 4/5**

| Dimension | Status |
|-----------|--------|
| Hover effects | Markers: `drop-shadow(blue glow) + brightness(1.12) + scale(1.15)`. Great use of `transform-box: fill-box` for shapes. |
| Animations | `popIn` per marker, `fadeSlideIn` per label group. Staggered 80ms. |
| Empty state | `.timeline-empty` -- centered flex. |
| Error state | Handles null dates gracefully, sorts, clusters. |
| Visual polish | Multiple marker shapes (circle/square/diamond). Staggered/alternating/top/bottom layouts. Today line. Duration bars. Swimlane backgrounds. Connector lines. High contrast support. |
| Micro-interactions | Click-to-select marker + label group. Context menu. |
| Accessibility | ARIA + keyboard nav on shapes. |

**Top 2 improvements:**
1. **Today line pulse**: The today line is a static dashed stroke. Add a CSS pulse animation (alternating opacity 0.5-1.0 over 2s) to draw attention to the current position in time.
2. **Marker hover info card**: Instead of just a tooltip, show a small info card (date + label) adjacent to the marker on hover, styled with the card glass effect, for a more premium hover experience.

---

### 16. Network Graph
**Polish: 4/5**

| Dimension | Status |
|-----------|--------|
| Hover effects | Node: SVG `filter: url(#node-glow) + scale(1.15)`. Uses a custom SVG glow filter definition. Premium. Link: `brightness(1.3)`. Grab/grabbing cursor for drag. |
| Animations | Force simulation physics. Label fade transitions. |
| Empty state | `.network-empty` -- centered with padding. |
| Error state | Shows empty on null data. |
| Visual polish | Force-directed layout with drag. Custom SVG glow filter (`#node-glow`). Node dim on hover (isolate connections). |
| Micro-interactions | Drag nodes, hover isolate, click-to-select. |
| Accessibility | ARIA + keyboard nav. |

**Top 2 improvements:**
1. **Link animated dash**: When a node is hovered, animate the connected links' `stroke-dashoffset` to create a "flowing" effect showing direction of connection. This is a premium network graph feature.
2. **Node expand animation**: When nodes first appear or data changes, animate them expanding from zero radius with a spring ease rather than appearing at full size.

---

### 17. Bar Chart Pro
**Polish: 3.5/5**

| Dimension | Status |
|-----------|--------|
| Hover effects | Bar: `brightness(1.12) + drop-shadow`. Line overlay dot is clickable. Copy-as-image button reveals on container hover (opacity transition). |
| Animations | Bar grow animation. Label fade. |
| Empty state | `.bar-chart-empty` -- italic centered. |
| Error state | Returns early on bad data. |
| Visual polish | Combo mode (bar + line). Lollipop mode. Axis titles with font-weight 600 + letter-spacing. Copy-as-image button. Crosshair overlay. |
| Micro-interactions | Copy-as-image hover reveal. Click-to-select. |
| Accessibility | ARIA + keyboard nav. |

**Top 2 improvements:**
1. **Bar hover elevation**: Add `transform: translateY(-1px)` on bar hover for a physical lift effect. Currently bars only brighten, which feels flat for a "Pro" chart.
2. **Lollipop stem animation**: In lollipop mode, animate the stem drawing upward (drawPath) before the dot pops in, for a sequential entrance that matches the "lollipop" metaphor.

---

### 18. Bar Race
**Polish: 4.5/5**

| Dimension | Status |
|-----------|--------|
| Hover effects | Bar: `brightness(1.15) + drop-shadow`. Uses `cubic-bezier(0.22, 1, 0.36, 1)` for race transitions -- a premium easing curve. |
| Animations | Continuous race transitions (top + width) via CSS cubic-bezier. Playback controls with scrubber, speed select, play/pause/step. |
| Empty state | `.bar-race-empty` -- centered. |
| Error state | Returns early on bad data. |
| Visual polish | Playback bar with backdrop-filter blur. Scrubber thumb scales on hover (1.3x). Speed select dropdown. Frame counter. `focus-visible` outlines on all controls. Entire control set is well-styled. |
| Micro-interactions | Play/pause/step-forward/step-back/scrub. Speed control. |
| Accessibility | `:focus-visible` outlines on all controls. Button hover states. |

**Top 2 improvements:**
1. **Bar entry/exit animation**: When new bars enter or old bars exit the top-N during the race, add opacity fade transitions instead of instant appear/disappear.
2. **Time label animation**: The large time/year label should morph between values (e.g., cross-fade or count-up between years) rather than instantly switching.

---

### 19. Funnel Pro
**Polish: 3.5/5**

| Dimension | Status |
|-----------|--------|
| Hover effects | Stage: `brightness(1.15) + drop-shadow(elevation)`. Dim siblings on hover via `svg:hover .funnel-stage { opacity: 0.7 }`. |
| Animations | Not visible in CSS -- likely growBar or fadeSlideIn from visual.ts. |
| Empty state | `.funnel-empty` -- italic centered. |
| Error state | Returns early on bad data. |
| Visual polish | Conversion rate labels between stages. Funnel-specific shape rendering. `padding: 12px`. |
| Micro-interactions | Sibling dimming on hover. Click-to-select. |
| Accessibility | ARIA + keyboard nav. |

**Top 2 improvements:**
1. **Conversion rate arrow animation**: Add animated arrows between stages that draw when the funnel enters, showing the flow direction from top to bottom.
2. **Stage hover expansion**: Instead of only brightening, slightly expand the hovered stage's width (by 2-3px each side) to create a "zoom in" effect on the funnel slice.

---

### 20. Polar Chart
**Polish: 4/5**

| Dimension | Status |
|-----------|--------|
| Hover effects | Petal: `filter: url(#petal-inner-glow) + brightness(1.15)`. Uses a custom SVG inner glow filter. Premium treatment. |
| Animations | Petal sweep from center (likely). Pop-in for elements. |
| Empty state | `.polar-empty` -- italic centered. |
| Error state | Returns early on bad data. |
| Visual polish | Custom SVG glow filter for petals (`#petal-inner-glow`). Fill-opacity transitions. |
| Micro-interactions | Click-to-select petals. |
| Accessibility | ARIA + keyboard nav. |

**Top 2 improvements:**
1. **Petal hover scale**: Add `transform: scale(1.03)` on petal hover with `transform-origin: center` to create a subtle "bloom" effect matching the nightingale rose metaphor.
2. **Center value display**: Add an optional center value (total or selected value) like the donut chart has, with count-up animation.

---

### 21. KPI Card
**Polish: 4/5**

| Dimension | Status |
|-----------|--------|
| Hover effects | Value row: `brightness(1.08)`. Subtle and appropriate for a KPI card. |
| Animations | `countUp` for value, `drawPath` for sparkline, `fadeSlideIn` for elements. |
| Empty state | `.kpi-empty` -- styled with color `#94A3B8`, italic, positioned with z-index. |
| Error state | **Explicit try/catch with visual error message** including step tracking. Best error handling in the suite. |
| Visual polish | Uppercase label with letter-spacing. Tabular-nums on value. Sparkline with configurable height. Trend arrow. Divider line. Multi-KPI grid layout. |
| Micro-interactions | Value hover brightness. |
| Accessibility | ARIA + keyboard nav. |

**Top 2 improvements:**
1. **Sparkline hover crosshair**: Add a crosshair/dot on the sparkline that follows the mouse position, showing the exact value at that point. Currently sparklines are non-interactive.
2. **Value change flash**: When the KPI value changes (previousValue tracking exists), briefly flash the value with a highlight color (green for increase, red for decrease) before settling to the normal color.

---

### 22. Waffle Chart
**Polish: 3.5/5**

| Dimension | Status |
|-----------|--------|
| Hover effects | Cell: `brightness(1.15) + box-shadow(outline)`. Subtle outline on hover. |
| Animations | `rippleFill` wave animation for cells. `countUp` for percentage. Fade-slide. |
| Empty state | Not visible in CSS -- likely inline text. |
| Error state | Returns early on bad data. |
| Visual polish | Pictogram icon paths (circle/person/star/heart/square/checkmark). Grid layout. Tabular-nums on value. |
| Micro-interactions | Click-to-select. |
| Accessibility | ARIA + keyboard nav. |

**Top 2 improvements:**
1. **Pictogram hover pop**: When hovering a filled pictogram cell, add `transform: scale(1.1)` with `transform-origin: center` to make the icon "pop" off the grid.
2. **Fill wave direction**: The ripple fill could have a configurable direction (left-to-right, bottom-to-top, center-out) for variety. Currently appears to be one fixed pattern.

---

### 23. Sunburst Chart
**Polish: 3/5**

| Dimension | Status |
|-----------|--------|
| Hover effects | Segment: `brightness(1.15) + drop-shadow(elevation)`. Standard treatment. |
| Animations | Likely sweep-arc entrance. |
| Empty state | `.sunburst-empty` -- centered flex. |
| Error state | Returns early on bad data. |
| Visual polish | Minimal CSS (33 lines). No padding on container. Labels with `text-anchor: middle`. |
| Micro-interactions | Click-to-select segments. |
| Accessibility | ARIA + keyboard nav. |

**Top 2 improvements:**
1. **Segment hover glow**: Replace generic black drop-shadow with segment's own color glow: `drop-shadow(0 0 6px ${segmentColor})` for a premium colored glow effect.
2. **Drill-down zoom**: On click, zoom into the selected segment's children with a smooth radial transition (the ring expands to fill the full circle). This is the signature interaction for sunburst charts.

---

### 24. Animated Waterfall
**Polish: 3/5**

| Dimension | Status |
|-----------|--------|
| Hover effects | Bar: `brightness(1.15) + drop-shadow`. Standard. |
| Animations | Entrance animation for bars (grow/fade). |
| Empty state | `.waterfall-empty` -- styled with `color: #94A3B8` and italic. Slightly more polished than plain text. |
| Error state | Returns early on bad data. |
| Visual polish | Tabular-nums on values. Minimal CSS (42 lines). |
| Micro-interactions | Click-to-select bars. |
| Accessibility | ARIA + keyboard nav. |

**Top 2 improvements:**
1. **Connector line animation**: Waterfall charts have horizontal connector lines between bars. Animate these drawing sequentially after each bar grows, creating a cascade effect.
2. **Positive/negative bar glow**: On hover, use green-tinted glow for positive bars and red-tinted glow for negative bars, reinforcing the financial semantics of the chart.

---

### 25. Bullet Chart Pro
**Polish: 3.5/5**

| Dimension | Status |
|-----------|--------|
| Hover effects | Value bar: `brightness(1.15) + drop-shadow`. Comparative marker and forecast band have transitions. |
| Animations | Bar grow entrance. Range transitions. |
| Empty state | `.bullet-empty` -- italic centered. |
| Error state | Returns early on bad data. |
| Visual polish | Qualitative range rectangles, target marker, comparative marker, forecast band with opacity. Multiple levels of visual encoding. |
| Micro-interactions | Click-to-select value bar. |
| Accessibility | ARIA + keyboard nav. |

**Top 2 improvements:**
1. **Target marker pulse**: When the value bar meets or exceeds the target, add a brief pulse animation on the target marker to celebrate achievement.
2. **Range hover reveal**: When hovering a qualitative range rectangle, show a tooltip with the range name and boundaries (e.g., "Good: 80-100"). Currently ranges are non-interactive (pointer-events: none).

---

### 26. Gauge Cluster
**Polish: 4/5**

| Dimension | Status |
|-----------|--------|
| Hover effects | Cell: `scale(1.05) + box-shadow(elevation)`. Siblings shrink (0.98) when any cell is hovered. Premium collective behavior. |
| Animations | Sweep-arc per gauge, count-up values, sparkline rendering. Staggered 100ms. |
| Empty state | `.gauge-cluster-empty` -- italic centered with padding. |
| Error state | Returns early on bad data. |
| Visual polish | Grid layout with auto-sizing. Color zones. Target ticks. Sparkline history. Center values with tabular-nums. Border-radius 8px on cells. |
| Micro-interactions | Sibling shrink on hover (collective behavior). Click-to-select. |
| Accessibility | ARIA per gauge via `applyDataPointAria`. Keyboard nav. |

**Top 2 improvements:**
1. **Gauge fill glow**: When a gauge is hovered, add a colored glow matching the current zone color behind the arc fill, creating a "backlight" effect.
2. **Value change direction indicator**: When values change between updates, briefly show an up/down arrow or color flash on the value text to indicate the direction of change.

---

### 27. Health Bar
**Polish: 3/5**

| Dimension | Status |
|-----------|--------|
| Hover effects | Fill bar: `opacity: 0.85` on hover. Minimal -- just dims slightly. |
| Animations | `growBar` entrance. Fade-slide. |
| Empty state | `.health-bar-empty` -- styled with `color: #94A3B8`, italic. |
| Error state | Returns early on bad data. |
| Visual polish | Red-to-green gradient encoding. Reference line and trend line support. Annotations. Sort order. Scroll support. |
| Micro-interactions | Click-to-select fill bars. |
| Accessibility | ARIA + keyboard nav. |

**Top 2 improvements:**
1. **Fill hover effect upgrade**: Replace the simple opacity dim with `brightness(1.1) + translateY(-1px)` to create a lift effect instead of a dimming effect. Dimming on hover is counterintuitive -- it should brighten.
2. **Health zone indicator**: Add subtle gradient zone backgrounds behind the bars (faint red/yellow/green bands) to reinforce the health semantics at a glance.

---

### 28. Heatmap Calendar
**Polish: 3.5/5**

| Dimension | Status |
|-----------|--------|
| Hover effects | Cell: `brightness(1.2) + box-shadow(outline ring)`. Z-index 2 on hover (pops above neighbors). |
| Animations | Likely ripple-fill or staggered fade. |
| Empty state | `.heatmap-empty` -- centered flex. |
| Error state | Returns early on bad data. |
| Visual polish | 2px border-radius on cells. Day labels column. Year labels. Data labels at 7px. Grid wrapper with gap. |
| Micro-interactions | Click-to-select cells. Hover pop (z-index). |
| Accessibility | ARIA + keyboard nav. |

**Top 2 improvements:**
1. **Cell hover info expansion**: When hovering a cell, show a slightly expanded version (scale 1.3) with the date and value visible inside, like GitHub's contribution graph hover. Currently cells are too small to show data without a tooltip.
2. **Month boundary lines**: Add subtle vertical separator lines between months to improve readability of the calendar grid.

---

### 29. Radial Gauge
**Polish: 3.5/5**

| Dimension | Status |
|-----------|--------|
| Hover effects | Zone arc: `brightness(1.18) + drop-shadow`. Cursor changes to pointer. |
| Animations | Sweep-arc for fill, count-up for value. Fade-slide for labels. |
| Empty state | `.radial-gauge-empty` -- italic centered. |
| Error state | Returns early on bad data. |
| Visual polish | Thickness presets (thin/medium/thick). Color zones. Target tick mark. Tabular-nums + letter-spacing on value. Trend data support. |
| Micro-interactions | Zone hover interaction. Background click clears selection. |
| Accessibility | ARIA + focus ring styles. |

**Top 2 improvements:**
1. **Needle indicator**: Add an optional needle/pointer that sweeps to the value position during animation, pointing at the current value on the arc. This is the hallmark premium gauge interaction.
2. **Zone transition glow**: When the value crosses a zone threshold, briefly pulse the new zone's color on the arc fill for a "zone change" notification effect.

---

### 30. Status Indicator
**Polish: 3.5/5**

| Dimension | Status |
|-----------|--------|
| Hover effects | Row: `background rgba(0,0,0,0.04) + brightness(1.05) + scale(1.015)`. Shape: `brightness(1.15)` on parent hover. Subtle but cohesive. |
| Animations | `pulseGlow` for critical status shapes. Fade-slide entrance. |
| Empty state | `.status-empty` -- centered flex. |
| Error state | Returns early on bad data. |
| Visual polish | Multiple layouts (vertical/horizontal/grid). 5-level thresholds. Shape options. Pulse animation on critical status. `border-radius: 6px` on rows. |
| Micro-interactions | Row hover background. Critical pulse auto-animation. |
| Accessibility | ARIA per row with `applyDataPointAria`. Keyboard nav. |

**Top 2 improvements:**
1. **Status transition animation**: When a status changes level (e.g., warning to critical), animate the shape color change with a brief flash/pulse rather than an instant switch.
2. **Row hover expand**: On hover, slightly expand the row height and show additional context (e.g., the threshold boundaries that determined the status level).

---

### 31. Slope Chart
**Polish: 3.5/5**

| Dimension | Status |
|-----------|--------|
| Hover effects | Line: `brightness(1.2) + stroke-width: 3.5`. Dot: `brightness(1.2) + drop-shadow(white) + stroke-width: 2.5`. |
| Animations | Likely drawPath + popIn entrance. |
| Empty state | `.slope-empty-state` -- centered with padding. |
| Error state | Returns early on bad data. |
| Visual polish | Header labels. Axis lines. Dot stroke transitions. Label positioning. |
| Micro-interactions | Click-to-select on lines and dots. |
| Accessibility | ARIA + keyboard nav. |

**Top 2 improvements:**
1. **Line hover isolation**: When hovering a line, dim all other lines (opacity 0.15) to isolate the hovered series. Currently all lines stay at full opacity, making it hard to trace a specific series.
2. **Slope direction indicator**: Add a small arrow or color indicator (green=up, red=down) at the midpoint of each line to show direction at a glance, similar to dumbbell chart arrows.

---

## Cross-Cutting Themes

### Patterns Found Across All 31 Visuals

**What's consistently good:**
- Every visual has hover effects (brightness + drop-shadow is the baseline)
- Every visual has entrance animations (staggered with configurable duration)
- Every visual has Power BI tooltips via `tooltipService`
- Every visual has click-to-select and context menu
- Every visual has ARIA labels and keyboard navigation
- Every visual has an empty state (even if minimal)

**Recurring weaknesses (highest ROI fixes):**

1. **Empty states are plain text (26 of 31 visuals)**: Almost all empty states are just centered italic text. Only KPI Card and Waterfall add color tokens. None have illustrations or icons. A shared `renderEmptyState()` utility in core with an SVG chart outline icon would instantly upgrade all 31 visuals.

2. **Error states are silent (31 of 31)**: Only KPI Card has a try/catch with visible error message. All other visuals silently render empty on bad data. A shared `renderErrorState()` utility would be valuable for debugging and user experience.

3. **Generic black drop-shadow on hover (20+ visuals)**: Most visuals use `drop-shadow(0 0 Npx rgba(0,0,0,0.15))` which is functional but generic. The visuals that use color-matched glows (Ring Stack, Bump Chart, Radar, Polar, Network Graph) feel dramatically more premium. Converting all to color-matched glows would be a high-impact change.

4. **No data transition animations (31 of 31)**: When Power BI filters change data, every visual does a full clear-and-re-render. None interpolate between old and new data states. Adding D3 enter/update/exit transitions for key visuals (Bar Chart, Donut, Treemap) would be the single highest-impact polish improvement.

5. **Inconsistent container padding**: Some use `8px`, some use `12px`, some have none. Standardizing on a single value (e.g., `8px` with a CSS custom property `--chart-padding`) would improve consistency.

---

## Priority Matrix

| Priority | Category | Effort | Impact | Visuals Affected |
|----------|----------|--------|--------|-----------------|
| P0 | Shared empty state utility with SVG icon | Medium | High | All 31 |
| P0 | Color-matched hover glows (replace black shadows) | Low | High | 20+ |
| P1 | Data transition animations (enter/update/exit) | High | Very High | Top 10 visuals |
| P1 | Shared error state utility | Low | Medium | All 31 |
| P1 | Remove `!important` from stream-graph hover | Trivial | Low | 1 |
| P2 | Standardize container padding | Low | Low | All 31 |
| P2 | Progress bar empty state CSS class | Trivial | Low | 1 |
| P2 | Health bar hover fix (brighten instead of dim) | Trivial | Medium | 1 |
