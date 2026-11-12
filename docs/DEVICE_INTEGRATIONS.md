# Integrations and security

Configure devices in Home Assistant first. Smart Home 3D does not implement vendor APIs or invent entity IDs.

| Device | Integration path to verify in HA |
| --- | --- |
| IKEA TRÅDFRI gateway, light, LED driver/bar | IKEA TRÅDFRI integration; enter gateway key only in HA |
| Xiaomi Mi Smart LED Bulb Essential | Identify actual model code/firmware; compare Xiaomi Home/miio and Yeelight support; verify exposed entities |
| Roborock Saros 10R | Roborock integration and account/app required by its documentation; check your HA version's entities/capabilities |
| tado° X, Matter, Thread | Uses climate/sensor domains; HA handles commissioning and Thread Border Router |
| Google Home | Complementary: states arrive through HA when the device is integrated and HA receives updates |

A Xiaomi bulb's integration cannot be determined from its marketing name alone. The physical model/entities were unavailable during implementation. No user account/device was contacted.

Commands follow per-entity capabilities. Lights use `supported_color_modes` for brightness/RGB/color temperature. Vacuums use `supported_features`: start 8192, pause 4, return_home 16, clean_area 16384 (also requiring declared service and HA mappings). Climate uses target temperature 1, min/max limits, and `hvac_modes`. Sensors/binary sensors are read-only. `unavailable` disables controls; `unknown` also disables them except buttons/selects/numbers/times that may not yet have a state. Switches expose on/off only.

Room cleaning through mapped HA areas is implemented; arbitrary zones/native paths are not. Device support does not imply a universal API. Battery comes from the vacuum attribute when present, otherwise an explicitly related sensor. Devices/Areas/Floors registries help grouping/suggestions without creating name-only bindings.

## Browser → HA connection

Long-lived tokens inherit the creating HA user's permissions. They are transmitted in WebSocket authentication and kept in provider memory, never in URLs, logs, preferences, JSON, or assets. The password field clears after submission. Disconnect/reload to clear the session. Direct local mode returns to the mock provider on reload.

Local HTTP/WS does not encrypt traffic. Remote access/Android PWAs need HTTPS/WSS with trusted certificates and appropriate network/access setup. An HTTPS frontend cannot connect to `ws://`; the app reports this. Reverse proxies must forward WebSocket upgrades. No Internet ports are opened. Do not fix access issues with unrestricted trusted proxies or wildcard CORS.

`http.cors_allowed_origins` applies to browser REST requests and depends on actual origins. States/commands use WebSocket; OAuth uses HTTP POST for token exchange, renewal, and revocation. Merge the YAML example deliberately into existing configuration without overwriting it; it is not applied automatically.

[OAuth with PKCE](HOME_ASSISTANT_AUTH.md) keeps/renews direct sessions in memory. In server mode, the backend saves an encrypted owner-profile refresh token and unlocks it at sign-in, restoring the connection after restarts. Tokens/keys do not reach the browser or home backups. Family accounts/permissions remain future work. Nginx sets CSP/basic headers; `connect-src` permits protocols needed by configurable HA instances. Fixed-HA deployments can restrict this directive further.

## Official sources consulted

- [HA WebSocket protocol](https://developers.home-assistant.io/docs/api/websocket/).
- [IKEA TRÅDFRI](https://www.home-assistant.io/integrations/tradfri/).
- [Xiaomi Home/miio](https://www.home-assistant.io/integrations/xiaomi_miio/) and [Yeelight](https://www.home-assistant.io/integrations/yeelight/).
- [Roborock](https://www.home-assistant.io/integrations/roborock/).
- [Vacuum definitions in HA source](https://github.com/home-assistant/core/blob/dev/homeassistant/components/vacuum/const.py).

Integration checks are documentation-based; confirm actual support/services through your installation's entities.
