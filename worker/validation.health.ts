import { type DeviceHealthRequest, SCHEMA_VERSION } from "./contracts"

const IDENTIFIER_PATTERN = /^[A-Za-z0-9._-]{1,80}$/

export function validateDeviceHealth(
	value: unknown,
): value is DeviceHealthRequest {
	if (!isObject(value)) return false

	return (
		value.schemaVersion === SCHEMA_VERSION &&
		isValidIdentifier(value.stationId) &&
		isValidIdentifier(value.bootId) &&
		isValidIdentifier(value.firmwareVersion) &&
		typeof value.sdOk === "boolean" &&
		Number.isSafeInteger(value.wifiRssi) &&
		isNonNegativeInteger(value.elapsedSinceBootMs) &&
		isFiniteNumberOrNull(value.temperatureC) &&
		isFiniteNumberOrNull(value.humidityPct) &&
		isFiniteNumberOrNull(value.barometricPressure) &&
		isFiniteNumberOrNull(value.lightLux) &&
		isFiniteNumberOrNull(value.soundRmsAdc) &&
		isFiniteNumberOrNull(value.batteryAdcRaw) &&
		isFiniteNumberOrNull(value.batteryVoltageV) &&
		Array.isArray(value.issues) &&
		value.issues.every(isValidIdentifier)
	)
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
