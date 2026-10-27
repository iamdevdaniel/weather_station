import { useTranslation } from "react-i18next"
import {
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts"
import type { Metric } from "../lib/metrics"
import type { MetricKey, Sample } from "../types"

type ChartSample = Sample & { timestamp: number }

type Props = {
	data: ChartSample[]
	start: number
	end: number
	loading: boolean
	selected: Metric
	selectedMetric: MetricKey
}

export function ReadingChart({
	data,
	start,
	end,
	loading,
	selected,
	selectedMetric,
}: Props) {
	const { t, i18n } = useTranslation()

	return (
		<div className="my-6 mb-3.5 h-[330px] max-[680px]:h-[280px]">
			{data.length === 0 && !loading ? (
				<p className="grid h-full place-items-center text-[#8fa49d]">
					{t("noReadings")}
				</p>
			) : (
				<ResponsiveContainer width="100%" height="100%">
					<LineChart data={data} margin={{ left: 0, right: 12 }}>
						<CartesianGrid stroke="#263a34" vertical={false} />
						<XAxis
							dataKey="timestamp"
							type="number"
							scale="time"
							domain={[start, end]}
							minTickGap={34}
							stroke="#8fa49d"
							tickFormatter={(value) =>
								new Date(value).toLocaleTimeString(
									i18n.resolvedLanguage,
									{ hour: "2-digit", minute: "2-digit" },
								)
							}
						/>
						<YAxis
							domain={["auto", "auto"]}
							stroke="#8fa49d"
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
	)
}
