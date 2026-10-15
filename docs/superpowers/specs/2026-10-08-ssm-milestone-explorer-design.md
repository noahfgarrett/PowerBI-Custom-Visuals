# SSM Milestone Explorer UX Design

## Product scope

Build a dedicated LotusWorks Power BI visual for exploring existing SSM connections across one or more projects. The primary structure is Parent Milestone, then Milestone, then Equipment. Closest-parent relationships and dependencies connect equipment without changing its milestone membership.

This specification defines the production experience. The interactive concept uses synthetic data; it is not the packaged Power BI visual. The visual supports inspection and filtering. Registry editing, link reassignment, and inferred readiness scoring are outside this scope.

## Project selection

Place a compact Project selector at the start of the navigation bar. It supports one project, several projects, and All projects. Selected projects appear in the control with a count when the names no longer fit. A searchable list supports longer project lists. An explicit empty selection shows a useful prompt to choose a project.

Keep each project's milestone hierarchy distinct. Selecting multiple projects shows separate labelled groups on the same canvas. Do not merge equipment, milestones, or headers because they have matching display labels.

Project and discipline filters define the primary equipment scope. A separate Related equipment control retains relevant ancestors and prerequisites available in the supplied dataset. Equipment outside the selected projects receives a visible project label and Related designation. It keeps its original milestone membership. Context equipment is counted separately from equipment in the selected scope.

Changing projects preserves compatible selections and filters. If the selected node is no longer available, explain the change and clear its details rather than showing stale metadata. Fit the newly selected project scope intentionally; ordinary metadata updates must not move the camera.

## Canvas and navigation

Start with L1 parent milestones only. Expanding one L1 reveals its L2 milestones; expanding an L2 reveals its equipment. Expansion state is independent at each level. Closing an L1 hides its descendants while retaining their state for reopening. The author can explicitly override this startup behavior through Expand hierarchy on first load.

Use a deterministic hierarchy layout with compact project groups. Root cards wrap, and each expanded L1 contains a wrapped grid of its own L2 cards, with bounded milestone pages for groups containing hundreds of children. Equipment has separate pages beneath each L2. Do not lay all milestones across one horizontal line. Where a milestone has conflicting parents, each occurrence shows equipment from that exact source-declared L1/L2 pair, with conflicts still visible in details.

Opening an equipment group initially shows its closest-parent roots. Give each equipment or header with children its own disclosure control and direct-child count. Expanded children nest below that parent, with bounded indentation, independent sibling paging, and retained expansion state on collapse. Search opens the necessary equipment ancestors and sibling pages. Headers and external ancestors may be shown as related equipment, retaining their original project, milestone membership, and source identity. Multiple-parent conflicts and cycle breaks must remain inspectable; a display tree must not invent source relationships.

Each equipment card provides a separate keyboard-accessible Dependencies action with its direct outgoing count. Opening it shows a bounded list in a dedicated lane beside the source card; a Required by switch shows direct incoming dependencies separately. Dependency cards open normal node details and preserve native row identity, even when the same physical equipment also occurs in the structural tree. Dependency preview rows share the canvas node budget and honor the author's relationship visibility. Children and dependencies remain explorable from related occurrences through explicit user action, with cycle protection. Reserve enough lane width and row height to prevent overlap with structural children or neighboring milestone groups. Do not recursively expand the full graph automatically.

Use brief transitions of approximately 180 ms for intentional expansion, collapse, and page changes. Animate only mounted cards, keep the affected branch in view, and let nearby groups move smoothly into their new positions. Rapid toggles must cancel or retarget cleanly. Background data delivery and routine pan/zoom do not start hierarchy animations; reduced motion disables them. Avoid a continuously moving force layout.

The navigation bar contains project selection, search, and the current milestone scope. A compact canvas toolbar provides zoom out, zoom percentage, zoom in, Fit all, Focus selected, and Reset view. Reset view changes the camera; Clear filters changes filtering. Keep those actions distinct.

Drag empty canvas to pan. Wheel and trackpad gestures zoom around the pointer while the pointer is over the canvas. Controls, the details drawer, and search results do not pan or zoom. Keyboard controls provide equivalent navigation without depending on drag gestures. A drag must not trigger a node click on release.

A small overview map is available when the graph extends beyond the viewport. It shows the camera position and can recenter the canvas. It remains optional and subordinate to the main graph.

Use progressive detail at different zoom levels. At overview scale, show milestone names, equipment counts, and compact equipment marks. Reveal equipment tags and secondary labels as space allows. The selected node remains identifiable at every zoom level. Do not shrink essential text until it becomes unreadable.

## Deep relationships

