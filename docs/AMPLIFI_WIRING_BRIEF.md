# Wiring the Battery Research Platform to Amplifi: brief for Claude Code

## 0. How to use this brief

You're helping wire the Battery Research Platform frontend (React, TypeScript, Vite) to Amplifi, the organisation's AI platform, for a proof of concept (POC). This brief summarises the work done so far and what to build next. Read all of it before starting.

**Ground rules**

- Treat the Amplifi repository as read-only reference. Learn its API from it, but don't change it unless asked.
- Never put API keys or credentials in frontend code, fixtures, logs or commits.
- Work one phase at a time (section 7). At the end of each phase, stop and summarise what you did, what you found and what's still open.
- If the code doesn't confirm an API detail, say it's unconfirmed. Don't guess.

**Files in this pack**

| Path | What it is |
|---|---|
| `CLAUDE.md` | Short standing instructions for every session |
| `docs/AMPLIFI_WIRING_BRIEF.md` | This brief |
| `docs/React_Frontend_Handoff.md` | The full spec for the React frontend: structure, design tokens, the six screens and the data types |
| `reference/battery_platform_demo.html` | A working single-file demo and the visual and behavioural reference. Its `DataService` shows where live mode plugs in. |
| `reference/records.json` | Sample data in the frontend's internal record format |
| `reference/amplifi_agent_prompt_v4.7.txt` | The current chat agent prompt: theme rules, paper IDs, the file-name mapping and the Theme B search workflow |
| `reference/checked_values.json`, `.csv` | 72 values checked by hand against 8 of the papers, with pages. This is the answer key for accuracy tests. |
| `reference/Amplifi_Integration_Design_Draft.docx` | The integration design draft written for Jay. Its content is summarised in this brief. |

## 1. The project in brief

- **Users and goal:** a government-sector organisation in India working on battery science. The POC shows how researchers can search battery papers, compare materials and see the evidence behind each value. It is the first phase of a broader research assistant meant to cover far larger collections of papers, eventually turning papers into structured battery data.
- **Platform:** Amplifi ingests documents into datasets and answers questions through configurable agents. Each agent is a prompt, a model, and search tools over the datasets.
- **Model settings:** GPT-5.2 at low reasoning effort, with temperature 0–0.2. GPT-5.4 gave no meaningful accuracy gain and costs about 25–30% more.
- **Datasets:**
  - **Theme A, lithium-ion (LFP and NMC):** 27 documents (C1–C22, N1–N2, I1–I3) plus the corpus catalogue, CAT. Amplifi can't search CAT's contents, so the prompt carries a topic index instead.
  - **Theme B, the hard carbon papers (mainly sodium-ion):** CP01–CP10, in a separate dataset of their own. CP02 is lithium-ion (a graphite anode with a hard carbon network). CP08 is a review with no new measurements.
- **Agents and tools:**
  - The chat agent runs the two-theme prompt. v4.6 is live; v4.7 adds the Theme B search workflow and has been tried on a Claude Sonnet test agent.
  - Theme B has three tools, used in this order: `Tool-01-File-Sys-Nav-Theme-B` (File Navigator), `Tool-02-Vec-Search-Theme-B` (Vector Search) and `Tool-03-Hybrid-Search-Theme-B` (Hybrid Search).
- **Paper files:** Theme B papers keep their original file names. Match them to IDs by first author and year (section 9), and always show IDs, never file names.

## 2. What has been done so far

| Area | What was done | Result |
|---|---|---|
| Corpus | Curated and ingested the Theme A corpus, then the 10 hard carbon papers as Theme B, with DOIs verified | 37 documents in two datasets |
| Agent prompt | Iterated the prompt from v3 to v4.7 | Theme A, Round 2: 20 of 20 test questions and 3 of 3 researcher questions passed |
| Structured-data pilot | Built an answer key of 8 papers × 9 fields = 72 values, each with its page, checked by hand | 63 of 70 scored values matched (90%), but the score was inflated (section 8) |
| Model comparison | Ran 20 new questions (10 on starting material, 10 on other fields) on GPT-5.2 and GPT-5.4 | 15 of 20 and 14 of 20; stayed on GPT-5.2 |
| Amplifi team suggestions | Configured the three Theme B tools and wrote prompt v4.7 with a tool-by-tool workflow | The Claude Sonnet test agent ran 14 of 20 questions before the environment failed |
| Scalability | Analysed how retrieval behaves on list and comparison questions | Each answer draws on about 10 pages, so questions across many papers miss papers. At scale this needs a structured index. |
| Frontend | Built a tabbed explorer, then a six-screen platform, then a Paper Dashboard-style demo, and wrote a React spec | `reference/battery_platform_demo.html`, `docs/React_Frontend_Handoff.md` |
| Integration design | Drafted how the UI sends tasks to Amplifi and shows the JSON results | `reference/Amplifi_Integration_Design_Draft.docx` |

