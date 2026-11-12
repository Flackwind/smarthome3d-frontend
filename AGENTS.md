# Smart Home 3D

- This directory is the standalone frontend repository. Run npm commands here; the backend communicates only through HTTP/WebSocket APIs.
- Read PROJECT_CONTEXT.md before changing the project.
- Use standalone Angular, strict TypeScript, and Signals for UI state.
- Keep UI, parametric model, geometry, and home automation providers separate.
- Coordinates are in meters; 2D floor x/y → Three.js x/z; elevation → y.
- Do not connect the renderer or components to proprietary IoT APIs.
- Browser tokens must stay in memory, never on disk, in IndexedDB, logs, or exportable JSON. The backend may store the HA refresh token encrypted in the owner profile; do not send it to the frontend.
- Preserve mobile layouts, touch support, on-demand rendering, and Three.js cleanup.
- Write meaningful tests for new features and update documentation.
- Avoid unnecessary dependencies. Analyze code before deleting it.
- Run `npm run typecheck`, `npm test`, and `npm run build`.
- Do not automatically start or modify containers or host services.
