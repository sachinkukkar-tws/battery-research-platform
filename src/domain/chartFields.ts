import type { ResearchRecord } from "@/types";

/** "anode" values come from electrode tests; "pair" values from full cells. */
export type FieldLevel = "anode" | "pair";

export interface ChartField {
  key: ChartFieldKey;
  label: string;
  unit: string;
  get: (r: ResearchRecord) => number | null;
  /** Condition or approximation attached to the value, shown in the tooltip. */
  note?: (r: ResearchRecord) => string | null;
  level: FieldLevel;
  /** 1 when higher is better; 0 when there is no better direction. */
  direction: 0 | 1;
  log?: boolean;
  max?: number;
  decimals: number;
  noGrouping?: boolean;
  integer?: boolean;
}

export type ChartFieldKey =
  | "capacity" | "ice" | "rate" | "acycles" | "aret" | "temp" | "d002" | "fcycles" | "fret" | "energy" | "year";

const FIELDS: ChartField[] = [
  { key: "capacity", label: "Reversible capacity", unit: "mAh/g", get: (r) => r.anodeCapacity, level: "anode", direction: 1, decimals: 1 },
  { key: "ice", label: "First-cycle efficiency", unit: "%", get: (r) => r.anodeICE, level: "anode", direction: 1, max: 100, decimals: 1 },
  { key: "rate", label: "Capacity at the highest tested current", unit: "mAh/g", get: (r) => r.rateCapacity, note: (r) => r.rateCondition, level: "anode", direction: 1, decimals: 1 },
  { key: "acycles", label: "Anode cycles tested", unit: "cycles", get: (r) => r.anodeCycles, level: "anode", direction: 1, log: true, decimals: 0 },
  { key: "aret", label: "Anode capacity retention", unit: "%", get: (r) => r.anodeRetention, note: (r) => r.anodeRetentionNote, level: "anode", direction: 1, max: 100, decimals: 1 },
  { key: "temp", label: "Carbonization temperature", unit: "°C", get: (r) => r.carbonizationTemp, level: "anode", direction: 0, decimals: 0 },
  { key: "d002", label: "Interlayer spacing (d002)", unit: "nm", get: (r) => r.d002, level: "anode", direction: 0, decimals: 3 },
  { key: "fcycles", label: "Full-cell cycles tested", unit: "cycles", get: (r) => r.cycles, level: "pair", direction: 1, log: true, decimals: 0 },
  { key: "fret", label: "Full-cell capacity retention", unit: "%", get: (r) => r.fullRetention, note: (r) => r.fullRetentionNote, level: "pair", direction: 1, max: 100, decimals: 1 },
  { key: "energy", label: "Full-cell energy density", unit: "Wh/kg", get: (r) => r.energy, level: "pair", direction: 1, decimals: 1 },
  { key: "year", label: "Year published", unit: "", get: (r) => r.year, level: "anode", direction: 0, decimals: 0, noGrouping: true, integer: true },
];

export const CHART_FIELDS = Object.fromEntries(FIELDS.map((f) => [f.key, f])) as Record<ChartFieldKey, ChartField>;
export const CHART_FIELD_LIST = FIELDS;

export const axisLabel = (f: ChartField) => (f.unit ? `${f.label} (${f.unit})` : f.label);
