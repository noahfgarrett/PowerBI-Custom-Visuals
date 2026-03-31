# Necessities Audit 2 -- Element-by-Element & Data Formatting

**Date**: 2026-03-18
**Scope**: Pass 3 (element customization) + Pass 4 (data formatting) for 10 visuals

---

## Pass 3: Element-by-Element Customization Gaps

Checked each visible element for: Color, Size, Visibility (show/hide), Position/Alignment.
Listed only MISSING necessities.

---

### 1. Health Bar

**Elements checked**: bars, track, labels, target markers, value text, zones

| Element | Missing |
|---------|---------|
| Value text | No separate font color -- uses shared DataLabelFormattingCard, which is fine. No issue. |
| Value text (inside mode) | Hardcoded `#FFFFFF` fill when position = "inside" -- no user override for inside-bar text color |
| Zone background | No per-zone opacity control -- all zones share a hardcoded `0.12` opacity |
| Zone labels | Zone legend uses generic "High", "Mid", "Low" labels -- no user-customizable zone label text |

**Missing necessities:**
- **(HB-1)** Value text inside bars is hardcoded white -- needs an "Inside Text Color" setting or auto-contrast logic
- **(HB-2)** Zone opacity is hardcoded at 12% -- should use a configurable "Zone Opacity" setting

---

### 2. Heatmap Calendar

**Elements checked**: cells, day labels, month labels, year label, legend, streaks

| Element | Missing |
|---------|---------|
| Year label | No show/hide toggle -- always rendered. Users with single-year data cannot hide it |
| Day labels / Month labels / Year label | All share one axisLabelColor + axisLabelSize. Cannot style year label differently from day labels |
| Legend | No font size/color/family override for legend labels -- inherits from axisLabelColor |
| Legend bar | Hardcoded width 200px (horizontal) / 12px (vertical) -- no size control |
| Streak outline | No configurable outline width -- hardcoded `2px solid` |

**Missing necessities:**
- **(HC-1)** No show/hide toggle for year label -- add `showYearLabels` to CalendarLayoutSettings
- **(HC-2)** Legend label font has no independent size/color control -- uses axisLabelColor only

---

### 3. KPI Card

**Elements checked**: value number, label, trend arrow, sparkline, progress bar, comparison text, divider

| Element | Missing |
|---------|---------|
| Sparkline | Min/max marker colors are hardcoded (`#F87171` for min, `#34D399` for max) -- no user override |
| Progress bar | Track background is hardcoded `rgba(0,0,0,0.1)` -- no configurable track color |
| Progress bar | Height is hardcoded `6px` -- no bar height setting |
| Divider | Only has color control -- no width/thickness setting |
| Comparison text | No font family / font weight control |
| Value alignment | Value element has no horizontal alignment control (always left-aligned) |

**Missing necessities:**
- **(KPI-1)** Progress bar track color is hardcoded -- needs a "Track Color" setting in KpiGoalSettings
- **(KPI-2)** Progress bar height is hardcoded at 6px -- needs a "Bar Height" setting
- **(KPI-3)** Comparison text has no font family/weight control -- add fontFamily + fontWeight to KpiComparisonSettings
- **(KPI-4)** Value number has no horizontal alignment (left/center/right) -- add `alignment` to ValueSettings

---

### 4. Morphing Area Chart

**Elements checked**: area fills, lines, dots, axes, crosshair, brush selection area

| Element | Missing |
|---------|---------|
| Dots | Dot fill color defaults to line color -- no independent "Dot Fill Color" setting |
| Brush context | Context chart has no separate line color / area fill color -- inherits from main chart |
| Brush handles | No handle color/style control |
| Forecast band | No color control -- forecast band color is derived from series color. No independent "Forecast Color" setting |

**Missing necessities:**
- **(MA-1)** Forecast band has no color control -- add `forecastColor` to ForecastSettingsCard
- **(MA-2)** Dots have no independent fill color -- add `dotFillColor` ColorPicker to LineAndPointsCard

