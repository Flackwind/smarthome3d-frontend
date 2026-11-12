# Verification

Implementation session of November 2, 2026. Reported results come from executed commands; simulated hardware is never presented as a real-device test.

Observed environment: Node 24.22.0 (nvm), npm 11.19.1, system Chrome, Docker Compose 5.6.1. Initially empty repository; no HA installation changed or containers started.

Locked dependencies: Angular 21.2.25, TypeScript 5.9.3, Three.js 0.183.2, PDF.js 5.7.284, Vitest 4.1.12, Playwright 1.64.1. Final production build: 326.55 kB initial, 88.23 kB builder-estimated transfer; Three.js/PDF are lazy chunks. These are not real-network/hardware loading-time measurements.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed: strict TypeScript and Angular templates |
| `npm test` | 26 tests passed, 6 files |
| `npm run build:dev` | Passed |
| `npm run build` | Passed, lazy 3D/PDF bundles |
| `npm run test:e2e` | 6 headless Chrome tests passed, desktop/mobile viewports |
| `SH3D_PRODUCTION=1 npm run test:e2e` | Passed: active service worker and offline project reopening |
| `docker compose -f infrastructure/docker/compose.yaml --profile web config --quiet` | Passed; no containers started |

Unit tests cover schema, serialization, migration, credential redaction, boundaries/shared walls, openings, coordinates, finite geometry, selection/cleanup, IndexedDB reopening, mapping, capabilities, mock commands, and HA protocol. Simulated transport checks authentication, concurrent snapshot/events, external updates, entity removal, reconnect/disconnect.

Six browser workflows verify:

1. Mock on/off, actual 3D-canvas pixel changes, save/restore after reload.
2. Wizard creation, drawing a 4 × 3 m room, wall properties, door undo/redo, light/mapping.
3. PNG import/calibration, invalid files, local PDF rasterization.
4. Navigation/filters at 390 × 844 without horizontal overflow.
5. Actual canvas raycast click selection and embedded GLB loading.
6. Room/climate-mode/floor selector consistency after creating a second floor.

Separate production testing activates the service worker, checks the manifest, disables browser networking, and reopens saved project/editor. Previews: [dashboard](images/dashboard.png), [mobile](images/devices-mobile.png).

Issues fixed: strict WebSocket transport typing, removed PDF.js option, SVG focus moving the first point, calibration precision, dynamic select initialization, and Vitest/Playwright suite separation. Dedicated ports 4307/4308 avoided occupied 4200; the existing service was untouched.

Limits: no real tokens/hardware available. Provider tests use fake credentials/simulated transport only. Software-rendered browser tests do not measure Android GPU performance. Build/Compose validation does not replace container/physical-phone PWA testing.

## Local Home Assistant installation — November 3, 2026

With explicit user authorization, HA Container 2026.10.4 was installed on the development PC. Official configuration validation passed; container running/healthy, Docker running/enabled at boot. Verified UI HTTP 200, onboarding awaiting the user, localhost:4300 CORS preflight, unauthenticated API HTTP 401, and real WebSocket `auth_required` handshake reporting 2026.10.4. `npm run typecheck`, `npm test` (26 tests), and `npm run build` passed again.

No owner/token was created. Authenticated states/commands and physical-device control still required post-onboarding testing. See [HOME_ASSISTANT_LOCAL.md](HOME_ASSISTANT_LOCAL.md).

## Floor-plan generation and virtual home — November 3, 2026

The user subsequently completed onboarding, added IKEA/Roborock, and confirmed connectivity. The assistant did not authenticate to devices. This extension started/modified no containers/system services; temporary test servers used ports 4307/4308.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed: strict TS, Angular templates, Web Worker |
| `npm test` | 34 tests passed, 7 files |
| `npm run build` | Passed; 330.29 kB initial, about 88.98 kB estimated transfer |
| `npm run test:e2e` | 8 passed; 3 affected workflows repeated after final map-material changes |
| `SH3D_PRODUCTION=1 npm run test:e2e -- --output=/tmp/smart-home-3d-pwa-tests` | Passed: fully offline PWA/floor-plan detection |

New unit tests cover shared-wall rooms, short text/transparent pixel exclusion, configurable gap closure, parallel-edge merging, split crossings, origin/rotation/scale, exclusions, and invalid data. Incomplete walls do not erase closed rooms; low-wall presentation does not mutate metrics. Outline resources are disposed exactly once.

