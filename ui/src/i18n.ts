import i18n from "i18next"
import { initReactI18next } from "react-i18next"

const savedLanguage = window.localStorage.getItem("weather-language")
const browserLanguage = navigator.language.toLowerCase().startsWith("es")
	? "es"
	: "en"

void i18n.use(initReactI18next).init({
	resources: {
		en: {
			translation: {
				language: "Language",
				station: "Station 1",
				balconyWeather: "Balcony weather",
				live: "Live",
				delayed: "Delayed",
				dataUnavailable: "Unavailable",
				requestFailed: "Request failed ({{status}})",
				couldNotLoad: "Could not load station data",
				retry: "Retry",
				today: "Today",
				lastFourHours: "Last 4 hours",
				lastFiveDays: "Last 5 days",
				fourHours: "4 hours",
				fiveDays: "5 days",
				chartTimeRange: "Chart time range",
				chartMeasurement: "Chart measurement",
				noReadings: "No readings in this range.",
				lastReading: "Last reading {{date}}",
				waitingForData: "Waiting for data",
				estimatedArrival: "Estimated arrival {{date}}",
				waitingLate: "Waiting for data · {{time}} late",
				newDataIn: "New data in {{time}}",
				metrics: {
					temperature: "Temperature",
					humidity: "Humidity",
					pressure: "Pressure",
					light: "Light",
					noise: "Noise",
					battery: "Battery",
				},
			},
		},
		es: {
			translation: {
				language: "Idioma",
				station: "Estación 1",
				balconyWeather: "Clima del balcón",
				live: "En vivo",
				delayed: "Retrasada",
				dataUnavailable: "No disponible",
				requestFailed: "La solicitud falló ({{status}})",
				couldNotLoad: "No se pudieron cargar los datos",
				retry: "Reintentar",
				today: "Hoy",
				lastFourHours: "Últimas 4 horas",
				lastFiveDays: "Últimos 5 días",
				fourHours: "4 horas",
				fiveDays: "5 días",
				chartTimeRange: "Rango de tiempo del gráfico",
				chartMeasurement: "Medición del gráfico",
				noReadings: "No hay lecturas en este rango.",
				lastReading: "Última lectura {{date}}",
				waitingForData: "Esperando datos",
				estimatedArrival: "Llegada estimada {{date}}",
				waitingLate: "Esperando datos · {{time}} de retraso",
				newDataIn: "Nuevos datos en {{time}}",
				metrics: {
					temperature: "Temperatura",
					humidity: "Humedad",
					pressure: "Presión",
					light: "Luz",
					noise: "Ruido",
					battery: "Batería",
				},
			},
		},
	},
	lng:
		savedLanguage === "en" || savedLanguage === "es"
			? savedLanguage
			: browserLanguage,
	fallbackLng: "en",
	interpolation: { escapeValue: false },
})

document.documentElement.lang = i18n.resolvedLanguage ?? "en"
i18n.on("languageChanged", (language) => {
	document.documentElement.lang = language
	window.localStorage.setItem("weather-language", language)
})

export default i18n
