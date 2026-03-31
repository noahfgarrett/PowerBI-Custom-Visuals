# Feature Improvement Report — Batch 1

**Date:** 2026-03-18
**Visuals:** animated-donut-pro, animated-waterfall, bar-race, box-plot, bullet-chart-pro, bump-chart

---

## Deliverable 1: Luxury Feature Additions

---

### 1. Animated Donut Pro

#### 1A. Gradient Arc Fills
**Description:** Allow each donut segment to use a radial or linear gradient instead of flat color. The gradient interpolates from the segment's assigned color to a lighter or darker shade, giving each slice a polished, dimensional look.
**Files to modify:** `packages/animated-donut-pro/src/visual.ts` (arc rendering), `packages/animated-donut-pro/src/settings.ts` (new `gradientMode` dropdown: none / radial / linear), `packages/animated-donut-pro/capabilities.json`
**Effort:** Medium

#### 1B. Hover Glow Ring
**Description:** On segment hover, render a soft, colored glow ring (SVG filter: feGaussianBlur + feComposite) behind the hovered arc. This replaces the current spring-scale effect with a more subtle, premium luminance effect that doesn't shift layout.
**Files to modify:** `packages/animated-donut-pro/src/visual.ts` (attachHoverEffect, SVG defs for glow filter)
**Effort:** Small

#### 1C. Sparkline-in-Tooltip
**Description:** When a user hovers over a segment, the tooltip includes a tiny sparkline showing that category's value trend over the last N data refreshes (cached locally). This turns a static donut into a data-storytelling tool without leaving the hover context.
**Files to modify:** `packages/animated-donut-pro/src/visual.ts` (tooltip rendering, local cache of prior values), `packages/core/src/` (new shared sparkline tooltip utility)
**Effort:** Large

#### 1D. Smart Label Auto-Rotate
**Description:** When labels collide (detected by bounding-box overlap), automatically rotate or stagger them radially so no text overlaps. Currently labels can overlap on small donuts or with many segments.
**Files to modify:** `packages/animated-donut-pro/src/visual.ts` (renderLabels collision detection + rotation logic)
**Effort:** Medium

#### 1E. Segment Selection Ripple
**Description:** When a user clicks a segment to select it, emit a brief concentric ripple animation (expanding ring) from the arc centroid using the segment's color at decreasing opacity. Provides satisfying click feedback.
**Files to modify:** `packages/animated-donut-pro/src/visual.ts` (click handler), `packages/core/src/` (shared ripple animation utility)
**Effort:** Small

---

### 2. Animated Waterfall

#### 2A. Smooth Value Change Transitions
**Description:** When the underlying data updates (e.g., slicer change), morph bars from their old positions/sizes to new ones using D3 transitions instead of full re-render. This creates a fluid "data is alive" feeling.
**Files to modify:** `packages/animated-waterfall/src/visual.ts` (render method — implement enter/update/exit pattern with D3 transitions)
**Effort:** Large

#### 2B. Running Total Callout Line
**Description:** Draw a subtle dotted line connecting the tops of all bars showing the running cumulative total. Optionally label the running total at each step. This tells the waterfall story more clearly without the user needing to mentally sum values.
**Files to modify:** `packages/animated-waterfall/src/visual.ts` (new overlay after bar rendering), `packages/animated-waterfall/src/settings.ts` (new toggle + line style options), `packages/animated-waterfall/capabilities.json`
**Effort:** Medium

#### 2C. Bar Gradient Fills (Top-to-Bottom)
**Description:** Apply a subtle vertical gradient to each bar — slightly lighter at the top, full color at the bottom — adding a 3D depth effect that makes the waterfall look premium without being gaudy.
**Files to modify:** `packages/animated-waterfall/src/visual.ts` (SVG defs + gradient fill on bars)
**Effort:** Small