Browser tests import PNG, run worker detection, review proposals/scale, generate/view a new 3D floor, undo/redo, and export. Export validates and retains the original 12 objects/6 bindings. Another workflow checks pin selection/state/reprojection, Map/Model switching, 390 × 844 virtual-home controls, and scrolling restored after Esc. Production reloads offline, imports PNG, and detects a room with the cached worker.

Browser previews: [mobile virtual home](images/virtual-home-mobile.png), [detection](images/floorplan-generation.png), [generated model](images/generated-model.png).

Limits: synthetic documents. User video was a visual reference, not an input floor plan. No actual technical home plan was provided/tested. At this stage detection was local/orthogonal, without OCR or semantic opening/furniture classification. Mobile checks use software-rendered Chrome, not physical-phone performance/gestures.

## Robot details and position — November 3, 2026

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed: strict TS, Angular templates, worker |
| `npm test` | 44 tests passed, 8 files |
| `npm run build` | Passed; 340.93 kB initial, about 91.61 kB estimated transfer |
| `npm run test:e2e` | 10 passed, including robot/dock grouping and position |
| `SH3D_PRODUCTION=1 npm run test:e2e -- --output=/tmp/smart-home-3d-pwa-robot-tests` | Passed: offline home/floor-plan generation in final build |

Pure tests cover exact registry identities, same-name robots in one area, separate linked dock, manual-binding fallback, detail categories, 0% battery, never-run buttons, unavailable entities, options/ranges/steps/times, scale/rotation/reflection, and provider/floor/map/boundary guards. Simulated HA checks registries/services, dock recognition, event metadata retention, position `return_response`, and absent capabilities when unsupported.

Browser demo groups 10 robot entities into one `Ripostiglio` (storage room) card. It executes an initially `unknown` routine, dock switch, and select. Search finds an inner sensor; Individual entities restores 10 cards. Mobile has no horizontal overflow.

Position tests read fake coordinates, save alignment through eight fields, observe actual 3D pin movement, verify manual cooldown, and advance time for automatic refresh. Simulated background prevents the next sample; visibility resumes monitoring. Export validates, keeps static robot coordinates, and includes calibration anchors only, not telemetry.

Previews: [desktop details](images/vacuum-detail-desktop.png), [mobile](images/vacuum-detail-mobile.png). Usage/sources: [ROBOT_VACUUM.md](ROBOT_VACUUM.md).

Limits: no real tokens/physical Saros 10R requests. Official source confirms action availability for the installed HA version; physical support, alignment accuracy, and cloud behavior require user testing from the connected browser. No host/container changes; temporary servers stopped afterward.

## Item 6: openings, slanted walls, sign-in, and room cleaning — November 3, 2026

This extension retained the static frontend, schema v1, and IndexedDB repository. No containers/HA/host services changed. Tests used ports 4307/4308 and isolated browsers.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed: strict TS, Angular templates, worker |
| `npm test` | 57 passed, 9 files |
| `npm run build` | Passed without warnings; 350.34 kB initial, 93.87 kB estimated transfer |
| `npm run test:e2e -- --output=/tmp/sh3d-point6-final-e2e` | 12 headless Chrome tests passed, no page errors |
| `SH3D_PRODUCTION=1 npm run test:e2e -- --output=/tmp/sh3d-point6-pwa-final` | Passed: offline PWA/worker and production OAuth callback |

Detection tests add non-45° rooms, rotated/reflected quadrilaterals, double-edge slanted walls, arbitrary intersections, collinear overlaps, metric opening conversion after splits, and junction/overlap rejection. Door gaps/double-line windows become proposals but no holes without confirmation. Browser imports a slanted plan, checks an initially unaccepted proposal, changes proposed door to window, generates a floor, and exports valid JSON while preserving the original.

OAuth tests use an authorization window and simulated HTTP/WebSocket. They check S256 challenge/verifier, wrong-window/state rejection, absence of credentials from localStorage/sessionStorage/all IndexedDB stores, logout revocation, and demo restart on reload. Pure tests cover deduplicated/scheduled renewal, malformed/rejected responses, late post-logout responses, and refreshed reconnect tokens. Production callback clears query, notifies opener before Angular bootstrap, and is absent from service-worker Cache API.

Robot tests open Room cleaning, verify start disabled without selection, select demo `Soggiorno`, and start from paused. State updates retain selection; Refresh rooms clears it. Simulated transport checks capability/service, actual mappings, one vacuum target, cleaning_area_id, and stale-selection rejection without global cleaning.

