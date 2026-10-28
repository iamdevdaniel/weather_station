export const STATION_ID = "station-1"
export const PUBLIC_SAMPLES_LIMIT = 288
export const PUBLIC_SAMPLES_FIVE_DAYS_LIMIT = 5 * PUBLIC_SAMPLES_LIMIT
export const PUBLIC_SAMPLES_MAX_LIMIT = PUBLIC_SAMPLES_FIVE_DAYS_LIMIT

// Uploads invalidate this cache. The TTL is a cross-location safety fallback.
export const PUBLIC_SAMPLES_CACHE_SECONDS = 20 * 60
