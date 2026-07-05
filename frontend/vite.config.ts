// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // Force-enable Nitro with the standalone Node server preset so the build always
  // emits `.output/server/index.mjs` (what render.yaml's startCommand runs).
  // Without this the plugin auto-skips Nitro when "No Lovable context" is detected
  // (e.g. on Render), producing only `dist/` and breaking the deploy.
  nitro: { preset: "node-server" },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    server: {
      port: 8081,
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
