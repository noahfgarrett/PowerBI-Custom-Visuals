# Basic Settings Gaps Audit -- Batch 2

**Date:** 2026-03-18
**Visuals:** dumbbell-chart, funnel-pro, gantt-chart-pro, gauge-cluster, health-bar, heatmap-calendar

Methodology: Read each visual's `settings.ts` and `visual.ts`, cross-referenced against
the shared `AxisFormattingCard`, `LegendFormattingCard`, `DataLabelFormattingCard`, and
`TitleFormattingCard` from `packages/core/src/shared-settings.ts`.

Only **gaps** are listed below. If a capability is present, it is omitted.

---

## 1. Dumbbell Chart

### Labels / Text
| Check | Status |
|---|---|
| Toggle data labels on/off | Present (DataLabelFormattingCard + DeltaLabelSettings) |
| Label font size, color, family | Present for data labels (shared card). Delta labels have size + color but **no font family** |
| Label position | Present (delta labels: above/center/below; data labels: shared position) |
| Rotate axis labels | **MISSING** -- `axisLabelRotation` is explicitly hidden (`visible = false`) |
| Set axis titles | **MISSING** -- `xAxisTitle` and `yAxisTitle` explicitly hidden |
| Override axis min/max | **MISSING** -- `yAxisMin` and `yAxisMax` explicitly hidden |

### Colors
| Check | Status |
|---|---|
| Primary element color | Present (startColor, endColor) |
| Individual series/category colors | Present (SeriesFormattingCard) |
| Border/stroke color and width | Present (dotStrokeColor, dotStrokeWidth) |
| Background | Present (cardSettings) |

### Axes
| Check | Status |
|---|---|
| Show/hide X and Y axes | Present (DumbbellAxisFormattingCard) |
| Override axis min/max | **MISSING** -- hidden in visual.ts |
| Show/hide grid lines | Present |
| Style grid lines | Present |

### Legend
| Check | Status |
|---|---|
| Show/hide legend | Present |
| Legend position and font | Present |

### Layout / Chrome
| Check | Status |
|---|---|
| Spacing/padding | Partial -- scroll minCategoryWidth exists but **no explicit chart margin/padding control** |
| Title/subtitle | Present (TitleFormattingCard with subtitle) |
| Toggle animations | Present |

### Interaction
| Check | Status |
|---|---|
| Cross-filter on click | Present (selectionManager) |
| Tooltips on hover | Present (tooltipService) |
| Keyboard navigation | Present (AccessibilityFormattingCard) |

### Dumbbell Chart Gap Summary
1. **Delta label font family** -- size and color exist, but no font family picker
2. **Axis label rotation** -- property exists in shared card but explicitly hidden
3. **Axis titles** -- shared card properties hidden
4. **Axis min/max override** -- shared card properties hidden
5. **Chart margin/padding control** -- no user-facing setting

---

## 2. Funnel Pro

### Labels / Text
| Check | Status |
|---|---|
| Toggle data labels on/off | Partial -- `showValues` toggle exists, but shared `showDataLabels` is **hidden** (`visible = false`) |
| Label font size, color, family | **PARTIAL** -- stage labelColor is a single color picker; no font size or font family for stage labels. Value labels use shared DataLabelFormattingCard for styling. |
| Label position | **MISSING** -- stage labels are hard-coded to center of trapezoid; no position control |
| Rotate axis labels | **NOT APPLICABLE** (no traditional axes) |
| Set axis titles | **NOT APPLICABLE** (no traditional axes) |

### Colors
| Check | Status |
|---|---|
| Primary element color | Present (baseColor with gradient) |
| Individual series/category colors | **MISSING** -- no per-stage color picker (only gradient from baseColor or theme palette) |
| Border/stroke color and width | Present (segmentStrokeColor, segmentStrokeWidth) |
| Background | Present (cardSettings) |

### Axes
| Check | Status |
|---|---|
| Show/hide X and Y axes | N/A -- explicitly hidden; funnel has no traditional axes |
| Override axis min/max | N/A |
| Show/hide grid lines | Present (horizontal reference grid lines between stages) |
| Style grid lines | Present (color, style) |

### Legend
| Check | Status |
|---|---|
| Show/hide legend | Present |
| Legend position and font | Present |

### Layout / Chrome
| Check | Status |
|---|---|
| Spacing/padding | Present (gap between stages) |
| Title/subtitle | Present (TitleFormattingCard) |
| Toggle animations | Present |

