import type { Env } from "./contracts"
import { errorResponse, jsonResponse } from "./http-response"
import { findLatestSample, findStation } from "./repository.station"

export async function getCurrentStation(env: Env, stationId: string) {
	const station = await findStation(env.DB, stationId)
	if (!station)
		return errorResponse(
			404,
			"unknown_station",
			"Station is not registered",
		)

	const latestSample = await findLatestSample(env.DB, stationId)

	return jsonResponse({ station, sample: latestSample })
}