Negative OAuth testing was fixed to navigate using the authorization-window button: external Playwright navigation removed the opener and misrepresented the real callback. The corrected workflow passes. Documents/robots/HA remain simulated; no real credentials/Saros commands. Physical smartphone/GPU and real-plan accuracy remain outside automated checks. Backend/persistence across reloads were the next phase at that time.

Guides: [floor plans](FLOORPLAN_GENERATION.md), [sign-in](HOME_ASSISTANT_AUTH.md), [robots](ROBOT_VACUUM.md). Preview: [slanted walls/confirmed opening](images/oblique-opening-review.png).

## Independent backend and central storage — November 3, 2026

| Check | Result |
| --- | --- |
| Frontend `npm run typecheck` | Passed: strict TS, Angular templates, worker |
| Frontend `npm test` | 61 passed, 10 files |
| Frontend `npm run build` | Passed; 362.09 kB initial / 96.41 kB estimated transfer |
| Backend `mvnw verify` | 10 passed, 4 classes |
| Standard browser | 12 passed: demo/mock, robot, map, geometry, OAuth |
| Browser with isolated real backend | Passed: two browsers, fake account, PNG/GLB transfer, conflict, ZIP |
| Production/PWA | Passed: offline use, direct/server callback, query removal, no auth cache |
| Independently extracted frontend | `npm ci --offline`, typecheck, 61 tests, build passed without backend |
| Independently extracted backend | `mvnw verify` passed without frontend sources |

API tests use file-based H2/test data in /tmp as well as in-memory DBs. A new JDBC instance reopens project/original bytes; conditional requests reject stale writes/deletes. Import/restore assign fresh IDs; missing/rejected second files roll back even after project/first-file writes. CSRF, origins, one-time account setup, password hashing, reserved fields, fractional schema versions, and ZIP traversal are covered.

Simulated HA HTTP/WebSocket runs on a random port. Tests cover S256, wrong state/attempt consumption, server-side short-token renewal, cookies across requests, access_token redaction from states, blocked token creation, and socket closure/revocation on logout in that initial version. No user credentials/device requests.

Browser imports a local PNG/GLB home into a real test backend, checks ZIP bytes, reloads with session intact, and edits from a second browser. The first browser's write fails; explicit reload shows the update. Restore creates another home; logout returns to local originals. This optional test requires empty test storage, never personal data.

Robot-position testing needed a 1 ms fake-clock advance before minute jumps so Angular effects could install/cancel timers. Corrected workflow/full suite pass. Extracted checkout sources were hash-compared to originals. Frontend builds require no Java; backend builds require no npm/Angular.

No permanent services installed or containers/HA configuration changed. Temporary processes stopped. Real PostgreSQL, HTTPS/LAN deployment, hardware, family permissions, and collaborative synchronization remain outside these checks. At this stage HA sessions were RAM-only and needed reauthorization after backend restart; DB data persisted. See [BACKEND.md](BACKEND.md) for current behavior.

## Reorganization into frontend and backend — November 3, 2026

Original sources moved into sibling `frontend/`/`backend/`, each with Git. Exported copies/archives/command/script were removed. npm dependencies/cache/builds stay in frontend; Maven/output in backend. READMEs, contexts, and connection guide use the new directories.

| Check from new directories | Result |
| --- | --- |
| Frontend `npm run typecheck` | Passed: strict TS, Angular, worker |
| Frontend `npm test` | 61 passed, 10 files |
| Frontend `npm run build` | Passed; 362.09 kB initial / 96.41 kB estimated transfer |
| Standard browser | 12 passed; `/tmp/sh3d-restructure-browser` |
| Production/PWA | Passed, including offline reopen/callback; `/tmp/sh3d-restructure-pwa` |
| Backend Maven `verify` | 10 passed, 4 classes |
| Move integrity | Identical hashes for all 107 original application/test files |
| Documentation/Compose | Local links valid; web/HA volumes resolve under frontend |
| Independent repositories | Git recognizes distinct roots; HA/output excluded |

Sandbox restrictions initially blocked a random HTTP test port; the same command passed with required approval. Browser suites close temporary processes. Only paths/docs changed; application code, schema, and browser origin did not.

After checks, the user authorized a brief HA restart to update the volume. Compose recreated only homeassistant with `--no-deps --no-build --pull never`, retaining image 2026.10.4/data/permissions. Docker confirmed `frontend/infrastructure/docker/ha-config`, final **running / healthy**. The old-path temporary link was removed; frontend/backend are the only visible root directories. No permanent backend/new service installed.

