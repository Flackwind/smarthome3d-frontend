# Roadmap

## Implemented MVP

1. **Foundations:** npm workspace, strict standalone Angular, Signals, routing, versioned model, mock provider, documentation.
2. **3D geometry:** parametric walls/floors, real openings, procedural furniture, OrbitControls, raycast, focus, views, cleanup.
3. **2D editor:** grid, snapping, zoom/pan, drawing, closed-boundary rooms, shared walls, draggable vertices/objects, dimensions, doors/windows, undo/redo.
4. **Import and assisted generation:** PNG/JPEG/first-page PDF, local original, metric calibration, orthogonal/slanted wall detection and opening proposals in a Web Worker, confirmed review/exclusions, new-floor generation.
5. **Home Assistant:** WebSocket protocol, OAuth/PKCE with in-memory renewal, snapshots/events, optional registries, filtered commands, reconnection. Transport tested with simulated servers; physical hardware requires separate testing.
6. **Smart objects:** catalog, transformations, self-contained local GLBs, explicit bindings, related entities, light/climate/robot/sensor control, emissive state.
7. **Persistence:** IndexedDB, multiple projects, autosave, CRUD, restore, JSON import/export, prototype v0 → v1 migration.
8. **Deployment prepared:** production build, PWA, Nginx, HA Compose, Dockerfile; target-server/Android testing remains environment-specific.

On November 3, 2026, local HA Container installation was completed on the development PC, with configuration, healthcheck, HTTP/CORS, and WebSocket handshake verified. The user then completed onboarding and confirmed the Smart Home 3D connection with IKEA/Roborock; Xiaomi remained to be integrated. Map/full-screen virtual-home views were added from the supplied visual references. See HOME_ASSISTANT_LOCAL.md and FLOORPLAN_GENERATION.md.

Actual checks and limitations are in VERIFICATION.md. Deployment configuration does not imply a completed deployment.

## Status agreed with the user

1. **Real floor plan:** completed by the user; do not regenerate their project without a request.
2. **Physical robot position:** testing deferred; monitoring/alignment are implemented.
3. **Mobile/PWA:** physical phone/deployment testing deferred.
4. **Full backup with original PDF/GLB:** initially deferred; subsequently implemented with the backend ZIP workflow below. JSON/IndexedDB remain available.
5. **Xiaomi:** integration handled by the user.
6. **Frontend extensions:** slanted walls/confirmed door-window proposals, HA OAuth/PKCE with in-memory renewal, and room cleaning through mapped HA areas implemented. Guides: [floor plans](FLOORPLAN_GENERATION.md), [sign-in](HOME_ASSISTANT_AUTH.md), [robots](ROBOT_VACUUM.md). Tests use synthetic documents/simulated servers.

## Implemented backend

Optional server storage for projects/assets, conditional revisions, local imports, and ZIP backups; owner profile retains the last home and encrypted persistent HA authorization, restored after sign-in even after restarting. Frontend npm/backend Maven are independent sibling Git repositories in `frontend/` and `backend/`, without exported copies. Default on-disk H2; configurable PostgreSQL needs target-deployment testing. See [BACKEND.md](BACKEND.md).

Remaining work includes real deployment/device testing, family accounts/permissions, password change/reset with credential re-encryption, collaborative synchronization, unused-asset collection, multi-selection/gizmos, boundaries with holes, Android GPU testing, AI generation, and Capacitor/kiosk. HTTP sessions remain in RAM and require owner sign-in after restarting; HA authorization restores from the encrypted profile without another popup.
