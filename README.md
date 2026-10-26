# Solar Weather Station

A solar-powered outdoor station that preserves environmental readings through
network outages and presents live and historical data in a simple web app.

## Problem

The station will be mounted outdoors, powered by a battery and solar panel, and
connected through isolated Wi-Fi. Physical access and reliable connectivity
cannot be assumed.

The product therefore needs to preserve measurements locally, recover cleanly
from connection failures, report how trustworthy each timestamp is, and support
remote firmware updates without routine disassembly.

V1 deliberately targets one dependable station built from inexpensive,
available parts instead of a generalized IoT platform.

## V1

- Measure temperature, humidity, atmospheric pressure, light, approximate noise
  level, and battery voltage every five minutes.
- Deep-sleep between samples. Keep Wi-Fi off on sample-only wakes and enable the
  radio only for health checks, uploads, and OTA.
- Save measurements to microSD before attempting delivery.
- Upload every 20 minutes, retry safely, and recover the oldest saved data
  first after an outage.
- Preserve sample identity so retries cannot create duplicate measurements.
- Show current readings, device status, a calendar, and detailed data for a
  selected day.
- Receive sampling configuration and firmware updates remotely.
- Keep collecting useful data when an individual sensor or the network fails.

The exact operating rules live in the [product specification](docs/PRODUCT_SPEC.md).

The assembled station is operating outdoors on battery and solar power. The
production firmware, microSD recovery, deep sleep, authenticated D1 ingestion,
and OTA update path have been validated on the installed hardware. The current
React dashboard proves the public data path; the final V1 interface remains.

## How it works

```text
Sensors -> ESP8266 -> microSD -> HTTPS -> Cloudflare Worker -> D1 -> React UI
```

The boundary shapes, API routes, and database tables are defined in
[contracts](docs/CONTRACTS.md). Physical components, wiring, and pin assignments
are kept in the [hardware reference](docs/HARDWARE.md).

The ESP8266 owns measurement and local persistence. It only removes saved data
after the Worker confirms storage. The Worker authenticates the station,
validates and deduplicates uploads, reconstructs timestamps, supplies device
configuration, and serves the UI. Raw samples in D1 remain the source of truth;
daily summaries are derived and can be rebuilt.

The same Worker handles device writes and UI reads. The station uses outbound
HTTPS only, so the isolated device network does not need inbound access or port
forwarding. OTA downloads a server-advertised firmware image only after a
successful upload and verifies its SHA-256 hash before installation. USB remains
the recovery path for firmware that cannot connect or run OTA.