---

### 5. Network Graph

**Elements checked**: nodes, links, arrows, labels, search box, cluster hulls

| Element | Missing |
|---------|---------|
| Tooltips | Uses SVG `<title>` elements (browser native) instead of PBI tooltipService -- no formatted values, no multi-line tooltips |
| Node fill color | No per-node or default node fill color setting -- color comes only from palette/clustering. No explicit "Default Node Color" |
| Search box | No styling controls (font size, background color, border color) -- all hardcoded |
| Arrow color | Arrow marker color hardcoded to linkColor -- no independent arrow color |
| Cluster hulls | Clustering colors nodes but does NOT render convex hull outlines around clusters |
| Link labels | No link label/weight display -- even when weight data is provided, it is not shown on the link |
| Number formatting | No NumberFormattingCard at all -- cannot format weight values if they were shown |

**Missing necessities:**
- **(NG-1)** Tooltips use SVG `<title>` instead of PBI tooltipService -- must migrate to `host.tooltipService.show()` with formatted data
- **(NG-2)** No NumberFormattingCard -- add to settings model for tooltip value formatting
- **(NG-3)** No default node fill color setting -- add `defaultNodeColor` ColorPicker to NodeSettings
- **(NG-4)** Search box styling is hardcoded -- not critical but a gap

---

### 6. Polar Chart

**Elements checked**: petals, center dot, radial labels, inner labels, grid rings

| Element | Missing |
|---------|---------|
| Grid rings | Ring count is hardcoded at 4 -- no "Grid Levels" setting (unlike radar which has `gridLevels`) |
| Grid rings | No stroke width control -- grid ring stroke width is not configurable |
| Center area | No center dot/circle rendered -- this is fine (not applicable to nightingale chart) |
| Inner labels | Inner labels show but have no separate font size/color from outer labels -- shared via labelSettings |
| Petal stroke | Has stroke color + width, but no stroke opacity control |

**Missing necessities:**
- **(PC-1)** Grid ring count is hardcoded at 4 -- add `gridLevels` NumUpDown to allow user control
- **(PC-2)** Grid ring stroke width is not configurable -- uses axis formatting card `gridLineWidth` but this is currently available, so no actual gap here

---

### 7. Progress Bar Stack

**Elements checked**: bar fills, tracks, labels, value text, milestones

| Element | Missing |
|---------|---------|
| Category labels | No show/hide toggle for category labels -- always shown |
| Milestone labels | Milestones have no labels rendered (just tick marks with title tooltip) -- no visible milestone label text |
| Milestone width | Hardcoded at 1px -- no width/thickness setting |
| Track stroke | No track border/stroke control |
| Value text position | Value text always appears after the bar -- no position control (inside, above, etc.) |

**Missing necessities:**
- **(PBS-1)** Category labels have no show/hide toggle -- add `showLabels` ToggleSwitch to BarLayoutSettings
- **(PBS-2)** Value text has no position control (inside/outside/end) -- add `valuePosition` dropdown
- **(PBS-3)** Milestone tick width is hardcoded at 1px -- add `milestoneWidth` setting

---

### 8. Radar Chart

**Elements checked**: polygons, dots, axes, grid web, axis values

| Element | Missing |
|---------|---------|
| Axis labels | Font family hidden (`axisLabelFontFamily.visible = false`) -- no font family control for axis labels |
| Series stroke width | No per-series or global line width control -- polygon stroke width is hardcoded |
| Dot stroke | No dot stroke color/width control -- dots only have fill color (from series color) |
| Grid web fill | Web fill opacity exists, but no web fill color control -- fill color always derives from web stroke color |

**Missing necessities:**
- **(RC-1)** Axis label font family is forcibly hidden -- should be exposed so users can customize
- **(RC-2)** No polygon/series stroke width control -- add `lineWidth` NumUpDown to RadarAppearanceSettings
- **(RC-3)** Dot stroke color/width not configurable -- add `dotStrokeColor` + `dotStrokeWidth` to RadarAppearanceSettings

