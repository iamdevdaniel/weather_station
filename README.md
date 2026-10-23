# Solar Wi-Fi Weather Station

## Goal

Ship one complete solar-powered ESP8266 station in 15 active hours.

```text
Sensors -> ESP8266 -> microSD queue -> HTTPS Worker -> D1 -> React UI
```

The rule for every task is: **Does this block the 15-hour v1?** If not, defer it.

## Definition of done

- Real sensor data survives failures, reaches D1, and appears in the deployed UI.
- Solar/battery operation, isolated Wi-Fi, and safe retries are verified.
- Fusion produces a printable enclosure; deployment notes and a postmortem exist.

## Hardware

- NodeMCU-style ESP8266 / ESP-12N.
- BME280 temperature/humidity/pressure sensor, GY-302/BH1750, MAX4466
  microphone, and microSD module with 4 GB card.
- 74HC4067 mux and 330 kOhm / 100 kOhm / 100 nF battery-sense circuit.
- T-BAT CN3065, Globo Star SKU790993 18650 (3.6 V nominal, 3600 mAh, 8 A), and solar panel.

### Final perfboard pinout

The BH1750, MAX4466, and microSD were tested incrementally and work together.
The BME280 replaces the DHT11 and still needs its combined test. Mount the ESP
in female headers. Solder the mux and battery divider onto the same perfboard,
then place labelled male headers around the board edge for the removable sensor
jumpers.

#### ESP -> BME280

| ESP pin | BME280 pin |
| --- | --- |
| `3.3 V` (marked `3V3`) | `VCC` |
| `GND` | `GND` |
| `D1 / GPIO5` | `SCL / SCK` |
| `D2 / GPIO4` | `SDA / SDI` |
| `3.3 V` (marked `3V3`) | `CSB`, only if exposed |
| `GND` | `SDO`, only if exposed; selects address `0x76` |

#### ESP -> BH1750

| ESP pin | BH1750 pin |
| --- | --- |
| `3.3 V` (marked `3V3`) | `VCC` |
| `GND` | `GND` |
| `D1 / GPIO5` | `SCL` |
| `D2 / GPIO4` | `SDA` |
| No connection | `ADDR`; leave it empty for address `0x23` |

#### ESP -> MAX4466

| ESP pin | MAX4466 pin |
| --- | --- |
| `3.3 V` (marked `3V3`) | `VCC` |
| `GND` | `GND` |
| `A0`, through mux `SIG` and `C0` | `OUT` |

#### ESP -> microSD

| ESP pin | microSD pin |
| --- | --- |
| `VIN / 5 V` | `VCC` |
| `GND` | `GND` |
| `D5 / GPIO14` | `SCK / CLK` |
| `D6 / GPIO12` | `MISO` |
| `D7 / GPIO13` | `MOSI` |
| `D8 / GPIO15` | `CS` |

#### ESP -> 74HC4067 mux

| ESP or source pin | Mux pin |
| --- | --- |
| `3.3 V` (marked `3V3`) | `VCC` |
| `GND` | `GND`, `EN`, `S1`, `S2`, `S3` |
| `A0` | `SIG` |
| `D3 / GPIO0` | `S0` |
| MAX4466 `OUT` | `C0` |
| Battery sense node | `C1` |

Leave mux `C2` through `C15` empty.

#### ESP -> T-BAT

| ESP or perfboard connection | T-BAT pin |
| --- | --- |
| `VIN / 5 V`, through the power switch | `5V OUT` |
| `GND` | `GND` |
| `330 kOhm` resistor input | `BAT+` |

On the perfboard, the `330 kOhm` resistor output creates the battery sense node.
Connect that node to mux `C1`, one side of the `100 kOhm` resistor, and one side
of the `100 nF` capacitor. Connect the other side of both parts to `GND`.

Connect `D0 / GPIO16` to `RST` with a removable jumper for deep-sleep wake.
`D4 / GPIO2` is unused and must remain high while the ESP boots.

### Sound measurement

- Keep the MAX4466's physical gain fixed after tuning.
- Remove the DC bias and calculate AC RMS from a short ADC sample window.
- Keep raw RMS as the trustworthy value.
- Flag ADC clipping near `0` or `1023`.
- `estimatedDb = 20 * log10(rms / referenceRms) + referenceDb` is only an
  estimated noise level, never calibrated SPL.
- Choose the final reference after mounting the microphone because the enclosure
  changes its response. Do not curve-fit or auto-adjust gain for v1.

