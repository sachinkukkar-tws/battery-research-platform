import type { LibraryPaper, PaperStatus } from "@/types";

export interface LibraryFilters {
  query: string;
  collection: string;
  status: "all" | PaperStatus;
}

export const DEFAULT_LIBRARY_FILTERS: LibraryFilters = { query: "", collection: "all", status: "all" };

export function filterLibrary(papers: LibraryPaper[], f: LibraryFilters): LibraryPaper[] {
  const q = f.query.trim().toLowerCase();
  return papers.filter(
    (p) =>
      (f.collection === "all" || p.collection === f.collection) &&
      (f.status === "all" || p.status === f.status) &&
      (!q || `${p.id} ${p.authors} ${p.title}`.toLowerCase().includes(q)),
  );
}

export function statusCounts(papers: LibraryPaper[]): Record<PaperStatus, number> {
  const c: Record<PaperStatus, number> = { Checked: 0, Extracted: 0, Harvested: 0 };
  for (const p of papers) c[p.status]++;
  return c;
}

/** 1 = harvested, 2 = values extracted, 3 = values checked. */
export const pipelineStage = (s: PaperStatus) => ({ Harvested: 1, Extracted: 2, Checked: 3 })[s];

export const PIPELINE_STEPS = ["Harvested", "Values extracted", "Values checked"] as const;

export const isLibraryFiltered = (f: LibraryFilters) => f.query.trim() !== "" || f.collection !== "all" || f.status !== "all";
