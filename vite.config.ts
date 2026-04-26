import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

// SIM XR website — production-only Vite config.
// Manus-specific plugins removed during 2026-04-27 migration off Manus hosting:
//   - vite-plugin-manus-runtime (injected session-replay/screenshot tooling)
//   - local vitePluginManusDebugCollector (dev-only log collector)
//   - @builder.io/vite-plugin-jsx-loc (third-party JSX inspector tags)
// Server allowedHosts for *.manus.computer also dropped — dev runs on localhost.

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
});
