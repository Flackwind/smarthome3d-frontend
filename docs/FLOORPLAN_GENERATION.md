# From floor plan to virtual home

Previews: [virtual home on mobile](images/virtual-home-mobile.png), [plan analysis](images/floorplan-generation.png), [generated 3D floor](images/generated-model.png).

In **Home editor**, import PNG, JPEG, or PDF (first page). Analysis stays in the browser. For real dimensions, choose **Calibrate with two points**, select a known distance's endpoints, and enter meters. The initial import scale is approximate.

Choose **Generate 3D from floor plan**, then **Analyse floor plan**. Green segments are proposed walls: tap to exclude them or use checkboxes under **Analysis limits and details**. Excluded segments turn red. Closed-room counts update with selection.

Confirm scale before **Create floor and 3D model**. Alternatively, enter the full sheet width in meters, including margins; do not confuse it with the home's width. Changing width requires confirmation again.

Generation adds a **new floor** with shared vertices, split junctions, metric walls, and colored floors for closed rooms. The original floor, objects, HA bindings, and document remain. One **Undo** removes the generated floor; **Redo** restores it. The existing 20-floor limit applies.

Edit generated walls/vertices with manual-editor tools. Check doors/windows, rename rooms, place furniture, and bind real devices. Generation does not automatically move devices from the previous floor.

## Detection capabilities

The local engine detects dark **horizontal, vertical, and slanted** segments on light backgrounds. Slanted detection uses bounded Hough voting and wall-pixel direction refinement; the graph splits arbitrary-angle intersections/overlaps. Disable **Detect diagonal walls** for orthogonal drawings. It filters short segments, merges solid-wall bands, can join parallel wall edges, and close small gaps. Editor origin/rotation also work: metric transformation applies to proposed geometry.

This is not universal semantic recognition or AI. It does not read written dimensions, room names, or furniture. Openings are geometric hypotheses without reliable architectural-symbol classification; blurry drawings, annotations, and door arcs may need manual correction. Boundaries with holes are unsupported, as in the current model. Drawings alone do not determine real scale. Review detailed plans: long furniture or dimension lines can resemble walls.

To improve results:

- Use a sharp plan with limited margins and no title block where possible.
- Increase **Minimum length** to reject text/small details.
- Lower **Threshold** for darker lines only; increase it for pale drawings.
- Increase **Minimum thickness** to reject thin dimension lines.
- Adjust **Merge parallel lines** to combine edges of one wall.
- **Close gaps** controls small scan interruptions. **Propose doors and windows** can reconnect aligned fragments up to **Maximum opening** to propose a cutout; to preserve every gap, disable proposals and set Close gaps to 0.

Recognition parameters use analysis-image pixels, resized to at most 1600 pixels on the longest side. Results are mapped back to original reference coordinates. Proposals are capped at 300 segments and geometry at model limits; complex images need stricter parameters. Invalid geometry is not applied.

## Reviewing doors and windows

[Preview with slanted walls and a confirmed opening](images/oblique-opening-review.png).

Orange segments show opening proposals from internal gaps or low-ink stretches along walls. Gaps tend to suggest doors; thin lines through gaps can suggest windows. Check classification against the document.

Every opening starts **unconfirmed**. Under **Check openings**, check its box and choose **Door**/**Window**. Confirmed segments turn blue and counts update. Excluding a wall excludes its openings. Unaccepted proposals remain solid wall in the new floor. End gaps and entirely double-edge walls do not automatically become openings.

Width converts to meters using the verified scale. Door defaults start at floor level, 2.10 m high; window defaults use a 0.90 m sill and 1.20 m height, fitted to floor height. All dimensions remain editable. The generator rejects overlapping/out-of-wall openings or openings crossed by a junction: exclude invalid proposals and finish manually afterward. Model/JSON remain schema v1.

## Map appearance

Dashboard **Map** presentation uses a light background, pastel floors, low transparent white walls, room names, and device pins. Original metric heights remain in the model. Older projects are compatible; optional JSON `scene.presentation` preserves the preference without changing schema version.

Tapping a pin selects the object and shows active-provider controls. On lights have gold markers; unbound/unavailable entities are muted. Pins follow camera rotation/zoom/pan. **Model** view keeps full heights and raycast selection.

**Virtual home** expands to full screen, with a control card for the selected device. Use **Exit virtual home** or Esc to return to the dashboard. 3D/2D, framing, and wall-visibility controls remain available. Rendering stays on demand; teardown clears meshes, materials, outlines, events, and pins.

## Implementation and verification

`packages/floorplan-engine` depends on neither Angular nor Three.js. It returns proposals/a parametric floor; import, Web Worker, and review dialog belong to the app. Recognition needs no extra dependencies, API keys, or external floor-plan uploads. The worker terminates after analysis, timeout, or dialog closure. A local fallback supports browsers without Web Workers.

Synthetic drawings do not establish accuracy on a particular real plan. Tests cover shared walls, parallel boundaries, noise, transparency, gaps, slanted crossings, collinear overlaps, rotated/reflected rooms, opening proposals, explicit review/exclusions, scale, and validation. Browser tests cover generation/undo/redo, preservation of objects/bindings, pin reprojection after camera changes, and mobile virtual-home controls.

Implementation references: [Angular Web Workers](https://angular.dev/ecosystem/web-workers), [Three.js documentation](https://threejs.org/docs/).