## 3. Decisions from the meeting on 23 October

- Wire the UI straight to Amplifi's existing agent APIs. Don't build ingestion, a database or authentication.
- Documents, datasets and agents are managed in the Amplifi UI.
- The agent returns structured JSON that fills the UI. For example, picking an anode asks for the cathodes tested with it, and picking a cathode fetches that pair's details.
- Use API key authentication for the POC, with no login flow.
- Configure the prompt instructions and JSON formats so that answers arrive ready for the frontend.
- Cover questions about materials, evidence and paper quality.

**What this changes:** an earlier `INTEGRATION.md` described a platform REST API backed by a database (`/api/records`, `/api/review`, `/api/upload`). That design is superseded. In live mode the frontend calls Amplifi tasks directly, and a mapping layer turns each task's JSON into the frontend's internal types, so the screens don't change.

## 4. The frontend today

- **The app:** the React app follows `docs/React_Frontend_Handoff.md`, with six screens: Workspace, Library, Upload, Review, Charts and Ask Amplifi. If the app doesn't exist in the working folder yet, ask before scaffolding it.
- **The data layer:**
  - All data goes through one `DataService` interface with a demo and a live implementation, chosen by `config.mode`.
  - Demo mode uses the sample data and must keep working offline.
- **The seams in the demo HTML:**
  - `DataService` has `loadData`, `loadLibrary`, `loadReview`, `submitReview`, `uploadPaper`, `ask` and `findValue`.
  - There are two Amplifi adapters, `callAmplifi` and `toAnswer`. Their request and response shapes were placeholders; replace them with the real API from Phase 0.

## 5. Target architecture

```
Browser: React app
  features/*  (screens)
    -> services/dataService            demo | live
         live -> services/amplifi/tasks.ts    build TASK requests, validate JSON, map to app types, cache
              -> services/amplifi/client.ts   one HTTP client: timeouts, retries, streaming if supported
                   -> /amplifi  (proxy)        adds the API key on the server side
                        -> Amplifi agent API -> UI agent (JSON only) | chat agent (text with citations)
                                             -> search tools -> Theme A and Theme B datasets
```

- **Two agents sharing the same datasets and tools.** This is proposed and still pending confirmation.
  - The existing chat agent answers in Ask Amplifi.
  - A new UI agent answers only in the JSON formats in section 6. Its prompt (section 6.4) is pasted into the Amplifi UI, unless the API lets us set it from code.
- **The proxy:** the Vite dev-server proxy for local work, and a small Node server for shared demos. Either way, the key comes from a server-side environment variable.
- **Environment variables** (rename them once the API is known):
  - Client: `VITE_MODE` (`demo` or `live`) and `VITE_AMPLIFI_BASE=/amplifi`.
  - Server only: `AMPLIFI_BASE_URL`, `AMPLIFI_API_KEY`, `AMPLIFI_UI_AGENT_ID` and `AMPLIFI_CHAT_AGENT_ID`.
  - Provide `.env.example`, and never commit `.env`.

## 6. Contracts

### 6.1 Request

Every request to the UI agent is one message:

```
TASK: cathodes_for_anode
INPUT: {"anode": "BGP@HEC-HC"}
FORMAT: JSON only, using the cathodes_for_anode format (version 1)
```

### 6.2 Response envelope

```json
{ "task": "cathodes_for_anode", "version": 1, "status": "ok", "data": {}, "notes": null }
```

- **`status`** is `ok`, `partial` (some values missing) or `not_found`.
- **Missing values:** anything a paper doesn't state is `null`. Values are never estimated or calculated.
- **Numbers** are numbers. Units and test conditions sit in their own fields.
- **Sources:** every value carries a paper ID and a PDF page. Quotes are at most 25 words.

### 6.3 Tasks

