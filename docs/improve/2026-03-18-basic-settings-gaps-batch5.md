# Basic Settings Gaps -- Batch 5

**Visuals audited:** stream-graph, sunburst-chart, timeline-milestone, treemap-pro, waffle-chart, bar-chart-pro
**Date:** 2026-03-18
**Method:** Read settings.ts + visual.ts for each visual; cross-referenced shared-settings.ts cards.

---

## 1. stream-graph

### Labels / Text
| Check | Status | Detail |
|---|---|---|
| Toggle data labels on/off | OK | `DataLabelFormattingCard.showDataLabels` |
| Label font size, color, family, weight | OK | Shared `DataLabelFormattingCard` applied via `applyDataLabelFormatting` |
| Label position | OK | Shared `DataLabelFormattingCard.dataLabelPosition` |
| Rotate axis labels | OK | Shared `AxisFormattingCard.axisLabelRotation` |
| Axis titles | OK | Shared `AxisFormattingCard.xAxisTitle / yAxisTitle` |

### Colors
| Check | Status | Detail |
|---|---|---|
| Primary element color | OK | Per-series via `SeriesFormattingCard` |
| Series colors independently | OK | `SeriesFormattingCard` groups |
| Border/stroke color & width | OK | `streamStrokeColor`, `streamStrokeWidth` |

### Axes
| Check | Status | Detail |
|---|---|---|
| Show/hide each axis | OK | `StreamDisplaySettingsCard.showXAxis / showYAxis` |
| Override min/max | GAP | Y-axis min/max slices exist in shared AxisFormattingCard but are **hidden** (`visible = false`); user cannot override |
| Grid lines | GAP | `showGridLines` is **hidden** (`visible = false`); user cannot toggle grid lines on |

### Legend
| Check | Status | Detail |
|---|---|---|
| Show/hide | OK | `LegendFormattingCard.showLegend` |
| Position & font | OK | Full legend formatting |

### Layout / Chrome
| Check | Status | Detail |
|---|---|---|
| Title/subtitle | OK | `TitleFormattingCard` |
| Animation on/off | OK | `AnimationSettings.enabled` |
| Spacing/gap control | N/A | Continuous area chart, no gaps |

### Interaction
| Check | Status | Detail |
|---|---|---|
| Cross-filter on click | OK | `selectionManager.select` on layer click |
| Tooltips on hover | GAP | **No Power BI `tooltipService` integration** -- relies on crosshair overlay only; standard PBI tooltips do not appear |
| Keyboard nav | OK | `AccessibilityFormattingCard.enableKeyboardNav` |

### Other Gaps
- **GAP: No Number Format card** -- crosshair/hover values use raw numbers with no user-configurable display units, decimal places, prefix, or suffix.
- **GAP: No Scroll/Zoom support** -- large datasets with many categories cannot be scrolled or zoomed.

**Total gaps: 4**

---

## 2. sunburst-chart

### Labels / Text
| Check | Status | Detail |
|---|---|---|
| Toggle data labels on/off | OK | `labelsAndPercentagesSettings.showLabels` + `DataLabelFormattingCard.showDataLabels` |
| Label font size, color, family, weight | OK | Shared `DataLabelFormattingCard` applied via `applyDataLabelFormatting` on `.sunburst-label` |
| Label position | PARTIAL | Shared card has position dropdown but position is meaningless on arc labels (they follow the arc). Not a real gap. |
| Axis labels / rotation | N/A | No axes |
| Axis titles | N/A | No axes |

### Colors
| Check | Status | Detail |
|---|---|---|
| Primary element color | OK | Chart palette / color theme |
| Series colors independently | GAP | **No per-series/segment color overrides** -- no `SeriesFormattingCard`; user cannot set individual segment colors |
| Border/stroke color & width | OK | `segmentStrokeColor`, `segmentStrokeWidth` |

### Axes
N/A -- radial chart, no linear axes.

### Legend
| Check | Status | Detail |
|---|---|---|
| Show/hide | OK | `LegendFormattingCard.showLegend` |
| Position & font | OK | Full legend formatting |

