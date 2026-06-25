# Filter Pane Pro Design

## Goal

Create a standalone Power BI custom visual that acts like a polished reusable filter pane. Report authors should be able to drop it onto a page, bind columns and measures, style a glass filter button/pane, and let report users apply filters without rebuilding the same filter-overlay experience by hand.

The first version focuses on reliable page/bookmark behavior. Cross-tab and all-report sync are intentionally out of scope because custom visuals can apply and restore JSON filters, but they do not get the same native Sync Slicers control surface.

## Approved Direction

Build a new package named `filter-pane-pro`.

V1 supports two persistence modes:

- `Bookmark linked`: filters are applied through Power BI's visual filter API and restored from bookmark-provided `jsonFilters` / filter state.
- `Manual session`: filters are applied normally while the page is in use, but the visual does not try to make them a shared report/tab-level state.

The pane should feel like a premium overlay:

- A glass filter icon button opens the pane.
- Opening the pane adds a semi-dark blurred stained-glass backdrop inside the visual bounds.
- The pane contains `Basic` and `Advanced` tabs for bound fields.
- Users can search, select, clear, and apply filters without leaving the report page.
- The default pane is larger and more polished than the compact Network Graph tray, with room for field cards, active-filter summaries, and clear action areas.

## Data Roles

The visual should expose flexible data roles:

- `filterCategory`: one or more categorical/date columns to filter.
- `filterMeasure`: optional numeric measures to display as filterable numeric controls. V1 treats these as visual-side controls unless a column-backed JSON filter target is available.

Columns are the reliable core because Power BI JSON filters target table columns. Measures may be included for numeric UI and visual-side state where available, but V1 should clearly favor column filters for report-wide filtering behavior.

## User Workflow

1. The report author adds `Filter Pane Pro` to a report page.
2. The author binds one or more columns, and optionally measures.
3. The author styles the icon, overlay, and pane in the formatting menu.
4. The report user clicks the glass filter icon.
5. The background inside the visual dims and blurs.
6. The pane opens to the `Basic` tab with polished slicer-style sections generated from the bound fields.
7. The user can switch to `Advanced` for specific rule-based filtering.
8. The user selects values, numeric/date conditions, or advanced rules.
9. The user clicks `Apply`, or uses immediate apply if that setting is enabled.
10. Power BI receives a JSON filter through `host.applyJsonFilter`.
11. The active-filter count updates on the icon.
12. The user can click `Clear` to remove all filters from the pane.

## Pane Layout

Default pane structure:

- Header: title (`Filters` by default), active-filter count, close button.
- Tab bar: `Basic` and `Advanced`.
- Active summary row: compact chips/counts for filters currently applied across either tab.
- Search: optional global search for fields and values within the active tab.
- Filter content: generated controls for the active tab.
- Footer: `Clear`, `Apply`, and optional `Reset`.

The pane should use a wider professional layout by default. Side panes should target roughly `420px` to `560px` wide when space allows. Centered modal panes should target roughly `560px` to `720px` wide. The layout should use responsive max-widths so it remains usable in smaller visual containers.

When authors want the backdrop to cover the full report canvas, they should size the visual to the intended overlay area. The visual can only dim and blur inside its own visual bounds. Closed state should keep the filter button interactive while minimizing interference with report content as much as Power BI visual layering allows.

## Basic Tab

The `Basic` tab is the default and should feel like a premium slicer panel. It is designed for normal users who want quick filtering without understanding operators or rule logic.

Basic categorical sections:

- Search box for long value lists.
- Checkbox list with `Select all` and `Clear`.
- Compact selected-count text.
- Optional collapsed-by-default sections when many fields are bound.
- Clean field cards with field name, selected count, and a small reset control.
- Long values truncate with ellipsis but expose full text on hover.

Basic numeric sections:

- Simple range control by default.
- Optional operator dropdown with friendly labels: `Equals`, `Does not equal`, `Greater than`, `Greater than or equal`, `Less than`, `Less than or equal`, `Between`.
- Numeric input accepting decimals.
- `Between` uses two numeric inputs.

Basic date sections:

