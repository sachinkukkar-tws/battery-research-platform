import type { LibraryPaper, ReviewAction, ReviewDecision, ReviewItem, ReviewOutcome } from "@/types";

export const OUTCOME_OF: Record<ReviewAction, ReviewOutcome> = {
  approve: "approved",
  correct: "corrected",
  reject: "rejected",
};

export interface ReviewState {
  queue: ReviewItem[];
  decisions: ReviewDecision[];
  library: LibraryPaper[];
  checkedValueCount: number | null;
}

/**
 * Applies a review decision that the backend has already accepted:
 * removes the item from the queue, records it, bumps the checked count for approvals and
 * corrections, and moves the paper to "Checked" once nothing is waiting for it.
 */
export function applyReviewDecision(
  state: ReviewState,
  itemId: string,
  action: ReviewAction,
  correctedValue?: string,
  now: Date = new Date(),
): ReviewState {
  const item = state.queue.find((r) => r.id === itemId);
  if (!item) return state;
  const outcome = OUTCOME_OF[action];
  const queue = state.queue.filter((r) => r.id !== itemId);
  const decision: ReviewDecision = {
    item,
    outcome,
    finalValue: action === "correct" && correctedValue ? correctedValue : item.value,
    decidedAt: now.toISOString(),
  };
  const remaining = queue.filter((r) => r.paper === item.paper).length;
  const library = state.library.map((p) => {
    if (p.id !== item.paper || p.status !== "Extracted") return p;
    return remaining
      ? { ...p, values: `${remaining} waiting` }
      : { ...p, status: "Checked" as const, values: "Checked", note: "All values checked by a person." };
  });
  return {
    queue,
    decisions: [decision, ...state.decisions],
    library,
    checkedValueCount:
      state.checkedValueCount != null && outcome !== "rejected" ? state.checkedValueCount + 1 : state.checkedValueCount,
  };
}

export function reviewConfirmation(item: ReviewItem, outcome: ReviewOutcome): string {
  switch (outcome) {
    case "approved":
      return `Approved. ${item.paper}’s ${item.field.toLowerCase()} now counts as checked.`;
    case "corrected":
      return `Correction saved. The corrected value for ${item.paper} counts as checked.`;
    case "rejected":
      return `Rejected. The value won’t be added for ${item.paper}.`;
  }
}

export const REVIEW_SOURCE_FILTERS = [
  { value: "all", label: "All waiting values" },
  { value: "amplifi", label: "Extracted by Amplifi" },
  { value: "abstract", label: "Taken from an abstract" },
] as const;

export type ReviewSourceFilter = (typeof REVIEW_SOURCE_FILTERS)[number]["value"];
