# Install Smart Home 3D on your machine

This guide takes you from downloading the repositories to saving your first home on the server. The main workflow uses **64-bit Linux**, Node.js for the frontend, and Java for the backend. Home Assistant can be an existing installation or a new Docker container. All three can run on the same PC.

| Component | Purpose | Required? |
| --- | --- | --- |
| Frontend | Browser interface, editor, and 3D view | Yes |
| Backend | Shared storage, files, energy history, and persistent HA connection in the owner profile | Recommended; demo and local storage work without it |
| Home Assistant (HA) | Integrations and control of real devices | For your own home automation |

To try the interface only, follow steps 1 and 4 and choose **Demo**. To share homes and bindings across devices, follow the full workflow.

## 1. Download the repositories and install prerequisites

Download the frontend and backend repositories from GitHub using **Code → Download ZIP** or Git. Extract/rename the directories as follows, without nesting one repository inside the other:

```text
SmartHome3D/
├── frontend/    contains package.json
└── backend/     contains pom.xml and mvnw
```

The shared directory does not need a third repository. To clone with Git, first replace both URL placeholders with the repositories you are downloading:

```bash
mkdir SmartHome3D
cd SmartHome3D
git clone FRONTEND_REPOSITORY_URL frontend
git clone BACKEND_REPOSITORY_URL backend
```

Install these tools using their maintainers' instructions:

- **Node.js 24 LTS and npm**, to install/build the frontend: [Node.js downloads](https://nodejs.org/en/download). If you already use nvm, run `nvm install` and `nvm use` inside `frontend/`.
- **Java JDK 21 or later**, for the backend: for example, [Eclipse Temurin](https://adoptium.net/installation/). The included `mvnw` launcher uses installed Maven or downloads it.
- **Docker Engine and the Docker Compose plugin**, to install HA or deploy the app with Docker: [Linux installation](https://docs.docker.com/engine/install/).
- A current browser with **WebGL2** on the device opening the interface.

Check in a terminal:

```bash
node --version
npm --version
java -version
# Only if using Docker:
docker --version
docker compose version
```

The initial dependency download requires Internet access. If Docker reports socket permission errors, complete the user setup in the Docker guide.

## 2. Prepare Home Assistant

**If you already have HA**, keep that installation and its address. Do not start another instance on the same port.

**If starting from scratch**, follow [Home Assistant Container installation and onboarding](HOME_ASSISTANT_LOCAL.md), then return here. It creates a private data directory and an HA instance on port **8123**. The project includes Compose files, without predefined accounts or devices.

Open HA in a browser, complete onboarding, and add at least one integration under **Settings → Devices & services**. Verify that the device works in HA before continuing.

## 3. Start the backend

Open a terminal in **backend/**. For HA installed on this PC:

```bash
SH3D_HA_URL=http://127.0.0.1:8123 ./mvnw spring-boot:run
```

If HA is on another machine, replace the URL with its address. To start with storage only, run `./mvnw spring-boot:run` without the variable. After a ZIP download, if `./mvnw` is not executable, run `chmod u+x mvnw`.

Wait for the Spring Boot startup message. The backend listens at **http://127.0.0.1:8090**; open `http://127.0.0.1:8090/health` to check its response. It does not serve the web interface; that starts in the next step. Leave this terminal open.

The variable applies to that command: include it on later starts too. The database is created in **backend/data/**. Always start from this directory and keep the same DB/HA settings to retrieve your data.

## 4. Start the frontend

Open **a second terminal** in **frontend/**:

```bash
npm ci
npm start
```

Open **http://127.0.0.1:4200** and leave the terminal open. Select **English** in the top-right language selector to match this guide's button labels. Run `npm ci` on first download and when dependencies change; normal restarts need only `npm start`.

Use `127.0.0.1` for both the page and backend URL. Mixing `localhost` and `127.0.0.1` can prevent session cookies from working. `npm start` runs the interface only; the backend and HA are separate processes.

## 5. Create the owner and connect your home

1. Choose **Sign in to your server** in the wizard. If you already completed it, open **Settings → Storage and server**.
2. Enter **http://127.0.0.1:8090** as the backend URL and choose **Check server**.
3. On first access, create the owner with a username and a password of at least **12 characters**. This account is separate from your HA account. On subsequent visits, sign in as the same owner.
4. With **Server storage** active, create a home or open an existing one. If you started locally, use **Copy local projects to the server** once and open the server copy.
5. In home automation settings, choose **Sign in to Home Assistant through the server** and authorize in the HA window. If unavailable, check that the backend started with `SH3D_HA_URL`.
6. Add/import a floor, place objects, and bind entities through the mapping or devices page. Connecting HA makes entities available; binding them to your home's objects is explicit.

Check that the app indicates **Server storage** and lists the saved project. Change a name, wait for saving, and reload: the change should remain. You can also stop the backend with Ctrl+C, restart with the same command, and sign in again. You do not need to import a backup after each restart.

The profile retains the last home and encrypted HA authorization. After a backend restart, sign in again to unlock it; energy collection also requires a valid owner session. **Sign out of the server** keeps the connection; **Unlink Home Assistant from your profile** removes it. No HA token file is required.

## Access from a phone

The preceding setup listens only on the PC. For testing on the same Wi-Fi, follow the [smartphone guide](SMARTPHONE.md): use `npm run start:lan`, allow the HTTPS origin in the backend, and use the page's own URL as the phone's server URL. The frontend proxy forwards API and WebSocket requests to the local backend.

`localhost` on a phone means the phone itself. If HA uses `127.0.0.1` or `localhost`, perform initial HA authorization from the PC; signing in to the server profile can then restore the connection on the phone.

## Docker deployment after the first test

This is an alternative to starting with Node/Java, intended for a Linux machine that stays powered on. The repositories deploy independently. No single command automatically starts the whole system.

**Choose your data location before switching:** the native backend uses `backend/data/`; Docker uses a named volume. Switching to Docker does not import the native database. Use ZIP backups to transfer homes/files; they do not transfer accounts or HA authorization, which must be set up in the new storage.

### Backend in Docker

Stop any native backend using port 8090. Inside **backend/**, copy `.env.example` to `.env` only if absent:

```bash
if [ ! -e .env ]; then cp .env.example .env; fi
```

Edit `.env`. To use HA, set `SH3D_HA_URL` to its LAN address, for example `http://SERVER_IP:8123`, replacing the placeholder. **The same URL must be reachable from both the container and the browser authorizing HA.** Inside a container, `localhost` means that container; `host.docker.internal` can reach the host with the included configuration, but normally does not resolve in the browser. Leave the URL empty for storage only.

```bash
docker compose --env-file .env -f compose.example.yaml config --quiet
docker compose --env-file .env -f compose.example.yaml up -d --build api
docker compose --env-file .env -f compose.example.yaml logs --tail 50 api
```

The API is published at **127.0.0.1:8090**, with data in the Compose project's `home-data` volume. Keep the directory/Compose project name stable to reuse the same volume. Do not delete the data volume during updates.

### Compiled frontend with Nginx

Inside **frontend/**, build the static files and prepare the environment file if absent:

```bash
npm ci
npm run build
if [ ! -e infrastructure/docker/.env ]; then
  cp infrastructure/docker/.env.example infrastructure/docker/.env
fi
docker compose --env-file infrastructure/docker/.env -f infrastructure/docker/compose.yaml --profile web config --quiet
docker compose --env-file infrastructure/docker/.env -f infrastructure/docker/compose.yaml --profile web up -d web
```

Open **http://127.0.0.1:8080** and use **http://127.0.0.1:8090** as the backend URL. The backend environment example also allows this origin. With the native backend, add `http://127.0.0.1:8080` to `SH3D_ORIGINS` and restart it. Browser storage on ports 4200/8080 is separate; sign in to the server to retrieve the same homes.

Nginx reads `dist/web/browser`; rebuild with `npm run build` after each frontend update. Node is needed for building; rendering runs in the browser. Alternatively, build a self-contained frontend image with the [included Dockerfile](../infrastructure/docker/Dockerfile):

```bash
docker build -f infrastructure/docker/Dockerfile -t smart-home-3d-web .
docker run -d --name smart-home-3d-web --restart unless-stopped -p 127.0.0.1:8080:80 smart-home-3d-web
```

Choose **one** frontend method: both use port 8080. The self-contained image includes the build; updating requires rebuilding it and recreating the container. Initial image builds require downloads and compilation.

### Continuous LAN use with HTTPS

Included Nginx serves files over HTTP on loopback; it does not include TLS or an API proxy. For continuous access from other devices, configure an HTTPS reverse proxy with a certificate trusted by clients. Forward `/api/` to `127.0.0.1:8090`, preserving paths and WebSockets, and other paths to `127.0.0.1:8080`.

Set backend `SH3D_ORIGINS` to the exact frontend origin, for example `https://casa.example.com`, and `SH3D_COOKIE_SECURE=true`. Use that origin as the browser's backend URL too. The hostname is an example: you need a resolvable hostname and its certificate. See official Nginx documentation for [HTTPS](https://nginx.org/en/docs/http/configuring_https_servers.html) and [WebSockets](https://nginx.org/en/docs/http/websocket.html).

`start:lan` is for testing; an installable PWA requires a production build and trusted HTTPS. Internet access, DNS, certificates, firewall rules, and system startup depend on the host and are not configured by the project. Docker's `restart: unless-stopped` resumes previously started services when Docker starts, unless explicitly stopped; Docker must start with the system.

## Backups and shutting down the PC

| Data | Location | How to preserve it |
| --- | --- | --- |
| Homes, bindings, PDFs/GLBs, server energy history | `backend/data/` or the backend Docker volume | ZIP per home; administrative DB backup for the entire installation |
| Owner and encrypted HA connection | Same backend database | Full DB backup; excluded from home ZIPs |
| HA integrations, accounts, history | `frontend/infrastructure/docker/ha-config/` with the included Compose | HA UI backup, also stored off the machine |
| Locally stored homes | Browser data, separate per address/port | Transfer to server or back up the home |
| Startup configuration | `.env` files and backend variables | Private copy of DB/HA/origin settings |

To copy H2, stop the backend first and copy the entire data directory; a running DB requires database backup tools. Full DB/HA copies are private and must not be published on GitHub. Keep backups off the server's disk too.

Stopping and rebuilding do not delete persistent data. After powering on, restart components and sign in as the owner. Sessions, access tokens, and live readings in RAM are recreated; gaps in energy collection are not reconstructed. Keep your owner password: password reset is not currently implemented.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `npm`/`java` missing or incompatible version | Recheck prerequisites and reopen the terminal after installation |
| Port already in use | Stop the previous instance or choose a free port; update URLs and origins |
| Page opens, server unreachable | Check `/health`, backend URL/logs; on phones follow HTTPS/proxy setup |
| HTTP 403 / `Invalid CORS request` | Exact origin in `SH3D_ORIGINS`, then restart; origin = scheme + host + port, without a path or trailing slash |
| Home seems new after restart | Sign in to the same server storage; check DB directory/volume. Do not repeatedly import the backup |
| HA works but app has no entities | Check `SH3D_HA_URL`, authorization, and provider; then bind entities to objects |
| HA popup unreachable with Docker | Use an HA URL reachable from container and browser; avoid `localhost` and Docker-only browser aliases |
| Change appears on PC but not phone | Check **Server storage**, same home, and save status; reopen to refresh |

When reporting a problem, include OS, versions, startup command, and error, removing credentials/private data from logs.

## Feature guides

- [Home Assistant authorization and local mode](HOME_ASSISTANT_AUTH.md).
- [Server storage, transfers, conflicts, backups](BACKEND.md).
- [Floor plan → 3D model and review](FLOORPLAN_GENERATION.md).
- [Robot vacuums and map alignment](ROBOT_VACUUM.md).
- [Dashboard, temperatures, language](DASHBOARD.md).
- [Tariffs, measurements, energy estimates](ENERGY.md).
- [Integrations and device mapping](DEVICE_INTEGRATIONS.md).
- [Verification and known limitations](VERIFICATION.md).

Compose files are syntax-checked. This does not certify complete Docker builds from clean clones or every integration on the target machine: verify first save, sign-in, and backup in your installation.
