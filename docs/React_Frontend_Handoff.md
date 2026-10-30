# Battery Research Platform: React frontend handoff

## 0. How to use this document

You are building the React frontend for a battery-research proof of concept (POC). A working single-file HTML demo already exists and is the reference for both look and behaviour. Your job is to rebuild it as a properly modular React app that runs on sample data today and can switch to a real backend later by changing configuration only.

Three files come with this document:

| File | Use it for |
|---|---|
| `battery_platform_demo.html` | The reference implementation. Open it in a browser to see every screen; read its CSS for exact styles and its script for behaviour, sample data and copy. |
| `records.json` | Sample data in the exact shape `GET /api/records` will return. Use it as the demo-mode mock. |
| `INTEGRATION.md` | The backend API contract and how the harvester is expected to work. |

Match the reference demo's visual design, wording and behaviour unless this document says otherwise. If something here conflicts with the demo, this document wins. Ask before changing the design tokens or adding new dependencies beyond the stack below.

## 1. Project context

- **What it is:** an AI research assistant over battery papers, built on the organisation's Amplifi AI platform (a retrieval-augmented chat agent, currently GPT-5.2 at low reasoning). The users are in the government sector in India.
- **Two collections, each an Amplifi dataset:**
  - Theme A, lithium-ion: 27 documents (C1–C22 papers and reports, N1–N2 lab studies, I1–I3 Indian policy documents).
  - Theme B, the hard carbon papers, mainly sodium-ion: CP01–CP10. CP02 is lithium-ion; CP08 is a review with no new measurements.
  - The Library shows all 37 documents.
- **Why the platform is more than a chatbot:** Amplifi answers each question from a handful of retrieved passages. That works for questions about one paper, but list, compare and count questions across many papers miss papers, and it can't scale to lakhs of papers. So key values are extracted per paper into a structured table (records). The Workspace and Charts answer list and compare questions from that table; Ask Amplifi handles questions about what a paper says.
- **Why there is a Review step:** in testing, Amplifi got detailed values right only about half the time when it had to find them itself. Every extracted value therefore waits for a person to approve, correct or reject it, and only checked values count as verified.
- **Users:** battery researchers and officials.

## 2. Scope

**In scope:** the app shell, six screens, light and dark themes, demo mode with the sample data, and a service layer ready for live mode.

**Out of scope for now:** the backend (records database, harvester, review storage, uploading to Amplifi), authentication and roles, and Amplifi credentials. Credentials must never be in the frontend; the backend calls Amplifi on the frontend's behalf.

## 3. Tech stack

- React 18 with TypeScript, built with Vite.
- React Router v6 for the six routes.
- Styling: CSS variables for design tokens, plus CSS Modules per component. Don't use Bootstrap or the Creative Tim template itself; its dependencies are outdated (Bootstrap 4 is end-of-life and it relies on Create React App, which is deprecated). Recreate the look with the tokens below.
- Server data: TanStack Query, wrapping the data service. UI preferences (theme, sidebar) live in a small React context backed by localStorage.
- Charts: custom SVG components, as in the demo (scatter with label collision avoidance, ranking bars, donut). `d3-scale` is acceptable for scales; avoid heavy chart libraries.
- Fonts: Montserrat from Google Fonts, falling back to "Helvetica Neue", Arial, sans-serif.
- Tests: Vitest and React Testing Library. Unit-test the statistics helpers and the services.
- ESLint and Prettier.

## 4. Folder structure

