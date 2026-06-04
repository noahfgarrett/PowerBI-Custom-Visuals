# Network Graph Filter Tray Design

## Goal

Expand the Network Graph filter button into a simple, approachable filter tray that helps users narrow the visible graph by targets, detail fields, and detail measures without hiding context. The default experience should stay calm for non-technical users, while a `More` row can reveal result navigation and focus tools for people who need deeper investigation.

## Approved Direction

Use a simple-first tray:

- Search remains a compact magnifying-glass button.
- Filter remains a compact funnel button.
- The filter button shows a small active-filter count badge when one or more filters are applied.
- Opening the filter button shows a tray beside the controls.
- Active filters appear as removable chips.
- Users add one rule at a time through a field/operator/value row.
- Non-matching nodes, labels, badges, and links are dimmed rather than hidden.
- A `More` row exposes optional results/focus tools without crowding the default view.

## User Workflow

1. The report author adds Source, Target, Weight, optional target fields, optional detail fields, and optional detail measures.
2. The visual shows the existing search button and a filter button when filterable fields exist.
3. The user clicks the filter button.
4. The tray opens with active chips, match count, and an `Add filter` row.
5. The user chooses a target, detail field, or detail measure.
6. For target/detail fields, the user chooses from available values.
7. For detail measures, the user chooses a numeric operator and enters a value, including decimal values.
8. Adding a valid rule immediately adds a chip and updates graph dimming.
9. Clicking a chip remove control removes that rule.
10. Clicking `More` reveals matching results and focus actions.
11. Clicking `Done` closes the tray and keeps the active rules.

## Filter Logic

Rules within the same field use OR logic. Rules across different fields use AND logic.

Example:

- `Target = Pump A` OR `Target = Pump B`
- AND `Issues Found >= 5`
- AND `Discipline = Electrical`

This keeps the behavior similar to familiar slicers while avoiding an advanced logic builder.

## Supported Rule Types

### Target Rules

Target rules filter by target node display label. Multiple target values can be selected as separate chips and are treated as OR within the target field.

When a target node matches, connected source nodes remain fully visible so the relationship stays understandable. Other graph elements dim.

### Detail Field Rules

Detail field rules filter by categorical values attached through the existing `nodeDetail` role. Long values should be searchable when there are many options, and displayed chips should truncate with ellipsis plus a tooltip/title.

### Detail Measure Rules

Detail measure rules filter by numeric values attached through the existing `detailMeasure` role.

Supported operators:

- `=`
- `!=`
- `>`
- `>=`
- `<`
- `<=`

Measure value input accepts integers and decimals. The visual must not hardcode numeric thresholds beyond zero helpers. Users can enter values such as `5`, `2.5`, or `0.75`.

Built-in helper buttons:

- `= 0`
- `> 0`

These helpers exist because the no-issues/open-issues workflow is common. Other values must come from the user-entered numeric input.

## Tray Layout

The default tray includes:

- Header: `Filters` and match count, such as `8 of 48 nodes`.
- Active chips: compact removable chips for each applied rule.
- Add filter row: field picker, operator/value picker or input, and `Add`.
- Zero helper buttons when the selected field is a measure.
- `More` row: collapsed by default.
- Footer actions: `Clear` and `Done`.

The tray should stay compact and use capped widths with ellipsis for long field/value names. It should avoid full-screen modal behavior; it remains a floating chart control.

Rules apply immediately when added or removed. There is no separate pending state in v1.

## More Row

The `More` row reveals optional investigative tools:

- A short matching-results list.
- Per-result `Focus` action.
- `Focus Matched` action to zoom/focus the graph around matched nodes.
- Optional reset action to return from focus.

This advanced area should not be required to use filters. Users can ignore it and still complete the normal workflow.

## Dimming Behavior

When filters are active:

- Matching nodes render at full opacity.
- Connected sources for matched targets render at full opacity.
- Matching labels and badges render at full opacity.
- Links connected to matched nodes render at stronger opacity.
- Non-matching nodes, labels, badges, and links dim.
- Nothing is removed from the DOM solely because of a filter.

Search and filters should combine. A node must satisfy the active filters and the search query unless no search query is active.

## State Model

Replace the current single `detailFilterField` / `detailFilterValue` model with a list of filter rules.

Each rule should include:

- `id`: stable local rule id.
- `kind`: `target`, `field`, or `measure`.
- `label`: field or measure display label.
- `operator`: value comparison operator, where applicable.
- `value`: selected field/target value or numeric measure threshold.
- `display`: precomputed compact chip text.

Rules live in visual instance state only for this version. Persisting saved filters is out of scope for v1.

## Error Handling

- If a selected field disappears after a data update, remove invalid rules.
- If a selected categorical value disappears, remove that invalid rule.
- If a numeric input is blank or invalid, disable `Add` and do not apply the rule.
- If a measure value is missing for a node, treat it as `0`, matching the existing zero-detail behavior.
- If no nodes match, keep the graph visible but dimmed and show `0 of N nodes` in the tray.
- If no filterable fields exist, hide the filter button.

## Accessibility And Usability

- Search and filter controls use real SVG icons with accessible labels.
- The filter button count badge is visual; the button aria-label should also include the active count.
- Buttons and selects/inputs are keyboard focusable.
- Long option text gets `title` text for hover inspection.
- The simple tray is usable without opening `More`.

## Testing

- Unit test filter button renders with a count badge when rules are active.
- Unit test active chips render and removing a chip updates filtered results.
- Unit test target filters keep connected source nodes visible and dim unrelated nodes.
- Unit test same-field target/detail rules use OR logic.
- Unit test different fields use AND logic.
- Unit test numeric measure operators `=`, `!=`, `>`, `>=`, `<`, and `<=`.
- Unit test decimal thresholds are accepted.
- Unit test zero helpers create `= 0` and `> 0` measure rules.
- Unit test invalid numeric input does not add a rule.
- Unit test `More` row reveals matching results and focus controls.
- Existing Network Graph tests, typecheck, package build, sync, and review must pass before completion.

## Out Of Scope

- Saved filter presets in v1.
- Full advanced logic builder with arbitrary AND/OR groups.
- Hiding non-matching nodes as the primary behavior.
- Persisting filter rules across report reloads.
- Replacing Power BI slicers.

## Acceptance Criteria

- The filter button uses a funnel icon and shows the number of active filters.
- The tray can add target, detail field, and detail measure rules.
- Detail measure filters accept decimal user-entered values.
- Only zero-based shortcuts are built in.
- Active rules appear as removable chips.
- Filtering dims non-matching graph elements and preserves context.
- The `More` row reveals result/focus tools without making the default tray feel complex.
- The visual version is bumped and the package is rebuilt/synced after implementation.
