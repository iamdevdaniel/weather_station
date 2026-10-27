import { useCallback, useEffect, useMemo, useState } from "react"
import {
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts"

type Sample = {
	bootId: string
	sequence: number
	capturedAt: string | null
	receivedAt: string
	temperatureC: number | null
	humidityPct: number | null
	barometricPressure: number | null
	lightLux: number | null
	soundRmsAdc: number | null
	batteryVoltageV: number | null
}

type MetricKey = Exclude<
	keyof Sample,
	"bootId" | "sequence" | "capturedAt" | "receivedAt"
>

type TimeRange = "today" | "fourHours"

const readingIntervalMs = 20 * 60 * 1000

const metrics: Array<{
	key: MetricKey
	label: string
	unit: string
	digits: number
}> = [
	{ key: "temperatureC", label: "Temperature", unit: "°C", digits: 1 },
	{ key: "humidityPct", label: "Humidity", unit: "%", digits: 1 },
	{
		key: "barometricPressure",
		label: "Pressure",
		unit: "hPa",
		digits: 1,
	},
	{ key: "lightLux", label: "Light", unit: "lux", digits: 0 },
	{ key: "soundRmsAdc", label: "Noise", unit: "RMS", digits: 1 },
	{ key: "batteryVoltageV", label: "Battery", unit: "V", digits: 2 },
]

function sampleTime(sample: Sample) {
	return sample.capturedAt ?? sample.receivedAt
}

function App() {
	const [samples, setSamples] = useState<Sample[]>([])
	const [selectedMetric, setSelectedMetric] =
		useState<MetricKey>("temperatureC")
	const [timeRange, setTimeRange] = useState<TimeRange>("today")
	const [error, setError] = useState<string | null>(null)
	const [loading, setLoading] = useState(true)
	const [now, setNow] = useState(() => Date.now())

	const loadSamples = useCallback(async () => {
		try {
			const response = await fetch(
				"/api/v1/stations/station-1/samples?limit=288",
			)
			if (!response.ok)
				throw new Error(`Request failed (${response.status})`)

			const data = (await response.json()) as { samples: Sample[] }
			setSamples(data.samples)
			setError(null)
		} catch (requestError) {
			setError(
				requestError instanceof Error
					? requestError.message
					: "Could not load station data",
			)
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		void loadSamples()
	}, [loadSamples])

	const latestSampleAt = samples.at(-1)
		? new Date(sampleTime(samples.at(-1) as Sample)).getTime()
		: null

	useEffect(() => {
		let cancelled = false
		let timer: number | undefined

		const delayUntilNextCheck = () => {
			if (!latestSampleAt || !Number.isFinite(latestSampleAt))
				return 60_000

			const untilExpected =
				latestSampleAt + readingIntervalMs - Date.now()
			if (untilExpected > 30_000) return untilExpected - 30_000
			if (untilExpected > -2 * 60_000) return 15_000
			if (untilExpected > -10 * 60_000) return 30_000
			return 60_000
		}

		const schedule = () => {
			timer = window.setTimeout(async () => {
				await loadSamples()
				if (!cancelled) schedule()
			}, delayUntilNextCheck())
		}

		const refreshWhenVisible = async () => {
			if (document.visibilityState !== "visible") return
			window.clearTimeout(timer)
			await loadSamples()
			if (!cancelled) schedule()
		}

		schedule()
		document.addEventListener("visibilitychange", refreshWhenVisible)

		return () => {
			cancelled = true
			window.clearTimeout(timer)
			document.removeEventListener("visibilitychange", refreshWhenVisible)
		}
	}, [latestSampleAt, loadSamples])

	useEffect(() => {
		const timer = window.setInterval(() => setNow(Date.now()), 1_000)
		return () => window.clearInterval(timer)
	}, [])

	const latest = samples.at(-1)
	const selected =
		metrics.find((metric) => metric.key === selectedMetric) ?? metrics[0]
	const nextReading = useMemo(() => {
		if (!latest) return null

		const latestAt = new Date(sampleTime(latest)).getTime()
		if (!Number.isFinite(latestAt)) return null

		const expectedAt = latestAt + readingIntervalMs
		const remainingMs = expectedAt - now
		const absoluteSeconds = Math.ceil(Math.abs(remainingMs) / 1_000)
		const minutes = Math.floor(absoluteSeconds / 60)
		const seconds = String(absoluteSeconds % 60).padStart(2, "0")

		return {
			expectedAt,
			isOverdue: remainingMs <= 0,
			label:
				remainingMs > 0
					? `${minutes}:${seconds}`
					: `${minutes}:${seconds} late`,
			progress: Math.min(
				100,
				Math.max(0, ((now - latestAt) / readingIntervalMs) * 100),
			),
		}
	}, [latest, now])
	const chart = useMemo(() => {
		const end = Date.now()
		const start = new Date(end)
		if (timeRange === "today") {
			start.setHours(0, 0, 0, 0)
		} else {
			start.setTime(end - 4 * 60 * 60 * 1000)
		}

		return {
			start: start.getTime(),
			end,
			data: samples
				.map((sample) => ({
					...sample,
					timestamp: new Date(sampleTime(sample)).getTime(),
				}))
				.filter(
					(sample) =>
						Number.isFinite(sample.timestamp) &&
						sample.timestamp >= start.getTime() &&
						sample.timestamp <= end,
				),
		}
	}, [samples, timeRange])

	return (
		<main className="mx-auto w-[min(1080px,calc(100%-32px))] py-12 max-[680px]:w-[min(1080px,calc(100%-20px))] max-[680px]:py-7">
			<header className="flex items-center justify-between gap-5 max-[680px]:flex-col max-[680px]:items-start">
				<div>
					<p className="mb-1.5 text-[0.78rem] font-bold tracking-[0.14em] text-[#8fa49d] uppercase">
						Station 1
					</p>
					<h1 className="text-[clamp(2rem,5vw,3.75rem)] tracking-[-0.055em]">
						Balcony weather
					</h1>
				</div>
				<div className="flex items-center gap-2 text-[#bad0c8]">
					<span
						className={`size-2.5 rounded-full ${
							error
								? "bg-[#ff8a7a] shadow-[0_0_14px_#ff8a7a]"
								: "bg-[#59d6a2] shadow-[0_0_14px_#59d6a2]"
						}`}
					/>
					{error ? "Data unavailable" : "Live"}
				</div>
			</header>

			{error && (
				<div className="mt-6 flex items-center justify-between gap-5 rounded-[10px] border border-[#6b3b36] bg-[rgba(18,33,28,0.88)] px-3.5 py-3 text-[#ffc4bc] shadow-[0_18px_60px_rgba(0,0,0,0.2)]">
					<span>{error}</span>
					<button
						type="button"
						className="cursor-pointer rounded-lg border border-[#345047] bg-[#13231e] px-3.5 py-2 text-[#eef8f4]"
						onClick={() => void loadSamples()}
					>
						Retry
					</button>
				</div>
			)}

			<section className="mt-10 rounded-[14px] border border-[#263a34] bg-[rgba(18,33,28,0.88)] p-[22px] shadow-[0_18px_60px_rgba(0,0,0,0.2)] max-[680px]:mt-7 max-[680px]:p-4">
				<div className="flex items-center justify-between gap-5 max-[680px]:flex-col max-[680px]:items-start">
					<div>
						<p className="mb-1.5 text-[0.78rem] font-bold tracking-[0.14em] text-[#8fa49d] uppercase">
							{timeRange === "today" ? "Today" : "Last 4 hours"}
						</p>
						<h2 className="text-2xl">{selected.label}</h2>
					</div>
					<div className="flex items-center gap-2 max-[680px]:w-full max-[680px]:justify-between">
						<fieldset
							className="flex items-center gap-0 rounded-[10px] border border-[#345047] bg-[#0d1b17] p-[3px]"
							aria-label="Chart time range"
						>
							<button
								type="button"
								className={`cursor-pointer rounded-lg border-0 px-2.5 py-1.5 ${
									timeRange === "today"
										? "bg-[#28483e] text-[#eef8f4]"
										: "bg-transparent text-[#8fa49d]"
								}`}
								aria-pressed={timeRange === "today"}
								onClick={() => setTimeRange("today")}
							>
								Today
							</button>
							<button
								type="button"
								className={`cursor-pointer rounded-lg border-0 px-2.5 py-1.5 ${
									timeRange === "fourHours"
										? "bg-[#28483e] text-[#eef8f4]"
										: "bg-transparent text-[#8fa49d]"
								}`}
								aria-pressed={timeRange === "fourHours"}
								onClick={() => setTimeRange("fourHours")}
							>
								4 hours
							</button>
						</fieldset>
						<select
							className="rounded-lg border border-[#345047] bg-[#13231e] py-[9px] pr-[34px] pl-3 text-[#eef8f4]"
							aria-label="Chart measurement"
							value={selectedMetric}
							onChange={(event) =>
								setSelectedMetric(
									event.target.value as MetricKey,
								)
							}
						>
							{metrics.map((metric) => (
								<option key={metric.key} value={metric.key}>
									{metric.label}
								</option>
							))}
						</select>
					</div>
				</div>

				<div className="my-6 mb-3.5 h-[330px] max-[680px]:h-[280px]">
					{chart.data.length === 0 && !loading ? (
						<p className="grid h-full place-items-center text-[#8fa49d]">
							No readings in this range.
						</p>
					) : (
						<ResponsiveContainer width="100%" height="100%">
							<LineChart
								data={chart.data}
								margin={{ left: 0, right: 12 }}
							>
								<CartesianGrid
									stroke="#263a34"
									vertical={false}
								/>
								<XAxis
									dataKey="timestamp"
									type="number"
									scale="time"
									domain={[chart.start, chart.end]}
									minTickGap={34}
									stroke="#8fa49d"
									tickFormatter={(value) =>
										new Date(value).toLocaleTimeString([], {
											hour: "2-digit",
											minute: "2-digit",
										})
									}
								/>
								<YAxis
									domain={["auto", "auto"]}
									stroke="#8fa49d"
									unit={
										selected.unit === "°C" ? "°" : undefined
									}
								/>
								<Tooltip
									labelFormatter={(value) =>
										new Date(Number(value)).toLocaleString()
									}
									formatter={(value) => [
										`${Number(value).toFixed(selected.digits)} ${selected.unit}`,
										selected.label,
									]}
									contentStyle={{
										background: "#13231e",
										border: "1px solid #345047",
										borderRadius: "8px",
									}}
								/>
								<Line
									type="monotone"
									dataKey={selectedMetric}
									stroke="#59d6a2"
									strokeWidth={2}
									dot={false}
									connectNulls={false}
								/>
							</LineChart>
						</ResponsiveContainer>
					)}
				</div>
				<div className="flex items-center justify-between gap-4 text-[0.82rem] text-[#8fa49d] max-[520px]:items-start max-[520px]:flex-col">
					<p>
						{latest
							? `Last reading ${new Date(sampleTime(latest)).toLocaleString()}`
							: "Waiting for data"}
					</p>
					{nextReading && (
						<div
							className="flex items-center gap-2 text-[#f2c94c]"
							title={`Estimated arrival ${new Date(nextReading.expectedAt).toLocaleString()}`}
						>
							<span
								className={`relative size-4 shrink-0 rounded-full ${nextReading.isOverdue ? "animate-pulse" : ""}`}
								style={{
									background: `conic-gradient(#f2c94c ${nextReading.progress}%, #3e3a25 ${nextReading.progress}%)`,
								}}
							>
								<span className="absolute inset-[3px] rounded-full bg-[#12211c]" />
							</span>
							<span className="tabular-nums">
								{nextReading.isOverdue
									? `Waiting for data · ${nextReading.label}`
									: `New data in ${nextReading.label}`}
							</span>
						</div>
					)}
				</div>
			</section>
		</main>
	)
}

export default App
