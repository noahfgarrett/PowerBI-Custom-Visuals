# Improvement Batch 6: Luxury Features & Settings Organization Audit
**Date:** 2026-03-18
**Visuals:** timeline-milestone, treemap-pro, waffle-chart, kpi-card, bar-chart-pro

---

## Deliverable 1: Luxury Feature Additions

---

### timeline-milestone

#### 1. Pulsing "Today" Marker
**Description:** When the "Today Line" is active, add a soft pulsing glow animation on the today marker position. The pulse radiates outward as a translucent ring that fades, drawing the eye to "now" on the timeline without being distracting.
**Files to modify:** `packages/timeline-milestone/src/visual.ts` (renderTodayLine method), `packages/timeline-milestone/style/visual.less`
**Effort:** Small

#### 2. Hover Card Popover
**Description:** When hovering over a milestone marker, show a frosted-glass popover card with the full label, date, category, and duration-to-next milestone. This replaces the native Power BI tooltip with a richer, branded experience that stays within the visual's glass aesthetic.
**Files to modify:** `packages/timeline-milestone/src/visual.ts` (attachSelection method), `packages/timeline-milestone/style/visual.less`
**Effort:** Medium

#### 3. Auto-Annotate Milestone Clusters
**Description:** When multiple milestones fall within a tight date range, display a badge count (e.g., "3 events") with an expand-on-click animation that fans the clustered milestones outward in a radial layout. Currently, clusters just concatenate labels into a string.
**Files to modify:** `packages/timeline-milestone/src/visual.ts` (extractData cluster logic, render method)
**Effort:** Large

#### 4. Gradient Spine with Progress Fill
**Description:** Fill the timeline spine with a gradient that transitions from a muted color on the left/top to a vibrant color at the rightmost/bottommost milestone, giving a visual sense of progression. Optionally, fill only up to the "today" line to show past vs. future.
**Files to modify:** `packages/timeline-milestone/src/visual.ts` (render method, spine line creation), `packages/timeline-milestone/src/settings.ts` (add spineGradient toggle)
**Effort:** Small

#### 5. Elastic Bounce Marker Entrance
**Description:** Replace the current `popIn` marker animation with a spring-physics elastic bounce where markers overshoot their scale by 15%, bounce back, then settle. Each marker's bounce timing is staggered by its position on the timeline, creating a wave effect.
**Files to modify:** `packages/timeline-milestone/src/visual.ts` (animation section in render), `packages/core/src/animation.ts` (if a new easing is needed)
**Effort:** Small

---

### treemap-pro

#### 1. Hover Elevation with Depth Shadow
**Description:** When hovering over a treemap tile, smoothly elevate it with a CSS `transform: translateZ()` and add a layered box-shadow that gives the tile a "lifted off the surface" appearance. Adjacent tiles subtly dim to 90% brightness to increase contrast.
**Files to modify:** `packages/treemap-pro/src/visual.ts` (leaf cell rendering, event handlers), `packages/treemap-pro/style/visual.less`
**Effort:** Small

#### 2. Animated Drill-Down Zoom Transition
**Description:** When drilling into a category, instead of an instant re-render, animate the clicked tile expanding to fill the entire treemap area while sibling tiles shrink and fade out. On drill-up, the reverse animation plays. This gives spatial context during navigation.
**Files to modify:** `packages/treemap-pro/src/visual.ts` (drill click handler, renderTreemap method)
**Effort:** Large

#### 3. Value-in-Center Large Tile Display
**Description:** For tiles above a size threshold, display the numeric value centered in the tile with a large, semi-transparent font (60-80% opacity) that acts as a watermark beneath the label. This makes high-value categories instantly identifiable at a glance.
**Files to modify:** `packages/treemap-pro/src/visual.ts` (leaf rendering loop, label/value section)
**Effort:** Small

#### 4. Sparkline-in-Tooltip
**Description:** When hovering a treemap tile, render a mini sparkline inside the tooltip showing historical values for that category (if a date column is present in the data). This turns a static hierarchical view into a time-aware analysis tool.
**Files to modify:** `packages/treemap-pro/src/visual.ts` (attachCellTooltip method), `packages/treemap-pro/src/settings.ts` (add tooltipSparkline toggle)
**Effort:** Large

