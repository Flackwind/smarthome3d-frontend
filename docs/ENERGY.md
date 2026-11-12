# Electricity and gas consumption

**Devices** offers only entities bound to objects in the open home, rather than all HA entities. A profile's power/energy sensors must be explicitly related or belong to the same HA device/group; the whole-home meter uses a home-associated sensor. Units distinguish W/kW from Wh/kWh/MWh. Without bindings, the list stays empty; saved profiles/missing sources are preserved. Dashboard temperature sources are configured separately through card gears: [guide](DASHBOARD.md).

**Energy** contains Overview, Contracts, Devices, Heating, and Actuals. Configuration belongs to the home (optional schema-v1 `energy`), works offline, and follows saves, JSON import/export, and server copies. History requires server storage and lives separately from geometry/editor undo. No chart dependency or paid service is added.

## First setup

1. In **Contracts**, enter an effective date, electricity €/kWh, and gas €/Smc if known. Add the contract, then **Save settings**. Prices are never assumed. For a two-rate tariff, use F1/F2/F3 with F2=F3=F23; single-rate and 24 repeating daily prices are also available.
2. In **Devices**, select a whole-home meter or configure profiles. Profiles use active/standby rated watts and entity states, measured W/kW, or cumulative Wh/kWh/MWh counters. Select sensors from HA entities or enter entity IDs. Demo readings do not populate server history.
3. In **Heating**, choose a gas meter or thermal estimate and complete the parameters below. Gas can remain disabled.
4. Open the home in **Server storage**, sign in as owner, and connect HA to the profile. Enable collection in Overview and save. The first sample establishes a baseline; the second produces an interval. **Read and record now** requests shared sampling with a minimum 10-second gap, without inventing earlier data.
5. Choose year, consumption/cost, and month in the charts. **Refresh charts** rereads the DB. Unobserved months are empty, distinct from observed zero use. Actuals can add earlier bill months.

## Electricity and costs

The server shares one HA snapshot per minute across enabled homes. Power is integrated trapezoidally between readings; rated-watt profiles use configured active/standby states. Thermostats use `hvac_action` when present. Consumption is not inferred from brightness, robot battery, or names. For variable loads, a metering plug is preferable to nameplate power.

Counters use nonnegative deltas. Resets, incompatible units, unavailable values, implausible interval jumps, and gaps above five minutes are excluded. Units normalize to kWh/Smc. Slowly updated counters may concentrate deltas in the last observed interval: tariff allocation is approximate; individual increment timestamps are not reconstructed.

A configured whole-home meter determines the home total; profiles become detail only. Otherwise, totals sum included profiles only where all included sources are valid. Profile/total coverage may differ. Device totals need not cover the whole home. A source cannot be included twice; users must avoid physical overlaps between different sensors, such as an upstream plug and downstream load.

Intervals split at minute/hour/month boundaries in **Europe/Rome**, respecting DST and Italian national holidays, including Easter Monday. Prices use the latest non-future effective contract. Every interval retains its calculated cost; editing contracts does not reprice history. Unpriced quantities are flagged and total cost stays incomplete. Fixed charges, taxes, and components absent from unit prices are not simulated. Actuals can record full bill costs with a different scope from automatically calculated variable costs.

Band definitions: [ARERA time bands](https://www.arera.it/en/bolletta/glossario-dei-termini/dettaglio/fasce-orarie). Current prices/market indices are not downloaded. The 24 daily prices repeat on 23/25-hour days too; repeated hours use the same price.

## Gas: measured or estimated

Cumulative **Smc** sensors are read directly; **m³/m3** applies **coefficient C from your bill**. See [ARERA coefficient C](https://www.arera.it/en/bolletta/glossario-dei-termini/dettaglio/coefficiente-correttivo-c). Verify the initial value 1. Flow sensors in m³/h are not supported cumulative counters.

Thermal estimation uses steady-state heat loss:

```
H [W/K] ≈ mean U [W/(m² K)] × heat-loss surface area [m²]
          + 0.33 × air changes [1/h] × heated volume [m³]
Zone power [W] = H × zone weight × max(0, indoor T − outdoor T)
Gas [Smc] = zone power × hours / (1000 × PCS efficiency × PCS [kWh/Smc])
```

Enter H directly or estimate it with the page's helper. Heat-loss surface area is not floor area: it includes surfaces facing outdoors/unheated spaces. The formula follows envelope/ventilation heat-loss structure in [BRE SAP 10.2, worksheet 37–39](https://files.bregroup.com/SAP/SAP%2010.2%20-%2020-08-2021.pdf); this simplified implementation is not a SAP assessment or energy certification.

Zone weight is its radiator count divided by the total. Increasing all radiator counts does not multiply home consumption. This is coarse allocation without actual radiator output, water temperature, weather compensation, or hydraulic balancing.

Required: H, boiler efficiency relative to **gross calorific value (PCS)** (0–1), gas PCS in kWh/Smc, outdoor temperature, and at least one zone. Initial PCS 10.7/efficiency 0.90 are examples, not home-specific measurements. Convert MJ/Smc by dividing by 3.6, or GJ/Smc by multiplying by 277.778. Do not enter lower-calorific-value (PCI) efficiency above 100% in the PCS field. See [ARERA gross calorific value](https://www.arera.it/en/bolletta/glossario-dei-termini/dettaglio/potere-calorifico-superiore-convenzionale-p).

Outdoor temperature comes from `weather.*` or an HA sensor; indoor temperature uses a sensor or thermostat `current_temperature`. °C/°F/K convert automatically. Valve setpoint is a target, not an energy reading. With `hvac_action`, a zone contributes only in `heating`; `off` excludes it. Without the action, demand is assumed when indoor T ≤ setpoint + 0.2 °C. Without a thermostat, continuous demand is assumed while heating is enabled: disable it when off. Optional base Smc/day adds cooking/hot water uniformly, without automatic estimation.

Manual values apply only without a selected HA source. An unavailable configured source stops estimation rather than silently falling back. Error can be substantial: the model excludes thermal inertia, sunlight, internal gains, wind, thermal bridges, boiler cycles, and radiator differences. Compare complete months with a meter and adjust H; prefer metering when available.

## Collection, persistence, and backups

Collection runs in the backend and can continue with the page closed **while at least one owner session remains valid with an unlocked HA key in RAM**. It does not extend the session. Backend restart requires sign-in; logout/expiration of the last session suspends collection. Permanent unattended collection would need different key management, not introduced here.

Reads use only [HA's standard REST GET /api/states](https://contributors.home-assistant.io/core/internals/rest-api/), without device commands/vendor APIs. No full HA snapshot, arbitrary attribute, or token is stored in history. Integration baselines stay in RAM; restart/configuration changes need two new readings. DB aggregates use UTC hour/source/quality; no browser accumulation timer exists.

Monthly actuals replace that utility/month's automatic total rather than adding to it. Removing an actual reveals any automatic total. Device details remain. Monthly quantities without cost are not artificially distributed across bands.

The **server's full ZIP backup** includes `energy.json` aggregates/actuals; restore attaches them to the new home atomically with project/assets. Older ZIP v1 without history remains supported. JSON exports and local-to-server copies carry configuration only. Administrative DB backups retain all history. Deleting homes cascades to energy data. HA recorder history is not imported; earlier months/gaps are not filled. Aggregates have no retention expiry; expanded ZIP limit remains 150 MB.

## Preview

Fake test actuals, not the user's home data: [desktop](images/energy-desktop.png), [mobile](images/energy-mobile.png).
