import {
	PUBLIC_SAMPLES_CACHE_SECONDS,
	PUBLIC_SAMPLES_CACHE_VERSION,
	PUBLIC_SAMPLES_LIMIT,
} from "../shared/config"
import type { Env } from "./contracts"
import { getStationSamples } from "./service.station"

interface WaitUntilContext {
	waitUntil(promise: Promise<unknown>): void
}

function samplesCacheKey(origin: string, stationId: string) {
	const url = new URL(
		`/api/v1/stations/${encodeURIComponent(stationId)}/samples`,
		origin,
	)
	url.searchParams.set("limit", String(PUBLIC_SAMPLES_LIMIT))
	url.searchParams.set("_cache", PUBLIC_SAMPLES_CACHE_VERSION)
	return new Request(url, { method: "GET" })
}

function withCacheStatus(response: Response, status: "HIT" | "MISS") {
	const result = new Response(response.body, response)
	result.headers.set("X-Weather-Cache", status)
	return result
}

export async function getCachedStationSamples(
	request: Request,
	env: Env,
	stationId: string,
	requestedLimit: string | undefined,
	executionCtx: WaitUntilContext,
) {
	if (requestedLimit !== String(PUBLIC_SAMPLES_LIMIT)) {
		return getStationSamples(env, stationId, requestedLimit)
	}

	const cache = caches.default
	const cacheKey = samplesCacheKey(new URL(request.url).origin, stationId)
	const cached = await cache.match(cacheKey)
	if (cached) return withCacheStatus(cached, "HIT")

	const response = await getStationSamples(env, stationId, requestedLimit)
	if (!response.ok) return response

	const cacheable = withCacheStatus(response, "MISS")
	cacheable.headers.set(
		"Cache-Control",
		`public, max-age=0, s-maxage=${PUBLIC_SAMPLES_CACHE_SECONDS}`,
	)
	executionCtx.waitUntil(cache.put(cacheKey, cacheable.clone()))
	return cacheable
}

export function invalidateSamplesCache(
	origin: string,
	stationId: string,
	executionCtx: WaitUntilContext,
) {
	executionCtx.waitUntil(
		caches.default.delete(samplesCacheKey(origin, stationId)),
	)
}