#### 2D. Peak/Valley Auto-Highlight
**Description:** Automatically detect the maximum positive and maximum negative steps and render a small callout badge (e.g., a star icon or bold outline) on those bars. Users instantly see the biggest movers without scanning.
**Files to modify:** `packages/animated-waterfall/src/visual.ts` (post-render highlight pass), `packages/animated-waterfall/src/settings.ts` (enable toggle, badge style)
**Effort:** Medium

#### 2E. Hover Brightness Shift
**Description:** On bar hover, apply a CSS brightness filter (filter: brightness(1.15)) and a subtle drop shadow to the hovered bar. Simple, performant, and feels polished compared to no hover feedback.
**Files to modify:** `packages/animated-waterfall/src/visual.ts` (bar mouseenter/mouseleave handlers), `packages/animated-waterfall/style/visual.less` (hover class styles)
**Effort:** Small

---

### 3. Bar Race

#### 3A. Entry/Exit Bar Flash
**Description:** When a new item enters the top-N ranking, its bar flashes bright (brief white overlay fading to color). When an item drops out, it fades to gray and slides off. This makes rank changes dramatic and instantly visible.
**Files to modify:** `packages/bar-race/src/visual.ts` (frame transition logic — detect entering/exiting items)
**Effort:** Medium

#### 3B. Crown/Medal Icons for Top 3
**Description:** Render small SVG medal icons (gold/silver/bronze circles or crown) next to the top 3 bars. These disappear smoothly when rank changes push items out of the top 3. Adds a competitive, gamified feel.
**Files to modify:** `packages/bar-race/src/visual.ts` (bar rendering loop), `packages/bar-race/src/settings.ts` (toggle: showMedals), `packages/bar-race/capabilities.json`
**Effort:** Small

#### 3C. Smooth Bar Reorder with Spring Physics
**Description:** Replace the current CSS transition-based reorder with spring-physics easing (critically damped spring). Bars overshoot slightly then settle, creating a satisfying organic motion when ranks change.
**Files to modify:** `packages/bar-race/src/visual.ts` (bar position update logic), `packages/core/src/` (spring interpolation utility)
**Effort:** Medium

#### 3D. Historical Sparkline Trail
**Description:** Behind each bar, render a faint sparkline showing that item's value over the last N time periods. This gives context — is the current leader rising or was it a one-time spike?
**Files to modify:** `packages/bar-race/src/visual.ts` (per-bar sparkline rendering), `packages/bar-race/src/settings.ts` (toggle + opacity setting)
**Effort:** Large

#### 3E. Progress Bar Overlay (% of Max)
**Description:** Draw a thin secondary bar underneath each main bar showing its value as a percentage of the all-time maximum. This provides context for how close the current leader is to the historical record.
**Files to modify:** `packages/bar-race/src/visual.ts` (secondary bar rendering), `packages/bar-race/src/settings.ts` (toggle)
**Effort:** Small

---

### 4. Box Plot

#### 4A. Hover Detail Expansion
**Description:** On box hover, smoothly expand the box vertically (spring animation) and reveal inline labels for Q1, Median, Q3, Min, Max values directly on the box. The box becomes self-documenting on interaction.
**Files to modify:** `packages/box-plot/src/visual.ts` (hover handlers, label rendering), `packages/box-plot/src/settings.ts` (toggle: showHoverDetails)
**Effort:** Medium

#### 4B. Gradient Box Fill
**Description:** Fill each box with a vertical gradient that transitions from the box color at Q1 to a lighter shade at Q3. The median line sits at a color inflection point. This visually communicates the distribution density.
**Files to modify:** `packages/box-plot/src/visual.ts` (SVG linearGradient defs per box)
**Effort:** Small

#### 4C. Outlier Pulse Animation
**Description:** Outlier dots gently pulse (scale 1.0 to 1.2 and back, repeating every 2s) to draw attention to data anomalies. The pulse stops on hover so the user can interact precisely.
**Files to modify:** `packages/box-plot/src/visual.ts` (outlier dot rendering — add CSS animation class), `packages/box-plot/style/visual.less` (keyframe animation)
**Effort:** Small

