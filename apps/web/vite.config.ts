import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// SPA build (F-FE-01). Runtime config comes from /config.js, never from build-time env (F-FE-12).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173 },
  build: {
    target: "es2022",
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
  },
});
