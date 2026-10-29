import type { XAxisTickContentProps } from "recharts"
import { formatFiveDayDate } from "../lib/chartTimeAxis"

type Props = XAxisTickContentProps & {
	language: string | undefined
}

export function FiveDayAxisTick({ x, y, payload, language }: Props) {
	if (x === undefined || y === undefined || !payload) return null
	const timestamp = Number(payload.value)
	if (new Date(timestamp).getHours() !== 0) return null

	const label = formatFiveDayDate(timestamp, language)
	return (
		<g transform={`translate(${x},${y})`}>
			<text fill="#bba995" textAnchor="middle">
				<tspan x="0" dy="0.9em">
					{label}
				</tspan>
			</text>
		</g>
	)
}
