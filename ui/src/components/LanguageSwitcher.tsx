import { useTranslation } from "react-i18next"

const languages = ["en", "es"] as const

export function LanguageSwitcher() {
	const { t, i18n } = useTranslation()

	return (
		<nav className="language-switcher" aria-label={t("language")}>
			{languages.map((language) => (
				<button
					key={language}
					type="button"
					className="language-button"
					data-active={i18n.resolvedLanguage === language}
					aria-pressed={i18n.resolvedLanguage === language}
					onClick={() => void i18n.changeLanguage(language)}
				>
					{language.toUpperCase()}
				</button>
			))}
		</nav>
	)
}