### Interaction
| Check | Status |
|---|---|
| Cross-filter on click | Present (selectionManager) |
| Tooltips on hover | Present (tooltipService) |
| Keyboard navigation | Present (AccessibilityFormattingCard) |

### Funnel Pro Gap Summary
1. **Stage label font size** -- no font size control for stage name labels (only labelColor)
2. **Stage label font family** -- no font family picker for stage name labels
3. **Stage label position** -- hard-coded center; no above/below/outside option
4. **Per-stage color override** -- no individual color picker per funnel stage (no SeriesFormattingCard)
5. **Sort/scroll cards** -- no SortFormattingCard or ScrollFormattingCard for large funnel datasets

---

## 3. Gantt Chart Pro

### Labels / Text
| Check | Status |
|---|---|
| Toggle data labels on/off | Present (showLabels, showProgress via DataLabelFormattingCard) |
| Label font size, color, family | **PARTIAL** -- task label color and size come from shared AxisFormattingCard; **no font family picker** for task labels (axisLabelFontFamily not present in gantt settings card) |
| Label position | **MISSING** -- task labels are left-fixed with configurable width but no position option |
| Rotate axis labels | **MISSING** -- no axisLabelRotation control (date tick labels always horizontal) |
| Set axis titles | **MISSING** -- no axis title properties in gantt settings |

### Colors
| Check | Status |
|---|---|
| Primary element color | Present (barColor, progressColor) |
| Individual series/category colors | **MISSING** -- no SeriesFormattingCard; no per-task or per-category color |
| Border/stroke color and width | **MISSING** -- no task bar stroke/border settings |
| Background | Present (cardSettings) |

### Axes
| Check | Status |
|---|---|
| Show/hide X and Y axes | Partial -- shared AxisFormattingCard provides show/hide but **visible is not controlled**; date timeline header always shows |
| Override axis min/max | **MISSING** -- no way to override date range min/max |
| Show/hide grid lines | Present |
| Style grid lines | Present |

### Legend
| Check | Status |
|---|---|
| Show/hide legend | Present (LegendFormattingCard) |
| Legend position and font | Present |

### Layout / Chrome
| Check | Status |
|---|---|
| Spacing/padding | Present (rowGap, labelWidth, indentWidth) |
| Title/subtitle | Present (TitleFormattingCard) |
| Toggle animations | Present |

### Interaction
| Check | Status |
|---|---|
| Cross-filter on click | Present (selectionManager) |
| Tooltips on hover | Present (tooltipService -- 3 calls) |
| Keyboard navigation | Present (AccessibilityFormattingCard) |

### Gantt Chart Pro Gap Summary
1. **Task label font family** -- only color and size from axis card; no dedicated font family
2. **Task label position** -- fixed left; no option for inside-bar or right-aligned
3. **Axis label rotation** -- not exposed (date labels always horizontal)
4. **Axis titles** -- no x/y axis title settings
5. **Per-task/category bar color** -- no SeriesFormattingCard; tasks all share barColor
6. **Task bar stroke/border** -- no stroke color or width setting on task bars
7. **Date range min/max override** -- no way to constrain the visible timeline
8. **Sort card** -- no SortFormattingCard (tasks render in data order only)
9. **Scroll card** -- no ScrollFormattingCard (relies on hierarchy collapse only)
10. **Number formatting card** -- no NumberFormattingCard (progress values use hardcoded formatPercent)
11. **Reference line / trend line cards** -- not present (unlike other chart visuals)

---

## 4. Gauge Cluster

### Labels / Text
| Check | Status |
|---|---|
| Toggle data labels on/off | Present (showLabels + showValues gated by DataLabelFormattingCard.showDataLabels) |
| Label font size, color, family, weight | Present (labelsSettings card has all four) |
| Label position | **MISSING** -- label always below arc, value always centered; no position override |
| Rotate axis labels | **NOT APPLICABLE** (no traditional axes) |
| Set axis titles | **NOT APPLICABLE** (no traditional axes) |

### Colors
| Check | Status |
|---|---|
| Primary element color | Present (zone colors: low/mid/high) |
| Individual series/category colors | **MISSING** -- no per-gauge color override; all gauges use same zone color logic |
| Border/stroke color and width | **MISSING** -- arc has no stroke settings (fill only) |
| Background | Present (cardSettings) |