#### 4D. Statistical Summary Tooltip
**Description:** Enhance the tooltip to show a rich statistical summary: mean, std dev, IQR, skewness, and sample size — all formatted neatly in a mini table layout. Turns the box plot into a serious analytical tool.
**Files to modify:** `packages/box-plot/src/visual.ts` (tooltip data computation and rendering)
**Effort:** Medium

#### 4E. Category Comparison Highlight
**Description:** Click one box to select it, then all other boxes dim except the selected one. A horizontal dashed line extends from the selected box's median across all categories, making cross-category comparison effortless.
**Files to modify:** `packages/box-plot/src/visual.ts` (selection handler, comparison line rendering)
**Effort:** Medium

---

### 5. Bullet Chart Pro

#### 5A. Target Achievement Glow
**Description:** When the actual value exceeds the target, apply a green glow effect (SVG filter) to the value bar. When below target, apply a subtle red tint. Provides at-a-glance status without needing to read numbers.
**Files to modify:** `packages/bullet-chart-pro/src/visual.ts` (post-render conditional glow), `packages/bullet-chart-pro/src/settings.ts` (toggle: showAchievementGlow)
**Effort:** Small

#### 5B. Percentage Achievement Label
**Description:** Show a small badge next to each bullet displaying "87%" (actual/target ratio) with color coding (red < 80%, yellow 80-99%, green >= 100%). More informative than just the raw value.
**Files to modify:** `packages/bullet-chart-pro/src/visual.ts` (label rendering after value bar), `packages/bullet-chart-pro/src/settings.ts` (toggle + threshold settings)
**Effort:** Medium

#### 5C. Micro Trend Sparkline
**Description:** If historical data is available, render a tiny sparkline inside the qualitative range area showing the value trend over time. This turns the bullet from a point-in-time snapshot into a temporal story.
**Files to modify:** `packages/bullet-chart-pro/src/visual.ts` (sparkline SVG path rendering in range background)
**Effort:** Large

#### 5D. Smooth Range Gradient Transitions
**Description:** Instead of hard color boundaries between poor/satisfactory/good ranges, blend them with smooth CSS gradients. The transition zones create a more organic, less clinical appearance.
**Files to modify:** `packages/bullet-chart-pro/src/visual.ts` (range rect rendering — use linearGradient SVG elements instead of flat fills)
**Effort:** Small

#### 5E. Target Marker Bounce-In
**Description:** When animations are enabled, the target marker line drops in from above with a bounce easing (overshoot then settle). Combined with the existing bar grow animation, this creates a two-phase entrance that draws attention to the target.
**Files to modify:** `packages/bullet-chart-pro/src/visual.ts` (target marker animation), `packages/core/src/` (bounce easing utility if not present)
**Effort:** Small

---

### 6. Bump Chart

#### 6A. Rank Change Swoosh Trail
**Description:** When a line moves between ranks, render a brief swoosh trail (fading ghost of the line) along its old path. This motion blur effect makes rank transitions feel dynamic and cinematic.
**Files to modify:** `packages/bump-chart/src/visual.ts` (line transition rendering — clone old path, fade out)
**Effort:** Medium

#### 6B. Interactive Hover Focus Mode
**Description:** On line hover, the hovered series' line thickens and glows while all other lines fade to 10% opacity with a grayscale filter. Currently, the opacity dims to 20% but there is no glow or grayscale. Adding these creates a dramatic spotlight effect.
**Files to modify:** `packages/bump-chart/src/visual.ts` (series hover handlers — add SVG glow filter + grayscale on others)
**Effort:** Small

#### 6C. End-of-Line Item Labels
**Description:** At the rightmost time period, render the item name directly next to its final dot (right-aligned). This eliminates the need to cross-reference with the legend and makes the chart self-explanatory.
**Files to modify:** `packages/bump-chart/src/visual.ts` (label rendering after dots), `packages/bump-chart/src/settings.ts` (toggle: showEndLabels), `packages/bump-chart/capabilities.json`
**Effort:** Small

