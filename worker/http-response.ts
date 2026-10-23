export function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json; charset=utf-8" },
	})
}

export function errorResponse(status: number, code: string, message: string) {
	return jsonResponse({ error: { code, message } }, status)
}
