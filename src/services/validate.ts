import type { LibraryPaper, PaperMeta, PaperStatus, ResearchDataset, ResearchRecord, ReviewItem } from "@/types";
import { ApiError } from "./http";

/**
 * Lightweight runtime checks for backend responses. They verify the fields the UI relies on
 * and fail loudly with a clear message rather than rendering undefined values.
 */
export type Obj = Record<string, unknown>;

export const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

const fail = (service: string, what: string): never => {
  throw new ApiError("invalid_response", `${service} sent data in an unexpected format (${what}).`);
};

const STATUSES: PaperStatus[] = ["Harvested", "Extracted", "Checked"];

function requireString(o: Obj, key: string, service: string, ctx: string): string {
  const v = o[key];
  if (typeof v !== "string") return fail(service, `${ctx}.${key} should be text`);
  return v;
}

function optNumber(o: Obj, key: string): number | null {
  const v = o[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function optString(o: Obj, key: string): string | null {
  const v = o[key];
  return typeof v === "string" ? v : null;
}

export function parseRecord(raw: unknown, service: string, i: number): ResearchRecord {
  if (!isObj(raw)) return fail(service, `records[${i}] should be an object`);
  const ctx = `records[${i}]`;
  const battery = raw.battery;
  if (battery !== "Sodium-ion" && battery !== "Lithium-ion") return fail(service, `${ctx}.battery`);
  const group = raw.anodeGroup === "Biomass" ? "Biomass" : "Other";
  const format = optString(raw, "format");
  return {
    id: requireString(raw, "id", service, ctx),
    paper: requireString(raw, "paper", service, ctx),
    author: optString(raw, "author") ?? "",
    year: optNumber(raw, "year") ?? 0,
    battery,
    anode: requireString(raw, "anode", service, ctx),
    anodeFrom: optString(raw, "anodeFrom") ?? "Not stated",
    anodeGroup: group,
    anodeTest: optString(raw, "anodeTest"),
    anodePage: optString(raw, "anodePage"),
    cathode: optString(raw, "cathode"),
    cathodeFormula: optString(raw, "cathodeFormula"),
    format: format === "Pouch" || format === "Cylindrical" || format === "Coin" || format === "Not stated" ? format : null,
    cell: optString(raw, "cell") ?? "Not stated",
    result: optString(raw, "result"),
    energy: optNumber(raw, "energy"),
    energyText: optString(raw, "energyText"),
    energyBasis: optString(raw, "energyBasis"),
    cycles: optNumber(raw, "cycles"),
    cycling: optString(raw, "cycling"),
    lowTemp: optString(raw, "lowTemp"),
    page: optString(raw, "page") ?? "",
    checked: raw.checked === true,
    anodeCapacity: optNumber(raw, "anodeCapacity"),
    anodeICE: optNumber(raw, "anodeICE"),
    rateCapacity: optNumber(raw, "rateCapacity"),
    rateCondition: optString(raw, "rateCondition"),
    anodeCycles: optNumber(raw, "anodeCycles"),
    anodeRetention: optNumber(raw, "anodeRetention"),
    anodeRetentionNote: optString(raw, "anodeRetentionNote"),
    carbonizationTemp: optNumber(raw, "carbonizationTemp"),
    d002: optNumber(raw, "d002"),
    fullRetention: optNumber(raw, "fullRetention"),
    fullRetentionNote: optString(raw, "fullRetentionNote"),
  };
}

export function parseResearchDataset(raw: unknown, service: string): ResearchDataset {
  if (!isObj(raw)) return fail(service, "expected { papers, records }");
  if (!isObj(raw.papers)) return fail(service, "papers should be an object keyed by paper ID");
  if (!Array.isArray(raw.records)) return fail(service, "records should be a list");
  const papers: Record<string, PaperMeta> = {};
  for (const [id, p] of Object.entries(raw.papers)) {
    if (!isObj(p)) return fail(service, `papers.${id}`);
    papers[id] = { author: optString(p, "author") ?? "", year: optNumber(p, "year") ?? 0, title: optString(p, "title") ?? id };
  }
  return {
    papers,
    records: raw.records.map((r, i) => parseRecord(r, service, i)),
    checkedValueCount: optNumber(raw, "checkedValueCount"),
  };
}

export function parseLibraryPaper(raw: unknown, service: string, i: number): LibraryPaper {
  if (!isObj(raw)) return fail(service, `papers[${i}] should be an object`);
  const ctx = `papers[${i}]`;
  const status = raw.status;
  if (!STATUSES.includes(status as PaperStatus)) return fail(service, `${ctx}.status should be Harvested, Extracted or Checked`);
  return {
    id: requireString(raw, "id", service, ctx),
    authors: optString(raw, "authors") ?? "",
    year: optNumber(raw, "year"),
    title: requireString(raw, "title", service, ctx),
    type: optString(raw, "type") ?? "Not yet identified",
    collection: optString(raw, "collection") ?? "Uncategorised",
    status: status as PaperStatus,
    values: optString(raw, "values"),
    note: optString(raw, "note") ?? "",
  };
}

export function parseLibrary(raw: unknown, service: string): LibraryPaper[] {
  if (!Array.isArray(raw)) return fail(service, "expected a list of papers");
  return raw.map((p, i) => parseLibraryPaper(p, service, i));
}

export function parseReviewQueue(raw: unknown, service: string): ReviewItem[] {
  if (!Array.isArray(raw)) return fail(service, "expected a list of review items");
  return raw.map((r, i) => {
    if (!isObj(r)) return fail(service, `review[${i}]`);
    const ctx = `review[${i}]`;
    return {
      id: requireString(r, "id", service, ctx),
      paper: requireString(r, "paper", service, ctx),
      field: requireString(r, "field", service, ctx),
      value: requireString(r, "value", service, ctx),
      page: optString(r, "page") ?? "",
      source: r.source === "abstract" ? "abstract" : "amplifi",
      sourceLabel: optString(r, "sourceLabel") ?? "",
      note: optString(r, "note") ?? "",
    };
  });
}
