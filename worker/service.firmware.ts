import type { Env, FirmwareUpdate } from "./contracts"
import { errorResponse } from "./http-response"

const SHA256_PATTERN = /^[a-f0-9]{64}$/i

export function findFirmwareUpdate(
	env: Env,
	currentVersion: string,
	origin: string,
): FirmwareUpdate | null {
	if (
		!env.FIRMWARE_VERSION ||
		env.FIRMWARE_VERSION === currentVersion ||
		!SHA256_PATTERN.test(env.FIRMWARE_SHA256)
	)
		return null

	return {
		version: env.FIRMWARE_VERSION,
		url: `${origin}/api/v1/firmware/${encodeURIComponent(env.FIRMWARE_VERSION)}`,
		sha256: env.FIRMWARE_SHA256,
	}
}

export async function downloadFirmware(
	request: Request,
	env: Env,
	version: string,
) {
	if (version !== env.FIRMWARE_VERSION)
		return errorResponse(404, "firmware_not_found", "Firmware not found")

	const assetUrl = new URL("/firmware.bin", request.url)
	const asset = await env.ASSETS.fetch(assetUrl)
	if (!asset.ok || !asset.body)
		return errorResponse(
			503,
			"firmware_unavailable",
			"Firmware file is unavailable",
		)

	const headers = new Headers(asset.headers)
	headers.set("content-type", "application/octet-stream")
	headers.set("cache-control", "private, no-store")
	return new Response(asset.body, { status: 200, headers })
}
