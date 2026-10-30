/**
 * The Explorer's data: what Amplifi extracted from each client paper, with every value checked against the PDF.
 * Built by scripts/explorer/build_data.py and served live by the proxy at GET /amplifi/explorer.
 */

/** verified: the quote is on `page` and contains the values. quote only: the quote is there but a value isn't. */
export type ExtractionStatus = "verified" | "quote only" | "unverified";

export type AnodeFamily = "hard carbon" | "graphite/hard carbon" | "graphite" | "silicon-carbon" | "other";

export type ExplorerBattery = "sodium-ion" | "lithium-ion";

/** A paper's own details, as Amplifi read them. Each is null unless the PDF contains it. */
export interface ExplorerPaper {
  id: string;
  /** The PDF's file name, e.g. CP06_Jia_2026.pdf. */
  file: string;
  title: string | null;
  firstAuthor: string | null;
  journal: string | null;
  year: number | null;
  doi: string | null;
  kind: "research article" | "review" | null;
  battery: ExplorerBattery | null;
}

/** Where an extracted item comes from: a quote copied from the paper and the PDF page it is on. */
export interface Sourced {
  paper: string;
  quote: string;
  /** PDF page (1-based) where the quote was found; null when it wasn't. */
  page: number | null;
  status: ExtractionStatus;
}

export interface ExtractedAnode extends Sourced {
  sample: string;
  family: AnodeFamily;
  precursor: string | null;
  method: string | null;
  temperature: string | null;
}

export type ExtractedCellFormat = "coin" | "pouch" | "cylindrical" | "not stated";

export interface ExtractedFullCell extends Sourced {
  anodeSample: string;
  cathode: string;
  /** Kept only when the paper contains it. */
  cathodeFormula: string | null;
  /** The abbreviation Amplifi read in the paper, e.g. "NVP"; kept only when the paper contains it. */
  cathodeShortName: string | null;
  /** The cathode's name across papers, from Amplifi's names, e.g. "NFPP". */
  cathodeLabel: string;
  cathodeLabelFormula: string | null;
  cellFormat: ExtractedCellFormat;
}

export type MaterialKind = "electrolyte" | "separator" | "current collector" | "binder" | "additive";

export interface ExtractedMaterial extends Sourced {
  kind: MaterialKind;
  value: string;
}

export type Metric =
  | "reversible capacity"
  | "initial coulombic efficiency"
  | "capacity retention"
  | "capacity after cycling"
  | "rate capability"
  | "energy density"
  | "other";

export interface ExtractedValue extends Sourced {
  sample: string;
  metric: Metric;
  value: string;
  condition: string | null;
  testType: "half cell" | "full cell";
}

export interface ExplorerData {
  /** When Amplifi gave the newest answer, as an ISO date and time. */
  extractedAt: string | null;
  method: string;
  papers: Record<string, ExplorerPaper>;
  anodes: ExtractedAnode[];
  fullCells: ExtractedFullCell[];
  materials: ExtractedMaterial[];
  performance: ExtractedValue[];
}
