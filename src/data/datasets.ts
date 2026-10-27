import type { Dataset, DatasetId } from "@/types";

/** Amplifi datasets a paper can be uploaded into. */
export const DATASETS: Record<DatasetId, Dataset> = {
  "theme-b": { id: "theme-b", label: "Hard carbon papers (Theme B)", collection: "Hard carbon (client)" },
  "theme-a": { id: "theme-a", label: "Lithium-ion papers (Theme A)", collection: "Lithium-ion" },
};

export const DATASET_ORDER: DatasetId[] = ["theme-b", "theme-a"];

/** Library collections, in display order. */
export const COLLECTIONS = ["Hard carbon (client)", "Lithium-ion"] as const;
