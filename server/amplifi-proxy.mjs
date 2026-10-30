/**
 * Minimal server-side proxy between the BRP frontend and an Amplifi chat app.
 *
 * The browser calls POST /amplifi/chat (the contract in src/services/amplifiApi.ts). This server
 * logs in to Amplifi as a user (POST /login/access-token), keeps one Amplifi chat session per BRP
 * conversation (POST /chat_app/{id}/chat_session), and forwards each question to POST /chat with the
 * chat app ID. Amplifi stores the conversation history in that session, so follow-up questions work.
 * It also serves POST /amplifi/structured: a question plus a JSON Schema, forwarded to POST /chat/upload
 * with output_schema, so the agent's answer comes back in that shape. That call has no history.
 * And GET /amplifi/papers/CP06.pdf serves a paper's PDF from AMPLIFI_PAPERS_DIR, for the Explorer.
 * The Explorer's data comes from Amplifi too: POST /amplifi/explorer/refresh asks Amplifi about every paper
 * (scripts/explorer/extract.py, through /amplifi/structured), checks the answers against the PDFs
 * (scripts/explorer/build_data.py) and keeps the result, which GET /amplifi/explorer serves.
 * GET /amplifi/explorer/status says how far a refresh has got.
 * The login details and the token never reach the browser.
 *
 * Run: npm run amplifi:proxy   (settings in .env.amplifi; see .env.amplifi.example)
 * Check the login: GET http://localhost:8787/amplifi/ping
 */
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

function setting(name, fallback) {
  const v = process.env[name]?.trim();
  if (v) return v;
  if (fallback !== undefined) return fallback;
  console.error(`Missing ${name}. Copy .env.amplifi.example to .env.amplifi and fill it in.`);
  process.exit(1);
}

const BASE = setting("AMPLIFI_BASE_URL").replace(/\/$/, "");
const EMAIL = setting("AMPLIFI_EMAIL");
const PASSWORD = setting("AMPLIFI_PASSWORD");
const CHAT_APP_ID = setting("AMPLIFI_CHAT_APP_ID");
// Only /amplifi/structured needs these: /chat/upload takes a workspace and an agent instead of a chat app.
const WORKSPACE_ID = setting("AMPLIFI_WORKSPACE_ID", "");
const AGENT_ID = setting("AMPLIFI_AGENT_ID", "");
// Optional: the folder with the papers' PDFs (CP06_Jia_2026.pdf ...), so the Explorer can open them.
const PAPERS_DIR = setting("AMPLIFI_PAPERS_DIR", "");
// Refreshing the Explorer's data runs the Python scripts in scripts/explorer (they need pymupdf).
const PYTHON = setting("AMPLIFI_PYTHON", "python");
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CACHE_DIR = setting("AMPLIFI_CACHE_DIR", join(ROOT, "server", "cache"));
const DATA_FILE = join(CACHE_DIR, "explorer.json");
const PORT = Number(setting("PORT", "8787"));
const TIMEOUT_MS = Number(setting("AMPLIFI_TIMEOUT_MS", "120000"));

const MAX_BODY_BYTES = 1024 * 1024;
// Amplifi access tokens last 60 minutes; log in again after 50.
const TOKEN_TTL_MS = 50 * 60 * 1000;

class ProxyError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

let token = null; // { value, expiresAt }

