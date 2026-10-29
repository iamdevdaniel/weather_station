import type { Sample, TimeRange } from "../types"

export function sampleTime(sample: Sample) {
	return sample.capturedAt ?? sample.receivedAt
}

export function chartSamples(samples: Sample[], timeRange: TimeRange) {
	const end = Date.now()
	const start = new Date(end)

	if (timeRange === "today") start.setHours(0, 0, 0, 0)
	else if (timeRange === "fourHours") start.setTime(end - 4 * 60 * 60 * 1_000)
	else {
		start.setDate(start.getDate() - 4)
		start.setHours(0, 0, 0, 0)
	}

	const startMs = start.getTime()
	return {
		start: startMs,
		end,
		data: samples
			.map((sample) => ({
				...sample,
				timestamp: new Date(sampleTime(sample)).getTime(),
			}))
			.filter(
				(sample) =>
					Number.isFinite(sample.timestamp) &&
					sample.timestamp >= startMs &&
					sample.timestamp <= end,
			),
	}
}
