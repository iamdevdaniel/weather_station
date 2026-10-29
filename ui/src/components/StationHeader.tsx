import { useTranslation } from "react-i18next"

export function StationHeader() {
	const { t } = useTranslation()

	return (
		<header className="station-header">
			<div className="station-title-group">
				<div className="station-mark" aria-hidden="true">
					⛅
				</div>
				<div>
					<h1 className="station-title">{t("balconyWeather")}</h1>
				</div>
			</div>
		</header>
	)
}
