import {
  anodeTypes,
  cathodesFor,
  conditionToShow,
  cycleCounts,
  evidenceChecks,
  formatUnits,
  highlight,
  highlights,
  isChecked,
  missingMaterials,
  pairView,
  paperByline,
  paperTitle,
  suggestQuestions,
} from "@/domain/explorer";
import { EXPLORER_FIXTURE } from "@/test/fixtures/explorerData";
import type { ExplorerData, ExplorerPaper } from "@/types";

const paper = (id: string, kind: ExplorerPaper["kind"] = "research article"): ExplorerPaper => ({
  id, file: `${id}_Author_2026.pdf`, title: `Title ${id}`, firstAuthor: `Author ${id}`, journal: "J", year: 2026, doi: `10.1/${id}`, kind, battery: "sodium-ion",
});
const from = (p: string, quote = `A sentence from ${p}`) => ({ paper: p, quote, page: 3, status: "verified" as const });
const anode = (p: string, sample: string) => ({ ...from(p), sample, family: "hard carbon" as const, precursor: "wood", method: "pyrolysis", temperature: null });
const cell = (p: string, anodeSample: string, label: string, cellFormat: "coin" | "pouch" | "not stated") => ({
  ...from(p, `${anodeSample} full cells with ${label}`), anodeSample, cathode: label, cathodeFormula: null, cathodeShortName: label, cathodeLabel: label, cathodeLabelFormula: null, cellFormat,
});

const DATA: ExplorerData = {
  extractedAt: "2026-10-29T18:00+05:30",
  method: "Test.",
  papers: { P1: paper("P1"), P2: paper("P2"), P3: paper("P3"), R1: paper("R1", "review") },
  anodes: [
    anode("P1", "HC-1"),
    anode("P1", "pure carbon (control)"),
    anode("P2", "NPC"),
    anode("P2", "Ni-NPC"),
    anode("P3", "HC-3"),
    anode("R1", "Cited hard carbon"),
    { ...anode("P3", "Ghost"), status: "unverified" },
  ],
  fullCells: [
    cell("P1", "HC-1", "NFPP", "pouch"),
    cell("P1", "pure carbon (control)", "NVP", "coin"),
    cell("P2", "Ni-NPC", "NVP", "coin"),
    cell("P3", "HC-3", "NFPP", "coin"),
    cell("R1", "Cited hard carbon", "NVP", "not stated"),
  ],
  materials: [{ ...from("P1"), kind: "electrolyte", value: "1 M NaPF6 in diglyme" }],
  performance: [
    { ...from("P2", "NPC gives 300 mAh g-1"), sample: "NPC", metric: "reversible capacity", value: "300 mAh g-1", condition: null, testType: "half cell" },
    { ...from("P2", "Ni-NPC gives 402.1 mAh g-1"), sample: "Ni-NPC", metric: "reversible capacity", value: "402.1 mAh g-1", condition: null, testType: "half cell" },
    { ...from("P2", "the full cell keeps 90% after 1,200 cycles"), sample: "Ni-NPC", metric: "capacity retention", value: "90%", condition: "after 1,200 cycles at 1C", testType: "full cell" },
  ],
};