```
src/
  main.tsx
  App.tsx
  routes.tsx
  config.ts                  # mode "demo" | "live", API base, Amplifi settings, read from VITE_* env vars
  styles/
    tokens.css               # light and dark tokens (section 5)
    global.css               # resets, base type, focus ring, reduced motion
  types/
    index.ts                 # Paper, Record, LibraryItem, ReviewItem, AskAnswer, Citation, UploadOptions
  services/
    dataService.ts           # DataService interface and a factory that picks demo or live
    demoService.ts           # reads the mocks and simulates delays and upload steps
    liveService.ts           # REST calls to /api
    amplifiAdapter.ts        # callAmplifi() and toAnswer(), kept separate because Amplifi's API shape is not final
  mocks/
    records.json
    library.ts               # the 37 Library entries
    review.ts                # the 6 review cases
    demoAnswers.ts           # keyword-matched demo chat answers
  lib/
    format.ts                # number and unit formatting
    stats.ts                 # pearson, paretoFront, median, groupAverages, linear regression
    chartFields.ts           # the 11 chart fields (section 9)
    citations.ts             # parse [CP02] style citations
  hooks/
    useRecords.ts  useLibrary.ts  useReview.ts  useUpload.ts  useChat.ts
    useTheme.ts  useSidebar.ts  useToast.ts
  components/
    layout/   AppShell, Sidebar, NavItem, TopBar, Footer
    ui/       Card, StatCard, Button, IconButton, StatusBadge, Pills, Select, Toggle,
              SegmentedControl, Modal, Toast, Tooltip, EmptyState, DataRows
    charts/   ScatterChart, RankingChart, DonutChart, MiniScatter, Legend, InsightsPanel
    icons/    inline SVG icon components
  features/
    workspace/  WorkspacePage, StatCards, MaterialsAtAGlance, PaperStatus,
                ExploreResults, FindPairs, ComparePairs, UntestedPairs, PairDetailsModal
    library/    LibraryPage, LibraryTable, PaperDetailsModal
    upload/     UploadPage, UploadOptions, DropZone, UploadList
    review/     ReviewPage, ReviewCard, ReviewedList
    charts/     ChartsPage, ChartControls
    ask/        AskPage, Thread, UserMessage, AssistantMessage, Composer, Welcome, ScrollToLatest
```

## 5. Design system

The look follows Creative Tim's Paper Dashboard: a warm light background, white cards with soft shadows, Montserrat, uppercase navigation and teal accents.

### Colour tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F4F3EF` | `#18181C` | Page background |
| `--card` | `#FFFFFF` | `#232329` | Cards, sidebar, inputs |
| `--ink` | `#252422` | `#ECECEC` | Main text |
| `--muted` | `#9A9A9A` | `#9C9CA3` | Secondary text |
| `--slate` | `#66615B` | `#BDB8B0` | Nav text, labels |
| `--rule` | `#E7E5E0` | `#34343B` | Borders and dividers |
| `--hover` | `#F5F4F0` | `#2B2B32` | Hover and soft fills |
| `--primary` | `#51CBCE` | same | Teal for icons, fills and focus |
| `--primary-ink` | `#177F82` | `#6ADADD` | Teal text and links |
| `--btn` / `--btn-hover` | `#1F8F92` / `#187578` | same | Button fills; the only teal that white text may sit on |
| `--success`, `--success-ink` | `#6BD098`, `#2F8A58` | ink `#7FDCA8` | Checked |
| `--warning`, `--warning-ink` | `#FBC658`, `#8A5A00` | ink `#FBC658` | Extracted, waiting |
| `--danger`, `--danger-ink` | `#EF8157`, `#B8441E` | ink `#F5A07F` | Review badge, rejected |
| `--info`, `--info-ink` | `#51BCDA`, `#1D7C97` | ink `#7FCFE6` | Info |
| `--sodium` | `#51CBCE` | same | Sodium-ion in charts |
| `--lithium` | `#EF8157` | same | Lithium-ion in charts |
| `--other` | `#8E7CC3` | `#A796E0` | Non-biomass anodes in charts |

Card shadow: `0 6px 10px -4px rgba(0,0,0,.15)` in light mode and `0 6px 14px -6px rgba(0,0,0,.6)` in dark mode. Card radius: 12px.

### Type

| Element | Style |
|---|---|
| Body | Montserrat 14px, line height 1.55, tabular numbers |
| Page title (top bar) | 20px, weight 400 |
| Card title | 19px, weight 400, with a 13px muted description below |
| Stat number | 30px, weight 300 |
| Nav items, buttons, field labels, table headers | Uppercase, 11–12px, weight 600–700, letter-spacing .05em. Table headers use `--primary-ink`. |

### Components

