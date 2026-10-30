/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AMPLIFI_PROXY_URL?: string;
  readonly VITE_AMPLIFI_PAPERS?: string;
  readonly VITE_REQUEST_TIMEOUT_MS?: string;
  readonly VITE_ROUTER_MODE?: "browser" | "hash" | "memory";
}
