# Test Smart Home 3D from a smartphone

Use this procedure for testing on the same Wi-Fi after [initial PC setup](INSTALLATION.md). It uses the native backend at `127.0.0.1:8090` and the frontend HTTPS proxy. For continuous production use, see the installation guide's Docker/HTTPS section.

## 1. Find the PC address

Connect phone/PC to the same main network, without client isolation. On Linux:

```bash
ip -4 -brief address show scope global
```

Use the IPv4 address of the Wi-Fi/Ethernet interface connected to your router, excluding Docker/VPN interfaces. **SERVER_IP** below means this address: replace it in fields/commands. DHCP can change it; a router DHCP reservation makes it stable.

## 2. Allow the origin in the backend

Stop the previous backend with Ctrl+C in its terminal. Restart from the **same backend/** directory, preserving DB/HA settings and adding the frontend HTTPS origin.

This command prompts for the PC IP and uses it in the allowlist. The example assumes HA at `http://127.0.0.1:8123`; retain your existing HA URL or custom DB settings if different.

```bash
read -r -p "PC LAN IP: " SH3D_LAN_IP
SH3D_ORIGINS="https://${SH3D_LAN_IP}:4200,http://localhost:4200,http://127.0.0.1:4200" \
SH3D_HA_URL=http://127.0.0.1:8123 \
./mvnw spring-boot:run
```

Without HA, omit the `SH3D_HA_URL` line. Variable changes require restarting the process. An origin is scheme + host + port, without a path or trailing slash.

## 3. Start the HTTPS frontend

Stop the previous frontend with Ctrl+C. Inside **frontend/**:

```bash
npm run start:lan
```

On the phone, open **https://SERVER_IP:4200** using the address above. Angular generates a development certificate; the browser warns that it is untrusted. For this test on your own PC, you can continue if the browser allows it. Otherwise use a local certificate trusted by the phone; the command accepts `--ssl-cert` and `--ssl-key`.

`npm start` listens only on the PC. `start:lan` listens on the network over HTTPS because functions such as `crypto.randomUUID()` require a secure context, unavailable over HTTP at a normal LAN IP. References: [Angular serve/SSL](https://angular.dev/cli/serve), [MDN randomUUID](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID).

## 4. Open server storage on the phone

Select **English** in the language selector. Under **Settings → Storage and server → Backend URL**, enter **the page's own address: https://SERVER_IP:4200**. Choose **Check server** and sign in as the existing owner. Phone browser local storage is separate; server sign-in retrieves homes from the shared database.

`proxy.lan.json` forwards `/api/**`, including HA WebSockets, to the PC backend at `http://127.0.0.1:8090`. Do not use `localhost` on the phone or `https://SERVER_IP:8090`: backend port 8090 is local HTTP; HTTPS goes through frontend port 4200. The backend can continue listening on loopback.

On HTTPS, the field suggests the page origin, but a saved URL takes precedence: correct it if necessary. If changing the backend port, update the proxy target and restart the frontend; if changing frontend IP/port, update the allowed origin and phone URL.

If HA uses `127.0.0.1`/`localhost`, authorize HA initially from the PC browser. Owner sign-in on the phone can then restore the saved connection. To authorize directly from a phone, HA's URL must be reachable by both phone/backend; changing `SH3D_HA_URL` requires new authorization.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Page does not open | Frontend running, correct IP, same network, firewall allows LAN TCP 4200, no Wi-Fi client isolation |
| Page opens, 403 / `Invalid CORS request` | Exact HTTPS origin in `SH3D_ORIGINS`, backend actually restarted after changing it |
| Server unreachable or proxy 502 | Backend running at `127.0.0.1:8090`, server URL matches the page |
| Session expired | Reload/sign in again; backend restarts require sign-in |
| Home missing | Open **Server storage** as the same owner; do not repeatedly restore backups to retrieve it |

The command does not change firewall/router/system services. This is browser testing; PWA installation requires a production build and trusted HTTPS.
