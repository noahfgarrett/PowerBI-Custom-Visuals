# Business Package Smoke Test Checklist

Updated: 2026-11-04

Use this checklist before every package handoff.

## 1. Build and Sync Gates (must pass)
- [ ] `npm run typecheck`
- [ ] `npm run build:all`
- [ ] `npm run review:business`
- [ ] `npm run sync:business`
- [ ] Confirm `Business_Package/review-report.json` has `"warningCount": 0`

## 2. Visual Interaction Gates (sample 10 visuals minimum)
- [ ] Click a mark selects data point.
- [ ] `Ctrl/Cmd + click` multi-select works.
- [ ] Background click clears selection.
- [ ] Right-click opens context menu.
- [ ] Tooltip appears on hover and follows cursor.
- [ ] Tooltip disappears on mouse leave.

## 3. Host Compliance Gates
- [ ] High contrast mode enabled in Power BI Desktop:
  - [ ] Text remains legible.
  - [ ] Marks remain distinguishable from background.
  - [ ] Selection state is still visible.
- [ ] Locale check:
  - [ ] Confirm number/date formatting in tooltips matches report locale.
  - [ ] Validate at least one non-US locale (example: `de-DE`) on a sample report.
- [ ] Rendering lifecycle:
  - [ ] No visual remains in perpetual loading state after filter/slicer changes.
  - [ ] No blank visual after rapid resize or page navigation.

## 4. Data Robustness Gates
- [ ] Empty data state shows actionable message (no crashes).
- [ ] Null-heavy dataset does not throw console errors.
- [ ] Large category set (500+) remains interactive.
- [ ] Measure-only visuals still render with no category field bound.

## 5. Visual QA Priority Set (always test)
- [ ] `bar-race`
- [ ] `gantt-chart-pro`
- [ ] `gauge-cluster`
- [ ] `kpi-card`
- [ ] `status-indicator`
- [ ] `waffle-chart`
- [ ] `polar-chart`
- [ ] `radar-chart`
- [ ] `radial-gauge`
- [ ] `ring-stack`
- [ ] `sunburst-chart`
- [ ] `timeline-milestone`

## 6. QCx Filter Menu and Drill-down Gates (run in Power BI Desktop, then in the Service)
- [ ] Filter menu opens on a tile that wasn't selected.
- [ ] From and To native dropdowns stay open and select a week.
- [ ] Esc closes the Filter menu first, then a page opened under it.
- [ ] Date Observed bound as the plain date (field well drop-down, field name), not the Date Hierarchy: the week's list shows `MM/DD/YY`.
- [ ] Click a week with issues: the week is selected and its list opens.
- [ ] Click a week without issues: the week is selected and no list opens.
- [ ] QCx Overview with all fields bound:
  - [ ] Query time is acceptable after a refresh and after a filter change.
  - [ ] If `Showing the first n rows (Power BI data limit)` appears, unbinding Notes first clears or eases it.
- [ ] QCx Issues rebound to QCx Combined shows NCR Pass Rate.
- [ ] Re-paste the 39-column QCx Combined script: the preview shows 39 columns and existing bindings keep working.

## 7. Release Decision
- [ ] PASS: all sections complete with no blocker defects.
- [ ] HOLD: any blocker in interaction, accessibility, or host compliance.