## Owner profile and persistent HA authorization — November 5, 2026

At user request, HA refresh tokens became owner-associated AES-256-GCM ciphertext. Sign-in derives the key from the password using PBKDF2-HMAC-SHA256, a dedicated salt, and 600,000 iterations; neither key nor password persists. Profile remembers the last home. HTTP logout/expiration retain owner authorization; explicit HA unlink removes it for all browsers. Browser/logs/home JSON/ZIP contain no credentials; access tokens/PKCE stay in RAM. HomeProject v1 unchanged; two tables added without rewriting projects/assets.

| Check | Result |
| --- | --- |
| Frontend `npm run typecheck` | Passed: strict TS, Angular templates, worker |
| Frontend `npm test` | 62 passed, 10 files |
| Frontend `npm run build` | Passed; 363.92 kB initial / 96.82 kB estimated transfer |
| Backend `./mvnw verify` | 13 passed, 6 classes |
| Standard browser | 13 passed, including owner sign-in/home/HA restoration without another popup |
| Isolated real-backend browser | Passed: cross-browser home preference, expired session, transfer, original bytes, conflicts, ZIP |
| Production/PWA | Passed: offline cache/direct/server callbacks |
| Documentation/OpenAPI | Valid local links; profile/logout/disconnection semantics documented |

Restart integration starts/stops two real Spring applications against one temporary file H2. New sign-in finds last home/unlockable HA grant without repeating OAuth. Simulated HA HTTP checks original client ID/refresh rotation. 503 retains connection; 400 removes it without deleting homes. Wrong password/HA instance, altered ciphertext/metadata prevent unlocking. H2 is checked for plaintext fake passwords/tokens; ZIP excludes profile/salt/ciphertext/tokens.

Final checks also recover corrupted ciphertext through explicit owner reauthorization, replacing an unreadable grant without home changes. Authorization requires an active session key before exchanging codes. Bridge aborts late upstream connects after browser disconnect. Repeated `./mvnw verify`: 13 passed.

HTTP/WebSocket tests now check logout closes the browser bridge without revoking the owner grant, next sign-in restores HA, and explicit HA unlink revokes it. Crypto tests cover distinct nonces, wrong password, tampered metadata/ciphertext, and key-buffer clearing.

The simulated browser starts without a server session, shows a persistent notice, signs in, and opens the remembered home over a newer one. HA transport sends only `{type:"auth"}`; bindings/light control restore without another popup. Real-backend checks add existing file/conflict coverage. An initial test clicked Settings before asynchronous editor navigation after a second-home creation; waiting for URL and using the sign-in-banner link corrected it.

Browser results: `/tmp/sh3d-owner-profile-regression`, `/tmp/sh3d-owner-profile-api-browser-final`, `/tmp/sh3d-owner-profile-pwa`. Only temporary 4307/4308/8099/random ports, isolated browsers/fake credentials/DBs. All stopped; no containers/host services/personal DBs/real HA changed. Real PostgreSQL/hardware/password change-reset remain to test/implement. First activation requires backend restart and one HA authorization to create the persistent connection; later owner sign-in suffices.

## Electricity and gas — November 6, 2026

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed: TS, Angular templates, worker |
| `npm test` | 65 tests/11 files, including JSON compatibility, energy validation, units, H heat loss |
| `npm run build` | Passed: 388.71 kB initial / 104.42 kB transfer; lazy Energy page 44.02 / 11.17 kB |
| Backend `./mvnw verify` | 23 passed, 10 classes |
| Standard browser | 13 regressions passed; new Energy test passed separately after a test-selector fix |
| Isolated backend browser | Passed: saved tariffs, two DB actuals, charts/reload/history ZIP, original files/revisions/conflicts/two browsers |
| Production PWA | Passed: service worker/offline saved home |
| Mobile 390 × 844 | Settings, five-tab navigation, fake-data charts without horizontal overflow |
| Contract/guides | Valid OpenAPI, energy endpoints, ZIP v1/v2 documented |

Backend checks cover W/kW/standby integration, Wh/kWh deltas, resets, incompatible units, >5-minute gaps, whole-home meter priority, tariff/month boundaries, Italian holidays/Easter Monday, 23/25-hour days. Gas checks cover H/temperatures/efficiency/PCS, radiator weights, HA valves, °F/m³→Smc, missing sensors. A missing-temperature defect was fixed: exclude the interval rather than assuming zero.

