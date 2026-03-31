# Improvement Report: Batch 2 Visuals

**Date:** 2026-03-18
**Visuals:** chord-diagram, dumbbell-chart, funnel-pro, gantt-chart-pro, gauge-cluster

---

## Deliverable 1: Luxury Feature Additions

---

### 1. Chord Diagram

#### 1A. Ribbon Pulse on Data Refresh
**Description:** When data updates, ribbons that changed in value pulse briefly (scale up 5% then back) with a spring-physics easing curve. Draws the user's eye to what changed without requiring them to compare the old chart from memory.
**Files to modify:** `packages/chord-diagram/src/visual.ts` (add pulse logic in `animateEntrance` or a new `animateDataDelta` method), `packages/core/src/animation.ts` (add `springPulse` utility)
**Effort:** Medium

#### 1B. Arc Glow on Hover
**Description:** When hovering over a group arc, apply a soft colored drop-shadow/glow matching the arc's fill color at 40% opacity and 4px blur. Creates a luxurious "lit from within" effect that makes the hovered entity feel elevated.
**Files to modify:** `packages/chord-diagram/src/visual.ts` (add SVG filter defs and apply on `mouseenter`), `packages/chord-diagram/style/visual.less` (fallback CSS glow styles)
**Effort:** Small

#### 1C. Smart Label Auto-Truncation
**Description:** When arc labels overlap or exceed available space, automatically truncate with ellipsis and show the full name on hover via a tooltip. Uses arc angle to compute available label width and compares against measured text width.
**Files to modify:** `packages/chord-diagram/src/visual.ts` (label rendering section in `render`, add text measurement and truncation logic)
**Effort:** Medium

#### 1D. Flow Breakdown Mini-Chart in Tooltip
**Description:** When hovering a group arc, the tooltip shows a tiny horizontal stacked bar breaking down that entity's inbound vs outbound flows. Turns the tooltip from a single number into a rich data summary that answers "where does this entity's traffic go?"
**Files to modify:** `packages/chord-diagram/src/visual.ts` (build HTML tooltip content with inline SVG bar), `packages/core/src/tooltip.ts` (add `renderMiniBar` helper if reusable)
**Effort:** Large

#### 1E. Smooth Ribbon Transitions on Filter
**Description:** When chord filtering is toggled (click arc to isolate), ribbons that are being hidden fade out and ribbons being shown fade in with a 300ms ease-out transition, instead of the current hard re-render. Creates a fluid, app-like feel.
**Files to modify:** `packages/chord-diagram/src/visual.ts` (refactor `render` to diff-update ribbons instead of full DOM rebuild when only `filteredGroupIndex` changes)
**Effort:** Medium

---

### 2. Dumbbell Chart

#### 2A. Dot Ripple on Click
**Description:** When a user clicks a dumbbell dot to select it, a radial ripple ring expands outward from the dot center and fades to transparent. Gives tactile feedback that the selection registered, similar to Material Design ripple effects.
**Files to modify:** `packages/dumbbell-chart/src/visual.ts` (add ripple SVG circle on click handler), `packages/core/src/animation.ts` (add `rippleOut` utility)
**Effort:** Small

#### 2B. Auto-Abbreviate Cramped Y-Axis Labels
**Description:** When the Y-axis has many categories and labels are getting clipped or overlapping, automatically abbreviate long labels (e.g., "Customer Acquisition Cost" becomes "Cust. Acq. Cost") and show the full name on hover. Measures actual rendered text width against available band height.
**Files to modify:** `packages/dumbbell-chart/src/visual.ts` (Y-axis label rendering section), `packages/core/src/format.ts` (add `abbreviateLabel` utility)
**Effort:** Medium

#### 2C. Gradient Connector Lines
**Description:** Replace the solid-color connecting line between start and end dots with a linear gradient that transitions from the start color to the end color. Makes the direction of change visually encoded in the connector itself, reinforcing the start-to-end narrative.
**Files to modify:** `packages/dumbbell-chart/src/visual.ts` (add SVG gradient defs, apply gradient fill to path elements)
**Effort:** Small

