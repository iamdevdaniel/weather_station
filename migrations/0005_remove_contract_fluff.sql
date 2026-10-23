ALTER TABLE stations
DROP COLUMN credential_hash;

CREATE TABLE samples_v2 (
  station_id TEXT NOT NULL,
  upload_id TEXT NOT NULL,
  boot_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  captured_at TEXT,
  time_state TEXT NOT NULL CHECK (time_state IN ('synced', 'derived', 'missing')),
  elapsed_since_boot_ms INTEGER NOT NULL,
  temperature_c REAL,
  humidity_pct REAL,
  light_lux REAL,
  sound_rms_adc REAL,
  sound_estimated_db REAL,
  battery_adc_raw INTEGER,
  battery_voltage_v REAL,
  quality_flags TEXT NOT NULL DEFAULT '[]',
  received_at TEXT NOT NULL,
  barometric_pressure REAL,
  PRIMARY KEY (station_id, boot_id, sequence),
  FOREIGN KEY (station_id, upload_id) REFERENCES uploads(station_id, upload_id)
);

INSERT INTO samples_v2 (
  station_id, upload_id, boot_id, sequence, captured_at, time_state,
  elapsed_since_boot_ms, temperature_c, humidity_pct, light_lux,
  sound_rms_adc, sound_estimated_db, battery_adc_raw, battery_voltage_v,
  quality_flags, received_at, barometric_pressure
)
SELECT
  station_id, upload_id, boot_id, sequence, captured_at, time_state,
  elapsed_since_boot_ms, temperature_c, humidity_pct, light_lux,
  sound_rms_adc, sound_estimated_db, battery_adc_raw, battery_voltage_v,
  quality_flags, received_at, barometric_pressure
FROM samples;

DROP TABLE samples;
ALTER TABLE samples_v2 RENAME TO samples;
CREATE INDEX samples_station_time ON samples(station_id, captured_at);
