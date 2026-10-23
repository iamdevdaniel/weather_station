import type { Sample, TimeAnchor, UploadRequest } from "./contracts"

// Six complete samples would make one D1 insert too large.
const SAMPLES_PER_DATABASE_INSERT = 5

export function findExistingUpload(
	database: D1Database,
	stationId: string,
	uploadId: string,
) {
	return database
		.prepare(
			`SELECT 1
			 FROM uploads
			 WHERE station_id = ? AND upload_id = ?`,
		)
		.bind(stationId, uploadId)
		.first()
}

export async function storeUpload(
	database: D1Database,
	upload: UploadRequest,
	receivedAt: string,
) {
	const sampleInserts = buildSampleInserts(database, upload, receivedAt)
	const writes = [
		database
			.prepare(
				`INSERT INTO uploads
				 (station_id, upload_id, schema_version, boot_id, firmware_version,
				  sample_count, dropped_samples, anchor_utc,
				  anchor_elapsed_since_boot_ms, received_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.bind(
				upload.stationId,
				upload.uploadId,
				upload.schemaVersion,
				upload.bootId,
				upload.firmwareVersion,
				upload.samples.length,
				upload.droppedSamples,
				upload.timeAnchor?.utc ?? null,
				upload.timeAnchor?.elapsedSinceBootMs ?? null,
				receivedAt,
			),
		...sampleInserts,
		database
			.prepare(
				"UPDATE stations SET last_seen_at = ?, updated_at = ? WHERE id = ?",
			)
			.bind(receivedAt, receivedAt, upload.stationId),
	]

	await database.batch(writes)
}

function buildSampleInserts(
	database: D1Database,
	upload: UploadRequest,
	receivedAt: string,
) {
	const statements: D1PreparedStatement[] = []

	for (
		let startIndex = 0;
		startIndex < upload.samples.length;
		startIndex += SAMPLES_PER_DATABASE_INSERT
	) {
		const samples = upload.samples.slice(
			startIndex,
			startIndex + SAMPLES_PER_DATABASE_INSERT,
		)
		const rowPlaceholders: string[] = []
		const bindings: unknown[] = []

		for (const sample of samples) {
			const time = resolveSampleTime(sample, upload.timeAnchor)
			rowPlaceholders.push(
				"(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
			)
			bindings.push(
				upload.stationId,
				upload.uploadId,
				upload.bootId,
				sample.sequence,
				time.capturedAt,
				time.timeState,
				sample.elapsedSinceBootMs,
				sample.temperatureC,
				sample.humidityPct,
				sample.barometricPressure,
				sample.lightLux,
				sample.soundRmsAdc,
				sample.soundEstimatedDb,
				sample.batteryAdcRaw,
				sample.batteryVoltageV,
				JSON.stringify(sample.qualityFlags),
				receivedAt,
			)
		}

		statements.push(
			database
				.prepare(
					`INSERT OR IGNORE INTO samples
					 (station_id, upload_id, boot_id, sequence, captured_at,
					  time_state, elapsed_since_boot_ms, temperature_c, humidity_pct,
					  barometric_pressure, light_lux, sound_rms_adc,
					  sound_estimated_db, battery_adc_raw, battery_voltage_v,
					  quality_flags, received_at)
					 VALUES ${rowPlaceholders.join(", ")}`,
				)
				.bind(...bindings),
		)
	}

	return statements
}

function resolveSampleTime(sample: Sample, anchor: TimeAnchor | null) {
	if (!anchor) return { capturedAt: null, timeState: "missing" } as const

	const timestamp =
		Date.parse(anchor.utc) +
		sample.elapsedSinceBootMs -
		anchor.elapsedSinceBootMs
	if (!Number.isFinite(timestamp)) {
		return { capturedAt: null, timeState: "missing" } as const
	}

	return {
		capturedAt: new Date(timestamp).toISOString(),
		timeState:
			sample.elapsedSinceBootMs === anchor.elapsedSinceBootMs
				? "synced"
				: "derived",
	} as const
}
