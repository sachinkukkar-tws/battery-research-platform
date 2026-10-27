/// <reference types="vitest" />
import { defineConfig, loadEnv, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  // Targets may come from the shell or from .env. Neither has a VITE_ prefix, so neither reaches the browser.
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const apiTarget = env.DEV_API_TARGET;
  const amplifiTarget = env.AMPLIFI_PROXY_TARGET || apiTarget;
  const proxy: Record<string, ProxyOptions> = {};
  if (apiTarget) proxy["/api"] = { target: apiTarget, changeOrigin: true };
  if (amplifiTarget) proxy["/amplifi"] = { target: amplifiTarget, changeOrigin: true };

  return {
    plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    server: {
      port: 5173,
      // In live mode, point VITE_PLATFORM_API_BASE / VITE_AMPLIFI_PROXY_URL at relative paths
      // (e.g. /api, /amplifi) and proxy them to your backend here so the browser never sees credentials.
      proxy: Object.keys(proxy).length ? proxy : undefined,
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      css: false,
    },
  };
});