- **Card:** header (title and description), body, optional footer with a divider and a small muted line that has an icon.
- **Stat card:** a large outline icon in a status colour on the left; label and number on the right; a divider; a footer line. The whole card is clickable.
- **Buttons:** pill-shaped (20px radius), uppercase. Primary uses `--btn` with white text. "Quiet" is outlined. "Good" is green, for Approve.
- **Status badge:** a pill with a soft fill. Checked is green, Extracted is amber, Harvested is grey.
- **Pills (sub-tabs):** the selected pill is filled with `--btn`.
- **Toggle switch, segmented control, and select** with a custom arrow.
- **Data rows:** a CSS grid "table" with an uppercase header row, hover highlight, and rows that are buttons.
- **Modal:** centred, up to 600px wide, with a scrim. It closes on Esc, the × button, or a scrim click.
- **Toast:** top right, teal with a check icon. It hides after about 2.8 seconds and must not block clicks (`pointer-events: none`).
- **Tooltip:** dark, shown on hover and on keyboard focus.

### App shell

- **Sidebar:**
  - 260px wide when expanded and 78px when collapsed, with a width transition.
  - **Logo:** a teal circle with two bars, one white and one amber, beside "BATTERY RESEARCH / PLATFORM" in 11px uppercase.
  - **Collapse control:** a 30px round arrow button at the right of the logo row, with no text label. When collapsed, the logo mark sits above the arrow and the arrow points right. Its aria-label and tooltip say "Collapse sidebar" or "Expand sidebar".
  - **Collapsed state:** nav labels are hidden, each icon shows its label as a tooltip on hover, and the Review count badge stays on the Review icon.
  - **Active item:** `--primary-ink` text, plus a small triangular notch on the sidebar's right edge pointing into the page.
  - The collapsed state persists in localStorage under `brp-side` (`collapsed` or `expanded`).
- **Nav items, in order:** Workspace, Library, Upload, Review (with a count badge), Charts, Ask Amplifi.
- **Top bar:**
  - The page title on the left.
  - On the right: an "Upload papers" button (icon only below 1200px), a light/dark toggle (a moon icon in light mode, a sun in dark), and a "Demo data" badge, shown in demo mode only.
  - There is deliberately no search bar. Ask Amplifi is the only place to ask questions.
  - The bar gains a soft shadow once the page scrolls.
- **Theme:** follows the system setting until the person uses the toggle. The choice is saved in localStorage as `brp-theme` and applied through `data-theme="light|dark"` on `<html>`, with a short colour transition. Respect `prefers-reduced-motion`.
- **Below 992px:** the sidebar becomes an off-canvas drawer opened from a menu button, with a scrim, and the collapse arrow is hidden. Stat cards show 4 per row at 1200px and above, 2 per row from 600px, and 1 per row below that. Data rows stack on phones. Charts scroll sideways with a 640px minimum width.
- **Footer:** small muted text. It is hidden on Ask Amplifi.

## 6. Routes

`/workspace` (the default), `/library`, `/upload`, `/review`, `/charts`, `/ask`. Set the top bar title and `document.title` to "{Page}, Battery Research Platform". Any button that opens another screen navigates through the router.

## 7. Screens

### 7.1 Workspace

1. **Four stat cards,** each linking to a screen:

   | Card | Value | Footer | Opens |
   |---|---|---|---|
   | Papers | Library count | "N checked, M extracted" | Library |
   | Values checked | Count (72 in demo; +1 for each approval or correction) | "Checked against the papers" | Charts |
   | Waiting for review | Queue length | "Review now" or "Nothing waiting" | Review |
   | Tested pairs | Records with a cathode | "From N papers" | Charts |

2. **Materials at a glance:** a small scatter chart of reversible capacity (x, 300–500 mAh/g) against first-cycle efficiency (y, 40–100%).
   - It shows one point per anode material, coloured by battery type, with name labels placed to avoid overlap.
   - Clicking a point opens the pair details.
   - The card footer links to Charts.
