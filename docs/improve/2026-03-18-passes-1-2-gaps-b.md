# Settings Gap Audit -- Batch B (15 Visuals)

**Date:** 2026-03-18
**Visuals:** polar-chart, progress-bar-stack, radar-chart, radial-gauge, ring-stack, sankey-diagram, scatter-bubble, slope-chart, status-indicator, stream-graph, sunburst-chart, timeline-milestone, treemap-pro, waffle-chart, bar-chart-pro

Format: `[visual] -- [element] -- [what's missing]`

---

## polar-chart

- polar-chart -- grid circles -- stroke-width hardcoded `1` (inherits from no setting), no stroke-width setting for grid circles
- polar-chart -- grid circles -- stroke-opacity hardcoded `0.6`, not user-configurable
- polar-chart -- radial axis lines -- stroke-opacity hardcoded `0.5`, not user-configurable
- polar-chart -- arc generator -- cornerRadius hardcoded `3`, not user-configurable
- polar-chart -- center dot decoration -- fill hardcoded `#94A3B8`, fill-opacity hardcoded `0.15`, no show/hide toggle or color/opacity settings
- polar-chart -- empty state text -- font size, font color, font family all hardcoded in CSS class
- polar-chart -- value labels -- font-weight hardcoded `'600'`, should use a setting
- polar-chart -- segment stroke color -- defaults to `withOpacity(datum.color, 0.6)` -- the 0.6 opacity fallback is hardcoded
- polar-chart -- radial label offset -- hardcoded `16` px from outer radius, not configurable

## progress-bar-stack

- progress-bar-stack -- row gap between label and track -- hardcoded `10px` in rowEl.style.gap, not user-configurable
- progress-bar-stack -- fill bar hover scale -- `scaleY(1.08)` hardcoded, no setting to control hover behavior
- progress-bar-stack -- target marker -- overflow extension hardcoded `top: '-3px'` / `bottom: '-3px'`, border-radius matches line width
- progress-bar-stack -- milestone markers -- width hardcoded `2px`, opacity hardcoded `0.7`, border-radius hardcoded `1px` -- none configurable
- progress-bar-stack -- milestone markers -- no line style setting (always solid)
- progress-bar-stack -- empty state text -- font and styling hardcoded inline (`font-size:12px`, `opacity:0.5`)
- progress-bar-stack -- track border -- no border/stroke setting for the track element itself

## radar-chart

- radar-chart -- benchmark overlay -- stroke-width hardcoded `2`, not user-configurable (benchmark settings has color and dash but no width)
- radar-chart -- axis label offset -- hardcoded `14` px from radius, not configurable
- radar-chart -- legend swatch -- border-radius hardcoded `2px`, swatch size hardcoded `10px` -- not configurable
- radar-chart -- dot stroke -- no stroke color/width setting for dots (only fill color via conditional)
- radar-chart -- axis label -- missing font family / font weight settings (only color and size exist)
- radar-chart -- axis value labels -- font size computed as `axisLabelSize - 2` hardcoded offset

## radial-gauge

- radial-gauge -- target tick -- stroke-width hardcoded `3`, not user-configurable (only target color is exposed)
- radial-gauge -- target tick -- no line style setting (always solid)
- radial-gauge -- major tick -- stroke-width hardcoded `1.5`, not user-configurable
- radial-gauge -- minor tick -- stroke-width hardcoded `0.75`, not user-configurable
- radial-gauge -- scale labels -- uses `dataLabelFormattingCard` font size/color but no dedicated font family/weight
- radial-gauge -- sparkline -- stroke-width hardcoded `1.5`, stroke-linecap hardcoded `round`, opacity hardcoded `0.7` -- no sparkline style settings
- radial-gauge -- sparkline end dot -- radius hardcoded `2`, color follows zone color with no override
- radial-gauge -- delta text -- font-size computed as `Math.max(10, fontSize * 0.45)` -- hardcoded ratio
- radial-gauge -- empty state text -- `'--'` string and styling hardcoded in CSS class

