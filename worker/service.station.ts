import { PUBLIC_SAMPLES_ALLOWED_LIMITS } from "../shared/config"
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

	const limitText = requestedLimit ?? "120"
	if (!/^\d+$/.test(limitText))
		return errorResponse(400, "invalid_limit", "Unsupported sample limit")

	const limit = Number(limitText)
	if (
		String(limit) !== limitText ||
		!(PUBLIC_SAMPLES_ALLOWED_LIMITS as readonly number[]).includes(limit)
	)
		return errorResponse(400, "invalid_limit", "Unsupported sample limit")

	const result = await findRecentSamples(env.DB, stationId, limit)

	return jsonResponse({ station, samples: result.results.reverse() })
}
