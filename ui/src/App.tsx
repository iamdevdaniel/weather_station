import { ErrorBanner } from "./components/ErrorBanner"
import { LanguageSwitcher } from "./components/LanguageSwitcher"
import { StationHeader } from "./components/StationHeader"
import { WeatherChartPanel } from "./components/WeatherChartPanel"
import { useStationSamples } from "./hooks/useStationSamples"

function App() {
	const station = useStationSamples()

	return (
		<main className="mx-auto w-[min(1080px,calc(100%-32px))] py-12 max-[680px]:w-[min(1080px,calc(100%-20px))] max-[680px]:py-7">
			<LanguageSwitcher />
			<StationHeader hasError={Boolean(station.error)} />
			<ErrorBanner error={station.error} onRetry={station.reload} />
			<WeatherChartPanel
				samples={station.samples}
				loading={station.loading}
				uploadIntervalSeconds={station.uploadIntervalSeconds}
			/>
		</main>
	)
}

export default App