#### 2D. Highlight Peak and Valley Rows
**Description:** Automatically identify the row with the largest positive delta and the row with the largest negative delta, then add a subtle badge or highlight ring around those dots (e.g., a small star icon or a thicker stroke ring). Turns the chart into a storytelling tool that calls out the extremes.
**Files to modify:** `packages/dumbbell-chart/src/visual.ts` (compute min/max deltas after data extraction, apply highlight styling to those rows), `packages/dumbbell-chart/src/settings.ts` (add `highlightExtremes` toggle to DumbbellDisplaySettingsCard)
**Effort:** Medium

#### 2E. Smooth Dot Position Transition on Data Change
**Description:** When the underlying data updates (e.g., slicer change), animate dots sliding from their old X positions to their new X positions with a 400ms ease-out curve instead of instant re-render. Makes data exploration feel fluid and helps users track which categories moved.
**Files to modify:** `packages/dumbbell-chart/src/visual.ts` (cache previous xScale positions, tween to new positions on update), `packages/core/src/animation.ts` (add `tweenPosition` utility)
**Effort:** Large

---

### 3. Funnel Pro

#### 3A. Stage Hover Brightness Shift
**Description:** On mouse enter, boost the hovered trapezoid's brightness by 15% using an SVG `feComponentTransfer` filter and dim all other stages to 70% opacity. Creates a spotlight effect that makes the hovered stage pop without changing colors.
**Files to modify:** `packages/funnel-pro/src/visual.ts` (add SVG filter defs, attach mouseenter/mouseleave handlers to stage paths)
**Effort:** Small

#### 3B. Animated Count-Up on Conversion Labels
**Description:** When the funnel first renders or data changes, conversion rate percentages count up from 0% to their final value with the existing `countUp` utility. Currently only stage values animate; making conversion labels animate too completes the choreographed entrance.
**Files to modify:** `packages/funnel-pro/src/visual.ts` (wrap conversion label text updates in `countUp` calls with stagger delay)
**Effort:** Small

#### 3C. Callout Annotation for Biggest Drop-Off
**Description:** Automatically detect the stage-to-stage transition with the largest percentage drop and render a callout arrow + text annotation (e.g., "Biggest drop: -42%") pointing at that gap. Turns the funnel from a passive visualization into an insight generator.
**Files to modify:** `packages/funnel-pro/src/visual.ts` (compute max drop-off after stages are laid out, render annotation group), `packages/funnel-pro/src/settings.ts` (add `showBiggestDrop` toggle to FunnelAnnotationSettingsCard)
**Effort:** Medium

#### 3D. Shadow Depth on Stage Segments
**Description:** Apply a subtle drop shadow to each trapezoid segment that increases in intensity for stages with larger values. Top stage (highest value) gets a 4px shadow; bottom stages get 1px. Creates a 3D layered-card effect that makes the funnel feel premium.
**Files to modify:** `packages/funnel-pro/src/visual.ts` (add SVG `feDropShadow` filter with dynamic stdDeviation per stage)
**Effort:** Small

#### 3E. Inline Sparkline per Stage
**Description:** When a time dimension is available, render a tiny sparkline inside each trapezoid showing that stage's value over time. Even without a time field, if the visual is refreshed multiple times, track the last N values and show the trend. Adds temporal context to each stage.
**Files to modify:** `packages/funnel-pro/src/visual.ts` (add sparkline SVG group inside each stage, integrate `renderSparkline` from core), `packages/funnel-pro/src/settings.ts` (add `showStageTrend` toggle)
**Effort:** Large

---

### 4. Gantt Chart Pro

#### 4A. Bar Glow on Hover
**Description:** When hovering a task bar, apply a soft colored glow (box-shadow or SVG filter) matching the bar's fill color at 50% opacity. Dim non-hovered rows to 40% opacity to create a focus spotlight. Makes the dense task list easier to read.
**Files to modify:** `packages/gantt-chart-pro/src/visual.ts` (add mouseenter/mouseleave handlers to task bar elements), `packages/gantt-chart-pro/style/visual.less` (CSS transition for opacity dim)
**Effort:** Small

