# Full QA Audit — All 31 Power BI Custom Visuals
**Date:** 2026-03-18

## Critical Bugs (settings won't persist)

| Visual | Missing capabilities.json Property | Impact |
|--------|-----------------------------------|--------|
| **radial-gauge** | `valueSettings.deltaPositiveColor` | Setting resets on report reopen |
| **radial-gauge** | `valueSettings.deltaNegativeColor` | Setting resets on report reopen |
| **radial-gauge** | `arcSettings.trackColor` | Setting resets on report reopen |
| **radial-gauge** | `gaugeScaleSettings.majorTickColor` | Setting resets on report reopen |
| **radial-gauge** | `gaugeScaleSettings.minorTickColor` | Setting resets on report reopen |
| **timeline-milestone** | `timelineLayoutSettings.durationBarOpacity` | Setting resets on report reopen |
| **timeline-milestone** | `timelineLayoutSettings.durationBarHeight` | Setting resets on report reopen |
| **progress-bar-stack** | `progressMilestone.milestoneColor` | Setting resets on report reopen |
| **health-bar** | `healthBarSettings.fillMode` enum is empty `[]` | Dropdown shows no options |
| **heatmap-calendar** | `calendarStreakSettings.streakOutlineColor` | Setting resets on report reopen |

## Orphaned/Dead Properties

| Visual | Issue |
|--------|-------|
| **animated-waterfall** | `waterfallSettings.showTotal` in capabilities.json has no matching setting in settings.ts (orphaned) |
| **animated-waterfall** | `LegendFormattingCard` imported and instantiated but never renders a legend (dead card) |
| **network-graph** | `numberFormattingCard` declared but never used (no numeric values to format) |

## Missing Cross-Filtering (no selectionManager)

| Visual | Issue |
|--------|-------|
| **radial-gauge** | No `createSelectionManager()` — cannot participate in cross-filtering |
| **ring-stack** | No `createSelectionManager()` — cannot participate in cross-filtering |
| **waffle-chart** | No `createSelectionManager()` — cannot participate in cross-filtering |

## Weak Tooltips (not using Power BI tooltipService)

| Visual | Current Approach | Impact |
|--------|-----------------|--------|
| **health-bar** | No tooltips at all | Can't see values on hover |
| **heatmap-calendar** | HTML `title` attribute | Basic browser tooltip, no formatting |
| **network-graph** | SVG `<title>` element | Basic browser tooltip, no formatting |
| **bump-chart** | SVG `<title>` element | Basic browser tooltip, no formatting |
| **slope-chart** | SVG `<title>` element | Basic browser tooltip, no formatting |
| **stream-graph** | SVG `<title>` element | Basic browser tooltip, no formatting |
| **scatter-bubble** | Custom DIV tooltip | Works but not PBI-native (no report page tooltips) |

## Code Quality Issues

### Null Safety
- **slope-chart**: `positiveColor.value.value` accessed without `?.` — will throw if fill object is null

### Memory Leaks
- **progress-bar-stack**: Duplicate `addEventListener('click')` on container each render without removing old one
- **radar-chart**: `attachKeyboardNav()` cleanup function not stored or called on re-render
- **waffle-chart**: `destroy()` doesn't remove mouseenter/mousemove/mouseleave listeners
- **heatmap-calendar**: `attachKeyboardNav` cleanup not stored
- **gauge-cluster**: `sparklineHistory` map grows unbounded across updates
- **scatter-bubble**: `requestAnimationFrame` in `showTooltip()` never cancelled

### Dead Imports
- **scatter-bubble**: `formatNumber` imported but never used

## Cross-Visual Patterns

### Positive (all 31 visuals)
- Zero `any` types — TypeScript strict compliance across the board
- All visuals have proper `destroy()` methods
- All visuals implement `getFormattingModel()` correctly
- All visuals use the shared core formatting utilities consistently

### Improvement Opportunities (recurring across multiple visuals)

| Opportunity | Affected Visuals | Priority |
|------------|-----------------|----------|
| Migrate SVG `<title>` tooltips to PBI tooltipService | bump-chart, slope-chart, stream-graph, network-graph, heatmap-calendar | High |
| Add selectionManager for cross-filtering | radial-gauge, ring-stack, waffle-chart | High |
| Add hover-dim (dim non-hovered elements) | Most visuals except bar-chart-pro | Medium |
| Add responsive font/margin sizing | All visuals use hardcoded margins | Medium |
| Respect `prefers-reduced-motion` for animations | All animated visuals | Low |
| Make keyboard accessibility default-on instead of opt-in | All visuals | Low |

## Per-Visual Status (Clean = no issues found)

| Visual | Settings Wiring | Dead Settings | Code Quality | Overall |
|--------|----------------|---------------|--------------|---------|
| animated-donut-pro | Clean | Clean | Minor | Good |
| animated-waterfall | Orphaned prop | Dead legend card | Minor | Needs fix |
| bar-chart-pro | Clean | Clean | Large file (3700 lines) | Good |
| bar-race | Clean | Clean | Clean | Good |
| box-plot | Clean | Clean | Minor | Good |
| bullet-chart-pro | Clean | Clean | Minor | Good |
| bump-chart | Clean | Clean | Weak tooltips | Needs fix |
| chord-diagram | Clean | Clean | Minor | Good |
| dumbbell-chart | Clean | Clean | Minor | Good |
| funnel-pro | Clean | Clean | Minor | Good |
| gantt-chart-pro | Clean | Clean | Incomplete critical path | OK |
| gauge-cluster | Clean | Clean | Sparkline history leak | OK |
| health-bar | Empty enum | Clean | No tooltips | Needs fix |
| heatmap-calendar | Missing 1 prop | Clean | Weak tooltips, kbd leak | Needs fix |
| kpi-card | Clean | Clean | Minor | Good |
| morphing-area-chart | Clean | Clean | Clean | Good |
| network-graph | Clean | Dead numberFormat | Weak tooltips | Needs fix |
| polar-chart | Clean | Clean | Minor | Good |
| progress-bar-stack | Missing 1 prop | Dead axis props | Listener leak | Needs fix |
| radar-chart | Clean | Dead legendFontWeight | Kbd nav leak | OK |
| radial-gauge | Missing 5 props | Dead dataLabel props | No selectionManager | Needs fix |
| ring-stack | Clean | Dead legendFontWeight | No selectionManager | Needs fix |
| sankey-diagram | Clean | Clean | Clean | Good |
| scatter-bubble | Clean | Clean | Custom tooltips, dead import | OK |
| slope-chart | Clean | Clean | Null safety bug, weak tooltips | Needs fix |
| status-indicator | Clean | Clean | Listener stacking | Good |
| stream-graph | Clean | Clean | Weak tooltips | Needs fix |
| sunburst-chart | Clean | Clean | Clean | Good |
| timeline-milestone | Missing 2 props | Clean | Minor | Needs fix |
| treemap-pro | Clean | Clean | Minor | Good |
| waffle-chart | Clean | Dead gridSettings.emptyColor | No selectionManager, listener leak | Needs fix |
