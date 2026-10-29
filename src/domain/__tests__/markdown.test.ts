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

  it("keeps the note beside the button when a citation has extra words, and links every ID", () => {
    expect(answerToMarkdown("94.8% [CP01, laboratory measurement] and [CP03, CP04].")).toBe(
      "94.8% [CP01](#cite-CP01) (laboratory measurement) and [CP03](#cite-CP03) [CP04](#cite-CP04).",
    );
  });

  it("links Amplifi's zero-padded Theme A IDs to the library's C1 to C9", () => {
    expect(answerToMarkdown("See [C01_Edge_2021.pdf] and [C09].")).toBe("See [C1](#cite-C1) and [C9](#cite-C9).");
  });

  it("keeps a bullet character that is part of a sentence", () => {
    expect(answerToMarkdown("Na • K comparison")).toBe("Na • K comparison");
  });
});
