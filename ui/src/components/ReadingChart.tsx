import { useTranslation } from "react-i18next"
import {
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	type XAxisTickContentProps,
	YAxis,
} from "recharts"
import { chartTickValues, formatChartTick } from "../lib/chartTimeAxis"
import type { Metric } from "../lib/metrics"
import type { MetricKey, Sample, TimeRange } from "../types"
import { FiveDayAxisTick } from "./FiveDayAxisTick"

type ChartSample = Sample & { timestamp: number }

type Props = {
	data: ChartSample[]
	start: number
	end: number
	loading: boolean
	selected: Metric
	selectedMetric: MetricKey
	timeRange: TimeRange
}

export function ReadingChart({
	data,
	start,
	end,
	loading,
	selected,
	selectedMetric,
	timeRange,
}: Props) {
	const { t, i18n } = useTranslation()
	const ticks = chartTickValues(data, start, end, timeRange)
	const fiveDayTick = (props: XAxisTickContentProps) => (
		<FiveDayAxisTick {...props} language={i18n.resolvedLanguage} />
	)

	return (
		<div className="chart-stage">
			{data.length === 0 && !loading ? (
				<p className="empty-chart">{t("noReadings")}</p>
			) : (
				<ResponsiveContainer width="100%" height="100%">
					<LineChart data={data} margin={{ left: 0, right: 12 }}>
						<CartesianGrid stroke="#43382d" vertical={false} />
						<XAxis
							dataKey="timestamp"
							type="number"
							scale="time"
							domain={[start, end]}
							height={30}
							minTickGap={34}
							stroke="#bba995"
							tick={
								timeRange === "fiveDays"
									? fiveDayTick
									: undefined
							}
							ticks={ticks}
							tickFormatter={(value) =>
								formatChartTick(value, i18n.resolvedLanguage)
							}
						/>
						<YAxis
							domain={["auto", "auto"]}
							stroke="#bba995"
							tickFormatter={(value: number) =>
								value.toFixed(selected.axisDigits)
							}
							unit={selected.unit === "°C" ? "°" : undefined}
						/>
						<Tooltip
							labelFormatter={(value) =>
								new Date(Number(value)).toLocaleString(
									i18n.resolvedLanguage,
								)
							}
							formatter={(value) => [
								`${Number(value).toFixed(selected.digits)} ${selected.unit}`,
								t(selected.labelKey),
							]}
							contentStyle={{
								background: "#211b16",
								border: "2px solid #f5e8d4",
								borderRadius: "12px",
								boxShadow: "4px 4px 0 #050403",
								color: "#f5e8d4",
							}}
						/>
						<Line
							type="monotone"
							dataKey={selectedMetric}
							stroke="#ff592d"
							strokeWidth={3}
							dot={false}
							connectNulls={false}
						/>
					</LineChart>
				</ResponsiveContainer>
			)}
		</div>
	)
}