async function getToken({ force = false } = {}) {
  if (!force && token && Date.now() < token.expiresAt) return token.value;
  const res = await fetch(`${BASE}/login/access-token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ username: EMAIL, password: PASSWORD }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await res.json().catch(() => null);
  const data = body?.data ?? body;
  const value = data?.access_token;
  if (!res.ok || typeof value !== "string") {
    token = null;
    const mfa = data?.secondFactorAuthenticationToken ? " The account asks for a second factor (MFA), which the proxy can't complete." : "";
    throw new ProxyError(502, `Amplifi login failed (HTTP ${res.status}). Check AMPLIFI_EMAIL and AMPLIFI_PASSWORD.${mfa}`);
  }
  token = { value, expiresAt: Date.now() + TOKEN_TTL_MS };
  return value;
}

/** Calls Amplifi with the user token, logging in again once if the token was rejected. A FormData payload is sent as multipart. */
async function amplifiJson(path, payload, { retried = false } = {}) {
  const multipart = payload instanceof FormData;
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    // For multipart, fetch sets the Content-Type itself, with the boundary.
    headers: { Authorization: `Bearer ${await getToken()}`, Accept: "application/json", ...(multipart ? {} : { "Content-Type": "application/json" }) },
    body: multipart ? payload : JSON.stringify(payload),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 401 && !retried) {
    await getToken({ force: true });
    return amplifiJson(path, payload, { retried: true });
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = typeof body?.detail === "string" ? body.detail : JSON.stringify(body?.detail ?? body);
    throw new ProxyError(502, `Amplifi ${path} returned HTTP ${res.status}: ${detail}`);
  }
  return body;
}

async function createSession() {
  const body = await amplifiJson(`/chat_app/${CHAT_APP_ID}/chat_session`, {
    title: `BRP ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
  });
  const id = body?.data?.id;
  if (typeof id !== "string") throw new ProxyError(502, "Amplifi didn't return a chat session ID.");
  return id;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Without this note the agent sometimes answers from memory instead of searching the papers.
const SEARCH_NOTE = "\n\n(Search the papers before answering. If the question is about several papers, search each of them separately.)";

async function askAmplifi({ question, scope, conversationId }) {
  // The frontend's conversationId is the Amplifi chat session ID; a new conversation gets a new session.
  const sessionId = typeof conversationId === "string" && UUID_RE.test(conversationId) ? conversationId : await createSession();
  const asked = typeof scope === "string" && scope ? `Answer using only paper ${scope}.\n${question.trim()}` : question.trim();
  const query = asked + SEARCH_NOTE;
  const body = await amplifiJson("/chat", { chat_app_id: CHAT_APP_ID, chat_session_id: sessionId, query });
  // Agent failures arrive as HTTP 200 with an "error" key.
  if (body?.error) throw new ProxyError(502, `Amplifi agent error: ${body.error}`);
  return { ...toAnswer(body), conversationId: sessionId };
}

/** Maps Amplifi's { responses, contexts, ... } onto the frontend's { answer }. */
function toAnswer(body) {
  const responses = Array.isArray(body?.responses) ? body.responses : [];
  const parts = responses.map((r) => {
    if (typeof r === "string") return r;
    if (typeof r?.response === "string") return r.response;
    if (typeof r?.error === "string") return `(Part of this question failed: ${r.error})`;
    return r == null ? "" : JSON.stringify(r);
  });
  const answer = parts.filter((p) => p.trim()).join("\n\n").trim();
  if (!answer) throw new ProxyError(502, "Amplifi returned no answer text.");
  // Citations: the frontend reads inline [CP07]-style markers from the answer text.
  return { answer };
}

/**
 * Asks the agent for an answer shaped by a JSON Schema (POST /chat/upload with output_schema).
 * Amplifi may split a question into parts and answer each in that shape: the first is `data`, any others `more`.
 */
async function askStructured({ question, schema }) {
  if (!WORKSPACE_ID || !AGENT_ID) {
    throw new ProxyError(503, "Structured answers need AMPLIFI_WORKSPACE_ID and AMPLIFI_AGENT_ID in .env.amplifi.");
  }
  const form = new FormData();
  form.set("query", question.trim() + SEARCH_NOTE);
  form.set("agent_id", AGENT_ID);
  form.set("workspace_id", WORKSPACE_ID);
  form.set("output_schema", JSON.stringify(schema));
  const body = await amplifiJson("/chat/upload", form);
  // Agent failures arrive as HTTP 200 with an "error" key, for the whole call or for one part.
  if (body?.error) throw new ProxyError(502, `Amplifi agent error: ${body.error}`);
  const parts = Array.isArray(body?.responses) ? body.responses : [];
  const answers = parts.filter((r) => r && typeof r === "object" && !Array.isArray(r) && !("error" in r));
  if (!answers.length) {
    const failed = parts.find((r) => typeof r?.error === "string");
    throw new ProxyError(502, failed ? `Amplifi agent error: ${failed.error}` : "Amplifi returned no structured answer.");
  }
  const [data, ...more] = answers;
  return more.length ? { data, more } : { data };
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new ProxyError(413, "Request body too large."));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "null"));
      } catch {
        reject(new ProxyError(400, "Request body isn't valid JSON."));
      }
    });
    req.on("error", reject);
  });
}

