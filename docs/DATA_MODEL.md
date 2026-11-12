# Data model v1

Normative source: `packages/home-model/src/model.ts`. JSON is the single source of 2D/3D geometry. It does not serialize Three.js objects.

| Type | Contents |
| --- | --- |
| HomeProject | schemaVersion, UUID, name, ISO dates, building, bindings, scene |
| Building | UUID, name, one or more floors |
| Floor | elevation, ceiling, vertices, walls, rooms, objects, optional floor-plan reference |
| Vertex | UUID, metric x/y coordinates |
| Wall | two vertex references, thickness, height, material, openings |
| WallOpening | door/window, offset from start vertex, width, height, sill |
| Room | ordered boundary with vertexIds/wallIds, name, floor material |
| FurnitureObject | catalog type, position, rotation, scale, dimensions, material, assetId |
| SmartDeviceBinding | objectId, provider, entityId, relatedEntityIds |
| SceneConfiguration | quality, theme, wall visibility, camera |

Every UUID is unique across the project. Adjacent rooms reference the same vertices/shared wall. Floors derive from room boundaries; there is no duplicate wall-coordinate list for each room.

2D `(x,y)` becomes `(x,elevation,z=y)` in 3D. Floor elevation applies to the Three.js group; object vertical positions are floor-relative. Object rotations use radians; floor-plan rotation uses degrees. Dimensions/scale are separate: final size = dimension × scale. Opening offsets are measured from the wall's starting endpoint regardless of direction.

Validation checks structure, finite numbers, IDs, references, minimum lengths, positive dimensions, materials, closed/non-self-intersecting boundaries, duplicate walls, crossings, and contained/non-overlapping openings. The store validates before every commit. JSON imports are limited to 35 MB; each floor collection has at most 2,000 elements. Keep projects well below limits for lightweight clients.

Import calls `migrateProject`: the structurally identical prototype schema 0/unversioned becomes 1; future versions are explicitly rejected. Unknown schemas do not receive invented conversions. Import/export recursively removes fields named for tokens, passwords, credentials, and secrets.

The floor-plan reference contains a `data:image/png` or JPEG preview, raster size, meters per pixel, origin, rotation, and opacity. The original Blob lives in asset storage under an ID; GLBs use the same storage. JSON transfers geometry, bindings, and previews; full original files can be transferred through server ZIP backups (see [BACKEND.md](BACKEND.md)).

A binding belongs to a specific provider. Switching demo/HA retains bindings without sending commands to the other provider. Users explicitly replace the entity in the panel. Compatibility is checked against available entities, never guessed from names.