#### 6D. Animated Time Scrubber
**Description:** Add a subtle time-scrubber indicator that, when the user hovers across the x-axis, highlights the vertical time slice and shows all items' ranks at that point in a floating tooltip card. Like a crosshair but with a rich multi-series summary.
**Files to modify:** `packages/bump-chart/src/visual.ts` (overlay interaction layer — enhance existing crosshair), `packages/bump-chart/src/settings.ts` (configuration for summary card)
**Effort:** Medium

#### 6E. Smooth Curve Morphing on Data Change
**Description:** When data updates, morph existing lines to their new positions using D3 path interpolation rather than full re-draw. Lines slither into new positions organically.
**Files to modify:** `packages/bump-chart/src/visual.ts` (render method — implement D3 join with transition on path 'd' attribute)
**Effort:** Large

---

## Deliverable 2: Settings Organization Audit

---

### 1. Animated Donut Pro

**Current card order (16 cards):**
1. Donut Settings
2. Center Value
3. Card Style
4. Animation
5. Top N / Others
6. Nested Rings
7. Exploded Segments
8. Label Format
9. Legend
10. Data Labels
11. Chart Title
12. Conditional Formatting
13. Accessibility
14. Color Theme
15. Number Format
16. Date Filter

**Issues identified:**
- **Scattered label settings**: Label format content is in "Label Format" (card 8) but label font styling is in "Data Labels" (card 10) and "Donut Settings" has hidden labelColor/labelFontSize. Three places for label config.
- **Too many top-level cards**: 16 cards is excessive. Nested Rings, Exploded Segments, and Label Format could be sub-groups under Donut Settings.
- **Illogical ordering**: Color Theme is buried at position 14 but affects the entire visual's appearance. Number Format is at 15 but affects every displayed value.
- **Center Value separated from Donut Settings**: The center value display is intrinsically part of the donut's core appearance but is a separate card.

**Recommended card order:**
```
1. Donut Settings — Core donut geometry and behavior
   - Inner Radius (%)
   - Arc Shape
   - Show Center Value
   - Show Labels
   - Segment Stroke Color
   - Segment Stroke Width

2. Center Value — Center display formatting (visible when Show Center Value is on)
   - Font Size
   - Font Color
   - Prefix
   - Suffix
   - Decimal Places

3. Label Format — How labels appear on segments
   - Label Format (Category/Value/Percent/Both)
   - Connector Lines

4. Color Theme — Overall color palette
   - Theme

5. Top N / Others — Data reduction
   - Enable Top N
   - Top N
   - Others Label
   - Others Color
   - Sort By

6. Animation — Entrance effects
   - Enable Animations
   - Duration (ms)

7. Legend — Legend display and styling
   - (shared card)

8. Data Labels — Label typography
   - (shared card)

9. Chart Title — Title and subtitle
   - (shared card)

10. Number Format — Value display units
    - (shared card)

11. Card Style — Container appearance
    - Card Style Mode
    - Background Color
    - Background Opacity
    - Border Radius

12. Nested Rings — Advanced: multi-ring display
    - Enable Nested Rings
    - Inner Ring Field

13. Exploded Segments — Advanced: segment separation
    - Enable Exploded Segments
    - Explode Distance

14. Conditional Formatting — Color rules
    - (shared card)

15. Date Filter — Date range filtering
    - (shared card)

16. Accessibility — Keyboard navigation
    - (shared card)
```

---

### 2. Animated Waterfall

**Current card order (21 cards):**
1. Waterfall Settings
2. Colors
3. Value Labels
4. Axes
5. Card Style
6. Animation
7. Drill-Down
8. Axis Formatting
9. Data Labels
10. Chart Title
11. Connector
12. Subtotals
13. Scroll
14. Number Format
15. Reference Line
16. Trend Line
17. Conditional Formatting
18. Annotations
19. Accessibility
20. Total Bar
21. Summary Metrics
22. Sort
23. Date Filter

