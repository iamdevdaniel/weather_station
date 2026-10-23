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