### Layout / Chrome
| Check | Status | Detail |
|---|---|---|
| Title/subtitle | OK | `TitleFormattingCard` |
| Animation on/off | OK | `AnimationSettings.enabled` |
| Spacing/gap control | GAP | **No segment padding/gap control** -- padding between rings is not configurable |

### Interaction
| Check | Status | Detail |
|---|---|---|
| Cross-filter on click | OK | `selectionManager.select` on segment click |
| Tooltips on hover | OK | `tooltipService.show` |
| Keyboard nav | OK | `AccessibilityFormattingCard.enableKeyboardNav` |

### Other Gaps
- **GAP: Center content missing font family and font weight** -- `CenterContentSettings` has `fontSize` and `fontColor` but no `fontFamily` or `fontWeight`.
- **GAP: Center content label missing font color** -- label below center value has `labelFontSize` but no `labelFontColor`.
- **GAP: No Scroll/Zoom support** -- deeply nested hierarchies cannot be zoomed independently of drill-down.

**Total gaps: 5**

---

## 3. timeline-milestone

### Labels / Text
| Check | Status | Detail |
|---|---|---|
| Toggle data labels on/off | OK | `DataLabelFormattingCard.showDataLabels` |
| Label font size, color, family, weight | PARTIAL | Font size and family come from `AxisFormattingCard.axisLabelSize / axisLabelFontFamily`; font weight is **hardcoded to `600`** in visual.ts:460; font color comes from theme, not from data label card |
| Label position | GAP | **No label position control** -- labels are hardcoded above or below based on alternating layout; user cannot override |
| Axis labels / rotation | GAP | **No axis label rotation** -- shared card has `axisLabelRotation` but timeline renders dates along the spine with no rotation support |
| Axis titles | OK | Shared `AxisFormattingCard.xAxisTitle / yAxisTitle` (though Y-axis title is unusual for a timeline) |

### Colors
| Check | Status | Detail |
|---|---|---|
| Primary element color | OK | Marker color by category |
| Series colors independently | GAP | **No per-category color overrides** -- `colorByCategory` toggle exists but no way to pick individual category colors; no `SeriesFormattingCard` |
| Border/stroke color & width | PARTIAL | `markerStrokeColor` exists but **no marker stroke width** setting |

### Axes
| Check | Status | Detail |
|---|---|---|
| Show/hide each axis | OK | Shared `AxisFormattingCard.showXAxis / showYAxis` |
| Override min/max | GAP | **No date range min/max override** -- the timeline auto-scales to data range; user cannot set explicit start/end dates for the axis |
| Grid lines | OK | Shared `AxisFormattingCard.showGridLines` |

### Legend
| Check | Status | Detail |
|---|---|---|
| Show/hide | GAP | **No legend at all** -- timeline has categories (color-coded markers) but no legend card; `LegendFormattingCard` is not imported or instantiated |
| Position & font | GAP | No legend = no configuration |

### Layout / Chrome
| Check | Status | Detail |
|---|---|---|
| Title/subtitle | OK | `TitleFormattingCard` |
| Animation on/off | OK | `AnimationSettings.enabled` |
| Spacing/gap control | GAP | **No milestone spacing control** -- spacing between milestones is auto-computed; user cannot set min spacing |

### Interaction
| Check | Status | Detail |
|---|---|---|
| Cross-filter on click | OK | `selectionManager.select` on marker click |
| Tooltips on hover | OK | `tooltipService.show` |
| Keyboard nav | OK | `AccessibilityFormattingCard.enableKeyboardNav` |

### Other Gaps
- **GAP: No Number Format card** -- milestone values (if any) use raw formatting with no display units, decimal, prefix/suffix control.
- **GAP: Marker stroke width missing** -- `markerStrokeColor` exists but no corresponding `markerStrokeWidth`.
- **GAP: Connector line style not configurable** -- `showConnectors` toggle exists but connector line style (dashed/dotted/solid) and color inherit from spine settings with no override.
- **GAP: Swimlane label font not configurable** -- swimlane labels use `labelColor` from SpineAndConnectors but no font size, family, or weight.
- **GAP: Duration bar color not configurable** -- `showDurationBars`, opacity, height exist but no color picker (inherits marker color).

