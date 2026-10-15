# SSM Explorer

SSM Explorer is a separate LotusWorks Power BI visual for inspecting project-scoped SSM relationships. It presents parent milestones, milestones, and assigned equipment, with distinct directional links for closest parents and prerequisites. The existing Network Chart remains available.

## Import and bind

1. In Power BI, connect the report to your SQL registry table or a read-only reporting view. The visual uses the rows supplied by the report; it does not connect to SQL itself.
2. Import `ssmExplorer_91E8C42DA6B7.1.7.0.0.pbiviz` using **Import a visual from a file**, then place it on the report canvas. If updating an earlier version, accept Power BI's replacement prompt; the visual ID is unchanged.
3. With SSM Explorer selected, drag columns from Power BI's Data pane into its **Build visual** field wells. You can add fields in any order; the canvas identifies missing **Project** or **Equipment ID** fields until both are bound. Bind the hierarchy and relationship fields below to build the full SSM view. Use stable IDs/tags and set numeric identifiers to **Don't summarize**.
4. Add descriptive fields to the appropriate details field well. Configure their visibility, labels, order, and display format in **Format visual**.

| Visual field | Registry meaning | Binding |
|---|---|---|
| Project | Stable project identifier or unique project name | Required |
| Equipment ID | Stable equipment tag within the project | Required |
| Equipment label | Description shown on the node | Optional; defaults to ID |
| Record type | `Equipment` or `Header` | Optional; blank means Equipment |
| Discipline | Equipment discipline | Optional |
| Status | `Not Started`, `In Progress`, or `Completed` | Recommended for status colors and completion exports |
| Parent milestone (L1) | Stable parent milestone identifier | Recommended |
| Milestone (L2) | Stable milestone identifier within the project | Recommended |
| Closest parent | Direct structural parent equipment tag | Optional |
| Closest parent project | Project containing that parent | Optional; defaults to row project |
| Dependencies | Prerequisite equipment tag(s) | Optional |
| Dependency project | Project containing each prerequisite | Optional; defaults to row project |
| System name | System header identifier | Optional; recognizes a matching closest parent as a system root |
| Equipment details | Additional equipment/header metadata columns | Optional, multiple columns |
| Milestone details | Metadata belonging to the L2 milestone | Optional, multiple columns |
| Parent milestone details | Metadata belonging to the L1 milestone | Optional, multiple columns |

Use a stable project key if project names are not unique. The visual identifies equipment by project, record kind, and equipment ID. Identical tags in different projects remain separate. Milestone IDs must be unique within their project; if the source repeats a milestone name for different milestones, create a unique reporting key before binding it.

## Rows and relationships

One row can contain an equipment record, its milestone assignment, its closest parent, and its prerequisites. Repeated rows may express additional milestone memberships or dependency relationships. Equipment counts deduplicate repeated equipment identities. Conflicting scalar details remain visible as conflicting values; the visual does not sum metadata or infer a completion percentage.

Dependencies accept a single exact tag, semicolon/comma/newline-separated tags, or a JSON array:

```json
[{"id":"EQ-010","project":"Project Alpha"},{"id":"EQ-020","project":"Project Beta"}]
```

Explicit project IDs in JSON take precedence. A single dependency-project value applies to all listed tags. Multiple dependency-project values must align one-for-one with the tags. Ambiguous alignment is flagged rather than guessed. Blank, `N/A`, and `-` dependency/parent values are treated as no relationship.

The closest-parent relationship remains separate from milestone membership. A prerequisite from another milestone stays assigned to that milestone and appears as related equipment. Missing references and cycles are labelled for review. System headers and unavailable references do not count as physical equipment. Bind source header rows as `Header` to distinguish them from equipment.

## Explore

