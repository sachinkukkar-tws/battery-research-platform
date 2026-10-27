/** Battery chemistry of a tested cell or anode. */
export type BatteryType = "Sodium-ion" | "Lithium-ion";

/** Broad grouping of the anode's starting material, used for filtering and colouring. */
export type AnodeGroup = "Biomass" | "Other";

/** Cell format as reported by the paper. "Not stated" is a real reported state, not missing data. */
export type CellFormat = "Pouch" | "Cylindrical" | "Coin" | "Not stated";

export interface PaperMeta {
  author: string;
  year: number;
  title: string;
}

/**
 * One tested anode (and, where reported, its full cell with a cathode).
 * Every measurement is nullable: `null` means the paper does not report it.
 * The UI must show "Not reported" for null and never estimate a value.
 */
export interface ResearchRecord {
  id: string;
  paper: string;
  author: string;
  year: number;
  battery: BatteryType;
  anode: string;
  anodeFrom: string;
  anodeGroup: AnodeGroup;
  anodeTest: string | null;
  anodePage: string | null;
  cathode: string | null;
  cathodeFormula: string | null;
  format: CellFormat | null;
  cell: string;
  result: string | null;
  energy: number | null;
  energyText: string | null;
  energyBasis: string | null;
  cycles: number | null;
  cycling: string | null;
  lowTemp: string | null;
  page: string;
  /** True when a person has checked the values against the paper. */
  checked: boolean;
  anodeCapacity: number | null;
  anodeICE: number | null;
  rateCapacity: number | null;
  rateCondition: string | null;
  anodeCycles: number | null;
  anodeRetention: number | null;
  anodeRetentionNote: string | null;
  carbonizationTemp: number | null;
  d002: number | null;
  fullRetention: number | null;
  fullRetentionNote: string | null;
}

export interface ResearchDataset {
  papers: Record<string, PaperMeta>;
  records: ResearchRecord[];
  /** Total values checked by a person. `null` when the backend doesn't report it. */
  checkedValueCount: number | null;
}
