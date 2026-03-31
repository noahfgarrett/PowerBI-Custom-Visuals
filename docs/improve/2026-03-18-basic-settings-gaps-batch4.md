# Basic Settings Gaps — Batch 4

**Visuals audited:** radial-gauge, ring-stack, sankey-diagram, scatter-bubble, slope-chart, status-indicator
**Date:** 2026-03-18
**Method:** Read every settings.ts + visual.ts, cross-referenced with shared cards (AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, etc.) to identify what a Power BI user would expect but cannot configure.

---

## 1. Radial Gauge

### Labels / Text
| Gap | Detail |
|-----|--------|
| No toggle for center value text | User cannot hide the center value display — it always renders when data is present |
| No scale label font family/weight | Scale labels inherit from DataLabelFormattingCard for size/color but have no font family or weight control |
| No delta label font customization | Delta indicator font size is hardcoded to `fontSize * 0.45` — no user control for delta font size, color is auto-derived |

### Colors
| Gap | Detail |
|-----|--------|
| No zone border color control | Zone boundary tick marks use the zone's own color — no independent border color picker |

### Axes
_Not applicable — gauge chart, no cartesian axes._

### Legend
| Gap | Detail |
|-----|--------|
| No legend at all | No legend card — user cannot see a legend mapping zone colors to threshold ranges |

### Layout / Chrome
_No gaps — has title/subtitle (shared card), animation on/off + duration, card style._

### Interaction
| Gap | Detail |
|-----|--------|
| No cross-filter on click | No selectionManager — clicking the arc shows a tooltip but does not cross-filter other visuals |
| No right-click context menu | No `showContextMenu` integration — users cannot drill-through or see the PBI context menu |

---

## 2. Ring Stack

### Labels / Text
| Gap | Detail |
|-----|--------|
| No label font family/weight control | Side labels (percentage/value) inherit font size/color from DataLabelFormattingCard but have no font family or weight setting |
| No center content font family | CenterContentSettings has fontSize and fontColor but no fontFamily or fontWeight dropdown (weight is hardcoded to 600) |
| No center label color independent of value | Center label ("Total", "Average", etc.) shares fontColor with the value — cannot style them independently |

### Colors
| Gap | Detail |
|-----|--------|
| No ring stroke width control | `ringStrokeColor` exists but stroke width is hardcoded to `1` — no user setting to change it |
| Limited to 6 ring colors | ColorSettings has ring1Color through ring6Color — if more than 6 measures exist, colors fall to palette defaults with no user override |

### Axes
_Not applicable — ring chart, no cartesian axes._

### Legend
_No gaps — has full LegendFormattingCard with show/hide, position, font size, color, family, weight._

### Layout / Chrome
_No gaps — has title/subtitle, animation, card style, gap/thickness controls._

### Interaction
| Gap | Detail |
|-----|--------|
| No cross-filter on ring click | selectionManager exists but is only used for background click (clear) — clicking a ring arc does not fire `selectionManager.select()` so no cross-filtering |
| No right-click context menu | No `showContextMenu` integration |

---

## 3. Sankey Diagram

### Labels / Text
| Gap | Detail |
|-----|--------|
| No link label font family | LinkLabelSettings has fontSize, fontColor, fontWeight, but no fontFamily dropdown |
| No layer total font family/weight | TotalSettings has totalFontSize and totalFontColor but no font family or weight control |
| No node label line clamping/overflow | Long node labels have no max-width or truncation setting — they can overlap adjacent nodes |

### Colors
| Gap | Detail |
|-----|--------|
| No per-node color override | Node colors come from the theme palette — user cannot override individual node colors (only link colorMode and per-step label colors exist) |
| No link stroke/border | Links have fill opacity and color mode but no stroke/border option |

### Axes
_Not applicable — Sankey has no cartesian axes._

### Legend
_No gaps — has full LegendFormattingCard._

### Layout / Chrome
| Gap | Detail |
|-----|--------|
| No margin/padding control | Chart margins are hardcoded to `{ top: 8, right: 8, bottom: 8, left: 8 }` — no user setting |

### Interaction
_No gaps — has cross-filter on click, context menu, flow highlighting, node drag, flow filtering._

---

## 4. Scatter Bubble

### Labels / Text
| Gap | Detail |
|-----|--------|
| No quadrant label font family/weight/color | QuadrantSettingsCard has labelFontSize but no font family, weight, or color control for quadrant zone labels |
| No trendline label font family/color | TrendlineSettingsCard has labelFontSize but no font family or color for the equation/R-squared text |
| No axis title font size/weight separate from labels | AxisFormattingCard uses one label size/weight for both tick labels and axis titles — no independent title styling |

