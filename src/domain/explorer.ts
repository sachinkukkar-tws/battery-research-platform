import type {
  AnodeFamily,
  ExplorerBattery,
  ExplorerData,
  ExplorerPaper,
  ExtractedAnode,
  ExtractedFullCell,
  ExtractedMaterial,
  ExtractedValue,
  MaterialKind,
  Metric,
  Sourced,
} from "@/types";

/** Only items whose quote was found on its PDF page, with the values in it, reach the page. */
export const isChecked = (item: Sourced) => item.status === "verified" && item.page !== null;

export type EvidenceStrength = "Strong" | "Moderate" | "Limited";
export type EvidenceKind = "full cell" | "half cell" | "review";

export interface AnodeType {
  key: string;
  family: AnodeFamily;
  battery: ExplorerBattery | null;
  /** Research papers that make and test an anode of this type. */
  papers: string[];
  samples: ExtractedAnode[];
}

export interface CathodeOption {
  label: string;
  formula: string | null;
  papers: string[];
  /** Cell formats the papers report, without "not stated". */
  formats: string[];
  cells: ExtractedFullCell[];
  strength: EvidenceStrength;
}

export interface PairView {
  papers: string[];
  samples: ExtractedAnode[];
  materials: ExtractedMaterial[];
  performance: ExtractedValue[];
  evidence: Record<EvidenceKind, string[]>;
}

export const STRENGTH_RULE = "Strong: two or more papers. Moderate: one paper with a pouch or cylindrical cell. Limited: one paper, without a pouch or cylindrical cell.";

export const familyLabel = (f: AnodeFamily) =>
  ({ "hard carbon": "Hard carbon", "graphite/hard carbon": "Graphite/hard carbon", graphite: "Graphite", "silicon-carbon": "Silicon–carbon", other: "Other" })[f];

export const batteryLabel = (b: ExplorerBattery | null) => (b === "sodium-ion" ? "Sodium-ion" : b === "lithium-ion" ? "Lithium-ion" : "Battery type not given");

/** A paper's title as Amplifi read it, or its file name when the PDF didn't confirm the title. */
export const paperTitle = (p: ExplorerPaper) => p.title ?? p.file;

/** "Jia et al. · Advanced Energy Materials · 2026", from the details the PDF confirmed. */
export const paperByline = (p: ExplorerPaper) =>
  [p.firstAuthor && `${p.firstAuthor} et al.`, p.journal, p.year].filter(Boolean).join(" · ") || p.file;
/** "Shen et al. · 2026", for lists. */
export const paperShortByline = (p: ExplorerPaper) => [p.firstAuthor && `${p.firstAuthor} et al.`, p.year].filter(Boolean).join(" · ") || p.file;

export const METRIC_LABEL: Record<Metric, string> = {
  "reversible capacity": "Reversible capacity",
  "initial coulombic efficiency": "Initial coulombic efficiency",
  "capacity retention": "Capacity retention",
  "capacity after cycling": "Capacity after cycling",
  "rate capability": "Rate capability",
  "energy density": "Energy density",
  other: "Other",
};
const METRIC_ORDER = Object.keys(METRIC_LABEL) as Metric[];

export const MATERIAL_KINDS: MaterialKind[] = ["electrolyte", "separator", "current collector", "binder", "additive"];

const PRACTICAL = new Set(["pouch", "cylindrical"]);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** A sample a paper makes only to compare against, e.g. "pure graphite anode (control)". */
export const isControl = (sample: string) => /\bcontrol\b/i.test(sample);

/** Whether two sample names mean the same sample: equal once normalised, or one contains the other. */
function sameSample(a: string, b: string, exact: boolean) {
  const x = norm(a);
  const y = norm(b);
  if (exact) return x === y;
  return Math.min(x.length, y.length) >= 3 && (x.includes(y) || y.includes(x));
}

