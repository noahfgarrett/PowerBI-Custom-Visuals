# Follow-Up Audit — Post QoL and Interaction Pass
**Date:** 2026-04-22
**Scope:** shared interaction behavior, topology/hierarchy visuals, shared preset/config drift

This follow-up audit focuses on what still stands out after the label, card-style, and cross-filter improvements landed. The remaining issues are less about missing basics and more about consistency, maintainability, and a few behavior gaps in dense visuals.

## Findings

### 1. Cross-filter behavior is still inconsistent in topology and hierarchy visuals
The recent interaction pass moved several category-driven visuals to a focused-highlight model, but the topology/hierarchy group still mainly dims non-matches instead of collapsing to the relevant subset. That means the report experience now differs depending on which visual family the author uses.

Representative refs:
- `packages/network-graph/src/visual.ts`
- `packages/treemap-pro/src/visual.ts`
- `packages/sunburst-chart/src/visual.ts`
- `packages/sankey-diagram/src/visual.ts`

Concrete examples:
- `network-graph` dims non-highlighted nodes/links but keeps the full graph visible.
- `treemap-pro` dims non-highlighted tiles only.
- `sunburst-chart` dims non-highlighted segments only.
- `sankey-diagram` dims nodes and links but does not offer a focused-path mode.

Recommended next step:
- Add a shared interaction mode concept for dense visuals:
  - `dim non-matches`
  - `focus matches`
  - `keep full context`

### 2. Card-style presets still have no single source of truth
The shared renderer is centralized in core, but the preset list itself is still duplicated across every visual’s settings model and capabilities file. Every time we add or rename a preset, we have to touch dozens of files, which is exactly the sort of drift-prone maintenance we want to avoid.

Representative refs:
- `packages/animated-donut-pro/src/settings.ts`
- `packages/gauge-cluster/src/settings.ts`
- `packages/animated-donut-pro/capabilities.json`

Recommended next step:
- Create a shared card-style settings helper in `packages/core` and a small generation path for capabilities enum injection so the preset list is defined once.

### 3. `heatmap-calendar` still has a custom, lightweight legend surface
The heatmap legend is visually serviceable, but it still has a much smaller authoring surface than the shared legend system. It only exposes show/position/thickness/padding/gap, and then pulls typography from unrelated layout/axis settings.

Representative refs:
- `packages/heatmap-calendar/src/settings.ts`
- `packages/heatmap-calendar/src/visual.ts`

Why it stands out:
- No dedicated legend font/color/family/weight settings
- Legend labels inherit from axis/layout choices instead of having a real legend surface
- Still no stronger navigation/focus tooling for large date ranges

Recommended next step:
- Either migrate it onto the shared legend surface, or expand the custom legend card to full typography parity plus larger-range navigation controls.

### 4. `bar-chart-pro` still has a known stacked-100 overlay gap
There is still an explicit TODO in the stacked-100 path where overlays use raw values and are skipped because they are meaningless on the percentage scale. This is now one of the clearest remaining “known rough edges” in an otherwise very mature visual.

Representative ref:
- `packages/bar-chart-pro/src/visual.ts`

Recommended next step:
- Convert target/reference/benchmark overlays to percentage-aware values in `stacked100` mode instead of suppressing them.

## Bottom Line

The next useful work is not another broad QoL sweep. The main things still worth doing are:

1. Standardize interaction modes for hierarchy/topology visuals
2. Remove card-style preset drift by centralizing the preset definition
3. Bring `heatmap-calendar` legend/navigation up to shared-surface parity
4. Finish the `stacked100` overlay story in `bar-chart-pro`
