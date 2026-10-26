import type { DeviceHealthRequest } from "./contracts"

export async function storeDeviceHealth(
	database: D1Database,
	health: DeviceHealthRequest,
	checkedAt: string,
) {
	await database
		.prepare(
			`INSERT INTO device_health_checks
			 (station_id, boot_id, firmware_version, checked_at, sd_ok, wifi_rssi,
			  elapsed_since_boot_ms, temperature_c, humidity_pct,
			  barometric_pressure, light_lux, sound_rms_adc, battery_adc_raw,
			  battery_voltage_v, issues)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT (station_id, boot_id) DO UPDATE SET
			  firmware_version = excluded.firmware_version,
			  checked_at = excluded.checked_at,
			  sd_ok = excluded.sd_ok,
			  wifi_rssi = excluded.wifi_rssi,
			  elapsed_since_boot_ms = excluded.elapsed_since_boot_ms,
			  temperature_c = excluded.temperature_c,
			  humidity_pct = excluded.humidity_pct,
			  barometric_pressure = excluded.barometric_pressure,
			  light_lux = excluded.light_lux,
			  sound_rms_adc = excluded.sound_rms_adc,
			  battery_adc_raw = excluded.battery_adc_raw,
			  battery_voltage_v = excluded.battery_voltage_v,
			  issues = excluded.issues`,
		)
		.bind(
			health.stationId,
			health.bootId,
			health.firmwareVersion,
			checkedAt,
			health.sdOk ? 1 : 0,
			health.wifiRssi,
			health.elapsedSinceBootMs,
			health.temperatureC,
			health.humidityPct,
			health.barometricPressure,
			health.lightLux,
			health.soundRmsAdc,
			health.batteryAdcRaw,
			health.batteryVoltageV,
			JSON.stringify(health.issues),
		)
		.run()
}
