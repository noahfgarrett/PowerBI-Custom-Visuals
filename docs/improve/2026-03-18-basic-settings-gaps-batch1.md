# Basic Settings Gaps — Batch 1

Audit of 7 Power BI custom visuals for missing everyday formatting options.

**Methodology:** For each visual, every rendered element was cross-checked against its `settings.ts` (local cards + shared core cards) and `visual.ts` (which settings are actually wired up and which are hidden via `.visible = false`). Only genuinely missing capabilities are listed — settings that exist in the shared card but are explicitly hidden (`.visible = false`) count as missing if the visual *should* support them.

---

## animated-donut-pro

### Missing basic settings:
- **Labels** cannot change font family — no `labelFontFamily` setting (shared `DataLabelFormattingCard` has `dataLabelFontFamily` but donut labels are rendered with local code, not the shared label position logic)
- **Labels** cannot change position (inside arc / outside arc / auto) — `donutLabelSettings` has format but no explicit inside/outside/auto position control; label placement is derived from connector toggle only
- **Center value text** cannot change font family — `ValueSettings` has fontSize and fontColor but no fontFamily
- **Individual arc colors** cannot be overridden per-segment — colors come from the palette; there is no per-series color picker
- **Padding/spacing** between arcs cannot be adjusted — no `padAngle` or gap setting
- **Legend** has no font weight control — `LegendFormattingCard` has `legendFontWeight` but it is not applied in `renderSharedLegend` (only fontSize, fontColor, fontFamily are passed)

---

## animated-waterfall

### Missing basic settings:
- **Legend** is completely absent — no `LegendFormattingCard` imported or used; waterfall has 3 semantic colors (positive/negative/total) but no legend to explain them
- **Color theme** is absent — no `ColorThemeFormattingCard`; colors are hardcoded positive/negative/total pickers only
- **Value labels** cannot change font color — `ValueSettingsCard` has `show` and `fontSize` but no `fontColor`
- **Value labels** cannot change font family — no `fontFamily` in `ValueSettingsCard`
- **Axis label font family** is hidden — shared `AxisFormattingCard` is included but `axisLabelFontFamily` is not explicitly hidden, yet some axis properties (showXAxis, showYAxis, xAxisTitle, yAxisTitle, yAxisMin, yAxisMax) are hidden in visual.ts
- **Axis label rotation** is available in shared card but NOT hidden — appears functional (good)
- **Grid lines** are available via shared `AxisFormattingCard` — appears functional (good)
- **Individual bar colors** cannot be overridden per-category — no `SeriesFormattingCard`; only semantic positive/negative/total colors
- **Connector line opacity** cannot be adjusted — `ConnectorSettings` has color, width, and style but no opacity
- **Summary banner font color** cannot be changed — `WaterfallSummarySettings` has `show` and `fontSize` but no `fontColor`
- **Spacing/padding** between bars cannot be adjusted — `barWidth` controls width but there is no gap/spacing setting

---

## bar-race

### Missing basic settings:
- **Legend** is completely absent — no `LegendFormattingCard`; bar items are identified by color but there is no legend
- **Value labels** cannot change font color — `ValueSettings` has `showValues` and `fontSize` but no `fontColor` (though `dataLabelFormattingCard` is included, it is largely bypassed)
- **Value labels** cannot change font family — no `fontFamily` in `ValueSettings`
- **All axis settings are hidden** — `showXAxis`, `showYAxis`, `xAxisTitle`, `yAxisTitle`, `yAxisMin`, `yAxisMax`, `axisLabelFontFamily`, `axisLabelRotation`, `axisLabelFontWeight`, `axisLineColor`, `axisLineWidth`, grid lines all set `.visible = false`; the visual renders category labels but offers no axis formatting
- **Category label font size** cannot be changed — labels use hardcoded sizing; the axis formatting card is entirely hidden
- **Category label font color** cannot be changed — same reason; axis card is hidden
- **Category label font family** cannot be changed — axis card hidden
- **Bar border/stroke color** cannot be changed — no `barBorderColor` or `barStrokeColor` setting
- **Bar border/stroke width** cannot be changed — no `barBorderWidth` setting
- **Individual bar colors** cannot be overridden per-category — no `SeriesFormattingCard`; colors come from the palette only
- **Spacing/padding** between bars cannot be adjusted — `barHeight` and `BAR_GAP` (4px) are hardcoded; no user-facing gap setting
- **Rank number font color** cannot be changed independently — `raceDisplay.labelColor` exists but it is a single color for all label types

---

## box-plot

### Missing basic settings:
- **Axis show/hide toggles are hidden** — `showXAxis`, `showYAxis`, `showGridLines` all set `.visible = false` in visual.ts; user cannot toggle axes or grid lines from the format pane (though local `axisSettings` has showXAxis/showYAxis/gridLines, the shared card overrides are hidden)
- **Axis titles are hidden** — `xAxisTitle` and `yAxisTitle` set `.visible = false`
- **Axis min/max overrides are hidden** — `yAxisMin` and `yAxisMax` set `.visible = false`
- **Outlier color** cannot be changed — outliers inherit box color or whisker color; no separate `outlierColor` setting
- **Annotation support** is absent — no `AnnotationFormattingCard` imported or used
- **Box fill opacity** cannot be adjusted — box fill uses `withOpacity(color, 0.7)` hardcoded; no user-facing opacity control
- **Violin overlay color** cannot be changed — violin fill inherits box color with hardcoded opacity; no separate color picker
- **Violin overlay opacity** cannot be changed — hardcoded in rendering code
- **Notch color/style** cannot be customized — notch rendering uses hardcoded values
- **Spacing/padding** between box groups cannot be adjusted — derived from `boxWidth` and category count; no explicit gap setting