## ring-stack

- ring-stack -- ring stroke width -- hardcoded `1` when ringStrokeColor is set, not user-configurable
- ring-stack -- label area width -- hardcoded `Math.min(width * 0.3, 100)`, not user-configurable
- ring-stack -- overflow indicator -- fill opacity hardcoded `0.4`, stroke-width hardcoded `0.5`, stroke-dasharray hardcoded `'3,2'` -- none configurable
- ring-stack -- arc label font -- font-size hardcoded `Math.max(8, thickness * 0.6)px`, not configurable
- ring-stack -- arc label color -- uses arcFillColor, no independent arc label color setting
- ring-stack -- center label -- font-weight hardcoded `'400'`, opacity hardcoded `0.7`
- ring-stack -- side label dot -- no size/shape setting for the color dot indicator
- ring-stack -- empty state text -- styling hardcoded in CSS class

## sankey-diagram

- sankey-diagram -- layer total font -- missing font family and font weight settings (only size and color exist)
- sankey-diagram -- link label font -- missing font family setting (has size, color, weight but no family)
- sankey-diagram -- node value font -- missing font family/weight (uses totalFontSize/totalFontColor only)
- sankey-diagram -- flow label (hover) font -- missing font family setting
- sankey-diagram -- link stroke -- no border/stroke setting for links (only fill opacity is controlled)
- sankey-diagram -- link curvature -- not validated with min/max bounds in visual.ts

## scatter-bubble

- scatter-bubble -- quadrant zone fill colors -- hardcoded per-zone: `#F59E0B`, `#10B981`, `#EF4444`, `#3B82F6` -- not user-configurable (only line color setting exists)
- scatter-bubble -- cluster hull -- stroke-width hardcoded `1.5`, not user-configurable
- scatter-bubble -- cluster colors -- hardcoded array `['#3B82F6', '#EF4444', '#22C55E', ...]` -- not user-configurable
- scatter-bubble -- trendline -- missing dotted style option (only solid/dashed)
- scatter-bubble -- trendline label -- missing font color, font family, font weight settings (only font size exists)
- scatter-bubble -- quadrant label -- opacity for label text not configurable

## slope-chart

- slope-chart -- dot stroke width -- hardcoded `1.5` in two places for left/right dots, not user-configurable
- slope-chart -- dot stroke color -- default fallback `#FFFFFF` hardcoded if user doesn't set a color
- slope-chart -- change label -- missing show/hide for the left/right column header labels independently
- slope-chart -- confidence interval -- no color/opacity/style settings exposed for the interval bands (feature toggle exists but no styling)
- slope-chart -- threshold glow -- no glow radius/intensity setting (only color is configurable)

## status-indicator

- status-indicator -- label font -- missing font family and font weight settings (only color and size via `size` field)
- status-indicator -- label font size -- uses `size` (Indicator Appearance), separate from value font size -- naming is confusing
- status-indicator -- sparkline -- background bar color hardcoded `#E2E8F0`, bar opacity hardcoded `0.8` -- not user-configurable
- status-indicator -- sparkline -- dimensions hardcoded `48x16` px -- not user-configurable
- status-indicator -- sparkline -- border-radius hardcoded `2` on both bg and value bars
- status-indicator -- icon stroke -- no stroke width/color for CSS-based icons (circle, square, diamond)
- status-indicator -- status text -- getStatusText returns hardcoded strings ("On Track", "At Risk", "Critical", "Level 4", "Level 5") -- not customizable
- status-indicator -- grid layout -- no column count or cell gap settings for grid mode

## stream-graph

- stream-graph -- missing NumberFormattingCard -- stream-graph settings.ts doesn't import or register NumberFormattingCard, so tooltip/data label values cannot use formatWithSettings number formatting
- stream-graph -- stream display -- showPercentages and showValues are hover-only toggles with no font size/color/weight settings for the hover display
- stream-graph -- axis title -- color fallback hardcoded `#64748B`