- Choose one, several, or all projects. Filter by parent milestone, milestone, or discipline.
- First opening starts with no projects selected. Choose a project (or All) to show its L1 parent milestones. Click an L1 to reveal its L2 milestones, then click an L2 to reveal equipment. Each level expands independently and opens that node's details.
- L2 milestones wrap within their own L1 group. Large milestone groups and equipment branches have pages, keeping hundreds of milestones out of a single horizontal row.
- Opening a milestone shows its root equipment. Use **Children** on a parent card to expand its direct children underneath, then expand each child as needed. Sibling groups wrap into up to three columns according to the visual width and are paged independently. Expanded parents reserve space for their children before the next sibling group. Parents, headers, and equipment from other milestones keep their original identities and assignments.
- Use **Dependencies** on an equipment card to reveal its direct dependencies in a lane beside it. Switch to **Required by** to see items that depend on it. Each related card opens its own metadata. Dependency lists are paged and retain their source relationship and original milestone assignment. Related equipment can expose its own children and dependencies. Up to eight dependency lanes can remain open; use **Follow dependency chain** in the details panel to continue beyond that view.
- Search locates loaded nodes, including collapsed equipment and nodes in another project. Selecting a result opens its ancestors and locates the correct milestone and equipment pages.
- Toggle closest parents, dependencies, and **Related equipment**. Related equipment includes linked parents and dependencies outside the active filters, along with their milestone paths. Arrowheads point from equipment to its parent or prerequisite.
- Drag empty canvas to pan. Scroll or trackpad-pinch to zoom. Use the zoom controls, Fit all, Focus selected, and overview map to navigate deep chains.
- **Start over** clears project selection and returns to the project chooser. The next project opens L1-only. It also clears other filters, search, highlights, selection, expanded branches, paging, and dependency lanes. The reset replaces the saved view, so returning to the page keeps it reset. Theme and loading pause remain as chosen.
- Click a node to open the details drawer. Click empty canvas, press Escape, or close the drawer to clear the local selection and dimming. Connections lets you follow related nodes. Author-selected details differ by node type.
- **Select in report** uses the equipment's supplied Power BI row identities. Generated milestone and unresolved nodes do not impersonate an equipment row. Native context menus and drillthrough destinations depend on the report configuration.

Use the sun/moon button in the top toolbar to switch between light and dark mode without changing your selection, expanded branches, filters, or zoom. The viewer's choice is included in the saved view, alongside filters, expansion, selected equipment, dependency lanes, highlighting, and camera position. **Format visual → Appearance → Theme** sets the starting mode; changing that author setting resets the viewer override. Automatic follows the system preference until a viewer chooses a mode. Power BI high contrast takes priority and disables the toggle with an explanation.

Node hover shows a compact, delayed summary; full metadata stays in the details drawer. The summary dismisses on pointer leave, clicking, panning, zooming, or Escape. Hover over the relationship toggles, child controls, dependency controls, Highlight, or theme control for a short explanation; the descriptions are also available on keyboard focus.

Keyboard: Tab reaches controls and nodes, Enter/Space activates buttons, arrow keys on the canvas pan, +/− zoom, Home fits, and Escape clears selection and closes details. Reduced motion and host high-contrast colors are respected.

Expansion, collapse, and opening dependency lanes leave the camera in place. Use Fit all, Focus selected, pan, or zoom when you want to move the view. Expand/collapse uses brief movement and reveal transitions. Turn off **Transitions** in the Canvas formatting card to disable them; the operating system's reduced-motion preference also disables them. **Expand hierarchy on first load** is an optional author override; leave it off for L1-only startup.

Project and discipline controls inside the visual change this visual's scope. They do not rewrite the registry or change report-level security. A report slicer can also filter the SQL-backed model, but records excluded by the report or row-level security cannot be recovered by the visual. Keep both ends of a relationship available to the visual when cross-project context is needed.

## Returning to a report page

SSM Explorer saves the current view in hidden per-visual Power BI properties and restores it when the host recreates the visual. This includes the camera, selected node, details tab, project and discipline filters, expanded branches and pages, dependency lanes, highlights, search, theme, and loading pause. Restoration waits for saved equipment that arrives in later data batches. It does not replay **Select in report** or alter registry data.

Each visual has its own state. Changing the bound field schema resets an incompatible view; missing records and obsolete filter values are handled safely. Power BI bookmarks can replace or clear the saved state. Save the report to retain authored state between report sessions; viewer retention across separate sessions depends on the host. Page-return behavior is covered by a host-recreation harness and still needs validation in your Desktop/Service report.

## Highlight equipment

Report authors choose **Format visual → Highlighting → Highlight column** from Discipline or a bound Equipment details column. Viewers choose one or more values in the **Highlight** control. A card matches if it contains any selected value; highlighting keeps the surrounding structure visible and applies to the same equipment wherever it appears, including dependency lanes. Clear the selected values to return to the normal view.

Highlighting is separate from the project, milestone, and discipline filters that change the displayed scope. It uses only records supplied to the visual and does not edit data or select other report visuals.

## Author the drawer

Bind custom metadata to the equipment, L2, or L1 details field well. Each bound field gets author settings for visibility, a custom label, display order, and format. Equipment and header settings are independent even when they use the same source column. Field choices live in Power BI's Format visual pane; viewers do not get a field editor.

The visual includes identity, project, discipline, milestone, and connection sections with author visibility controls. Blank metadata is hidden by default. Do not bind equipment-level progress to a milestone details well unless the SQL/report model supplies a defined milestone-level value.

## Status and milestone completion export