| Task | Sent when | Input | `data` returned | Fills |
|---|---|---|---|---|
| `list_anodes` | The Workspace opens | `battery_type` (optional) | `anodes[]`: `name`, `starting_material`, `material_group` (`Biomass` or `Other`), `battery_type`, `paper`, `page` | Anode list, mini chart |
| `cathodes_for_anode` | An anode is picked | `anode` | `anode`, `cathodes[]`: `name`, `formula`, `cell_format`, `cell`, `cycling`, `energy_wh_kg`, `energy_basis`, `paper`, `pages` | Cathode list, result rows |
| `pair_details` | A cathode is picked, or a row is opened | `anode`, `cathode`, `paper` | `anode_test`, `cell`, `cycling`, `energy_density`, `full_cell_capacity`, `low_temperature`, `evidence[]` | Pair details, Compare |
| `evidence_for_value` | A value without a quote is clicked | `paper`, `field`, `value` | `paper`, `field`, `value`, `page`, `quote` | Evidence pop-up |
| `paper_quality` | A paper is opened in the Library | `paper` | `study_type`, `checks[]`: `item`, `result` (`yes`, `partial`, `no` or `not_reported`), `detail`, `pages` | Evidence checklist |
| `find_value` | "Find with Amplifi" is clicked | `paper`, `material`, `field` | `value` (or `null`), `page`, `quote` | Pair details |
| `material_values` | Charts opens (once per paper, then cached) | `paper` | `material`, `values` keyed as below, each `{ value, condition, page }` | Charts, insights |
| Chat | A message is sent in Ask Amplifi | Question, optional paper scope | The chat agent's text with `[CP02]`-style citations, or `answer` plus `citations[]` if the API returns sources | Chat thread |

Compare and Untested pairs are computed from cached results and need no extra requests.

`material_values` keys, and the chart fields they feed (`docs/React_Frontend_Handoff.md`, section 9):

| Key | Chart field(s) |
|---|---|
| `reversible_capacity_mah_g` | `anodeCapacity` |
| `first_cycle_efficiency_pct` | `anodeICE` |
| `rate_capacity_mah_g` (its condition gives the current) | `rateCapacity`, `rateCondition` |
| `anode_cycles` | `anodeCycles` |
| `anode_retention_pct` | `anodeRetention` |
| `carbonization_temp_c` | `carbonizationTemp` |
| `d002_nm` | `d002` |

Full-cell cycles, retention and energy density come from `cathodes_for_anode` and `pair_details`.

**Examples.** These use values that were checked by hand. Text in angle brackets stands for content copied from the paper.

```json
{ "task": "list_anodes", "version": 1, "status": "ok",
  "data": { "anodes": [
    { "name": "ABP-L-1400", "starting_material": "Bamboo powder", "material_group": "Biomass",
      "battery_type": "Sodium-ion", "paper": "CP05", "page": "2" },
    { "name": "S-HC-2", "starting_material": "Starch", "material_group": "Biomass",
      "battery_type": "Sodium-ion", "paper": "CP09", "page": "2" } ] },
  "notes": null }
```

```json
{ "task": "cathodes_for_anode", "version": 1, "status": "ok",
  "data": { "anode": "BGP@HEC-HC", "cathodes": [
    { "name": "NFPP", "formula": "Na4Fe3(PO4)2(P2O7)", "cell_format": "Pouch",
      "cell": "700 mAh pouch cell", "cycling": "97.8% retention after 200 cycles at 1C",
      "energy_wh_kg": 150, "energy_basis": "active-material mass of both electrodes",
      "paper": "CP01", "pages": ["1", "7"] } ] },
  "notes": null }
```

```json
{ "task": "pair_details", "version": 1, "status": "partial",
  "data": {
    "anode": "BGP@HEC-HC", "cathode": "NFPP", "paper": "CP01", "battery_type": "Sodium-ion",
    "anode_test": { "capacity_mah_g": 375.3, "first_cycle_efficiency_pct": 94.8, "current": "20 mA/g", "page": "5" },
    "cell": { "format": "Pouch", "description": "700 mAh pouch cell", "pages": ["1", "7"] },
    "cycling": { "retention_pct": 97.8, "cycles": 200, "rate": "1C", "pages": ["1", "7"] },
    "energy_density": { "value_wh_kg": 150, "basis": "active-material mass of both electrodes", "pages": ["1", "7"] },
    "full_cell_capacity": null,
    "low_temperature": null,
    "evidence": [ { "field": "cycling", "page": "<PDF page>", "quote": "<up to 25 words from the paper>" } ] },
  "notes": "Full-cell capacity not found." }
```

