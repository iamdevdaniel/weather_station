import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
	root: "ui",
	plugins: [react(), tailwindcss()],
	publicDir: "../.local/firmware-assets",
	build: {
		outDir: "../.local/worker-assets",
		emptyOutDir: true,
	},
})