3. **Paper status:** a donut of Checked, Extracted and Harvested papers, with the total in the centre and a legend with counts. Footer: "N papers have every value checked".
4. **Explore results,** with three pill tabs:
   - **Find pairs:**
     - **Quick question** dropdown with six presets that set the filters below:
       - Which cathodes have been used with hard carbon anodes?
       - Which anodes have been tested with NVP?
       - Which pairs were tested in pouch or cylindrical cells?
       - Which biomass-based anodes have been tested?
       - Which pairs have low-temperature data?
       - Which pairs report the highest energy density?
     - **Filters:** Anode, Cathode, and Sort by (Most cycles, Highest energy density, Paper).
     - **"More options"** (collapsed, showing a count of active options): Cell format (any, pouch or cylindrical, pouch, cylindrical, coin, not stated), Battery type, Anode made from (biomass or other), and a low-temperature data toggle.
     - **"Clear all options"**, then a summary line: "N tested pairs from M papers."
     - **Rows:** "Anode — Cathode" with a coloured connector (sodium teal, lithium orange, dashed when there is no cathode), the cell, cycles, energy density (or "Not reported"), and source pages with a "Not yet checked" flag when the value isn't checked. Each row also has a **Compare** toggle; up to 3 pairs can be picked, and picking a fourth drops the oldest.
     - Clicking a row opens the **pair details modal** (section 7.7).
   - **Compare:** three dropdowns (pair 1, pair 2, optional pair 3) and a table with these rows: battery type, anode made from, anode test, cathode with formula, cell, result, cycling, energy density with its mass basis, and source. A note explains that energy densities are only comparable on the same mass basis.
   - **Untested pairs:** a grid of anodes against cathodes for one battery type. Filled cells are tested pairs and open their details; hatched cells are untested; cross-type combinations show "not applicable".

### 7.2 Library

- **Filters:** search (title, author or ID), Collection (all, "Hard carbon", "Lithium-ion"), and Status. Summary: "X of Y papers shown. A checked, B extracted, C harvested."
- **Columns:** ID, Paper, Collection, Status badge, Values ("9 checked", "2 waiting" or "None yet").
  - The Paper cell shows the title on one line with an ellipsis, and below it "ID. Authors, year. Type".
  - The full title appears in a tooltip on hover or focus, but only when the title is actually cut off.
- **Order:** CP01–CP10 first, then the lithium-ion documents.
- **Paper details modal:**
  - Title, citation line, a three-step pipeline (Harvested, then Values extracted, then Values checked), the status note, and the paper's records with page numbers.
  - Actions: "Ask Amplifi about CPxx" (opens the chat set to that paper), "Review N waiting values" (opens Review), and "See in Workspace" (applies that anode filter).

### 7.3 Upload

- **Title:** "Upload papers to Amplifi".
- **Options:**
  - "Add to": "Hard carbon papers (Theme B dataset)" or "Lithium-ion papers (Theme A dataset)".
  - A toggle, on by default: "Extract values and send them to Review".
- **Drop zone:** PDFs only, several at once, by dragging files in or picking them.
- **Upload list:** each upload shows its file name, destination, size, and a four-step progress bar.
  - With extraction on: Uploaded, Added to Amplifi, Values extracted, Sent to Review.
  - With extraction off: Uploaded, Added to Amplifi, Indexed for search, Ready in Ask Amplifi.
- **When an upload finishes:**
  - The paper appears in the Library under the chosen collection with the status Harvested.
  - A toast says "{file} added to {dataset}".
  - In demo mode, a line explains that nothing was sent.
- Non-PDF files are rejected with a clear message.

### 7.4 Review

- **Filter:** all waiting values, those extracted by Amplifi, or those taken from an abstract. Summary: "N values waiting."
- **Each card shows:**
  - the field name, with a chip saying "CPxx, page N"
  - "Authors (year). {source label}"
  - the value in a shaded box
  - a note
  - actions: Approve, Correct (opens an inline input with Save), Reject, and "Ask Amplifi about CPxx"
- **After an action:**
  - The card animates out and a toast confirms the action.
  - The sidebar badge and the stat cards update.
  - The paper's Library status changes, for example from Extracted to Checked once all its values are reviewed.
  - A "Reviewed in this session" list shows each decision.
- **Demo queue:** six real cases from testing, described in `INTEGRATION.md`. The "Note from testing" text belongs to demo mode only.

### 7.5 Charts