---

## bullet-chart-pro

### Missing basic settings:
- **Legend** is completely absent — no `LegendFormattingCard`; bullet chart has multiple color-coded ranges but no legend to explain them
- **Color theme** is absent — no `ColorThemeFormattingCard`; colors are individual pickers for poor/satisfactory/good/bar only
- **All axis settings are hidden** — showXAxis, showYAxis, xAxisTitle, yAxisTitle, yAxisMin, yAxisMax, axisLabelFontFamily, axisLabelRotation, axisLineColor, axisLineWidth, showGridLines, gridLineColor, gridLineStyle, gridLineWidth, gridLineOpacity all set `.visible = false`
- **Target marker color** cannot be customized independently — target marker uses `barColor`; no separate `targetColor` picker
- **Target marker style** cannot be changed (line thickness, shape) — hardcoded 2px stroke
- **Individual bullet colors** cannot be overridden per-category — no `SeriesFormattingCard`
- **Spacing/padding** between bullet rows cannot be adjusted — `ROW_GAP` is hardcoded at 8px; no user-facing setting
- **Value label font color** cannot be changed independently — value labels are styled via the shared `DataLabelFormattingCard` which is available, but the local `showLabels` controls visibility and there is no local font color
- **Crosshair** support is absent — no `CrosshairFormattingCard`

---

## bump-chart

### Missing basic settings:
- **Y-axis** cannot be shown/hidden — `showYAxis` is hidden (`.visible = false`); bump chart shows ranks on Y but user cannot toggle the Y-axis
- **Axis titles** are hidden — `xAxisTitle` and `yAxisTitle` both `.visible = false`
- **Axis min/max** are hidden — `yAxisMin` and `yAxisMax` both `.visible = false`
- **Grid lines** are entirely hidden — `showGridLines`, `gridLineColor`, `gridLineStyle`, `gridLineWidth`, `gridLineOpacity` all `.visible = false`; no grid lines at all
- **Line color per-series** cannot be changed via the format pane without `SeriesFormattingCard` — wait, it IS included; series colors CAN be customized (good)
- **Dot fill opacity** cannot be adjusted — dots are solid fill; no opacity control
- **Rank label font color** cannot be changed — rank numbers use hardcoded `fill` from CSS; no user-facing setting (the shared DataLabelFormattingCard is applied to `.bump-rank-label` but showDataLabels is hidden)
- **Area fill color** cannot be changed independently from line color — area fill always derives from line color
- **Spacing/padding** within the chart cannot be adjusted — margins are hardcoded constants

---

## chord-diagram

### Missing basic settings:
- **Label font family** cannot be changed — chord labels are rendered locally; the shared `DataLabelFormattingCard` is applied to `.chord-label` which provides fontSize/color/weight but the font family is only respected if `applyDataLabelFormatting` applies it (it does via the shared card)
- **Label position** cannot be adjusted — labels are always placed at the outer arc centroid with fixed `LABEL_OFFSET` of 8px; no inside/outside/auto position option
- **Arc stroke width** cannot be changed — arc stroke uses default width; no `arcStrokeWidth` setting (only `arcStrokeColor` exists)
- **Arc thickness (inner/outer radius ratio)** cannot be adjusted — `innerRadius = radius * 0.85` is hardcoded; no user-facing control
- **Individual entity colors** cannot be overridden per-entity — no `SeriesFormattingCard`; colors come from the theme palette only
- **Ribbon stroke color** cannot be changed independently — ribbon stroke uses `withOpacity(sourceColor, 0.3)` hardcoded
- **Ribbon stroke width** cannot be changed — hardcoded default
- **Spacing/padding** between arcs is controlled by `padding` setting (good), but there is no margin/padding control for the overall chart layout — margins are hardcoded at 24px
- **Scroll** support is absent — no `ScrollFormattingCard`; large chord diagrams cannot scroll
- **Axis** settings are N/A for chord diagrams (correct to omit)
- **Sort order** exists (good) via `SortFormattingCard`

---

## Summary: Cross-cutting gaps found across multiple visuals

| Gap | Visuals affected |
|-----|-----------------|
| No legend | animated-waterfall, bar-race, bullet-chart-pro |
| No color theme card | animated-waterfall, bullet-chart-pro |
| No per-series/per-category color overrides | animated-donut-pro, animated-waterfall, bar-race, bullet-chart-pro, chord-diagram |
| Value/data label font color missing (local card) | animated-waterfall, bar-race |
| Value/data label font family missing | animated-donut-pro (center value), animated-waterfall, bar-race |
| All axis settings hidden (no axis customization) | bar-race, bullet-chart-pro |
| Grid lines hidden/absent | bar-race, bump-chart, bullet-chart-pro |
| No spacing/gap control | animated-donut-pro, animated-waterfall, bar-race, box-plot, bullet-chart-pro, bump-chart, chord-diagram |
| No bar/arc border controls | bar-race |
| No individual target/marker color | bullet-chart-pro |