```json
{ "task": "evidence_for_value", "version": 1, "status": "ok",
  "data": { "paper": "CP01", "field": "anode capacity retention", "value": "88.5% after 1,000 cycles at 1 A/g",
            "page": "6", "quote": "<up to 25 words from the paper>" },
  "notes": null }
```

```json
{ "task": "paper_quality", "version": 1, "status": "ok",
  "data": { "paper": "CP01", "study_type": "Lab study", "checks": [
    { "item": "Full cell tested", "result": "yes", "detail": "700 mAh pouch cell with an NFPP cathode", "pages": ["1", "7"] },
    { "item": "Long-term anode cycling", "result": "yes", "detail": "88.5% retention after 1,000 cycles at 1 A/g", "pages": ["6"] },
    { "item": "Test conditions stated", "result": "yes", "detail": "Current density given for capacity values", "pages": ["5"] },
    { "item": "Energy density basis", "result": "partial", "detail": "Active-material mass of both electrodes only", "pages": ["1", "7"] } ] },
  "notes": null }
```

```json
{ "task": "find_value", "version": 1, "status": "not_found",
  "data": { "paper": "CP01", "material": "BGP@HEC-HC", "field": "full-cell capacity", "value": null, "page": null, "quote": null },
  "notes": "The paper does not state this value in the text." }
```

```json
{ "task": "material_values", "version": 1, "status": "ok",
  "data": { "paper": "CP01", "material": "BGP@HEC-HC", "values": {
    "reversible_capacity_mah_g": { "value": 375.3, "condition": "20 mA/g", "page": "5" },
    "first_cycle_efficiency_pct": { "value": 94.8, "condition": "20 mA/g", "page": "5" },
    "anode_retention_pct": { "value": 88.5, "condition": "1,000 cycles at 1 A/g", "page": "6" } } },
  "notes": null }
```

### 6.4 Draft prompt for the UI agent

This goes alongside the file-name mapping and theme rules from `reference/amplifi_agent_prompt_v4.7.txt`.

```
You answer requests from the Battery Research Platform's screens, not from people.
Every request has three lines: TASK, INPUT and FORMAT.

Rules
1. Reply with one JSON object only: no text before or after it, no markdown, no code fences.
2. Use the response format for the task exactly, including task, version and status.
3. Only use what the papers say. If a value isn't stated, use null. Never estimate,
   convert or calculate a value the paper doesn't give.
4. Give numbers as numbers. Put units and test conditions in their own fields.
5. For every value, give the paper ID and the PDF page. Where asked, add a quote of
   no more than 25 words copied from the paper.
6. Search before answering: File Navigator to find the files, Vector Search for
   relevant passages, then Hybrid Search for exact values. For a task that covers
   several papers, search each paper separately.
7. Keep the collections apart. Theme A is lithium-ion. Theme B is the hard
   carbon papers, mainly sodium-ion. CP02 is a lithium-ion paper.
8. Use paper IDs, not file names. [Insert the THEME B FILE NAMES list from the
   v4.7 prompt.]
9. Set status to "ok" when everything was found, "partial" when some values are
   missing, and "not_found" when nothing relevant was found. Explain gaps briefly
   in "notes".

Formats
[Insert the response formats from section 6.3.]
```

### 6.5 Mapping task results into app types

`Record` (see `reference/records.json`) is built from task results:

| `Record` field | Source |
|---|---|
| `id` | `` `${paper}-${slug(cell_format || "full")}` ``, plus a counter if two records collide |
| `paper`, `author`, `year` | The papers config (section 9) |
| `battery` | `list_anodes.battery_type` |
| `anode`, `anodeFrom`, `anodeGroup` | `list_anodes`: `name`, `starting_material`, `material_group` |
| `cathode`, `cathodeFormula`, `format`, `cell` | `cathodes_for_anode` |
| `cycles`, `cycling`, `fullRetention` | `cathodes_for_anode.cycling` text, plus the numbers in `pair_details.cycling` |
| `energy`, `energyText`, `energyBasis` | `energy_wh_kg` and `energy_basis`, or `pair_details.energy_density` |
| `anodeTest`, `anodePage`, `anodeCapacity`, `anodeICE` | `pair_details.anode_test`, or `material_values` |
| Other chart fields | `material_values` |
| `lowTemp` | `pair_details.low_temperature` |
| `page` | The pages, joined with ", " |
| `checked` | `false` for anything from Amplifi, shown with a "From Amplifi" label (see open question 4) |

