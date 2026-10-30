export type ApiErrorKind =
  | "network"
  | "timeout"
  | "aborted"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "too_large"
  | "server"
  | "http"
  | "invalid_response";

/** A failure from any backend call, classified so the UI can explain what happened and what to do. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

export function errorForStatus(status: number, service: string): ApiError {
  if (status === 401) return new ApiError("unauthorized", `${service} needs you to sign in again.`, status);
  if (status === 403) return new ApiError("forbidden", `Your account doesn’t have access to this in ${service}.`, status);
  if (status === 404) return new ApiError("not_found", `${service} couldn’t find what was requested.`, status);
  if (status === 413) return new ApiError("too_large", `${service} rejected the file as too large.`, status);
  if (status >= 500) return new ApiError("server", `${service} had a problem (error ${status}). Try again shortly.`, status);
  return new ApiError("http", `${service} returned error ${status}.`, status);
}

export const isAbort = (e: unknown) =>
  (e instanceof ApiError && e.kind === "aborted") || (e instanceof DOMException && e.name === "AbortError");

/** User-facing description of any thrown value. */
export function describeError(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong.";
}

/**
 * Combines a caller's AbortSignal with a timeout. Returns the merged signal and a cleanup function.
 * `timedOut()` tells a timeout apart from a caller abort.
 */
export function withTimeout(timeoutMs: number, outer?: AbortSignal) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener("abort", onAbort, { once: true });
  }
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    done: () => {
      clearTimeout(timer);
      outer?.removeEventListener("abort", onAbort);
    },
  };
}

const isDetail = (b: unknown): b is { detail: string } =>
  typeof b === "object" && b !== null && typeof (b as { detail?: unknown }).detail === "string";

export interface RequestOptions<T> {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs: number;
  /** Validates and narrows the JSON body. Throw ApiError("invalid_response") on a shape mismatch. */
  parse: (raw: unknown) => T;
  /** Name used in error messages, e.g. "The platform" or "Amplifi". */
  service: string;
  /** Use the `detail` of a JSON error body as the message, for services whose errors explain the fix. */
  useDetail?: boolean;
  fetchImpl?: typeof fetch;
}

export async function requestJson<T>(url: string, opts: RequestOptions<T>): Promise<T> {
  const { method = "GET", body, headers, signal, timeoutMs, parse, service, useDetail = false, fetchImpl = fetch } = opts;
  const t = withTimeout(timeoutMs, signal);
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method,
      signal: t.signal,
      credentials: "same-origin",
      headers: { Accept: "application/json", ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    t.done();
    if (t.timedOut()) throw new ApiError("timeout", `${service} took too long to respond. Try again.`);
    if (isAbort(e)) throw new ApiError("aborted", "The request was cancelled.");
    throw new ApiError("network", `Couldn’t reach ${service.replace(/^The /, "the ")}. Check your connection and try again.`);
  }
  t.done();
  if (!res.ok) {
    const error = errorForStatus(res.status, service);
    const detail = useDetail ? await res.json().then((b: unknown) => (isDetail(b) ? b.detail : null), () => null) : null;
    throw detail ? new ApiError(error.kind, detail, res.status) : error;
  }
  if (res.status === 204) return parse(null);
  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    throw new ApiError("invalid_response", `${service} sent a response that isn’t valid JSON.`);
  }
  return parse(raw);
}
