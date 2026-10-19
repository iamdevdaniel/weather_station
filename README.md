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

- ESP8266, DHT11, BH1750, KY microphone, 74HC4067, and battery divider.
- T-BAT, 18650, solar panel, microSD module, and 4 GB card.

## Device behavior

### Sampling and uploads

- Default sample interval: 60 seconds.
- Default upload interval: 5 minutes.
- A sample is one reading cycle; a batch is 1 to 100 samples.
- New intervals arrive in each successful upload response.
- New config affects future samples, not queued batches.

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

- microSD stores only unacknowledged batches, capped at 7 days or 10,080 samples.
- Each batch contains one `bootId` and its available NTP anchor so it survives later power loss.
- Upload oldest first; delete a batch only after backend acknowledgement.
- After failure, retry once immediately and then on later upload cycles.
- When full, replace the oldest complete batch and count dropped samples.

### Sensor failures

- One failed sensor never stops the process.
- Store its value as `null` and add one small quality flag.

## Backend and data

- `ESP8266 -> HTTPS -> Cloudflare Worker -> D1`.
- One Worker handles device writes and UI reads; no second backend service.
- D1 raw measurements are the absolute source of truth.
- One request commits completely or not at all.
- The Worker acknowledges only after D1 commits.
- Raw samples are append-only.
- Daily aggregates are derived and can be rebuilt from raw samples.
- Backend owns validation, deduplication, safe time reconciliation, station status, and aggregates.

### Worker API surface

- `POST /api/v1/measurements/batch`
- `GET /api/v1/stations` and `/api/v1/stations/:stationId/current`
- `GET /api/v1/stations/:stationId/days`
- `GET /api/v1/stations/:stationId/days/:date`

### D1 database schema

Worker migration files define these tables; D1 enforces the schema.

| Table | What it stores | Fields |
| --- | --- | --- |
| `stations` | Device identity, config, and last contact | `id`, `display_name`, `credential_hash`, `sample_interval_seconds`, `upload_interval_seconds`, `last_seen_at`, `created_at`, `updated_at` |
| `ingest_batches` | One received upload | `station_id`, `batch_id`, `boot_id`, `firmware_version`, `sample_count`, `anchor_utc`, `anchor_elapsed_since_boot_ms`, `received_at` |
| `measurements` | One raw sample | `station_id`, `batch_id`, `sample_id`, `boot_id`, `sequence`, `captured_at`, `time_state`, `elapsed_since_boot_ms`, `temperature_c`, `humidity_pct`, `light_lux`, `sound_adc_raw`, `battery_adc_raw`, `battery_voltage_v`, `quality_flags`, `received_at` |
| `daily_aggregates` | One station-day summary | `station_id`, `day`, `sample_count`, `temperature_min_c`, `temperature_avg_c`, `temperature_max_c`, `humidity_min_pct`, `humidity_avg_pct`, `humidity_max_pct`, `light_min_lux`, `light_avg_lux`, `light_max_lux`, `sound_min_adc`, `sound_avg_adc`, `sound_max_adc`, `battery_min_v`, `battery_avg_v`, `battery_max_v`, `updated_at` |

## Data contracts

JSON uses camelCase. Known times are UTC ISO 8601 strings. Uploads require
`Authorization: Bearer <apiToken>`.

### Device -> Worker

The device creates these. The Worker validates them and stores accepted samples
in D1.

```ts
type TimeAnchor = { utc: string; elapsedSinceBootMs: number };
type Sample = {
  sampleId: string; sequence: number; elapsedSinceBootMs: number;
  temperatureC: number | null; humidityPct: number | null;
  lightLux: number | null; soundAdcRaw: number | null;
  batteryAdcRaw: number | null;
  batteryVoltageV: number | null;
  qualityFlags: string[];
};
type UploadBatch = {
  stationId: string; batchId: string; bootId: string;
  firmwareVersion: string; timeAnchor: TimeAnchor | null;
  samples: Sample[]; // 1..100
};
```

### Worker -> Device

The Worker creates these. The device validates config and deletes a queued batch
only after a matching successful acknowledgement.

```ts
type StationConfig = {
  sampleIntervalSeconds: number; uploadIntervalSeconds: number;
};

type UploadAck = {
  batchId: string; stored: true;
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
- `/` shows device status, latest measurements, current-day chart, and calendar.
- `/:date` shows detailed charts for the selected UTC day.
- Page URLs stay clean; React calls the Worker's `/api/v1/...` routes internally.
- Optional animation may replay real batches but never fabricate data.

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

1. Prove sensors, ADC, microSD, power, and local batch recovery.
2. Send one real batch to D1.
3. Add acknowledgement, retries, time handling, and remote config.
4. Build the real-data UI and enclosure.
5. Run final checks and write the postmortem.

Cut animation and visual polish first. Never cut the real-data path, security,
honest time states, or safe persistence.