**Library items** come from a small papers config: IDs, authors, years, titles and collections, taken from the v4.7 prompt's SOURCE LIST and the demo's `SAMPLE_LIBRARY`. The details panel and the evidence checklist come from `paper_quality`. Statuses stay static for the POC.

**Upload** opens the Amplifi UI; this app doesn't upload anything. **Review** is optional for the POC: either keep decisions in the browser only, or hide the screen.

If calls turn out to be slow or costly, propose a per-paper task that returns all of one paper's records in a single reply. The interactive tasks could then be served from that cache. Agree this before building it.

## 7. Phases

Stop for review after each phase.

### Phase 0: learn the Amplifi API (read-only)

Explore the Amplifi repository and write `docs/amplifi-api-notes.md`. For each answer, cite the file paths it's based on, and mark anything unconfirmed. Include a sample request and response for sending one message to an agent, with keys redacted.

1. Which endpoint sends a message to an agent or chat app, and what is the full request body? Include any agent, chat app, workspace, dataset or conversation IDs.
2. How is the API key sent (header name and format), and how are keys issued and scoped?
3. What does the response contain: answer text, sources or citations (file name, page, passage), tool calls, and usage or token counts?
4. Is the response streamed (SSE, WebSocket or chunked), and is there a non-streaming option?
5. Can a request be limited to one dataset or one file?
6. Is there a JSON or structured-output mode, or a response-format setting per agent?
7. What are the rate limits, timeouts and error formats? Find where "streaming failed", "Chat App Not Found" and "Workspace not found" come from, and what causes them.
8. What is the CORS policy?
9. Can agents, prompts and tools be configured through the API, or only in the Amplifi UI?
10. Is there an endpoint that lists datasets and files, which the Library could use?
11. Which environments exist (dev, staging, production), and what are their base URLs?
12. Is there a client SDK, an OpenAPI spec or example code in the repo that we should reuse?

### Phase 1: client and proxy

- `services/amplifi/client.ts`:
  - one function to send a message, with timeouts
  - retries with backoff on 429 and 5xx errors
  - streaming, if the API supports it
  - typed errors with plain-language messages
- The Vite proxy configuration, plus a small Node proxy that adds the key from an environment variable.
- `npm run amplifi:ping`: sends one question to the chat agent and prints the answer, the sources and the time taken.
- **Done when:** the ping works, and no key appears in the browser bundle (check the build output).

### Phase 2: task layer

- `services/amplifi/tasks.ts`, covering the 8 tasks:
  - request builders
  - JSON extraction, which strips code fences and takes the first object
  - zod schemas with the inferred types
  - one retry with "Reply with JSON only", then a text fallback
  - normalisation of cathode aliases (NVP = Na3V2(PO4)3; NFPP = Na4Fe3(PO4)2(P2O7)), units and numbers
  - the mapping into app types (section 6.5)
  - a session cache
  - per-paper fan-out with at most 3 requests at once
- Unit tests with recorded replies kept as fixtures. Include a malformed reply and a `not_found` reply.
- **Done when:** the tests pass, and running the tasks live on CP01 returns BGP@HEC-HC with 375.3 mAh/g and 94.8% first-cycle efficiency at 20 mA/g.

### Phase 3: UI agent prompt

- Write `docs/ui-agent-prompt.md`: the final prompt from section 6.4, with the file-name list and the formats filled in, ready to paste into the Amplifi UI.
- **Done when:** after I've set up the agent, each task returns valid JSON for CP01 and CP05.

### Phase 4: wire the screens in live mode

- **Workspace:** the anode, cathode and pair flow; Compare and Untested pairs from the cache.
- **Library:** the papers config plus `paper_quality`.
- **Charts:** `material_values`.
- **Ask Amplifi:** the chat agent, with citations rendered as links.
- **Find with Amplifi:** `find_value`.
- **On every screen:** loading states ("Searching the papers"), errors with Try again, and "From Amplifi" labels.
- **Done when:** every screen works in live mode, and demo mode is unchanged.

### Phase 5: accuracy and cost check

- `npm run eval`:
  - asks for each of the 72 values in `reference/checked_values.json`, using the matching task
  - scores each as Match, Partial or No
  - records latency, and token usage if the API returns it
  - writes a CSV and a short summary