---

### 9. Radial Gauge

**Elements checked**: arc, zones, needle, scale ticks, value text, delta text

| Element | Missing |
|---------|---------|
| Delta text | Font size auto-calculated as `fontSize * 0.45` -- no independent delta font size control |
| Delta text | No font family / font weight control -- inherits nothing explicitly |
| Scale labels | Font size/color come from DataLabelFormattingCard, which is a reasonable reuse |
| Needle length | Needle extends to outer radius -- no length/overshoot control |
| Sparkline | No sparkline color control -- uses value text color |
| Sparkline | No sparkline line width control -- hardcoded at 1.5 |

**Missing necessities:**
- **(RG-1)** Delta text has no independent font size -- add `deltaFontSize` to GaugeComparisonSettings
- **(RG-2)** Delta text has no font family/weight -- add `deltaFontFamily` + `deltaFontWeight`
- **(RG-3)** Mini sparkline has no color or width control -- add `sparklineColor` and `sparklineWidth`

---

### 10. Ring Stack

**Elements checked**: rings, center text, arc labels, overflow indicator

| Element | Missing |
|---------|---------|
| Side labels (ring-label) | No font size/color/family/weight controls -- all come from CSS defaults |
| Side labels | No show/hide toggle for the side labels (percentage labels) -- controlled by `showLabels` but cannot independently hide ring names |
| Arc labels | Font size auto-calculated from ring thickness (`thickness * 0.6`) -- no independent control |
| Arc labels | Font color auto-set to arc fill color -- no independent override |
| Overflow indicator | Color auto-derived from ring color at 40% opacity -- no independent color control |
| Overflow indicator | Dash pattern hardcoded `3,2` -- no style control |
| Center label | Font weight hardcoded at `400` -- shares fontWeight from center content but only value text uses it |

**Missing necessities:**
- **(RS-1)** Side labels have no font size/color/family/weight settings -- add label formatting (fontSize, fontColor, fontFamily, fontWeight) to RingSettings or a new card
- **(RS-2)** Arc label font size is auto-calculated, no user control -- add `arcLabelFontSize` NumUpDown
- **(RS-3)** Arc label color is always arc fill color -- add `arcLabelColor` ColorPicker for override

---

## Pass 4: Data Formatting Check

Verified each visual for: `formatWithSettings()` / `numberFormattingCard` usage on ALL displayed numbers, percentage consistency, K/M/B abbreviation support, and tooltip formatting.

---

### Summary Table

| Visual | Has NumberFormattingCard | formatWithSettings on values | formatWithSettings on tooltips | Percentages consistent | Gaps |
|--------|------------------------|-------------------------------|-------------------------------|----------------------|------|
| Health Bar | YES | YES (value labels) | YES (value + target) | YES (`formatPercent` used) | None |
| Heatmap Calendar | YES | YES (data labels, legend) | YES (tooltip value) | N/A | None |
| KPI Card | YES | YES (value, trend delta, comparison) | YES (value, target, delta) | Comparison % uses `toFixed(1)` -- not `formatWithSettings` but acceptable for % | Minor |
| Morphing Area Chart | YES | YES (axes, data labels, reference line, crosshair) | YES | N/A | None |
| Network Graph | **NO** | **NO** | **NO** (uses SVG `<title>` only) | N/A | **CRITICAL** |
| Polar Chart | YES | YES (data labels) | YES (tooltip value) | N/A | None |
| Progress Bar Stack | YES | YES (value labels, reference line) | YES (value, target, %) | `Math.round(pct * 100)%` for % -- not using `formatWithSettings` | Minor |
| Radar Chart | YES | YES (data labels, axis values) | YES (tooltip value) | N/A | None |
| Radial Gauge | YES | YES (center value, scale labels, delta) | YES (value, target) | N/A | None |
| Ring Stack | YES | YES (center value, side labels when raw mode) | YES (value, percent, max) | `formatNumber` for %, `formatWithSettings` for raw -- consistent | None |