**Issues identified:**
- **Duplicate axis settings**: "Axes" (card 4) has showXAxis/showYAxis toggles, and "Axis Formatting" (card 8) has its own showXAxis/showYAxis plus all styling. Redundant and confusing.
- **Scattered waterfall-specific settings**: Total Bar (20), Summary Metrics (21), and Sort (22) are buried at the bottom but are core waterfall features.
- **Too many top-level cards**: 23 cards. Value Labels (3) has only 2 settings and could merge with Data Labels. Connector (11) could merge with Waterfall Settings.
- **Connector separated from Waterfall Settings**: Connectors are a core waterfall visual element but live in a separate card.
- **Colors separated from Range Colors**: Colors (positive/negative/total) should be near the bars they style.

**Recommended card order:**
```
1. Waterfall Settings — Core bar configuration
   - Show Connectors
   - Bar Width
   - Bar Corner Radius
   - Bar Border Color
   - Bar Border Width

2. Colors — Positive/negative/total bar colors
   - Positive Color
   - Negative Color
   - Total Color

3. Connector — Connector line styling (visible when Show Connectors is on)
   - Connector Color
   - Connector Width
   - Connector Style

4. Total Bar — Total bar display
   - Show Total Bar
   - Total Label
   - Total Bar Color

5. Subtotals — Intermediate subtotal bars
   - Enable Subtotals
   - Subtotal Color
   - Subtotal Label
   - Subtotal After Positions

6. Animation — Entrance effects
   - Enable Animations
   - Duration (ms)
   - Stagger Delay (ms)

7. Axis Formatting — All axis settings (remove duplicate Axes card)
   - (shared card — absorb local showX/showY toggles)

8. Data Labels — Value label typography
   - (shared card)

9. Chart Title — Title and subtitle
   - (shared card)

10. Number Format — Value display units
    - (shared card)

11. Sort — Data ordering
    - Sort by Contribution

12. Summary Metrics — Summary banner
    - Show Summary Banner
    - Font Size

13. Drill-Down — Hierarchical navigation
    - Enable Drill-Down
    - Show Breadcrumb
    - Breadcrumb Font Size
    - Breadcrumb Color

14. Card Style — Container appearance
    - Glass Effect
    - Background Color
    - Background Opacity
    - Border Radius

15. Scroll — Horizontal scrolling
    - (shared card)

16. Reference Line — Statistical reference
    - (shared card)

17. Trend Line — Regression overlay
    - (shared card)

18. Conditional Formatting — Color rules
    - (shared card)

19. Annotations — Data callouts
    - (shared card)

20. Date Filter — Date range filtering
    - (shared card)

21. Accessibility — Keyboard navigation
    - (shared card)
```

---

### 3. Bar Race

**Current card order (19 cards):**
1. Race Settings
2. Colors
3. Values
4. Card Style
5. Animation
6. Timestamp Display
7. Playback
8. Data Labels
9. Chart Title
10. Axis Formatting
11. Reference Line
12. Trend Line
13. Conditional Formatting
14. Annotations
15. Accessibility
16. Race Display
17. Race Playback
18. Color Theme
19. Number Format
20. Date Filter

**Issues identified:**
- **Scattered playback settings**: "Playback" (card 7) has autoPlay, showControls, speed, loop, controlPosition. "Race Playback" (card 17) has only pauseDuration. These should be one card.
- **Scattered race display settings**: "Race Settings" (card 1) has topN, playSpeed, barHeight, etc. "Race Display" (card 16) has showRankNumbers, showPeriodLabel, periodLabelSize. These are both about how the race looks.
- **Label color in wrong card**: `labelColor` is inside "Race Settings" but is a visual styling concern, not a race configuration concern.
- **Color Theme buried**: At position 18, far from "Colors" (position 2). Users setting up colors would naturally look for the theme picker near other color settings.
- **Values card is minimal**: Only 2 settings (showValues, fontSize) — could merge into Data Labels.

