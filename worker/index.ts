import { Hono } from "hono"
import type { Env } from "./contracts"
import { errorResponse } from "./http-response"
import { limitPublicApi, protectUploads } from "./middleware.security"
import { getCurrentStation } from "./service.station"
import { receiveUpload } from "./service.upload"

const app = new Hono<{ Bindings: Env }>()

app.get("/api/v1/health", (context) => context.json({ ok: true }))

app.use("/api/v1/uploads", protectUploads)
app.post("/api/v1/uploads", (context) =>
	receiveUpload(context.req.raw, context.env),
)

app.use("/api/v1/stations/*", limitPublicApi)
app.get("/api/v1/stations/:stationId/current", (context) =>
	getCurrentStation(context.env, context.req.param("stationId")),
)

app.notFound(() => errorResponse(404, "not_found", "Route not found"))

export default app
