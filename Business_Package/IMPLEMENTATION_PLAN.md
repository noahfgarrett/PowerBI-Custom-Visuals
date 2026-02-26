# Business_Package Implementation Plan

Updated: 2026-02-23

## Goals
1. Bring all visuals to production-ready Power BI interaction and accessibility standards.
2. Standardize behavior and formatting consistency across all 30 visuals.
3. Improve developer velocity with repeatable QA, packaging, and release workflows.

## Delivery Phases

### Phase 1: Core Interactions (Must Have)
- Scope
  - Add selection manager integration in all visuals.
  - Add click-to-select, ctrl/cmd multi-select, and background clear.
  - Add context menu support on selectable marks.
  - Add capabilities flags where implemented:
    - `supportsMultiVisualSelection`
    - `supportsHighlight`
    - `supportsKeyboardFocus`
- Acceptance criteria
  - Each visual supports at least one selectable mark.
  - Cross-filtering works from visual to other report visuals.
  - Right-click opens context menu on selectable marks.

### Phase 2: Accessibility and Host Compliance (Must Have)
- Scope
  - Keyboard navigation and focus ring behavior.
  - High-contrast mode rendering support.
  - Consistent empty/invalid-data landing states.
  - Rendering event service integration where useful.
- Acceptance criteria
  - Visuals are usable without mouse.
  - High-contrast screenshots are legible and pass contrast checks.
  - Empty/error states are actionable and consistent.

### Phase 3: Formatting and UX Consistency (High Impact)
- Scope
  - Normalize card style properties across capabilities/settings/rendering:
    - `backgroundColor`/`bgColor`
    - opacity/radius controls
  - Standardize tooltip schema and value formatting options.
  - Standardize sorting and drill interactions for relevant visuals.
- Acceptance criteria
  - Format pane sections are predictable across visuals.
  - Tooltip field order and formatting is consistent.
  - Similar visual types have shared control semantics.

### Phase 4: Performance and Reliability (High Impact)
- Scope
  - Ensure `dataReductionAlgorithm` exists and is sane for all visuals.
  - Add animation fallback behavior for large datasets.
  - Add automated regression checks for typecheck + packaging + review report.
- Acceptance criteria
  - No missing data reduction config.
  - No runtime stalls on large projected datasets.
  - CI-ready quality gate commands pass reliably.

### Phase 5: Developer Experience and QoL (QoL)
- Scope
  - Feature matrix docs by visual.
  - Preset styling bundles (e.g. Executive, Compact).
  - Sample report/data pack improvements.
  - Optional diagnostics mode for render performance.
- Acceptance criteria
  - Developers can quickly choose and configure visuals.
  - Support/debugging workflow is faster and reproducible.

## Workstream Breakdown

### A. Interaction Workstream
- [ ] Roll out selection manager to remaining visuals.
- [ ] Add context menu handlers to remaining visuals.
- [ ] Add highlight rendering support where data model supports it.

### B. Accessibility Workstream
- [ ] Keyboard focus management per visual root and marks.
- [ ] High-contrast token map in core + visual-level usage.
- [ ] Accessibility QA checklist and snapshots.

### C. Consistency Workstream
- [ ] Align card background color support across capabilities/settings.
- [ ] Unify tooltip payload labels and numeric formatting.
- [ ] Align axis/legend naming and control defaults.

### D. Reliability Workstream
- [ ] Fill missing `dataReductionAlgorithm` definitions.
- [ ] Add large-data animation suppression thresholds.
- [ ] Add/expand QA scripts and report checks.

## Current Sprint Status
- Completed
  - Added automated business review/sync scripts.
  - Added shared animation safety/reduced-motion handling.
  - Fixed treemap TypeScript blocker.
  - Standardized support/source metadata URLs.
  - Rebuilt and synced all 30 `Business_Package` artifacts.
  - Started Phase 1 rollout in:
    - `packages/bar-chart-pro`
    - `packages/status-indicator`
    - `packages/progress-bar-stack`
- In progress
  - Continue Phase 1 rollout for remaining visuals.

## Execution Commands
- `npm run qa:business`
- `npm run package:business`
- `npm run review:business`
- `npm run sync:business`
