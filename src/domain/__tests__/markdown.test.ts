import { answerToMarkdown } from "../markdown";

describe("answerToMarkdown", () => {
  it("turns Amplifi's bullet characters into nested Markdown list items", () => {
    const text = "• **Main Point**\n   ◦ ICE of 94.8% at 20 mA/g.\n      ▪ detail";
    expect(answerToMarkdown(text)).toBe("- **Main Point**\n  - ICE of 94.8% at 20 mA/g.\n    - detail");
  });

  it("turns citation markers into cite links and leaves other text alone", () => {
    expect(answerToMarkdown("## Sources\n150 Wh/kg [CP01], see [C12] and [X9].")).toBe(
      "## Sources\n150 Wh/kg [CP01](#cite-CP01), see [C12](#cite-C12) and [X9].",
    );
  });

  it("keeps a bullet character that is part of a sentence", () => {
    expect(answerToMarkdown("Na • K comparison")).toBe("Na • K comparison");
  });
});
