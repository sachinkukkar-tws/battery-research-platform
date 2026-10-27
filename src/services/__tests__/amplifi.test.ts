import { readConfig } from "../config";
import { createHttpAmplifiClient, createMockAmplifiClient, parseChatResponse } from "../amplifiApi";

describe("Amplifi proxy contract", () => {
  it("uses structured citations when present", () => {
    expect(parseChatResponse({ answer: "x", citations: [{ paperId: "CP01", page: "5" }], conversationId: "c1" })).toEqual({
      text: "x",
      citations: [{ paperId: "CP01", page: "5" }],
      origin: "amplifi",
      conversationId: "c1",
    });
  });

  it("falls back to inline markers when citations are absent", () => {
    expect(parseChatResponse({ answer: "See [CP07] and [CP07]." }).citations).toEqual([{ paperId: "CP07", page: null }]);
  });

  it("rejects responses without an answer", () => {
    expect(() => parseChatResponse({ text: "wrong field" })).toThrow(/unexpected format/);
  });

  it("posts the question, scope and history to the proxy, never to Amplifi directly", async () => {
    const calls: { url: string; body: unknown; headers: HeadersInit | undefined }[] = [];
    const fetchImpl = async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)), headers: init?.headers });
      return new Response(JSON.stringify({ answer: "ok [CP01]" }), { status: 200 });
    };
    const config = { ...readConfig({}), mode: "live" as const, amplifiProxyUrl: "/amplifi" };
    const client = createHttpAmplifiClient(config, fetchImpl);
    const onText = vi.fn();
    const a = await client.ask({ question: "Q?", scope: "CP01", history: [{ role: "user", text: "earlier" }], conversationId: null, onText });
    expect(calls[0]!.url).toBe("/amplifi/chat");
    expect(calls[0]!.body).toEqual({ question: "Q?", scope: "CP01", history: [{ role: "user", text: "earlier" }], conversationId: null });
    expect(JSON.stringify(calls[0]!.headers)).not.toMatch(/authorization/i);
    expect(a.origin).toBe("amplifi");
    expect(onText).toHaveBeenCalledWith("ok [CP01]");
  });
});

describe("mock Amplifi", () => {
  const client = createMockAmplifiClient({ thinkMs: 0, wordMs: [0, 0] });

  it("labels every answer as mock", async () => {
    const a = await client.ask({ question: "What is S-HC-2 in CP09 made from?", scope: null, history: [], conversationId: null });
    expect(a.origin).toBe("mock");
    expect(a.citations).toEqual([{ paperId: "CP09", page: "2" }]);
  });

  it("says plainly when it can't answer", async () => {
    const a = await client.ask({ question: "Something else", scope: null, history: [], conversationId: null });
    expect(a.text).toMatch(/^Demo mode can only answer/);
    expect(a.citations).toEqual([]);
  });

  it("streams partial text and can be stopped", async () => {
    const c = new AbortController();
    const seen: string[] = [];
    const slow = createMockAmplifiClient({ thinkMs: 0, wordMs: [5, 5] });
    const p = slow.ask({
      question: "CP07",
      scope: null,
      history: [],
      conversationId: null,
      signal: c.signal,
      onText: (t) => {
        seen.push(t);
        if (seen.length === 3) c.abort();
      },
    });
    await expect(p).rejects.toMatchObject({ kind: "aborted" });
    expect(seen).toHaveLength(3);
  });
});