describe("Explorer data model", () => {
  it("builds anode types from research papers' checked samples, without controls", () => {
    const types = anodeTypes(DATA);
    expect(types.map((t) => [t.key, t.papers])).toEqual([["sodium-ion|hard carbon", ["P1", "P2", "P3"]]]);
    expect(types[0]!.samples.map((s) => s.sample)).toEqual(["HC-1", "NPC", "Ni-NPC", "HC-3"]);
  });

  it("ranks cathodes by papers, then practical cells, and leaves reviews and controls out", () => {
    const options = cathodesFor(DATA, anodeTypes(DATA)[0]!);
    expect(options.map((c) => [c.label, c.papers, c.strength, c.formats])).toEqual([
      ["NFPP", ["P1", "P3"], "Strong", ["pouch", "coin"]],
      ["NVP", ["P2"], "Limited", ["coin"]],
    ]);
  });

  it("keeps a pair's own samples and values, and finds the reviews that cover it", () => {
    const type = anodeTypes(DATA)[0]!;
    const nvp = cathodesFor(DATA, type).find((c) => c.label === "NVP")!;
    const pair = pairView(DATA, type, nvp);
    expect(pair.samples.map((s) => s.sample)).toEqual(["Ni-NPC"]);
    expect(pair.performance.map((v) => v.value)).toEqual(["402.1 mAh g-1", "90%"]);
    expect(pair.evidence).toEqual({ "full cell": ["P2"], "half cell": ["P2"], review: ["R1"] });
  });

  it("picks the pair's headline results and the materials nobody reports", () => {
    const type = anodeTypes(DATA)[0]!;
    const [nfpp, nvp] = cathodesFor(DATA, type);
    expect(highlights(pairView(DATA, type, nvp!)).map((h) => [h.label, h.text])).toEqual([
      ["Highest reversible capacity", "402.1 mAh g-1"],
      ["Longest full-cell cycling", "90% after 1,200 cycles"],
    ]);
    expect(missingMaterials(pairView(DATA, type, nfpp!))).toEqual(["separator", "current collector", "binder", "additive"]);
  });

  it("doesn't repeat a cycle count or condition that Amplifi already wrote into the value", () => {
    const retention = DATA.performance[2]!;
    const data = { ...DATA, performance: [...DATA.performance.slice(0, 2), { ...retention, value: "90% after 1,200 cycles" }] };
    const type = anodeTypes(data)[0]!;
    const nvp = cathodesFor(data, type).find((c) => c.label === "NVP")!;
    expect(highlights(pairView(data, type, nvp)).at(-1)?.text).toBe("90% after 1,200 cycles");
    const rate = { ...retention, value: "114.1 mAh g-1 at 5 A g-1", condition: "5 A g-1" };
    expect(conditionToShow(rate)).toBeNull();
    expect(conditionToShow({ ...rate, condition: "after 100 cycles" })).toBe("after 100 cycles");
  });

  it("reads cycle counts with thousands written the ways papers write them", () => {
    expect(cycleCounts("85% after 11 000 cycles, 90% after 1,200 cycles and 95% after 500 cycles")).toEqual([11000, 1200, 500]);
    expect(cycleCounts("after 11\u2009000 cycles")).toEqual([11000]);
  });

  it("writes units the way papers print them", () => {
    expect(formatUnits("375.3 mAh g-1 at 20 mA g−1")).toBe("375.3 mAh g⁻¹ at 20 mA g⁻¹");
    expect(formatUnits("124.0 Wh kg-1, 3.8 mg cm-2")).toBe("124.0 Wh kg⁻¹, 3.8 mg cm⁻²");
    expect(formatUnits("1C at −20 °C")).toBe("1C at −20 °C");
  });

  it("runs five plain evidence checks on a paper", () => {
    expect(evidenceChecks(DATA, "P2").map((c) => [c.label, c.ok])).toEqual([
      ["DOI found in the PDF", true],
      ["Full cell tested", true],
      ["Pouch or cylindrical cell", false],
      ["1,000 or more cycles reported", true],
      ["5 or more checked values", true],
    ]);
  });

  it("names a paper by the details Amplifi found in its PDF, and by its file when it found none", () => {
    expect([paperTitle(paper("P1")), paperByline(paper("P1"))]).toEqual(["Title P1", "Author P1 et al. · J · 2026"]);
    const bare = { ...paper("P2"), title: null, firstAuthor: null, journal: null, year: null };
    expect([paperTitle(bare), paperByline(bare)]).toEqual(["P2_Author_2026.pdf", "P2_Author_2026.pdf"]);
  });

  it("suggests questions only from the data, and none without it", () => {
    expect(suggestQuestions(DATA)).toEqual([
      "What is HC-1 in P1 made from?",
      "How does the Ni-NPC and NVP full cell in P2 perform?",
      "Which cathodes are paired with hard carbon anodes in full cells?",
    ]);
    expect(suggestQuestions(null)).toEqual([]);
  });

  it("highlights a value in its quote by its numbers, or by its words", () => {
    expect(highlight("delivers 402.1 mA h g-1 at 20 mA g-1", "402.1 mA h g-1")).toEqual([
      { text: "delivers ", mark: false },
      { text: "402.1", mark: true },
      { text: " mA h g-1 at 20 mA g-1", mark: false },
    ]);
    expect(highlight("keeps 90% after 1,200 cycles", "90%").filter((p) => p.mark).map((p) => p.text)).toEqual(["90"]);
    expect(highlight("in 1 M NaPF6 in diglyme.", "1 M NaPF6 in diglyme", "text").filter((p) => p.mark).map((p) => p.text)).toEqual(["1 M NaPF6 in diglyme"]);
    expect(highlight("no numbers here", "n/a")).toEqual([{ text: "no numbers here", mark: false }]);
  });
});

describe("Amplifi's recorded answers for the papers", () => {
  const items = [...EXPLORER_FIXTURE.anodes, ...EXPLORER_FIXTURE.fullCells, ...EXPLORER_FIXTURE.materials, ...EXPLORER_FIXTURE.performance];

  it("gives every checked value a known paper and a PDF page", () => {
    for (const item of items.filter(isChecked)) {
      expect(EXPLORER_FIXTURE.papers[item.paper]).toBeDefined();
      expect(item.page).toBeGreaterThanOrEqual(1);
      expect(item.quote.length).toBeGreaterThan(20);
    }
  });

  it("offers the two anode types the papers make, without CP02's control", () => {
    expect(anodeTypes(EXPLORER_FIXTURE).map((t) => t.key)).toEqual(["sodium-ion|hard carbon", "lithium-ion|graphite/hard carbon"]);
  });

  // Each cathode is named by the short name Amplifi read in the papers, else by the formula they give.
  it("pairs each cathode with the papers that test it, as the PDFs show", () => {
    const byLabel = (key: string) =>
      Object.fromEntries(cathodesFor(EXPLORER_FIXTURE, anodeTypes(EXPLORER_FIXTURE).find((t) => t.key === key)!).map((c) => [c.label, c.papers]));
    expect(byLabel("sodium-ion|hard carbon")).toEqual({
      NFPP: ["CP01", "CP06", "CP10"],
      NVP: ["CP03", "CP07", "CP09"],
      PB: ["CP05"],
      "NaNi1/3Fe1/3Mn1/3O2": ["CP07"],
    });
    expect(byLabel("lithium-ion|graphite/hard carbon")).toEqual({ NCM523: ["CP02"] });
  });
});
