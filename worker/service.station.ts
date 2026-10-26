import type { Env } from "./contracts"
import { errorResponse, jsonResponse } from "./http-response"
import {
	findLatestSample,
	findRecentSamples,
	findStation,
} from "./repository.station"

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

export async function getStationSamples(
	env: Env,
	stationId: string,
	requestedLimit: string | undefined,
) {
	const station = await findStation(env.DB, stationId)
	if (!station)
		return errorResponse(
			404,
			"unknown_station",
			"Station is not registered",
		)

	const parsedLimit = Number.parseInt(requestedLimit ?? "120", 10)
	const limit = Number.isFinite(parsedLimit)
		? Math.min(Math.max(parsedLimit, 1), 288)
		: 120
	const result = await findRecentSamples(env.DB, stationId, limit)

	return jsonResponse({ station, samples: result.results.reverse() })
}
