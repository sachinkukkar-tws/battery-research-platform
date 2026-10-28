# Battery Research Platform

A React frontend for the Battery Science proof of concept. Researchers explore battery research papers, review the values extracted from them, compare anode and cathode materials, chart the findings, and ask **Amplifi** questions about the papers.

> **Status.** The Ask Amplifi page is connected to a live Amplifi chat app through a small server-side proxy, and answers from the ingested client papers with clickable citations. The other pages run on the bundled sample data.

## Contents

- [Overview](#overview)
- [Quick start](#quick-start)
- [Commands](#commands)
- [Connecting to Amplifi](#connecting-to-amplifi)
- [How the Amplifi connection works](#how-the-amplifi-connection-works)
- [Configuration](#configuration)
- [Data modes](#data-modes)
- [Project structure](#project-structure)
- [Architecture](#architecture)
- [Testing](#testing)
- [Accessibility](#accessibility)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations)
- [Further documentation](#further-documentation)

---

## Overview

| Page | What it does | Data |
| --- | --- | --- |
| **Workspace** | Find tested anode and cathode pairs, compare materials, and spot untested combinations | Sample data |
| **Library** | Search and filter the papers, and open a paper's details | Sample data |
| **Review** | Approve or correct values extracted from the papers | Sample data |
| **Charts** | Plot and rank materials by their reported properties | Sample data |
| **Ask Amplifi** | Ask questions about the papers and get cited answers, with follow-up questions in the same conversation | **Live Amplifi** when connected, otherwise demo answers |

The top bar shows which kind of data you are looking at: **Live Amplifi** on the chat page when it is connected, and **Demo data** elsewhere.

This app is a refactor of the single-file prototype `battery_platform_demo.html`. Every screen and workflow from the prototype was kept; [docs/MIGRATION.md](docs/MIGRATION.md) maps each feature to its new home. The upload screen has been removed from the navigation for the demo; its code remains at `/upload`.

## Quick start

Requires **Node.js 20 or later**.

```bash
npm ci
npm run dev
```

Open <http://localhost:5173>. With no configuration the app runs entirely on sample data, and nothing leaves the browser.

To connect the chat to Amplifi, follow [Connecting to Amplifi](#connecting-to-amplifi).

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload at <http://localhost:5173> |
| `npm run amplifi:proxy` | Starts the Amplifi proxy at <http://localhost:8787> (reads `.env.amplifi`) |
| `npm run build` | Type check, then a production build into `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm test` | Runs all tests once (`npm run test:watch` keeps them running) |
| `npm run lint` | ESLint, including the React hooks rules |
| `npm run typecheck` | TypeScript only |
| `npm run build:standalone` | One self-contained HTML file in `dist-standalone/`, for sharing a demo |

## Connecting to Amplifi

### Before you start

You need:

- **Amplifi running**, with its API reachable (locally: `http://localhost:8085/api/v3`).
- **An Amplifi chat app** whose agent answers from the ingested papers. Test it in Amplifi's own UI first.
- **An Amplifi login** (email and password) that can use that chat app.

### Step 1. Configure the frontend

Create `.env` in this folder. It holds no secrets:

```ini
VITE_DATA_MODE=mock
VITE_CHAT_MODE=live
VITE_AMPLIFI_PROXY_URL=/amplifi
AMPLIFI_PROXY_TARGET=http://localhost:8787
VITE_REQUEST_TIMEOUT_MS=120000
```

### Step 2. Configure the proxy

Copy `.env.amplifi.example` to `.env.amplifi` and fill it in. This file is gitignored and is read only by the proxy, so the login never reaches the browser.

```ini
AMPLIFI_BASE_URL=http://localhost:8085/api/v3
AMPLIFI_EMAIL=<your Amplifi login email>
AMPLIFI_PASSWORD=<your Amplifi login password>
AMPLIFI_CHAT_APP_ID=<your chat app ID>
```

The chat app ID is in Amplifi's address bar when the chat app is open.

### Step 3. Start both servers

In two terminals:

```bash
npm run amplifi:proxy
```

```bash
npm run dev
```

### Step 4. Check the connection

1. Open <http://localhost:8787/amplifi/ping>. It should show `"ok": true`, which means the proxy logged in to Amplifi.
2. Open <http://localhost:5173/ask>. The top bar should say **Live Amplifi**.
3. Ask *"What is the ICE of CP01's hard carbon?"* The answer should give **94.8%** with a **CP01** citation.

## How the Amplifi connection works

```
Browser (Ask Amplifi page)
   |  POST /amplifi/chat
   v
Vite dev server  (forwards /amplifi to AMPLIFI_PROXY_TARGET)
   v
Proxy  server/amplifi-proxy.mjs, port 8787  (holds the Amplifi login)
   |  POST /login/access-token
   |  POST /chat_app/{id}/chat_session
   |  POST /chat
   v
Amplifi API  ->  agent and search tools  ->  ingested papers
```

1. **Log in.** The proxy signs in with `POST /login/access-token` and keeps the token. It signs in again after 50 minutes, or straight away if Amplifi rejects the token.
2. **One session per conversation.** For each new conversation, the proxy creates an Amplifi chat session with `POST /chat_app/{id}/chat_session`. Amplifi stores the history in that session, so follow-up questions work. *New chat* starts a new session.
3. **Ask.** Each question goes to `POST /chat` with the chat app ID, the session ID and the question. If the question is limited to one paper, the proxy adds *"Answer using only paper CPxx."*
4. **Answer.** The proxy returns the answer text and the session ID. Agent failures, which Amplifi returns as HTTP 200 with an `error` field, become clear error messages.

In the browser, answers are rendered from Markdown (headings, bold, lists and tables). Inline markers such as `[CP01]` become buttons that open the paper in the Library. Raw HTML in an answer is never rendered.

The browser's side of the contract is defined in `src/services/amplifiApi.ts`. Only `src/services/` and the proxy need to change if Amplifi's API changes; components never call `fetch` themselves.

## Configuration

### Frontend (`.env`)

All `VITE_` variables are read once at startup in `src/services/config.ts`. Invalid values fall back to safe defaults.

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_DATA_MODE` | `mock` | `mock` uses the sample data; `live` calls the platform API for every page |
| `VITE_CHAT_MODE` | same as `VITE_DATA_MODE` | `live` sends only Ask Amplifi to the proxy |
| `VITE_AMPLIFI_PROXY_URL` | `/amplifi` | Where the browser sends chat requests |
| `VITE_PLATFORM_API_BASE` | `/api` | Platform REST API base, used in `live` data mode |
| `VITE_REQUEST_TIMEOUT_MS` | `30000` | Timeout per request; use `120000` with live chat |
| `VITE_MAX_UPLOAD_MB` | `50` | Largest PDF the upload screen accepts |
| `VITE_ROUTER_MODE` | `browser` | `browser`, `hash` (static hosting) or `memory` (embedded demos) |

Development-server settings, read only by `vite.config.ts` and never sent to the browser:

| Variable | Purpose |
| --- | --- |
| `AMPLIFI_PROXY_TARGET` | Where the dev server forwards `/amplifi`, normally `http://localhost:8787` |
| `DEV_API_TARGET` | Where the dev server forwards `/api` (and `/amplifi` if `AMPLIFI_PROXY_TARGET` is not set) |

### Proxy (`.env.amplifi`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `AMPLIFI_BASE_URL` | Yes | Amplifi API base including `/api/v3` |
| `AMPLIFI_EMAIL` | Yes | Amplifi login email |
| `AMPLIFI_PASSWORD` | Yes | Amplifi login password |
| `AMPLIFI_CHAT_APP_ID` | Yes | The chat app to ask |
| `PORT` | No | Proxy port, default `8787` |
| `AMPLIFI_TIMEOUT_MS` | No | Timeout for each Amplifi call, default `120000` |

## Data modes

| Mode | Settings | Behaviour |
| --- | --- | --- |
| **Demo** | defaults | Everything uses the sample data in `src/data/`. Ask Amplifi answers only the suggested questions, and every answer is labelled *Demo answer, not generated by Amplifi*. |
| **Live chat** | `VITE_CHAT_MODE=live` | Ask Amplifi uses the proxy and real Amplifi answers; the other pages keep the sample data. This is the current setup. |
| **Fully live** | `VITE_DATA_MODE=live` | Every page calls the platform REST API described in [docs/INTEGRATION.md](docs/INTEGRATION.md). That API does not exist yet. |

## Project structure

```
server/
  amplifi-proxy.mjs   Server-side proxy between the browser and Amplifi (no dependencies)
src/
  types/              Typed models: research records, papers, review items, chat, uploads
  data/               Sample data and static configuration, used only by the demo adapters
  domain/             Pure logic with no React: filters, chart maths, review rules, citations, Markdown
  services/           Backend layer: HTTP client, response validation, demo and live adapters
  state/              React context providers: data, view state, chat, uploads, dialogs, toasts
  hooks/              Small reusable hooks: theme, media queries, stored state, page title
  components/         Presentational components, grouped by area
    common/ layout/ navigation/ charts/ tables/ chat/ upload/ review/ detail/
  pages/              One folder per route, composing components with state
  styles/             Design tokens (variables.css) and global base styles
  test/               Test setup and whole-app flow tests
docs/                 Integration notes and Amplifi API findings
scripts/              Standalone HTML build
```

## Architecture

**Data flow.** A page reads from a provider such as `useResearchData` or `useChat`. The provider calls a service, and the service calls an adapter chosen once in `src/services/index.ts` from the configuration. Tests inject their own adapters through `ServicesProvider`, which is how failures and slow responses are tested without a network.

**State.** React state and context only; no state library was needed. Server data lives in `ResearchDataProvider`, which uses a reducer. Filters and selections live in `ViewStateProvider`, so they survive moving between pages. The chat thread is kept in `sessionStorage` for the current tab.

**Chat answers.** Rendered with `react-markdown` and `remark-gfm`, the same libraries Amplifi's own interface uses. `src/domain/markdown.ts` turns Amplifi's bullet characters into proper lists and citation markers into links, which `CitedText` renders as buttons.

**Charts.** Hand-written SVG components rather than a charting library. They draw Pareto ("best balance") outlines, collision-free point labels and log axes, and their points can be focused with the keyboard to open the record. The maths is in `src/domain/charts.ts` and is unit tested. Records missing a value are left out and counted in the caption, never estimated.

**Styling.** CSS Modules on top of a design token file. Light and dark themes follow the system until the person picks one.

**Dependencies.** At runtime: React, React DOM, React Router, Lucide icons, `react-markdown` and `remark-gfm`. Everything else is development tooling. The proxy uses only Node's built-in modules.

## Testing

`npm test` runs 74 tests.

- **Domain.** Pair filtering and summaries, compare picks, the untested grid, chart maths (ticks, log axes, Pareto front, correlation, missing values, label placement), review state changes, PDF validation, citations, formulae, and the Markdown conversion of Amplifi answers.
- **Services.** HTTP error mapping (401, 403, 404, 413, 5xx, network, timeout, cancellation, invalid JSON), response validation, the proxy contract (including a check that no credentials are sent from the browser), and demo streaming and stop.
- **Whole-app flows.**
  - Dashboard links and quick questions.
  - Find with Amplifi on a missing value.
  - A failed load with retry.
  - Library search and filters that persist.
  - Review: approve, correct with validation, failed save, and double-click protection.
  - Upload: rejection, the full pipeline into the Library, failure and retry.
  - Chat: demo labelling and citations, the error state, follow-up history and scope, formatted Amplifi answers, the live badge, and opening the chat from a paper.

The proxy was also tested end to end against a local Amplifi: login, a cited answer, and a follow-up question in the same session.

## Accessibility

- Every page was audited with axe-core (WCAG 2 A and AA plus best practices) in light and dark themes, and again with a dialog open, a chat answer showing and an upload in progress.
- **Keyboard.** A skip link, visible focus on every control, and arrow-key tabs (Home and End too). Chart points and bars can be focused and opened. Enter sends a chat message and Shift+Enter adds a line. Dialogs trap focus, close on Escape and return focus to where they were opened.
- **Screen readers.** Tables are real tables with captions and restack visually on phones. Status messages, toasts and answers use live regions. Icon buttons have names, and the review badge is announced as "6 waiting".
- **Contrast.** Muted text, the brand teal, the approve green, the checked-status green and the link teal were darkened slightly from the prototype to reach 4.5:1.
- Reduced-motion preferences turn off animation.

## Security

- **Secrets stay on the server.** The Amplifi email and password live only in `.env.amplifi`, which is gitignored and read only by the proxy. The browser never sees them or the Amplifi token.
- **Never put secrets in `VITE_` variables.** Every `VITE_` variable is compiled into the JavaScript bundle and is visible to anyone using the app.
- **No raw HTML.** Chat answers are rendered as Markdown only; HTML inside an answer is not rendered.
- **Quiet logs.** The proxy logs the method, path, status and duration of each request, never the token, the password or the question text.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Ping says the Amplifi login failed | The email, password and base URL in `.env.amplifi`. Restart the proxy afterwards; it reads the file at start. |
| The chat shows an Amplifi error about the chat app | `AMPLIFI_CHAT_APP_ID`, and that the login can open that chat app in Amplifi's UI. |
| *Took too long* (HTTP 504) | Amplifi's nginx stops at 60 seconds. Set `AMPLIFI_BASE_URL=http://localhost:8000/api/v3` to call the API directly. |
| Answers are labelled as demo answers | `VITE_CHAT_MODE=live` is missing from `.env`. Restart `npm run dev` after editing it. |
| *Amplifi had a problem (error 500)* or *Couldn't reach Amplifi* | The proxy is not running, or `AMPLIFI_PROXY_TARGET` does not match its port. |

## Known limitations

- **Chat only.** Only Ask Amplifi is live. The other pages use the sample data, and *Find with Amplifi* gives a demo result.
- **No streaming.** The whole answer appears at once, typically after 10 to 20 seconds.
- **One shared login.** Everyone using a running proxy asks through the same Amplifi account.
- **Session-only data.** In demo mode, review decisions last only until the page is reloaded.
- **Fonts.** Montserrat loads from Google Fonts. For locked-down networks, self-host it (for example with `@fontsource/montserrat`) and remove the link in `index.html`.

## Further documentation

| Document | Contents |
| --- | --- |
| [docs/amplifi-api-notes.md](docs/amplifi-api-notes.md) | Findings from reading Amplifi's code: endpoints, authentication, response shapes and limits |
| [docs/AMPLIFI_GETTING_STARTED.md](docs/AMPLIFI_GETTING_STARTED.md) | Step-by-step plan for running the frontend on Amplifi |
| [docs/AMPLIFI_WIRING_BRIEF.md](docs/AMPLIFI_WIRING_BRIEF.md) | The wider integration brief, including the structured tasks for the other pages |
| [docs/INTEGRATION.md](docs/INTEGRATION.md) | The platform REST API contract for fully live mode |
| [docs/MIGRATION.md](docs/MIGRATION.md) | Where each feature of the original prototype now lives |
| [docs/React_Frontend_Handoff.md](docs/React_Frontend_Handoff.md) | Handoff notes for the React frontend |
