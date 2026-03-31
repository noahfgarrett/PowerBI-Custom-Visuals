# Passes 5-6: Remaining Hardcoded Values in 15 Visuals

Systematic grep of each visual's `visual.ts` for hardcoded hex colors, stroke-widths, font-sizes, opacities, and corner radii that are NOT backed by a user-facing setting.

---

## 1. polar-chart

| Line | Hardcoded Value | What It Affects | Recommended Setting |
|------|----------------|-----------------|---------------------|
| 275 | `'#ffffff'` flood-color, `'0.3'` flood-opacity | Petal hover inner-glow filter | Low priority -- SVG filter internals, not directly visible as a color swatch |
| 312 | `.cornerRadius(3)` | Arc segment corner radius | `segmentCornerRadius` (number, default 3) |
| 333 | `.attr('stroke-opacity', 0.6)` | Grid circle stroke opacity | Already have `gridLineOpacity` setting but it is hidden (`visible=false`); unhide it |
| 356 | `.attr('stroke-opacity', 0.5)` | Radial axis line stroke opacity | Axis line opacity setting |
| 404 | `i * 60` stagger delay | Petal animation stagger | Could use `animationSettings.staggerDelay` if added |
| 614 | `'#94A3B8'`, opacity `0.15` | Center dot decoration | `centerDotColor` / `centerDotOpacity` or hide entirely |

**Verdict:** 2 actionable gaps -- arc cornerRadius (line 312) and center dot color/opacity (line 614).

---

## 2. progress-bar-stack

| Line | Hardcoded Value | What It Affects | Recommended Setting |
|------|----------------|-----------------|---------------------|
| 281 | `rowEl.style.gap = '10px'` | Gap between label and bar within a row | `barSettings.rowGap` (number, default 10) |
| 337 | `'filter 0.2s ease, transform 0.2s ease'` transition | Hover animation timing | Low priority (micro-interaction) |
| 424 | `milestone.style.width = '2px'` | Milestone marker line width | `progressMilestone.milestoneWidth` (number, default 2) |
| 428 | `milestone.style.opacity = '0.7'` | Milestone marker opacity | `progressMilestone.milestoneOpacity` (0-100, default 70) |

**Verdict:** 2 actionable gaps -- milestone width (line 424) and milestone opacity (line 428).

---

## 3. radar-chart

| Line | Hardcoded Value | What It Affects | Recommended Setting |
|------|----------------|-----------------|---------------------|
| 330 | `const margin = 40` | Chart margin/padding | Low priority (layout constant) |
| 392 | `const labelR = radius + 14` | Axis label offset from radius | `axisLabelOffset` (number) |
| 597 | `swatch.style.borderRadius = '2px'` | Legend swatch corner radius | Low priority (micro-detail) |
| 792 | `.attr('stroke-width', 2)` | Benchmark overlay polygon stroke-width | `radarBenchmarkSettings.lineWidth` (number, default 2) |

**Verdict:** 1 actionable gap -- benchmark polygon stroke-width (line 792).

---

## 4. radial-gauge

| Line | Hardcoded Value | What It Affects | Recommended Setting |
|------|----------------|-----------------|---------------------|
| 462 | `.attr('stroke-width', 3)` | Target tick stroke width | `targetSettings.lineWidth` (already exists but target tick uses hardcoded 3 instead) -- **BUG**: should use existing `targetSettings.lineWidth` |
| 575 | `.attr('stroke-width', 1.5)` | Major tick stroke width | `gaugeScaleSettings.majorTickWidth` (number, default 1.5) |
| 605 | `.attr('stroke-width', 0.75)` | Minor tick stroke width | `gaugeScaleSettings.minorTickWidth` (number, default 0.75) |
| 657 | `.attr('stroke-width', 1.5)` | Sparkline stroke width | `gaugeComparisonSettings.sparklineStrokeWidth` (number, default 1.5) |
| 659 | `.attr('opacity', 0.7)` | Sparkline opacity | `gaugeComparisonSettings.sparklineOpacity` (0-100, default 70) |

