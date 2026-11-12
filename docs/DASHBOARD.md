# Temperature and interface language

The **Italiano / English** selector is at the top right. It immediately changes menus, forms, messages, and controls without reloading or losing in-progress fields. Homes, rooms, objects, and HA names retain user-provided text. Remote messages absent from the catalog keep their source language. Public preference `sh3d-language` is saved in this browser/origin's localStorage; it contains no credentials and is excluded from home backups. If storage is unavailable, the choice still works for the current tab.

The dashboard shows **Indoor temperature** and **Outdoor temperature** cards. Use either gear button to open **Home temperatures**:

- **Indoor temperature sensor:** HA temperature sensor or thermostat; thermostats supply current temperature, not setpoint.
- **Outdoor temperature sensor:** optional HA thermometer.
- **Local Home Assistant weather:** select the configured `weather.*` entity for your location.
- **Use HA weather when the outdoor thermometer is missing or unavailable:** enables fallback even without an outdoor thermometer.

The outdoor thermometer always takes priority, including **0 °C**. When no valid reading exists and fallback is enabled, the selected weather entity supplies temperature. The card shows **HA weather** and the actual source name. The app does not infer a location from another entity or contact weather services outside HA's integration. Configure a weather integration in HA first if no weather entities exist.

Readings follow active-provider updates and display in °C, converting explicit °F/K units. Missing sources/units and unavailable states display **—**, not an assumed zero. Conditions such as `sunny` are not parsed as numbers: the app reads HA `temperature`/`temperature_unit` attributes. See the [HA weather entity contract](https://www.home-assistant.io/integrations/weather/).

Choices belong to the home (optional JSON-v1 `dashboard`) and follow autosave, local/server storage, JSON import/export, and ZIP backup/restore. Changing homes changes sources. Removing an HA sensor retains its selected ID as unavailable so it can recover when restored. Older projects suggest only an already-bound indoor sensor; outdoor sources require explicit choice. These preferences are independent of **Energy → Heating** thermal-model sources.

For electricity profiles, **Energy → Devices** lists only entities bound to existing objects in the open home. Measurement sensors/whole-home meters are limited to explicit relationships or HA device/group metadata, never guessed from names/rooms; without bindings the list stays empty. Existing profiles are not deleted when a source becomes unavailable.

Examples use fake data only: [mobile temperatures](images/temperatures-mobile.png), [English mobile interface](images/dashboard-english-mobile.png).
