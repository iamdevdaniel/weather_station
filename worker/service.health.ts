import type { Env } from "./contracts"
import { SCHEMA_VERSION } from "./contracts"
import { errorResponse, jsonResponse } from "./http-response"
import { storeDeviceHealth } from "./repository.health"
import { findStationConfig } from "./repository.station"
import { validateDeviceHealth } from "./validation.health"

export async function receiveDeviceHealth(request: Request, env: Env) {
	let parsedHealth: unknown
	try {
		parsedHealth = await request.json()
	} catch {
		return errorResponse(
			400,
			"invalid_json",
			"Request body is not valid JSON",
		)
	}

	if (!validateDeviceHealth(parsedHealth)) {
		return errorResponse(
			400,
			"invalid_device_health",
			"Request does not match the device health contract",
		)
	}

	const health = parsedHealth
	if (!(await findStationConfig(env.DB, health.stationId))) {
		return errorResponse(
			404,
			"unknown_station",
			"Station is not registered",
		)
	}

	await storeDeviceHealth(env.DB, health, new Date().toISOString())

	return jsonResponse({
		schemaVersion: SCHEMA_VERSION,
		bootId: health.bootId,
		stored: true,
	})
}
