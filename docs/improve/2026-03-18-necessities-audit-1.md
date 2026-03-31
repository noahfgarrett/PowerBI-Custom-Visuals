# Necessities Audit -- 11 Visuals (2026-03-18)

Pass 1: Element-by-element formatting gaps.
Pass 2: Interaction gaps (context menu, tooltip, multi-select).

---

## animated-donut-pro

- **Connector lines** -- color uses hardcoded `#94A3B8` fallback derived from `labelColor`; no dedicated connector line color picker
- **Connector lines** -- no thickness setting (hardcoded `stroke-width: 1`)
- **Explosion gap** -- no per-segment explode toggle (all-or-nothing); cannot explode only selected segments on click
- **Center value** -- no "show center label" (secondary text below the number, e.g. "Total Revenue")
- **Segment padding** -- no gap/padding between slices (only explode or nothing)

## animated-waterfall

- **Axis label font family/weight** -- the local `AxisSettingsCard` only has show/hide toggles; axis label styling is delegated to shared `AxisFormattingCard` which does have it, but the local card shadows the shared card for showXAxis/showYAxis meaning the shared card's axis toggles still appear -- no actual gap here
- **Connector lines** -- well covered (color, width, style) -- no gap
- **Value labels** -- no position setting (always above/inside bar); cannot choose inside/outside/auto
- **Summary banner** -- font color and font family are missing (only fontSize and show toggle)

## bar-race

- **Bar labels (category names)** -- no font color setting for bar-inline labels (only `labelColor` in RaceDisplay card controls period/rank labels, not the bar-internal category names)
- **Bar border/stroke** -- no border color or border width setting (bars have no stroke at all)
- **Value text font color** -- `ValueSettings` has fontSize and showValues but no fontColor or fontFamily/fontWeight for the inline value text
- **Playback controls** -- no color/styling for the play/pause button or scrubber bar
- **Timestamp font family/weight** -- timestampSettings has fontSize, fontColor, opacity, position but no fontFamily or fontWeight

## box-plot

- **Whisker color** -- exists in ColorSettings, but no per-category whisker color (only global)
- **Outlier color** -- no outlier color setting (uses box color at reduced opacity, hardcoded)
- **Outlier shape** -- hardcoded to circle; no shape selector (diamond, cross, triangle)
- **Median line width** -- no thickness setting (hardcoded `stroke-width` in render)
- **Median line style** -- no dashed/solid option
- **Box fill opacity** -- no opacity setting for the box fill (hardcoded)
- **Violin color** -- when violin overlay is on, no color/opacity setting for the violin shape

## bullet-chart-pro

- **Target marker color** -- hardcoded to same `barColor`; no dedicated target color picker
- **Target marker width** -- hardcoded `stroke-width: 2`; no thickness setting
- **Target marker shape** -- hardcoded to vertical/horizontal line; no shape option (triangle, diamond)
- **Label font family/weight** -- category labels use shared axis formatting but value labels (`bullet-value-label`) have no font family/weight settings in the local card
- **Range label** -- no toggle or text for labeling the range bands (Poor/Satisfactory/Good) on the chart itself
- **Forecast band color** -- hardcoded to `#6366F1` (indigo); no color picker

## bump-chart

- **Line tooltip** -- hovering over a line path only shows series name; does not show rank or value at the closest point
- **Dot stroke width** -- hardcoded `stroke-width: 2`; no setting to control it
- **Rank number font** -- rank numbers displayed in dots have no font size, color, family, or weight settings
- **Y-axis (rank axis)** -- no show/hide toggle for the rank Y-axis (always displayed)
- **Line curve type** -- no setting to switch between monotone, cardinal, linear, step curve interpolation

## chord-diagram

- **Arc thickness** -- hardcoded at 15% of radius (`innerRadius = radius * 0.85`); no setting to control arc band width
- **Label font size/color** -- entity labels on arcs use shared DataLabelFormattingCard but there is no dedicated label font size or color in the ChordLayout card
- **Ribbon stroke width** -- ribbon stroke uses `withOpacity(color, 0.3)` with no width or color control
- **Arc stroke width** -- `arcStrokeColor` exists but no `arcStrokeWidth` setting
- **Label position** -- labels are always placed outside at fixed radius; no inside/outside/radial alignment option

## dumbbell-chart

- **Connector tooltip** -- hovering over the connector line between dots shows nothing; only dots have tooltips
- **Connector line style** -- no dashed/dotted/solid option (always solid)
- **Delta label position** -- exists (above/center/below) -- no gap
- **Dot tooltip** -- shows only category + single series value; does not show both start and end values simultaneously or the delta
- **Ranking number** -- showRanking toggle exists but no font size, color, or position settings for rank numbers

## funnel-pro

