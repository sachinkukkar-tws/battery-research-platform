import type { AnodeGroup, BatteryType, CellFormat, ResearchRecord } from "@/types";
import { plural } from "./format";

export type FormatFilter = "all" | "scaled" | CellFormat;
export type PairSort = "cycles" | "energy" | "paper";

export interface PairFilters {
  anode: string;
  cathode: string;
  format: FormatFilter;
  battery: "all" | BatteryType;
  from: "all" | AnodeGroup;
  sort: PairSort;
  lowTemp: boolean;
}

export const DEFAULT_PAIR_FILTERS: PairFilters = {
  anode: "all",
  cathode: "all",
  format: "all",
  battery: "all",
  from: "all",
  sort: "cycles",
  lowTemp: false,
};

export const isLithium = (r: Pick<ResearchRecord, "battery">) => r.battery === "Lithium-ion";

export const pairName = (r: Pick<ResearchRecord, "anode" | "cathode">) =>
  r.cathode ? `${r.anode} + ${r.cathode}` : `${r.anode} (anode tests only)`;

export function matchesPair(r: ResearchRecord, f: PairFilters): boolean {
  if (f.anode !== "all" && r.anode !== f.anode) return false;
  if (f.cathode !== "all" && r.cathode !== f.cathode) return false;
  if (f.format === "scaled" && !(r.format === "Pouch" || r.format === "Cylindrical")) return false;
  if (f.format !== "all" && f.format !== "scaled" && r.format !== f.format) return false;
  if (f.battery !== "all" && r.battery !== f.battery) return false;
  if (f.from !== "all" && r.anodeGroup !== f.from) return false;
  if (f.lowTemp && !r.lowTemp) return false;
  return true;
}

/** Missing values sort last rather than being treated as zero. */
const SORTERS: Record<PairSort, (a: ResearchRecord, b: ResearchRecord) => number> = {
  cycles: (a, b) => (b.cycles ?? -1) - (a.cycles ?? -1),
  energy: (a, b) => (b.energy ?? -1) - (a.energy ?? -1),
  paper: (a, b) => a.paper.localeCompare(b.paper),
};

export function filterPairs(records: ResearchRecord[], f: PairFilters): ResearchRecord[] {
  return records.filter((r) => matchesPair(r, f)).sort(SORTERS[f.sort]);
}

/** "NFPP (3 papers), NVP (2 papers)": distinct values of a key, ranked by how many papers use them. */
export function countByPapers(list: ResearchRecord[], key: "anode" | "cathode"): string {
  const m = new Map<string, Set<string>>();
  for (const r of list) {
    const k = r[key];
    if (!k) continue;
    if (!m.has(k)) m.set(k, new Set());
    m.get(k)!.add(r.paper);
  }
  return [...m]
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
    .map(([k, s]) => `${k} (${s.size} ${plural(s.size, "paper")})`)
    .join(", ");
}

export function pairSummary(list: ResearchRecord[], f: PairFilters, focus?: "anode" | "cathode"): string {
  if (!list.length) return "";
  const tested = list.filter((r) => r.cathode);
  const papers = new Set(tested.map((r) => r.paper)).size;
  let s = `${tested.length} tested ${plural(tested.length, "pair")} from ${papers} ${plural(papers, "paper")}.`;
  if (focus === "cathode" || f.anode !== "all") s += ` Cathodes: ${countByPapers(tested, "cathode") || "none"}.`;
  if (focus === "anode" || f.cathode !== "all") s += ` Anodes: ${countByPapers(tested, "anode") || "none"}.`;
  return s;
}

/** Number of options set inside "More options", shown as a badge so hidden filters aren't forgotten. */
export const extraFilterCount = (f: PairFilters) =>
  [f.format !== "all", f.battery !== "all", f.from !== "all", f.lowTemp].filter(Boolean).length;

/** First record per anode name, keeping data order. */
export function uniqueByAnode(records: ResearchRecord[]): ResearchRecord[] {
  return [...new Map(records.map((r) => [r.anode, r] as const)).values()];
}

export const uniqueCathodes = (records: ResearchRecord[]) =>
  [...new Set(records.map((r) => r.cathode).filter((c): c is string => !!c))];

export interface PairGrid {
  anodes: ResearchRecord[];
  cathodes: string[];
  count: (anode: string, cathode: string) => number;
}

export function buildPairGrid(records: ResearchRecord[], battery: BatteryType, extraCathodes: string[] = []): PairGrid {
  const recs = records.filter((r) => r.battery === battery);
  const cathodes = [...uniqueCathodes(recs), ...extraCathodes.filter((c) => !recs.some((r) => r.cathode === c))];
  return {
    anodes: uniqueByAnode(recs),
    cathodes,
    count: (anode, cathode) => recs.filter((r) => r.anode === anode && r.cathode === cathode).length,
  };
}

/**
 * Toggles a pair in the compare selection, keeping at most three, oldest dropped first,
 * as the prototype did.
 */
export function togglePick(picked: string[], id: string, max = 3): string[] {
  if (picked.includes(id)) return picked.filter((p) => p !== id);
  const next = [...picked, id];
  return next.length > max ? next.slice(next.length - max) : next;
}