**Recommended card order:**
```
1. Race Settings — Core race configuration
   - Top N Items
   - Bar Height
   - Bar Corner Radius
   - Bar Opacity (%)

2. Playback — All playback controls (merge Playback + Race Playback)
   - Play Speed (ms)
   - Auto-Play on Load
   - Show Controls
   - Playback Speed
   - Loop Animation
   - Control Position
   - Pause Duration (ms)

3. Race Display — Visual display options (merge Race Display into here)
   - Show Rank Numbers
   - Show Period Label
   - Period Label Size
   - Label Color

4. Color Theme — Color palette selection
   - Theme

5. Colors — Per-item color mode
   - Use Chart Palette

6. Timestamp Display — Background timestamp
   - Show Timestamp
   - Font Size
   - Font Color
   - Opacity (%)
   - Position

7. Animation — Entrance animation
   - Enable Animations
   - Duration (ms)

8. Axis Formatting — Axis styling
   - (shared card)

9. Data Labels — Value label typography
   - (shared card)

10. Chart Title — Title and subtitle
    - (shared card)

11. Number Format — Value display units
    - (shared card)

12. Card Style — Container appearance
    - Glass Effect
    - Background Color
    - Background Opacity
    - Border Radius

13. Reference Line — Statistical reference
    - (shared card)

14. Trend Line — Regression overlay
    - (shared card)

15. Conditional Formatting — Color rules
    - (shared card)

16. Annotations — Data callouts
    - (shared card)

17. Date Filter — Date range filtering
    - (shared card)

18. Accessibility — Keyboard navigation
    - (shared card)
```

---

### 4. Box Plot

**Current card order (21 cards):**
1. Box Settings
2. Colors
3. Axes
4. Card Style
5. Animation
6. Mean Marker
7. Data Points
8. Box Plot Display
9. Box Plot Colors
10. Axis Formatting
11. Legend
12. Data Labels
13. Chart Title
14. Scroll
15. Number Format
16. Reference Line
17. Trend Line
18. Conditional Formatting
19. Accessibility
20. Series Formatting
21. Color Theme
22. Date Filter

**Issues identified:**
- **Duplicate axis settings**: "Axes" (card 3) has showXAxis/showYAxis/gridLines, and "Axis Formatting" (card 10) also has showXAxis/showYAxis/showGridLines plus full styling. Redundant.
- **Scattered color settings**: "Colors" (card 2) has boxColor/whiskerColor. "Box Plot Colors" (card 9) has perCategoryColors. "Color Theme" (card 21) has the theme picker. Three color-related cards scattered across the list.
- **Box Plot Display separated from Box Settings**: "Box Plot Display" (card 8) has violin, notches, orientation, whiskerCalc — these are core box plot configuration options that should be near "Box Settings".
- **Mean Marker and Data Points are feature cards**: Correctly separated, but positioned between Animation and Display rather than after the core display settings.
- **Color Theme at position 21**: Buried at the very bottom, despite being a foundational visual choice.