### Axes
| Check | Status |
|---|---|
| Show/hide X and Y axes | N/A (radial gauge, no axes) |
| Override axis min/max | Present (valueRangeSettings: minValue, maxValue) |
| Show/hide grid lines | N/A |

### Legend
| Check | Status |
|---|---|
| Show/hide legend | **MISSING** -- no LegendFormattingCard |
| Legend position and font | **MISSING** |

### Layout / Chrome
| Check | Status |
|---|---|
| Spacing/padding | Partial -- gaugesPerRow controls grid, but **no cell gap/padding setting** |
| Title/subtitle | Present (TitleFormattingCard + labelsSettings subtitle) |
| Toggle animations | Present |

### Interaction
| Check | Status |
|---|---|
| Cross-filter on click | Present (selectionManager) |
| Tooltips on hover | Present (tooltipService) |
| Keyboard navigation | Present (AccessibilityFormattingCard) |

### Gauge Cluster Gap Summary
1. **No legend** -- no LegendFormattingCard; no way to show a legend mapping categories to colors
2. **No per-gauge color override** -- all gauges use the same zone color thresholds
3. **Arc stroke/border settings** -- no stroke color or width on arcs
4. **Label position** -- always below arc; value always centered; no user control
5. **Grid cell gap/padding** -- no gap setting between gauge cells
6. **Color theme card** -- no ColorThemeFormattingCard (unlike dumbbell/funnel)
7. **Sort card** -- only sortByValue toggle; no full SortFormattingCard with ascending/descending/alphabetical
8. **Scroll card** -- no ScrollFormattingCard for overflow when many gauges
9. **Reference line / trend line cards** -- not present
10. **Series formatting card** -- not present

---

## 5. Health Bar

### Labels / Text
| Check | Status |
|---|---|
| Toggle data labels on/off | Present (showValue gated by DataLabelFormattingCard.showDataLabels) |
| Label font size, color, family, weight | Present for category labels (categoryLabelSettings); value labels via shared DataLabelFormattingCard |
| Label position | Present (valueLabelsSettings.position: above/inside/end/right) |
| Rotate axis labels | **MISSING** -- axisLabelRotation hidden (`visible = false`) |
| Set axis titles | **MISSING** -- xAxisTitle/yAxisTitle hidden (`visible = false`) |

### Colors
| Check | Status |
|---|---|
| Primary element color | Present (low/mid/high gradient colors) |
| Individual series/category colors | **MISSING** -- no per-bar color override (no SeriesFormattingCard) |
| Border/stroke color and width | **MISSING** -- no bar stroke/border settings (only track color) |
| Background | Present (cardSettings with multiple style modes) |

### Axes
| Check | Status |
|---|---|
| Show/hide X and Y axes | Partial -- showYAxis toggle exists in scaleRangeSettings; showXAxis is hidden |
| Override axis min/max | Present (scaleRangeSettings: minValue, maxValue) |
| Show/hide grid lines | Present (via shared AxisFormattingCard) |
| Style grid lines | Present |

### Legend
| Check | Status |
|---|---|
| Show/hide legend | **MISSING** -- no LegendFormattingCard |
| Legend position and font | **MISSING** |

### Layout / Chrome
| Check | Status |
|---|---|
| Spacing/padding | Present (gap between bars, barWidth) |
| Title/subtitle | Present (TitleFormattingCard) |
| Toggle animations | Present (with stagger delay) |

### Interaction
| Check | Status |
|---|---|
| Cross-filter on click | Present (selectionManager) |
| Tooltips on hover | **MISSING** -- no tooltipService calls; no native title attribute tooltips |
| Keyboard navigation | Present (AccessibilityFormattingCard) |

### Health Bar Gap Summary
1. **No tooltips** -- no tooltipService usage at all; hovering over bars shows nothing
2. **No legend** -- no LegendFormattingCard to explain color mapping
3. **Per-bar color override** -- no SeriesFormattingCard; all bars share the same gradient
4. **Bar stroke/border** -- no stroke color or width on bars
5. **Axis label rotation** -- hidden
6. **Axis titles** -- hidden
7. **Show X-axis toggle** -- hidden (category labels always controlled by categoryLabelSettings.show)
8. **Color theme card** -- no ColorThemeFormattingCard

---

## 6. Heatmap Calendar

