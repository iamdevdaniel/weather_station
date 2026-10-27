import { useTranslation } from "react-i18next"

export function StationHeader({ hasError }: { hasError: boolean }) {
	const { t } = useTranslation()

	return (
		<header className="flex items-center justify-between gap-5 max-[680px]:flex-col max-[680px]:items-start">
			<div>
				<p className="mb-1.5 text-[0.78rem] font-bold tracking-[0.14em] text-[#8fa49d] uppercase">
					{t("station")}
				</p>
				<h1 className="text-[clamp(2rem,5vw,3.75rem)] tracking-[-0.055em]">
					{t("balconyWeather")}
				</h1>
			</div>
			<div className="flex items-center gap-2 text-[#bad0c8]">
				<span
					className={`size-2.5 rounded-full ${
						hasError
							? "bg-[#ff8a7a] shadow-[0_0_14px_#ff8a7a]"
							: "bg-[#59d6a2] shadow-[0_0_14px_#59d6a2]"
					}`}
				/>
				{hasError ? t("dataUnavailable") : t("live")}
			</div>
		</header>
	)
}
