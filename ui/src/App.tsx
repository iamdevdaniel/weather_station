import { useState } from "react"
import { ErrorBanner } from "./components/ErrorBanner"
import { LanguageSwitcher } from "./components/LanguageSwitcher"
import { StationHeader } from "./components/StationHeader"
import { StationStatus } from "./components/StationStatus"
import { WeatherChartPanel } from "./components/WeatherChartPanel"
import { useStationSamples } from "./hooks/useStationSamples"
import type { TimeRange } from "./types"

function App() {
	const [timeRange, setTimeRange] = useState<TimeRange>("today")
	const station = useStationSamples(timeRange)

	return (
		<main className="app-shell">
			<div className="app-header-row">
				<StationHeader />
				<LanguageSwitcher />
			</div>
			<div className="station-status-row">
				<StationStatus
					hasError={Boolean(station.error)}
					latest={station.samples.at(-1)}
					uploadIntervalSeconds={station.uploadIntervalSeconds}
				/>
			</div>
			<div className="chart-row">
				<ErrorBanner error={station.error} onRetry={station.reload} />
				<WeatherChartPanel
					samples={station.samples}
					loading={station.loading}
					uploadIntervalSeconds={station.uploadIntervalSeconds}
					timeRange={timeRange}
					onTimeRangeChange={setTimeRange}
				/>
			</div>
		</main>
	)
}

export default App
