# Install Home Assistant Container on Linux

Home Assistant manages device integrations; Smart Home 3D uses its entities in your home. HA, backend, and frontend can share one PC, or you can connect an existing HA instance. For the full workflow, see [Smart Home 3D installation](INSTALLATION.md).

**If HA is already installed, skip to the connection section below.** Do not overwrite its configuration or start a second instance on the same port.

## Requirements

- A 64-bit Linux machine, connected to your devices' network and powered on when you need home automation.
- Docker Engine **23 or later** and the Docker Compose plugin, working for your user. Follow official instructions for [Ubuntu](https://docs.docker.com/engine/install/ubuntu/) or [Debian](https://docs.docker.com/engine/install/debian/), as appropriate.
- TCP port **8123** available for this new installation.

This procedure uses **Home Assistant Container** with Linux host networking. Docker Desktop is not supported by the official HA Container procedure. Container does not include the Supervisor or Home Assistant OS apps/add-ons; for those, use HA OS following the [official installation guide](https://www.home-assistant.io/installation/linux/).

Check in a terminal:

```bash
docker --version
docker compose version
docker ps
```

All subsequent commands run from **frontend/**, containing `package.json`. Node.js/Java are not required to install HA alone.

## 1. Prepare files for a new installation

The project includes Compose and initial configuration without credentials. Actual data lives in **infrastructure/docker/ha-config/**, excluded from Git and frontend Docker images.

Prepare `.env` without replacing an existing file:

```bash
if [ ! -e infrastructure/docker/.env ]; then
  cp infrastructure/docker/.env.example infrastructure/docker/.env
fi
```

Edit `.env`. `HOME_ASSISTANT_VERSION` selects an exact official tag: the example pins **2026.10.4** to make the version explicit rather than following the latest release. `SMART_HOME_BIND` and `SMART_HOME_PORT` affect only the optional Nginx frontend.

The following block creates initial files **only if the data directory is absent**. If it exists, it prints a message without changing anything: check which installation uses it before continuing.

```bash
if [ -e infrastructure/docker/ha-config ]; then
  echo "HA directory already exists: check the existing installation before continuing."
else
  mkdir -m 700 infrastructure/docker/ha-config
  (
    umask 077
    cp infrastructure/docker/home-assistant-configuration.local.example.yaml infrastructure/docker/ha-config/configuration.yaml
    printf '[]\n' > infrastructure/docker/ha-config/automations.yaml
    printf '{}\n' > infrastructure/docker/ha-config/scripts.yaml
    printf '[]\n' > infrastructure/docker/ha-config/scenes.yaml
  )
fi
```

Initial defaults are `Europe/Rome`, metric units, country `IT`, and currency `EUR`: adapt them before startup. The container timezone is the Compose `TZ` field. Automation, script, and scene files are required because `configuration.yaml` includes them.

## 2. Validate and start HA

Check existing installations and port usage first. `config --quiet` validates Compose without starting services:

```bash
docker compose --env-file infrastructure/docker/.env -f infrastructure/docker/compose.yaml config --quiet
```

If correct, start HA only:

```bash
docker compose --env-file infrastructure/docker/.env -f infrastructure/docker/compose.yaml up -d homeassistant
docker compose --env-file infrastructure/docker/.env -f infrastructure/docker/compose.yaml ps homeassistant
docker compose --env-file infrastructure/docker/.env -f infrastructure/docker/compose.yaml logs --tail 50 homeassistant
```

The first start downloads the image and prepares HA; allow a few minutes. Health becomes `healthy` when the HTTP page responds. If `unhealthy` appears or the service keeps restarting, read logs before modifying or deleting data.

Compose mounts the private directory at `/config`, uses host networking, and makes HA available at **http://127.0.0.1:8123**. On the LAN use `http://SERVER_IP:8123`, replacing the placeholder. With host networking, the port belongs directly to the host; `SMART_HOME_PORT` does not change HA's port.

USB/Bluetooth access and privileged mode are not preconfigured for LAN integrations. For Zigbee, Z-Wave, or Bluetooth adapters, configure hardware following HA documentation; the included Compose alone does not enable it.

## 3. Onboarding and integrations

1. Open **http://127.0.0.1:8123** on the server PC.
2. Create the HA owner with your own username/password.
3. Set location, timezone, and preferences; location is also used for weather information.
4. Open **Settings → Devices & services** and add integrations. Enter gateway/vendor account credentials in HA.
5. Test at least one device in HA before connecting Smart Home 3D.

The HA account and Smart Home 3D backend owner are separate accounts. Neither has predefined credentials in this project.

## 4. Connect Smart Home 3D

### With backend: persistent profile

Recommended to restore homes/devices after restarting. Return to [installation step 3](INSTALLATION.md#3-start-the-backend): configure `SH3D_HA_URL`, sign in as the server owner, and choose **Sign in to Home Assistant through the server**.

The HA URL must be reachable by the backend and the browser opening authorization. With a Docker backend, use a LAN address accessible to both: container `localhost` does not mean HA on the host. The backend stores the refresh token encrypted in the profile; after restarting, server sign-in is enough. Keep the same HA URL on later starts.

### Without backend: temporary direct connection

Start the frontend with `npm start` and open **http://127.0.0.1:4200**. Select **English** in the language selector. In home automation settings, select HA, enter `http://127.0.0.1:8123`, and choose **Sign in with Home Assistant**. Authorize in the HA window.

Credentials stay in browser RAM: reloading/closing the page requires signing in again. Saved local homes/bindings remain. Manual tokens are an advanced temporary alternative: see [authorization](HOME_ASSISTANT_AUTH.md).

Initial CORS configuration allows `localhost`/`127.0.0.1` on frontend ports 4200, 4300, and 8080. For another origin, add its exact value to HA HTTP configuration without duplicating the `http:` block. This controls direct browser → HA access; `SH3D_ORIGINS` instead controls requests to the Smart Home 3D backend. A direct connection from HTTPS requires HA HTTPS/WSS; backend mode connects to HA on the server. Reference: [HA HTTP and CORS](https://www.home-assistant.io/integrations/http/).

## Management and restart

Run these separate operations as needed, always from `frontend/`:

| Operation | Command |
| --- | --- |
| Status | `docker compose --env-file infrastructure/docker/.env -f infrastructure/docker/compose.yaml ps homeassistant` |
| Recent logs | `docker compose --env-file infrastructure/docker/.env -f infrastructure/docker/compose.yaml logs --tail 50 homeassistant` |
| Stop | `docker compose --env-file infrastructure/docker/.env -f infrastructure/docker/compose.yaml stop homeassistant` |
| Resume | `docker compose --env-file infrastructure/docker/.env -f infrastructure/docker/compose.yaml up -d homeassistant` |
| Restart after YAML changes | `docker compose --env-file infrastructure/docker/.env -f infrastructure/docker/compose.yaml restart homeassistant` |

`unless-stopped` resumes a previously started container when Docker restarts, unless explicitly stopped. The machine and Docker must stay running for HA to work. Closing the frontend does not stop HA.

## Backups and updates

Create a backup from the HA UI and store it off the machine too. For a manual `ha-config/` copy, stop HA first and preserve all files, including hidden files and permissions. Data contains credentials and personal information.

To update, read release notes, verify the backup, and choose a new official tag in `.env`, then run:

```bash
docker compose --env-file infrastructure/docker/.env -f infrastructure/docker/compose.yaml pull homeassistant
docker compose --env-file infrastructure/docker/.env -f infrastructure/docker/compose.yaml up -d homeassistant
```

Check status, logs, and integrations. A simple `restart` does not apply a new image. Keep the data path: deleting `ha-config/` deletes HA configuration/data. A Smart Home 3D ZIP backs up the home and does not replace an HA backup.

## If the page does not open

- Allow initial preparation to finish and check `ps`/`logs` above.
- Check that another service is not using port 8123.
- From another device, use the server IP rather than `localhost`; check the same network and firewall access to 8123.
- If logs show volume permission errors, check ownership/permissions on the private directory; do not make it world-readable.

This guide does not configure Internet access. For HA OS, additional hardware, and other methods, see [official HA installation documentation](https://www.home-assistant.io/installation/).
