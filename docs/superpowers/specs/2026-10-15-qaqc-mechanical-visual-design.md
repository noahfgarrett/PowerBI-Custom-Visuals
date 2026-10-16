# QAQC Mechanical / Process Inspections Visual — Design

## Scope

The second QAQC visual. It is the Electrical visual (`2026-10-15-qaqc-electrical-visual-design.md`) applied to the Smartsheet **Mechanical / Process Inspection Log**. Everything in the Electrical spec applies unless this document says otherwise: field slots (including the required Row ID), counting rules, cards, charts, layout, Format pane, presets, performance targets, error states, and the release gate.

## Differences from Electrical

| Item | Mechanical |
|---|---|
| Title | Mechanical / Process Inspections |
| Header icon | lucide `Cog` |
| Fields-pane icon | 20×20 hex-nut mark in the QAQC accent `#2E5AAC` |
| Package | `packages/qaqc-mechanical`, GUID `qaqcMechanical_7064EE749149`, class `QaqcMechanicalVisual`, display name "QAQC Mechanical / Process Inspections", version 1.0.0 |
| Setup card title | Add the Mechanical / Process Inspection Log columns |
| Render-failure title | Could not draw the Mechanical / Process visual |

Columns bind exactly as for Electrical: Work Week Observed, Inspection Phase, Issue?, Building, and the Power Query Index as Row ID.

Phases other than Final and SOR (Pressure Test, Borescope, Reciept Inspection in the October export) are ignored, as on Electrical.

**NCR Pass Rate** uses **Issue?** (clean Finals ÷ Finals), consistent with Electrical. The Mechanical log's **Pass / Fail** column is not used. On the October export Issue? gives 43/44 (97.7%), while Pass / Fail would give 39/43 (90.7%). The user confirmed Issue? on 2026-10-15.

## Shared code

To avoid two copies of the same layout, these move from `qaqc-electrical` into `qaqc-shared`, and Electrical keeps working through them unchanged:

- `ElectricalDashboard` becomes `InspectionDashboard` with two new props, `title: string` and `icon: LucideIcon`.
- `readInspectionTable` and `REQUIRED_SLOTS` move to `qaqc-shared/src/dataView.ts`. The function takes a minimal structural table type (columns with `roles`, optional rows), so `qaqc-shared` still has no Power BI dependency.
- The CSS build guard becomes `scripts/verify-pbiviz-css.mjs` at the repo root, called with the package directory.
- The icon generator becomes `scripts/make-qaqc-icon.mjs`, called with an output path and a shape name (`zap` or `hex-nut`).

`visual.ts`, `settings.ts`, `capabilities.json`, and the string resources stay per package, because the repo's review gate reads each package's own `src/visual.ts` and `src/settings.ts`.

## Expected numbers (October export, today = 2026-10-15)

- Data spans WW02'2026 to WW41'2026; the index runs WW02'2026 to WW42'2026 (41 weeks).
- WW42 cards: Finals 0, SORs 0, Issues Found 0. WW41: Finals 0, SORs 2.
- Project to date through WW42: Finals 44, SORs 91, clean Finals 43, NCR pass rate 97.73%, change vs WW41: no change.
- The only NCR week is WW08'2026, which is outside the default 30-week window (WW13–WW42) and visible in All.
- Buildings, 30-week window: F63.2 first with 14 Finals and 2 SORs; top 8 shown; Other = 11 buildings, 14 inspections.

## Delivery

Build with the CSS guard, pass `review:business` with 0 issues for `qaqc-mechanical`, sync both package folders, add `QAQC_Mechanical_SETUP.md` to both, and create `releases/LotusWorks_Package_2026-10-15_QAQC-Mechanical-1.0.0.zip`. The Electrical `.pbiviz` already shipped as 1.0.0 is not rebuilt or re-synced by this work.
