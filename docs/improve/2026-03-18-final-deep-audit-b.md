# Final Deep Audit B -- 8 Visuals (2026-03-18)

Visuals: funnel-pro, gantt-chart-pro, gauge-cluster, health-bar, heatmap-calendar, kpi-card, morphing-area-chart, network-graph

---

## 1. funnel-pro

### Check 3 -- Missing `.visible = false` on hidden shared properties
- **ISSUE**: `axisFormattingCard.axisLabelFontWeight` is NOT hidden. Funnel-pro hides most axis sub-properties but forgets `axisLabelFontWeight`. Since the axis card is used only for axisLabelColor/axisLabelSize/axisLineColor/axisLineWidth/showGridLines/gridLineColor/gridLineStyle, the font weight toggle is exposed but has no effect.
  - File: `/Users/noahgarrett/codebase/PowerBI/packages/funnel-pro/src/visual.ts` (lines 114-123)

### Check 3 -- Missing `.visible = false` on hidden shared properties
- **ISSUE**: `axisFormattingCard.gridLineStyle` is NOT hidden. The visual reads `gridLineStyle` via the dropdown accessor, so this one is actually functional -- **not a bug**, ignore.

### Check 3 -- Missing `.visible = false` on hidden shared properties
- **ISSUE**: `dataLabelFormattingCard.dataLabelFontFamily`, `dataLabelFormattingCard.dataLabelFontWeight`, `dataLabelFormattingCard.dataLabelPosition`, `dataLabelFormattingCard.dataLabelFontColor`, `dataLabelFormattingCard.dataLabelFontSize` are all visible even though `showDataLabels` is hidden (line 124). The visual hides `showDataLabels` but leaves all other data label sub-properties exposed. Since `showDataLabels` is hidden (always off by default?), none of the styling controls do anything. They should all be hidden OR `showDataLabels` should not be hidden.
  - File: `/Users/noahgarrett/codebase/PowerBI/packages/funnel-pro/src/visual.ts` (line 124)

### All other checks: Clean

---

## 2. gantt-chart-pro

### Check 3 -- Missing `.visible = false` on hidden shared properties
- **ISSUE**: `axisFormattingCard.axisLabelFontWeight` is NOT hidden. Same pattern as funnel-pro -- all other axis sub-properties are hidden but font weight is exposed with no effect.
  - File: `/Users/noahgarrett/codebase/PowerBI/packages/gantt-chart-pro/src/visual.ts` (lines 121-134)
- **ISSUE**: `axisFormattingCard.gridLineStyle` is NOT hidden. The visual reads grid style via its own `applyAxisCardFormatting` which does read `gridLineStyle`, so this IS functional -- **not a bug**.

### Check 3 -- Missing `.visible = false` on grouping sub-properties
- **ISSUE**: `hierarchyGroupingSettings.indentWidth`, `hierarchyGroupingSettings.showToggle`, `hierarchyGroupingSettings.collapseByDefault` are still visible when `enableGrouping` is false. Only `collapsibleGroups` is hidden (line 152). The other three sub-settings should also be hidden when grouping is disabled.
  - File: `/Users/noahgarrett/codebase/PowerBI/packages/gantt-chart-pro/src/visual.ts` (lines 151-157)

### All other checks: Clean

---

## 3. gauge-cluster

### Check 1 -- capabilities.json vs settings.ts sync
- Clean. All objects in capabilities.json have matching cards in settings.ts.

### Check 3 -- Missing `.visible = false`
- **ISSUE**: `animationSettings.duration` is hidden when `enabled` is off (line 104), but this pattern is not applied to `labelsSettings` sub-properties. When `showLabels` is off, `labelFontSize`, `labelFontColor`, `labelFontFamily`, `labelFontWeight` remain visible but have no effect (labels not rendered). Same for when `showValues` is off -- `labelFontSize` etc. apply to value text too but no conditional hiding is done.
  - File: `/Users/noahgarrett/codebase/PowerBI/packages/gauge-cluster/src/visual.ts` (lines 101-106)
  - Severity: Low -- cosmetic inconsistency rather than a bug.

### All other checks: Clean

---

## 4. health-bar

### Check 3 -- Missing `.visible = false` on hidden shared properties
- **ISSUE**: `axisFormattingCard.yAxisTitle` is NOT hidden. The visual hides `xAxisTitle` (line 114) but leaves `yAxisTitle` visible. Health-bar does not render a Y-axis title -- the Y-axis is handled by its own `scaleRangeSettings.showYAxis`. The exposed `yAxisTitle` field does nothing.
  - File: `/Users/noahgarrett/codebase/PowerBI/packages/health-bar/src/visual.ts` (lines 112-118)