**Recommended card order:**
```
1. Box Settings — Core box geometry
   - Box Width
   - Show Outliers
   - Show Median Line
   - Median Color
   - Box Stroke Color
   - Box Stroke Width
   - Whisker Width
   - Outlier Radius

2. Box Plot Display — Statistical display options
   - Violin Overlay
   - Show Notches (95% CI)
   - Orientation
   - Whisker Calculation

3. Colors — All color settings (merge Colors + Box Plot Colors)
   - Box Color
   - Whisker Color
   - Per-Category Colors

4. Color Theme — Palette selection
   - Theme

5. Mean Marker — Mean marker display
   - Show Mean Marker
   - Shape
   - Color
   - Size

6. Data Points — Jitter/scatter overlay
   - Show Data Points
   - Point Opacity (%)
   - Radius
   - Point Color

7. Animation — Entrance effects
   - Enable Animations
   - Duration (ms)
   - Stagger Delay (ms)

8. Axis Formatting — All axis settings (remove duplicate Axes card)
   - (shared card)

9. Legend — Legend display
   - (shared card)

10. Data Labels — Label typography
    - (shared card)

11. Chart Title — Title and subtitle
    - (shared card)

12. Number Format — Value display units
    - (shared card)

13. Series Formatting — Per-series overrides
    - (shared card)

14. Card Style — Container appearance
    - Glass Effect
    - Background Color
    - Background Opacity
    - Border Radius

15. Scroll — Horizontal scrolling
    - (shared card)

16. Reference Line — Statistical reference
    - (shared card)

17. Trend Line — Regression overlay
    - (shared card)

18. Conditional Formatting — Color rules
    - (shared card)

19. Date Filter — Date range filtering
    - (shared card)

20. Accessibility — Keyboard navigation
    - (shared card)
```

---

### 5. Bullet Chart Pro

**Current card order (18 cards):**
1. Bullet Settings
2. Range Colors
3. Card Style
4. Animation
5. Axis Formatting
6. Data Labels
7. Chart Title
8. Scroll
9. Reference Line
10. Trend Line
11. Conditional Formatting
12. Annotations
13. Accessibility
14. Layout
15. Forecast
16. Comparison
17. Number Format
18. Date Filter

**Issues identified:**
- **Layout buried at position 14**: Orientation (horizontal/vertical) is one of the first things a user configures. It should be near the top.
- **Forecast and Comparison at the bottom**: These are unique bullet chart features but are buried below shared cards (Reference Line, Trend Line, etc.) that are less commonly used.
- **Card Style at position 3**: Container styling is low-priority compared to layout, range colors, and target display. Should be lower.
- **Axis Formatting has many hidden properties**: The visual.ts hides 15+ axis properties at runtime (xAxisTitle, yAxisTitle, yAxisMin, yAxisMax, showXAxis, showYAxis, etc.). This card appears in the pane but most settings are invisible — confusing for users who expand it expecting controls.
- **Number Format at position 17**: Value formatting affects every displayed number but is near the very bottom.

**Recommended card order:**
```
1. Bullet Settings — Core bullet configuration
   - Bar Height
   - Show Target
   - Show Labels
   - Bar Corner Radius
   - Range Opacity (%)

2. Layout — Orientation choice
   - Orientation (Horizontal / Vertical)

3. Range Colors — Qualitative range colors
   - Poor Color
   - Satisfactory Color
   - Good Color
   - Bar Color

4. Forecast — Forecast marker display
   - Show Forecast
   - Forecast Value
   - Band Width

5. Comparison — Comparative marker
   - Show Comparative
   - Comparative Color

6. Animation — Entrance effects
   - Enable Animations
   - Duration (ms)

7. Number Format — Value display units
   - (shared card)

8. Axis Formatting — Label styling (rename to "Label Styling" since most axis props are hidden)
   - Label Color
   - Label Font Size
   - Label Font Weight

9. Data Labels — Value label typography
   - (shared card)

10. Chart Title — Title and subtitle
    - (shared card)

11. Card Style — Container appearance
    - Glass Effect
    - Background Color
    - Background Opacity
    - Border Radius

12. Scroll — Scrolling behavior
    - (shared card)

13. Reference Line — Statistical reference
    - (shared card)

14. Trend Line — Regression overlay
    - (shared card)

15. Conditional Formatting — Color rules
    - (shared card)

16. Annotations — Data callouts
    - (shared card)

17. Date Filter — Date range filtering
    - (shared card)

18. Accessibility — Keyboard navigation
    - (shared card)
```

---

### 6. Bump Chart