/** The samples a list of names refers to: exact matches first, so "NPC" doesn't also pick up "Ni-NPC". */
function matchSamples(names: string[], samples: ExtractedAnode[]): ExtractedAnode[] {
  const out = new Set<ExtractedAnode>();
  for (const name of names) {
    const exact = samples.filter((s) => sameSample(name, s.sample, true));
    for (const s of exact.length ? exact : samples.filter((s) => sameSample(name, s.sample, false))) out.add(s);
  }
  return [...out];
}

const isResearch = (data: ExplorerData, pid: string) => data.papers[pid]?.kind === "research article";

/** Anode types, from the samples research papers make themselves (not their controls), most papers first. */
export function anodeTypes(data: ExplorerData): AnodeType[] {
  const groups = new Map<string, AnodeType>();
  for (const a of data.anodes) {
    const paper = data.papers[a.paper];
    if (!paper || !isResearch(data, a.paper) || !isChecked(a) || isControl(a.sample)) continue;
    const key = `${paper.battery}|${a.family}`;
    const g = groups.get(key) ?? { key, family: a.family, battery: paper.battery, papers: [], samples: [] };
    if (!g.papers.includes(a.paper)) g.papers.push(a.paper);
    g.samples.push(a);
    groups.set(key, g);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, papers: [...g.papers].sort() }))
    .sort((x, y) => y.papers.length - x.papers.length || x.key.localeCompare(y.key));
}

/** Whether a full cell's anode is of this type: its sample matches, or the paper only tests anodes of this type. */
function cellUsesType(data: ExplorerData, cell: ExtractedFullCell, type: AnodeType) {
  const own = type.samples.filter((s) => s.paper === cell.paper);
  if (matchSamples([cell.anodeSample], own).length) return true;
  return own.length > 0 && !data.anodes.some((a) => a.paper === cell.paper && isChecked(a) && a.family !== type.family);
}

/** Cathodes paired with the anode type in full cells, ranked by the strength of evidence. */
export function cathodesFor(data: ExplorerData, type: AnodeType): CathodeOption[] {
  const groups = new Map<string, CathodeOption>();
  for (const cell of data.fullCells) {
    if (!isChecked(cell) || isControl(cell.anodeSample) || !type.papers.includes(cell.paper) || !cellUsesType(data, cell, type)) continue;
    const g = groups.get(cell.cathodeLabel) ?? {
      label: cell.cathodeLabel,
      formula: cell.cathodeLabelFormula ?? cell.cathodeFormula,
      papers: [],
      formats: [],
      cells: [],
      strength: "Limited" as EvidenceStrength,
    };
    if (!g.papers.includes(cell.paper)) g.papers.push(cell.paper);
    if (cell.cellFormat !== "not stated" && !g.formats.includes(cell.cellFormat)) g.formats.push(cell.cellFormat);
    g.cells.push(cell);
    groups.set(cell.cathodeLabel, g);
  }
  const practical = (c: CathodeOption) => c.formats.filter((f) => PRACTICAL.has(f)).length;
  return [...groups.values()]
    .map((g) => ({
      ...g,
      papers: [...g.papers].sort(),
      strength: (g.papers.length >= 2 ? "Strong" : practical(g) ? "Moderate" : "Limited") as EvidenceStrength,
    }))
    .sort((x, y) => y.papers.length - x.papers.length || practical(y) - practical(x) || x.label.localeCompare(y.label));
}

/** Whether a quote names the cathode, by its short name, formula or the paper's own name for it. */
function namesCathode(quote: string, cathode: CathodeOption) {
  const q = norm(quote);
  return [cathode.label, cathode.formula, ...cathode.cells.map((c) => c.cathode)].some((n) => n && norm(n).length >= 2 && q.includes(norm(n)));
}

