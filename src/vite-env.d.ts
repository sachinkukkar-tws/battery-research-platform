/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_MODE?: "mock" | "live";
  readonly VITE_CHAT_MODE?: "mock" | "live";
  readonly VITE_PLATFORM_API_BASE?: string;
  readonly VITE_AMPLIFI_PROXY_URL?: string;
  readonly VITE_REQUEST_TIMEOUT_MS?: string;
  readonly VITE_MAX_UPLOAD_MB?: string;
  readonly VITE_ROUTER_MODE?: "browser" | "hash" | "memory";
}
