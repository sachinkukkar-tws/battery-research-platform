export type RouterMode = "browser" | "hash" | "memory";

export interface AppConfig {
  /** Base URL of the server-side proxy in front of Amplifi. Credentials are added by the proxy. */
  amplifiProxyUrl: string;
  /** IDs of the papers loaded in Amplifi. The chat offers only these; empty means every paper Amplifi read. */
  amplifiPapers: string[];
  timeoutMs: number;
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
const list = (v: unknown) => (typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);

export function readConfig(env: Env = import.meta.env): AppConfig {
  return {
    amplifiProxyUrl: str(env.VITE_AMPLIFI_PROXY_URL, "/amplifi").replace(/\/$/, ""),
    amplifiPapers: list(env.VITE_AMPLIFI_PAPERS),
    timeoutMs: num(env.VITE_REQUEST_TIMEOUT_MS, 120000),
    routerMode: oneOf(env.VITE_ROUTER_MODE, ["browser", "hash", "memory"] as const, "browser"),
  };
}

/** Whether the chat can offer a paper: only the papers loaded in Amplifi, when they're listed. */
export function canAskAbout(config: AppConfig, paperId: string): boolean {
  return config.amplifiPapers.length === 0 || config.amplifiPapers.includes(paperId);
}
