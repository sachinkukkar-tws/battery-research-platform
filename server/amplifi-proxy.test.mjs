/**
 * Runs server/amplifi-proxy.mjs against a stand-in Amplifi on spare ports and checks its routes:
 * POST /amplifi/structured, the papers' PDFs and the Explorer's data.
 * No real login or Amplifi is involved.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SCHEMA = { type: "object", properties: { anodes: { type: "array", items: { type: "string" } } }, required: ["anodes"] };
const WORKSPACE_ID = "00000000-0000-0000-0000-000000000002";
const AGENT_ID = "00000000-0000-0000-0000-000000000003";
const PAPERS_DIR = mkdtempSync(join(tmpdir(), "brp-papers-"));
const PDF = "%PDF-1.4 test paper";
writeFileSync(join(PAPERS_DIR, "CP06_Test_2026.pdf"), PDF);
const CACHE_DIR = mkdtempSync(join(tmpdir(), "brp-cache-"));

let amplifi; // the stand-in Amplifi
let proxy; // the proxy process
let proxyUrl;
let reply; // what the stand-in /chat/upload answers next
const uploads = []; // what the stand-in /chat/upload received

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
}

async function freePort() {
  const server = createServer();
  const port = await listen(server);
  await new Promise((resolve) => server.close(resolve));
  return port;
}

beforeAll(async () => {
  amplifi = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/api/v3/login/access-token") return res.end(JSON.stringify({ access_token: "test-token" }));
    if (req.url === "/api/v3/chat/upload") {
      const form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": req.headers["content-type"] } }).formData();
      uploads.push({ auth: req.headers.authorization, fields: Object.fromEntries(form) });
      return res.end(JSON.stringify(reply));
    }
    res.statusCode = 404;
    res.end("{}");
  });
  const amplifiPort = await listen(amplifi);
  const port = await freePort();
  proxyUrl = `http://127.0.0.1:${port}`;
  // The test environment's URL is jsdom's, which fileURLToPath rejects, so build the path from the string.
  proxy = spawn(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), "amplifi-proxy.mjs")], {
    env: {
      ...process.env,
      AMPLIFI_BASE_URL: `http://127.0.0.1:${amplifiPort}/api/v3`,
      AMPLIFI_EMAIL: "test@example.com",
      AMPLIFI_PASSWORD: "test",
      AMPLIFI_CHAT_APP_ID: "00000000-0000-0000-0000-000000000001",
      AMPLIFI_WORKSPACE_ID: WORKSPACE_ID,
      AMPLIFI_AGENT_ID: AGENT_ID,
      AMPLIFI_PAPERS_DIR: PAPERS_DIR,
      AMPLIFI_CACHE_DIR: CACHE_DIR,
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("The proxy didn't start.")), 10_000);
    proxy.stdout.on("data", (data) => {
      if (String(data).includes("listening on")) {
        clearTimeout(timer);
        resolve();
      }
    });
    proxy.on("exit", (code) => reject(new Error(`The proxy exited with code ${code}.`)));
  });
}, 20_000);

afterAll(async () => {
  proxy?.kill();
  await new Promise((resolve) => (amplifi ? amplifi.close(resolve) : resolve()));
});

function ask(body) {
  return fetch(`${proxyUrl}/amplifi/structured`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("POST /amplifi/structured", () => {
  it("sends the question and schema to /chat/upload and returns the answer in that shape", async () => {
    reply = { responses: [{ anodes: ["hard carbon"] }], contexts: [] };
    const res = await ask({ question: "List the anodes.", schema: SCHEMA });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { anodes: ["hard carbon"] } });
    const sent = uploads.at(-1);
    expect(sent.auth).toBe("Bearer test-token");
    // multipart/form-data turns line breaks into CRLF.
    expect(sent.fields.query).toMatch(/^List the anodes\.\r?\n\r?\n\(Search the papers/);
    expect(sent.fields.agent_id).toBe(AGENT_ID);
    expect(sent.fields.workspace_id).toBe(WORKSPACE_ID);
    expect(JSON.parse(sent.fields.output_schema)).toEqual(SCHEMA);
  });

  it("returns the other parts when Amplifi splits the question", async () => {
    reply = { responses: [{ anodes: ["a"] }, { error: "part failed" }, { anodes: ["b"] }] };
    const res = await ask({ question: "Q", schema: SCHEMA });
    expect(await res.json()).toEqual({ data: { anodes: ["a"] }, more: [{ anodes: ["b"] }] });
  });

  it("reports an agent error that arrives as HTTP 200", async () => {
    reply = { error: "model unavailable" };
    const res = await ask({ question: "Q", schema: SCHEMA });
    expect(res.status).toBe(502);
    expect((await res.json()).detail).toBe("Amplifi agent error: model unavailable");
  });

  it("rejects a request without a schema", async () => {
    const res = await ask({ question: "Q" });
    expect(res.status).toBe(400);
    expect((await res.json()).detail).toBe("schema must be a JSON Schema object.");
  });
});

describe("GET /amplifi/papers/<id>.pdf", () => {
  it("serves the PDF whose name starts with the paper ID", async () => {
    const res = await fetch(`${proxyUrl}/amplifi/papers/CP06.pdf`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(await res.text()).toBe(PDF);
  });

  it("says when there's no PDF for a paper", async () => {
    const res = await fetch(`${proxyUrl}/amplifi/papers/CP09.pdf`);
    expect(res.status).toBe(404);
    expect((await res.json()).detail).toBe("There's no PDF for CP09 in AMPLIFI_PAPERS_DIR.");
  });

  it("only accepts paper IDs", async () => {
    const res = await fetch(`${proxyUrl}/amplifi/papers/..%2F.env.pdf`);
    expect(res.status).toBe(404);
    expect((await res.json()).detail).toMatch(/^No route for GET/);
  });
});

describe("GET /amplifi/explorer", () => {
  it("says when nothing has been extracted yet", async () => {
    const res = await fetch(`${proxyUrl}/amplifi/explorer`);
    expect(res.status).toBe(404);
    expect((await res.json()).detail).toBe("Nothing has been extracted from the papers yet. Ask Amplifi to extract them.");
  });

  it("serves the data the last refresh kept", async () => {
    const data = { extractedAt: "2026-10-30T09:00+05:30", method: "Test.", papers: {}, anodes: [], fullCells: [], materials: [], performance: [] };
    writeFileSync(join(CACHE_DIR, "explorer.json"), JSON.stringify(data));
    const res = await fetch(`${proxyUrl}/amplifi/explorer`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(data);
  });

  it("says that no refresh has run yet", async () => {
    const res = await fetch(`${proxyUrl}/amplifi/explorer/status`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ state: "idle", done: 0, failed: 0, total: 0, error: null });
  });
});
