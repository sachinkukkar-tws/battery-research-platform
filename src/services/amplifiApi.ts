import type { AmplifiAnswer, AskRequest, Citation, FindValueRequest, FoundValue } from "@/types";
import { MOCK_ANSWERS, MOCK_FALLBACK_ANSWER } from "@/data/mockAnswers";
import { amplifiPaperId, extractCitationIds, libraryPaperId } from "@/domain/citations";
import type { AppConfig } from "./config";
import { ApiError, requestJson } from "./http";
import { sleep } from "./sleep";
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
  findValue(request: FindValueRequest): Promise<FoundValue>;
}

/* ---------------- Proxy contract (owned by this frontend) ----------------
 * POST {proxy}/chat
 *   request:  { question: string, scope: string | null, history: {role, text}[], conversationId: string | null }
 *             (scope is the paper ID as Amplifi's file names write it: C01 for the library's C1)
 *   response: { answer: string, citations?: { paperId: string, page: string | null }[], conversationId?: string | null }
 * POST {proxy}/find-value
 *   request:  { paperId: string, sample: string, field: string }
 *   response: { value: string | null, page: string | null, quote: string }
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

export function parseFindValueResponse(raw: unknown): FoundValue {
  if (!isObj(raw)) throw new ApiError("invalid_response", "Amplifi sent a value in an unexpected format.");
  return {
    value: typeof raw.value === "string" && raw.value.trim() ? raw.value : null,
    page: typeof raw.page === "string" ? raw.page : null,
    quote: typeof raw.quote === "string" ? raw.quote : "",
    origin: "amplifi",
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
    findValue: ({ paperId, sample, field, signal }) =>
      requestJson(`${base}/find-value`, {
        method: "POST",
        body: { paperId, sample, field },
        signal,
        timeoutMs: config.timeoutMs,
        service: SERVICE,
        parse: parseFindValueResponse,
        fetchImpl,
      }),
  };
}

/**
 * Demo adapter. Answers only the suggested questions, word by word to exercise the streaming UI.
 * Every answer carries origin "mock" so the chat labels it as a demo answer.
 */
export function createMockAmplifiClient({ thinkMs = 700, wordMs = [24, 60] as [number, number] } = {}): AmplifiClient {
  return {
    async ask({ question, signal, onText }) {
      await sleep(thinkMs, signal);
      const hit = MOCK_ANSWERS.find((a) => a.match.test(question));
      const text = hit?.text ?? MOCK_FALLBACK_ANSWER;
      const parts = text.split(/(\s+)/);
      let shown = "";
      for (let k = 0; k < parts.length; k++) {
        shown += parts[k];
        if (k % 2 === 0) {
          onText?.(shown);
          if (wordMs[1] > 0) await sleep(wordMs[0] + Math.random() * (wordMs[1] - wordMs[0]), signal);
        }
      }
      return { text, citations: hit?.citations ?? [], origin: "mock", conversationId: null };
    },
    async findValue({ paperId, sample, field, signal }) {
      await sleep(600, signal);
      return {
        value: null,
        page: null,
        quote: `Demo mode: when connected, Amplifi searches ${paperId} for the ${field} of ${sample}, and the result goes to Review.`,
        origin: "mock",
      };
    },
  };
}