**Total gaps: 12**

---

## 4. treemap-pro

### Labels / Text
| Check | Status | Detail |
|---|---|---|
| Toggle data labels on/off | OK | `treemapSettings.showLabels`, `treemapSettings.showValues`, `DataLabelFormattingCard.showDataLabels` |
| Label font size, color, family, weight | OK | Shared `DataLabelFormattingCard` applied via `applyDataLabelFormatting` on `.treemap-label` and `.treemap-value` |
| Label position | GAP | **No label position control within tiles** -- labels are always top-left (x=6, y=16); user cannot position center, bottom, etc. |
| Axis labels / rotation | N/A | No axes |
| Axis titles | N/A | No axes |

### Colors
| Check | Status | Detail |
|---|---|---|
| Primary element color | OK | Chart palette / color theme / heat coloring |
| Series colors independently | GAP | **No per-category color overrides** -- no `SeriesFormattingCard`; user cannot set individual tile colors |
| Border/stroke color & width | OK | `tileStrokeColor`, `tileStrokeWidth` |

### Axes
N/A -- no linear axes.

### Legend
| Check | Status | Detail |
|---|---|---|
| Show/hide | OK | `LegendFormattingCard.showLegend` |
| Position & font | OK | Full legend formatting |

### Layout / Chrome
| Check | Status | Detail |
|---|---|---|
| Title/subtitle | OK | `TitleFormattingCard` |
| Animation on/off | OK | `AnimationSettings.enabled` |
| Spacing/gap control | OK | `treemapSettings.tilePadding` |

### Interaction
| Check | Status | Detail |
|---|---|---|
| Cross-filter on click | OK | `selectionManager.select` on tile click |
| Tooltips on hover | OK | `tooltipService.show` |
| Keyboard nav | OK | `AccessibilityFormattingCard.enableKeyboardNav` |

### Other Gaps
- **GAP: Tile label font size not independently configurable** -- the shared DataLabelFormattingCard controls both category label and value label size; no way to make category name larger than value.
- **GAP: No tile opacity setting** -- individual tile opacity is not configurable (only conditional formatting and heat coloring provide color variation).
- **GAP: Percentage display font hardcoded** -- percentage text uses hardcoded `font-size='10'` and `opacity='0.7'` (visual.ts:539-540); not configurable.

**Total gaps: 5**

---

## 5. waffle-chart

### Labels / Text
| Check | Status | Detail |
|---|---|---|
| Toggle data labels on/off | OK | `DataLabelFormattingCard.showDataLabels` |
| Label font size, color, family, weight | PARTIAL | `DataLabelFormattingCard` applied to `.waffle-value`, but **value display** has its own `fontSize` and `fontColor` with **no fontFamily or fontWeight** |
| Label position | GAP | **No value display position** -- percentage value is always centered; user cannot move it above/below the grid |
| Axis labels / rotation | N/A | No axes |
| Axis titles | N/A | No axes |

### Colors
| Check | Status | Detail |
|---|---|---|
| Primary fill color | OK | `colorSettings.fillColor` |
| Empty color | OK | `colorSettings.emptyColor` |
| Cell stroke color | OK | `colorSettings.cellStrokeColor` |
| Cell stroke width | GAP | **No cell stroke width** -- `cellStrokeColor` exists but no `cellStrokeWidth` |
| Multi-category colors | GAP | **No per-category color overrides** -- single `fillColor` for all filled cells; no `SeriesFormattingCard` or category-level color control for multi-measure scenarios |

### Axes
N/A -- no axes.

### Legend
| Check | Status | Detail |
|---|---|---|
| Show/hide | OK | `LegendFormattingCard.showLegend` |
| Position & font | OK | Full legend formatting |

### Layout / Chrome
| Check | Status | Detail |
|---|---|---|
| Title/subtitle | OK | `TitleFormattingCard` |
| Animation on/off | OK | `AnimationSettings.enabled` |
| Spacing/gap control | OK | `gridSettings.gap` |