Collector fake clock checks one snapshot/two homes, first-read baseline, second-sample persistence, no I/O without valid owner key, pause on closure, no reconstructed gaps. Simulated HA HTTP checks Bearer/GET, required array, rejected redirects, sanitized errors without remote bodies. Reader limits: 20 MB/20-second total deadline.

Authentication/CSRF, monthly replacement without double-counting, actual removal, project cascade, file-H2 history reopening, and invalid-history ZIP rollback are covered. ZIP v1 remains accepted; v2 retains energy without complete snapshots/credentials.

Reproducible isolated-browser screenshots use **fake monthly actuals only**: [desktop](images/energy-desktop.png), [mobile](images/energy-mobile.png). Browser backend used in-memory H2/disabled HA; sensor tests used simulated JSON/HTTP. No real device/personal DB/container/host changes. Temporary 4307/4308/8099 processes stopped. Real sensors, thermal-model accuracy, and PostgreSQL need target testing. To enable APIs, restart backend, reload frontend, configure sources, and explicitly enable Energy collection.

## Duplicate homes at startup and sign-in — November 6, 2026

Fixed Casa Aurora initialization/autosave before wizard choice. Initial state is now an empty, non-persistable temporary container distinct from an opened home. Empty storage remains empty; server sign-in/last-home deletion create no projects. Wizard offers direct sign-in/double-click protection. Disconnected server HA shows no entities rather than demo devices.

Initial transfer tracks completed copies per browser/backend URL. Repeating checks/skips existing targets without updating unopened revisions; deleted targets can transfer again. Network errors do not trigger fallback imports. JSON/ZIP imports remain explicit copies; same-name projects remain distinct. Earlier personal duplicates are preserved.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 67 passed/11 files; repeated transfer, adapter reopen, deleted target, network errors, preserved ETags |
| `npm run build` | Passed: 390.87 kB initial / 104.87 kB estimated transfer |
| Standard browser | 16 suite cases passed; changed wizard paths rechecked separately |
| Isolated real backend | Passed: second Copy transfers 0/skips 1, unchanged server count; storage/energy/backup/two-browser/conflict regressions |
| Production PWA | Passed: offline home reopen and uncached OAuth callback |

New cases check personal-home-only creation, sign-in with empty local storage, no mock entities when HA disconnects, no extra homes after reload, and last-home deletion. Double-click creation rechecked; direct sign-in avoids preliminary demo creation. Tests use isolated IndexedDB/browsers and simulated/disabled HA. Temporary in-memory H2 backend 8099 stopped; backend/API unchanged, no personal DB/container/host changes. Local transfer tracking does not retroactively identify old copies; guide distinguishes sign-in, initial transfer, and ZIP restore.

## Temperatures, language, and home devices — November 10, 2026

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed: TS, Angular templates, worker |
| `npm test` | 73 passed/12 files |
| `npm run build` | Passed: 445.73 kB initial / 121.75 kB estimated transfer |
| Backend `./mvnw verify` | 24 passed/10 classes |
| Standard browser | 19 unique cases verified: 18 full-suite, room drawing passed separately after tool-switch synchronization |
| Isolated real-backend browser | Passed: persistence, revisions, energy, two browsers, full backup |
| Production PWA | Passed: offline home/language preference after reload, local generation, uncached OAuth callback |
| Mobile 390 × 844 | Indoor/outdoor cards, source settings, English UI without horizontal overflow |
| Contract | Valid OpenAPI; optional schema-v1 dashboard |

Pure tests cover active-provider bindings to existing objects, duplicates/orphans/offline choices, physical-device/group/explicitly related measurement isolation, and no global choices for an empty device. Temperatures cover zero, °F/K, thermostat current value, weather attributes, missing units, unavailable states, priority/fallback. JSON preserves old-home compatibility and rejects invalid domains/flags. Translation tests preserve valid preference, whitespace, uncataloged names.

Simulated HA browser: only the bound light appears in Energy, excluding other homes' lights/readings; only its appropriate sensor is offered. Profiles save/reopen; new unbound homes have empty lists. Indoor/outdoor/weather settings persist on the fake server; 0 °C takes priority, `unavailable` switches live to weather 12.5 °C, disabled fallback gives —, weather-only sources work, reload/JSON retain settings. Language changes retain drafts/personal home-room-device names and translate navigation/controls/catalog/pins.

