# Contracts

These are boundary-specific shapes, not one universal application object. JSON
uses camel case, D1 uses snake case, and known times are UTC ISO 8601 strings.
Device requests use `Authorization: Bearer <apiToken>`. Both sides require the
same `schemaVersion`, and a device retains an upload until its version and
`uploadId` are confirmed.

Schema version 1 is still under review: pressure became a product requirement
after hardware validation and is not yet represented below.

## Device and Worker

**Device request**

```ts
type TimeAnchor = { utc: string; elapsedSinceBootMs: number };

type Sample = {
  sampleId: string;
  sequence: number;
  elapsedSinceBootMs: number;
  temperatureC: number | null;
  humidityPct: number | null;
  lightLux: number | null;
  soundRmsAdc: number | null;
  soundEstimatedDb: number | null;
  batteryAdcRaw: number | null;
  batteryVoltageV: number | null;
  qualityFlags: string[];
};

type UploadRequest = {
  schemaVersion: 1;
  stationId: string;
  uploadId: string;
  bootId: string;
  firmwareVersion: string;
  timeAnchor: TimeAnchor | null;
  samples: Sample[]; // 1–10; complete request <= 8 KB
};
```

**Worker response**

```ts
type StationConfig = {
  sampleIntervalSeconds: number;
  uploadIntervalSeconds: number;
};

type UploadResponse = {
  schemaVersion: 1;
  uploadId: string;
  stored: true;
  accepted: number;
  duplicates: number;
  serverTime: string;
  config: StationConfig;
};

type ApiError = { error: { code: string; message: string } };
```

## Worker and React

- `GET /api/v1/stations` lists stations and status.
- `GET /api/v1/stations/:stationId/current` returns configuration and the latest
  sample.
- `GET /api/v1/stations/:stationId/days` returns calendar summaries.
- `GET /api/v1/stations/:stationId/days/:date` returns one UTC day's samples and
  chart data.

UI data adds `capturedAt`, `timeState` (`synced`, `derived`, or `missing`), and
`receivedAt`.

## D1

| Table | Purpose | Main fields |
| --- | --- | --- |
| `stations` | Identity, configuration, last contact | `id`, `display_name`, `credential_hash`, intervals, timestamps |
| `uploads` | One received upload | station/upload identity, schema, boot, firmware, count, time anchor, receipt time |
| `samples` | Authoritative raw readings | identity, time, sensor values, quality flags, receipt time |
| `daily_summaries` | Rebuildable station-day aggregates | day, count, and min/average/max values |

An upload commits completely or not at all. The Worker acknowledges it only
after D1 confirms storage.
