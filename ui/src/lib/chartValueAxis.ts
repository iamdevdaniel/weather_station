const TEMPERATURE_STEP_C = 5

type TemperatureSample = { temperatureC: number | null }

export function temperatureYAxis(data: TemperatureSample[]) {
	const values = data
		.map((sample) => sample.temperatureC)
		.filter(
			(value): value is number =>
				value !== null && Number.isFinite(value),
		)

	if (values.length === 0) return undefined

	let minimum =
		Math.floor(Math.min(...values) / TEMPERATURE_STEP_C) *
		TEMPERATURE_STEP_C
	let maximum =
		Math.ceil(Math.max(...values) / TEMPERATURE_STEP_C) * TEMPERATURE_STEP_C

	if (minimum === maximum) {
		minimum -= TEMPERATURE_STEP_C
		maximum += TEMPERATURE_STEP_C
	}

	const ticks: number[] = []
	for (let value = minimum; value <= maximum; value += TEMPERATURE_STEP_C)
		ticks.push(value)

	return {
		domain: [minimum, maximum] as [number, number],
		ticks,
		majorTicks: ticks.filter((value) => value % 10 === 0),
	}
}
