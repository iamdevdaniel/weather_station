interface Env {
  DB: D1Database;
  DEVICE_API_TOKEN: string;
}

const SCHEMA_VERSION = 1;
const MAX_SAMPLES_PER_UPLOAD = 10;
const MAX_UPLOAD_BYTES = 8 * 1024;

interface TimeAnchor {
  utc: string;
  elapsedSinceBootMs: number;
}

interface Sample {
  sampleId: string;
  sequence: number;
  elapsedSinceBootMs: number;
  temperatureC: number | null;
  humidityPct: number | null;
  lightLux: number | null;
  soundRmsAdc: number | null;
  soundEstimatedDb: number | null;
  batteryAdcRaw: number | null;
  batteryVoltageV: number | null;
  qualityFlags: string[];
}

interface UploadRequest {
  schemaVersion: number;
  stationId: string;
  uploadId: string;
  bootId: string;
  firmwareVersion: string;
  timeAnchor: TimeAnchor | null;
  samples: Sample[];
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

const apiError = (status: number, code: string, message: string) =>
  json({ error: { code, message } }, status);

function isFiniteNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._-]{1,80}$/.test(value);
}

function validateUpload(value: unknown): value is UploadRequest {
  if (!value || typeof value !== "object") return false;
  const upload = value as Partial<UploadRequest>;
  if (
    upload.schemaVersion !== SCHEMA_VERSION ||
    !validIdentifier(upload.stationId) ||
    !validIdentifier(upload.uploadId) ||
    !validIdentifier(upload.bootId) ||
    !validIdentifier(upload.firmwareVersion) ||
    !Array.isArray(upload.samples) ||
    upload.samples.length < 1 ||
    upload.samples.length > MAX_SAMPLES_PER_UPLOAD
  ) return false;

  if (upload.timeAnchor !== null) {
    const anchor = upload.timeAnchor;
    if (
      !anchor ||
      typeof anchor.utc !== "string" ||
      Number.isNaN(Date.parse(anchor.utc)) ||
      !Number.isSafeInteger(anchor.elapsedSinceBootMs) ||
      anchor.elapsedSinceBootMs < 0
    ) return false;
  }

  const sampleIds = new Set<string>();
  const sequences = new Set<number>();
  return upload.samples.every((sample) => {
    if (
      !sample ||
      !validIdentifier(sample.sampleId) ||
      !Number.isSafeInteger(sample.sequence) || sample.sequence < 0 ||
      !Number.isSafeInteger(sample.elapsedSinceBootMs) || sample.elapsedSinceBootMs < 0 ||
      !isFiniteNumberOrNull(sample.temperatureC) ||
      !isFiniteNumberOrNull(sample.humidityPct) ||
      !isFiniteNumberOrNull(sample.lightLux) ||
      !isFiniteNumberOrNull(sample.soundRmsAdc) ||
      !isFiniteNumberOrNull(sample.soundEstimatedDb) ||
      !isFiniteNumberOrNull(sample.batteryAdcRaw) ||
      !isFiniteNumberOrNull(sample.batteryVoltageV) ||
      !Array.isArray(sample.qualityFlags) ||
      !sample.qualityFlags.every((flag) => validIdentifier(flag)) ||
      sampleIds.has(sample.sampleId) ||
      sequences.has(sample.sequence)
    ) return false;
    sampleIds.add(sample.sampleId);
    sequences.add(sample.sequence);
    return true;
  });
}

function sampleTime(sample: Sample, anchor: TimeAnchor | null) {
  if (!anchor) return { capturedAt: null, timeState: "missing" } as const;
  const timestamp = Date.parse(anchor.utc) + sample.elapsedSinceBootMs - anchor.elapsedSinceBootMs;
  if (!Number.isFinite(timestamp)) return { capturedAt: null, timeState: "missing" } as const;
  return {
    capturedAt: new Date(timestamp).toISOString(),
    timeState: sample.elapsedSinceBootMs === anchor.elapsedSinceBootMs ? "synced" : "derived",
  } as const;
}

function authorized(request: Request, env: Env) {
  const expected = env.DEVICE_API_TOKEN;
  return Boolean(expected) && request.headers.get("authorization") === `Bearer ${expected}`;
}

async function stationConfig(env: Env, stationId: string) {
  return env.DB.prepare(
    `SELECT sample_interval_seconds, upload_interval_seconds
       FROM stations WHERE id = ?`,
  ).bind(stationId).first<{
    sample_interval_seconds: number;
    upload_interval_seconds: number;
  }>();
}

