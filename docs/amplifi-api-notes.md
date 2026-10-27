# Amplifi API notes (Phase 0)

These notes answer the 12 Phase 0 questions in `AMPLIFI_WIRING_BRIEF.md` §7. They come from reading the Amplifi repository (`amplifi-dev/amplifi-dev`, read-only). **No live calls were made**, so every finding comes from the code.

Paths are relative to `amplifi-dev/amplifi-dev/`. `FS` stands for `backend_new/services/fastapi-service/fastapi_service`.

Each answer is marked:
- **✅ Confirmed in code**: read directly in the source.
- **🟡 Inferred**: follows from the code but hasn't been run.
- **❓ Unconfirmed**: needs a live call or the Amplifi team.

The active backend is `backend_new/`. `backend/` is legacy and was ignored. All routes are mounted under **`/api/v3`** (`FS/main.py:445`). `/api/v1` and `/api/v2` return 404.

---

## Summary: what this means for BRP

1. **Use `POST /api/v3/chat/upload`.** It is the only chat endpoint that both accepts the API-client token (the meeting's "API key") and doesn't need a chat session. It returns JSON, doesn't stream, and keeps no conversation history.
2. **Structured output exists.** `/chat/upload` takes an `output_schema` form field holding a JSON Schema, and the reply is forced into that shape. Each of the brief's tasks can send its schema, which makes the JSON-parsing fallback a safety net rather than the main path.
3. **Amplifi rewrites the query before the agent sees it.** Every message passes through a GPT-4.1 "split questions" call, which may split it into up to 3 sub-questions or return it reworded. That can mangle the `TASK / INPUT / FORMAT` message. See Q1. **This is the biggest risk for the task design.**
4. **Search results carry no page numbers.** Tool results (`contexts`) give the file name, file ID, dataset ID and chunk text. Any page in an answer comes from the LLM reading the chunk text, so treat it as unverified.
5. **Errors can arrive as HTTP 200.** `/chat/upload` catches exceptions and returns `{"error": "..."}` with status 200.
6. **Agents, tools and datasets can only be changed with a user login,** not with the API client. Set them up in the Amplifi UI, as the brief already plans.

---

## Q1. Which endpoint sends a message to an agent, and what is the full request body?

There are three chat endpoints in `FS/api/v2/endpoints/chat.py`:

| Endpoint | Auth accepted | Body | Notes |
|---|---|---|---|
| **`POST /chat/upload`** (L96) | user **or API client** ✅ | `multipart/form-data`: `query` (required), `agent_id` (UUID, required), `workspace_id` (UUID, required), `files[]` (optional PDF/images), `output_schema` (optional JSON Schema string) | Calls the **agent** directly, with no chat app or session. **Use this one.** |
| `POST /chat` (L51) | any authenticated token (`get_current_user()` with no roles) | JSON `ChatRequest`: `{chat_app_id, chat_session_id?, query, source?}` (`backend_new/packages/amplifi-db/src/shared/schemas/chat_schema.py:164`) | Goes through a **chat app**, and creates a session if none is given |
| `POST /chat/stream` (L74) | same as `/chat` | same as `/chat` | Server-sent events (SSE); see Q4 |

**IDs `/chat/upload` needs:**
- `agent_id` and `workspace_id`, sent as form fields.
- The organization comes from the token.
- The workspace must belong to the caller's organization (`check_workspace_in_organization`, `FS/services/authorization/workspace_authz_service.py:73`).

**What `/chat/upload` doesn't need:**
- **No chat app ID.**
- **No conversation ID.** There is no history: every call is independent (`getChatResponseUpload`, `FS/utils/chat_utils.py:733`, passes `chat_app=None` and no session).

**Why `/chat` and `/chat/stream` won't work with the API client** (🟡 inferred, not run):
- An API-client token passes their role check, since `get_current_user()` with no roles calls `validate_roles`, and that returns `True` for an empty role list (`FS/services/auth/api_client_auth_service.py:96-103`).
- But both endpoints create a `ChatSession` with `user_id=current_user.id` (`FS/utils/chat_utils.py:393`, `579`).
- `chat_session.user_id` is a foreign key to `User.id` (`backend_new/packages/amplifi-db/src/shared/models/chat_session_model.py:17`).
- For an API client, `current_user.id` is the API client's own ID (`build_api_client_user_data`, `backend_new/packages/amplifi-platform/src/shared/core/api_client_security.py:129`), which isn't a user row.
- So the session insert should fail.

**⚠ Query rewriting** (✅ confirmed in code):
- What happens: every chat path runs `split_questions(message)` before the agent (`FS/utils/dynamic_agent.py:956`, defined at `:1435`). It sends the message to GPT-4.1 with a "split into questions" system prompt. It also runs `classify_query_intent(...)` (`:953`) to steer tool choice.
- Results:
  - If GPT-4.1 returns one item, **that item replaces the original message**, so it may be reworded.
  - If it returns 2 or 3 items, the agent runs once per item, and `responses[]` gets one entry per item.
- The only built-in bypass: a message containing **both** `[USER_QUESTION]` and `[REPORT_DATA]` is passed through unchanged (`:1440`, the "NC demo" special case).
- Options for BRP:
  1. Test how `TASK:/INPUT:/FORMAT:` messages come through.
  2. Wrap task messages in those two markers. This is a hack that depends on undocumented behaviour, so confirm it with the Amplifi team first.
  3. Ask the Amplifi team for a proper "no split" flag.

**Sample request** (keys redacted):

```http
POST https://dev-api.dataamplifi.com/api/v3/chat/upload
Authorization: Bearer <API_CLIENT_ACCESS_TOKEN>
Content-Type: multipart/form-data; boundary=----x

------x
Content-Disposition: form-data; name="query"

TASK: find_value
INPUT: {"paper":"CP01","material":"BGP@HEC-HC","field":"first-cycle efficiency"}
FORMAT: JSON only, using the find_value format (version 1)
------x
Content-Disposition: form-data; name="agent_id"

<AMPLIFI_UI_AGENT_ID>
------x
Content-Disposition: form-data; name="workspace_id"

<WORKSPACE_ID>
------x
Content-Disposition: form-data; name="output_schema"

{"type":"object","properties":{"task":{"type":"string"},"version":{"type":"integer"},"status":{"type":"string","enum":["ok","partial","not_found"]},"data":{"type":"object","properties":{"value":{"type":["number","string","null"]},"page":{"type":["string","null"]},"quote":{"type":["string","null"]}},"required":["value","page","quote"]},"notes":{"type":["string","null"]}},"required":["task","version","status","data","notes"]}
------x--
```

**Sample response.** This is *built from the code*, not captured from a live call:

```json
{
  "responses": [
    { "task": "find_value", "version": 1, "status": "ok",
      "data": { "value": 94.8, "page": "5", "quote": "<up to 25 words>" },
      "notes": null }
  ],
  "pydantic_messages": [ "<pydantic-ai message objects: system, user, tool calls, tool returns, final>" ],
  "contexts": [
    { "text": "<chunk text>",
      "file": { "filename": "2026 - Shen ....pdf", "filepath": "...", "mime_type": "application/pdf",
                "file_id": "<uuid>", "dataset_id": "<uuid>" },
      "download_url": "", "chunk_id": "<uuid>" }
  ]
}
```

Where each part comes from:
- **Top-level shape:** `FS/utils/dynamic_agent.py:1113-1117`. The handler returns it **as-is**, with no `{message, meta, data}` wrapper.
- **Each `responses[]` item:** built by `format_response`. A structured output becomes its dict. Plain text becomes `{"response": "<text>"}`.
- **`contexts[]`:** the raw tool returns. Their shape is ✅ from `RagContext` (`FS/tools/system_tools/logic/vector_search_logic.py:60-71`).
- **Which contexts actually appear:** ❓. This depends on which tools the agent calls.

## Q2. How is the API key sent, and how are keys issued and scoped?

There's no static API key. It works like OAuth client credentials:

1. **Create a client** (✅, `FS/api/v1/endpoints/api_client.py:88`):
   - Call `POST /api/v3/organization/{org_id}/api_client` with body `{name, description?, expires_at?}`.
   - It needs a logged-in **admin or developer** of that organization. Nobody can create a client for another organization (403).
   - The response includes `client_id` and **`client_secret`, which is shown only once**.
   - Clients can be listed, updated and deleted with the same router.
2. **Exchange for a token** (✅, `api_client.py:32`):
   - Call `POST /api/v3/api_client/token` with JSON `{client_id, client_secret}`. No auth is needed.
   - The token is at `data.access_token`. The response also has `token_type: "bearer"`, `expires_in: 3600` and `client_id`.
   - The token is an HS256 JWT with `{sub: client_id, type: "api_client", organization_id, exp, iat}` (`backend_new/packages/amplifi-platform/src/shared/core/api_client_security.py:14-46`).
   - It lasts **60 minutes**, set by `ACCESS_TOKEN_EXPIRE_MINUTES` (`backend_new/packages/amplifi-base/src/shared/config.py:41`).
3. **Send it** as **`Authorization: Bearer <access_token>`** (`FS/api/deps/auth_deps.py:20`, OAuth2PasswordBearer). `AuthFactory` detects the token type automatically.

**Scope** (✅): a client is scoped to its **whole organization**. It has no workspace, agent or dataset restriction and a single role, `"api_client"`.

**Where the token works:**
- Endpoints that list `"api_client"` in their roles: `/chat/upload`, and the entities extractor (`FS/api/v1/endpoints/entities_extractor.py:394`).
- Endpoints that require no role at all, such as `/chat` and `/chat/stream`. Those still fail for the reason in Q1.
- **Every admin, developer or member endpoint returns 403.** That covers listing workspaces, datasets, files and agents.

**When it stops working:**
- An expired client returns 403 "API client has expired".
- A deleted client returns 404 "API client not found" (`FS/services/auth/api_client_auth_service.py:56-75`).

## Q3. What does the response contain?

| Item | Present? | Where |
|---|---|---|
| Answer text | ✅ `responses[i].response` (plain text), or the structured object | `dynamic_agent.py` `format_response` |
| Structured JSON | ✅ when `output_schema` is sent | `chat.py:131-140` |
| Sources / citations | 🟡 partly. `contexts[]` holds the raw search hits: **file name, file ID, dataset ID and chunk text**. There is **no page number** in `RagContext`. | `vector_search_logic.py:60-71`, `hybrid_search_logic.py:51` |
| Page numbers | ❓ only if the LLM reads them from the chunk text. Treat as unverified, as brief §8 already warns. | |
| Tool calls | ✅ inside `pydantic_messages` (pydantic-ai message history) | `dynamic_agent.py` |
| Usage / token counts | ❌ not returned to the caller. No usage field is added to the response. | grep of `dynamic_agent.py` |
| Wrapper | ✅ the top level is `{responses, pydantic_messages, contexts}`, **not** the usual `{message, meta, data}` | `chat_utils.py:770` returns the dict as-is |

## Q4. Is the response streamed, and is there a non-streaming option?

- **`/chat/upload`:** ✅ **does not stream**. It returns a single JSON reply.
- **`/chat/stream`:** ✅ streams, as **SSE** in the AG-UI event format (`AGUIAdapter`, `FS/utils/dynamic_agent.py` around line 1294).
  - Frames include `RUN_STARTED`, `TEXT_MESSAGE_*` and `TOOL_CALL_*`.
  - The stream ends with `{"type":"AMPLIFI_DONE", ...same payload as /chat}` or `{"type":"RUN_ERROR"}` (`FS/utils/chat_utils.py:534-730`).
  - nginx turns buffering off for it (`X-Accel-Buffering: no`, `chat.py:91`, `nginx/nginx.conf:110`).
- **`/chat`:** ✅ non-streaming.
- **Streaming for BRP:** both streaming routes go through chat apps and sessions, and those need a **user** login (Q1). With the API-client design, Ask Amplifi can't stream, so show a "Searching the papers…" state instead.
- **Reference parser:** Amplifi's own frontend parses the stream in `frontend/src/api/chatApp/runAgUiChatStream.ts`, if a user-login path is ever added.

## Q5. Can a request be limited to one dataset or one file?

- **Per request:** ❌ there is no dataset or file parameter on `/chat/upload` or `/chat`.
- **Per agent:** ✅ the datasets are fixed by the **workspace tools** attached to the agent. Each tool has its own `dataset_ids` (`POST /workspace/{ws}/tool` with `{name, description, tool_ids, dataset_ids}`). To limit a request to Theme B, use an agent whose tools cover only Theme B.
- **Per file (inside the agent):** 🟡 the Vector and Hybrid Search tools accept an optional **`file_ids`** filter (`FS/tools/system_tools/schemas/vector_search_schema.py:18`, `hybrid_search_schema.py:18`). The **LLM** picks it, not the caller.
  - A built-in workflow requires File System Navigator before Vector or Hybrid Search when both are present (`_has_ambiguous_tools`, `dynamic_agent.py`).
  - So naming the paper in the message ("in paper CP01 / file '2026 - Shen'") together with the prompt's file-name mapping is the only way to scope to a file. How reliable that is: ❓.

## Q6. Is there a JSON or structured-output mode?

- **Per request:** ✅ the `output_schema` form field on `/chat/upload` takes a JSON Schema string.
  - It's wrapped in pydantic-ai `StructuredDict` and passed as the agent's `output_type` (`chat.py:131-140`, then `dynamic_agent.chat(..., output_type=...)`).
  - Invalid JSON returns 400 "Invalid JSON schema format".
  - Only `/chat/upload` has this, not `/chat` or `/chat/stream`.
- **Per agent:** ❌ there is no response-format field on the agent.
  - The agent schema has `name, description, prompt_instructions, system_prompt, llm_provider, llm_model, temperature, memory_enabled, agent_metadata, workspace_tool_ids` (`backend_new/packages/amplifi-db/src/shared/schemas/agent_schema.py:16`).
  - Without `output_schema`, JSON-only replies depend on the prompt.
- **Models available:** `GPT35, GPT4o, GPT41, o3-mini, GPT5, SARVAM, GPT52, GPT54, CLAUDE_SONNET46` (`backend_new/packages/amplifi-base/src/shared/enums/chat.py:10`). `temperature` defaults to 0.7, so set it to 0–0.2 in the UI per brief §1.
- **Not yet tested** (❓):
  - Whether `output_schema` works with every tool combination (File Navigator, then Vector, then Hybrid).
  - Whether it works with `GPT52`.
  - What happens when the model can't fill the schema. It probably raises, and then comes back as `{"error": ...}` with HTTP 200.

## Q7. Rate limits, timeouts and error formats, and where the 22 Oct errors come from

**Rate limits** (✅, local nginx, `nginx/nginx.conf`):
- API routes: 10 requests/second per IP, with a burst of 20 (L8, L67).
- Other routes: 30 requests/second.
- The hosted dev environment sits behind Kubernetes ingress, whose limits are ❓.

**Timeouts** (✅, local nginx):
- `proxy_read_timeout 60s` (L57, L79). An agent run longer than 60 s would get **504** locally.
- `client_body_timeout 10s`.
- Hosted ingress timeouts: ❓. Ask the Amplifi team, because multi-tool agent runs can take more than 60 s.

**Size limits** (✅):
- Request body: 300 MB (nginx).
- Files attached to `/chat/upload`: 50 MB in total and 50 pages (`config.py:426-428`).

**Error formats:**
- FastAPI `HTTPException` returns `{"detail": "<message>"}` with the real status:
  - 400: empty query, or a bad schema
  - 401: expired or bad token, e.g. "Your token has expired. Please authenticate again."
  - 403: wrong organization, role, or expired client
  - 404: missing workspace or client
  - 413: files too large
- **`/chat/upload` agent failures return HTTP 200 with `{"error": "<exception text>"}`** (`FS/utils/chat_utils.py:771-773`). Always check for an `error` key.
- A failed sub-question returns HTTP 200 with `responses[i] = {"error": "Failed to process question: ..."}` (`dynamic_agent.py`).

**The three errors seen on 22 October:**

| Message | Source | Meaning |
|---|---|---|
| "streaming failed" | **Amplifi frontend**, `frontend/src/components/chat-app/chatboxV2.jsx:1463` ("Streaming failed. Please try again.") | A generic `onError` for the chat stream. `runAgUiChatStream.ts` fires it for a `RUN_ERROR` frame (L110), a network or parse failure (L135), or a stream that ends without `AMPLIFI_DONE` (L141). The real cause is in the backend logs, not the message. |
| "Chat App Not Found" | **Amplifi frontend**, `frontend/src/components/empty-screens/chatNotFound.jsx:8` | Shown when `getChatAppById` fails **for any reason**: 401, network error or 404 (`frontend/src/components/chat-app/chatbox.jsx:221-226`), or when a chat call returns 404 (`:592-593`). It doesn't necessarily mean the app is missing. An expired login or a backend restart shows the same page. |
| "Workspace not found" | **Backend**, `FS/services/workspace_service.py:95,142,157` and `FS/services/log_service.py:32` (404) | The workspace ID doesn't exist, is soft-deleted, or belongs to another organization. |

None of these come from `/chat/upload`. It returns 404 "You are not authorized to perform this action" for a bad workspace ID (`workspace_authz_service.py:95-98`), and 403 for a workspace in another organization.

## Q8. What is the CORS policy?

- **Setting** (✅): `CORSMiddleware` with `allow_origins` taken from **`BACKEND_CORS_ORIGINS`**, which accepts a JSON list or a comma-separated string (`config.py:341-343`). Credentials, all methods and all headers are allowed (`FS/main.py:198-206`).
- **Defaults:** the local default in `.env.example` is `["*"]`. The hosted dev value is ❓.
- **nginx:** adds no CORS headers.
- **For BRP:** CORS doesn't matter. The browser only calls the BRP proxy on its own origin, and the proxy calls Amplifi server-to-server.

## Q9. Can agents, prompts and tools be configured through the API?

✅ Yes, but **only with a user login** (admin or developer):

| Action | Endpoint | Where |
|---|---|---|
| Create agent | `POST /workspace/{ws}/agent` | `FS/api/v1/endpoints/agent.py:39` |
| Update agent (prompt, model, temperature, tools) | `PUT /workspace/{ws}/agent/{agent_id}` | `agent.py:176` |
| List / get agents | `GET /workspace/{ws}/agent[/{id}]` (admin, developer or member) | `agent.py:94` |
| Create workspace tool | `POST /workspace/{ws}/tool` | |
| List system tools | `GET /system-tools` | |

The API client gets 403 on all of these. For the POC, set up the UI agent in the Amplifi UI (brief Phase 3). A script with an admin login could do it too, but that adds a LoginRadius login, which the brief rules out.

## Q10. Is there an endpoint that lists datasets and files?

✅ Yes, but they need a user login (admin, developer or member), so **the API client can't use them**:

- `GET /workspace/{ws}/dataset` (`FS/api/v1/endpoints/dataset.py:124`)
- `GET /workspace/{ws}/file` (`FS/api/v1/endpoints/source_connector.py:725`)
- `GET /dataset/{ds}/ingestion_status`
- `GET /workspace/{ws}/dataset/{ds}/chunks`

The Library should therefore use the static papers config, as brief §6.5 says. If live statuses are wanted later, the options are a user login or an Amplifi change to allow `api_client` on these GET routes.

## Q11. Which environments exist, and what are their base URLs?

From the frontend deploy workflows (✅). The API base is `<host>/api/v3`.

| Env | API host | Amplifi UI | Where |
|---|---|---|---|
| dev | `https://dev-api.dataamplifi.com` | `https://dev-app.dataamplifi.com` | `.github/workflows/deploy_dev_frontend.yml:31,39` |
| stage | `https://stage-api.dataamplifi.com` | `https://stage-app.dataamplifi.com` | `.github/workflows/deploy_stage_frontend.yaml:29,36` |
| helm-test | `https://helm-test-api.dataamplifi.com` | | `.github/workflows/deploy_dev_frontend_helm_test.yml:34` |
| prod | ❓ (`vars.NEXT_PUBLIC_BASE_URL`, a GitHub variable) | | `.github/workflows/deploy_prod_frontend.yaml:86` |
| local | `http://localhost:8085` (nginx) or `:8000` (direct) | `:3000` | `README.md` |

There is also a marketplace deployment (`DEPLOYED_ENV=ampi-marketplace`) and an ONGC deployment (`k8s/ongc`).

**❓ Ask the Amplifi team** which environment holds the Theme A and Theme B workspace. The 22 Oct notes suggest dev.

## Q12. Is there an SDK, OpenAPI spec or example code to reuse?

- **OpenAPI** (✅): `GET /api/v3/openapi.json`. Swagger UI is at `/docs_v3`, behind HTTP basic auth (`AMPLIFI_DOCS_USERNAME` / `AMPLIFI_DOCS_PASSWORD`). The OpenAPI file can generate TypeScript types if needed.
- **No client SDK** in the repo.
- **Best example code:**
  - `backend_new/tests/e2e/`, a plain-HTTP Python client (`requests`). `workflows/shared_workflow_steps.py` shows the full sequence: workspace, upload, dataset, ingest, tool, agent, chat app, session, chat.
  - `frontend/src/api/` (axios), including `frontend/src/api/chatApp/runAgUiChatStream.ts` for SSE.
- **Public docs:** `docusaurus/docs/` (getting-started, core-concepts, how-to guides). `docusaurus/docs/changelog.md:52` notes that "`/chat/upload` accepts API clients and is scoped to the caller's organization".

---

## Open items to settle with a live call or the Amplifi team

1. Which environment and workspace hold Theme A and Theme B. We need the `workspace_id`, the agent IDs and an API client from an admin.
2. What `split_questions` does to a `TASK/INPUT/FORMAT` message. Is the `[USER_QUESTION]`/`[REPORT_DATA]` bypass acceptable, or can they add a flag?
3. Whether `output_schema` works with the Theme B tool chain and GPT-5.2.
4. Hosted ingress timeouts and rate limits, given that agent runs may exceed 60 s.
5. Whether chunks keep page numbers anywhere the agent can see them, for citations.
6. Whether Amplifi would allow `api_client` on the read-only list endpoints (datasets, files, ingestion status), for a live Library.
7. Confirm Q1's inference that `/chat` with an API-client token fails on the session foreign key.
