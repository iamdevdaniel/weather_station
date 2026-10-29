import { useTranslation } from "react-i18next"
import { useNextReading } from "../hooks/useNextReading"
import type { Sample } from "../types"

type Props = {
	hasError: boolean
	latest: Sample | undefined
	uploadIntervalSeconds: number | null
}

export function StationStatus({
	hasError,
	latest,
	uploadIntervalSeconds,
}: Props) {
	const { t } = useTranslation()
	const nextReading = useNextReading(latest, uploadIntervalSeconds)
	const state = hasError
		? "unavailable"
		: nextReading?.isOverdue
			? "delayed"
			: "live"
	const label =
		state === "unavailable"
			? t("dataUnavailable")
			: state === "delayed"
				? t("delayed")
				: t("live")

	return (
		<div className="live-badge" data-state={state} role="status">
			<span className="live-dot" data-state={state} />
			<span className="status-label">{label}</span>
		</div>
	)
}
