ALTER TABLE uploads
ADD COLUMN dropped_samples INTEGER NOT NULL DEFAULT 0 CHECK (dropped_samples >= 0);

ALTER TABLE samples
ADD COLUMN barometric_pressure REAL;

ALTER TABLE daily_summaries
ADD COLUMN barometric_pressure_min REAL;

ALTER TABLE daily_summaries
ADD COLUMN barometric_pressure_avg REAL;

ALTER TABLE daily_summaries
ADD COLUMN barometric_pressure_max REAL;