#### 4B. Smooth Today-Line Pulse Animation
**Description:** The today marker line gently pulses (opacity oscillates between 60% and 100%) on a 2-second CSS animation loop. Draws the eye to today's date without being distracting. Helps project managers instantly locate "now" in a dense timeline.
**Files to modify:** `packages/gantt-chart-pro/src/visual.ts` (add CSS class to today line element), `packages/gantt-chart-pro/style/visual.less` (add `@keyframes` pulse rule)
**Effort:** Small

#### 4C. Progress Bar Gradient Fill
**Description:** Replace the solid progress fill with a left-to-right gradient from the progress color to a 20% lighter version of itself. Tasks at 100% get a subtle green shimmer. Makes progress bars feel more polished and helps distinguish "nearly done" from "done."
**Files to modify:** `packages/gantt-chart-pro/src/visual.ts` (add SVG gradient defs, apply to progress rect elements)
**Effort:** Small

#### 4D. Dependency Arrow Hover Highlight
**Description:** When hovering a dependency arrow, highlight the connected task bars with a bright stroke and dim all other tasks. When hovering a task bar, highlight all its dependency arrows. Creates a visual "thread" that makes dependency chains easy to trace.
**Files to modify:** `packages/gantt-chart-pro/src/visual.ts` (add bidirectional hover handlers between arrows and bars, use data attributes for linkage)
**Effort:** Medium

#### 4E. Overdue Task Warning Indicators
**Description:** Tasks whose end date is in the past but progress is below 100% get a small warning icon (triangle with exclamation) rendered next to the task name label. Color-coded: red for >7 days overdue, amber for 1-7 days. Makes risk visible at a glance.
**Files to modify:** `packages/gantt-chart-pro/src/visual.ts` (compute overdue status in render loop, append warning icon SVG), `packages/gantt-chart-pro/src/settings.ts` (add `showOverdueWarning` toggle to GanttSettings)
**Effort:** Medium

---

### 5. Gauge Cluster

#### 5A. Arc Fill Glow Effect
**Description:** Apply a colored glow (SVG `feGaussianBlur` + `feComposite`) behind each gauge's filled arc that matches its zone color at 30% opacity. Makes gauges look like they are emitting light, creating a dashboard-grade premium feel.
**Files to modify:** `packages/gauge-cluster/src/visual.ts` (add SVG filter defs per gauge, apply filter to fill arc path), `packages/gauge-cluster/style/visual.less` (fallback styles)
**Effort:** Small

#### 5B. Gauge Cell Scale-Up on Hover
**Description:** When hovering a gauge cell, smoothly scale it to 105% with a 200ms CSS transition and apply a subtle box-shadow. Adjacent cells shrink to 98%. Creates a card-selection interaction pattern that feels interactive and modern.
**Files to modify:** `packages/gauge-cluster/src/visual.ts` (add CSS class toggling on mouseenter/mouseleave), `packages/gauge-cluster/style/visual.less` (add `.gauge-cell:hover` transition rules)
**Effort:** Small

#### 5C. Needle Swing Animation
**Description:** When the needle/pointer is enabled, animate it swinging from the previous value's angle to the new value's angle with spring-physics easing (overshoot + settle). Currently the needle just appears at the final position. The swing animation adds life.
**Files to modify:** `packages/gauge-cluster/src/visual.ts` (store previous needle angle per gauge, animate rotation), `packages/core/src/animation.ts` (add `springInterpolate` utility)
**Effort:** Medium

#### 5D. Threshold Zone Tick Marks
**Description:** Render small tick marks at the low and high threshold positions on the arc track, with tiny numeric labels (e.g., "33", "66"). Helps users understand where the zone boundaries are without needing to hover or check settings.
**Files to modify:** `packages/gauge-cluster/src/visual.ts` (compute threshold angles, render tick lines and labels in the SVG group), `packages/gauge-cluster/src/settings.ts` (add `showZoneTicks` toggle to ZoneSettings)
**Effort:** Small