- **Stage label position** -- no setting for label placement (inside/outside/left/right); always rendered at stage center
- **Drop-off label** -- when drop-off is shown, no label text or font settings for the drop-off values
- **Drop-off opacity** -- no opacity control for drop-off highlighting
- **Conversion label font** -- conversion rate labels have no font size, color, family, or weight independent of stage labels
- **Per-stage color** -- only base color + gradient; no per-stage color pickers or category-driven coloring from data
- **Scroll/overflow** -- no scroll support for many stages; `ScrollFormattingCard` is not included

## gantt-chart-pro

- **Task bar stroke/border** -- no border color or border width setting for task bars
- **Number formatting** -- `NumberFormattingCard` is not included; tooltip values and data labels have no display units, prefix/suffix, or decimal control
- **Task label font family/weight** -- task labels use axis formatting card's color and size but no font family or weight settings in the task bar card
- **Scroll** -- `ScrollFormattingCard` is not included; no scroll settings for charts with many tasks
- **Milestone size** -- milestone marker size is derived from `barHeight * 0.7`; no independent size setting
- **Dependency arrow style** -- has solid/dashed but no color per dependency type (all same color)
- **Today line label** -- today line has no label ("Today" text or date text)
- **Tooltip** -- only shows Task, Range, Progress; does not show category/group, duration in days, or resource assignment

## gauge-cluster

- **Arc thickness** -- hardcoded at 20% of radius (`ARC_THICKNESS = 0.20`); no setting to control arc band width
- **Needle color** -- uses zone `valueColor` automatically; no independent needle color picker
- **Needle width** -- hardcoded `stroke-width: 2`; no thickness setting
- **Needle style** -- only line style; no pointer/arrow shape option
- **Value font size/color** -- values displayed inside gauges have no independent font size or color settings (inherits from labels card which controls both labels and values together)
- **Sparkline color** -- sparklines have no color setting (uses zone color)
- **Tooltip** -- shows Label, Value, Target; does not show zone status (Low/Mid/High) or percentage of range

---

## Pass 2: Interaction Gaps

### Context menu (right-click)

| Visual | Every clickable element? | Notes |
|---|---|---|
| animated-donut-pro | YES | Segments have contextmenu |
| animated-waterfall | YES | Bars have contextmenu |
| bar-race | YES | Bars have contextmenu |
| box-plot | YES | Boxes have contextmenu |
| bullet-chart-pro | YES | Value bars have contextmenu |
| bump-chart | YES | Dots and lines have contextmenu |
| chord-diagram | YES | Arcs and ribbons have contextmenu |
| dumbbell-chart | YES | Dots have contextmenu |
| funnel-pro | YES | Stages have contextmenu |
| gantt-chart-pro | YES | Task rows have contextmenu |
| gauge-cluster | YES | Gauge cells have contextmenu |

### Tooltip completeness

| Visual | Uses Number Format? | Missing data |
|---|---|---|
| animated-donut-pro | YES (`formatWithSettings`) | -- |
| animated-waterfall | YES | -- |
| bar-race | YES | -- |
| box-plot | YES | Mean value not shown (only in mean marker, no tooltip) |
| bullet-chart-pro | YES | -- |
| bump-chart | NO -- dot tooltip uses raw `String(value)` not `formatWithSettings` | Line tooltip missing rank/value |
| chord-diagram | YES | -- |
| dumbbell-chart | YES | Missing both-dots context (start + end + delta) |
| funnel-pro | YES | -- |
| gantt-chart-pro | NO -- no `NumberFormattingCard` at all; progress shown as raw % | Missing duration-in-days, group/category |
| gauge-cluster | YES | Missing zone status, % of range |

### Multi-select (Ctrl+click)

All 11 visuals pass `event.ctrlKey || event.metaKey` to `selectionManager.select()`. No gaps.

---

## Priority Summary (top gaps across all 11)

1. **bump-chart tooltip** -- dot tooltip uses raw `String(value)` instead of `formatWithSettings`; line tooltip only shows series name
2. **gantt-chart-pro number formatting** -- no `NumberFormattingCard` at all; no way to format values with prefix/suffix/units
3. **gauge-cluster arc thickness** -- hardcoded 20%; user cannot control arc band width
4. **chord-diagram arc thickness** -- hardcoded 15%; user cannot control arc band width
5. **box-plot median line** -- no width or style (dashed/solid) setting
6. **bar-race value text** -- no font color, family, or weight for inline value text
7. **bullet-chart-pro target marker** -- no color picker or thickness setting
8. **gantt-chart-pro task bar border** -- no stroke color or width
9. **funnel-pro per-stage color** -- only global base color; no per-stage or data-driven colors
10. **dumbbell-chart connector tooltip** -- hovering connector line shows nothing
