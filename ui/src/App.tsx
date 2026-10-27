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

function formatValue(value: number | null, digits: number) {
	return value === null ? "—" : value.toFixed(digits)
}

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
		const timer = window.setInterval(() => void loadSamples(), 60_000)
		return () => window.clearInterval(timer)
	}, [loadSamples])

	const latest = samples.at(-1)
	const selected =
		metrics.find((metric) => metric.key === selectedMetric) ?? metrics[0]
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
		<main>
			<header>
				<div>
					<p className="eyebrow">Station 1</p>
					<h1>Balcony weather</h1>
				</div>
				<div className="status">
					<span className={error ? "dot error" : "dot"} />
					{error ? "Data unavailable" : "Live"}
				</div>
			</header>

			{error && (
				<div className="error-message">
					<span>{error}</span>
					<button type="button" onClick={() => void loadSamples()}>
						Retry
					</button>
				</div>
			)}

			<section className="cards" aria-label="Latest measurements">
				{metrics.map((metric) => (
					<article className="card" key={metric.key}>
						<p>{metric.label}</p>
						<strong>
							{loading && !latest
								? "…"
								: formatValue(
										latest?.[metric.key] ?? null,
										metric.digits,
									)}
							{latest?.[metric.key] !== null &&
								latest?.[metric.key] !== undefined && (
									<small>{metric.unit}</small>
								)}
						</strong>
					</article>
				))}
			</section>

			<section className="chart-panel">
				<div className="chart-header">
					<div>
						<p className="eyebrow">
							{timeRange === "today" ? "Today" : "Last 4 hours"}
						</p>
						<h2>{selected.label}</h2>
					</div>
					<div className="chart-controls">
						<fieldset
							className="range-switch"
							aria-label="Chart time range"
						>
							<button
								type="button"
								className={
									timeRange === "today" ? "active" : ""
								}
								aria-pressed={timeRange === "today"}
								onClick={() => setTimeRange("today")}
							>
								Today
							</button>
							<button
								type="button"
								className={
									timeRange === "fourHours" ? "active" : ""
								}
								aria-pressed={timeRange === "fourHours"}
								onClick={() => setTimeRange("fourHours")}
							>
								4 hours
							</button>
						</fieldset>
						<select
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

				<div className="chart">
					{chart.data.length === 0 && !loading ? (
						<p className="empty">No readings in this range.</p>
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
				<p className="updated">
					{latest
						? `Last reading ${new Date(sampleTime(latest)).toLocaleString()}`
						: "Waiting for data"}
				</p>
			</section>
		</main>
	)
}

export default App
