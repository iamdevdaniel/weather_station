import type { TimeRange } from "../types"

type TimestampedSample = { timestamp: number }

const HALF_HOUR_MS = 30 * 60 * 1_000
const HALF_DAY_MS = 12 * 60 * 60 * 1_000

export function chartTickValues(
	data: TimestampedSample[],
	start: number,
	end: number,
	timeRange: TimeRange,
) {
	if (timeRange === "today" || data.length === 0) return undefined
	if (timeRange === "fiveDays")
		return boundariesBetween(start, end, HALF_DAY_MS)

	return halfHourBoundaries(start, end)
}

export function formatChartTick(
	timestamp: number,
	language: string | undefined,
) {
	return new Date(timestamp).toLocaleTimeString(language, {
		hour: "2-digit",
		minute: "2-digit",
	})
}

export function formatFiveDayDate(
	timestamp: number,
	language: string | undefined,
) {
	return new Date(timestamp).toLocaleDateString(language, {
		month: "short",
		day: "numeric",
	})
}

function halfHourBoundaries(start: number, end: number) {
	const first = new Date(start)
	first.setSeconds(0, 0)
	const minute = first.getMinutes()
	const isHalfHour = minute === 0 || minute === 30
	if (isHalfHour && first.getTime() < start) first.setMinutes(minute + 30)
	else if (!isHalfHour) first.setMinutes(minute < 30 ? 30 : 60)

	return boundariesBetween(first.getTime(), end, HALF_HOUR_MS)
}

function boundariesBetween(first: number, end: number, interval: number) {
	const boundaries: number[] = []
	for (let boundary = first; boundary <= end; boundary += interval)
		boundaries.push(boundary)
	return boundaries
}
