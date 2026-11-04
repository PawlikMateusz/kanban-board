import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { fileURLToPath, URL } from "node:url"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: true,
    port: Number(process.env.PORT) || 5173,
    proxy: {
      "/api": process.env.PB_PROXY_TARGET || "http://localhost:8090",
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "tanstack-vendor": ["@tanstack/react-query", "@tanstack/react-router"],
          "dnd-vendor": ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
        },
      },
    },
  },
})