### Labels / Text
| Check | Status |
|---|---|
| Toggle data labels on/off | Present (DataLabelFormattingCard.showDataLabels) |
| Label font size, color, family | **PARTIAL** -- axis card provides label color and size for day/month/year labels; **no font family picker** (axisLabelFontFamily hidden) |
| Label position | N/A -- labels are positional by nature (month headers, day-of-week) |
| Rotate axis labels | **NOT APPLICABLE** (no axis labels to rotate) |
| Set axis titles | **MISSING** -- xAxisTitle/yAxisTitle hidden |

### Colors
| Check | Status |
|---|---|
| Primary element color | Present (color scale: low/high/mid colors) |
| Individual series/category colors | N/A (single-measure heatmap, no categories to color individually) |
| Border/stroke color and width | Present (cellStrokeColor, cellStrokeWidth) |
| Background | Present (cardSettings) |

### Axes
| Check | Status |
|---|---|
| Show/hide X and Y axes | **HIDDEN** -- showXAxis/showYAxis exist in shared card but hidden; showMonthLabels/showDayLabels serve the equivalent role |
| Override axis min/max | **MISSING** -- all axis min/max hidden; no way to override the color scale domain min/max |
| Show/hide grid lines | **HIDDEN** -- all grid line properties hidden; cell stroke serves a similar visual purpose |

### Legend
| Check | Status |
|---|---|
| Show/hide legend | Present (custom legendSettings card) |
| Legend position | Present (bottom/top/right) |
| Legend font size and color | **PARTIAL** -- uses axis card values; **no dedicated legend font size/family/weight controls** |

### Layout / Chrome
| Check | Status |
|---|---|
| Spacing/padding | Present (cellSize, cellGap) |
| Title/subtitle | Present (TitleFormattingCard) |
| Toggle animations | Present |

### Interaction
| Check | Status |
|---|---|
| Cross-filter on click | Present (selectionManager) |
| Tooltips on hover | **PARTIAL** -- uses native `cell.title` attribute, not Power BI's tooltipService; no rich/custom tooltip content |
| Keyboard navigation | Present (AccessibilityFormattingCard) |

### Heatmap Calendar Gap Summary
1. **No Power BI native tooltips** -- uses HTML `title` attribute; no tooltipService integration for rich tooltips
2. **Label font family** -- axisLabelFontFamily is hidden; no font family control for labels
3. **Color scale domain override** -- no min/max override for the color scale (auto-computed from data)
4. **Legend font controls** -- no dedicated font size, family, or weight for legend labels (borrows from axis card)
5. **Color theme card** -- no ColorThemeFormattingCard
6. **Sort card** -- no SortFormattingCard
7. **Scroll card** -- no ScrollFormattingCard (calendar can overflow horizontally)
8. **Reference line / trend line cards** -- not present
9. **Series formatting card** -- not present (N/A for single-measure visual)

---

## Cross-Visual Priority Matrix

Sorted by how many visuals are affected and user impact:

| Gap | Affected Visuals | Priority |
|---|---|---|
| **No Power BI tooltips** | health-bar, heatmap-calendar (partial) | **P0** -- basic UX expectation |
| **No legend** | gauge-cluster, health-bar | **P0** -- users need color explanations |
| **No per-series/category color** | funnel-pro, gantt-chart-pro, gauge-cluster, health-bar | **P1** -- common ask |
| **No axis titles** | dumbbell, gantt, health-bar, heatmap (hidden) | **P1** -- standard chart feature |
| **No label font family** | dumbbell (delta), gantt, heatmap | **P1** -- brand consistency |
| **No axis label rotation** | dumbbell, health-bar (hidden) | **P2** -- long category names |
| **No axis min/max override** | dumbbell (hidden), gantt (date range) | **P2** -- data framing |
| **No bar/arc stroke** | gantt (task bars), gauge-cluster (arcs), health-bar (bars) | **P2** -- visual refinement |
| **No stage label font size** | funnel-pro | **P2** -- readability control |
| **No label position control** | funnel-pro (stage labels), gauge-cluster (value/label) | **P2** -- layout flexibility |
| **No scroll card** | gantt, gauge-cluster, heatmap | **P3** -- overflow management |
| **No sort card** | gantt, heatmap | **P3** -- ordering control |
| **No color theme card** | gauge-cluster, health-bar, heatmap | **P3** -- theme consistency |
| **Grid cell gap (gauge)** | gauge-cluster | **P3** -- layout polish |