/** Everything the papers report for one anode type and cathode, from checked items only. */
export function pairView(data: ExplorerData, type: AnodeType, cathode: CathodeOption): PairView {
  const papers = cathode.papers;
  const samples = papers.flatMap((pid) => {
    const own = type.samples.filter((s) => s.paper === pid);
    const matched = matchSamples(cathode.cells.filter((c) => c.paper === pid).map((c) => c.anodeSample), own);
    return matched.length ? matched : own;
  });
  // A paper with full cells of several cathodes: keep the full-cell values that name this one.
  const otherCathodes = (pid: string) => data.fullCells.some((c) => c.paper === pid && isChecked(c) && c.cathodeLabel !== cathode.label);
  // A half-cell value belongs to the pair when the sample it names (among all the paper's samples) is a paired one.
  const paired = (v: ExtractedValue) => matchSamples([v.sample], type.samples.filter((s) => s.paper === v.paper)).some((s) => samples.includes(s));
  const performance = data.performance
    .filter((v) => isChecked(v) && papers.includes(v.paper) && !isControl(v.sample))
    .filter((v) => (v.testType === "full cell" ? !otherCathodes(v.paper) || namesCathode(v.quote, cathode) : paired(v)))
    .sort(
      (x, y) =>
        (x.testType === "half cell" ? 0 : 1) - (y.testType === "half cell" ? 0 : 1) ||
        METRIC_ORDER.indexOf(x.metric) - METRIC_ORDER.indexOf(y.metric) ||
        x.paper.localeCompare(y.paper),
    );
  const battery = data.papers[papers[0] ?? ""]?.battery;
  const reviews = Object.values(data.papers)
    .filter((p) => p.kind === "review" && p.battery === battery)
    .filter((p) => data.fullCells.some((c) => c.paper === p.id && isChecked(c) && c.cathodeLabel === cathode.label))
    .map((p) => p.id);
  return {
    papers,
    samples,
    materials: data.materials.filter((m) => isChecked(m) && papers.includes(m.paper)),
    performance,
    evidence: {
      "full cell": papers,
      "half cell": [...new Set(performance.filter((v) => v.testType === "half cell").map((v) => v.paper))].sort(),
      review: reviews,
    },
  };
}

export interface EvidenceCheck {
  label: string;
  ok: boolean;
  /** What a failed check means, e.g. "no pouch or cylindrical cell found". */
  miss: string;
}

/** Every cycle count in a text, with thousands written "1,200", "11 000" or "11 000" (a thin space), as papers do. */
export const cycleCounts = (text: string) =>
  [...text.matchAll(/(\d{1,3}(?:[,\u00a0\u2009\u202f ]\d{3})+|\d+)\s*cycles/gi)].map((m) => Number(m[1]!.replace(/[,\u00a0\u2009\u202f ]/g, "")));

/** Five plain checks on a paper's evidence; the page shows how many it passes and what's missing. */
export function evidenceChecks(data: ExplorerData, pid: string): EvidenceCheck[] {
  const checked = <T extends Sourced>(items: T[]) => items.filter((i) => i.paper === pid && isChecked(i));
  const cells = checked(data.fullCells);
  const all = [...checked(data.anodes), ...cells, ...checked(data.materials), ...checked(data.performance)];
  const cycles = all.flatMap((i) => cycleCounts(i.quote));
  // Each check is on Amplifi's checked values, so a miss means none was found, not that the paper has none.
  return [
    // A DOI is kept only when the PDF contains it.
    { label: "DOI found in the PDF", ok: !!data.papers[pid]?.doi, miss: "no DOI found in the PDF" },
    { label: "Full cell tested", ok: cells.length > 0, miss: "no full cell found" },
    { label: "Pouch or cylindrical cell", ok: cells.some((c) => PRACTICAL.has(c.cellFormat)), miss: "no pouch or cylindrical cell found" },
    { label: "1,000 or more cycles reported", ok: cycles.some((n) => n >= 1000), miss: "no result over 1,000 or more cycles found" },
    { label: "5 or more checked values", ok: all.length >= 5, miss: "fewer than 5 checked values" },
  ];
}

export interface Highlight {
  label: string;
  item: ExtractedValue;
  /** What to show: the value, with the cycle count for cycling results. */
  text: string;
}

