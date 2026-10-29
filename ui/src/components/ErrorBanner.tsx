import { useTranslation } from "react-i18next"

type Props = {
	error: string | null
	onRetry: () => Promise<void>
}

export function ErrorBanner({ error, onRetry }: Props) {
	const { t } = useTranslation()
	if (!error) return null

	return (
		<div className="error-banner">
			<span>
				{error === "unknown"
					? t("couldNotLoad")
					: t("requestFailed", { status: error })}
			</span>
			<button
				type="button"
				className="retry-button"
				onClick={() => void onRetry()}
			>
				{t("retry")}
			</button>
		</div>
	)
}
