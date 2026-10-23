PRAGMA foreign_keys = ON;

CREATE TABLE stations (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  credential_hash TEXT,
  sample_interval_seconds INTEGER NOT NULL DEFAULT 60,
  upload_interval_seconds INTEGER NOT NULL DEFAULT 300,
  last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ingest_batches (
  station_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  boot_id TEXT NOT NULL,
  firmware_version TEXT NOT NULL,
  sample_count INTEGER NOT NULL,
  anchor_utc TEXT,
  anchor_elapsed_since_boot_ms INTEGER,
  received_at TEXT NOT NULL,
  PRIMARY KEY (station_id, batch_id),
  FOREIGN KEY (station_id) REFERENCES stations(id)
);

CREATE TABLE measurements (
  station_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  sample_id TEXT NOT NULL,
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
  PRIMARY KEY (station_id, sample_id),
  UNIQUE (station_id, boot_id, sequence),
  FOREIGN KEY (station_id, batch_id) REFERENCES ingest_batches(station_id, batch_id)
);

CREATE INDEX measurements_station_time
  ON measurements(station_id, captured_at);

CREATE TABLE daily_aggregates (
  station_id TEXT NOT NULL,
  day TEXT NOT NULL,
  sample_count INTEGER NOT NULL,
  temperature_min_c REAL,
  temperature_avg_c REAL,
  temperature_max_c REAL,
  humidity_min_pct REAL,
  humidity_avg_pct REAL,
  humidity_max_pct REAL,
  light_min_lux REAL,
  light_avg_lux REAL,
  light_max_lux REAL,
  sound_rms_min_adc REAL,
  sound_rms_avg_adc REAL,
  sound_rms_max_adc REAL,
  battery_min_v REAL,
  battery_avg_v REAL,
  battery_max_v REAL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (station_id, day),
  FOREIGN KEY (station_id) REFERENCES stations(id)
);

INSERT INTO stations (id, display_name)
VALUES ('station-1', 'Weather station 1');
