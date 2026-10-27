import { useEffect, useMemo, useState } from "react"
import { sampleTime } from "../lib/samples"
import type { Sample } from "../types"

export function useNextReading(
	latest: Sample | undefined,
	uploadIntervalSeconds: number | null,
) {
	const [now, setNow] = useState(() => Date.now())

	useEffect(() => {
		const timer = window.setInterval(() => setNow(Date.now()), 1_000)
		return () => window.clearInterval(timer)
	}, [])

	return useMemo(() => {
		if (!latest || !uploadIntervalSeconds) return null

		const latestAt = new Date(sampleTime(latest)).getTime()
		if (!Number.isFinite(latestAt)) return null

		const intervalMs = uploadIntervalSeconds * 1_000
		const expectedAt = latestAt + intervalMs
		const remainingMs = expectedAt - now
		const absoluteSeconds = Math.ceil(Math.abs(remainingMs) / 1_000)
		const minutes = Math.floor(absoluteSeconds / 60)
		const seconds = String(absoluteSeconds % 60).padStart(2, "0")

		return {
			expectedAt,
			isOverdue: remainingMs <= 0,
			label: `${minutes}:${seconds}`,
			progress: Math.min(
				100,
				Math.max(0, ((now - latestAt) / intervalMs) * 100),
			),
		}
	}, [latest, now, uploadIntervalSeconds])
}