async function receiveUpload(request: Request, env: Env) {
  if (!authorized(request, env)) return apiError(401, "unauthorized", "Invalid device credential");

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_UPLOAD_BYTES) return apiError(413, "upload_too_large", "Request exceeds 8 KB");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "invalid_json", "Request body is not valid JSON");
  }

  const receivedSchemaVersion = body && typeof body === "object"
    ? (body as Record<string, unknown>).schemaVersion
    : undefined;
  if (receivedSchemaVersion !== SCHEMA_VERSION) {
    return apiError(
      409,
      "unsupported_schema_version",
      `Expected schemaVersion ${SCHEMA_VERSION}`,
    );
  }

  if (!validateUpload(body)) return apiError(400, "invalid_upload", "Request does not match the upload contract");

  const config = await stationConfig(env, body.stationId);
  if (!config) return apiError(404, "unknown_station", "Station is not registered");

  const existing = await env.DB.prepare(
    "SELECT sample_count FROM uploads WHERE station_id = ? AND upload_id = ?",
  ).bind(body.stationId, body.uploadId).first<{ sample_count: number }>();

  if (existing) {
    return json({
      schemaVersion: SCHEMA_VERSION,
      uploadId: body.uploadId,
      stored: true,
      accepted: 0,
      duplicates: existing.sample_count,
      serverTime: new Date().toISOString(),
      config: {
        sampleIntervalSeconds: config.sample_interval_seconds,
        uploadIntervalSeconds: config.upload_interval_seconds,
      },
    });
  }

  const receivedAt = new Date().toISOString();
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO uploads
       (station_id, upload_id, schema_version, boot_id, firmware_version, sample_count,
        anchor_utc, anchor_elapsed_since_boot_ms, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      body.stationId,
      body.uploadId,
      body.schemaVersion,
      body.bootId,
      body.firmwareVersion,
      body.samples.length,
      body.timeAnchor?.utc ?? null,
      body.timeAnchor?.elapsedSinceBootMs ?? null,
      receivedAt,
    ),
  ];

  // Five rows use 85 bound values, below D1's 100-value query limit.
  const sampleChunkSize = 5;
  let sampleStatementCount = 0;
  for (let start = 0; start < body.samples.length; start += sampleChunkSize) {
    const chunk = body.samples.slice(start, start + sampleChunkSize);
    const values: unknown[] = [];
    const placeholders: string[] = [];

    for (const sample of chunk) {
      const time = sampleTime(sample, body.timeAnchor);
      placeholders.push("(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
      values.push(
        body.stationId, body.uploadId, sample.sampleId, body.bootId, sample.sequence,
        time.capturedAt, time.timeState, sample.elapsedSinceBootMs,
        sample.temperatureC, sample.humidityPct, sample.lightLux,
        sample.soundRmsAdc, sample.soundEstimatedDb,
        sample.batteryAdcRaw, sample.batteryVoltageV,
        JSON.stringify(sample.qualityFlags), receivedAt,
      );
    }

    statements.push(env.DB.prepare(
      `INSERT OR IGNORE INTO samples
       (station_id, upload_id, sample_id, boot_id, sequence, captured_at,
        time_state, elapsed_since_boot_ms, temperature_c, humidity_pct,
        light_lux, sound_rms_adc, sound_estimated_db, battery_adc_raw,
        battery_voltage_v, quality_flags, received_at)
       VALUES ${placeholders.join(", ")}`,
    ).bind(...values));
    sampleStatementCount++;
  }

  statements.push(env.DB.prepare(
    "UPDATE stations SET last_seen_at = ?, updated_at = ? WHERE id = ?",
  ).bind(receivedAt, receivedAt, body.stationId));

  const results = await env.DB.batch(statements);
  const accepted = results.slice(1, 1 + sampleStatementCount)
    .reduce((sum, result) => sum + Number(result.meta.changes ?? 0), 0);

  return json({
    schemaVersion: SCHEMA_VERSION,
    uploadId: body.uploadId,
    stored: true,
    accepted,
    duplicates: body.samples.length - accepted,
    serverTime: receivedAt,
    config: {
      sampleIntervalSeconds: config.sample_interval_seconds,
      uploadIntervalSeconds: config.upload_interval_seconds,
    },
  });
}

async function current(env: Env, stationId: string) {
  const station = await env.DB.prepare(
    `SELECT id, display_name, sample_interval_seconds, upload_interval_seconds, last_seen_at
       FROM stations WHERE id = ?`,
  ).bind(stationId).first();
  if (!station) return apiError(404, "unknown_station", "Station is not registered");

  const sample = await env.DB.prepare(
    `SELECT * FROM samples WHERE station_id = ?
       ORDER BY received_at DESC, sequence DESC LIMIT 1`,
  ).bind(stationId).first();
  return json({ station, sample });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/v1/health") {
      return json({ ok: true, serverTime: new Date().toISOString() });
    }
    if (request.method === "POST" && url.pathname === "/api/v1/uploads") {
      return receiveUpload(request, env);
    }
    const match = url.pathname.match(/^\/api\/v1\/stations\/([^/]+)\/current$/);
    if (request.method === "GET" && match) return current(env, decodeURIComponent(match[1]));
    return apiError(404, "not_found", "Route not found");
  },
};
