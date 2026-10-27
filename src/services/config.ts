export type DataMode = "mock" | "live";
export type RouterMode = "browser" | "hash" | "memory";

export interface AppConfig {
  mode: DataMode;
  /** Ask Amplifi only. Defaults to `mode`, so chat can go live while the other screens stay on sample data. */
  chatMode: DataMode;
  /** Base URL of the platform REST API (papers, records, review, upload). */
  platformApiBase: string;
  /** Base URL of the server-side proxy in front of Amplifi. Credentials are added by the proxy. */
  amplifiProxyUrl: string;
  timeoutMs: number;
  maxUploadBytes: number;
  routerMode: RouterMode;
}

type Env = Record<string, string | boolean | undefined>;

const str = (v: unknown, fallback: string) => (typeof v === "string" && v.trim() ? v.trim() : fallback);
const num = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  options.includes(v as T) ? (v as T) : fallback;

export function readConfig(env: Env = import.meta.env): AppConfig {
  const mode = oneOf(env.VITE_DATA_MODE, ["mock", "live"] as const, "mock");
  return {
    mode,
    chatMode: oneOf(env.VITE_CHAT_MODE, ["mock", "live"] as const, mode),
    platformApiBase: str(env.VITE_PLATFORM_API_BASE, "/api").replace(/\/$/, ""),
    amplifiProxyUrl: str(env.VITE_AMPLIFI_PROXY_URL, "/amplifi").replace(/\/$/, ""),
    timeoutMs: num(env.VITE_REQUEST_TIMEOUT_MS, 30000),
    maxUploadBytes: num(env.VITE_MAX_UPLOAD_MB, 50) * 1024 * 1024,
    routerMode: oneOf(env.VITE_ROUTER_MODE, ["browser", "hash", "memory"] as const, "browser"),
  };
}
