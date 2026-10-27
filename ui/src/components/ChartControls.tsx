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

	return (
		<div className="flex items-center justify-between gap-5 max-[680px]:flex-col max-[680px]:items-start">
			<div>
				<p className="mb-1.5 text-[0.78rem] font-bold tracking-[0.14em] text-[#8fa49d] uppercase">
					{timeRange === "today" ? t("today") : t("lastFourHours")}
				</p>
				<h2 className="text-2xl">{t(selected.labelKey)}</h2>
			</div>
			<div className="flex items-center gap-2 max-[680px]:w-full max-[680px]:justify-between">
				<fieldset
					className="flex items-center gap-0 rounded-[10px] border border-[#345047] bg-[#0d1b17] p-[3px]"
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
				</fieldset>
				<select
					className="rounded-lg border border-[#345047] bg-[#13231e] py-[9px] pr-[34px] pl-3 text-[#eef8f4]"
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
			className={`cursor-pointer rounded-lg border-0 px-2.5 py-1.5 ${
				active
					? "bg-[#28483e] text-[#eef8f4]"
					: "bg-transparent text-[#8fa49d]"
			}`}
			aria-pressed={active}
			onClick={onClick}
		>
			{children}
		</button>
	)
}