#### 5E. Delta Indicator Badge
**Description:** Show a small up/down arrow badge with the delta value (e.g., "+5.2") below or beside each gauge's value text, comparing the current value to the previous value. Uses the existing `previousValues` map. Gives instant trend awareness per KPI.
**Files to modify:** `packages/gauge-cluster/src/visual.ts` (compute delta from `previousValues`, render badge SVG text with arrow character), `packages/gauge-cluster/src/settings.ts` (add `showDelta` toggle to ClusterDisplaySettings)
**Effort:** Small

---

## Deliverable 2: Settings Organization Audit

---

### 1. Chord Diagram

**Current card count:** 16 top-level cards
**Issues identified:**
1. **Scattered settings** -- Opacity-related settings are split across 3 cards: `ribbonOpacity` and `hoverOpacity` in "Chord", `dimOpacity` in "Chord" (conditionally visible from "Interaction Features"), and `backgroundOpacity` in "Card Style".
2. **Too many top-level cards** -- 16 cards is a very long flat list. "Chord", "Ribbon Features", "Label Features", and "Interaction Features" could be grouped under one "Chord Behavior" parent.
3. **Unclear card names** -- "Chord" is vague; it controls padding and opacity but not ribbon behavior. "Label Features" only has one toggle.
4. **Illogical ordering** -- "Color" (1 toggle) is card #2 but "Color Theme" (the more impactful color choice) is card #14.
5. **Single-setting cards** -- "Color" has only `useChartPalette`; "Label Features" has only `showEntityValues`. These are too thin to justify their own cards.

**Recommended card order:**
```
1. Chord Layout -- Core diagram geometry
   - Padding
   - Min Arc Angle (degrees) [moved from Ribbon Features]
   - Arc Stroke Color

2. Ribbons -- Ribbon appearance and behavior
   - Ribbon Opacity (%)
   - Hover Opacity (%)
   - Dim Opacity (%)
   - Gradient Ribbons
   - Directional Ribbons

3. Interaction -- Click and hover behaviors
   - Enable Chord Filtering
   - Show Flow Labels on Hover
   - Show Entity Values [moved from Label Features]

4. Color Theme -- Color palette selection
   - Theme
   - Use Chart Palette [moved from Color]

5. Card Style -- Container appearance
   - Glass Effect
   - Background Color
   - Background Opacity (%)
   - Border Radius

6. Chart Title -- Title and subtitle
   - (all title settings)

7. Data Labels -- Label typography
   - (all data label settings)

8. Legend -- Legend display
   - (all legend settings)

9. Number Format -- Value formatting
   - (all number format settings)

10. Animation -- Entrance animations
    - Enable Animations
    - Duration (ms)

11. Sort Order -- Entity ordering
    - Sort By

12. Conditional Formatting -- Threshold-based coloring
    - (all conditional settings)

13. Date Filter -- Date range filtering
    - (all date filter settings)

14. Accessibility -- Keyboard navigation
    - Enable Keyboard Navigation
```

---

### 2. Dumbbell Chart

**Current card count:** 18 top-level cards
**Issues identified:**
1. **Too many top-level cards** -- 18 cards is overwhelming. "Dumbbell Settings", "Dumbbell Display", and "Dumbbell Grouping" should be consolidated.
2. **Scattered settings** -- Dot appearance is split: `dotRadius`, `dotStrokeColor`, `dotStrokeWidth` are in "Dumbbell Settings" alongside line settings. These are conceptually different (dot vs connector).
3. **Unclear card names** -- "Dumbbell Settings" is the catch-all name for the most critical visual properties. "Dumbbell Display" controls ranking/arrows but the name suggests general display options.
4. **Illogical ordering** -- "Card Style" is card #2 (cosmetic) but "Axis" is card #7 (core chart structure). Axis should come before card style.
5. **Redundant single-setting card** -- "Dumbbell Grouping" has only one toggle (`Enable Grouping`). This could merge into Display.

