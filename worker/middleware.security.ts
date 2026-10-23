import { createMiddleware } from "hono/factory"
import type { Env } from "./contracts"
import { errorResponse } from "./http-response"

export const protectUploads = createMiddleware<{ Bindings: Env }>(
	async (context, next) => {
		const authorization = context.req.header("authorization")
		if (
			!context.env.DEVICE_API_TOKEN ||
			authorization !== `Bearer ${context.env.DEVICE_API_TOKEN}`
		) {
			return errorResponse(
				401,
				"unauthorized",
				"Invalid device credential",
			)
		}

		const rateLimit = await context.env.UPLOAD_RATE_LIMITER.limit({
			key: "device-uploads",
		})
		if (!rateLimit.success) {
			return errorResponse(
				429,
				"rate_limited",
				"Too many upload attempts",
			)
		}

		return next()
	},
)

export const limitPublicApi = createMiddleware<{ Bindings: Env }>(
	async (context, next) => {
		const clientIp = context.req.header("cf-connecting-ip") ?? "unknown"
		const rateLimit = await context.env.PUBLIC_API_RATE_LIMITER.limit({
			key: clientIp,
		})
		if (!rateLimit.success) {
			return errorResponse(429, "rate_limited", "Too many requests")
		}

		return next()
	},
)
