CREATE TABLE device_health_checks (
  station_id TEXT NOT NULL,
  boot_id TEXT NOT NULL,
  firmware_version TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  sd_ok INTEGER NOT NULL CHECK (sd_ok IN (0, 1)),
  wifi_rssi INTEGER NOT NULL,
  elapsed_since_boot_ms INTEGER NOT NULL,
  temperature_c REAL,
  humidity_pct REAL,
  barometric_pressure REAL,
  light_lux REAL,
  sound_rms_adc REAL,
  battery_adc_raw INTEGER,
  battery_voltage_v REAL,
  issues TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (station_id, boot_id),
  FOREIGN KEY (station_id) REFERENCES stations(id)
);

CREATE INDEX device_health_checks_station_time
ON device_health_checks(station_id, checked_at);
