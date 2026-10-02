import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

/**
 * AD-3 / AD-16: the API proxy target comes from the endpoint Aspire injects via `WithReference(api)`
 * (`services__api__https__0` / `services__api__http__0`; Aspire 13.5 also injects `API_HTTPS` / `API_HTTP`).
 * The browser only ever talks to this origin, so cookies stay same-origin and no CORS is needed.
 */
const apiTarget =
  process.env.services__api__https__0 ??
  process.env.services__api__http__0 ??
  process.env.API_HTTPS ??
  process.env.API_HTTP ??
  "http://localhost:5139"

const port = process.env.PORT ? Number(process.env.PORT) : 5173

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port,
    strictPort: Boolean(process.env.PORT),
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
        // The local ASP.NET Core dev certificate is self-signed.
        secure: false,
      },
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
})
