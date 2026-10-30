import type { ExplorerData } from "@/types";
import type { AppConfig } from "./config";
import { ApiError, requestJson } from "./http";
import { isObj } from "./validate";

/**
 * The Explorer's data, live from Amplifi through the proxy.
 *
 * GET  {proxy}/explorer          the latest data built from Amplifi's answers (404 before the first refresh)
 * GET  {proxy}/explorer/status   how far a refresh has got
 * POST {proxy}/explorer/refresh  asks Amplifi about every paper again and checks the answers against the PDFs
 */
export interface RefreshStatus {
  state: "idle" | "running" | "done" | "failed";
  startedAt: string | null;
  finishedAt: string | null;
  stage: string | null;
  /** Amplifi's answers so far, two questions per paper. */
  done: number;
  failed: number;
  total: number;
  error: string | null;
}

export interface ExplorerClient {
  /** The latest data, or null before the first extraction. */
  load(signal?: AbortSignal): Promise<ExplorerData | null>;
  status(signal?: AbortSignal): Promise<RefreshStatus>;
  refresh(): Promise<RefreshStatus>;
}

const SERVICE = "The Amplifi proxy";
const LISTS = ["anodes", "fullCells", "materials", "performance"] as const;

export function parseExplorerData(raw: unknown): ExplorerData {
  if (!isObj(raw) || !isObj(raw.papers) || LISTS.some((k) => !Array.isArray(raw[k]))) {
    throw new ApiError("invalid_response", "The Amplifi proxy sent the Explorer's data in an unexpected format.");
  }
  return raw as unknown as ExplorerData;
}

export function parseRefreshStatus(raw: unknown): RefreshStatus {
  if (!isObj(raw) || typeof raw.state !== "string") throw new ApiError("invalid_response", "The Amplifi proxy sent a refresh status in an unexpected format.");
  return raw as unknown as RefreshStatus;
}

export function createHttpExplorerClient(config: AppConfig, fetchImpl?: typeof fetch): ExplorerClient {
  const base = `${config.amplifiProxyUrl}/explorer`;
  // Reading the stored data is quick; only a refresh takes minutes, and that runs on the proxy.
  const opts = { timeoutMs: 30000, service: SERVICE, useDetail: true, fetchImpl };
  return {
    async load(signal) {
      try {
        return await requestJson(base, { ...opts, signal, parse: parseExplorerData });
      } catch (e) {
        if (e instanceof ApiError && e.kind === "not_found") return null;
        throw e;
      }
    },
    status: (signal) => requestJson(`${base}/status`, { ...opts, signal, parse: parseRefreshStatus }),
    refresh: () => requestJson(`${base}/refresh`, { ...opts, method: "POST", parse: parseRefreshStatus }),
  };
}
