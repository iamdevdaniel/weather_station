import { useTranslation } from "react-i18next"
import { type Metric, metrics } from "../lib/metrics"
import type { MetricKey, TimeRange } from "../types"

type Props = {
	selected: Metric
	selectedMetric: MetricKey
	timeRange: TimeRange
	onMetricChange: (metric: MetricKey) => void
	onTimeRangeChange: (range: TimeRange) => void
}

export function ChartControls({
	selected,
	selectedMetric,
	timeRange,
	onMetricChange,
	onTimeRangeChange,
}: Props) {
	const { t } = useTranslation()
	const rangeLabel =
		timeRange === "today"
			? t("today")
			: timeRange === "fourHours"
				? t("lastFourHours")
				: t("lastFiveDays")

	return (
		<div className="chart-controls">
			<div>
				<p className="eyebrow">{rangeLabel}</p>
				<h2 className="metric-title">{t(selected.labelKey)}</h2>
			</div>
			<div className="chart-actions">
				<fieldset
					className="range-control"
					aria-label={t("chartTimeRange")}
				>
					<RangeButton
						active={timeRange === "today"}
						onClick={() => onTimeRangeChange("today")}
					>
						{t("today")}
					</RangeButton>
					<RangeButton
						active={timeRange === "fourHours"}
						onClick={() => onTimeRangeChange("fourHours")}
					>
						{t("fourHours")}
					</RangeButton>
					<RangeButton
						active={timeRange === "fiveDays"}
						onClick={() => onTimeRangeChange("fiveDays")}
					>
						{t("fiveDays")}
					</RangeButton>
				</fieldset>
				<select
					className="metric-select"
					aria-label={t("chartMeasurement")}
					value={selectedMetric}
					onChange={(event) =>
						onMetricChange(event.target.value as MetricKey)
					}
				>
					{metrics.map((metric) => (
						<option key={metric.key} value={metric.key}>
							{t(metric.labelKey)}
						</option>
					))}
				</select>
			</div>
		</div>
	)
}

type RangeButtonProps = {
	active: boolean
	children: React.ReactNode
	onClick: () => void
}

function RangeButton({ active, children, onClick }: RangeButtonProps) {
	return (
		<button
			type="button"
			className="range-button"
			data-active={active}
			aria-pressed={active}
			onClick={onClick}
		>
			{children}
		</button>
	)
}
