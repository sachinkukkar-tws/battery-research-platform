# Running the BRP UI on Amplifi's backend: a step-by-step guide

You have two codebases:

| | Path | Role |
|---|---|---|
| **BRP** (yours) | `battery-research-platform-src/brp` | React + Vite UI. Mock data today. This is what users see. |
| **Amplifi** | `amplifi-dev/amplifi-dev` | The backend platform. **Read-only reference.** You never edit it. |

The goal: BRP's screens call Amplifi's HTTP API. Amplifi's own Next.js UI (`amplifi-dev/frontend`) is still used by *you* (the admin) to manage datasets and agents, but your end users only see BRP.

```
Browser (BRP, :5173)
   └─ /amplifi/*  ──► small proxy (holds client_id/secret, adds Bearer token)
                         └─► Amplifi API  https://<host>/api/v3/...
                                └─► agent (prompt + model + search tools)
                                       └─► Theme A / Theme B datasets
```

---

## Step 1: Understand what Amplifi is (from its README)

- **Purpose:** a document-intelligence platform. It ingests files, builds datasets and knowledge graphs, and answers questions through agents and chat.
- **Active backend:** `backend_new/`, a uv workspace with 12 services. `backend/` is the legacy backend. Ignore it.
- **API:** `fastapi-service` is the only HTTP API. Everything else is Celery or Temporal workers for ingestion, graphs and training.
- **Versioning:** all routes live under **`/api/v3`**. Health is `GET /health`. The OpenAPI spec is at `/api/v3/openapi.json`. Swagger is at `/docs_v3` behind basic auth.
- **Resource hierarchy:**
  ```
  organization → workspace → files → datasets (ingested) → workspace tools (Vector/Hybrid/File-Nav search over datasets)
                                   → agents (prompt + LLM + tools) → chat apps → chat sessions
  ```
  Your Theme A and Theme B datasets, the three Theme B tools and the chat agent already exist, inside some workspace on a hosted Amplifi.

## Step 2: Decide which Amplifi instance to use (recommended: the hosted dev environment)

| Option | What it takes | Verdict |
|---|---|---|
| **Hosted dev** (`https://dev-api.dataamplifi.com`, from `.github/workflows/deploy_dev_frontend.yml:31`) | An API client and a few IDs from the Amplifi team | **Use this.** Your datasets and agents are already there. |
| Local Docker stack | Docker running, about 23 containers (`new-docker-compose-dev.yml`), a filled `.env` with Azure OpenAI keys **and** LoginRadius secrets, re-ingesting all 37 papers, recreating the tools and agents | Only if the team wants you developing offline. Locally seeded users can't log in (login goes through LoginRadius). |

> Confirm with the Amplifi team that `dev-api.dataamplifi.com` is the environment that holds the Theme A and Theme B workspace, since staging is `stage-api.dataamplifi.com`.

## Step 3: Get these values from the Amplifi team, or from the Amplifi UI

| Value | Where it comes from |
|---|---|
| `AMPLIFI_BASE_URL` | e.g. `https://dev-api.dataamplifi.com/api/v3` |
| `organization_id` | `GET /user` as a logged-in user, or the team |
| `workspace_id` | The workspace holding Theme A and Theme B (visible in the Amplifi UI URL `/workspace/<id>/...`) |
| `AMPLIFI_CHAT_AGENT_ID` | The existing chat agent (prompt v4.6/4.7) |
| `AMPLIFI_UI_AGENT_ID` | A **new** agent for JSON tasks, with the same tools and the prompt from brief §6.4 |
| `AMPLIFI_CLIENT_ID` / `AMPLIFI_CLIENT_SECRET` | An **API client**. An admin or developer creates it with `POST /organization/{org}/api_client`. The secret is shown **once**. |

This API client is the "API key" that the 23 Oct meeting asked for. It never goes into the browser.

## Step 4: Prove the API works before writing any UI code

**4a. Exchange the client credentials for a token.** The token is valid for 1 hour (`fastapi_service/api/v1/endpoints/api_client.py:33`):

```bash
curl -s -X POST "$AMPLIFI_BASE_URL/api_client/token" -H "Content-Type: application/json" -d "{\"client_id\":\"$AMPLIFI_CLIENT_ID\",\"client_secret\":\"$AMPLIFI_CLIENT_SECRET\"}"
```

The token is in `data.access_token`.

**4b. Ask the agent one question.** This is the **only chat endpoint that accepts API-client tokens** (`fastapi_service/api/v2/endpoints/chat.py:96`). It is multipart form data:

```bash
curl -s -X POST "$AMPLIFI_BASE_URL/chat/upload" -H "Authorization: Bearer $TOKEN" -F "query=What anode is reported in CP01 and what is its reversible capacity?" -F "agent_id=$AMPLIFI_CHAT_AGENT_ID" -F "workspace_id=$WORKSPACE_ID"
```

The response is `{ "responses": [...], "pydantic_messages": [...], "contexts": [...] }` (`utils/dynamic_agent.py` around line 1113):

- `responses` holds the answer.
- `contexts` holds the raw tool results, meaning the search hits. This is where file names and pages for citations come from. *Their exact shape is unconfirmed, so inspect a real reply.*

**Gotcha:** failures come back as **HTTP 200 with `{"error": "..."}`** (`utils/chat_utils.py:772`). Always check for an `error` key.

**4c. Structured JSON output.** This feature lines up with brief §6. `/chat/upload` accepts an optional **`output_schema`** form field holding a JSON Schema string, and the agent is then forced to return that shape (`chat.py:131-140`, pydantic-ai `StructuredDict`):

