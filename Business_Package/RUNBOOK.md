# Business Package Runbook

Updated: 2026-02-23

## Purpose
Operational runbook for validating, packaging, and troubleshooting Business Package Power BI visuals.

## Standard Workflow
1. Run `npm run typecheck`.
2. Run `npm run build:all`.
3. Run `npm run review:business`.
4. Run `npm run sync:business`.
5. Execute the smoke checklist in `Business_Package/SMOKE_TEST_CHECKLIST.md`.

## Expected Artifacts
- Updated `.pbiviz` files in `Business_Package/`
- `Business_Package/review-report.json`

## Blocker Conditions (do not release)
- Any TypeScript compile failure.
- Any review report warnings or errors.
- Tooltip regressions (missing, static, or native-title fallback).
- Selection or context menu regressions.
- High contrast mode rendering illegible labels/marks.

## Fast Triage
1. If build fails:
- Re-run `npm run typecheck` and fix the first error before proceeding.

2. If review warnings return:
- Re-run `npm run review:business` and inspect `Business_Package/review-report.json`.
- Prioritize warnings in this order:
  - Interaction/selection
  - Tooltip compliance
  - Accessibility/high contrast
  - Data reduction and performance

3. If a visual is blank in Desktop:
- Confirm required roles are bound in the Fields pane.
- Check empty-state behavior with null/empty data.
- Verify there are no runtime errors in Developer Visual tools.

4. If tooltip behavior is inconsistent:
- Ensure visual uses `host.tooltipService.show/move/hide`.
- Remove any fallback `title` attributes/elements.
- Rebuild package and retest hover and leave behavior.

## High Contrast Verification Steps
1. In Power BI Desktop, enable high contrast mode.
2. Validate each priority visual:
- Labels and values are readable.
- Visual mark edges are visible.
- Selected marks remain identifiable.
3. If contrast fails:
- Replace hardcoded text colors with host-driven foreground values.
- Increase stroke opacity/width where marks blend into background.

## Locale Verification Steps
1. Switch report locale (or Desktop regional settings).
2. Validate tooltip number/date formatting on priority visuals.
3. If locale formatting fails:
- Route numeric formatting through locale-aware formatting helpers.
- Avoid direct string interpolation for numeric/date output.

## Render Lifecycle Verification Steps
1. Rapidly resize report canvas.
2. Apply slicers quickly and page between reports.
3. Confirm visuals do not get stuck loading.
4. If lifecycle issues appear:
- Add host rendering event notifications around render/update cycles.
- Ensure exceptions are surfaced and logged.

## Release Checklist
- [ ] All commands pass.
- [ ] Smoke checklist complete.
- [ ] No blocker conditions present.
- [ ] Artifacts in `Business_Package/` are current.
