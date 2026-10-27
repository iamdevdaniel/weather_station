export type Sample = {
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

export type MetricKey = Exclude<
	keyof Sample,
	"bootId" | "sequence" | "capturedAt" | "receivedAt"
>

export type TimeRange = "today" | "fourHours"

export type StationSamplesResponse = {
	station: { uploadIntervalSeconds: number }
	samples: Sample[]
}
