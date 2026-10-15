# Full Chart QoL Audit — Labeling, Positioning, and Authoring Flexibility
**Date:** 2026-04-22
**Scope:** `packages/*`

This audit supersedes the older April pass where it is now stale. The repo is in a strong place on fundamentals; the remaining work is mostly about helping report authors recover from dense layouts without resizing the visual or changing the dataset.

## Current State

- All visuals now have solid baseline polish: card styling, number formatting, accessibility, tooltips, and selection wiring are broadly present.
- The strongest current authoring surfaces are in `animated-donut-pro`, `sunburst-chart`, `ring-stack`, `sankey-diagram`, `kpi-card`, `bar-chart-pro`, and the richer Cartesian charts.
- The biggest remaining inconsistency is not "missing labels", but "not enough ways to place, reduce, or summarize them when the chart gets crowded."

## Highest-Priority Findings

### 1. Label-position flexibility is still uneven
Some visuals already let authors move labels intelligently, but several dense visuals still rely on one hard-coded geometry path.

Strong examples:
- `progress-bar-stack` already exposes `left`, `right`, and `above` label positions.
- `sankey-diagram` already exposes `inside`, `beside`, `above`, `below`, and hover-only labels.
- `kpi-card` already supports explicit label placement around the value block.

Main gaps:
- `gauge-cluster` has strong label typography controls, but no real label-position model.
- `treemap-pro`, `sunburst-chart`, `timeline-milestone`, `waffle-chart`, and `network-graph` still lean on geometry-driven placement with limited author escape hatches.
- `progress-bar-stack` is good, but still missing a true `inside` or `overlay` mode when authors want compact rows.

### 2. Center and summary content are now good in circular visuals, but not yet consistent across gauge-style visuals
`animated-donut-pro` is now ahead of the pack, and `sunburst-chart` plus `ring-stack` already expose center surfaces. Gauge-style visuals are still simpler than they should be.

Main gaps:
- `radial-gauge` has a center value surface, but not a richer caption/display-mode system.
- `gauge-cluster` has no shared summary/header surface for totals, averages, counts, or selection-aware summaries.

### 3. Dense hierarchy and time visuals still need more "focus" tooling
This is the most visible QoL gap once real-world datasets get large.

Main gaps:
- `treemap-pro` needs Top N or focus reduction and a search/focus path.
- `sunburst-chart` needs hierarchy reduction and search/focus.
- `timeline-milestone` needs windowing or zoom.
- `heatmap-calendar` needs better large-range navigation.

### 4. Override depth is still inconsistent
Multi-item visuals that encode many nodes, links, gauges, or grouped tiles still rely too heavily on global styling.

Main gaps:
- `network-graph`: node/link override groups
- `sankey-diagram`: deeper per-node/per-link overrides
- `gauge-cluster`: per-gauge overrides
- `treemap-pro`: per-node or per-depth overrides
- `waffle-chart`: stronger per-group overrides

### 5. A few older audit conclusions are now stale
The repo no longer has the older `contentPadding` gap, and `animated-donut-pro` is no longer a chart that needs basic center-value work. The backlog is now mostly authoring flexibility, label rescue, and dense-data navigation.

## Label and Positioning Backlog

These are the most valuable label-specific follow-ups:

1. `gauge-cluster`: add label placement modes such as `above arc`, `below value`, `inside gauge`, and `hidden with tooltip`.
2. `progress-bar-stack`: add `inside-start`, `inside-end`, and `inline-value` label modes.
3. `treemap-pro`: add label density controls beyond overflow handling, such as hide thresholds by depth/area and optional value-on-hover only.
4. `timeline-milestone`: add label collision management, compact mode, and scroll/window support.
5. `network-graph`: add label density controls such as always/hover/selected-only and zoom-sensitive label visibility.
6. `radial-gauge`: add center caption/value display modes similar to donut.

## Chart-by-Chart Next Best QoL Add

