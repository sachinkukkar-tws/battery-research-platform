import { readConfig } from "../config";
import { createHttpExplorerClient } from "../explorerApi";

const config = { ...readConfig({}), amplifiProxyUrl: "/amplifi" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const DATA = { extractedAt: "2026-10-30T09:00+05:30", method: "Test.", papers: {}, anodes: [], fullCells: [], materials: [], performance: [] };

describe("Explorer data from the proxy", () => {
  it("loads the data the proxy keeps", async () => {
    const urls: string[] = [];
    const client = createHttpExplorerClient(config, async (url) => {
      urls.push(String(url));
      return json(DATA);
    });
    expect(await client.load()).toEqual(DATA);
    expect(urls).toEqual(["/amplifi/explorer"]);
  });

  it("returns nothing before the first extraction", async () => {
    const client = createHttpExplorerClient(config, async () => json({ detail: "Nothing has been extracted from the papers yet. Ask Amplifi to extract them." }, 404));
    expect(await client.load()).toBeNull();
  });

  it("rejects data in an unexpected shape instead of showing part of it", async () => {
    const client = createHttpExplorerClient(config, async () => json({ papers: {}, anodes: [] }));
    await expect(client.load()).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("starts a refresh with a POST, and passes on the proxy's reason when it can't", async () => {
    const calls: { url: string; method?: string }[] = [];
    const client = createHttpExplorerClient(config, async (url, init) => {
      calls.push({ url: String(url), method: init?.method });
      return json({ detail: "Set AMPLIFI_WORKSPACE_ID and AMPLIFI_AGENT_ID in .env.amplifi to refresh." }, 503);
    });
    await expect(client.refresh()).rejects.toThrow("Set AMPLIFI_WORKSPACE_ID and AMPLIFI_AGENT_ID in .env.amplifi to refresh.");
    expect(calls).toEqual([{ url: "/amplifi/explorer/refresh", method: "POST" }]);
  });

  it("reads how far a refresh has got", async () => {
    const status = { state: "running", startedAt: "2026-10-30T03:30:00.000Z", finishedAt: null, stage: "Asking Amplifi about each paper", done: 4, failed: 0, total: 20, error: null };
    const client = createHttpExplorerClient(config, async () => json(status));
    expect(await client.status()).toEqual(status);
  });
});