/** A route's reply that is a file to stream rather than JSON. */
class FileReply {
  constructor(path, size) {
    this.path = path;
    this.size = size;
  }
}

const PAPER_RE = /^\/amplifi\/papers\/([A-Z]{1,3}\d{1,2})\.pdf$/;

/** The PDF whose file name starts with the paper ID, e.g. CP06_Jia_2026.pdf for CP06. */
async function paperFile(id) {
  if (!PAPERS_DIR) throw new ProxyError(404, "Set AMPLIFI_PAPERS_DIR in .env.amplifi to open the papers.");
  const name = (await readdir(PAPERS_DIR)).find((f) => f.toUpperCase().startsWith(`${id}_`) && f.toLowerCase().endsWith(".pdf"));
  if (!name) throw new ProxyError(404, `There's no PDF for ${id} in AMPLIFI_PAPERS_DIR.`);
  const path = join(PAPERS_DIR, name);
  return new FileReply(path, (await stat(path)).size);
}

/* ---------------- The Explorer's data, from Amplifi ---------------- */

/** How far the latest refresh got. `done` counts Amplifi's answers (two questions per paper). */
let refresh = { state: "idle", startedAt: null, finishedAt: null, stage: null, done: 0, failed: 0, total: 0, error: null };

/** Runs a script in scripts/explorer, calling onLine for each line it prints. Rejects with its last lines on failure. */
function runScript(args, onLine = () => {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON, ["-I", ...args], { cwd: ROOT, windowsHide: true });
    const tail = [];
    const read = (chunk) => {
      for (const line of String(chunk).split(/\r?\n/).filter(Boolean)) {
        tail.push(line);
        if (tail.length > 8) tail.shift();
        onLine(line);
      }
    };
    child.stdout.on("data", read);
    child.stderr.on("data", read);
    child.on("error", (e) => reject(new Error(`Couldn't run ${PYTHON}: ${e.message}. Set AMPLIFI_PYTHON to a Python with pymupdf.`)));
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(tail.slice(-3).join(" ") || `${args[0]} stopped with code ${code}`))));
  });
}

/** The newest earlier folder of answers, so a paper Amplifi can't answer this time keeps its last answer. */
async function previousAnswers(current) {
  const root = join(CACHE_DIR, "answers");
  const folders = (await readdir(root).catch(() => [])).filter((f) => f !== current).sort();
  return folders.length ? join(root, folders.at(-1)) : null;
}

async function runRefresh() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  const answers = join(CACHE_DIR, "answers", stamp);
  const extract = ["scripts/explorer/extract.py", PAPERS_DIR];
  const count = (line) => {
    if (/: answered in /.test(line)) refresh.done += 1;
    if (/: FAILED$/.test(line)) {
      refresh.done += 1;
      refresh.failed += 1;
    }
  };
  refresh = { state: "running", startedAt: new Date().toISOString(), finishedAt: null, stage: "Asking Amplifi about each paper", done: 0, failed: 0, total: 0, error: null };
  try {
    const papers = (await readdir(PAPERS_DIR)).filter((f) => f.toLowerCase().endsWith(".pdf")).map((f) => f.split("_")[0]).sort();
    if (!papers.length) throw new Error("There are no PDFs in AMPLIFI_PAPERS_DIR.");
    const previous = await previousAnswers(stamp);
    refresh.total = papers.length * 2;
    await mkdir(answers, { recursive: true });
    await runScript([...extract, join(answers, "main"), ...papers, "--proxy", `http://localhost:${PORT}`], count);
    if (refresh.failed === papers.length && !previous) throw new Error("Amplifi didn't answer for any paper.");
    refresh.stage = "Asking Amplifi about each paper's full cells";
    await runScript([...extract, join(answers, "cells"), ...papers, "--proxy", `http://localhost:${PORT}`, "--question", "scripts/explorer/question-fullcells.txt"], count);
    refresh.stage = "Checking every value against the PDFs";
    const runs = [join(answers, "main"), ...(previous ? [join(previous, "main")] : [])];
    const cells = [join(answers, "cells"), ...(previous ? [join(previous, "cells")] : [])];
    await runScript(["scripts/explorer/build_data.py", PAPERS_DIR, ...runs, "--cells", ...cells, "--out", DATA_FILE]);
    refresh = { ...refresh, state: "done", finishedAt: new Date().toISOString(), stage: null };
  } catch (e) {
    refresh = { ...refresh, state: "failed", finishedAt: new Date().toISOString(), stage: null, error: e.message };
    console.error(`  Refresh failed: ${e.message}`);
  }
}