| Visual | Audit Status | Best Next QoL Add |
|--------|--------------|-------------------|
| `animated-donut-pro` | Strong | Extend the new center system with optional center icon/badge or secondary metric; low urgency. |
| `animated-waterfall` | Strong | Add richer per-series overrides so subtotal/positive/negative styling can be tuned independently. |
| `bar-chart-pro` | Strong | Add broader sort-surface parity across all mixed-mode combinations. |
| `bar-race` | Good | Add shared sort controls and per-series overrides for cleaner race authoring. |
| `box-plot` | Good | Add annotations or crosshair-style reading aids for dense analytical usage. |
| `bullet-chart-pro` | Good | Add richer qualitative-range and target override depth. |
| `bump-chart` | Strong | Add shared sort controls for better ordering parity with other comparison charts. |
| `chord-diagram` | Good | Add deeper group/chord override groups for authors working with many categories. |
| `dumbbell-chart` | Good | Add annotations and/or crosshair aids for dense delta comparisons. |
| `funnel-pro` | Good | Add sort/reduction controls for long stage lists and smaller screens. |
| `gantt-chart-pro` | Good | Add zoom/windowing controls for long timelines. |
| `gauge-cluster` | Needs QoL | Add per-gauge override groups and a real label-position model; this is one of the highest-value label-polish targets. |
| `health-bar` | Good | Add deeper per-bar overrides if multi-measure usage keeps expanding. |
| `heatmap-calendar` | Needs QoL | Upgrade the legend surface to shared-font/polish parity and add better large-range navigation. |
| `kpi-card` | Strong | No urgent QoL gap; current label positioning is already flexible. |
| `morphing-area-chart` | Strong | Add shared sort controls for series/category ordering parity. |
| `network-graph` | Needs QoL | Add node/link override groups plus better label-density controls. |
| `polar-chart` | Good | Add benchmark/reference overlays. |
| `progress-bar-stack` | Good | Add richer label positions and a shared legend/reduction surface for long measure lists. |
| `radar-chart` | Good | Add sort controls plus benchmark/reference overlays. |
| `radial-gauge` | Needs QoL | Add richer center-content modes, caption controls, and better benchmark/threshold storytelling. |
| `ring-stack` | Strong | Add per-ring override groups and possibly selection-aware center content. |
| `sankey-diagram` | Strong | Add deeper per-link/node override groups; label positioning is already in good shape. |
| `scatter-bubble` | Strong | Finish the analytics bundle with annotations and optional crosshair parity. |
| `slope-chart` | Strong | Add shared sort controls. |
| `status-indicator` | Good | Add reduction controls for long status lists. |
| `stream-graph` | Good | Add shared sort controls and optional navigation aids for long time ranges. |
| `sunburst-chart` | Strong | Add hierarchy reduction plus search/focus; center content is already in a good state. |
| `timeline-milestone` | Needs QoL | Add zoom/windowing and better label collision handling; this is another top label-polish target. |
| `treemap-pro` | Needs QoL | Add Top N/focus reduction, search/focus, and deeper node overrides; highest-value hierarchy backlog item. |
| `waffle-chart` | Good | Add reduction controls and stronger per-group overrides for crowded grouped-tile use cases. |

## Priority Order

If we turn this into execution work, the cleanest next sequence is:

1. **Label rescue batch**
   - `gauge-cluster`
   - `progress-bar-stack`
   - `timeline-milestone`
   - `network-graph`
   - `radial-gauge`

2. **Hierarchy focus batch**
   - `treemap-pro`
   - `sunburst-chart`
   - `heatmap-calendar`

3. **Override-depth batch**
   - `gauge-cluster`
   - `network-graph`
   - `sankey-diagram`
   - `treemap-pro`
   - `waffle-chart`

## Code Checks Used For This Audit

Representative files reviewed during this pass:

- `packages/animated-donut-pro/src/settings.ts`
- `packages/progress-bar-stack/src/settings.ts`
- `packages/heatmap-calendar/src/settings.ts`
- `packages/treemap-pro/src/settings.ts`
- `packages/sunburst-chart/src/settings.ts`
- `packages/network-graph/src/settings.ts`
- `packages/sankey-diagram/src/settings.ts`
- `packages/scatter-bubble/src/settings.ts`
- `packages/gauge-cluster/src/settings.ts`
- `packages/radial-gauge/src/settings.ts`
- `packages/timeline-milestone/src/settings.ts`
- `docs/improve/2026-04-08-five-qol-passes-audit.md`

## Bottom Line

The repo does not need another "missing basics" sweep. The next gains are mostly about helping authors handle dense, real-world report layouts:

- more label positioning choices
- better center/header summary surfaces
- better reduction and focus controls
- deeper per-series/per-node/per-gauge overrides
- better navigation in hierarchy and timeline visuals

The best immediate wins are `gauge-cluster`, `treemap-pro`, `timeline-milestone`, `radial-gauge`, `heatmap-calendar`, and `network-graph`.
