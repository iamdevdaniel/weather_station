import type { TimeRange } from "../types"

type TimestampedSample = { timestamp: number }

const HALF_HOUR_MS = 30 * 60 * 1_000
const HOUR_MS = 60 * 60 * 1_000
const HALF_DAY_MS = 12 * 60 * 60 * 1_000
const TODAY_INTERVAL_HOURS = [1, 2, 3, 4, 6, 12]

export function chartTickValues(
	data: TimestampedSample[],
	start: number,
	end: number,
	timeRange: TimeRange,
	maxTodayTicks: number,
) {
	if (data.length === 0) return undefined
	if (timeRange === "today") return todayBoundaries(start, end, maxTodayTicks)
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
		hourCycle: "h23",
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

function todayBoundaries(start: number, end: number, maxTicks: number) {
	const elapsed = Math.max(0, end - start)
	const intervalHours =
		TODAY_INTERVAL_HOURS.find(
			(hours) => Math.floor(elapsed / (hours * HOUR_MS)) + 1 <= maxTicks,
		) ?? 12

	return boundariesBetween(start, end, intervalHours * HOUR_MS)
}

function boundariesBetween(first: number, end: number, interval: number) {
	const boundaries: number[] = []
	for (let boundary = first; boundary <= end; boundary += interval)
		boundaries.push(boundary)
	return boundaries
}
