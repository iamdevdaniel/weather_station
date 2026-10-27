import { useTranslation } from "react-i18next"

const languages = ["en", "es"] as const

export function LanguageSwitcher() {
	const { t, i18n } = useTranslation()

	return (
		<nav
			className="fixed top-3 left-3 z-10 flex rounded-lg border border-[#345047] bg-[#0d1b17] p-[3px] shadow-lg"
			aria-label={t("language")}
		>
			{languages.map((language) => (
				<button
					key={language}
					type="button"
					className={`cursor-pointer rounded-md px-2.5 py-1.5 text-sm ${i18n.resolvedLanguage === language ? "bg-[#28483e] text-[#eef8f4]" : "text-[#8fa49d]"}`}
					aria-pressed={i18n.resolvedLanguage === language}
					onClick={() => void i18n.changeLanguage(language)}
				>
					{language.toUpperCase()}
				</button>
			))}
		</nav>
	)
}