const numberIn = (s: string) => Number(s.replace(/(?<=\d),(?=\d{3})/g, "").match(/\d+(?:\.\d+)?/)?.[0] ?? NaN);
const cyclesIn = (s: string | null) => cycleCounts(s ?? "")[0] ?? NaN;

function best(items: ExtractedValue[], score: (v: ExtractedValue) => number): ExtractedValue | undefined {
  return items.filter((v) => Number.isFinite(score(v))).sort((a, b) => score(b) - score(a))[0];
}

/** The pair's headline results: highest half-cell capacity and first-cycle efficiency, and the longest full-cell cycling. */
export function highlights(pair: PairView): Highlight[] {
  const half = pair.performance.filter((v) => v.testType === "half cell");
  const full = pair.performance.filter((v) => v.testType === "full cell");
  const capacity = best(half.filter((v) => v.metric === "reversible capacity" && /mA\s?h/i.test(v.value)), (v) => numberIn(v.value));
  const ice = best(half.filter((v) => v.metric === "initial coulombic efficiency" && v.value.includes("%")), (v) => numberIn(v.value));
  const cycling = best(full.filter((v) => v.metric === "capacity retention" || v.metric === "capacity after cycling"), (v) => cyclesIn(v.condition));
  return [
    capacity && { label: "Highest reversible capacity", item: capacity, text: capacity.value },
    ice && { label: "Highest first-cycle efficiency", item: ice, text: ice.value },
    cycling && {
      label: "Longest full-cell cycling",
      item: cycling,
      // Amplifi sometimes writes the cycle count into the value itself ("92.9% after 50 cycles").
      text: /\bcycles?\b/i.test(cycling.value) ? cycling.value : `${cycling.value} after ${cyclesIn(cycling.condition).toLocaleString("en-US")} cycles`,
    },
  ].filter((h): h is Highlight => !!h);
}

/** A value's condition, unless the value already says it ("114.1 mAh g-1 at 5 A g-1" with "5 A g-1"). */
export const conditionToShow = (v: ExtractedValue) => (v.condition && !v.value.toLowerCase().includes(v.condition.toLowerCase()) ? v.condition : null);

/** Shows units as written in papers: "mAh g-1" becomes "mAh g⁻¹". */
export const formatUnits = (s: string) => s.replace(/\b(g|kg|cm|L)\s?[-−]\s?([12])\b/g, (_, unit: string, p: string) => `${unit}${p === "1" ? "⁻¹" : "⁻²"}`);

/** The material kinds the pair's papers don't report. */
export const missingMaterials = (pair: PairView) => MATERIAL_KINDS.filter((k) => !pair.materials.some((m) => m.kind === k));

