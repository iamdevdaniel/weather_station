import type { MetricKey } from "../types"

export type Metric = {
	key: MetricKey
	labelKey: string
	unit: string
	digits: number
	axisDigits: 0 | 2
}

export const metrics: Metric[] = [
	{
		key: "temperatureC",
		labelKey: "metrics.temperature",
		unit: "°C",
		digits: 1,
		axisDigits: 2,
	},
	{
		key: "humidityPct",
		labelKey: "metrics.humidity",
		unit: "%",
		digits: 1,
		axisDigits: 2,
	},
	{
		key: "barometricPressure",
		labelKey: "metrics.pressure",
		unit: "hPa",
		digits: 1,
		axisDigits: 2,
	},
	{
		key: "lightLux",
		labelKey: "metrics.light",
		unit: "lux",
		digits: 0,
		axisDigits: 0,
	},
	{
		key: "soundRmsAdc",
		labelKey: "metrics.noise",
		unit: "RMS",
		digits: 1,
		axisDigits: 0,
	},
	{
		key: "batteryVoltageV",
		labelKey: "metrics.battery",
		unit: "V",
		digits: 2,
		axisDigits: 2,
	},
]