function startRefresh() {
  if (!PAPERS_DIR) throw new ProxyError(503, "Set AMPLIFI_PAPERS_DIR in .env.amplifi: refreshing checks Amplifi's answers against the PDFs.");
  if (!WORKSPACE_ID || !AGENT_ID) throw new ProxyError(503, "Set AMPLIFI_WORKSPACE_ID and AMPLIFI_AGENT_ID in .env.amplifi to refresh.");
  if (refresh.state !== "running") runRefresh();
  return refresh;
}

async function explorerData() {
  try {
    return JSON.parse(await readFile(DATA_FILE, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") throw new ProxyError(404, "Nothing has been extracted from the papers yet. Ask Amplifi to extract them.");
    throw e;
  }
}

async function route(req) {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  const paper = req.method === "GET" && PAPER_RE.exec(path);
  if (paper) return paperFile(paper[1]);
  if (req.method === "GET" && path === "/amplifi/explorer") return explorerData();
  if (req.method === "GET" && path === "/amplifi/explorer/status") return refresh;
  if (req.method === "POST" && path === "/amplifi/explorer/refresh") return startRefresh();
  if (req.method === "GET" && path === "/amplifi/ping") {
    await getToken({ force: true });
    return { ok: true, amplifi: BASE, chatAppId: CHAT_APP_ID, structured: Boolean(WORKSPACE_ID && AGENT_ID), refresh: refresh.state };
  }
  if (req.method === "POST" && path === "/amplifi/chat") {
    const input = await readJson(req);
    if (typeof input?.question !== "string" || !input.question.trim()) throw new ProxyError(400, "question is required.");
    return askAmplifi(input);
  }
  if (req.method === "POST" && path === "/amplifi/structured") {
    const input = await readJson(req);
    if (typeof input?.question !== "string" || !input.question.trim()) throw new ProxyError(400, "question is required.");
    if (!input.schema || typeof input.schema !== "object" || Array.isArray(input.schema)) {
      throw new ProxyError(400, "schema must be a JSON Schema object.");
    }
    return askStructured(input);
  }
  throw new ProxyError(404, `No route for ${req.method} ${path}.`);
}

createServer(async (req, res) => {
  const started = Date.now();
  let status = 200;
  let payload;
  try {
    payload = await route(req);
  } catch (e) {
    if (e instanceof ProxyError) status = e.status;
    else if (e?.name === "TimeoutError") status = 504;
    else status = 502;
    const message = e instanceof ProxyError ? e.message : status === 504 ? "Amplifi took too long to answer." : `Couldn't reach Amplifi: ${e?.message ?? e}`;
    console.error(`  ${message}`);
    payload = { detail: message };
  }
  if (payload instanceof FileReply) {
    res.writeHead(200, { "Content-Type": "application/pdf", "Content-Length": payload.size, "Content-Disposition": "inline" });
    createReadStream(payload.path).on("error", () => res.destroy()).pipe(res);
  } else {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(payload));
  }
  // Never log the token, the password or the question text.
  console.log(`${req.method} ${req.url} -> ${status} in ${Date.now() - started} ms`);
}).listen(PORT, () => {
  console.log(`Amplifi proxy listening on http://localhost:${PORT}, forwarding to ${BASE} (chat app ${CHAT_APP_ID})`);
  if (!WORKSPACE_ID || !AGENT_ID) console.log("Structured answers are off: set AMPLIFI_WORKSPACE_ID and AMPLIFI_AGENT_ID to use /amplifi/structured.");
});