### Interaction
| Check | Status | Detail |
|---|---|---|
| Cross-filter on click | GAP | **No cross-filter on cell click** -- `selectionManager` is created but only used for `clear()` on background click; individual cells have no click-to-select |
| Tooltips on hover | OK | `tooltipService.show` |
| Keyboard nav | OK | `AccessibilityFormattingCard.enableKeyboardNav` |

### Other Gaps
- **GAP: Value display missing fontFamily and fontWeight** -- `ValueSettings` has `fontSize` and `fontColor` but no `fontFamily` or `fontWeight`.
- **GAP: No Number Format card** -- percentage display and tooltip values use raw formatting with no display units, decimal places, prefix/suffix control.
- **GAP: No cell opacity setting** -- filled/empty cell opacity is not configurable independently (only pictogram has `outlineOpacity`).

**Total gaps: 7**

---

## 6. bar-chart-pro (FLAGSHIP -- extra thorough)

### Labels / Text
| Check | Status | Detail |
|---|---|---|
| Toggle data labels on/off | OK | `barSettings.showDataLabels` dropdown (none/above/inside) |
| Label font size, color, family, weight | OK | Shared `DataLabelFormattingCard` (with showDataLabels/position hidden in favor of bar-specific dropdown) |
| Label position | OK | `barSettings.showDataLabels` (none/above/inside) + shared card position |
| Rotate axis labels | OK | `AxisFormattingCard.axisLabelRotation` |
| Axis titles | OK | `AxisFormattingCard.xAxisTitle / yAxisTitle` |

### Colors
| Check | Status | Detail |
|---|---|---|
| Primary element color | OK | Per-series via `SeriesFormattingCard` |
| Series colors independently | OK | `SeriesFormattingCard` groups |
| Border/stroke color & width | OK | `barBorderColor`, `barBorderWidth` |

### Axes
| Check | Status | Detail |
|---|---|---|
| Show/hide each axis | OK | `AxisFormattingCard.showXAxis / showYAxis` |
| Override min/max | OK | `AxisFormattingCard.yAxisMin / yAxisMax` |
| Grid lines | OK | Full grid line formatting |

### Legend
| Check | Status | Detail |
|---|---|---|
| Show/hide | OK | `LegendFormattingCard.showLegend` |
| Position & font | OK | Full legend formatting |

### Layout / Chrome
| Check | Status | Detail |
|---|---|---|
| Title/subtitle | OK | `TitleFormattingCard` |
| Animation on/off | OK | `AnimationSettings.enabled` |
| Spacing/gap control | OK | `barSettings.barSpacing` |

### Interaction
| Check | Status | Detail |
|---|---|---|
| Cross-filter on click | OK | `selectionManager.select` on bar click |
| Tooltips on hover | OK | `tooltipService.show` |
| Keyboard nav | OK | `AccessibilityFormattingCard.enableKeyboardNav` |

### Mode-Specific Gaps

#### Waterfall Mode
| Gap | Detail |
|---|---|
| **Connector line color not configurable** | Hardcoded `#94A3B8` (visual.ts:2338) |
| **Connector line width not configurable** | Hardcoded `1` (visual.ts:2339) |
| **Connector line style not configurable** | Hardcoded `3 2` dash array (visual.ts:2340) |
| **Total bar color not configurable** | Hardcoded `#64748B` (visual.ts:2297); user cannot distinguish totals from positive/negative with custom colors |
| **Positive/negative bar colors not configurable** | Uses `theme.semantic.positive / negative` (visual.ts:2303); user gets no override (unlike variance indicators which have `positiveColor / negativeColor`) |
| **No "mark as total" UI** | Total bars are null-valued rows in data; no explicit setting to mark a category as a total vs. a regular increment |

#### Lollipop Mode
| Gap | Detail |
|---|---|
| **Stem width not configurable** | Hardcoded `2` (visual.ts:1148, 2001) |
| **Dot radius not configurable** | Hardcoded `Math.min(6, barW / 2)` (visual.ts:1156, 2008); no setting for lollipop dot size |
| **Dot shape not configurable** | Always circle; no option for diamond, square, etc. |

