# QAQC Welding Visual — Design

## Scope

The third QAQC visual, built on the Smartsheet **Welding Inspections / Signoffs** log. It shares the Electrical visual's foundation (`2026-10-15-qaqc-electrical-visual-design.md`): the look, presets, Format pane (background, card opacity, animation, accessibility), work-week picker and `30 WW | All` range, bar-click week selection, the **expanded chart view**, required Row ID, performance targets, error states, release gate, CSS build guard, and the per-package `visual.ts` / `settings.ts` rule.

Package: `packages/qaqc-welding`, GUID `qaqcWelding_8A4CE54C5018`, class `QaqcWeldingVisual`, display name "QAQC Welding Signoffs", version 1.0.0, header icon lucide `Flame`, Fields-pane icon a new `flame` shape in `scripts/make-qaqc-icon.mjs`.

## Field slots

| Slot (role) | Smartsheet column | Required |
|---|---|---|
| Weld Work Week (`weldWeek`) | WELD WORK WEEK | yes |
| Signature (`signature`) | SIGNATURE | yes |
| Work Week Signed (`signedWeek`) | WORK WEEK SIGNED | yes |
| Issue Created (`issue`) | ISSUE CREATED? (Put BIM # If Yes) | yes |
| Fluid Code (`fluidCode`) | FLUID CODE | yes |
| Pipe Spec (`pipeSpec`) | PIPE SPEC | yes |
| Tag No (`tagNo`) | TAG NO | yes |
| Row ID (`rowId`) | Index column added in Power Query | yes |

All required, validated in code (the review gate allows at most one `min >= 1` role per condition).

## Rules

- **Weld:** a row whose Weld Work Week parses (same parser as the other visuals). Unreadable or future weeks are skipped and footnoted as before.
- **Signed:** SIGNATURE is not blank.
- **Signed week:** the week QAQC signed, from WORK WEEK SIGNED. A signed row whose signed week doesn't parse still counts as signed for its weld week, but not in "Signed This Week".
- **Issue:** ISSUE CREATED? is not blank and, trimmed and lower-cased, is not one of `no`, `n/a`, `na`, `none`, `-`. QAQC Advisory Items are not used.
- **System:** FLUID CODE, trimmed; blank → `Unspecified`.
- **Pipe spec:** PIPE SPEC, trimmed; blank → `Unspecified`.
- **Building** from TAG NO: the first match of `(?:^|-)(?:P\d-)?([A-Z]{1,2}\d{1,3})(?=XX|[A-Z]\d{3})` (case-sensitive, on the trimmed tag). If there is no match, `Site General`.
  - Examples: `BK1XX104XX-M006-…` → `BK1`; `F631M008XX-P118-…` → `F631`; `P4-WR1XX003-1-IW-…` → `WR1`; `PS1XX102XX-…` → `PS1`; `P4-F632L002-1-SAN-…` → `F632`; `PHT-F631M008XX-1803` → `F631`; `P4-YARD1001-7-DW-…` → `Site General`; `BATCH-PLANT-FW-12A` → `Site General`.
- System, pipe spec, and building names are grouped case- and whitespace-insensitively (first spelling shown), like Electrical buildings.

## Cards

*W* = selected week, *W−1* = the week before.

| Group | Card | Value | Sub-line |
|---|---|---|---|
| This WW | Welds Logged | welds with weld week W | change vs W−1 |
| This WW | Signed This Week | signed welds whose **signed week** is W | change vs W−1 |
| This WW | Sign-off % | signed ÷ logged for the **latest weld week ≤ W that has welds** | `67 of 84 · WW41'2026`; red when under 10% |
| This WW | Issues Created | issue welds with weld week W | change vs W−1; warn amber when up |
| Project to date | Total Welds | welds with weld week ≤ W | `+n this WW` |
| Project to date | Welds Signed | signed welds with weld week ≤ W | `+n signed this WW`, where n is Signed This Week (by signing week) |
| Project to date | Overall Sign-off % | Welds Signed ÷ Total Welds | change in points vs through W−1; a status line under the value is red below 10%, amber at 10% to below 15%, and green at 15% and above |

## Charts

### Signoffs by Work Week (large)

Matches the HTML app's Welding chart (user decision 2026-10-15: these visuals do not follow DESIGN.md's single-axis rule):

