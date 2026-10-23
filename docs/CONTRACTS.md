# Contracts

The device upload, Worker response, UI response, and database rows each have
their own data shape because they serve different purposes.

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
  barometricPressure: number | null;
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
  droppedSamples: number;
  timeAnchor: TimeAnchor | null;
  samples: Sample[];
};
```

**Worker response**

```ts
type StationConfig = {
  sampleIntervalSeconds: number;
  uploadIntervalSeconds: number;
};

type FirmwareUpdate = {
  version: string;
  url: string;
  sha256: string;
};

type UploadResponse = {
  schemaVersion: 1;
  uploadId: string;
  stored: true;
  accepted: number;
  duplicates: number;
  serverTime: string;
  config: StationConfig;
  firmwareUpdate: FirmwareUpdate | null;
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
| `uploads` | One received upload | station/upload identity, schema, boot, firmware, sample and dropped counts, time anchor, receipt time |
| `samples` | Authoritative raw readings | identity, time, barometric pressure and other sensor values, quality flags, receipt time |
| `daily_summaries` | Rebuildable station-day aggregates | day, count, and min/average/max values |