- `Between`, `Before`, `After`, and `On`.
- Date inputs using native input controls where possible.

## Advanced Tab

The `Advanced` tab is for more specific detail filtering, similar in spirit to the Network Graph advanced filter row but given a larger, more professional surface.

Advanced layout:

- Left/top rule composer: field picker, operator picker, value input/select, and `Add rule`.
- Active rules area: removable chips or rows with readable labels.
- Rule preview: plain-English summary of what will be applied.
- Results/count strip: active rule count and affected field count.
- Optional field/value search to quickly find details in long lists.

Advanced supported operators:

- Text/category: `Equals`, `Does not equal`, `Contains`, `Does not contain`, `Starts with`, `Is blank`, `Is not blank`.
- Numeric: `Equals`, `Does not equal`, `Greater than`, `Greater than or equal`, `Less than`, `Less than or equal`, `Between`, `Is blank`, `Is not blank`.
- Date: `On`, `Before`, `After`, `Between`, `Is blank`, `Is not blank`.

Advanced logic:

- Rules within the same field use OR when they are repeated equality/value selections.
- Rules across different fields use AND.
- Advanced condition rows should show the implied logic in human-readable text so users are not left guessing.
- V1 does not expose arbitrary nested AND/OR groups, but the UI should be structured so a future grouped-rule builder can be added without redesigning the pane.

The advanced tab should look intentionally high-end: roomy spacing, crisp field cards, subdued glass surfaces, clear operator labels, polished chips, and no cramped dropdowns.

## Visual Styling

Format pane settings should include:

- Icon position within the visual: top left, top right, bottom left, bottom right, center.
- Icon size.
- Icon style: glass, solid, outline, minimal.
- Accent color.
- Pane side: left, right, top, bottom, centered modal.
- Pane width / max width.
- Backdrop darkness.
- Backdrop blur amount.
- Glass opacity.
- Border color/opacity.
- Border radius.
- Shadow strength.
- Default state: closed or open.
- Apply mode: `Apply button` or `Apply immediately`.
- Persistence mode: `Bookmark linked` or `Manual session`.

The default should be tasteful and work without configuration: a compact glass funnel button, right-side pane, dark translucent blurred backdrop, `Basic` tab selected, and visible active-filter badge.

## Filter Logic

Within a single categorical field, selected values use OR logic.

Across different fields, filters use AND logic.

Example:

- `Region` is `North` OR `South`
- AND `Status` is `Open`
- AND `Created Date` is after `2026-01-01`

For Power BI API calls:

- Single-column categorical filters should use Basic filters with `In` or `NotIn` where appropriate.
- Numeric/date conditions should use Advanced filters.
- Multi-field combined behavior should be represented by passing an `IFilter[]` array to `host.applyJsonFilter` against the visual's `general.filter` property. Each field contributes one Basic or Advanced filter. Tuple filters are reserved for a later version that needs exact multi-column tuple matching.

## Bookmark Behavior

`Bookmark linked` mode is the recommended default.

In this mode:

- Applying filters calls `host.applyJsonFilter`.
- The visual reads `options.jsonFilters` during `update`.
- The pane reconstructs its selected values and active counts from restored filters.
- Filter state properties in `capabilities.json` should be marked with `filterState` only for pane UI state that must restore with bookmarks, such as open/closed state or expanded sections.

In `Manual session` mode:

- The visual still applies filters while the user interacts with it.
- It does not attempt to synchronize filters across tabs, report pages, or other instances.
- Bookmarks may still capture Power BI's current filter state, but the visual does not advertise this mode as a bookmark-driven workflow.

## Power BI Constraints

The visual can only filter fields it receives through its data roles. It cannot inspect the full report data model or create a universal filter pane for unbound fields.

Report-tab/all-tab sync is not part of V1. Native Power BI slicers have separate Sync Slicers behavior; custom visuals should not promise equivalent cross-page synchronization unless a later proof-of-concept validates it.

Measure filtering is limited. JSON filters target columns. Measures can be useful for display and conditional UI, but column-backed filtering is the dependable behavior.

## State Model

Internal state should track:

