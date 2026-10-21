// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import process from "node:process";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Nitro preset: "vercel" on Vercel (Build Output API in .vercel/output),
// "node-server" everywhere else (standalone .output/server/index.mjs).
// Override with NITRO_PRESET if needed.
const nitroPreset =
  process.env.NITRO_PRESET ?? (process.env.VERCEL ? "vercel" : "node-server");

export default defineConfig({
  nitro: { preset: nitroPreset },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        // Must be before the /api catch-all — rewrites to FastAPI POST /ussd.
        "/api/ussd": {
          target: "http://127.0.0.1:8000",
          changeOrigin: true,
          rewrite: () => "/ussd",
        },
        "/api": { target: "http://127.0.0.1:8000", changeOrigin: true },
        "/health": { target: "http://127.0.0.1:8000", changeOrigin: true },
      },
    },
  },
});