**Recommended card order:**
```
1. Dumbbell Dots -- Dot appearance
   - Dot Radius
   - Dot Stroke Color
   - Dot Stroke Width
   - Start Color
   - End Color

2. Connector Line -- Line between dots
   - Line Width
   - Line Color
   - Connector Arrow [moved from Dumbbell Display]
   - Auto Directional Color [moved from Dumbbell Display]

3. Delta Labels -- Change indicators
   - Show Delta Labels
   - Format
   - Position
   - Font Size
   - Font Color

4. Display Options -- Extra visual features
   - Show Ranking [moved from Dumbbell Display]
   - Enable Grouping [moved from Dumbbell Grouping]

5. Axis -- Axis configuration
   - Show X-Axis
   - Show Y-Axis
   - (all axis formatting settings)

6. Chart Title -- Title and subtitle
   - (all title settings)

7. Data Labels -- Label typography
   - (all data label settings)

8. Legend -- Legend display
   - (all legend settings)

9. Scroll -- Scrollable chart behavior
   - (all scroll settings)

10. Color Theme -- Color palette
    - Theme

11. Number Format -- Value formatting
    - (all number format settings)

12. Series Formatting -- Per-series overrides
    - (all series settings)

13. Animation -- Entrance animations
    - Enable Animations
    - Duration (ms)

14. Card Style -- Container appearance
    - Glass Effect
    - Background Color
    - Background Opacity (%)
    - Border Radius

15. Sort Order -- Category ordering
    - Sort By

16. Reference Line -- Static reference line
    - (all reference line settings)

17. Trend Line -- Regression overlay
    - (all trend line settings)

18. Conditional Formatting -- Threshold-based coloring
    - (all conditional settings)

19. Date Filter -- Date range filtering
    - (all date filter settings)

20. Accessibility -- Keyboard navigation
    - Enable Keyboard Navigation
```

---

### 3. Funnel Pro

**Current card count:** 17 top-level cards
**Issues identified:**
1. **Overloaded primary card** -- "Funnel Settings" has 8 settings covering style, conversion labels, values, strokes, label color, and pyramid mode. These are conceptually different concerns crammed into one card.
2. **Scattered layout settings** -- "Funnel Layout" controls neck width/height/dynamic height/border radius, while "Funnel Settings" controls gap and style. Both are about geometry but are separated.
3. **Irrelevant shared cards** -- "Axis" card is present but most properties are force-hidden in `update()` (showXAxis, showYAxis, titles, rotation, min/max, fontFamily, gridLineWidth, gridLineOpacity). Only axis label color/size, line color/width, and grid line color/style are used. This is confusing.
4. **Unclear card names** -- "Comparison" is too vague; it specifically means "compare stages and show drop-off areas."
5. **Stage Annotations** has only one toggle -- too thin for its own card.

**Recommended card order:**
```
1. Funnel Shape -- Core funnel geometry
   - Style (Symmetric / Left Aligned)
   - Pyramid Mode
   - Gap
   - Neck Width (%)
   - Neck Height (%)
   - Dynamic Height per Stage
   - Border Radius [segment corners, moved from Funnel Layout]

2. Stage Appearance -- Segment visual styling
   - Segment Stroke Color [moved from Funnel Settings]
   - Segment Stroke Width [moved from Funnel Settings]
   - Label Color [moved from Funnel Settings]
   - Show Values [moved from Funnel Settings]
   - Show Conversion Rate [moved from Funnel Settings]
   - Show Annotations [moved from Stage Annotations]

3. Color -- Fill color settings
   - Use Gradient
   - Base Color

4. Drop-Off Analysis -- Stage-to-stage comparison
   - Enable Comparison [renamed from "Comparison"]
   - Show Drop-Off
   - Drop-Off Color

5. Chart Title -- Title and subtitle
   - (all title settings)

6. Data Labels -- Value label typography
   - (all data label settings)

7. Legend -- Legend display
   - (all legend settings)

8. Grid & Lines -- Grid lines and separators
   - Show Grid Lines [from Axis card]
   - Grid Line Color [from Axis card]
   - Grid Line Style [from Axis card]
   - Axis Line Color [from Axis card]
   - Axis Line Width [from Axis card]
   - Axis Label Color [from Axis card]
   - Axis Label Size [from Axis card]

9. Color Theme -- Color palette
    - Theme

10. Number Format -- Value formatting
    - (all number format settings)

11. Animation -- Entrance animations
    - Enable Animations
    - Duration (ms)

12. Card Style -- Container appearance
    - Glass Effect
    - Background Color
    - Background Opacity (%)
    - Border Radius [container corners]

13. Reference Line -- Static reference line
    - (all reference line settings)

14. Trend Line -- Regression overlay
    - (all trend line settings)

15. Conditional Formatting -- Threshold-based coloring
    - (all conditional settings)

16. Date Filter -- Date range filtering
    - (all date filter settings)

17. Accessibility -- Keyboard navigation
    - Enable Keyboard Navigation
```