**Verdict:** 4 actionable gaps -- target tick using hardcoded 3 (line 462, likely a bug), major/minor tick widths (lines 575/605), sparkline stroke-width + opacity (lines 657/659).

---

## 5. ring-stack

| Line | Hardcoded Value | What It Affects | Recommended Setting |
|------|----------------|-----------------|---------------------|
| 490 | `font-size: ${Math.max(8, thickness * 0.6)}px` | Arc label font size (computed from thickness) | Reasonable auto-sizing, low priority |
| 516 | `.attr('stroke-width', 0.5)`, dasharray `'3,2'` | Overflow indicator stroke | `ringSettings.overflowStrokeWidth` |

**Verdict:** 1 minor gap -- overflow indicator stroke (line 516).

---

## 6. sankey-diagram

| Line | Hardcoded Value | What It Affects | Recommended Setting |
|------|----------------|-----------------|---------------------|
| 965 | `'#333333'` font color fallback | Link label font color default | Already has `linkLabelFontColor` -- this is just a fallback default, OK |
| 986 | No `font-family` attr on link labels | Link label font family | **GAP**: `linkLabelSettings.linkLabelFontFamily` (dropdown) |
| 1037 | No `font-family` attr on node value labels | Node value label font family | **GAP**: `totalSettings.totalFontFamily` (dropdown) |
| 1095-1096 | `.attr('font-weight', '600')` on layer totals | Layer total font weight | **GAP**: `totalSettings.totalFontWeight` (dropdown, default '600') |
| 1095 | No `font-family` attr on layer totals | Layer total font family | **GAP**: `totalSettings.totalFontFamily` (dropdown) |

**Verdict:** 3 actionable gaps -- link label font-family (line 986), node value/layer total font-family (lines 1037/1095), layer total font-weight (line 1096).

---

## 7. scatter-bubble

| Line | Hardcoded Value | What It Affects | Recommended Setting |
|------|----------------|-----------------|---------------------|
| 1077-1083 | `'#F59E0B'`, `'#10B981'`, `'#EF4444'`, `'#3B82F6'` | Quadrant zone fill colors | **GAP**: 4 zone color settings: `topLeftColor`, `topRightColor`, `bottomLeftColor`, `bottomRightColor` |
| 1291 | Hardcoded 8-color array for cluster hulls | Cluster hull colors | Low priority -- reasonable palette default |
| 1313 | `stroke-width: '1.5'` | Cluster hull stroke width | `scatterClusterSettings.hullStrokeWidth` (number, default 1.5) |
| 1567 | `playBtn.style.fontSize = '16px'` | Animation play button font | Low priority (UI chrome) |
| 1571 | `stepLabel.style.fontSize = '11px'` | Animation step label font | Low priority (UI chrome) |
| tooltip (LESS) | Tooltip styled via CSS only, no font-size/family/color settings | Custom tooltip DIV styles | Tooltip uses Power BI host service now for most cases; custom DIV tooltip styling is acceptable via CSS |

**Verdict:** 1 high-priority gap -- quadrant zone colors are hardcoded (lines 1077-1083). 1 minor gap -- cluster hull stroke-width.

---

## 8. slope-chart

| Line | Hardcoded Value | What It Affects | Recommended Setting |
|------|----------------|-----------------|---------------------|
| 335 | `dotStrokeColor` fallback `'#FFFFFF'` | Dot stroke color default | Already has `dotStrokeColor` setting, this is just a fallback -- OK |
| 425 | `.attr('stroke-opacity', 0.6)` | Grid line stroke opacity | Already has `gridLineOpacity` setting but it's hidden -- unhide it |
| 590,607 | `.attr('stroke-width', 1.5)` | Threshold band border lines | `slopeThresholdSettings.borderWidth` (number, default 1.5) |
| 738 | `.attr('fill-opacity', 0.1)` | Threshold glow background fill opacity | Already part of threshold visual -- low priority |

