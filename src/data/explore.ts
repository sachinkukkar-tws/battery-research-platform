import type { BatteryType } from "@/types";
import type { PairFilters } from "@/domain/pairs";

export interface QuickQuestion {
  question: string;
  set: Partial<PairFilters>;
  /** Which material list to summarise for this question. */
  focus?: "anode" | "cathode";
}

export const QUICK_QUESTIONS: QuickQuestion[] = [
  { question: "Which cathodes have been used with hard carbon anodes?", set: { battery: "Sodium-ion" }, focus: "cathode" },
  { question: "Which anodes have been tested with NVP?", set: { cathode: "NVP" }, focus: "anode" },
  { question: "Which pairs were tested in pouch or cylindrical cells?", set: { format: "scaled" } },
  { question: "Which biomass-based anodes have been tested?", set: { from: "Biomass" }, focus: "anode" },
  { question: "Which pairs have low-temperature data?", set: { lowTemp: true } },
  { question: "Which pairs report the highest energy density?", set: { sort: "energy" } },
];

/**
 * Cathodes of research interest that no paper has paired yet. Shown as columns in the
 * untested-pairs grid so the gap is visible. Carried over from the prototype.
 */
export const EXTRA_GRID_CATHODES: Record<BatteryType, string[]> = {
  "Sodium-ion": ["Sodium layered oxide"],
  "Lithium-ion": [],
};

/** Pairs pre-selected in the Compare tab, as in the prototype. */
export const DEFAULT_COMPARE: [string, string, string] = ["CP06-32700", "CP07-full", ""];
