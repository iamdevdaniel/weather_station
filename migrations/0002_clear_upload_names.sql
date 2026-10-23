PRAGMA foreign_keys = ON;

ALTER TABLE ingest_batches RENAME TO uploads;
ALTER TABLE uploads RENAME COLUMN batch_id TO upload_id;

ALTER TABLE measurements RENAME TO samples;
ALTER TABLE samples RENAME COLUMN batch_id TO upload_id;

DROP INDEX IF EXISTS measurements_station_time;
CREATE INDEX samples_station_time ON samples(station_id, captured_at);

ALTER TABLE daily_aggregates RENAME TO daily_summaries;
