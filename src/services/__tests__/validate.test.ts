import { MOCK_LIBRARY, MOCK_RESEARCH, MOCK_REVIEW_QUEUE } from "@/data/mockData";
import { readConfig } from "../config";
import { parseLibrary, parseResearchDataset, parseReviewQueue } from "../validate";

describe("response validation", () => {
  it("accepts the documented shapes unchanged", () => {
    expect(parseResearchDataset(MOCK_RESEARCH, "x")).toEqual(MOCK_RESEARCH);
    expect(parseLibrary(MOCK_LIBRARY.map(({ isDemoUpload: _, ...p }) => p), "x")).toHaveLength(MOCK_LIBRARY.length);
    expect(parseReviewQueue(MOCK_REVIEW_QUEUE, "x")).toEqual(MOCK_REVIEW_QUEUE);
  });

  it("keeps missing measurements as null rather than inventing them", () => {
    const raw = { papers: {}, records: [{ id: "a", paper: "P", anode: "X", battery: "Sodium-ion", energy: "150" }] };
    const r = parseResearchDataset(raw, "x").records[0]!;
    expect(r.energy).toBeNull();
    expect(r.anodeCapacity).toBeNull();
  });

  it("rejects malformed responses with a clear message", () => {
    expect(() => parseResearchDataset([], "The platform")).toThrow(/The platform sent data in an unexpected format/);
    expect(() => parseResearchDataset({ papers: {}, records: [{ id: "a" }] }, "x")).toThrow(/battery/);
    expect(() => parseLibrary([{ id: "a", title: "t", status: "Done" }], "x")).toThrow(/status/);
  });
});

describe("config", () => {
  it("defaults to mock mode and safe values", () => {
    expect(readConfig({})).toMatchObject({ mode: "mock", platformApiBase: "/api", amplifiProxyUrl: "/amplifi", routerMode: "browser" });
  });
  it("reads and normalises env values", () => {
    const c = readConfig({ VITE_DATA_MODE: "live", VITE_PLATFORM_API_BASE: "https://x/api/", VITE_MAX_UPLOAD_MB: "10", VITE_ROUTER_MODE: "nonsense" });
    expect(c).toMatchObject({ mode: "live", platformApiBase: "https://x/api", maxUploadBytes: 10 * 1024 * 1024, routerMode: "browser" });
  });
});