Bind the equipment's status column to **Status**. It also appears among the author-configurable equipment/header metadata fields. For existing reports, one unambiguous Equipment details column named **Status** works without rebinding; an explicit Status field takes precedence. Status matching ignores case and repeated whitespace. Not Started is gray, In Progress is yellow, and Completed is green, with a text label on each card. Missing, unrecognized, or conflicting values remain visible for review. Milestone completion is not inferred from equipment status. Power BI high contrast replaces the colors while retaining the labels.

Select an L2 milestone and choose **Export workbook** in its Overview panel. The Excel workbook uses the complete graph received from Power BI, independent of local discipline/project filters, collapsed branches, paging, and the visible-node limit. It contains:

- Every equipment/header assigned to that L2, including Completed records.
- Structural descendants and outgoing dependencies, following their chains. Completed records outside the selected L2 are traversed but excluded from the exported list.
- The full closest-parent chain of the required equipment, including upstream items in other milestones or explicitly referenced projects. Traversal continues through completed parents to reach unfinished switchgear or other upstream equipment. It does not fan back down an upstream parent into unrelated sibling circuits.
- Actual related L1/L2 assignment pairs, relation reasons, and review notes. Repeated equipment identities are deduplicated within each project. Missing or conflicting statuses and unavailable references are retained as review items, rather than assumed complete.

The workbook separates **Milestone equipment** from **Related equipment** outside that milestone. Both sheets show the milestone title, project, and status summary above filterable lists, with frozen headers and equipment identities. When an item has too many connections to fit readably in a cell, a **Relationships** sheet preserves the individual references and assignment pairs. Summary counts describe the static export snapshot.

Export waits until all host batches have arrived. Report/model filters and row-level security still control which rows the visual receives; make the full relevant registry scope available for a completion review. The workbook records the supplied data and unresolved issues, and does not certify that the milestone can be claimed complete. Excel's row/cell limits and oversized individual descriptions or notes produce an explicit error instead of a truncated export.

Downloads use Power BI's **ExportContent** privilege and file-download API. The tenant's custom visual download setting must allow it, and Power BI may ask the viewer to confirm the download. A denied or cancelled download is shown without changing the graph. The API supports Desktop and Service and limits downloaded files to 30 MB. See [Microsoft's file download API documentation](https://learn.microsoft.com/en-us/power-bi/developer/visuals/file-download-api).

## Large datasets and deployment checks

The visual requests 2,000-row table windows through the Power BI host using incremental segments. Newly delivered rows are indexed without reparsing earlier rows. Power BI may supply the first batch immediately. The visual waits for a project selection before requesting additional batches, and stops requesting more when project selection is cleared. This delays further delivery; the project picker still filters supplied data locally rather than issuing a project-specific SQL query. Loading yields between requests. The compact indicator at the top right shows the number of received source rows and a loading ring while a batch is pending. It changes to Paused, More available, Stopped/Interrupted, or Loaded as delivery changes. The count describes rows supplied to the visual, not unique equipment or the total SQL table size; no percentage or completion estimate is inferred. Use **Pause**, **Resume**, or **Load more/Retry** beside the count to control background loading. An already accepted host query may finish after pausing. Report authors can turn off **Load additional batches automatically** in the Canvas formatting card for manual loading. Power BI can stop delivering rows at its host limits; the visual displays that state instead of treating partial data as complete.

Once a project is chosen, the default view contains L1 cards; L2 and equipment descendants appear as their levels are opened. Milestone groups and equipment branches use bounded pages, and the canvas renders cards near the viewport with a configurable **Visible node limit** (300 by default). Pan and zoom reuse indexed geometry and the overview map. Search and relationship traversal use the loaded graph, so they can reveal equipment that is currently collapsed or outside the viewport. Hierarchy depth is not limited to eight layers; practical capacity depends on supplied rows, relationship density, viewport size, and host limits.

The details drawer is built for the selected node. All bound metadata columns still contribute to the data payload supplied by Power BI, even when hidden in the drawer. Bind only fields the report needs. Project controls filter already loaded data inside the visual. To reduce SQL/query payload, use report-level filters or a reporting model that preserves the required relationship context; expanding a branch does not issue a separate SQL lookup.

Before publishing your report, verify the actual SQL field mapping, project keys, row-level security, persistent author formatting, native report selection/context menus, and segmented fetching in Power BI Desktop or Service. Local automated tests and the synthetic browser harness do not substitute for that final host check.

## Development

From the repository root:

```sh
npx vitest run --project ssm-explorer
npm run build --workspace=@pbi/ssm-explorer
npx vite --config packages/ssm-explorer/dev/vite.config.ts
```

The development harness imports the production visual and uses synthetic fixtures only. No registry contents, confidential source exports, or live SQL credentials belong in this package or its distribution archive.