Support closest-parent chains at least eight levels deep without imposing a three-level limit on equipment relationships. The milestone structure remains the organizing view. Expanding an equipment's connections reveals structural ancestors, descendants, and prerequisites while retaining their project and milestone context.

Provide explicit Expand branch, Collapse branch, Follow parent chain, and Show dependencies actions where they apply. Following a chain focuses the relevant neighborhood and leaves a visible route back to the full SSM. A breadcrumb records the project and milestone scope; the connection trail records the equipment being followed.

Depth alone is not a performance guarantee. Dense, wide branches and highly connected equipment require progressive expansion, readable grouping, and a clear indication of the number of displayed versus loaded nodes. Any rendering limit must be visible and offer a way to continue exploring.

## Relationship presentation

| Relationship | Meaning | Presentation |
| --- | --- | --- |
| Parent Milestone to Milestone | Declared milestone hierarchy | Quiet structural connector |
| Milestone to Equipment | Existing milestone assignment | Restrained membership connector |
| Equipment to closest parent | Direct structural parent | Solid directional connector |
| Dependency | Prerequisite required by the referencing equipment | Dashed directional connector |

Direction markers identify which node references which parent or prerequisite. Color reinforces line style and labels; it is not the only way to distinguish relationships. Relationships crossing projects or milestones remain explicit.

Selecting a node emphasizes its relevant paths and subdues unrelated connections. Closest-parent and dependency layers can be toggled independently. All connections adds available connections among the displayed nodes within the bounded link budget, while selection focus reduces clutter. Neither action changes underlying membership.

Shared equipment retains a single underlying identity even when the layout uses several occurrences to show different milestone memberships. Totals deduplicate physical equipment by resolved identity. Organizational headers remain inspectable and are excluded from equipment totals.

## Equipment highlighting

The report author chooses a bound column through the Format pane: Discipline or an Equipment details field. Report viewers choose values through a compact searchable Highlight control; they do not choose or edit the column. Multiple selected values use OR matching against the actual supplied values, including conflicting metadata values. Field identity uses stable model identifiers, not display labels. Missing or removed fields must not leave stale matches.

Highlight matching equipment occurrences throughout the displayed hierarchy and dependency lanes. Keep surrounding nodes and their relationship context visible. A visible match treatment and label must supplement color, preserve selected-node readability, and respect high contrast. Display concise match information and an accessible clear action. The highlight index is cached by graph revision and column; changing the camera must not rescan all metadata. Bound the rendered value picker while still allowing search for values in high-cardinality columns.

## Search and selection

Search equipment tags, labels, and milestone names from the available dataset. Results identify node type, project, and milestone so matching names can be distinguished. Searching does not silently alter the project filter.

Choosing a result in the current project scope opens the necessary L1 and L2 ancestors, selects the correct milestone and equipment pages, moves the camera to it, and opens its details. A result outside the current scope offers a clearly labelled action to switch or add that project. Zero results explains which scope was searched and offers Clear search.

Single-click opens or updates the details drawer. Clicking an L1 or L2 card also toggles its next hierarchy level. Selecting another node keeps the drawer open and updates its content without resetting the canvas. Separate expansion controls allow toggling without changing the inspected node and do not depend on double-clicking. Hover previews are supplementary; the same information remains available through keyboard focus and the drawer.

Local graph exploration is separate from selecting data in the Power BI report. Provide an explicit Select in report action and the native context menu where the node has a valid model identity. Native report drillthrough is available only when a compatible destination page and matching model fields have been configured. Locally generated headers and unresolved references retain the local inspector even if report drillthrough is unavailable.

## Node details drawer

Open a right-side details drawer on node selection. Keep it anchored within the visual's bounds while the graph pans and zooms. At larger sizes it sits alongside the graph; at narrow sizes it overlays the graph with an accessible close action. Closing returns focus to the selected node without resetting the camera.

The drawer contains the node name and type, its project and milestone context, author-selected metadata, and its relationships. Use compact Overview and Connections sections or tabs when the amount of information warrants them. Connections name the other node, explain the relationship type, and allow navigation to that node. Mark referenced equipment absent from the dataset as unavailable, displaying only information actually supplied.

The report author configures the drawer through the Format visual pane. Available fields come from columns bound to the visual's Node Details role. Support field visibility, display labels, ordering, typed formatting, and empty-value behavior. Resolve fields by stable model identifiers rather than their display labels. Keep separate configurations for Parent Milestone, Milestone, Equipment, and organizational headers where applicable.

Report viewers receive a read-only drawer with the configured fields. They do not receive a metadata field picker. Metadata belongs to its node: do not transfer equipment attributes to a milestone or sum scalar values because the equipment appears on multiple relationship rows.

