import { ApiError } from "./http";

/** Delay that rejects with an "aborted" ApiError when the signal fires. Used by mock adapters. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new ApiError("aborted", "The request was cancelled."));
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new ApiError("aborted", "The request was cancelled."));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
