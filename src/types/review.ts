export type ReviewSource = "abstract" | "amplifi";

export interface ReviewItem {
  id: string;
  paper: string;
  field: string;
  value: string;
  page: string;
  source: ReviewSource;
  sourceLabel: string;
  note: string;
}

export type ReviewAction = "approve" | "correct" | "reject";
export type ReviewOutcome = "approved" | "corrected" | "rejected";

export interface ReviewDecision {
  item: ReviewItem;
  outcome: ReviewOutcome;
  /** The value that now stands: the original for approvals, the correction for corrections. */
  finalValue: string;
  decidedAt: string;
}