---

### 4. Gantt Chart Pro

**Current card count:** 19 top-level cards
**Issues identified:**
1. **Overloaded primary card** -- "Gantt" has 9 settings covering bar height, progress, labels, opacity, corner radius, row gap, label width, today line width, and today line style. The today-line settings belong in "Today Marker" and bar appearance is separate from layout.
2. **Scattered today-line settings** -- `todayLineWidth` and `todayLineStyle` are in "Gantt" but `showTodayLine` and `lineColor` are in "Today Marker". This forces users to look in two places to configure the same feature.
3. **Too many top-level cards** -- 19 cards is the highest count in this batch. "Hierarchy", "Task Grouping", "Dependencies", "Milestones", "Critical Path", and "Baseline" are all project-management features that could be sub-grouped.
4. **Illogical ordering** -- "Colors" (2 settings) is card #2, but "Color Theme" is card #18. These are related but 16 cards apart.
5. **Unclear card name** -- "Gantt" as a card name for the primary settings is redundant with the visual name itself.

**Recommended card order:**
```
1. Task Bars -- Bar appearance and sizing
   - Bar Height
   - Bar Opacity (%)
   - Bar Corner Radius
   - Row Gap
   - Label Width
   - Show Labels
   - Show Progress

2. Colors -- Color assignments
   - Bar Color
   - Progress Color
   - Theme [moved from Color Theme]

3. Today Marker -- Current date indicator (consolidated)
   - Show Today Line
   - Today Line Color [moved from Today Marker]
   - Today Line Width [moved from Gantt]
   - Today Line Style [moved from Gantt]

4. Dependencies -- Arrow connectors
   - Show Dependencies
   - Arrow Color
   - Line Width
   - Arrow Size
   - Line Style

5. Milestones -- Milestone markers
   - Show Milestones
   - Milestone Shape
   - Milestone Color

6. Critical Path -- Critical path highlighting
   - Show Critical Path
   - Critical Path Color
   - Line Width

7. Baseline -- Plan vs actual comparison
   - Show Baseline
   - Baseline Color
   - Baseline Opacity (%)

8. Hierarchy & Grouping -- Task organization
   - Enable Grouping [moved from Task Grouping]
   - Collapsible Groups [moved from Task Grouping]
   - Indent Width [from Hierarchy]
   - Show Toggle [from Hierarchy]
   - Collapse By Default [from Hierarchy]

9. Chart Title -- Title and subtitle
   - (all title settings)

10. Data Labels -- Label typography
    - (all data label settings)

11. Legend -- Legend display
    - (all legend settings)

12. Axis -- Time axis formatting
    - (all axis settings)

13. Number Format -- Value formatting
    - (all number format settings)

14. Animation -- Entrance animations
    - Enable Animations
    - Duration (ms)

15. Card Style -- Container appearance
    - Glass Effect
    - Background Color
    - Background Opacity (%)
    - Border Radius

16. Conditional Formatting -- Threshold-based coloring
    - (all conditional settings)

17. Date Filter -- Date range filtering
    - (all date filter settings)

18. Accessibility -- Keyboard navigation
    - Enable Keyboard Navigation
```

---

### 5. Gauge Cluster