## sunburst-chart

- sunburst-chart -- segment padAngle -- hardcoded `0.01`, not user-configurable
- sunburst-chart -- segment cornerRadius -- hardcoded `2`, not user-configurable
- sunburst-chart -- segment label font -- no font size, font color, font family, font weight settings for arc labels (relies solely on shared DataLabelFormattingCard)
- sunburst-chart -- center label -- font-weight hardcoded `'400'`, opacity hardcoded `0.7`
- sunburst-chart -- zoom-out center circle -- fill hardcoded `rgba(148, 163, 184, 0.08)`, stroke hardcoded `rgba(148, 163, 184, 0.2)` -- not configurable
- sunburst-chart -- depth opacity -- per-depth opacity factor hardcoded `1 - (depth-1) * 0.12`, factor not configurable
- sunburst-chart -- breadcrumb font -- missing font family and font weight settings

## timeline-milestone

- timeline-milestone -- connector dash pattern -- hardcoded `'2,2'`, not user-configurable (no line style setting)
- timeline-milestone -- connector width -- hardcoded `1`, not user-configurable
- timeline-milestone -- label truncation -- truncates at 16 chars hardcoded, no setting to control max label length
- timeline-milestone -- label font -- font-weight hardcoded `'600'` for label text, not user-configurable (only axis font family is used)
- timeline-milestone -- swimlane label -- font-size hardcoded `'9px'`, fill uses secondaryTextColor -- no independent swimlane label settings
- timeline-milestone -- swimlane fill -- opacity hardcoded `0.05`, stroke-opacity hardcoded `0.15` -- not user-configurable
- timeline-milestone -- today line -- stroke-width hardcoded `2`, dash-array hardcoded `'4,3'`, opacity hardcoded `0.7` -- only color is configurable
- timeline-milestone -- duration bar corner radius -- hardcoded `2`, not user-configurable
- timeline-milestone -- marker stroke -- default fallback `#fff` if no user color set
- timeline-milestone -- number formatting -- missing NumberFormattingCard entirely (no formatWithSettings support)

## treemap-pro

- treemap-pro -- tile corner radius -- hardcoded `rx='3'`, `ry='3'` -- not user-configurable (tile appearance has stroke but no corner radius)
- treemap-pro -- tile fill opacity -- hardcoded `0.92 * tileOpacityVal` -- the 0.92 base factor is not configurable
- treemap-pro -- label truncation -- hardcoded `~7px per character` approximation, no setting
- treemap-pro -- percentage text -- font-size hardcoded `10`, opacity hardcoded `0.7` -- not configurable
- treemap-pro -- breadcrumb -- missing font family and font weight settings in breadcrumb (settings exist but only apply from drillDownSettings card)
- treemap-pro -- depth color variation -- lighten factor hardcoded `Math.min(0.4, (depth-1) * 0.15)`, factor not configurable

## waffle-chart

- waffle-chart -- tooltip values -- uses `formatPercentValue` (simple `Intl.NumberFormat`) instead of `formatWithSettings` -- NumberFormattingCard is NOT in settings model at all
- waffle-chart -- cell stroke -- hardcoded `1px solid` border width when cellStrokeColor is set -- stroke width not configurable
- waffle-chart -- empty cell opacity -- no opacity setting for empty cells
- waffle-chart -- pictogram empty stroke -- stroke-width hardcoded `4`, not user-configurable
- waffle-chart -- value display position -- always below grid, no setting for position (above, overlay, etc.)
- waffle-chart -- grid wrapper padding -- hardcoded `12px`, not user-configurable

## bar-chart-pro

### Crosshair (all 7 modes)
- bar-chart-pro -- crosshair line -- color hardcoded `#94A3B8`, width hardcoded `1`, dash-array hardcoded `'4 3'` -- no CrosshairFormattingCard integrated (unlike slope-chart and stream-graph which use the shared card)
- bar-chart-pro -- crosshair line -- opacity hardcoded `0.6` when visible