/** The anode type's address in the Explorer's URL, e.g. "sodium-ion-hard-carbon". */
export const anodeSlug = (t: AnodeType) => `${t.battery ?? "unknown"}-${t.family}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/** The Explorer's address for an anode type, and a cathode when one is given. */
export const explorerHref = (anode: string, cathode?: string) =>
  `/explore?${new URLSearchParams(cathode ? { anode, cathode } : { anode }).toString()}`;

export interface PaperRecord {
  anodes: ExtractedAnode[];
  fullCells: ExtractedFullCell[];
  materials: ExtractedMaterial[];
  performance: ExtractedValue[];
}

/** Everything checked for one paper, values ordered half cell first, then by metric. */
export function paperRecord(data: ExplorerData, pid: string): PaperRecord {
  const own = <T extends Sourced>(items: T[]) => items.filter((i) => i.paper === pid && isChecked(i));
  return {
    anodes: own(data.anodes),
    fullCells: own(data.fullCells),
    materials: own(data.materials),
    performance: own(data.performance).sort(
      (x, y) => (x.testType === "half cell" ? 0 : 1) - (y.testType === "half cell" ? 0 : 1) || METRIC_ORDER.indexOf(x.metric) - METRIC_ORDER.indexOf(y.metric),
    ),
  };
}

/** How many of a paper's extracted items are checked against its PDF. */
export function checkedCount(data: ExplorerData, pid: string): number {
  const r = paperRecord(data, pid);
  return r.anodes.length + r.fullCells.length + r.materials.length + r.performance.length;
}

/** Where a paper appears in the Explorer: the first anode type and cathode it supports, if any. */
export function explorerHrefFor(data: ExplorerData, pid: string): string | null {
  for (const type of anodeTypes(data)) {
    if (!type.papers.includes(pid)) continue;
    const cathode = cathodesFor(data, type).find((c) => c.papers.includes(pid));
    return explorerHref(anodeSlug(type), cathode?.label);
  }
  return null;
}

/** One line on a paper's evidence: "Passes all 5 evidence checks", or how many it passes and what's missing. */
export function checksSummary(checks: EvidenceCheck[]): string {
  const failed = checks.filter((c) => !c.ok);
  return failed.length
    ? `${checks.length - failed.length} of ${checks.length} evidence checks: ${failed.map((c) => c.miss).join(", ")}`
    : `Passes all ${checks.length} evidence checks`;
}

/** How many extracted items are left out because they couldn't be checked against the PDF. */
export function uncheckedCount(data: ExplorerData): number {
  return [...data.anodes, ...data.fullCells, ...data.materials, ...data.performance].filter((i) => !isChecked(i)).length;
}

export interface QuotePart {
  text: string;
  mark: boolean;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function valuePattern(value: string, by: "numbers" | "text"): RegExp | null {
  if (by === "text") return value.trim().length >= 3 ? new RegExp(escapeRe(value.trim()), "gi") : null;
  const found = [...new Set(value.match(/\d+(?:[.,]\d+)*/g) ?? [])];
  // "g-1" in a unit adds a 1 that isn't the value.
  const nums = found.length > 1 ? found.filter((n) => n !== "1") : found;
  if (!nums.length) return null;
  return new RegExp(`(?<![\\d.,])(?:${nums.sort((a, b) => b.length - a.length).map(escapeRe).join("|")})(?!\\d)`, "g");
}

/** Splits a quote so a value can be highlighted in it: by its numbers for measurements, by its words for materials. */
export function highlight(quote: string, value: string, by: "numbers" | "text" = "numbers"): QuotePart[] {
  const pattern = valuePattern(value, by);
  if (!pattern) return [{ text: quote, mark: false }];
  const parts: QuotePart[] = [];
  let last = 0;
  for (const m of quote.matchAll(pattern)) {
    const start = m.index ?? 0;
    if (start > last) parts.push({ text: quote.slice(last, start), mark: false });
    parts.push({ text: m[0], mark: true });
    last = start + m[0].length;
  }
  if (last < quote.length) parts.push({ text: quote.slice(last), mark: false });
  return parts;
}

/** Starter questions for the chat, made only from what Amplifi found in the papers; none without its data. */
export function suggestQuestions(data: ExplorerData | null): string[] {
  if (!data) return [];
  const used = new Set<string>();
  const pick = <T extends Sourced>(items: T[], ok: (i: T) => boolean = () => true) => {
    const item = items.find((i) => isChecked(i) && !used.has(i.paper) && isResearch(data, i.paper) && ok(i));
    if (item) used.add(item.paper);
    return item;
  };
  const sample = pick(data.anodes, (a) => !!a.precursor && !isControl(a.sample));
  const cell = pick(data.fullCells, (c) => !isControl(c.anodeSample));
  const electrolyte = pick(data.materials, (m) => m.kind === "electrolyte");
  const family = anodeTypes(data)[0];
  return [
    sample && `What is ${sample.sample} in ${sample.paper} made from?`,
    cell && `How does the ${cell.anodeSample} and ${cell.cathodeLabel} full cell in ${cell.paper} perform?`,
    electrolyte && `What electrolyte does ${electrolyte.paper} use, and why?`,
    family && `Which cathodes are paired with ${familyLabel(family.family).toLowerCase()} anodes in full cells?`,
  ].filter((q): q is string => !!q);
}
