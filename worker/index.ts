import { Hono } from "hono"
import type { Env } from "./contracts"
import { errorResponse } from "./http-response"
import { limitPublicApi, protectDeviceApi } from "./middleware.security"
import { getCachedStationSamples } from "./service.cache"
import { downloadFirmware } from "./service.firmware"
import { receiveDeviceHealth } from "./service.health"
import { getCurrentStation } from "./service.station"
import { receiveUpload } from "./service.upload"

const app = new Hono<{ Bindings: Env }>()

app.get("/api/v1/health", (context) => context.json({ ok: true }))

app.use("/api/v1/uploads", protectDeviceApi)
app.post("/api/v1/uploads", (context) =>
	receiveUpload(context.req.raw, context.env),
)

app.use("/api/v1/device-health", protectDeviceApi)
app.post("/api/v1/device-health", (context) =>
	receiveDeviceHealth(context.req.raw, context.env),
)

app.use("/api/v1/firmware/*", protectDeviceApi)
app.get("/api/v1/firmware/:version", (context) =>
	downloadFirmware(
		context.req.raw,
		context.env,
		context.req.param("version"),
	),
)

app.use("/api/v1/stations/*", limitPublicApi)
app.get("/api/v1/stations/:stationId/current", (context) =>
	getCurrentStation(context.env, context.req.param("stationId")),
)
app.get("/api/v1/stations/:stationId/samples", (context) =>
	getCachedStationSamples(
		context.env,
		context.req.param("stationId"),
		context.req.query("limit"),
	),
)

app.all("/api/*", () => errorResponse(404, "not_found", "Route not found"))
app.get("/firmware.bin", () =>
	errorResponse(404, "not_found", "Route not found"),
)
app.get("*", (context) => context.env.ASSETS.fetch(context.req.raw))

app.notFound(() => errorResponse(404, "not_found", "Route not found"))

export default app