#### Combo Mode
| Gap | Detail |
|---|---|
| **Secondary axis label font not independently configurable** | Secondary Y-axis labels inherit primary axis formatting; no separate font size/color/family |
| **Secondary axis min/max not configurable** | No `secondaryYAxisMin / secondaryYAxisMax` settings; auto-scales only |
| **Line curve type not configurable** | Line always uses d3 default (linear interpolation); no option for smooth/step/monotone |
| **Line width not configurable at card level** | Global line width only available per-series; no "all lines" width setting in Line Settings card |

#### Horizontal Mode
| Gap | Detail |
|---|---|
| **Horizontal data label position limited** | Only `above` (end of bar) and `inside` positions; no `center` or `base` position |
| **Crosshair disabled in horizontal mode** | visual.ts:1017 explicitly skips crosshair when `mode === 'horizontal'` |
| **Category label truncation not configurable** | Long category names on Y-axis are not truncated; no max-width or truncation setting |

### Other bar-chart-pro Gaps
| Gap | Detail |
|---|---|
| **Target line width not configurable** | `TargetLineSettings` has show, label, style, color but **no width** |
| **Pareto line width not configurable** | Hardcoded `stroke-width: 2` (visual.ts:3364) |
| **Pareto line style not configurable** | Hardcoded `stroke-dasharray: 6 3` (visual.ts:3365); always dashed |
| **Pareto dot size not configurable** | Hardcoded `r: 3` (visual.ts:3373) |
| **Pareto threshold percentage not configurable** | Hardcoded 80% (visual.ts:3380); user cannot set custom threshold |
| **Small multiples gap not configurable** | Hardcoded `gap: 4px` (visual.ts:2363) |
| **Small multiples cell title font not configurable** | Hardcoded `font-size: 10px; color: #64748B; font-weight: 600` (visual.ts:2392) |
| **Small multiples row count not configurable** | Auto-computed from entries/cols; user cannot set explicit row count |
| **Benchmark band label font not configurable** | Band label inherits defaults; no font size/color/family settings |

**Total gaps: 24**

---

## Summary

| Visual | Gap Count | Most Critical |
|---|---|---|
| stream-graph | 4 | No PBI tooltips; no number format card |
| sunburst-chart | 5 | No per-segment color overrides; center content font gaps |
| timeline-milestone | 12 | No legend; no per-category colors; many sub-element gaps |
| treemap-pro | 5 | No per-tile color overrides; label position stuck top-left |
| waffle-chart | 7 | No cross-filter; no cell stroke width; no number format |
| bar-chart-pro | 24 | Waterfall connectors/colors all hardcoded; lollipop sizes hardcoded; secondary axis min/max missing |
| **TOTAL** | **57** | |

### Priority Recommendations (highest impact first)

1. **bar-chart-pro waterfall settings** -- Add WaterfallSettings card: connector color/width/style, total bar color, positive/negative color overrides. These are the most visible hardcoded values in the flagship chart.
2. **bar-chart-pro lollipop settings** -- Add stem width, dot radius, dot shape to Bar Settings (conditionally visible when barStyle = lollipop).
3. **bar-chart-pro target line width** -- Add `width` NumUpDown to TargetLineSettings.
4. **timeline-milestone legend** -- Add LegendFormattingCard import and instantiation; critical for category-colored timelines.
5. **waffle-chart cross-filter** -- Wire up `selectionManager.select` on filled cell click with selection IDs.
6. **stream-graph PBI tooltips** -- Add `tooltipService.show` on layer hover (in addition to crosshair).
7. **Number Format cards** -- Add to stream-graph, timeline-milestone, and waffle-chart.
8. **Per-category/segment colors** -- Add SeriesFormattingCard to sunburst-chart, treemap-pro, timeline-milestone, waffle-chart.
9. **bar-chart-pro secondary axis min/max** -- Add `secondaryYAxisMin / secondaryYAxisMax` to SecondaryAxisSettings.
10. **bar-chart-pro horizontal crosshair** -- Remove the `mode !== 'horizontal'` guard; adapt crosshair for horizontal orientation.