- **ISSUE**: `axisFormattingCard.axisLabelFontWeight` is NOT hidden.
- **ISSUE**: `axisFormattingCard.axisLineColor`, `axisFormattingCard.axisLineWidth`, `axisFormattingCard.showGridLines`, `axisFormattingCard.gridLineColor`, `axisFormattingCard.gridLineStyle` are NOT hidden. Health-bar uses its own grid rendering via `applyGridFormatting()` and `applyAxisFormatting()` which DO consume these values -- so these are actually functional. **Not bugs**.
- **ISSUE**: `axisFormattingCard.gridLineWidth` and `axisFormattingCard.gridLineOpacity` are NOT hidden, and `applyGridFormatting` from core does use these. **Not bugs**.

### All other checks: Clean

---

## 5. heatmap-calendar

### Check 1 -- capabilities.json vs settings.ts sync
- **ISSUE**: `_legacyCalendarSettings` card (name `calendarSettings`) is in the settings model but intentionally excluded from the `cards` array. This means the legacy `labelColor` property defined in capabilities.json under `calendarSettings` will never be sent to the formatting pane, but Power BI will still try to persist/load it from saved reports. The runtime sets `.visible = false` on `labelColor` (line 107). This is a deliberate backward-compat shim -- not a bug, just a known artifact.

### Check 3 -- Missing `.visible = false` on hidden shared properties
- **ISSUE**: `axisFormattingCard.axisLabelFontWeight` is NOT hidden. Heatmap-calendar hides nearly all axis sub-properties (lines 90-104) but misses `axisLabelFontWeight`. The `applyAxisLabelFormatting` method does not read it from the axis card -- it reads font weight from `calendarLayoutSettings.labelFontWeight` instead. The axis font weight toggle is therefore a dead control.
  - File: `/Users/noahgarrett/codebase/PowerBI/packages/heatmap-calendar/src/visual.ts` (lines 90-104)

### All other checks: Clean

---

## 6. kpi-card

### Check 1 -- capabilities.json vs settings.ts sync
- Clean. Highly customized visual with mostly local cards; no shared axis/legend cards to desync.

### Check 7 -- Legend correctness
- **N/A**: KPI card has no legend card -- appropriate for a single-value KPI visual.

### All 8 checks: Clean

---

## 7. morphing-area-chart

### Check 3 -- Missing `.visible = false` on hidden shared properties
- **ISSUE**: `axisFormattingCard.axisLabelFontWeight` is NOT hidden. The visual hides `axisLabelFontFamily` and `axisLabelRotation` (lines 145-146) but forgets `axisLabelFontWeight`. The `applyAxisFormatting` core helper does consume this value, so it IS functional. **Not a bug** -- but inconsistent with the hiding of `axisLabelFontFamily`.

### All other checks: Clean

---

## 8. network-graph

### Check 3 -- Missing `.visible = false` on hidden shared properties
- **ISSUE**: `dataLabelFormattingCard` has `showDataLabels` hidden (line 123), but all other data label sub-properties (`dataLabelFontSize`, `dataLabelFontColor`, `dataLabelFontWeight`, `dataLabelFontFamily`, `dataLabelPosition`) remain visible. The visual calls `applyDataLabelFormatting` targeting `.network-label` which means these properties DO affect the network labels. However, hiding `showDataLabels` means the user cannot toggle data labels on/off through the shared card -- the visual uses its own `nodeSettings.showLabels` instead. The orphaned sub-properties (font size, color, etc.) from the shared card are applied on top of the node-specific font settings, which can cause confusing dual-control behavior.
  - File: `/Users/noahgarrett/codebase/PowerBI/packages/network-graph/src/visual.ts` (line 123, line 821)
  - The node-level `fontSize`, `fontColor`, `fontFamily`, `fontWeight` settings set attributes directly on label elements, and then `applyDataLabelFormatting` overwrites them with the shared card values. This means the **node-specific font settings are overridden** by the shared data label card.
  - **Severity: Medium** -- Users setting node label fonts will see their settings ignored because `applyDataLabelFormatting` runs after and overwrites them.

### All other checks: Clean

---

## Summary of Issues Found

| Visual | Check | Severity | Description |
|--------|-------|----------|-------------|
| funnel-pro | 3 | Low | `axisLabelFontWeight` not hidden (dead control) |
| funnel-pro | 3 | Low | Data label sub-properties visible but `showDataLabels` hidden -- dead controls |
| gantt-chart-pro | 3 | Low | `axisLabelFontWeight` not hidden (dead control) |
| gantt-chart-pro | 3 | Low | `indentWidth`, `showToggle`, `collapseByDefault` visible when grouping off |
| gauge-cluster | 3 | Low | Label font sub-properties visible when `showLabels`/`showValues` off |
| health-bar | 3 | Low | `yAxisTitle` not hidden (dead control -- health-bar has no Y-axis title) |
| heatmap-calendar | 3 | Low | `axisLabelFontWeight` not hidden (dead control) |
| network-graph | 3 | Medium | **Shared `applyDataLabelFormatting` overwrites node-specific font settings** -- dual-control conflict |

Total issues: 8 (7 low severity, 1 medium severity)

All visuals passed checks 1 (capabilities sync), 2 (reference validity), 4 (broken card merges), 5 (null safety), 6 (tooltip completeness), 7 (legend correctness), and 8 (color theme wiring).
