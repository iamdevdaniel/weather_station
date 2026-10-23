export interface Env {
	DB: D1Database
	DEVICE_API_TOKEN: string
}

export const SCHEMA_VERSION = 1
export const MAX_SAMPLES_PER_UPLOAD = 10
export const MAX_UPLOAD_BYTES = 8 * 1024

export interface TimeAnchor {
	utc: string
	elapsedSinceBootMs: number
}

export interface Sample {
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

export interface UploadRequest {
	schemaVersion: number
	stationId: string
	uploadId: string
	bootId: string
	firmwareVersion: string
	droppedSamples: number
	timeAnchor: TimeAnchor | null
	samples: Sample[]
}

export interface StationConfig {
	sampleIntervalSeconds: number
	uploadIntervalSeconds: number
}

export interface FirmwareUpdate {
	version: string
	url: string
	sha256: string
}
