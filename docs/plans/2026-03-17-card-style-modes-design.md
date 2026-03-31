# Card Style Modes — Design Document

**Date**: 2026-03-17
**Status**: Implementing (pilot phase)

## Summary

Replace the binary Glass Effect toggle with a Card Style dropdown offering four modes: None, Glass, Elevated, and Neumorphic. Pilot on 6 charts, then roll out to all 31.

## Card Style Modes

### None
Strips all card styling. Transparent background, no border, no shadow.

### Glass (existing)
Frosted-glass effect using a layered backdrop approach. Semi-transparent tinted background with `backdrop-filter: blur(12px)`. Delegates to existing `applyGlassStyle`.

### Elevated (new)
Clean floating card with multi-layer shadow depth. No blur, no texture.

- **Light**: White background, three shadow layers (contact + depth + ambient), barely-visible border
- **Dark**: Dark background, stronger shadows scaled for dark environments

### Neumorphic (new)
Soft extruded card with dual opposing shadows. No blur.

- **Light**: Warm grey background, white highlight top-left, dark shadow bottom-right, subtle inner highlight
- **Dark**: Dark background, muted highlight/shadow pair
- **Note**: Looks best when report canvas background matches the card's background color

## Settings Changes

### Before
```
Card Style
  [x] Glass Effect (toggle)
  Background Color
  Background Opacity (%)
  Border Radius
```

### After
```
Card Style
  Card Style: [Glass v] (dropdown: None / Glass / Elevated / Neumorphic)
  Background Color      (hidden when None)
  Background Opacity (%) (hidden when None)
  Border Radius          (hidden when None)
```

### Default
`glass` — preserves current behavior for existing reports.

### Migration
Replaces `enableGlass` (bool) with `cardStyleMode` (string enum) in both `settings.ts` and `capabilities.json`. Power BI uses the dropdown default for any property not yet persisted, so existing reports see no change.

## Architecture

### Core Module
`packages/core/src/card-style.ts` — single `applyCardStyle(element, options)` entry point that routes to the appropriate style function. Glass delegates to the existing `applyGlassStyle`; elevated and neumorphic apply shadow-only CSS directly.

### Per-Chart Changes
1. `settings.ts`: Replace `enableGlass` ToggleSwitch with `cardStyleMode` ItemDropdown
2. `visual.ts`: Replace `applyGlassStyle` import/call with `applyCardStyle`
3. `capabilities.json`: Replace `enableGlass` bool with `cardStyleMode` text property

## Pilot Charts
1. bar-chart-pro
2. kpi-card
3. animated-donut-pro
4. treemap-pro
5. sankey-diagram
6. health-bar
