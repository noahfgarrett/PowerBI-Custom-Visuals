# Basic Settings Gaps — Consolidated Report
**Date:** 2026-03-18
**Scope:** All 31 Power BI custom visuals

## Executive Summary
**~200 basic settings gaps found across 31 visuals.** These are everyday formatting options that Power BI users expect but can't access.

---

## P0 — Critical (Users can't do the absolute basics)

### No Tooltips At All
| Visual | Issue |
|--------|-------|
| **health-bar** | Zero tooltip support — no tooltipService calls |
| **progress-bar-stack** | No tooltips on bar segments |

### Using Primitive Tooltips (not PBI tooltipService)
| Visual | Current | Should Be |
|--------|---------|-----------|
| **heatmap-calendar** | HTML `title` attribute | `tooltipService.show()` |
| **bump-chart** | SVG `<title>` | `tooltipService.show()` |
| **stream-graph** | Crosshair only, no element tooltips | `tooltipService.show()` |
| **slope-chart** | SVG `<title>` | `tooltipService.show()` |
| **chord-diagram** | SVG `<title>` on arcs | `tooltipService.show()` |

### No Cross-Filter Click
| Visual | Issue |
|--------|-------|
| **radial-gauge** | No selectionManager.select() on arc click |
| **ring-stack** | selectionManager exists but no click-to-select on rings |
| **waffle-chart** | selectionManager only clears, no cell-level selection |

### No Legend
| Visual | Impact |
|--------|--------|
| **animated-waterfall** | No way to know what green/red/blue bars mean |
| **bar-race** | No color key for categories |
| **bullet-chart-pro** | No legend for range meanings (poor/satisfactory/good) |
| **gauge-cluster** | No legend for zone colors |
| **health-bar** | No legend for color meanings |
| **network-graph** | No legend (especially bad with clustering) |
| **radial-gauge** | No legend for zones |
| **slope-chart** | No legend for direction colors |
| **status-indicator** | No legend for threshold colors |
| **timeline-milestone** | No legend at all |

---

## P1 — High Priority (Common formatting users expect)

### No Per-Series/Category Color Overrides
Users can't change individual bar/arc/segment colors:
animated-donut-pro, animated-waterfall, bar-race, bullet-chart-pro, funnel-pro, gantt-chart-pro, gauge-cluster, health-bar, network-graph, sunburst-chart, timeline-milestone, treemap-pro, waffle-chart

### Missing Font Family/Weight on Key Labels
| Visual | Element Missing Font Control |
|--------|------------------------------|
| animated-waterfall | Value labels |
| bar-race | Value labels |
| dumbbell-chart | Delta labels |
| funnel-pro | Stage labels |
| gantt-chart-pro | Task labels |
| gauge-cluster | Value/label display |
| kpi-card | Trend arrow, comparison text |
| polar-chart | Petal labels (size, family, weight all missing) |
| sunburst-chart | Center content (family, weight) |
| timeline-milestone | Swimlane labels, connector labels |
| waffle-chart | Value display (family, weight) |

### Axis Titles Hidden/Missing
Users can't set X/Y axis titles:
animated-waterfall, box-plot, bullet-chart-pro, dumbbell-chart, health-bar, heatmap-calendar, slope-chart

### Axis Min/Max Hidden
Users can't override axis ranges:
box-plot, bullet-chart-pro, health-bar, radar-chart, slope-chart

### Grid Lines Hidden/Missing
bullet-chart-pro, bar-race, bump-chart, slope-chart

---

## P2 — Standard (Expected formatting options)

### No Spacing/Gap/Padding Control
Every single visual has hardcoded margins/padding. Affects all 31.

### No Stroke Width Control
| Visual | Element |
|--------|---------|
| chord-diagram | Arc thickness hardcoded |
| gantt-chart-pro | Task bar borders |
| gauge-cluster | Arc borders |
| health-bar | Bar borders |
| ring-stack | Ring stroke width (1px hardcoded) |

### No Label Position Control
| Visual | Label Type |
|--------|------------|
| funnel-pro | Stage labels |
| gauge-cluster | Value/label position |
| treemap-pro | Tile labels (stuck top-left) |
| waffle-chart | Value position |
| timeline-milestone | Milestone label position |

### Missing Color Theme Card
animated-waterfall, bullet-chart-pro, gauge-cluster, health-bar, heatmap-calendar, radial-gauge, status-indicator, slope-chart

---

## P3 — Bar Chart Pro Mode-Specific Gaps

### Waterfall Mode (6 hardcoded values)
- Connector line color (#94A3B8), width (1), style (dashed) — not configurable
- Total bar color (#64748B) — not configurable
- Positive bar color — uses theme, not configurable override
- Negative bar color — uses theme, not configurable override

### Lollipop Mode (3 hardcoded values)
- Stem width (2) — not configurable
- Dot radius (6 or barW/2) — not configurable
- No dot shape option (always circle)

### Combo Mode (4 gaps)
- Secondary axis font family/weight not configurable
- Secondary axis min/max not configurable
- Line curve type not configurable (always monotoneX)

### Small Multiples (4 gaps)
- Mini-chart bar corner radius hardcoded (2)
- Mini-chart bar opacity hardcoded (0.85)
- Cell border style not configurable
- Cell title font not configurable

### Pareto Line (4 gaps)
- Line width hardcoded (2)
- Dot radius hardcoded (3)
- Threshold percentage hardcoded (80%)
- No secondary Y-axis label for percentage scale

---

## Gap Count by Visual

| Visual | Gaps | Most Critical |
|--------|:---:|---------------|
| bar-chart-pro | 24 | Waterfall/lollipop mode hardcodes |
| timeline-milestone | 12 | No legend, no colors, many hardcodes |
| health-bar | 10 | No tooltips, no legend, no colors |
| gauge-cluster | 9 | No legend, no per-gauge colors |
| network-graph | 8 | No legend, no link tooltips |
| waffle-chart | 7 | No cell click, no number format |
| gantt-chart-pro | 7 | No per-task colors, no stroke |
| radial-gauge | 6 | No cross-filter, no legend |
| funnel-pro | 6 | No label position, no stage font size |
| bullet-chart-pro | 6 | No legend, all axis hidden |
| animated-waterfall | 6 | No legend, no color theme |
| sunburst-chart | 5 | No per-segment colors |
| treemap-pro | 5 | No per-tile colors |
| slope-chart | 5 | No legend, grid hidden |
| bar-race | 5 | No legend, axis dead |
| polar-chart | 4 | Label font controls missing |
| stream-graph | 4 | No PBI tooltips |
| chord-diagram | 4 | Arc thickness, SVG tooltips |
| heatmap-calendar | 4 | HTML title tooltips |
| dumbbell-chart | 3 | Delta label font |
| radar-chart | 3 | Min/max hidden |
| ring-stack | 3 | No click select, stroke width |
| bump-chart | 3 | SVG tooltips, grid hidden |
| status-indicator | 3 | No legend, hardcoded status text |
| animated-donut-pro | 2 | Hidden label settings |
| progress-bar-stack | 2 | No tooltips |
| box-plot | 2 | Axis titles hidden |
| scatter-bubble | 1 | Custom DIV tooltips |
| kpi-card | 2 | Trend font controls |
| morphing-area-chart | 2 | Duplicate axis cards |
