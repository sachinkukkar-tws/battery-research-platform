import { MOCK_RESEARCH } from "@/data/mockData";
import { buildPairGrid, countByPapers, DEFAULT_PAIR_FILTERS, filterPairs, pairSummary, togglePick } from "../pairs";

const records = MOCK_RESEARCH.records;
const f = (patch = {}) => ({ ...DEFAULT_PAIR_FILTERS, ...patch });

describe("pair filtering", () => {
  it("returns everything with default filters, most cycles first and missing values last", () => {
    const list = filterPairs(records, f());
    expect(list).toHaveLength(records.length);
    expect(list[0]!.cycles).toBe(11000);
    const firstMissing = list.findIndex((r) => r.cycles == null);
    expect(list.slice(firstMissing).every((r) => r.cycles == null)).toBe(true);
  });

  it("'scaled' format means pouch or cylindrical", () => {
    const list = filterPairs(records, f({ format: "scaled" }));
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((r) => r.format === "Pouch" || r.format === "Cylindrical")).toBe(true);
  });

  it("low-temperature filter keeps only records that report it", () => {
    const list = filterPairs(records, f({ lowTemp: true }));
    expect(list.map((r) => r.id).sort()).toEqual(["CP02-pouch", "CP07-full"]);
  });

  it("summarises anodes tested with a cathode", () => {
    const list = filterPairs(records, f({ cathode: "NVP" }));
    expect(pairSummary(list, f({ cathode: "NVP" }))).toBe(
      "3 tested pairs from 3 papers. Anodes: GCL8 (1 paper), Ni-NPC (1 paper), S-HC-2 (1 paper).",
    );
  });

  it("ranks cathodes by number of papers", () => {
    const tested = records.filter((r) => r.cathode && r.battery === "Sodium-ion");
    expect(countByPapers(tested, "cathode")).toMatch(/^NFPP \(3 papers\), NVP \(3 papers\)/);
  });

  it("returns an empty summary for no matches", () => {
    expect(pairSummary([], f())).toBe("");
  });
});

describe("compare picks", () => {
  it("toggles and keeps at most three, dropping the oldest", () => {
    let p = togglePick([], "a");
    p = togglePick(p, "b");
    p = togglePick(p, "c");
    p = togglePick(p, "d");
    expect(p).toEqual(["b", "c", "d"]);
    expect(togglePick(p, "c")).toEqual(["b", "d"]);
  });
});

describe("untested grid", () => {
  it("adds research-interest cathodes as empty columns", () => {
    const g = buildPairGrid(records, "Sodium-ion", ["Sodium layered oxide"]);
    expect(g.cathodes).toContain("Sodium layered oxide");
    expect(g.anodes.every((a) => g.count(a.anode, "Sodium layered oxide") === 0)).toBe(true);
    expect(g.count("POHC-2", "NFPP")).toBe(2);
  });
});