### Battery measurement on the perfboard

The regulated T-BAT 5 V output cannot show remaining charge. Measure the raw
battery through the T-BAT terminal labelled `3.7V BAT`:

- Confirm the terminal polarity and roughly `3.0-4.2 V` with a multimeter first.
- Never connect raw battery voltage directly to `A0`.
- Keep the divider, its capacitor, and the mux close together.
- Verify boot and both mux channels before soldering permanently.
- The battery's 8 A rating does not affect this high-resistance measurement.

A second `100 nF` ceramic capacitor directly between mux `VCC` and `GND` is a
recommended final-board reliability part, but it does not block the first test.

## Device behavior

### Sampling and uploads

- Default sample interval: 60 seconds.
- Default upload interval: 5 minutes.
- A sample is one reading cycle; an upload contains 1 to 10 samples.
- Normal operation uploads about 5 samples. Backlog recovery sends consecutive
  uploads of at most 10 samples, oldest first.
- An upload request must not exceed 8 KB.
- New intervals arrive in each successful upload response.
- New config affects future samples, not queued uploads.

### Identity and ordering

- Local Git-ignored config contains `stationId` and `apiToken`; sample identity is `stationId + bootId + sequence`.
- Sequence means order within one boot.
- Late samples are accepted; duplicates are ignored.

### Time states

- Request NTP during every upload cycle and keep the newest successful anchor for the current `bootId`.
- `synced`: the sample coincides with the NTP anchor.
- `derived`: the Worker calculated time from that anchor and elapsed RTC time.
- `missing`: no trustworthy anchor exists, so `capturedAt` is `null`; sequence
  still preserves order.
- Power loss creates a new `bootId`; time is never reconciled across that gap.

### Local storage and retry

- microSD stores only unconfirmed uploads, capped at 7 days or 10,080 samples.
- Each upload contains one `bootId` and its available NTP anchor so it survives later power loss.
- Send oldest first; delete an upload only after a successful matching response.
- After failure, retry once immediately and then on later upload cycles.
- When full, replace the oldest complete upload and count dropped samples.

### Sensor failures

- One failed sensor never stops the process.
- Store its value as `null` and add one small quality flag.

## Backend and data

- `ESP8266 -> HTTPS -> Cloudflare Worker -> D1`.
- One Worker handles device writes and UI reads; no second backend service.
- D1 raw samples are the absolute source of truth.
- One request commits completely or not at all.
- The Worker confirms storage only after D1 commits.
- Raw samples are append-only.
- Daily summaries are derived and can be rebuilt from raw samples.
- Backend owns validation, deduplication, safe time reconciliation, station status, and summaries.

### Current Worker

- Production base URL: `https://weather-station-api.maydanachi.workers.dev`
- Implemented: health check, authenticated uploads, duplicate-upload handling,
  time derivation, remote interval response, and current sample lookup.
- Production D1 contains `station-1` and real upload-test samples.
- Pending: station list, daily summaries, historical-day routes, and the React UI.

```powershell
npm install
npm run db:migrate:local
npm run dev
npm run check
```

Local secrets live in Git-ignored `.dev.vars`. Production secrets are managed by
Wrangler and must never be committed.

### Worker API surface

- `POST /api/v1/uploads`
- `GET /api/v1/stations` and `/api/v1/stations/:stationId/current`
- `GET /api/v1/stations/:stationId/days`
- `GET /api/v1/stations/:stationId/days/:date`

### D1 database schema

Worker migration files define these tables; D1 enforces the schema.
Wrangler applies numbered migrations in order. Before non-test data matters, add
a documented backup, rollback, and migration verification procedure; no ORM or
second migration tool is needed for v1.

| Table | What it stores | Fields |
| --- | --- | --- |
| `stations` | Device identity, config, and last contact | `id`, `display_name`, `credential_hash`, `sample_interval_seconds`, `upload_interval_seconds`, `last_seen_at`, `created_at`, `updated_at` |
| `uploads` | One received upload | `station_id`, `upload_id`, `schema_version`, `boot_id`, `firmware_version`, `sample_count`, `anchor_utc`, `anchor_elapsed_since_boot_ms`, `received_at` |
| `samples` | One raw sensor reading | `station_id`, `upload_id`, `sample_id`, `boot_id`, `sequence`, `captured_at`, `time_state`, `elapsed_since_boot_ms`, `temperature_c`, `humidity_pct`, `light_lux`, `sound_rms_adc`, `sound_estimated_db`, `battery_adc_raw`, `battery_voltage_v`, `quality_flags`, `received_at` |
| `daily_summaries` | One station-day summary | `station_id`, `day`, `sample_count`, `temperature_min_c`, `temperature_avg_c`, `temperature_max_c`, `humidity_min_pct`, `humidity_avg_pct`, `humidity_max_pct`, `light_min_lux`, `light_avg_lux`, `light_max_lux`, `sound_rms_min_adc`, `sound_rms_avg_adc`, `sound_rms_max_adc`, `battery_min_v`, `battery_avg_v`, `battery_max_v`, `updated_at` |

