import { ApiError, requestJson } from "../http";

const ok = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const base = { timeoutMs: 1000, service: "The platform", parse: (r: unknown) => r };

describe("requestJson", () => {
  it("returns the parsed body", async () => {
    await expect(requestJson("/x", { ...base, fetchImpl: ok({ a: 1 }) })).resolves.toEqual({ a: 1 });
  });

  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not_found"],
    [413, "too_large"],
    [503, "server"],
    [418, "http"],
  ])("maps HTTP %i to %s", async (status, kind) => {
    await expect(requestJson("/x", { ...base, fetchImpl: ok({}, status) })).rejects.toMatchObject({ kind, status });
  });

  it("reports network failures", async () => {
    const fetchImpl = async () => {
      throw new TypeError("Failed to fetch");
    };
    await expect(requestJson("/x", { ...base, fetchImpl })).rejects.toMatchObject({ kind: "network" });
  });

  it("times out slow requests", async () => {
    const fetchImpl = (_: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    await expect(requestJson("/x", { ...base, timeoutMs: 20, fetchImpl })).rejects.toMatchObject({ kind: "timeout" });
  });

  it("distinguishes caller cancellation from timeouts", async () => {
    const c = new AbortController();
    const fetchImpl = (_: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    const p = requestJson("/x", { ...base, signal: c.signal, fetchImpl });
    c.abort();
    await expect(p).rejects.toMatchObject({ kind: "aborted" });
  });

  it("rejects bodies that aren't JSON", async () => {
    const fetchImpl = async () => new Response("<html>", { status: 200 });
    await expect(requestJson("/x", { ...base, fetchImpl })).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("surfaces parse failures from validators", async () => {
    const parse = () => {
      throw new ApiError("invalid_response", "bad shape");
    };
    await expect(requestJson("/x", { ...base, parse, fetchImpl: ok({}) })).rejects.toThrow("bad shape");
  });
});