### Colors
| Gap | Detail |
|-----|--------|
| No quadrant zone fill colors | zoneFillOpacity exists but the fill color is not configurable — it uses a hardcoded grey/default |

### Axes
_No gaps — has full AxisFormattingCard with show/hide, titles, label font, rotation, min/max, grid line style/color/width/opacity._

### Legend
_No gaps — has full LegendFormattingCard._

### Layout / Chrome
| Gap | Detail |
|-----|--------|
| No margin/padding control | Margins are hardcoded `{ top: 20, right: 20, bottom: 40, left: 50 }` — no user setting |

### Interaction
_No gaps — has cross-filter on click, context menu, zoom/pan, tooltips, keyboard nav._

---

## 5. Slope Chart

### Labels / Text
| Gap | Detail |
|-----|--------|
| No category label font family/weight | Category labels beside the dots use labelColor from LabelsChangeSettings but have no font family or weight control |
| No value label font family | Value labels at the start/end dots have no font family control |
| No column header font customization | Left/right column headers ("Before"/"After") have no font size, family, or weight settings — only text content is configurable |

### Colors
| Gap | Detail |
|-----|--------|
| No dot fill color (only stroke) | `dotStrokeColor` exists for the endpoint dots but there is no dot fill color setting — fill inherits from the line/direction color |
| No area fill color independent of line | `showArea` uses the line color with `fillOpacity` — no separate area color picker |

### Axes
| Gap | Detail |
|-----|--------|
| Axis settings mostly hidden | AxisFormattingCard is included but xAxisTitle, yAxisTitle, yAxisMin, yAxisMax, labelRotation, axisLineColor, axisLineWidth, showGridLines, gridLineColor are all set to `visible = false` — user only sees show X/Y axis, label color, and label size |
| No grid lines | Grid lines are force-hidden — user cannot enable them |
| No Y-axis min/max override | Force-hidden — user cannot lock the value scale range |

### Legend
| Gap | Detail |
|-----|--------|
| No legend at all | No LegendFormattingCard — user cannot see a legend mapping categories to colors, which matters when `colorByDirection` is off and series colors are used |

### Layout / Chrome
| Gap | Detail |
|-----|--------|
| No margin/padding control | Margins hardcoded to `{ top: 40, right: 100, bottom: 16, left: 100 }` |

### Interaction
_No gaps — has cross-filter, context menu, crosshair, keyboard nav._

---

## 6. Status Indicator

### Labels / Text
| Gap | Detail |
|-----|--------|
| No label font family/weight | Label text uses `size` for fontSize and `labelColor` for color but has no font family or weight setting |
| No value font family/color | `showValue` + `valueFontSize` exist but there is no value font family, weight, or color control — color inherits from the theme |
| No status text font family | Status text ("On Track", "At Risk") has font-weight hardcoded to 500 — no user control |
| No custom status text labels | Status text strings are hardcoded ("On Track", "At Risk", "Critical", "Level 4", "Level 5") — user cannot customize them |

### Colors
| Gap | Detail |
|-----|--------|
| No icon border/stroke color | Shape indicators have no border/stroke settings — only fill color from threshold status |

### Axes
_Not applicable — indicator chart, no cartesian axes._

### Legend
| Gap | Detail |
|-----|--------|
| No legend at all | No LegendFormattingCard — user cannot see a legend mapping status colors to levels, which would help for grid layouts with many indicators |

### Layout / Chrome
| Gap | Detail |
|-----|--------|
| No spacing/gap control | No setting for gap between status rows — spacing is CSS-driven with no user override |
| No grid column count | Grid layout auto-wraps but user cannot specify the number of columns |

### Interaction
_No gaps — has cross-filter on click, context menu, tooltips, keyboard nav, pulse animation._

---

## Cross-Visual Summary of Most Common Gaps

| Gap Category | Affected Visuals | Priority |
|---|---|---|
| **No cross-filter** (clicking does not filter other visuals) | radial-gauge, ring-stack | High |
| **No right-click context menu** | radial-gauge, ring-stack | High |
| **No legend** | radial-gauge, slope-chart, status-indicator | Medium |
| **Missing font family/weight** on secondary labels | radial-gauge (scale), ring-stack (side labels, center), sankey (link labels, totals), scatter-bubble (quadrant labels, trendline), slope-chart (category labels, column headers), status-indicator (labels, values, status text) | Medium |
| **No margin/padding control** | sankey-diagram, scatter-bubble, slope-chart | Low |
| **Hardcoded stroke widths** | ring-stack (ring stroke = 1px) | Low |
| **No custom status text** | status-indicator | Low |
| **No per-node color override** | sankey-diagram | Medium |
| **Axis settings force-hidden** | slope-chart (grid lines, y-min/max) | Medium |
| **No spacing/gap control** | status-indicator | Low |