## Data contracts

JSON uses camelCase. Known times are UTC ISO 8601 strings. Uploads require
`Authorization: Bearer <apiToken>`.
Both sides require `schemaVersion: 1`; the device keeps an upload queued when
the response version or `uploadId` does not match.

### Device -> Worker

The device creates these. The Worker validates them and stores accepted samples
in D1.

```ts
type TimeAnchor = { utc: string; elapsedSinceBootMs: number };
type Sample = {
  sampleId: string; sequence: number; elapsedSinceBootMs: number;
  temperatureC: number | null; humidityPct: number | null;
  lightLux: number | null; soundRmsAdc: number | null;
  soundEstimatedDb: number | null;
  batteryAdcRaw: number | null;
  batteryVoltageV: number | null;
  qualityFlags: string[];
};
type UploadRequest = {
  schemaVersion: 1;
  stationId: string; uploadId: string; bootId: string;
  firmwareVersion: string; timeAnchor: TimeAnchor | null;
  samples: Sample[]; // 1..10; entire request <= 8 KB
};
```

### Worker -> Device

The Worker creates these. The device validates config and deletes a queued upload
only after a matching successful response.

```ts
type StationConfig = {
  sampleIntervalSeconds: number; uploadIntervalSeconds: number;
};

type UploadResponse = {
  schemaVersion: 1;
  uploadId: string; stored: true;
  accepted: number; duplicates: number; serverTime: string;
  config: StationConfig;
};

type ApiError = { error: { code: string; message: string } };
```

### Worker -> React UI

The Worker adds `capturedAt`, `timeState` (`synced`, `derived`, or `missing`),
and `receivedAt`:

- `/current`: station status, config, and latest sample.
- `/days`: calendar aggregates.
- `/days/:date`: raw samples and chart data for one UTC day.

### Station status

- Online is within two upload cycles, delayed within six, and offline after six.

## Frontend

- React/Vite on Cloudflare Pages.
- `/` shows device status, latest samples, current-day chart, and calendar.
- `/:date` shows detailed charts for the selected UTC day.
- Page URLs stay clean; React calls the Worker's `/api/v1/...` routes internally.
- Optional animation may replay real uploads but never fabricate data.

## Security

- Per-device token; raw tokens and other secrets remain outside D1/Git.
- Guest/isolated Wi-Fi cannot reach the trusted LAN.
- Outbound HTTPS only; no port forwarding.

## Enclosure

- Fusion script creates editable native parameters and features.
- Printed mounts carry loads; wiring has strain relief and the battery is removable.
- Include protected sensors, ventilation, solar mounting, and service access.

## Non-goals

- Second node, external RTC, MQTT, cellular, calibrated dB, or custom PCB.
- Accounts, alerts, forecasting, native apps, or production enclosure polish.

## Time budget

| Work | Budget |
| --- | ---: |
| Scope, repository, contracts, and Fusion setup | 1 hr 45 min |
| Hardware bring-up and wiring | 1 hr 30 min |
| Sensor, time, sleep, microSD, and retry firmware | 3 hr 15 min |
| Worker, D1, authentication, config, and integration | 3 hr |
| React UI and deployment | 2 hr |
| Parametric enclosure | 1 hr 15 min |
| Solar and network checks | 45 min |
| Documentation, postmortem, and debug buffer | 1 hr 30 min |
| **Total** | **15 hr** |

## Delivery order

1. Configure and verify an isolated guest Wi-Fi network.
2. Install the mux and verify microphone plus battery readings.
3. Measure the physical parts, generate the enclosure, and start the print.
4. Send one real upload to D1.
5. Add response validation, retries, time handling, and remote config.
6. Build the real-data UI, run final checks, and write the postmortem.

Cut animation and visual polish first. Never cut the real-data path, security,
honest time states, or safe persistence.