---

### Data Formatting Gaps

**(DF-1) Network Graph -- No NumberFormattingCard, no formatWithSettings, no PBI tooltips**
- The network-graph has NO `NumberFormattingCard` in its settings model
- Node tooltips use native SVG `<title>` elements (just the node name) -- not PBI's `tooltipService`
- Link weights are not displayed anywhere and have no formatting
- **Fix**: Add NumberFormattingCard to NetworkGraphSettings, migrate tooltips to `host.tooltipService.show()`, include node degree and link weight in tooltip data items

**(DF-2) Progress Bar Stack -- Percentage uses `Math.round()` instead of `formatWithSettings`**
- Percentage display uses `Math.round(pct * 100)%` which ignores number formatting settings
- Tooltip `% Complete` also uses `Math.round(pct * 100)%`
- **Fix**: Use `formatWithSettings(pct * 100, numberFormattingCard)` with `%` suffix, or create a consistent `formatPercent` call

**(DF-3) KPI Card -- Comparison percentage uses `toFixed(1)` instead of `formatWithSettings`**
- Comparison text builds `${sign}${pct}% ${vsLabel}` using `.toFixed(1)` -- not routed through numberFormattingCard
- Minor since this is a percentage, but inconsistent with other formatted values
- **Fix**: Route through `formatWithSettings` or `formatPercent` for consistency

---

## Priority Summary (All Missing Necessities)

### Critical (breaks core UX expectations)
1. **(NG-1)** Network Graph: Tooltips use SVG `<title>` instead of PBI tooltipService
2. **(NG-2)** Network Graph: No NumberFormattingCard at all
3. **(DF-1)** Network Graph: No formatted numbers anywhere

### High (standard feature users expect to customize)
4. **(KPI-4)** KPI Card: Value number has no horizontal alignment
5. **(PBS-1)** Progress Bar Stack: Category labels have no show/hide toggle
6. **(PBS-2)** Progress Bar Stack: Value text has no position control
7. **(RC-2)** Radar Chart: No polygon/series stroke width control
8. **(RS-1)** Ring Stack: Side labels have no font size/color/family/weight
9. **(RG-1)** Radial Gauge: Delta text has no independent font size
10. **(HC-1)** Heatmap Calendar: Year label has no show/hide toggle

### Medium (polish gaps)
11. **(HB-1)** Health Bar: Inside text color hardcoded white
12. **(HB-2)** Health Bar: Zone opacity hardcoded at 12%
13. **(KPI-1)** KPI Card: Progress bar track color hardcoded
14. **(KPI-2)** KPI Card: Progress bar height hardcoded at 6px
15. **(KPI-3)** KPI Card: Comparison text missing font family/weight
16. **(MA-1)** Morphing Area Chart: Forecast band has no color control
17. **(MA-2)** Morphing Area Chart: Dots have no independent fill color
18. **(NG-3)** Network Graph: No default node fill color setting
19. **(PC-1)** Polar Chart: Grid ring count hardcoded at 4
20. **(PBS-3)** Progress Bar Stack: Milestone tick width hardcoded
21. **(RC-1)** Radar Chart: Axis label font family forcibly hidden
22. **(RC-3)** Radar Chart: Dot stroke not configurable
23. **(RG-2)** Radial Gauge: Delta text missing font family/weight
24. **(RG-3)** Radial Gauge: Mini sparkline has no color/width control
25. **(RS-2)** Ring Stack: Arc label font size auto-calculated, no control
26. **(RS-3)** Ring Stack: Arc label color always matches arc fill
27. **(HC-2)** Heatmap Calendar: Legend labels have no independent font control
28. **(DF-2)** Progress Bar Stack: % uses Math.round instead of formatWithSettings
29. **(DF-3)** KPI Card: Comparison % uses toFixed instead of formatWithSettings