- One bar per weld week in the window. A light **total** bar (series 2) with the **signed** bar (series 1) drawn over it from the baseline, using the same rounded-top style as the other visuals.
- The total count is labelled above each bar. The signed count is labelled inside the signed bar when it is at least 16 px tall, and just above it otherwise. Labels are only drawn when the band is at least 18 px wide.
- A **sign-off % line** with dots, one point per week that has welds, on a **right axis** fixed at 0–100% with ticks at 0, 25, 50, 75 and 100. The line uses the warn/amber series color, as in the app.
- A dashed red **10% baseline** line across the plot at 10% on the right axis, labelled "10% baseline" at its right end.
- The selected week's sign-off % is labelled next to its dot (with a card-colored halo), avoiding the badge and the total label.
- Red issue badges with the count sit above weeks with issues.
- Axis titles: "Weld count" (left) and "Sign-off rate" (right).
- Legend: Signed, Total welds, Sign-off %, Issue created, 10% baseline.
- Hover tooltip: week, signed of total, sign-off %, issues created. Bar click and keyboard select the week exactly like the Electrical chart.
- **Expanded:** a summary strip (welds, signed, sign-off %, issues for the window), and the sign-off % labelled at every point wide enough to fit.

### Sign-off by System (small, drill-down)

- Horizontal bars per system in the window, ranked by total welds: signed inside total, with `signed / total · %` at the end. Top 8, then `Other (n systems)`.
- Clicking a system bar (or Enter on the focused row) drills into that system: the same chart now shows its **pipe specs** (signed within total), with a breadcrumb `All systems › AW` above the bars. The breadcrumb's "All systems" button returns. `Other` is not clickable.
- Drill state is per session (resets on reopen) and survives week changes; if the drilled system disappears from the window, the chart returns to All systems.
- Legend: Signed, Total welds.
- **Expanded:** a table of every system (Total, Signed, Sign-off %, sortable like the building table). Each system row has a disclosure button that reveals its pipe-spec rows indented underneath.

### Issues by Building (small)

- Horizontal bars per building in the window: issue rate (issues ÷ welds), labelled `n issues · x.x%`. Only buildings with at least the **minimum welds** (Format pane, default 10, range 1–100) are ranked; the rest roll into `Other (n buildings)`. Sorted by rate, then issues, then name.
- A building whose rate is at least 2× the overall window rate is drawn in the warn amber; the rest use series 1. A vertical hairline marks the overall rate.
- Empty message when the window has no issues: "No issues created in this range".
- Legend: Issue rate, 2× overall or more (warn amber), Overall rate (a 1 px hairline key, matching the chart's line).
- **Expanded:** sortable table of every building (Building, Welds, Issues, Issue rate), ignoring the minimum.

## Format pane

Same cards as Electrical, plus a **Hotspots** card (`hotspots` object) with **Minimum welds** (numeric, default 10, 1–100).

## Expected numbers (October export, today = 2026-10-15)

- 1,751 welds; 1,054 signed; 11 issues (one `no` excluded); data WW51'2025–WW41'2026; index WW51'2025–WW42'2026.
- WW42: Welds Logged 0 (−84 vs WW41), Signed This Week 70 (+24 vs WW41's 46), Sign-off % 80% (67 of 84, WW41'2026), Issues Created 0.
- WW41 selected: Welds Logged 84, Signed This Week 46; WW40: logged 126, signed 46 of them, Signed This Week 67.
- To date through WW42: Total Welds 1,751, Welds Signed 1,054, Overall 60.19%.
- 30-week window (WW13–WW42): 1,570 welds, 11 issues. Buildings: F631 698 welds / 4 issues, WR1 273 / 4, Site General 118 / 2, BK1 439 / 1, PS1 40 / 0, F632 2 / 0 (below the minimum → Other).
- Systems in the window: AW 274 welds / 159 signed first, then IW 122 / 90, FL 82 / 59; 56 systems. AW pipe specs: PCH 208 / 142, QCH 31 / 11, MDW 28 / 6, PCHA 7 / 0.
- All buildings, all time: F631 765, BK1 483, WR1 313, Site General 136, PS1 40, F632 14.

## Shared expansion host

The expand / collapse machinery currently inside `InspectionDashboard` (frame wrapper, expanded state, panel refs, boxes, focus restore, tooltip clear, `inert`) moves into a reusable `qaqc-shared` piece so the Welding dashboard (and Issues, Overview, Contractor Performance) reuse it. Electrical and Mechanical behavior must not change.
