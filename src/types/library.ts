/** Pipeline stage of a paper: harvested (searchable), values extracted, or values checked by a person. */
export type PaperStatus = "Harvested" | "Extracted" | "Checked";

export const PAPER_STATUSES: readonly PaperStatus[] = ["Checked", "Extracted", "Harvested"];

export interface LibraryPaper {
  id: string;
  authors: string;
  year: number | null;
  title: string;
  /** Kind of document, e.g. "Lab study", "Review", "Government report". */
  type: string;
  collection: string;
  status: PaperStatus;
  /** Short human summary of extracted values, e.g. "9 checked" or "2 waiting". */
  values: string | null;
  note: string;
  /** Set for papers added in mock mode so the UI can label them as demo uploads. */
  isDemoUpload?: boolean;
}
