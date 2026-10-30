import type { ExplorerData } from "@/types";
import { anodeSlug, anodeTypes, batteryLabel, cathodesFor, explorerHref, familyLabel, paperByline, paperTitle } from "./explorer";
import { plural } from "./format";

export interface SearchResult {
  kind: "Anode" | "Cathode" | "Sample" | "Paper";
  label: string;
  detail: string;
  /** Where the result opens: an Explorer pair, or a paper. */
  to: string;
}

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[\s\-‐–—_]+/g, "");

/**
 * The header search: anode types, cathodes (by name or formula), anode samples, and papers by ID, title,
 * author or DOI. Results that start with the query come first.
 */
export function searchExplorer(data: ExplorerData, query: string, limit = 8): SearchResult[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const hit = (...fields: (string | null | undefined)[]) => fields.some((f) => norm(f).includes(q));
  const results: SearchResult[] = [];
  for (const type of anodeTypes(data)) {
    const family = familyLabel(type.family);
    const slug = anodeSlug(type);
    if (hit(family)) {
      results.push({ kind: "Anode", label: family, detail: `${batteryLabel(type.battery)} · ${type.papers.length} ${plural(type.papers.length, "paper")}`, to: explorerHref(slug) });
    }
    for (const c of cathodesFor(data, type)) {
      if (hit(c.label, c.formula, ...c.cells.map((cell) => cell.cathode))) {
        results.push({ kind: "Cathode", label: c.label, detail: `With ${family.toLowerCase()} · ${c.papers.length} ${plural(c.papers.length, "paper")}`, to: explorerHref(slug, c.label) });
      }
    }
    for (const s of type.samples) {
      if (hit(s.sample)) results.push({ kind: "Sample", label: s.sample, detail: `${family} anode in ${s.paper}`, to: `/papers/${s.paper}` });
    }
  }
  for (const p of Object.values(data.papers)) {
    if (hit(p.id, p.title, p.firstAuthor, p.doi)) results.push({ kind: "Paper", label: `${p.id}: ${paperTitle(p)}`, detail: paperByline(p), to: `/papers/${p.id}` });
  }
  const seen = new Set<string>();
  const unique = results.filter((r) => !seen.has(r.kind + r.label) && seen.add(r.kind + r.label));
  const starts = (r: SearchResult) => (norm(r.label).startsWith(q) ? 0 : 1);
  return unique.sort((a, b) => starts(a) - starts(b)).slice(0, limit);
}
