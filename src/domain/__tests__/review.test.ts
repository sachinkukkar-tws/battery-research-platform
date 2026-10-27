import { MOCK_LIBRARY, MOCK_REVIEW_QUEUE } from "@/data/mockData";
import { applyReviewDecision, type ReviewState } from "../review";

const base = (): ReviewState => ({
  queue: structuredClone(MOCK_REVIEW_QUEUE),
  decisions: [],
  library: structuredClone(MOCK_LIBRARY),
  checkedValueCount: 72,
});

describe("applyReviewDecision", () => {
  it("approves: removes from queue, records it and counts it as checked", () => {
    const s = applyReviewDecision(base(), "r3", "approve");
    expect(s.queue.find((r) => r.id === "r3")).toBeUndefined();
    expect(s.decisions[0]).toMatchObject({ outcome: "approved", finalValue: "474.8 mAh/g" });
    expect(s.checkedValueCount).toBe(73);
  });

  it("corrects: keeps the corrected value", () => {
    const s = applyReviewDecision(base(), "r3", "correct", "443.8 mAh/g");
    expect(s.decisions[0]).toMatchObject({ outcome: "corrected", finalValue: "443.8 mAh/g" });
  });

  it("rejects: doesn't count as checked", () => {
    expect(applyReviewDecision(base(), "r4", "reject").checkedValueCount).toBe(72);
  });

  it("moves an extracted paper to checked once nothing is waiting for it", () => {
    let s = applyReviewDecision(base(), "r1", "approve");
    expect(s.library.find((p) => p.id === "CP02")).toMatchObject({ status: "Extracted", values: "1 waiting" });
    s = applyReviewDecision(s, "r2", "reject");
    expect(s.library.find((p) => p.id === "CP02")).toMatchObject({ status: "Checked" });
  });

  it("leaves an unknown count unknown and ignores unknown items", () => {
    const s = { ...base(), checkedValueCount: null };
    expect(applyReviewDecision(s, "r3", "approve").checkedValueCount).toBeNull();
    expect(applyReviewDecision(s, "nope", "approve")).toBe(s);
  });
});