New backend API tests save sources, reject invalid updates without revision changes, retain settings in ZIP restore. Existing tests retain HA-profile/restart/auth/assets/conflicts/energy coverage. No new dependencies. Fake-data screenshots: [mobile temperatures](images/temperatures-mobile.png), [English mobile](images/dashboard-english-mobile.png); production dashboard updated.

Focused outputs: `/tmp/sh3d-dashboard-editor`, `/tmp/sh3d-dashboard-api-browser`, `/tmp/sh3d-dashboard-pwa-final`; standard screenshots in `test-results/`. Temporary 8099 H2-memory/HA-disabled backend and 4307/4308 frontends stopped. No private data/real HA/container/host changes. Users select physical sensors/local weather entities in their connected dashboard.

## Smartphone LAN startup — November 10, 2026

Added `start:lan` and Angular `/api/**` proxy with WebSocket to loopback backend. Phone uses HTTPS and the same storage address; SH3D_ORIGINS remains explicit. No personal services started/changed, backend changes, or new dependencies.

- `npm run typecheck`, `npm test` (73/12 files), `npm run build` passed; unchanged 445.73 kB initial / 121.75 kB estimated transfer.
- Temporary `/tmp/sh3d-lan-smoke.mjs` copied actual proxy configuration, changing only target to a random-port fake HTTP server. Angular HTTPS on loopback 4310, isolated Chrome accepting development certificate, viewport 390 × 844. Secure context/randomUUID, demo/3D, HTTPS API, HttpOnly /api cookie, preserved CSRF/Origin, WSS echo, no page errors/overflow verified.
- HTTPS frontend/browser/fake backend stopped; temporary proxy removed. No personal backend/HA requests. Physical-phone access/certificate acceptance remain user checks; see [smartphone guide](SMARTPHONE.md).

## Smartphone connection: rejected origin and suggested URL — November 10, 2026

Read-only checks of user-started processes: frontend 0.0.0.0:4200, backend 127.0.0.1:8090, Wi-Fi 192.168.1.30. Proxy session GET without Origin returned 200 JSON; phone Origin returned 403; direct backend/same-origin login preflight returned 403. Only working directory/non-secret environment checked: no SH3D_ORIGINS, HA localhost:8123, default DB. No session bodies/tokens/passwords/projects printed. Personal processes not restarted/modified; guide/README provide explicit-origin restart instructions.

Frontend now suggests page origin on HTTPS, retains HTTP-development 8090/saved preferences. Dedicated `Invalid CORS request` message differs from session/CSRF 403; non-JSON remote errors are hidden. New tests cover HTTPS/LAN, production same-origin, HTTP, IPv6, and 403/502 without invalidating login. Typecheck, `npm test` (**75/12 files**), and build passed: 446.28 kB initial / 121.94 kB estimated transfer. Backend/API unchanged. Final phone testing needs a manual restart with updated SH3D_ORIGINS; no data/firewall/container/host changes.

## First GitHub push preparation — November 10, 2026

`npm run typecheck`, `npm test` (75/12 files), and `npm run build` passed; 446.28 kB initial / 121.94 kB estimated transfer. Backend verify: 24/10 classes passed. No application changes; no extra browser suite needed for ignore rules alone.

Commit candidates checked with `git ls-files --others --exclude-standard`: HA/DB/cache/build/report data excluded, no recognizable private keys/GitHub tokens/JWTs/AWS access keys. The scan did not read private ignored files or certify the absence of personal documentation references. Git check-ignore confirmed .env/.env.production/config/.env.test excluded in both; .env.example/config/.env.production.example versionable. Docker ignores aligned.

Both main branches had no commits/remotes/index; user.name still needed before first commit. No git add/commit, author/remote change, or push performed. Shared GITHUB.md documents manual steps; visibility is the user's choice.

## English documentation — November 12, 2026

Translated all 29 Markdown documents, 96 OpenAPI summary/description occurrences, and public HA example comments. Technical constraints, original dated results, external references, and executable commands were preserved; only human-readable placeholders/prompts changed. English UI labels match the catalog, and translated section anchors are valid. Checked 93 local links/images, 31 Bash blocks, both Compose configurations, and exact OpenAPI structural equality after excluding descriptions/summaries. No application changes, real HA/DB access, or container/host-service changes. Frontend typecheck, 75 tests/12 files, and production build passed (446.28 kB initial / 121.94 kB estimated transfer); backend verify passed 24 tests/10 classes. No extra browser suite was required for documentation-only changes.
