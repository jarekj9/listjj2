import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

// In development the API runs on :8000 (uvicorn); production uses nginx (see nginx.conf).
const apiTarget = process.env.API_TARGET || "http://localhost:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": resolve(projectRoot, "src") },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": apiTarget,
      "/mcp": apiTarget,
    },
  },
});
