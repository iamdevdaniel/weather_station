# Contracts

The device upload, Worker response, UI response, and database rows each have
their own data shape because they serve different purposes.

## Device and Worker

**Device request**

```ts
type TimeAnchor = { utc: string; elapsedSinceBootMs: number }

type Sample = {
	sequence: number
	elapsedSinceBootMs: number
	temperatureC: number | null
	humidityPct: number | null
	barometricPressure: number | null
	lightLux: number | null
	soundRmsAdc: number | null
	soundEstimatedDb: number | null
	batteryAdcRaw: number | null
	batteryVoltageV: number | null
	qualityFlags: string[]
}

type UploadRequest = {
	schemaVersion: 1
	stationId: string
	uploadId: string
	bootId: string
	firmwareVersion: string
	droppedSamples: number
	timeAnchor: TimeAnchor | null
	samples: Sample[]
}

type DeviceHealthRequest = {
	schemaVersion: 1
	stationId: string
	bootId: string
	firmwareVersion: string
	sdOk: boolean
	wifiRssi: number
	elapsedSinceBootMs: number
	temperatureC: number | null
	humidityPct: number | null
	barometricPressure: number | null
	lightLux: number | null
	soundRmsAdc: number | null
	batteryAdcRaw: number | null
	batteryVoltageV: number | null
	issues: string[]
}
```

**Worker response**

```ts
type StationConfig = {
	sampleIntervalSeconds: number
	uploadIntervalSeconds: number
}

type FirmwareUpdate = {
	version: string
	url: string
	sha256: string
}

type UploadResponse = {
	schemaVersion: 1
	uploadId: string
	stored: true
	config: StationConfig
	firmwareUpdate: FirmwareUpdate | null
}

type DeviceHealthResponse = {
	schemaVersion: 1
	bootId: string
	stored: true
}

type ApiError = { error: { code: string; message: string } }
```

**Device routes**

- `POST /api/v1/uploads` stores queued samples and returns configuration and any
  available firmware update.
- `POST /api/v1/device-health` stores one health report after a real power-on.
- `GET /api/v1/firmware/:version` downloads the authenticated OTA image.

## Worker and React

- `GET /api/v1/stations/:stationId/current` returns configuration and the latest
  sample.
- `GET /api/v1/stations/:stationId/samples` returns recent samples for the
  temporary dashboard.
- The final V1 interface will add station status, calendar summaries, and
  detailed readings for a selected UTC day.
- Planned routes for that interface are:
  - `GET /api/v1/stations`
  - `GET /api/v1/stations/:stationId/days`
  - `GET /api/v1/stations/:stationId/days/:date`

UI data adds `capturedAt`, `timeState` (`synced`, `derived`, or `missing`), and
`receivedAt`.

## D1

| Table                  | Purpose                               | Main fields                                                                                           |
| ---------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `stations`             | Identity, configuration, last contact | `id`, `display_name`, intervals, timestamps                                                           |
| `uploads`              | One received upload                   | station/upload identity, schema, boot, firmware, sample and dropped counts, time anchor, receipt time |
| `samples`              | Authoritative raw readings            | identity, time, barometric pressure and other sensor values, quality flags, receipt time              |
| `daily_summaries`      | Rebuildable station-day aggregates    | day, count, and min/average/max values                                                                |
| `device_health_checks` | One report per real device boot       | firmware, SD state, Wi-Fi signal, sensor values, battery reading, and issues                          |
