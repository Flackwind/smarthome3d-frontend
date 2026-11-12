# Server storage and separate repositories

For the first download/startup, begin with the [complete installation guide](INSTALLATION.md). This page explains storage, transfers, persistence, and conflicts.

The shared `SmartHome3D/` directory contains `frontend/` with its npm workspace and `backend/` with Maven, tests, Dockerfile, configuration, and documentation. Each has its own Git repository and can use another remote or move independently. There are no exported copies, source imports, or cross-repository build requirements: communication uses HTTP/WebSocket API v1 and a runtime URL.

Reorganization placed frontend sources/dependencies/configuration in `frontend/`. Browser data remains origin-bound: keep hostname/port to retrieve IndexedDB homes. Original local homes remain available.

## Two working repositories

`frontend/` contains frontend sources/documentation; `backend/` contains server sources/documentation. Each ignores caches, dependencies, builds, and private data. No export script is needed.

In the frontend repository:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm start -- --port 4300
```

In the backend repository, without installing the frontend:

```bash
./mvnw verify
SH3D_HA_URL=http://localhost:8123 ./mvnw spring-boot:run
```

Java 21+ is required; the launcher uses/downloads Maven with SHA-512 verification. Backend documentation is in its `README.md`, `PROJECT_CONTEXT.md`, `docs/API.md`, and `docs/openapi.json`. It is not installed as a system service and `npm start` does not start it.

## First connection

1. Start the backend explicitly: default `http://localhost:8090`, listening on loopback.
2. At first frontend launch, choose **Sign in to your server** in the wizard. Settings opens without creating a home. Then use **Storage and server → Check server** with that URL. Use the same hostname for frontend/backend.
3. Create the owner with a password of at least 12 characters. The server stores only a password hash; no credentials are predefined.
4. Use **Copy local projects to the server** to transfer existing data, including original PDFs/images/GLBs. Local originals are retained. Missing files reject a project transfer without partial copies; other completed project copies remain. The transfer remembers copied local IDs for this browser/server URL: repeating skips surviving copies without overwriting. Open the server home to continue editing.
5. If backend `SH3D_HA_URL` is configured, choose **Sign in to Home Assistant through the server**. Authorize in HA; the owner's refresh token is encrypted in the DB, with access tokens/PKCE verifiers only in server RAM. The browser receives no HA tokens.

The app indicates **Local storage** or **Server storage**. URL/storage mode and non-sensitive completed-transfer references are local preferences; passwords, HA tokens, and CSRF never enter IndexedDB, localStorage, or sessionStorage. The browser manages the protected session cookie.

**Open local storage**/**Open server storage** switch after saving the current home; they do not merge storage automatically. Other devices can sign in to the same server to access shared homes. Reopen a home or use **Reload server version** to see external edits; there is no real-time collaboration.

The server profile remembers the last selected home independently of this browser's local project. Sign-in reopens that home even if another was edited more recently. **Sign out of the server** retains projects/HA authorization. **Unlink Home Assistant from your profile** removes authorization and attempts revocation across the owner's browsers. Advanced manual-token access is local-mode-only with temporary credentials.

## Saving and conflicts

With server storage active, autosave, open, and delete use the API. Conditional revisions prevent overwriting newer changes from another browser. Conflicts remain visible; unsaved edits remain in the tab. Export your JSON, then use **Reload server version**, confirming that unsaved edits can be discarded.

If the session is lost, writes explicitly fail rather than silently switching storage. Reopening with an unreachable/unauthenticated server shows **Reopen your home on the server**, linking to Settings. Local storage stays distinct and labeled; creating a new home is not offered instead of sign-in. There is no automatic offline synchronization queue. The temporary project is not saved or shown as Casa Aurora while waiting; local storage can be opened explicitly. Empty storage stays empty until explicit creation/import. In server mode, disconnected HA does not automatically activate demo devices.

## Backups and data lifetime

**Download full backup** exports the active project/files as ZIP. **Restore ZIP backup** creates a fresh-ID copy without overwriting other projects. Plain JSON remains available for geometry, bindings, and previews; use ZIP for originals.

Default H2 lives in backend `data/` and survives restarts. JDBC PostgreSQL is configurable as described in the backend README; automated persistence tests use H2. After restarting, **sign in as server owner** to restore the last home, bindings, and HA connection without importing backups or repeating HA authorization. Keep the same DB and `SH3D_HA_URL`.

The login password remains a PBKDF2 hash. To reuse the refresh token, the backend encrypts it with AES-256-GCM rather than hashing it: sign-in derives a key using PBKDF2-HMAC-SHA256 and a dedicated salt, retained only in session RAM. Credentials/keys are excluded from home backups. Upgrading from the memory-only version requires **one HA authorization** because the old token was temporary. HA revocation requires reconnection; transient network errors preserve saved authorization. Server sign-in remains necessary after backend restarts because HTTP sessions are not persisted.

For LAN/production, use HTTPS, `SH3D_COOKIE_SECURE=true`, explicit origins, and the same hostname for frontend/API. A reverse proxy can forward `/api/`, including WebSocket upgrades, to the backend. No ports/proxies/firewall/HA installations are changed automatically.

## Separate verification

The frontend builds/tests without the backend; backend `./mvnw verify` needs no frontend sources. Optional frontend testing against an isolated real backend uses:

```bash
SH3D_TEST_BACKEND_URL=http://127.0.0.1:8099 npm run test:e2e:backend
```

Requires **empty test storage** allowing `http://127.0.0.1:4307`. The test creates a fake owner; never target personal storage. Standard suites use mocks/offline. Results: [VERIFICATION.md](VERIFICATION.md).

## Duplicate homes and restarts

To retrieve a home after restart/rebuild, use **Sign in to your server**. **Copy local projects to the server** is an initial transfer; **Restore ZIP backup** intentionally creates another copy. Neither is needed for ordinary sign-in.

Before the November 6, 2026 fix, initialization could autosave Casa Aurora before wizard choice, including while creating a personal home or waiting for the server. The initial project is now a temporary container excluded from writes; Casa Aurora is created only by choosing the demo. Sign-in/empty storage do not create homes; deleting the last home leaves storage empty.

Completed-transfer tracking is saved in this browser from this version onward. Earlier copies are not retroactively recognized by name: identically named homes may differ in geometry, bindings, files, and energy data. Existing copies are preserved for comparison. Clearing browser data or changing origin/server URL can lose the transfer record; open existing server storage instead of copying again.
