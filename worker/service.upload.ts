import {
	type Env,
	MAX_UPLOAD_BYTES,
	SCHEMA_VERSION,
	type StationConfig,
} from "./contracts"
import { errorResponse, jsonResponse } from "./http-response"
import { findStationConfig } from "./repository.station"
import { findExistingUpload, storeUpload } from "./repository.upload"
import { validateUpload } from "./validation.upload"

export async function receiveUpload(request: Request, env: Env) {
	const authorization = request.headers.get("authorization")
	if (
		!env.DEVICE_API_TOKEN ||
		authorization !== `Bearer ${env.DEVICE_API_TOKEN}`
	) {
		return errorResponse(401, "unauthorized", "Invalid device credential")
	}

	const bodyText = await request.text()
	const uploadSizeBytes = new TextEncoder().encode(bodyText).byteLength
	if (uploadSizeBytes > MAX_UPLOAD_BYTES) {
		return errorResponse(
			413,
			"upload_too_large",
			`Request exceeds ${MAX_UPLOAD_BYTES / 1024} KB`,
		)
	}

	let parsedUpload: unknown
	try {
		parsedUpload = JSON.parse(bodyText)
	} catch {
		return errorResponse(
			400,
			"invalid_json",
			"Request body is not valid JSON",
		)
	}

	const receivedSchemaVersion =
		parsedUpload !== null && typeof parsedUpload === "object"
			? (parsedUpload as Record<string, unknown>).schemaVersion
			: undefined
	if (receivedSchemaVersion !== SCHEMA_VERSION) {
		return errorResponse(
			409,
			"unsupported_schema_version",
			`Expected schemaVersion ${SCHEMA_VERSION}`,
		)
	}

	if (!validateUpload(parsedUpload)) {
		return errorResponse(
			400,
			"invalid_upload",
			"Request does not match the upload contract",
		)
	}

	const upload = parsedUpload
	const config = await findStationConfig(env.DB, upload.stationId)
	if (!config) {
		return errorResponse(
			404,
			"unknown_station",
			"Station is not registered",
		)
	}

	const existingUpload = await findExistingUpload(
		env.DB,
		upload.stationId,
		upload.uploadId,
	)
	if (existingUpload) return uploadResponse(upload.uploadId, config)

	const receivedAt = new Date().toISOString()
	await storeUpload(env.DB, upload, receivedAt)

	return uploadResponse(upload.uploadId, config)
}

function uploadResponse(uploadId: string, config: StationConfig) {
	return jsonResponse({
		schemaVersion: SCHEMA_VERSION,
		uploadId,
		stored: true,
		config,
		firmwareUpdate: null,
	})
}