**Verdict:** 1 actionable gap -- threshold band border stroke-width (lines 590/607).

---

## 9. status-indicator

| Line | Hardcoded Value | What It Affects | Recommended Setting |
|------|----------------|-----------------|---------------------|
| 617 | `bgRect: fill='#E2E8F0'` | Mini sparkline background bar color | `valueDisplaySettings.sparklineBgColor` (color, default #E2E8F0) |
| 630 | `valueRect: opacity='0.8'` | Mini sparkline value bar opacity | Low priority (decorative element) |
| 597-598 | `width=48, height=16` | Mini sparkline dimensions | `valueDisplaySettings.sparklineWidth` / `sparklineHeight` |

**Verdict:** 2 minor gaps -- sparkline background color (line 617) and sparkline dimensions (lines 597-598).

---

## 10. stream-graph

| Line | Hardcoded Value | What It Affects | Recommended Setting |
|------|----------------|-----------------|---------------------|
| 546,556 | `stop-opacity: streamOpacity * 0.4` | Gradient stop opacity multiplier | Low priority -- derived from existing opacity setting |
| 853 | `style.opacity = '0.2'` for dim | Hover dim amount for non-hovered layers | Could use existing hoverDim infrastructure |

**Verdict:** No actionable gaps found. All significant values are backed by settings.

---

## 11. sunburst-chart

| Line | Hardcoded Value | What It Affects | Recommended Setting |
|------|----------------|-----------------|---------------------|
| 422 | `.padAngle(0.01)` | Arc segment padding angle | `sunburstSettings.segmentPadding` (number, default 0.01 rad) |
| 423 | `.cornerRadius(2)` | Arc segment corner radius | `sunburstSettings.segmentCornerRadius` (number, default 2) |
| 449 | `Math.max(0.6, 1 - (node.depth - 1) * 0.12)` | Per-depth opacity attenuation | `sunburstSettings.depthDimFactor` (number, default 0.12) |
| 744 | `'rgba(148, 163, 184, 0.08)'` fill, `'rgba(148, 163, 184, 0.2)'` stroke | Center zoom-out circle colors | Low priority (navigation UI chrome) |

**Verdict:** 2 actionable gaps -- arc padAngle (line 422) and arc cornerRadius (line 423). Depth dim factor is a nice-to-have.

---

## 12. timeline-milestone

| Line | Hardcoded Value | What It Affects | Recommended Setting |
|------|----------------|-----------------|---------------------|
| 466 | Label truncation `16 -> 14 + '...'` | Max label character length before truncation | `timelineSettings.maxLabelChars` (number, default 16) |
| 897-911 | Today line: `stroke-width=2`, `stroke-dasharray='4,3'`, `opacity=0.7` | Today line visual style | **GAP**: `timelineMarkerSettings.todayLineWidth` (number, default 2), `todayLineStyle` (dropdown), `todayLineOpacity` (0-100, default 70) |
| 407 | Swimlane label `font-size='9px'` | Swimlane category label font size | `spineAndConnectorsSettings.swimlaneLabelFontSize` (number, default 9) |
| 447 | Connector `stroke-dasharray='2,2'` | Milestone connector dash style | `spineAndConnectorsSettings.connectorStyle` (dropdown: solid/dashed/dotted) |

**Verdict:** 3 actionable gaps -- today line styling (lines 897-911), swimlane label font-size (line 407), connector dash style (line 447).

---

## 13. treemap-pro

| Line | Hardcoded Value | What It Affects | Recommended Setting |
|------|----------------|-----------------|---------------------|
| 500 | `withOpacity(effectiveFillColor, 0.92 * tileOpacityVal)` | The 0.92 multiplier on tile fill | Low priority -- blended with existing opacity setting |
| 566 | `pctEl: font-size='10'`, `opacity='0.7'` | Percentage text font-size and opacity | `treemapDisplaySettings.percentageFontSize` (number, default 10) |
| 510 | `leaf.data.name.length * 7` | Character width approximation (7px per char) | Low priority -- layout heuristic |

**Verdict:** 1 minor gap -- percentage label font-size (line 566).

---

## 14. waffle-chart

| Line | Hardcoded Value | What It Affects | Recommended Setting |
|------|----------------|-----------------|---------------------|
| All cell gap/spacing is controlled by `gridSettings.gap` | Already a setting | N/A |
| Grid has no border setting | Grid outer border | `gridSettings.gridBorderColor` / `gridBorderWidth` -- **GAP** |
| 663 | Pictogram unfilled: `stroke-width='4'` | Pictogram outline stroke width for empty cells | `pictogramSettings.outlineStrokeWidth` (number, default 4) |

**Verdict:** 2 actionable gaps -- grid border (no setting exists) and pictogram outline stroke width (line 663).

---

## 15. bar-chart-pro

### Small Multiples Cell Title Font
| Line | Hardcoded Value | What It Affects | Recommended Setting |
|------|----------------|-----------------|---------------------|
| 2421 | `font-size:10px;color:#64748B;font-weight:600` | Cell title in small multiples grid | **GAP**: `smallMultiplesSettings.titleFontSize`, `titleFontColor`, `titleFontWeight` |
| 2461 | `.attr('opacity', 0.85)` | Mini bar opacity in small multiples | `smallMultiplesSettings.barOpacity` (0-100, default 85) |
| 2459 | `.attr('rx', 2).attr('ry', 2)` | Mini bar corner radius | `smallMultiplesSettings.cornerRadius` (number, default 2) |

### Benchmark Band Label Font
| Line | Hardcoded Value | What It Affects | Recommended Setting |
|------|----------------|-----------------|---------------------|
| 2795,2832 | `.attr('font-size', '9px')` | Benchmark band label font size | **GAP**: `benchmarkBandSettings.labelFontSize` (number, default 9) |

### Variance Indicator Font
| Line | Hardcoded Value | What It Affects | Recommended Setting |
|------|----------------|-----------------|---------------------|
| 2943,2994 | `.attr('font-size', '10px')` | Variance arrow font size | **GAP**: `varianceSettings.arrowFontSize` (number, default 10) |
| 2955,3007 | `.attr('font-size', '9px')`, `.attr('font-weight', '600')` | Variance delta text font | **GAP**: `varianceSettings.deltaFontSize` (number, default 9), `deltaFontWeight` (dropdown, default '600') |

### Pareto Line
| Line | Hardcoded Value | What It Affects | Recommended Setting |
|------|----------------|-----------------|---------------------|
| 3402 | `.attr('stroke-width', 2)` | Pareto line stroke width | **GAP**: `paretoSettings.lineWidth` (number, default 2) |
| 3403 | `.attr('stroke-dasharray', '6 3')` | Pareto line dash style | **GAP**: `paretoSettings.lineStyle` (dropdown: solid/dashed/dotted) |
| 3411 | `.attr('r', 3)` | Pareto dot radius | **GAP**: `paretoSettings.dotRadius` (number, default 3) |
| 3436 | `.attr('font-size', '9px')` | 80% threshold label font | **GAP**: `paretoSettings.thresholdLabelFontSize` (number, default 9) |

### Waterfall Connector Dash Style
| Line | Hardcoded Value | What It Affects | Recommended Setting |
|------|----------------|-----------------|---------------------|
| 2369 | `.attr('stroke-dasharray', '3 2')` | Waterfall connector line dash pattern | **GAP**: `waterfallSettings.connectorStyle` (dropdown: solid/dashed/dotted, default 'dashed') |

### Pattern Fill Colors
| Line | Hardcoded Value | What It Affects | Recommended Setting |
|------|----------------|-----------------|---------------------|
| 3076 | `const patternColor = '#000'` (and lines 3151-3178) | Pattern overlay line color | **GAP**: `barSettings.patternColor` (color, default '#000') |

**Verdict:** bar-chart-pro has the most remaining gaps -- 12 actionable items across small multiples, benchmark, variance, Pareto, waterfall, and pattern fill.

---

## Summary: Top Priority Gaps

### Critical (user-visible, no workaround)
1. **bar-chart-pro** -- Small multiples cell title font: hardcoded `10px`, `#64748B`, `600` (line 2421)
2. **bar-chart-pro** -- Pareto dot radius: hardcoded `3` (line 3411)
3. **bar-chart-pro** -- Pareto line stroke-width: hardcoded `2` (line 3402)
4. **bar-chart-pro** -- Pareto line dash style: hardcoded `'6 3'` (line 3403)
5. **bar-chart-pro** -- Variance delta font-size: hardcoded `9px` (lines 2955/3007)
6. **bar-chart-pro** -- Variance arrow font-size: hardcoded `10px` (lines 2943/2994)
7. **bar-chart-pro** -- Benchmark band label font-size: hardcoded `9px` (lines 2795/2832)
8. **bar-chart-pro** -- Waterfall connector dash style: hardcoded `'3 2'` (line 2369)
9. **bar-chart-pro** -- Pattern fill color: hardcoded `'#000'` (line 3076)
10. **scatter-bubble** -- Quadrant zone fill colors: hardcoded 4 colors (lines 1077-1083)
11. **sankey-diagram** -- Link label font-family: missing (line 986)
12. **sankey-diagram** -- Layer total font-family and font-weight: missing (lines 1037/1095-1096)

### Medium (visible but less impactful)
13. **radial-gauge** -- Target tick uses hardcoded `stroke-width=3` instead of existing `targetSettings.lineWidth` (line 462) -- **BUG**
14. **radial-gauge** -- Major/minor tick widths: hardcoded 1.5/0.75 (lines 575/605)
15. **radial-gauge** -- Sparkline stroke-width and opacity: hardcoded 1.5 and 0.7 (lines 657/659)
16. **timeline-milestone** -- Today line width/dash/opacity: all hardcoded (lines 897-911)
17. **timeline-milestone** -- Connector dash style: hardcoded `'2,2'` (line 447)
18. **timeline-milestone** -- Swimlane label font-size: hardcoded `9px` (line 407)
19. **waffle-chart** -- Grid outer border: no setting exists
20. **waffle-chart** -- Pictogram outline stroke-width: hardcoded `4` (line 663)
21. **sunburst-chart** -- Arc padAngle and cornerRadius: hardcoded 0.01 and 2 (lines 422-423)
22. **polar-chart** -- Arc cornerRadius: hardcoded `3` (line 312)
23. **radar-chart** -- Benchmark polygon stroke-width: hardcoded `2` (line 792)

### Low Priority (decorative, computed, or internal)
24. **polar-chart** -- Center dot color `#94A3B8` and opacity `0.15` (line 614)
25. **progress-bar-stack** -- Milestone marker width `2px` and opacity `0.7` (lines 424/428)
26. **slope-chart** -- Threshold border stroke-width `1.5` (lines 590/607)
27. **status-indicator** -- Mini sparkline bg color `#E2E8F0` (line 617)
28. **treemap-pro** -- Percentage label font-size `10` (line 566)
29. **ring-stack** -- Overflow stroke-width `0.5` (line 516)
30. **scatter-bubble** -- Cluster hull stroke-width `1.5` (line 1313)

---

**Total actionable gaps found: 30 items across 14 visuals** (stream-graph is clean).
**Highest concentration: bar-chart-pro (12 items), followed by radial-gauge (4), sankey-diagram (3), timeline-milestone (3).**
