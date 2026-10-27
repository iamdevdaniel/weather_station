import { useTranslation } from "react-i18next"

type Props = {
	error: string | null
	onRetry: () => Promise<void>
}

export function ErrorBanner({ error, onRetry }: Props) {
	const { t } = useTranslation()
	if (!error) return null

	return (
		<div className="mt-6 flex items-center justify-between gap-5 rounded-[10px] border border-[#6b3b36] bg-[rgba(18,33,28,0.88)] px-3.5 py-3 text-[#ffc4bc] shadow-[0_18px_60px_rgba(0,0,0,0.2)]">
			<span>
				{error === "unknown"
					? t("couldNotLoad")
					: t("requestFailed", { status: error })}
			</span>
			<button
				type="button"
				className="cursor-pointer rounded-lg border border-[#345047] bg-[#13231e] px-3.5 py-2 text-[#eef8f4]"
				onClick={() => void onRetry()}
			>
				{t("retry")}
			</button>
		</div>
	)
}