- **Mode:** a segmented control for "Compare two values" (scatter) or "Rank by one value" (horizontal bars).
- **Controls:** horizontal and vertical axes (scatter) or a single value (ranking), and "Colour by" (battery type or anode starting material). The scatter also has toggles for Names, Best balance and Trend line.
- **Fields:** see section 9.
  - If both chosen fields are anode-level, plot one point per anode material; otherwise, one point per record.
  - Leave out missing values, and say how many were left out.
  - Use a log scale for cycle counts.
- **"What this shows" panel:**
  - **Scatter:**
    - **Best balance:** the materials that no other material beats on both values. Show this only when higher is better on both axes, and ring those points.
    - **Link strength:** Pearson r, computed on the axis scale. Below 0.3 is "no clear link", below 0.6 is "moderate", and anything above is "strong". Phrase it as "higher X tends to go with higher (or lower) Y".
    - **Extremes and groups:** the highest and lowest Y, and group averages when each group has at least 2 points.
  - **Ranking:**
    - the top 3
    - the median and the range
    - group averages
    - a note that values marked * have a condition
  - **Caveat line:** "N of M plotted. With this few points, treat links as hints, not trends."
- **Tooltips** on hover and focus show each value with any condition (for example "over 81.2%"), the paper, and whether it was checked. Clicking a point or bar opens the pair details.

### 7.6 Ask Amplifi (a full-screen chat like ChatGPT and Claude)

- **Layout:**
  - The page itself doesn't scroll and the footer is hidden.
  - A short toolbar ("Answers come from the papers in the knowledge base" and a "New chat" button) sits above the conversation, which scrolls.
  - The composer is fixed at the bottom.
  - The content column is centred, at most about 780px wide.
- **Empty state:** the avatar, "What would you like to know?", a one-line description, and four suggestion cards:
  - How did the graphite/hard carbon anode in CP02 perform at −20 °C?
  - What is S-HC-2 in CP09 made from?
  - What does CP07’s full cell with an NVP cathode deliver?
  - What conditions does the VGF scheme (tranche II) set?
- **Messages:**
  - **User:** right-aligned bubbles.
  - **Assistant, while waiting:** an avatar, a name line ("Amplifi", plus "(demo answer)" in demo mode and ", searching CPxx only" when scoped), then "Searching the papers" with animated dots.
  - **Assistant, answering:** the answer streams in word by word with a caret.
  - **Citations:** `[CP02]`-style citations render as clickable chips that open the paper details. Source chips such as "CP02, page 1" appear under the answer.
  - **Actions under each answer:** Copy, Ask again (regenerates), and thumbs up or down.
  - If stopped, the answer shows "Stopped before the answer finished."
- **Composer:**
  - The textarea grows with its content up to 200px. Enter sends, Shift+Enter adds a new line, and Enter is ignored while composing with an input method editor.
  - A scope chip offers "All papers" or any single paper.
  - The round send button is disabled when the box is empty, and becomes a Stop button while an answer is coming in.
  - A disclaimer below: "Amplifi answers from the papers and cites its sources. Check important values against the paper."
- **Scrolling:** a "scroll to latest" button appears when the person is more than about 120px from the bottom. Auto-scroll during streaming only when they are already near the bottom.
- **Entry points:** the sidebar, plus every "Ask Amplifi about CPxx" button, which presets the scope.
- **Streaming:** simulate it in demo mode. In live mode, use streaming if Amplifi supports it, and otherwise animate the full answer the same way.

### 7.7 Pair details modal

- **Content:**
  - The pair name, then a citation line.
  - Battery type, anode made from, anode test (with its page), cathode with formula, cell, result, cycling, energy density with basis, low-temperature result, and source pages.
  - The source line says either "Checked by hand against the paper" or "Taken from the abstract; waiting in Review".
- **Missing values:** each one shows "Not in table" and a "Find with Amplifi" button. It calls `findValue(paperId, anode, field)` and shows the result, which goes to Review in live mode.
- **Actions:** "Ask Amplifi about CPxx" and "Open in Library".

## 8. Data model

