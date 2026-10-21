# QCx Enriched Issues Source — Design

## Why

QCx BIM Issues and QCx Overview will be fed from the **enriched Autodesk export**, for example `Automated Issue Summary-202610201008-Enriched-2026-10-20.xlsx`, sheet "Issues", 1,077 rows. They no longer read the Smartsheet BIM Issues Log.

In that export, 1,018 issues migrated from BIM 360 carry Autodesk's migration values:
- **Created by** is the migration account ("Peter Marchese / Autodesk").
- **Created on** is the late-July 2026 migration date.

The real creator and dates live in the enrichment columns `BIM360_Created By`, `BIM360_Created On` and `BIM360_Closed On`. Without them every migrated issue is excluded, or lands in WW30.

The source of truth is the HTML app, `src/calculations/report.ts` on `origin/main`: `legacyIssueValue`, `shouldIncludeIssue` and `normalizeIssue`. The Power BI visuals must port it exactly.

## Rules (ported from the HTML app)

**Legacy values.** These are `BIM360_Created By`, `BIM360_Created On` and `BIM360_Closed On`, each trimmed. An issue **has legacy data** when any one of them is non-blank.

**Include rule.** An issue counts when either of these is true:
- **It has legacy data:** `isLotusWorksIssueCreator(BIM360_Created By)` is true.
- **It has no legacy data:** `isLotusWorksIssueCreator(Created by)` is true. If the Created By slot is unbound, the issue is included.

**Created date.** Use the first of these that is present:
1. `BIM360_Created On`
2. `Created on`

**Closed date** (the old "updated on"). Use the first of these that is present:
1. `BIM360_Closed On`
2. `Closed at`
3. `Updated on`

The closed week is the ISO week of this date, for closed issues only, as before.

**Everything else is unchanged:** status kinds, void exclusion, the contractor default, the subtype, title and discipline defaults, root cause, the benchmarks, the Pareto and the Overview cards.

**Date formats.** The enriched columns hold text such as `10/15/22 3:45 PM`: month/day, a two-digit year, and a time. `parseDate` must accept `M/D/YY h:mm AM/PM` and `M/D/YYYY h:mm AM/PM` and keep the date part only. Two-digit years follow the existing rule: 00–49 means 20xx and 50–99 means 19xx. The time of day is ignored, using the date at local noon, the existing convention.

The Smartsheet BIM Issues Log keeps working unchanged. All new slots are optional, and without them the visual behaves exactly as it does today.

## QCx BIM Issues: new optional slots

| Slot (role) | Enriched column | Required |
|---|---|---|
| BIM360 Created By (`bim360CreatedBy`) | BIM360_Created By | no |
| BIM360 Created On (`bim360CreatedOn`) | BIM360_Created On | no |
| BIM360 Closed On (`bim360ClosedOn`) | BIM360_Closed On | no |
| Closed At (`closedAt`) | Closed at | no |

The existing slots map to the enriched export like this:
- ID → `ID`
- Title → `Title`
- Status → `Status`
- Type → `Type`
- Contractor → `Contractor`
- Created On → `Created on`
- Updated On → `Updated on`
- Due Date → `Due date`
- Created By → `Created by`
- Root Cause → `Root cause`

Root Cause Category has no column in the enriched export, so it stays unbound and the category panel hides.

## QCx Combined: BIM source switches to the enriched export

The script's `BimSource` points at the enriched query. It selects the columns below:

| Column | Behaviour |
|---|---|
| ID, Status, Type | Kept as `ID`, `Status`, `Type`. Required, so the query fails if any is missing. |
| `Created on` | Renamed to `Created On`. |
| `Updated on` | Renamed to `Updated On`. |
| `Created by` | Renamed to `Created By`. |
| `Root cause` | Renamed to `Root Cause`. Optional: `MissingField.UseNull`. |
| `BIM360_Created By`, `BIM360_Created On`, `BIM360_Closed On`, `Closed at` | **New** combined columns `BIM360 Created By`, `BIM360 Created On`, `BIM360 Closed On` and `Closed At`. All four are optional and use `MissingField.UseNull`. |

- Column names are matched exactly as the enriched export spells them. The guide notes that Power Query matching is case-sensitive.
- The Overview gains four optional slots for these columns.
- Performance is unchanged.

## Versions

| Visual | From | To |
|---|---|---|
| QCx BIM Issues | 1.1.0 | 1.2.0 |
| QCx Overview | 1.1.0 | 1.2.0 |

## Expected numbers (enriched export, today = 2026-10-20, W = WW43'2026)

These are derived independently in Python from the enriched xlsx, porting `report.ts` exactly. The plan's fixture task lists them in full. They cover:
- included issues
- opened and closed per week for WW30–WW43
- totals through W
- remaining open
- the closure rate
- typical close, the normal close window and the slowest close
- the Pareto top causes

**Acceptance:** every week from WW31 to WW42 shows real opened and closed activity, and nothing lumps into WW30.

## Testing

- **Unit tests** for the include rule (legacy creator wins, standard creator used only when there is no legacy data, an unbound Created By includes the issue) and for the date fallbacks.
- **`parseDate`** tests with `M/D/YY h:mm AM/PM`.
- **A fixture** built from the enriched export with no personal names:
  - Replace `Created by` and `BIM360_Created By` with `LotusWorks` when the value passes `isLotusWorksIssueCreator`.
  - Replace any other non-blank value with `Other`.
  - Leave blanks blank. Keep a blank BIM360 creator blank, because it decides which rule applies.
- **Fixture tests** asserting the expected numbers.
- **The existing Smartsheet fixtures and tests** pass unchanged.
- **A visual check** of BIM Issues, both pages and the Overview against the enriched data.
