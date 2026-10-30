/// <reference types="vitest" />
import { defineConfig, loadEnv, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  // Targets may come from the shell or from .env. Neither has a VITE_ prefix, so neither reaches the browser.
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const apiTarget = env.DEV_API_TARGET;
  // Everything the app shows comes through the Amplifi proxy, so /amplifi always goes to it (default port 8787).
  const amplifiTarget = env.AMPLIFI_PROXY_TARGET || apiTarget || "http://localhost:8787";
  const proxy: Record<string, ProxyOptions> = { "/amplifi": { target: amplifiTarget, changeOrigin: true } };
  if (apiTarget) proxy["/api"] = { target: apiTarget, changeOrigin: true };

  return {
    plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    server: {
      port: 5173,
      // VITE_AMPLIFI_PROXY_URL stays a relative path (/amplifi), so the browser only talks to its own origin
      // and never sees the Amplifi login.
      proxy,
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      css: false,
    },
  };
});