**Current card order (22 cards):**
1. Bump Lines
2. Colors
3. Axis Visibility
4. Card Style
5. Animation
6. Highlight Top/Bottom N
7. Rank Change Indicators
8. Period Comparison
9. Axis Formatting
10. Legend
11. Data Labels
12. Chart Title
13. Line Stroke
14. Scroll
15. Reference Line
16. Trend Line
17. Conditional Formatting
18. Crosshair
19. Annotations
20. Accessibility
21. Series Formatting
22. Color Theme
23. Number Format
24. Date Filter

**Issues identified:**
- **Axis Visibility is a 1-setting card**: "Axis Visibility" (card 3) has only `showXAxis`. This should be folded into either Bump Lines or Axis Formatting.
- **Line Stroke at position 13**: Line style (solid/dashed/dotted, width) is core to how bump lines look but is separated from "Bump Lines" (card 1) which also has lineWidth. Confusing — two places to set line width.
- **Color Theme at position 22**: Should be near Colors (position 2) since it determines the palette.
- **Card Style at position 4**: Container styling is less important than the bump-specific feature cards (Highlight, Rank Change, Period Comparison). Should be lower.
- **Too many cards**: 24 cards is the most of any visual. Colors (card 2) has only 1 setting. Axis Visibility (card 3) has only 1 setting. Period Comparison (card 8) has only 1 setting.
- **Duplicate line width**: `Bump Lines.lineWidth` and `Line Stroke.lineWidth` both control line width.

**Recommended card order:**
```
1. Bump Lines — Core line and dot configuration (absorb Axis Visibility + Line Stroke)
   - Line Width
   - Line Style (from Line Stroke card)
   - Dot Radius
   - Dot Stroke Color
   - Show Rank Numbers
   - Show X-Axis (from Axis Visibility)
   - Show Area Fill
   - Area Opacity (%)

2. Color Theme — Palette selection
   - Theme

3. Colors — Color mode
   - Use Chart Palette

4. Highlight Top/Bottom N — Focus mode
   - Highlight Top/Bottom N
   - Top N
   - Show Others (Dimmed)

5. Rank Change Indicators — Delta badges
   - Show Rank Change Indicators
   - Font Size

6. Period Comparison — Start-to-end delta
   - Show Period Comparison

7. Animation — Entrance effects
   - Enable Animations
   - Duration (ms)

8. Axis Formatting — Axis styling
   - (shared card)

9. Legend — Legend display
   - (shared card)

10. Data Labels — Rank label typography
    - (shared card)

11. Chart Title — Title and subtitle
    - (shared card)

12. Number Format — Value display units
    - (shared card)

13. Series Formatting — Per-series overrides
    - (shared card)

14. Crosshair — Interactive crosshair
    - (shared card)

15. Card Style — Container appearance
    - Glass Effect
    - Background Color
    - Background Opacity
    - Border Radius

16. Scroll — Horizontal scrolling
    - (shared card)

17. Reference Line — Statistical reference
    - (shared card)

18. Trend Line — Regression overlay
    - (shared card)

19. Conditional Formatting — Color rules
    - (shared card)

20. Annotations — Data callouts
    - (shared card)

21. Date Filter — Date range filtering
    - (shared card)

22. Accessibility — Keyboard navigation
    - (shared card)
```

---

## Summary of Cross-Cutting Issues

| Issue | Affected Visuals |
|-------|-----------------|
| Duplicate axis cards (local Axes + shared Axis Formatting) | animated-waterfall, box-plot |
| Color Theme buried at bottom of card list | animated-donut-pro, bar-race, box-plot, bump-chart |
| Scattered color settings across multiple cards | box-plot (3 cards), bar-race (2 cards) |
| Single-setting cards that should be merged | bump-chart (Axis Visibility, Period Comparison, Colors), bar-race (Colors) |
| Card Style positioned too high (before feature cards) | animated-waterfall, bump-chart, box-plot |
| Number Format buried near the bottom | All 6 visuals |
| Playback/Race settings fragmented | bar-race (3 separate cards for race config) |
| Line width defined in two places | bump-chart (Bump Lines + Line Stroke) |
