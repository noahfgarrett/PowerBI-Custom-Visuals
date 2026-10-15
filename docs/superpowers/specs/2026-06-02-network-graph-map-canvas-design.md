# Network Graph Map Canvas Design

## Goal

Add a site-map workflow to Network Graph so users can place source/building nodes over a background image, keep target/spec nodes readable, and show useful weld metrics without turning each measure into another graph topology.

## User Workflow

1. The report author adds `Source`, `Target`, and `Weight` as before.
2. The author enables `Map Canvas` layout and pastes a WebP/PNG/SVG image URL or data URI into the background image setting.
3. The visual renders the image behind the graph with configurable fit, alignment, opacity, and dimming.
4. Source/building nodes can be dragged to their physical site-map locations.
5. Dragged source-node positions are persisted as normalized canvas coordinates, so the map remains stable when the visual resizes.
6. Target/spec nodes remain in a configurable rail/lane to avoid covering the map and to keep relationship links readable.
7. Extra measure fields render as optional badges and tooltip rows on nodes/links rather than becoming additional node classes.

## Scope

### In Scope

- Background image rendering for WebP, PNG, SVG, JPEG, and any valid browser-supported image source.
- Image source entry through a format-pane text field that accepts a URL or data URI.
- Optional image URL data role for dataset-driven image source if a report wants to store the map URL in data.
- Image fit modes: `contain`, `cover`, `stretch`.
- Image horizontal/vertical alignment controls.
- Image opacity and optional dim overlay to keep links and nodes legible.
- `Map Canvas` layout mode.
- Persistent manual source-node positions keyed by source node id.
- A reset action for persisted map positions.
- Target/spec rail position controls.
- Additional measure role with multiple measures for badge and tooltip display.
- Badge controls for enabling badges, choosing the displayed measure, and formatting badge text.

### Out of Scope

- Native local-file upload picker inside the Power BI format pane.
- Editing or drawing site maps inside the visual.
- Persisting arbitrary target/spec positions in v1.
- Converting each extra measure into separate node/link families.
- Automatically geocoding source nodes.

## Image Recommendation

WebP is the recommended default for site maps because it usually reduces report weight and load time compared with PNG. PNG remains the safest fallback for compatibility and crisp screenshots. SVG is supported when the map is a vector drawing, but data URI encoding can be more finicky.

If the image is a remote URL, the visual declares nonessential `WebAccess` support for image loading. If the image is a data URI, the report is self-contained but report metadata can grow quickly. The visual accepts data URI usage without requiring external access.

## Data Model

Existing roles remain:

- `source`: building/source grouping.
- `target`: pipe spec/target grouping.
- `weight`: primary measure used for link width, link labels, and relationship tooltips.

New roles:

- `imageUrl`: optional grouping or measure-like text field for the map image source. The first non-empty value is used when the format-pane image source is empty.
- `detailMeasure`: optional measure role accepting multiple measures. These values are aggregated per source node, per target node, and per link where possible.

## Rendering Model

- The SVG gains a `network-map-background` layer behind links.
- The background image is rendered as an SVG `<image>` so it shares the same coordinate system as nodes and zoom/pan.
- The image uses computed dimensions for `contain`, `cover`, or `stretch` inside the inner plot area.
- A dim overlay sits above the image and below links when enabled.
- In `Map Canvas` mode, source nodes use persisted coordinates when available.
- Source nodes without persisted coordinates start in a gentle grid over the map instead of collapsing into the rail.
- Target nodes use the existing source/target rail logic, biased to the selected rail side.
- Drag end persists source-node coordinates when map pinning is enabled.
- Drag end for target nodes behaves like normal pinning but does not persist map coordinates in v1.

## Position Persistence

Persisted positions are stored as JSON in a declared formatting object property:

```json
{
  "Building A": { "x": 0.18, "y": 0.32 },
  "Building B": { "x": 0.62, "y": 0.48 }
}
```

Coordinates are normalized against the current inner plot area, not absolute pixels. The renderer clamps values between `0` and `1`.

## Measure Badges

The visual supports optional badges rendered near source nodes:

- The author chooses the badge measure by display name or index.
- Badge text uses existing number formatting.
- Badges can show measure name, value, or both.
- Badges participate in hover dimming and selection dimming.
- All detail measures appear in tooltips, even when only one badge is displayed.

## Error Handling

- Empty image source renders no background and the graph continues normally.
- Invalid image URLs are displayed as a muted fallback message in the background layer.
- Invalid persisted-position JSON is ignored and replaced with an empty position map.
- Missing detail-measure values are skipped in badges and shown as blank/omitted in tooltips.
- External image failures do not fail the visual update.

## Testing

- Unit tests verify background image rendering for data URI/WebP-compatible sources.
- Unit tests verify image fit attributes and opacity/dim overlay output.
- Unit tests verify map layout places persisted source nodes at expected normalized coordinates.
- Unit tests verify source-node drag persistence calls `host.persistProperties`.
- Unit tests verify target nodes remain in a rail in `Map Canvas` mode.
- Unit tests verify extra measures appear in source-node tooltips and selected badge text.
- Formatting coverage must pass with the new format-pane controls.
- Typecheck, package build, sync, and package review must pass before completion.

## Acceptance Criteria

- A WebP site map can be rendered behind the network graph.
- Building/source nodes can be pinned over the map and retain their positions after update/resize.
- Pipe spec/target nodes remain organized and readable.
- Relationship links remain visible over the image.
- At least one extra weld metric can be displayed as a badge and all extra metrics appear in tooltips.
- The visual version is bumped and the package is rebuilt/synced.
