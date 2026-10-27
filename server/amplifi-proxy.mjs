/**
 * Minimal server-side proxy between the BRP frontend and an Amplifi chat app.
 *
 * The browser calls POST /amplifi/chat (the contract in src/services/amplifiApi.ts). This server
 * logs in to Amplifi as a user (POST /login/access-token), keeps one Amplifi chat session per BRP
 * conversation (POST /chat_app/{id}/chat_session), and forwards each question to POST /chat with the
 * chat app ID. Amplifi stores the conversation history in that session, so follow-up questions work.
 * The login details and the token never reach the browser.
 *
 * Run: npm run amplifi:proxy   (settings in .env.amplifi; see .env.amplifi.example)
 * Check the login: GET http://localhost:8787/amplifi/ping
 */
import { createServer } from "node:http";

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

/** Calls Amplifi with the user token, logging in again once if the token was rejected. */
async function amplifiJson(path, payload, { retried = false } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await getToken()}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
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

async function askAmplifi({ question, scope, conversationId }) {
  // The frontend's conversationId is the Amplifi chat session ID; a new conversation gets a new session.
  const sessionId = typeof conversationId === "string" && UUID_RE.test(conversationId) ? conversationId : await createSession();
  const query = typeof scope === "string" && scope ? `Answer using only paper ${scope}.\n${question.trim()}` : question.trim();
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

async function route(req) {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  if (req.method === "GET" && path === "/amplifi/ping") {
    await getToken({ force: true });
    return { ok: true, amplifi: BASE, chatAppId: CHAT_APP_ID };
  }
  if (req.method === "POST" && path === "/amplifi/chat") {
    const input = await readJson(req);
    if (typeof input?.question !== "string" || !input.question.trim()) throw new ProxyError(400, "question is required.");
    return askAmplifi(input);
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
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
  // Never log the token, the password or the question text.
  console.log(`${req.method} ${req.url} -> ${status} in ${Date.now() - started} ms`);
}).listen(PORT, () => {
  console.log(`Amplifi proxy listening on http://localhost:${PORT}, forwarding to ${BASE} (chat app ${CHAT_APP_ID})`);
});