```ts
type Battery = "Sodium-ion" | "Lithium-ion";
type Status = "Harvested" | "Extracted" | "Checked";

interface PaperRef { author: string; year: number; title: string }       // records.json "papers" map, keyed by ID

interface Record {
  id: string;               // e.g. "CP01-pouch"
  paper: string;            // e.g. "CP01"
  author: string; year: number; battery: Battery;
  anode: string;            // material name, e.g. "BGP@HEC-HC"
  anodeFrom: string;        // starting material, e.g. "Sugarcane bagasse"
  anodeGroup: "Biomass" | "Other";
  anodeTest: string | null; anodePage: string;
  cathode: string | null;   // null means an anode-only record
  cathodeFormula: string | null;   // render the digits as subscripts
  format: string;           // "Pouch" | "Cylindrical" | "Coin" | "Not stated"
  cell: string;
  result: string | null;
  energy: number | null; energyText: string | null; energyBasis: string | null;
  cycles: number | null; cycling: string | null;
  lowTemp: string | null;
  page: string;             // source pages, e.g. "1, 7"
  checked: boolean;         // checked by hand against the paper
  anodeCapacity: number | null; anodeICE: number | null;
  rateCapacity: number | null; rateCondition: string | null;
  anodeCycles: number | null; anodeRetention: number | null; anodeRetentionNote: string | null;
  carbonizationTemp: number | null; d002: number | null;
  fullRetention: number | null; fullRetentionNote: string | null;
}

interface LibraryItem {
  id: string; authors: string; year: number | null; title: string; type: string;
  collection: "Hard carbon" | "Lithium-ion"; status: Status;
  values: string | null;    // "9 checked", "2 waiting" or null
  note: string; demo?: boolean;
}

interface ReviewItem {
  id: string; paper: string; field: string; value: string; page: string;
  source: "amplifi" | "abstract"; sourceLabel: string; note: string;
}

type ReviewAction = "approve" | "correct" | "reject";
interface UploadOptions { dataset: "theme-a" | "theme-b"; extract: boolean }
interface Citation { paper: string; page: string | null }
interface AskAnswer { text: string; citations: Citation[]; error?: boolean }
```

Copy the 37 Library entries, the 6 review items and the demo answers from the script in `battery_platform_demo.html` (`SAMPLE_LIBRARY`, `SAMPLE_REVIEW`, `DEMO_ANSWERS`).

## 9. Chart fields

| Key | Label | Unit | Level | Higher is better | Notes |
|---|---|---|---|---|---|
| `capacity` | Reversible capacity | mAh/g | anode | yes | `anodeCapacity` |
| `ice` | First-cycle efficiency | % | anode | yes | `anodeICE`, max 100 |
| `rate` | Capacity at the highest tested current | mAh/g | anode | yes | condition in `rateCondition` |
| `acycles` | Anode cycles tested | cycles | anode | yes | log scale |
| `aret` | Anode capacity retention | % | anode | yes | qualifier in `anodeRetentionNote` |
| `temp` | Carbonization temperature | °C | anode | no direction | |
| `d002` | Interlayer spacing (d002) | nm | anode | no direction | 3 decimals |
| `fcycles` | Full-cell cycles tested | cycles | pair | yes | `cycles`, log scale |
| `fret` | Full-cell capacity retention | % | pair | yes | qualifier in `fullRetentionNote` |
| `energy` | Full-cell energy density | Wh/kg | pair | yes | always show `energyBasis` |
| `year` | Year published | none | anode | no direction | integer ticks, no thousands separator |

Format numbers with the `en-IN` locale.

## 10. Service layer and API

```ts
interface DataService {
  loadData(): Promise<{ papers: Record<string, PaperRef>; records: Record[] }>;
  loadLibrary(): Promise<LibraryItem[]>;
  loadReview(): Promise<ReviewItem[]>;
  submitReview(id: string, action: ReviewAction, value?: string): Promise<{ ok: boolean }>;
  uploadPaper(file: File, opts: UploadOptions, onStep: (step: 0 | 1 | 2 | 3) => void): Promise<{ id: string | null }>;
  ask(question: string, paperId?: string): Promise<AskAnswer>;
  findValue(paperId: string, sample: string, field: string): Promise<{ value: string | null; page: string | null; quote: string }>;
}
```

