import {
	MAX_SAMPLES_PER_UPLOAD,
	type Sample,
	SCHEMA_VERSION,
	type TimeAnchor,
	type UploadRequest,
} from "./contracts"

const IDENTIFIER_PATTERN = /^[A-Za-z0-9._-]{1,80}$/

export function validateUpload(value: unknown): value is UploadRequest {
	if (!isObject(value)) return false

	if (
		value.schemaVersion !== SCHEMA_VERSION ||
		!isValidIdentifier(value.stationId) ||
		!isValidIdentifier(value.uploadId) ||
		!isValidIdentifier(value.bootId) ||
		!isValidIdentifier(value.firmwareVersion) ||
		!isNonNegativeInteger(value.droppedSamples) ||
		!isValidTimeAnchor(value.timeAnchor) ||
		!Array.isArray(value.samples) ||
		value.samples.length < 1 ||
		value.samples.length > MAX_SAMPLES_PER_UPLOAD
	)
		return false

	const samples = value.samples
	if (!samples.every(isValidSample)) return false

	return samplesHaveUniqueSequences(samples)
}

function isValidSample(value: unknown): value is Sample {
	if (!isObject(value)) return false

	return (
		isNonNegativeInteger(value.sequence) &&
		isNonNegativeInteger(value.elapsedSinceBootMs) &&
		isFiniteNumberOrNull(value.temperatureC) &&
		isFiniteNumberOrNull(value.humidityPct) &&
		isFiniteNumberOrNull(value.barometricPressure) &&
		isFiniteNumberOrNull(value.lightLux) &&
		isFiniteNumberOrNull(value.soundRmsAdc) &&
		isFiniteNumberOrNull(value.soundEstimatedDb) &&
		isFiniteNumberOrNull(value.batteryAdcRaw) &&
		isFiniteNumberOrNull(value.batteryVoltageV) &&
		Array.isArray(value.qualityFlags) &&
		value.qualityFlags.every(isValidIdentifier)
	)
}

function isValidTimeAnchor(value: unknown): value is TimeAnchor | null {
	if (value === null) return true
	if (!isObject(value)) return false

	return (
		typeof value.utc === "string" &&
		!Number.isNaN(Date.parse(value.utc)) &&
		isNonNegativeInteger(value.elapsedSinceBootMs)
	)
}

function samplesHaveUniqueSequences(samples: Sample[]) {
	const sequences = new Set<number>()

	for (const sample of samples) {
		if (sequences.has(sample.sequence)) return false

		sequences.add(sample.sequence)
	}

	return true
}

function isObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object"
}

function isValidIdentifier(value: unknown): value is string {
	return typeof value === "string" && IDENTIFIER_PATTERN.test(value)
}

function isNonNegativeInteger(value: unknown): value is number {
	return (
		typeof value === "number" && Number.isSafeInteger(value) && value >= 0
	)
}

function isFiniteNumberOrNull(value: unknown): value is number | null {
	return (
		value === null || (typeof value === "number" && Number.isFinite(value))
	)
}