## Visual finish and accessibility

Use the LotusWorks visual language, clear typography, restrained discipline colors, and consistent spacing. Place essential actions beside the content they affect. Keep the default toolbar compact; reveal secondary connection actions in the selected node's drawer.

Use short transitions for branch expansion, camera focus, and drawer movement. Honor reduced-motion settings. Avoid decorative animation, pulsing nodes, and shifting layouts during ordinary inspection. Support light, dark, and Power BI high-contrast presentation.

Provide concise hover and focus tooltips for relationship toggles, child disclosures, dependency actions, and highlighting. Keep explanations out of the normal canvas until requested and prevent tooltips from intercepting pointer actions. Provide visible focus, descriptive control labels, keyboard activation, Escape to close the active transient panel, and accessible updates for selection and filtering. Tooltips must not be the only source of important information. Long tags wrap or reveal their full value on an accessible trigger. Small visual sizes must preserve the primary controls and readable details.

## Loading and recovery states

Distinguish initial field setup, loading, no source data, no filter matches, unavailable references, and a partially loaded dataset. Each state names the condition and offers a relevant action. Do not present an empty result as proof that no dependency exists.

Preserve the camera, compatible selection, and expansion state during updates to metadata. Clear stale details when a node disappears. Show missing or conflicting milestone parents and duplicate identities as unresolved states instead of choosing a relationship silently. Cycles must terminate traversal and remain inspectable.

## SQL and Power BI data contract

If all projects share one SQL registry table, bind a Project field from that table. Additional database connections are unnecessary for projects already present in the same source. The SQL layout and available project identifier still need verification during implementation.

Use project-scoped stable identifiers for equipment and milestones, with labels stored separately. Prefer durable source keys or ingestion-managed surrogate keys. Preserve original tags and source identifiers as metadata. Do not assume export sequence numbers or upload identifiers remain stable across refreshes.

The reporting model needs equipment records, milestone definitions, milestone assignments, and typed equipment relationships. Read-only SQL views can derive these from a shared registry table; separate physical tables are not required. Resolve a dependency within the referencing equipment's project unless an explicit target project is supplied. Never search all selected projects for a matching tag. An explicitly referenced project absent from the supplied data stays unresolved, as does any ambiguous target.

Power BI manages source connections, access, refresh, and row-level security. The visual consumes its supplied data and makes no direct SQL queries. Local filters can retain supporting context only when the relevant records were supplied. Report slicers or security restrictions may remove that context; the visual must never bypass them or claim to show records it has not received.

Bind detail records to an explicit node identity and node type. Equipment metadata in a registry row does not become metadata for its associated milestone or parent header. Milestone and header detail records carry only their own supplied attributes and explicitly defined aggregates. Repeated relationship rows do not duplicate scalar metadata. Conflicting values remain visible as conflicts rather than taking the first row or summing them.

Keep entity metadata separate from repeated edge rows. Preserve unassigned equipment and unknown references in inspectable groups. Load available data in supported batches and display incomplete-loading or truncation states before claiming a complete SSM view.

## Verification and delivery

Use synthetic fixtures for implementation and distribution. Validate the packaged visual in Power BI, including selection identities, report drillthrough, formatting persistence, and resize behavior. A standalone concept does not verify those host integrations.

Acceptance checks include:

- Eight-level closest-parent chains, wide branches, shared equipment, and cross-milestone dependencies.
- Two projects with matching equipment tags and milestone labels that remain distinct.
- Single-project, multiple-project, and All projects filters with cross-project supporting context.
- Missing target projects, unavailable references, duplicate identities, and cycles without silent misjoins or infinite traversal.
- Pan and pointer-centered zoom with a fixed drawer, usable Fit all and Focus selected actions, and no accidental clicks after dragging.
- Search that reveals the correct branch and makes project-scope changes explicit.
- Drawer field visibility, labels, order, formatting, and blank handling configured only by the report author.
- Stable camera and selection after metadata refresh, plus explicit recovery when a selected node disappears.
- Clear loaded-versus-displayed counts, measurable interaction performance on representative synthetic graph sizes, and visible partial-data states.
- Narrow and desktop sizes, keyboard-only use, high contrast, and reduced motion.

Create a separate visual identity and include the new `.pbiviz` in the existing LotusWorks package pipeline. After the production visual and package checks pass, synchronize the full package and verify distribution contents. Exclude registry data, private source material, credentials, and local inspection artifacts from distribution. Version 1.2 was emailed after the user explicitly approved that delivery. Send subsequent ZIPs only after a new explicit instruction to email them.