- Bound fields with display name, query name, role kind, data type, and available values.
- Per-field filter state.
- Active tab: `basic` or `advanced`.
- Pane open/closed state.
- Expanded/collapsed section ids.
- Search text.
- Apply mode.
- Persistence mode.

Each filter field state should include:

- `fieldKey`: stable source query name.
- `fieldType`: category, numeric, or date.
- `selectedValues`: array for categorical values.
- `operator`: numeric/date operator when applicable.
- `value`: scalar value for single-condition filters.
- `valueTo`: second value for between filters.
- `isDirty`: pending changes exist when using Apply-button mode.

Advanced rule state should include:

- `id`: stable local rule id.
- `fieldKey`: source query name.
- `fieldType`: category, numeric, or date.
- `operator`: friendly advanced operator mapped to a Power BI filter operator.
- `value`: selected or entered value where applicable.
- `valueTo`: second value for between filters.
- `display`: precomputed plain-English rule text.
- `isValid`: whether the row can be applied.

## Error Handling

- If a bound field disappears, remove its stale filter state.
- If selected categorical values disappear from the data view, keep them visible as stale chips only when restored from bookmark, then allow clearing them.
- If a numeric/date value is invalid, disable Apply for that section and show a compact inline error.
- If no fields are bound, show a landing/empty state telling the author to add fields.
- If Power BI rejects or normalizes a filter, reconcile the pane state from `options.jsonFilters` on the next update.
- If there are too many distinct values, render the first page of sorted options and require search to narrow the list.

## Accessibility And Usability

- Use a real button for the filter icon with aria-label including active-filter count.
- Trap focus inside the open pane only when the pane behaves as a centered modal; side panes should keep normal keyboard navigation.
- Escape closes the pane.
- Enter applies when focus is in an input and Apply-button mode is active.
- Checkboxes, buttons, and inputs must be keyboard reachable.
- Long field/value names truncate with ellipsis and expose full text through `title`.
- Active filter count should be visible on the icon and readable through aria text.

## Testing

- Unit test empty state when no fields are bound.
- Unit test categorical sections render checkbox options.
- Unit test `Basic` tab is selected by default.
- Unit test switching to `Advanced` shows the rule composer.
- Unit test selecting multiple values creates an OR/basic filter.
- Unit test multiple fields combine as AND across field filters.
- Unit test numeric operators create advanced filter conditions.
- Unit test advanced text operators produce readable rule rows.
- Unit test decimal numeric input is accepted.
- Unit test invalid numeric/date input disables Apply.
- Unit test Clear sends a null filter and resets active count.
- Unit test `Bookmark linked` mode restores UI state from `options.jsonFilters`.
- Unit test the icon badge updates with active filter count.
- Unit test open pane renders backdrop and close button.
- Unit test Escape closes the pane.
- Formatting coverage test should include icon, pane, overlay, apply behavior, and persistence settings.

## Out Of Scope For V1

- Syncing filters across report tabs/pages.
- Filtering fields that are not bound to the visual.
- A full advanced logic builder with arbitrary nested AND/OR groups.
- Saved filter presets.
- Relative date presets unless implementation is simple after core filters work.
- Replacing native slicers in every scenario.
- Visual-level targeting controls for choosing exactly which other visuals receive filters; authors should use Power BI's Edit interactions.

## Acceptance Criteria

- A new `Filter Pane Pro` visual package exists and builds.
- The visual has a polished glass filter icon with active-filter count.
- Clicking the icon opens a filter pane with a blurred semi-dark backdrop.
- The pane has `Basic` and `Advanced` tabs.
- `Basic` provides normal slicer-style filtering controls.
- `Advanced` provides professional rule-builder controls for specific detail filtering.
- Bound categorical fields generate searchable checkbox lists.
- Bound numeric/date fields generate friendly operator controls.
- Apply and Clear update Power BI filters through the visual filter API.
- Bookmark-linked mode restores selected filters from Power BI-provided filter state.
- Manual session mode avoids claiming cross-tab/report synchronization.
- The visual has format pane controls for icon, pane, backdrop, apply behavior, and persistence mode.
- Focused tests, typecheck, build, package sync, and Business package review pass before release.
