import { useCallback, useEffect, useMemo, useState } from "react"
import { PUBLIC_SAMPLES_LIMIT, STATION_ID } from "../../../shared/config"
import { sampleTime } from "../lib/samples"
import type { Sample, StationSamplesResponse } from "../types"

const fallbackPollMs = 60_000

export function useStationSamples() {
	const [samples, setSamples] = useState<Sample[]>([])
	const [uploadIntervalSeconds, setUploadIntervalSeconds] = useState<
		number | null
	>(null)
	const [error, setError] = useState<string | null>(null)
	const [loading, setLoading] = useState(true)

	const reload = useCallback(async () => {
		try {
			const response = await fetch(
				`/api/v1/stations/${STATION_ID}/samples?limit=${PUBLIC_SAMPLES_LIMIT}`,
			)
			if (!response.ok) throw new Error(String(response.status))

			const data = (await response.json()) as StationSamplesResponse
			setSamples(data.samples)
			setUploadIntervalSeconds(data.station.uploadIntervalSeconds)
			setError(null)
		} catch (requestError) {
			setError(
				requestError instanceof Error
					? requestError.message
					: "unknown",
			)
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		void reload()
	}, [reload])

	const latestSampleAt = useMemo(() => {
		const latest = samples.at(-1)
		return latest ? new Date(sampleTime(latest)).getTime() : null
	}, [samples])

	useEffect(() => {
		let cancelled = false
		let timer: number | undefined

		const nextDelay = () => {
			if (
				!latestSampleAt ||
				!Number.isFinite(latestSampleAt) ||
				!uploadIntervalSeconds
			)
				return fallbackPollMs

			const untilExpected =
				latestSampleAt + uploadIntervalSeconds * 1_000 - Date.now()
			if (untilExpected > 30_000) return untilExpected - 30_000
			if (untilExpected > -2 * 60_000) return 15_000
			if (untilExpected > -10 * 60_000) return 30_000
			return fallbackPollMs
		}

		const schedule = () => {
			timer = window.setTimeout(async () => {
				await reload()
				if (!cancelled) schedule()
			}, nextDelay())
		}

		const refreshWhenVisible = async () => {
			if (document.visibilityState !== "visible") return
			window.clearTimeout(timer)
			await reload()
			if (!cancelled) schedule()
		}

		schedule()
		document.addEventListener("visibilitychange", refreshWhenVisible)
		return () => {
			cancelled = true
			window.clearTimeout(timer)
			document.removeEventListener("visibilitychange", refreshWhenVisible)
		}
	}, [latestSampleAt, reload, uploadIntervalSeconds])

	return { samples, uploadIntervalSeconds, error, loading, reload }
}