### Small Multiples Cell Styling
- bar-chart-pro -- small multiples cell -- border hardcoded `1px solid rgba(0,0,0,0.06)`, border-radius hardcoded `6px`, padding hardcoded `4px` -- none user-configurable
- bar-chart-pro -- small multiples cell title -- font-size hardcoded `10px`, color hardcoded `#64748B`, font-weight hardcoded `600` -- no settings
- bar-chart-pro -- small multiples -- no cell gap setting, no cell background color setting

### Benchmark Band
- bar-chart-pro -- benchmark band label -- font-size hardcoded `9px` -- no label font settings

### Variance Indicators
- bar-chart-pro -- variance delta label -- font-size hardcoded `10px`, no font family/weight/color settings
- bar-chart-pro -- variance arrow -- font-size hardcoded `9px`

### Pattern Fill
- bar-chart-pro -- pattern fill defs -- pattern geometry (stroke-width `1`-`1.5`, dot radius `1.5`) all hardcoded in SVG pattern defs
- bar-chart-pro -- pattern fill legend -- legend icon pattern stroke hardcoded `#000`, stroke-width hardcoded `1`-`1.5`

### Waterfall Mode
- bar-chart-pro -- waterfall connector -- defaults to `#94A3B8` when setting is empty (acceptable fallback but differs from constant in settings default `#94A3B8`)

### Drill-Down
- bar-chart-pro -- breadcrumb -- missing font family and font weight settings

### Zoom Reset Button
- bar-chart-pro -- zoom reset button -- all styling hardcoded inline (size `24x24`, border-radius `4px`, background `rgba(255,255,255,0.8)`, font-size `12px`)

### Lollipop Style
- bar-chart-pro -- lollipop dot stroke -- no stroke color/width settings for the dot circle

### Axis Titles
- bar-chart-pro -- axis title color -- fallback hardcoded `#64748B` in 4 different render functions

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Hardcoded colors | 48 |
| Hardcoded font sizes / weights | 28 |
| Hardcoded stroke widths | 19 |
| Hardcoded opacities | 16 |
| Hardcoded corner radii | 7 |
| Missing show/hide toggles | 8 |
| Missing font family/weight | 14 |
| Missing NumberFormattingCard | 3 (stream-graph, timeline-milestone, waffle-chart) |
| Total gaps | ~143 |

## Priority Tiers

### P0 -- Data correctness / number formatting
- waffle-chart -- add NumberFormattingCard to settings model, use formatWithSettings for tooltip values
- stream-graph -- add NumberFormattingCard to settings model
- timeline-milestone -- add NumberFormattingCard to settings model

### P1 -- Hardcoded values visible in every render
- bar-chart-pro -- crosshair line color/width/style (integrate CrosshairFormattingCard)
- bar-chart-pro -- small multiples cell border/padding/title font
- bar-chart-pro -- benchmark band label font size
- bar-chart-pro -- variance indicator font sizes
- treemap-pro -- tile corner radius (expose as setting)
- scatter-bubble -- quadrant zone fill colors (expose per-zone color settings)
- scatter-bubble -- cluster colors (expose or use theme palette)
- radial-gauge -- target tick stroke-width
- sunburst-chart -- segment padAngle and cornerRadius

### P2 -- Text formatting completeness
- sankey-diagram -- layer total font family/weight
- radar-chart -- axis label font family/weight
- status-indicator -- label font family/weight
- sunburst-chart -- breadcrumb font family/weight
- bar-chart-pro -- breadcrumb font family/weight
- timeline-milestone -- label font weight control

### P3 -- Polish / minor hardcoded values
- polar-chart -- center dot show/hide toggle
- ring-stack -- overflow indicator styling
- progress-bar-stack -- milestone marker styling
- slope-chart -- dot stroke width
- All visuals -- empty state text styling