**Current card count:** 12 top-level cards
**Issues identified:**
1. **Overloaded primary card** -- "Cluster Layout" has 12 settings covering grid layout (gaugesPerRow), arc geometry (arcRange, roundedCaps), value range (min/max), labels (showLabels, showValues, labelFontSize, labelFontColor, labelFontFamily, labelFontWeight), and track opacity. These are at least 4 distinct concerns.
2. **Scattered label settings** -- Label font configuration is in "Cluster Layout", but value font configuration uses the shared "Data Labels" card. A user looking to change fonts must check two different cards.
3. **Missing grouping** -- "Cluster Display" (sparklines, needle, sort) and "Cluster Labels" (subtitle) are feature-oriented cards that could be merged since they are both display enhancements.
4. **Illogical ordering** -- "Target" (an important KPI feature) is card #3, after "Color Zones" which is less frequently changed. Target is more likely to be configured first.
5. **Unclear card names** -- "Cluster Layout" implies only grid arrangement, but it also controls arc geometry, value ranges, labels, and track styling.

**Recommended card order:**
```
1. Grid Layout -- How gauges are arranged
   - Gauges Per Row
   - Sort by Value [moved from Cluster Display]

2. Arc Appearance -- Gauge arc geometry and style
   - Arc Range (degrees)
   - Rounded Caps
   - Track Opacity (%)
   - Show Needle/Pointer [moved from Cluster Display]

3. Value Range -- Min/max scale configuration
   - Min Value
   - Max Value

4. Color Zones -- Zone thresholds and colors
   - Low Threshold (%)
   - High Threshold (%)
   - Low Color
   - Mid Color
   - High Color

5. Target -- Target marker settings
   - Show Target
   - Target Color
   - Line Width

6. Labels -- All text labeling
   - Show Labels
   - Show Values
   - Label Font Size
   - Label Font Color
   - Label Font Family
   - Label Font Weight
   - Show Subtitle [moved from Cluster Labels]
   - Subtitle Field [moved from Cluster Labels]
   - Show Mini Sparklines [moved from Cluster Display]

7. Chart Title -- Title and subtitle
   - (all title settings)

8. Data Labels -- Value typography (shared card)
   - (all data label settings)

9. Number Format -- Value formatting
   - (all number format settings)

10. Animation -- Entrance animations
    - Enable Animations
    - Duration (ms)

11. Card Style -- Container appearance
    - Glass Effect
    - Background Color
    - Background Opacity (%)
    - Border Radius

12. Conditional Formatting -- Threshold-based coloring
    - (all conditional settings)

13. Date Filter -- Date range filtering
    - (all date filter settings)

14. Accessibility -- Keyboard navigation
    - Enable Keyboard Navigation
```

---

## Summary

| Visual | Current Cards | Recommended Cards | Key Changes |
|---|---|---|---|
| Chord Diagram | 16 | 14 | Merge Color + Color Theme; merge Label Features + Interaction into single Interaction card |
| Dumbbell Chart | 18 | 20 | Split overloaded "Dumbbell Settings" into Dots + Connector; merge Display + Grouping |
| Funnel Pro | 17 | 17 | Split overloaded "Funnel Settings" into Shape + Appearance; replace Axis with focused "Grid & Lines" |
| Gantt Chart Pro | 19 | 18 | Consolidate today-line settings; merge Hierarchy + Task Grouping; move color theme into Colors |
| Gauge Cluster | 12 | 14 | Split overloaded "Cluster Layout" into Grid + Arc + Range + Labels; merge Display + Labels |

### Cross-Visual Patterns

1. **Every visual** has a "Card Style" card that is near the top of the list despite being cosmetic. Recommendation: move Card Style to the bottom third, after data-critical settings.
2. **Every visual** has Animation as a mid-list card. Recommendation: standardize Animation near the bottom since it is a polish setting, not a data-critical one.
3. **Color Theme and Color cards** are always separated by many cards. Recommendation: always place them adjacent or merge them.
4. **Shared cards** (Data Labels, Legend, Axis, Conditional Formatting, Accessibility, Date Filter) appear in inconsistent orders across visuals. Recommendation: standardize the order of shared cards across all visuals for a consistent user experience.