```bash
curl -s -X POST "$AMPLIFI_BASE_URL/chat/upload" -H "Authorization: Bearer $TOKEN" -F "agent_id=$AMPLIFI_UI_AGENT_ID" -F "workspace_id=$WORKSPACE_ID" -F "query=TASK: find_value INPUT: {\"paper\":\"CP01\",\"material\":\"BGP@HEC-HC\",\"field\":\"first-cycle efficiency\"}" -F "output_schema={\"type\":\"object\",\"properties\":{\"value\":{\"type\":[\"number\",\"null\"]},\"page\":{\"type\":[\"string\",\"null\"]},\"quote\":{\"type\":[\"string\",\"null\"]}},\"required\":[\"value\",\"page\",\"quote\"]}"
```

With this field, the JSON-extraction and retry logic planned in Phase 2 becomes a fallback rather than the main path.

> ⚠ Before the agent sees a message, Amplifi sends it through a GPT-4.1 "split questions" step, which may reword or split it. Check how a `TASK/INPUT/FORMAT` message comes through. See `amplifi-api-notes.md` Q1.

If 4a, 4b and 4c all work, the backend side is done.

## Step 5: Add the proxy so the key never reaches the browser

BRP already expects a proxy at `/amplifi` (`src/services/config.ts`, `VITE_AMPLIFI_PROXY_URL`). Vite's built-in proxy can't do the token exchange, so add a tiny Node server (around 60 lines, e.g. `server/amplifi-proxy.mjs`) that:

1. Reads `AMPLIFI_BASE_URL`, `AMPLIFI_CLIENT_ID`, `AMPLIFI_CLIENT_SECRET`, `WORKSPACE_ID` and the agent IDs from a server-only `.env`, which is gitignored and has **no** `VITE_` prefix.
2. Caches the token and refreshes it a few minutes before its 1-hour expiry.
3. Exposes BRP-shaped routes, for example `POST /amplifi/chat` and `POST /amplifi/task`, and forwards each one to `/chat/upload` with the right `agent_id`, `workspace_id` and `output_schema`.
4. Logs the task, duration and status, but never the token.

Then run Vite with `DEV_API_TARGET=http://localhost:8787`. `vite.config.ts` already proxies `/amplifi` to that target. CORS doesn't matter, because the browser only talks to its own origin.

## Step 6: Swap the mock adapter for a live one, with no screen changes

The swap point already exists. `src/services/index.ts` `createServices(config)` picks mock or HTTP by `VITE_DATA_MODE`.

- Rewrite the HTTP side of `src/services/amplifiApi.ts` (`ask`, `findValue`) to call the proxy.
- Add `services/amplifi/tasks.ts` with the 7 tasks from brief §6.3. Each task gets a request builder, its JSON Schema (sent as `output_schema`), a zod check and a mapper into the existing app types (brief §6.5).
- Keep `VITE_DATA_MODE=mock` working offline.

Screen by screen:

| Screen | Amplifi call | Notes |
|---|---|---|
| Workspace | `list_anodes` → `cathodes_for_anode` → `pair_details` | One request per paper, at most 3 at a time, cached |
| Charts | `material_values` per paper | Cached; charts are already computed client-side |
| Library | Static papers config, plus `paper_quality` on open | Could later use `GET /workspace/{ws}/file`, which needs a user token, not an API client |
| Find with Amplifi | `find_value` | |
| Ask Amplifi | chat agent via `/chat/upload` | **Stateless**: there is no chat session with an API-client token. For multi-turn, put the last few turns into `query`. Streaming (`/chat/stream`, AG-UI SSE) needs a *user* login, so skip it for the POC. |
| Upload / Review | none | Per the brief: upload happens in the Amplifi UI, and Review stays browser-only or hidden |

## Step 7: Limits and errors to plan for

- **Rate limit:** nginx allows 10 requests/second per IP, with a burst of 20 (`nginx/nginx.conf:8`). Fan-out at 3 concurrent requests is safe.
- **Errors:**
  - The HTTP 200 with `{"error"}` case from Step 4b.
  - 401: the token expired. Refresh it in the proxy and retry once.
  - 403: the API client's org doesn't own that workspace (`chat.py:127`).
  - 429 and 5xx: back off and retry.
- **Reference implementation to read:** Amplifi's own end-to-end tests in `backend_new/tests/e2e/workflows/shared_workflow_steps.py` show the exact call sequence for workspace → upload → dataset → ingest → tool → agent → chat.

## Order of work (matches brief §7)

1. **Phase 0:** Steps 1–4. Write `docs/amplifi-api-notes.md` with the real replies (keys redacted).
2. **Phase 1:** Step 5, the proxy, plus `npm run amplifi:ping`.
3. **Phase 2:** `tasks.ts` with schemas, mappers and fixture tests.
4. **Phase 3:** create the UI agent in Amplifi with the §6.4 prompt.
5. **Phase 4:** live mode per screen (Step 6).
6. **Phases 5–6:** the accuracy evaluation against `reference/checked_values.json`, then hardening.

## Still unconfirmed (verify against a real reply)

- The exact shape of each item in `responses` and `contexts`, including whether page numbers appear in `contexts`.
- Whether `output_schema` works with every tool combination the Theme B agent uses.
- Whether the API client's token can see the Theme A and Theme B workspace (same org).
- Whether `dev-api.dataamplifi.com` is the right environment, and whether the 22 Oct errors ("streaming failed", "Chat App Not Found") still happen. "Chat App Not Found" sounds like the chat-app/session path, which this design doesn't use, but that isn't traced yet.
