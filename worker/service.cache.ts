import { cache } from "cloudflare:workers"
import {
	PUBLIC_SAMPLES_CACHE_SECONDS,
	PUBLIC_SAMPLES_LIMIT,
} from "../shared/config"
import type { Env } from "./contracts"
import { getStationSamples } from "./service.station"

function samplesCacheTag(stationId: string) {
	return `station-samples-${stationId}`
}

export async function getCachedStationSamples(
	env: Env,
	stationId: string,
	requestedLimit: string | undefined,
) {
	const response = await getStationSamples(env, stationId, requestedLimit)
	if (!response.ok || requestedLimit !== String(PUBLIC_SAMPLES_LIMIT))
		return response

	const cacheable = new Response(response.body, response)
	cacheable.headers.set(
		"Cache-Control",
		`public, max-age=0, s-maxage=${PUBLIC_SAMPLES_CACHE_SECONDS}`,
	)
	cacheable.headers.set("Cache-Tag", samplesCacheTag(stationId))
	return cacheable
}

export async function invalidateSamplesCache(stationId: string) {
	try {
		const result = await cache.purge({ tags: [samplesCacheTag(stationId)] })
		if (!result.success)
			console.error("Global cache purge failed", result.errors)
	} catch (error) {
		console.error("Global cache purge failed", error)
	}
}
