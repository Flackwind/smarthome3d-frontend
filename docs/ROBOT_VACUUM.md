# Robot vacuums: grouped details and position

**Devices → By device** groups each robot and its entities in one card. Selecting the dock area, such as a storage room, keeps commands, routines, sensors, configuration, maintenance, and maps together. Sections expand without a separate card for each sensor. **Individual entities** retains the technical view.

Search/category filters also inspect group contents: a sensor match shows its robot card with the matching section open. Robot context remains even for dock-sensor matches. HA's assigned area is a device classification, not a live cleaning position.

Grouping uses HA registry device IDs. The provider normalizes Roborock robot/dock relationships using integration-declared identifiers, never similar names/shared areas alone. Manual `relatedEntityIds` remain available without registry access. Different robots in one area remain separate.

The same card opens by selecting the robot in the 3D home, editor, or full-screen virtual home.

Demo previews: [desktop](images/vacuum-detail-desktop.png), [mobile](images/vacuum-detail-mobile.png).

## Controls and information

The card shows state, battery, and supported commands. Additional entities are grouped into:

- Routines and commands.
- Charging dock, including sensors/switches.
- Sensors and cleaning.
- Settings.
- Maintenance and diagnostics.
- Maps: entities/update timestamps, without embedding credential-bearing image URLs.

Alongside main robot commands, generic controls support `button.press`, `select.select_option`, `number.set_value`, `time.set_value`, and `vacuum.set_fan_speed`. Options/ranges come from entity attributes and are validated before dispatch. The UI invents no proprietary commands.

HA buttons may be `unknown` before first use; this does not mean unavailable. Routines can run before they have an activation timestamp. `unavailable` entities remain disabled. Battery may come from the vacuum attribute or a dedicated sensor, including 0%.

## Room cleaning

Open **Room cleaning → Refresh rooms** in robot details. Select one or more areas and choose **Clean selected rooms**. Global start/pause/return controls remain above.

The provider enables room cleaning only when HA declares both vacuum `CLEAN_AREA` (16384) and standard `vacuum.clean_area`. Rooms come from entity `options.vacuum.area_mapping`: names/floors are read from the area registry, not inferred from 3D room names or dock area.

If empty, map robot segments to HA areas in the vacuum entity settings, then refresh. Mappings are reread before each start: a removed area cannot be dispatched from stale selection. Commands contain `cleaning_area_id` and only the selected entity target; HA/integration handle native segments/maps. Check active maps on multi-floor robots. Errors never fall back to whole-home cleaning.

**Refresh rooms** clears selection. Robot/provider changes, disconnection, and read errors clear options; unavailable entities/pending requests disable start. Demo rooms `Soggiorno` (living room) and `Cucina` (kitchen) let you test without hardware. Arbitrary cleaning rectangles/room ordering are not included.

Contract checked against official HA 2026.10.4 source: [clean_area and area_mapping](https://github.com/home-assistant/core/blob/2026.10.4/homeassistant/components/vacuum/services.py), [feature flags](https://github.com/home-assistant/core/blob/2026.10.4/homeassistant/components/vacuum/const.py), [full registry access](https://github.com/home-assistant/core/blob/2026.10.4/homeassistant/components/config/entity_registry.py). Automated tests use simulated servers; real commands need testing with your mappings.

## Position readings

In the installed HA version, official Roborock registers `roborock.get_vacuum_current_position`. **Read position** is enabled only after receiving both the service and the vacuum's Roborock integration identity. Service presence does not guarantee every model: the robot may reject requests or lack a map. Errors appear in the card.

Requests go through the HA provider over WebSocket with explicit responses. UI/renderer receive only normalized coordinates/timestamps, without vendor-account/API access. Direct-mode tokens remain in memory; server-mode refresh credentials follow the encrypted profile described in [BACKEND.md](BACKEND.md).

Choose **Read position** for native X/Y. Units are not assumed to be millimeters or editor coordinates: two point pairs align the coordinate systems.

Automatic refresh is **initially disabled**. Enable **Update every 60 seconds while moving** if desired. Only `cleaning`/`returning` robots are polled, with connected provider/visible tab. Requests do not overlap or exceed one read per minute/entity, including manual reads. Errors stop automatic refresh until reviewed/re-enabled. Disconnecting/changing providers clears readings/monitoring from memory.

HA documents polling and possible cloud/rate limits for Roborock position. This does not match native-app frequency or guarantee continuous updates. No hypothetical path or unreported heading is inferred between samples.

## Aligning with the floor plan

1. Bind a **Robot vacuum** object to its vacuum entity in the editor.
2. Select it and open **Align position and floor plan**.
3. Identify a known home point A. With the robot there, read position and choose **Use last reading for A**. Enter that point's editor X/Y in meters.
4. Repeat for a distinct, sufficiently distant B. Manual readings require at least one minute between requests.
5. If needed, enable **Invert the native Y axis**. Two points determine scale/rotation; reflection must be checked against a third point.
6. If the robot exposes a map selector, select it in the optional field. Alignment is bound to its current value: changing HA maps prevents applying that position to the previous home. Without a selector, check the active map manually, especially across floors.
7. Confirm the points and choose **Save alignment**. Verify a third point before enabling periodic refresh.

Home anchors must lie within rooms on the floor. Transformation can include translation, rotation, scale, and Y reflection. Incompatible coordinates, coincident anchors, or samples outside room boundaries are not applied.

Valid samples move the pin/3D robot without changing static project object coordinates or regenerating geometry. JSON exports only the chosen alignment, not position history/credentials. The card always shows the last read time: a received position is not continuous observation.

## Verification and limitations

Tests use demo robots/simulated HA transport. They check same-name robot separation, exact dock relationship, sensor search, never-run routines, standard controls, alignment, actual pin movement, background pause, and unchanged static coordinates. Physical Saros 10R position support requires testing from your connected browser; assistant tests use no real tokens.

Official sources:

- [Roborock integration, actions, update limits](https://www.home-assistant.io/integrations/roborock/).
- [HA 2026.10.4 services](https://github.com/home-assistant/core/blob/2026.10.4/homeassistant/components/roborock/services.py).
- [2026.10.4 position response](https://github.com/home-assistant/core/blob/2026.10.4/homeassistant/components/roborock/vacuum.py).
- [Roborock dock identity](https://github.com/home-assistant/core/blob/2026.10.4/homeassistant/components/roborock/coordinator.py).
- [HA WebSocket response data](https://contributors.home-assistant.io/core/internals/websocket-api/).
