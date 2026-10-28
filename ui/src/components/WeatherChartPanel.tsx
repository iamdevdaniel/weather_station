import { useMemo, useState } from "react"
import { metrics } from "../lib/metrics"
import { chartSamples } from "../lib/samples"
import type { MetricKey, Sample, TimeRange } from "../types"
import { ChartControls } from "./ChartControls"
import { ReadingChart } from "./ReadingChart"
import { ReadingStatus } from "./ReadingStatus"

type Props = {
	samples: Sample[]
	loading: boolean
	uploadIntervalSeconds: number | null
	timeRange: TimeRange
	onTimeRangeChange: (range: TimeRange) => void
}

export function WeatherChartPanel({
	samples,
	loading,
	uploadIntervalSeconds,
	timeRange,
	onTimeRangeChange,
}: Props) {
	const [selectedMetric, setSelectedMetric] =
		useState<MetricKey>("temperatureC")
	const selected =
		metrics.find((metric) => metric.key === selectedMetric) ?? metrics[0]
	const chart = useMemo(
		() => chartSamples(samples, timeRange),
		[samples, timeRange],
	)

	return (
		<section className="mt-10 rounded-[14px] border border-[#263a34] bg-[rgba(18,33,28,0.88)] p-[22px] shadow-[0_18px_60px_rgba(0,0,0,0.2)] max-[680px]:mt-7 max-[680px]:p-4">
			<ChartControls
				selected={selected}
				selectedMetric={selectedMetric}
				timeRange={timeRange}
				onMetricChange={setSelectedMetric}
				onTimeRangeChange={onTimeRangeChange}
			/>
			<ReadingChart
				data={chart.data}
				start={chart.start}
				end={chart.end}
				loading={loading}
				selected={selected}
				selectedMetric={selectedMetric}
			/>
			<ReadingStatus
				latest={samples.at(-1)}
				uploadIntervalSeconds={uploadIntervalSeconds}
			/>
		</section>
	)
}