`config.mode` picks the demo service (mocks, simulated delays, about 900ms per upload step) or the live service. Live endpoints, as defined in `INTEGRATION.md`:

| Method and path | Returns or does |
|---|---|
| `GET /api/records` | `{ papers, records }`, as in `records.json` |
| `GET /api/papers` | `LibraryItem[]` |
| `GET /api/review` | `ReviewItem[]` |
| `POST /api/review/{id}` | Body `{ action, value }`. Approved and corrected values become checked records. |
| `POST /api/upload` | Multipart `file`, `dataset`, `extract`. Adds the PDF to that Amplifi dataset and, if `extract` is true, queues its values for review. |

The Amplifi chat goes through the backend as a proxy. Keep `callAmplifi()` (the request) and `toAnswer()` (the response mapping) in `amplifiAdapter.ts`, because Amplifi's request and response format isn't confirmed yet. Citations are parsed from tokens matching `[CPxx]`, `[Cn]`, `[Nn]` or `[In]`. When scoped to one paper, prefix the question with "Answer about CPxx only."

## 11. Content and UX rules

- Never show a number without its source; give page numbers wherever the data has them.
- Show "Not reported" or "Not in table" for missing values. Never fill in or estimate one.
- Mark unchecked values ("Not yet checked") wherever they appear.
- Always show energy density with its mass basis.
- Write in plain language, with active verbs and sentence case. Toasts reuse the action's name ("Approved", "Copied to the clipboard").
- Use uppercase only where the Paper style uses it: nav items, buttons, field labels and table headers.
- **Accessibility:**
  - Everything works with the keyboard. Rows and chart points are focusable and open on Enter or Space.
  - Focus is visible, and the modal traps and restores focus.
  - Summaries and the chat use `aria-live`; toggles use `aria-pressed`; icon-only buttons have aria-labels; tooltips also appear on focus.
  - White text sits only on `--btn`.
  - Reduced motion is respected.
- **Errors** say what happened and what to do next ("The platform returned 503. Try again in a moment.").

## 12. Open questions

- Amplifi's chat API: the endpoint, request and response shape, whether it streams, and whether citations include page numbers. To be confirmed with the Amplifi team.
- How many documents an Amplifi dataset can hold, and whether search can be filtered by paper, year or chemistry.
- The backend isn't built yet: the records database, the harvester, review storage and uploading to Amplifi.
- Who may approve reviews: roles and authentication are still to be decided.
- The papers are under a text-and-data-mining rights review, so bulk extraction beyond the POC waits for that.
- Stakeholder feedback on the demo is pending and may change the screens.

## 13. Build order and checks

1. Scaffold Vite, TypeScript and the router; add the tokens, global styles, theme toggle and `AppShell` (collapsible sidebar, mobile drawer, top bar) with placeholder pages.
2. Add the types, the demo service with mocks, the live service stubs, and the query hooks.
3. Build the UI kit components.
4. Build the Library and its paper details modal.
5. Build the Workspace: stat cards, mini scatter, donut, and the three Explore tabs, with the pair details modal.
6. Build Review, wired to the stat cards, badge and Library status.
7. Build Upload.
8. Build Charts and the insights panel, with unit tests for the statistics helpers.
9. Build Ask Amplifi.
10. Finish with an accessibility pass, responsive checks at 390, 768, 1200 and 1440px, tests, and a README.

**Done means:** each screen matches the reference demo; there are no console errors; demo mode works offline from the mocks; and switching to live needs only environment variables (`VITE_MODE`, `VITE_API_BASE`).

## 14. Starting prompt

> You are a senior React engineer. Using `React_Frontend_Handoff.md`, the reference demo `battery_platform_demo.html`, the sample data `records.json` and the API guide `INTEGRATION.md`, build the Battery Research Platform frontend in React 18, TypeScript and Vite, following the folder structure, design tokens and screen specs in the handoff. Start with steps 1 and 2 of the build order: scaffold the project, add the tokens and theme, build the app shell with the collapsible sidebar and mobile drawer, and add the types, demo data service and hooks. Show me the file tree and the code for each file, then stop so I can review before you continue with step 3.
