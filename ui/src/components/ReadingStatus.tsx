import { useTranslation } from "react-i18next"
import { useNextReading } from "../hooks/useNextReading"
import { sampleTime } from "../lib/samples"
import type { Sample } from "../types"

type Props = {
	latest: Sample | undefined
	uploadIntervalSeconds: number | null
}

export function ReadingStatus({ latest, uploadIntervalSeconds }: Props) {
	const { t, i18n } = useTranslation()
	const nextReading = useNextReading(latest, uploadIntervalSeconds)
	const countdownState = nextReading?.isOverdue ? "delayed" : "live"

	return (
		<div className="reading-status">
			<p>
				{latest
					? t("lastReading", {
							date: new Date(sampleTime(latest)).toLocaleString(
								i18n.resolvedLanguage,
							),
						})
					: t("waitingForData")}
			</p>
			{nextReading && (
				<div
					className="next-reading"
					data-state={countdownState}
					title={t("estimatedArrival", {
						date: new Date(nextReading.expectedAt).toLocaleString(
							i18n.resolvedLanguage,
						),
					})}
				>
					<span
						className={`countdown-ring ${nextReading.isOverdue ? "animate-pulse" : ""}`}
						style={{
							background: `conic-gradient(currentColor ${nextReading.progress}%, #4d4234 ${nextReading.progress}%)`,
						}}
					/>
					<span className="tabular-nums">
						{nextReading.isOverdue
							? t("waitingLate", { time: nextReading.label })
							: t("newDataIn", { time: nextReading.label })}
					</span>
				</div>
			)}
		</div>
	)
}