#### 5. Tile Border Glow on Selection
**Description:** When a tile is selected via click, apply a soft colored glow border (matching the tile's fill color at 40% opacity) that pulses once then holds steady. This makes the selected tile visually distinct from the multi-select state.
**Files to modify:** `packages/treemap-pro/src/visual.ts` (cell click handler, selection rendering), `packages/treemap-pro/style/visual.less`
**Effort:** Small

---

### waffle-chart

#### 1. Ripple Highlight on Hover
**Description:** When the user hovers over the waffle grid, cells under the cursor emit a radial ripple that briefly brightens neighboring cells outward by 2-3 cells, creating a water-droplet effect. This makes the static grid feel alive and responsive to interaction.
**Files to modify:** `packages/waffle-chart/src/visual.ts` (grid cell rendering, event handlers), `packages/waffle-chart/style/visual.less`
**Effort:** Medium

#### 2. Gradient Fill Transition Between Empty and Filled
**Description:** Instead of a hard boundary between filled and empty cells, apply a gradient transition zone across the last 2-3 cells. The boundary cells blend from fill color to empty color, giving a smooth "liquid fill" appearance.
**Files to modify:** `packages/waffle-chart/src/visual.ts` (cell rendering loop, fill rank logic)
**Effort:** Small

#### 3. Value Counter with Odometer Effect
**Description:** Replace the current `countUp` animation with an odometer-style digit roller where each digit column scrolls independently. When the percentage changes (e.g., from 73% to 85%), each digit position rolls at a different speed, creating a mechanical, premium feel.
**Files to modify:** `packages/waffle-chart/src/visual.ts` (value display section), `packages/waffle-chart/style/visual.less` (odometer CSS)
**Effort:** Medium

#### 4. Contextual Center Label
**Description:** Display the primary value (e.g., "73%") as a large, semi-transparent watermark centered over the entire grid. The grid cells show through the text, creating a layered depth effect. This is especially impactful at larger visual sizes.
**Files to modify:** `packages/waffle-chart/src/visual.ts` (render method, after grid construction)
**Effort:** Small

#### 5. Category Breakdown Mode
**Description:** When multiple categories are bound, partition the waffle grid into colored sections (like a stacked waffle) where each category gets its proportional share of cells. Hovering a section highlights just that category's cells and shows its individual percentage.
**Files to modify:** `packages/waffle-chart/src/visual.ts` (extractData, render method), `packages/waffle-chart/src/settings.ts` (add breakdownMode toggle), `packages/waffle-chart/capabilities.json` (add category data role)
**Effort:** Large

---

### kpi-card (Focus: What's STILL Missing)

#### 1. Animated Number Transition Between Periods
**Description:** When the KPI value changes (e.g., data refresh or slicer interaction), animate the transition with a slot-machine style digit roll where old digits scroll up/out and new digits scroll in from below. The current `countUp` linearly interpolates, which lacks the premium feel of per-digit animation.
**Files to modify:** `packages/kpi-card/src/visual.ts` (renderSingleKpi, value animation section), `packages/kpi-card/style/visual.less`
**Effort:** Medium

#### 2. Conditional Status Icons
**Description:** Add configurable icons (checkmark, warning triangle, X mark, flame, etc.) that appear next to the KPI value based on conditional formatting thresholds. When value is "good" show a green checkmark; "warning" shows amber triangle; "bad" shows red X. Icons animate in with a bounce.
**Files to modify:** `packages/kpi-card/src/visual.ts` (render method, after value element), `packages/kpi-card/src/settings.ts` (add StatusIconSettings card with icon selection dropdowns)
**Effort:** Medium

#### 3. Sparkline Brush Selection
**Description:** Allow users to click-and-drag on the sparkline to select a date range, which highlights the selected portion and updates the displayed KPI value to reflect only the brushed period. The unselected region dims to 30% opacity. A reset button clears the selection.
**Files to modify:** `packages/kpi-card/src/visual.ts` (renderSparkline method), `packages/kpi-card/style/visual.less`
**Effort:** Large

#### 4. Mini Distribution Histogram on Hover
**Description:** When hovering over the primary KPI value, show a small floating histogram showing the distribution of all trend values with the current value highlighted as a vertical line. This gives instant context about whether the current value is typical or an outlier.
**Files to modify:** `packages/kpi-card/src/visual.ts` (showKpiTooltip or new overlay method)
**Effort:** Medium

#### 5. Goal Celebration Animation
**Description:** When the KPI value meets or exceeds the goal for the first time, trigger a one-time confetti burst or checkmark-bloom animation on the progress bar. The progress bar briefly flashes gold before settling to the "met" color. Subsequent renders skip the celebration.
**Files to modify:** `packages/kpi-card/src/visual.ts` (renderGoalProgressBar method), `packages/kpi-card/style/visual.less`
**Effort:** Small

---

### bar-chart-pro (Focus: What's STILL Missing)

#### 1. Bar Race Animation Mode
**Description:** Add a "Race" chart mode where categories are ranked by value and bars animate their position and length over time (using the category axis as a time dimension). Bars smoothly slide up/down as their rank changes, with the current time period displayed prominently. This is the viral "bar chart race" format.
**Files to modify:** `packages/bar-chart-pro/src/visual.ts` (new renderRaceMode method), `packages/bar-chart-pro/src/settings.ts` (add 'race' to ChartModeSettings items)
**Effort:** Large

#### 2. Gradient Color Scale Per Series
**Description:** Allow each bar series to use a sequential color gradient based on value magnitude instead of a flat color. Low values get light shades, high values get saturated shades of the series color. This adds data-ink density without extra chart elements.
**Files to modify:** `packages/bar-chart-pro/src/visual.ts` (bar rendering in grouped/stacked modes), `packages/bar-chart-pro/src/settings.ts` (add gradientScale toggle to BarSettings or SeriesFormattingCard)
**Effort:** Medium

#### 3. Morphing Chart Type Transitions
**Description:** When switching between chart modes (grouped to stacked, stacked to horizontal, etc.), animate the transition with bars morphing their position, width, and height smoothly rather than an instant re-render. Bars that exist in both modes interpolate their rect attributes; bars that appear/disappear fade in/out.
**Files to modify:** `packages/bar-chart-pro/src/visual.ts` (update method, all render mode methods)
**Effort:** Large

#### 4. Crosshair Tooltip with Snap-to-Bar
**Description:** Add a vertical crosshair line that follows the cursor across the chart, snapping to the nearest category. When snapped, show a floating tooltip panel listing all series values for that category with colored dots. The crosshair line pulses softly at the snap point.
**Files to modify:** `packages/bar-chart-pro/src/visual.ts` (add crosshair overlay after chart render), `packages/bar-chart-pro/src/settings.ts` (add crosshair toggle)
**Effort:** Medium

#### 5. Micro-Sparkline in Axis Labels
**Description:** For each category on the X-axis, render a tiny sparkline (3px tall) directly below the label showing that category's trend across a time dimension (if available). This embeds temporal context directly into the axis, reducing the need for a separate time-series chart.
**Files to modify:** `packages/bar-chart-pro/src/visual.ts` (axis rendering section), `packages/bar-chart-pro/src/settings.ts` (add axisSparkline toggle to AxisFormattingCard or BarSettings)
**Effort:** Large

---

## Deliverable 2: Settings Organization Audit

---

### timeline-milestone (14 cards)

**Current issues:**
- "Timeline" and "Timeline Layout" are split cards that both control timeline structure. Layout, orientation, and connectors are conceptually the same thing.
- "Markers" and "Timeline Markers" are confusingly similar names. "Markers" controls shape/size/color while "Timeline Markers" controls today-line and clustering. These are unrelated concepts sharing a similar name.
- Axis Formatting card has many hidden properties (X/Y axis, rotation, min/max) that don't apply to timelines. These are inherited from the shared core card and just clutter the object model.
- Date Filter is at the bottom but is a high-use setting for time-based visuals.

**Proposed reorganization (10 cards):**

| Order | Card Name | Contents |
|-------|-----------|----------|
| 1 | **Timeline** | Orientation, Layout (alternating/top/bottom/staggered), Show Dates, Date Format |
| 2 | **Markers** | Shape, Size, Color by Category, Marker Stroke Color |
| 3 | **Spine & Connectors** | Line Color, Line Width, Show Connectors, Show Duration Bars, Duration Bar Opacity, Duration Bar Height |
| 4 | **Today Line & Clustering** | Show Today Line, Today Line Color, Cluster Nearby, Cluster Threshold |
| 5 | **Date Filter** | Enable, Start Date, End At Current Date, End Date |
| 6 | **Data Labels** | *(shared card)* |
| 7 | **Chart Title** | *(shared card)* |
| 8 | **Card Style** | Glass Effect, Background Color, Background Opacity, Border Radius |
| 9 | **Animation** | Enable, Duration |
| 10 | **Advanced** | Conditional Formatting, Color Theme, Number Format, Grid Lines, Accessibility |

**Key changes:**
- Merge "Timeline" + "Timeline Layout" into one "Timeline" card (from 2 cards to 1)
- Rename "Timeline Markers" to "Today Line & Clustering" to disambiguate from "Markers"
- Extract spine/connector settings from both "Timeline" and "Timeline Layout" into a new "Spine & Connectors" card
- Move Date Filter up from position 14 to position 5 (high-use for time-based visuals)
- Consolidate low-use settings (Conditional, Color Theme, Number Format, Grid, Accessibility) into an "Advanced" group

---

### treemap-pro (15 cards)

**Current issues:**
- "Colors" card has only one toggle (`useChartPalette`). A single-setting card wastes vertical space.
- "Heat Coloring" is a separate card when it's really a color mode. Both "Colors" and "Heat Coloring" control how tiles are colored.
- "Display" card (percentage, label overflow, color by depth) mixes label behavior with coloring behavior.
- "Treemap" card has `labelColor` which is hidden (deferred to DataLabelFormattingCard). Dead setting in the card.

**Proposed reorganization (11 cards):**

| Order | Card Name | Contents |
|-------|-----------|----------|
| 1 | **Treemap** | Tiling Algorithm, Show Labels, Show Values, Tile Padding |
| 2 | **Tile Appearance** | Tile Stroke Color, Tile Stroke Width, Use Chart Palette, Color by Depth, Heat Coloring Enable, Heat Start/End Colors |
| 3 | **Display** | Show Percentage, Percent Of, Label Overflow |
| 4 | **Drill-Down** | Enable, Show Breadcrumb, Breadcrumb Font Size, Breadcrumb Color |
| 5 | **Data Labels** | *(shared card)* |
| 6 | **Legend** | *(shared card)* |
| 7 | **Chart Title** | *(shared card)* |
| 8 | **Card Style** | Style Mode, Background Color, Background Opacity, Border Radius |
| 9 | **Animation** | Enable, Duration |
| 10 | **Number Format** | *(shared card)* |
| 11 | **Advanced** | Conditional Formatting, Color Theme, Date Filter, Accessibility |

**Key changes:**
- Merge "Colors" + "Heat Coloring" + "color by depth" from Display into a new "Tile Appearance" card (from 3 cards to 1)
- Remove hidden `labelColor` from Treemap card
- Move Drill-Down up to position 4 (it's a primary interaction for this visual type)
- Group rarely-changed settings into "Advanced"

---

### waffle-chart (16 cards)

**Current issues:**
- "Grid" and "Colors" both control cell appearance. Grid has `cellStrokeColor`, `cellCornerRadius`, `emptyColor` (hidden) while Colors has `fillColor` and `emptyColor`. There's a duplicate `emptyColor` across cards.
- "Pictogram" and "Icon Library" are separate cards but Icon Library only applies when Pictogram is enabled. These should be one card.
- "Layout" card has only 2 settings (fillDirection, autoFitCells). It overlaps conceptually with Grid (rows, cols, gap).
- "Value Display" is essentially a data label card that exists alongside the shared DataLabelFormattingCard. The shared one has `showDataLabels` hidden.

**Proposed reorganization (11 cards):**

| Order | Card Name | Contents |
|-------|-----------|----------|
| 1 | **Grid** | Rows, Columns, Gap, Fill Direction, Auto-Fit Cell Size, Cell Shape, Cell Corner Radius |
| 2 | **Colors** | Fill Color, Empty Color, Cell Stroke Color |
| 3 | **Value Display** | Show Percentage, Font Size, Font Color |
| 4 | **Pictogram** | Enable, Icon Shape, Icon Set, Icon Size, Outline Opacity |
| 5 | **Legend** | *(shared card)* |
| 6 | **Chart Title** | *(shared card)* |
| 7 | **Card Style** | Glass Effect, Background Color, Background Opacity, Border Radius |
| 8 | **Animation** | Enable, Duration |
| 9 | **Number Format** | *(shared card)* |
| 10 | **Data Labels** | *(shared card, for font styling)* |
| 11 | **Advanced** | Conditional Formatting, Color Theme, Date Filter, Accessibility |

**Key changes:**
- Merge "Layout" into "Grid" (from 2 cards to 1) since both control grid structure
- Merge "Icon Library" into "Pictogram" (from 2 cards to 1)
- Consolidate all color settings (fill, empty, stroke) into "Colors", remove duplicate `emptyColor`
- Move Data Labels down since the primary value display is handled by "Value Display"

---

### kpi-card (15 cards)

**Current issues:**
- Generally well-organized. The card order follows a logical top-to-bottom reading of the visual.
- "Layout" card has only 2 settings (KPI Count, Sparkline Type). Sparkline Type logically belongs with the Sparkline card.
- "Comparison" is at position 7, after Animation. Users configuring comparison are in "data analysis" mode, not "styling" mode. It should be near Trend Arrow.

**Proposed reorganization (13 cards):**

| Order | Card Name | Contents |
|-------|-----------|----------|
| 1 | **Value** | Font Size, Font Color, Font Family, Font Weight |
| 2 | **Label** | Show, Position, Alignment, Font Size, Font Color, Font Family, Font Weight, Custom Text |
| 3 | **Trend Arrow** | Show, Font Size, Positive/Negative/Neutral Colors |
| 4 | **Comparison** | Show, Compare Mode, Show % Change, Font Size, Font Color |
| 5 | **Sparkline** | Show, Sparkline Type, Line Color, Fill Opacity, Sparkline Color, Width, Divider Color, Show Min/Max, Cumulative, Endpoint Marker |
| 6 | **Goal / Target** | Show, Goal Value, Show Progress Bar, Gradient Color, Met/Unmet Colors |
| 7 | **Layout** | KPI Count |
| 8 | **Chart Title** | *(shared card)* |
| 9 | **Card Style** | Style Mode, Background Color, Background Opacity, Border Radius |
| 10 | **Animation** | Enable, Duration |
| 11 | **Number Format** | *(shared card)* |
| 12 | **Conditional Formatting** | *(shared card)* |
| 13 | **Advanced** | Color Theme, Date Filter, Accessibility |

**Key changes:**
- Move "Comparison" from position 7 to position 4 (between Trend Arrow and Sparkline, grouping all data-analysis settings together)
- Move "Sparkline Type" from Layout into Sparkline card (from 2 settings to 1 in Layout)
- Keep Layout card with just KPI Count (still useful as a standalone card)
- Group rarely-changed settings into "Advanced"

---

### bar-chart-pro (30 cards) -- CRITICAL

**Current issues:**
- **30 cards is overwhelming.** Users must scroll through an enormous list to find settings. This is the highest-priority reorganization.
- Settings are in a flat list with no logical grouping. "Pattern Fill" (position 10) is far from "Bar Settings" (position 2), but both control bar appearance.
- Mode-specific cards (Line Settings, Secondary Axis) appear at positions 3-4 even when the user is not in combo mode. While they're conditionally hidden, their position displaces more commonly-used cards.
- "Bar Number Format" and "Line Number Format" are separate cards but could be unified.
- Shared cards (Axis, Legend, Data Labels, Title, Scroll, Reference Line, Trend Line, Conditional, Annotation, Accessibility, Series, Color Theme, Date Filter) account for 13 of the 30 cards.

**Proposed hierarchical grouping (6 groups, 22 cards):**

#### Group 1: Chart Type (2 cards)
| Order | Card Name | Contents |
|-------|-----------|----------|
| 1 | **Chart Mode** | Mode dropdown |
| 2 | **Layout** | Top N Enable, Top N Count, Others Label, Others Color, Sort By, Small Multiples Enable, Columns, Sync Y-Axis |

*Rationale: Merge Top N + Small Multiples into one "Layout" card. Both control what data is shown and how it's arranged.*

#### Group 2: Bar & Line Appearance (4 cards)
| Order | Card Name | Contents |
|-------|-----------|----------|
| 3 | **Bar Appearance** | Bar Style, Corner Radius, Bar Spacing, Bar Opacity, Bar Border Color, Bar Border Width, Gradient Fill, Pattern Fill Enable, Pattern Type, Pattern Opacity |
| 4 | **Data Labels** | Data Labels dropdown (none/above/inside) + shared DataLabelFormattingCard styling |
| 5 | **Line Settings** | *(combo mode only)* Show Dots, Show Data Labels, Gradient Fill, Gradient Opacity, Dot Radius |
| 6 | **Series Colors** | *(shared SeriesFormattingCard)* |

*Rationale: Merge Pattern Fill into Bar Appearance (from 2 cards to 1). Both control how bars look.*

#### Group 3: Overlays & Analysis (5 cards)
| Order | Card Name | Contents |
|-------|-----------|----------|
| 7 | **Target Line** | Show, Label, Style, Color |
| 8 | **Reference Line** | *(shared card)* |
| 9 | **Trend Line** | *(shared card)* |
| 10 | **Benchmark Band** | Show, Lower/Upper Bound, Color, Opacity, Label |
| 11 | **Variance Indicators** | Show, Compare Against, Custom Value, Show Delta, Show Arrow, Colors |

*Rationale: All analytical overlays are grouped together. Pareto Line should be merged into Trend Line or become a sub-toggle.*

#### Group 4: Axes & Grid (3 cards)
| Order | Card Name | Contents |
|-------|-----------|----------|
| 12 | **Axes** | *(shared AxisFormattingCard)* |
| 13 | **Secondary Axis** | *(combo mode only)* Show, Title |
| 14 | **Scroll & Zoom** | *(merge ScrollFormattingCard + ZoomSettingsCard)* |

*Rationale: Merge Scroll + Zoom into one card (from 2 to 1). Both control viewport navigation.*

#### Group 5: Chrome & Styling (5 cards)
| Order | Card Name | Contents |
|-------|-----------|----------|
| 15 | **Chart Title** | *(shared card)* |
| 16 | **Legend** | *(shared card)* |
| 17 | **Card Style** | Style Mode, Background Color, Background Opacity, Border Radius |
| 18 | **Animation** | Enable, Duration, Stagger Delay |
| 19 | **Number Format** | Bar Number Format + Line Number Format unified with a "Apply to" toggle |

*Rationale: Merge Bar Number Format + Line Number Format (from 2 to 1).*

#### Group 6: Advanced (3 cards)
| Order | Card Name | Contents |
|-------|-----------|----------|
| 20 | **Conditional Formatting** | *(shared card)* |
| 21 | **Annotations** | *(shared card)* |
| 22 | **Advanced** | Drill-Down, Color Theme, Date Filter, Accessibility, Pareto Line |

*Rationale: Drill-Down is rarely configured after initial setup. Pareto, Color Theme, Date Filter, and Accessibility are power-user features.*

**Summary of merges (30 -> 22 cards):**
- Top N + Small Multiples -> Layout (2 -> 1)
- Bar Settings + Pattern Fill -> Bar Appearance (2 -> 1)
- Scroll + Zoom -> Scroll & Zoom (2 -> 1)
- Bar Number Format + Line Number Format -> Number Format (2 -> 1)
- Drill-Down + Color Theme + Date Filter + Accessibility + Pareto -> Advanced (5 -> 1)

**Impact:** Reduces the card count from 30 to 22 (27% reduction) while making the format pane scannable through logical grouping. The most-used settings (Chart Mode, Bar Appearance, Data Labels) are at the top. Rarely-changed settings are consolidated at the bottom.

---

## Implementation Priority

| Visual | Settings Reorg Effort | Feature Priority |
|--------|----------------------|-----------------|
| bar-chart-pro | **HIGH** (30 cards is a usability problem) | Crosshair Tooltip, Gradient Color Scale |
| waffle-chart | Medium (duplicate settings, fragmented cards) | Category Breakdown Mode, Ripple Highlight |
| treemap-pro | Medium (3 color-related cards to merge) | Hover Elevation, Drill-Down Zoom |
| kpi-card | Low (mostly well-organized) | Animated Number Transition, Conditional Status Icons |
| timeline-milestone | Low (minor naming confusion) | Pulsing Today Marker, Gradient Spine |
