import { searchExplorer } from "@/domain/search";
import { EXPLORER_FIXTURE as DATA } from "@/test/fixtures/explorerData";

describe("header search", () => {
  it("finds a cathode by its formula and opens its pair", () => {
    expect(searchExplorer(DATA, "Na3V2")[0]).toEqual({
      kind: "Cathode",
      label: "NVP",
      detail: "With hard carbon · 3 papers",
      to: "/explore?anode=sodium-ion-hard-carbon&cathode=NVP",
    });
  });

  it("finds a sample, and a paper by ID, author or DOI", () => {
    expect(searchExplorer(DATA, "hhc")[0]).toMatchObject({ kind: "Sample", label: "HHC", to: "/papers/CP06" });
    expect(searchExplorer(DATA, "cp08")[0]).toMatchObject({ kind: "Paper", to: "/papers/CP08" });
    expect(searchExplorer(DATA, "jia")[0]).toMatchObject({ kind: "Paper", to: "/papers/CP06" });
    expect(searchExplorer(DATA, "10.1039/d4sc00734d")).toEqual([expect.objectContaining({ kind: "Paper", to: "/papers/CP08" })]);
  });

  it("waits for two characters and caps the list", () => {
    expect(searchExplorer(DATA, "n")).toEqual([]);
    expect(searchExplorer(DATA, "carbon").length).toBeLessThanOrEqual(8);
  });
});
