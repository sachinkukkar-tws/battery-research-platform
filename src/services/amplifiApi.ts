import type { AmplifiAnswer, AskRequest, Citation } from "@/types";
import { amplifiPaperId, extractCitationIds, libraryPaperId } from "@/domain/citations";
import type { AppConfig } from "./config";
import { ApiError, requestJson } from "./http";
import { isObj } from "./validate";

/**
 * Question answering over the ingested papers.
 *
 * IMPORTANT: Amplifi's own API has not been verified (no docs or repository were available).
 * The browser therefore never calls Amplifi directly. The HTTP adapter calls a server-side proxy
 * whose contract is defined here and in the README. The proxy holds Amplifi credentials and maps
 * these requests onto Amplifi's real endpoints once they are confirmed.
 */
export interface AmplifiClient {
  ask(request: AskRequest): Promise<AmplifiAnswer>;
}

/* ---------------- Proxy contract (owned by this frontend) ----------------
 * POST {proxy}/chat
 *   request:  { question: string, scope: string | null, history: {role, text}[], conversationId: string | null }
 *             (scope is the paper ID as Amplifi's file names write it: C01 for the library's C1)
 *   response: { answer: string, citations?: { paperId: string, page: string | null }[], conversationId?: string | null }
 * ------------------------------------------------------------------------- */

const SERVICE = "Amplifi";

function parseCitations(raw: unknown): Citation[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Citation[] = [];
  for (const c of raw) {
    if (!isObj(c) || typeof c.paperId !== "string") continue;
    out.push({ paperId: libraryPaperId(c.paperId), page: typeof c.page === "string" ? c.page : null });
  }
  return out;
}

export function parseChatResponse(raw: unknown): AmplifiAnswer {
  if (!isObj(raw) || typeof raw.answer !== "string") {
    throw new ApiError("invalid_response", "Amplifi sent an answer in an unexpected format.");
  }
  // Prefer structured citations; fall back to inline [CP07]-style markers in the answer text.
  const citations =
    parseCitations(raw.citations) ?? extractCitationIds(raw.answer).map((paperId) => ({ paperId, page: null }));
  return {
    text: raw.answer,
    citations,
    origin: "amplifi",
    conversationId: typeof raw.conversationId === "string" ? raw.conversationId : null,
  };
}

export function createHttpAmplifiClient(config: AppConfig, fetchImpl?: typeof fetch): AmplifiClient {
  const base = config.amplifiProxyUrl;
  return {
    async ask({ question, scope, history, conversationId, signal, onText }) {
      const answer = await requestJson(`${base}/chat`, {
        method: "POST",
        body: { question, scope: scope && amplifiPaperId(scope), history, conversationId },
        signal,
        timeoutMs: config.timeoutMs,
        service: SERVICE,
        parse: parseChatResponse,
        fetchImpl,
      });
      // Non-streaming contract: deliver the whole answer at once.
      onText?.(answer.text);
      return answer;
    },
  };
}
