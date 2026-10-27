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

	return (
		<div className="flex items-center justify-between gap-4 text-[0.82rem] text-[#8fa49d] max-[520px]:items-start max-[520px]:flex-col">
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
					className="flex items-center gap-2 text-[#f2c94c]"
					title={t("estimatedArrival", {
						date: new Date(nextReading.expectedAt).toLocaleString(
							i18n.resolvedLanguage,
						),
					})}
				>
					<span
						className={`relative size-4 shrink-0 rounded-full ${nextReading.isOverdue ? "animate-pulse" : ""}`}
						style={{
							background: `conic-gradient(#f2c94c ${nextReading.progress}%, #3e3a25 ${nextReading.progress}%)`,
						}}
					>
						<span className="absolute inset-[3px] rounded-full bg-[#12211c]" />
					</span>
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
