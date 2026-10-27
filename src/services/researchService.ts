import type { ResearchDataset, ReviewAction, ReviewItem } from "@/types";
import { MOCK_RESEARCH, MOCK_REVIEW_QUEUE } from "@/data/mockData";
import type { AppConfig } from "./config";
import { requestJson } from "./http";
import { sleep } from "./sleep";
import { parseResearchDataset, parseReviewQueue } from "./validate";

/** Extracted research records and the human review workflow. */
export interface ResearchService {
  getDataset(signal?: AbortSignal): Promise<ResearchDataset>;
  getReviewQueue(signal?: AbortSignal): Promise<ReviewItem[]>;
  /** Persists a review decision. Resolves only once the backend has accepted it. */
  submitReview(itemId: string, action: ReviewAction, value?: string): Promise<void>;
}

const clone = <T>(v: T): T => structuredClone(v);

export function createMockResearchService({ delayMs = 250 }: { delayMs?: number } = {}): ResearchService {
  return {
    async getDataset(signal) {
      await sleep(delayMs, signal);
      return clone(MOCK_RESEARCH);
    },
    async getReviewQueue(signal) {
      await sleep(delayMs, signal);
      return clone(MOCK_REVIEW_QUEUE);
    },
    async submitReview() {
      await sleep(delayMs);
    },
  };
}

/**
 * Platform REST API, as defined by the prototype's DataService (see README, "Platform API contract"):
 *   GET  {base}/records           -> { papers, records, checkedValueCount? }
 *   GET  {base}/review            -> ReviewItem[]
 *   POST {base}/review/:id        <- { action, value }
 */
export function createHttpResearchService(config: AppConfig): ResearchService {
  const base = config.platformApiBase;
  const service = "The platform";
  return {
    getDataset: (signal) =>
      requestJson(`${base}/records`, { signal, timeoutMs: config.timeoutMs, service, parse: (r) => parseResearchDataset(r, service) }),
    getReviewQueue: (signal) =>
      requestJson(`${base}/review`, { signal, timeoutMs: config.timeoutMs, service, parse: (r) => parseReviewQueue(r, service) }),
    submitReview: (itemId, action, value) =>
      requestJson(`${base}/review/${encodeURIComponent(itemId)}`, {
        method: "POST",
        body: { action, value },
        timeoutMs: config.timeoutMs,
        service,
        parse: () => undefined,
      }),
  };
}