- **Done when:** the report runs end to end and can be compared with the pilot (section 8).

### Phase 6: hardening for the demo

- Timeouts and retry limits.
- Clear error copy.
- A switch between demo and live.
- A README covering setup, environment variables and commands.

## 8. What testing has taught us

| Finding | What to do |
|---|---|
| Asking for one field at a time works much better: starting material went from 4 of 7 to 9 of 10 correct | Keep each task small and focused on one paper |
| When the agent had to find detailed values itself, it was right about half the time | Show the quote and page with every value, and label values "From Amplifi" |
| The pilot's 90% was inflated by THEME B KEY RESULTS, the list of checked values in the chat prompt | Run the accuracy check without that list, to measure live accuracy honestly |
| Questions across many papers miss papers, because each answer draws on about 10 pages | For list tasks, send one request per paper and merge the results in the UI |
| The dev environment failed three ways on 22 October: "streaming failed", "Chat App Not Found" and "Workspace not found" | Add retries, timeouts and clear errors; find the causes in Phase 0 |
| An answer costs about 2.2 US cents on GPT-5.2, at list prices | Cache replies. A full anode list across the 9 sodium-ion papers costs about 20 cents. |
| Response times haven't been measured | Measure them in Phases 1 and 5, and fetch the anode list as soon as the Workspace opens |

## 9. Reference data

| ID | Paper | File name contains |
|---|---|---|
| CP01 | Shen 2026 | 2026 - Shen |
| CP02 | Wang 2026 (lithium-ion) | 2026 - Wang |
| CP03 | Qiu 2024 | 2024 - Qiu |
| CP04 | Liu 2026 | 2025 - Liu (the online year; cite it as 2026) |
| CP05 | Huang 2026 | 2026 - Huang |
| CP06 | Jia 2026 | 2026 - Jia |
| CP07 | Lin 2026 | 2026 - Lin |
| CP08 | Wu 2024 (review) | d4sc00734d |
| CP09 | He 2026 | 2025 - He (the online year; cite it as 2026) |
| CP10 | Dai 2026 | 2026 - Dai |

- **Theme A IDs:** C1–C22, N1, N2, I1–I3 and CAT. Full references are in the SOURCE LIST of the v4.7 prompt.
- **Further reading:** P1–P6 are references only; they are not in the knowledge base.
- **Checked values:** `reference/checked_values.json` holds the 72 checked values for CP01, CP03–CP07, CP09 and CP10, across 9 fields:
  - sample name
  - starting material
  - carbonization temperature
  - interlayer spacing (d002)
  - reversible capacity
  - first-cycle efficiency
  - rate performance at the highest current
  - cycling stability in anode tests
  - full-cell result

## 10. Guardrails

- No secrets in client code, fixtures, logs or commits.
- Don't modify the Amplifi repository. Work on a branch in our project.
- The papers are under a text-and-data-mining rights review. The POC can read and present them, but don't build bulk extraction or export features beyond the POC without approval.
- Never invent values; show "Not reported".
- Keep demo mode working.
- Log each Amplifi call (task, duration, status and response size), but never the key.

## 11. Open questions

**For the Amplifi team** (Phase 0 should answer most of these): the endpoint and formats, the API key, CORS, streaming and rate limits, citations with pages, limiting a request to one dataset or file, a JSON-only setting, and the cause of the environment errors.

**For Jay and Vinay:**

1. The meeting notes say picking a cathode retrieves the "associated backend material". This plan assumes that means the pair's full details. Is that right?
2. What should "paper quality" cover? The plan proposes an evidence checklist rather than a score.
3. Should Review and Upload stay in the POC demo?
4. Should the UI agent's prompt include the checked values for the 8 checked papers (a more accurate demo), or rely on search only (an honest view of live accuracy)?
5. Is the review an internal demo, or shown outside the team? That decides how the API key is handled.

## 12. First prompt for Claude Code

```
Read CLAUDE.md and docs/AMPLIFI_WIRING_BRIEF.md. Then do Phase 0 only: explore the
Amplifi repository at C:\SachinK\TWS-data\Battery-POC\amplifi-dev without changing anything, and write
docs/amplifi-api-notes.md answering all 12 Phase 0 questions. For each answer, cite
the files and code it's based on, include a sample request and response for sending
one message to an agent (keys redacted), and mark anything you couldn't confirm.
Don't write app code yet. Stop when the notes are ready and summarise what you found.
```
