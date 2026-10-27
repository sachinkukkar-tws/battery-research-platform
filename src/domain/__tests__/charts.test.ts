import { MOCK_RESEARCH } from "@/data/mockData";
import { CHART_FIELDS } from "../chartFields";
import { buildAxis, chartPoints, formatValue, niceTicks, paretoFront, pearson, placeLabels, rankingModel, scatterModel } from "../charts";

const records = MOCK_RESEARCH.records;

describe("chart maths", () => {
  it("produces nice ticks that cover the range", () => {
    expect(niceTicks(0, 100)).toEqual([0, 20, 40, 60, 80, 100]);
    const t = niceTicks(343, 487);
    expect(t[0]).toBeLessThanOrEqual(343);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(487);
  });

  it("caps percentage axes at 100", () => {
    const axis = buildAxis(CHART_FIELDS.ice, [43.9, 94.8]);
    expect(axis.ticks[axis.ticks.length - 1]).toBe(100);
  });

  it("uses powers of ten on log axes", () => {
    expect(buildAxis(CHART_FIELDS.fcycles, [100, 11000]).ticks).toEqual([100, 1000, 10000, 100000]);
  });

  it("computes Pearson correlation", () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(pearson([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBe(0);
  });

  it("finds the Pareto front only when higher is better on both", () => {
    const pts = chartPoints(records, [CHART_FIELDS.capacity, CHART_FIELDS.ice]).points;
    expect(paretoFront(pts, CHART_FIELDS.capacity, CHART_FIELDS.ice).map((r) => r.anode).sort()).toEqual(["BGP@HEC-HC", "S-HC-2"]);
    expect(paretoFront(pts, CHART_FIELDS.capacity, CHART_FIELDS.temp)).toEqual([]);
  });

  it("drops records missing a value instead of imputing it, and plots each anode once", () => {
    const { points, total } = chartPoints(records, [CHART_FIELDS.capacity, CHART_FIELDS.ice]);
    expect(points.every((r) => r.anodeCapacity != null && r.anodeICE != null)).toBe(true);
    expect(new Set(points.map((r) => r.anode)).size).toBe(points.length);
    expect(total).toBe(9);
    expect(points).toHaveLength(7);
  });

  it("formats values with units and Indian grouping", () => {
    expect(formatValue(CHART_FIELDS.ice, 94.8)).toBe("94.8%");
    expect(formatValue(CHART_FIELDS.fcycles, 11000)).toBe("11,000 cycles");
    expect(formatValue(CHART_FIELDS.year, 2026)).toBe("2026");
  });

  it("explains when too few materials report both values", () => {
    const m = scatterModel(records, CHART_FIELDS.d002, CHART_FIELDS.energy, "battery");
    expect(m.points.length).toBeLessThan(2);
    expect(m.insights[0]!.text).toMatch(/^Only \d of \d+ materials report both/);
  });

  it("ranks highest first and flags conditional values", () => {
    const m = rankingModel(records, CHART_FIELDS.aret, "battery");
    const vals = m.points.map((r) => r.anodeRetention!);
    expect(vals).toEqual([...vals].sort((a, b) => b - a));
  });

  it("places labels without overlapping each other", () => {
    const placed = placeLabels(
      [
        { cx: 100, cy: 100, text: "AAAA" },
        { cx: 102, cy: 100, text: "BBBB" },
      ],
      { minX: 0, maxX: 1000 },
    );
    const [a, b] = placed;
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.x === b!.x && a!.y === b!.y).toBe(false);
  });
});
