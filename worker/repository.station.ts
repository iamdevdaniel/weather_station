import type { StationConfig } from "./contracts"

export function findStation(database: D1Database, stationId: string) {
	return database
		.prepare(
			`SELECT id, display_name, sample_interval_seconds,
			        upload_interval_seconds, last_seen_at
			 FROM stations
			 WHERE id = ?`,
		)
		.bind(stationId)
		.first()
}

export function findStationConfig(database: D1Database, stationId: string) {
	return database
		.prepare(
			`SELECT sample_interval_seconds AS sampleIntervalSeconds,
			        upload_interval_seconds AS uploadIntervalSeconds
			 FROM stations
			 WHERE id = ?`,
		)
		.bind(stationId)
		.first<StationConfig>()
}

export function findLatestSample(database: D1Database, stationId: string) {
	return database
		.prepare(
			`SELECT *
			 FROM samples
			 WHERE station_id = ?
			 ORDER BY received_at DESC, sequence DESC
			 LIMIT 1`,
		)
		.bind(stationId)
		.first()
}

export function findRecentSamples(
	database: D1Database,
	stationId: string,
	limit: number,
) {
	return database
		.prepare(
			`SELECT boot_id AS bootId,
			        sequence,
			        captured_at AS capturedAt,
			        time_state AS timeState,
			        temperature_c AS temperatureC,
			        humidity_pct AS humidityPct,
			        barometric_pressure AS barometricPressure,
			        light_lux AS lightLux,
			        sound_rms_adc AS soundRmsAdc,
			        battery_voltage_v AS batteryVoltageV,
			        quality_flags AS qualityFlags,
			        received_at AS receivedAt
			 FROM samples
			 WHERE station_id = ?
			 ORDER BY received_at DESC, sequence DESC
			 LIMIT ?`,
		)
		.bind(stationId, limit)
		.all()
}
