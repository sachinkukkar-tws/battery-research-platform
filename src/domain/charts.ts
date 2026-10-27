import type { ResearchRecord } from "@/types";
import type { ChartField } from "./chartFields";
import { NUMBER_LOCALE } from "./format";
import { isLithium, pairName, uniqueByAnode } from "./pairs";

export type ColorBy = "battery" | "from";

/** Value with its unit, e.g. "375.3 mAh/g", "94.8%", "1,000 cycles". */
export function formatValue(f: ChartField, v: number): string {
  const n = Number(v).toLocaleString(NUMBER_LOCALE, { maximumFractionDigits: f.decimals, useGrouping: !f.noGrouping });
  if (!f.unit) return n;
  if (f.unit === "%") return `${n}%`;
  return `${n} ${f.unit}`;
}

export const formatTick = (f: ChartField, v: number) =>
  Number(v).toLocaleString(NUMBER_LOCALE, { maximumFractionDigits: 3, useGrouping: !f.noGrouping });

/** "Nice" axis ticks covering [min, max] in steps of 1, 2, 2.5 or 5 times a power of ten. */
export function niceTicks(min: number, max: number, n = 5): number[] {
  const span = max - min || 1;
  const step0 = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? 10 * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(+v.toFixed(6));
  return out;
}

export interface Axis {
  ticks: number[];
  /** Maps a value to 0..1 along the axis. */
  scale: (v: number) => number;
}

export function buildAxis(f: ChartField, values: number[]): Axis {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (f.log) {
    const lo = Math.pow(10, Math.floor(Math.log10(min)));
    const hi = Math.pow(10, Math.ceil(Math.log10(max)));
    const ticks: number[] = [];
    for (let v = lo; v <= hi; v *= 10) ticks.push(v);
    const span = Math.log10(hi) - Math.log10(lo) || 1;
    return { ticks, scale: (v) => (Math.log10(v) - Math.log10(lo)) / span };
  }
  let ticks: number[];
  if (f.integer) {
    ticks = [];
    for (let v = Math.floor(min) - 1; v <= Math.ceil(max) + 1; v++) ticks.push(v);
  } else {
    const pad = (max - min) * 0.12 || Math.abs(values[0] ?? 1) * 0.1 || 1;
    ticks = niceTicks(min - pad, max + pad);
    if (f.max != null && ticks[ticks.length - 1]! > f.max) {
      ticks = ticks.filter((v) => v <= f.max!);
      if (ticks[ticks.length - 1]! < f.max) ticks.push(f.max);
    }
  }
  const lo = ticks[0]!;
  const span = ticks[ticks.length - 1]! - lo || 1;
  return { ticks, scale: (v) => (v - lo) / span };
}

export interface ChartPoints {
  points: ResearchRecord[];
  /** Records considered before dropping those missing a value. */
  total: number;
  label: (r: ResearchRecord) => string;
}

/**
 * Records that report every field. When all fields describe the anode, each anode is plotted
 * once (several full cells can share one anode). Records missing a value are left out, never imputed.
 */
export function chartPoints(records: ResearchRecord[], fields: ChartField[]): ChartPoints {
  const anodeOnly = fields.every((f) => f.level === "anode");
  const recs = anodeOnly ? uniqueByAnode(records) : records;
  return {
    points: recs.filter((r) => fields.every((f) => f.get(r) != null)),
    total: recs.length,
    label: (r) => (anodeOnly ? r.anode : pairName(r)),
  };
}

const val = (f: ChartField, r: ResearchRecord) => f.get(r) as number;

/** Points not beaten on both values by any other point. Only meaningful when higher is better on both. */
export function paretoFront(points: ResearchRecord[], fx: ChartField, fy: ChartField): ResearchRecord[] {
  if (fx.direction !== 1 || fy.direction !== 1) return [];
  return points.filter(
    (p) =>
      !points.some(
        (q) =>
          q !== p &&
          val(fx, q) >= val(fx, p) &&
          val(fy, q) >= val(fy, p) &&
          (val(fx, q) > val(fx, p) || val(fy, q) > val(fy, p)),
      ),
  );
}

export function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (!n) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) ** 2;
    syy += (ys[i]! - my) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}

/** Least-squares fit y = slope * x + intercept. */
export function linearFit(xs: number[], ys: number[]): { slope: number; intercept: number } {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1;
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i]! - my), 0) / den;
  return { slope, intercept: my - slope * mx };
}

export const median = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2;
};

export const colorOf = (r: ResearchRecord, by: ColorBy) =>
  by === "battery" ? (isLithium(r) ? "var(--lithium)" : "var(--sodium)") : r.anodeGroup === "Biomass" ? "var(--sodium)" : "var(--other)";

export const groupOf = (r: ResearchRecord, by: ColorBy) =>
  by === "battery" ? r.battery : r.anodeGroup === "Biomass" ? "Biomass-based anodes" : "Other anodes";

export const LEGENDS: Record<ColorBy, { label: string; color: string }[]> = {
  battery: [
    { label: "Sodium-ion", color: "var(--sodium)" },
    { label: "Lithium-ion", color: "var(--lithium)" },
  ],
  from: [
    { label: "Biomass-based anode", color: "var(--sodium)" },
    { label: "Other anode", color: "var(--other)" },
  ],
};

/** Group averages sentence, only when at least two groups have two or more points. */
export function groupAverageLine(points: ResearchRecord[], f: ChartField, by: ColorBy): string {
  const g = new Map<string, number[]>();
  for (const r of points) {
    const k = groupOf(r, by);
    if (!g.has(k)) g.set(k, []);
    g.get(k)!.push(val(f, r));
  }
  const big = [...g].filter(([, v]) => v.length >= 2);
  if (big.length < 2) return "";
  const avg = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  return big.map(([k, v]) => `${k} average ${formatValue(f, avg(v))} (${v.length})`).join("; ") + ` for ${f.label.toLowerCase()}.`;
}

export interface Insight {
  text: string;
  key?: boolean;
  /** Bold lead-in, e.g. "Best balance:". */
  lead?: string;
}

export function scatterInsights(
  pts: ChartPoints,
  fx: ChartField,
  fy: ChartField,
  best: ResearchRecord[],
  by: ColorBy,
): Insight[] {
  const { points, label } = pts;
  const out: Insight[] = [];
  if (best.length) {
    out.push({
      key: true,
      lead: "Best balance:",
      text: `${best.map((r) => `${label(r)} (${r.paper})`).join(", ")}. No other material beats ${best.length === 1 ? "it" : "them"} on both values.`,
    });
  }
  if (points.length >= 3) {
    const tx = (v: number) => (fx.log ? Math.log10(v) : v);
    const ty = (v: number) => (fy.log ? Math.log10(v) : v);
    const r = pearson(points.map((p) => tx(val(fx, p))), points.map((p) => ty(val(fy, p))));
    const a = Math.abs(r);
    const strength = a < 0.3 ? null : a < 0.6 ? "Moderate" : "Strong";
    out.push({
      text: strength
        ? `${strength} link: higher ${fx.label.toLowerCase()} tends to go with ${r > 0 ? "higher" : "lower"} ${fy.label.toLowerCase()} here (r = ${r.toFixed(2)}).`
        : `No clear link between ${fx.label.toLowerCase()} and ${fy.label.toLowerCase()} in these papers (r = ${r.toFixed(2)}).`,
    });
  }
  const top = points.reduce((a, b) => (val(fy, b) > val(fy, a) ? b : a));
  const low = points.reduce((a, b) => (val(fy, b) < val(fy, a) ? b : a));
  out.push({
    text: `Highest ${fy.label.toLowerCase()}: ${label(top)}, ${formatValue(fy, val(fy, top))}. Lowest: ${label(low)}, ${formatValue(fy, val(fy, low))}.`,
  });
  const gl = groupAverageLine(points, fy, by);
  if (gl) out.push({ text: gl });
  return out;
}

export function rankingInsights(points: ResearchRecord[], f: ChartField, label: (r: ResearchRecord) => string, by: ColorBy): Insight[] {
  if (!points.length) return [];
  const values = points.map((p) => val(f, p));
  const sorted = [...values].sort((a, b) => a - b);
  const out: Insight[] = [
    {
      key: true,
      lead: `Top ${Math.min(3, points.length)}:`,
      text: `${points.slice(0, 3).map((r) => `${label(r)} (${formatValue(f, val(f, r))})`).join(", ")}.`,
    },
    {
      text: `The middle value is ${formatValue(f, median(values))}, and values range from ${formatValue(f, sorted[0]!)} to ${formatValue(f, sorted[sorted.length - 1]!)}.`,
    },
  ];
  const gl = groupAverageLine(points, f, by);
  if (gl) out.push({ text: gl });
  if (points.some((r) => f.note?.(r))) out.push({ text: "Values marked * have a condition or approximation; hover over or focus the bar to see it." });
  return out;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlacedLabel {
  x: number;
  y: number;
  anchor: "start" | "end";
  text: string;
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * Greedy label placement: tries right, left, above, below (and two diagonals) of each point,
 * keeping the first spot that overlaps neither a point nor an earlier label and stays in bounds.
 * Labels with no free spot are dropped; the point still has its tooltip and accessible name.
 */
export function placeLabels(
  points: { cx: number; cy: number; text: string }[],
  bounds: { minX: number; maxX: number },
  pointRadius = 9,
  charWidth = 6.6,
): (PlacedLabel | null)[] {
  const placed: Box[] = points.map((p) => ({ x: p.cx - pointRadius, y: p.cy - pointRadius, w: pointRadius * 2, h: pointRadius * 2 }));
  return points.map(({ cx, cy, text }) => {
    const w = text.length * charWidth;
    const candidates: [number, number, "start" | "end"][] = [
      [cx + 12, cy + 4, "start"],
      [cx - 12, cy + 4, "end"],
      [cx - w / 2, cy - 13, "start"],
      [cx - w / 2, cy + 23, "start"],
      [cx + 12, cy + 18, "start"],
      [cx + 12, cy - 10, "start"],
    ];
    for (const [x, y, anchor] of candidates) {
      const bx = anchor === "end" ? x - w : x;
      const box = { x: bx, y: y - 11, w, h: 14 };
      if (!placed.some((p) => overlaps(box, p)) && bx > bounds.minX && bx + w < bounds.maxX) {
        placed.push(box);
        return { x, y, anchor, text };
      }
    }
    return null;
  });
}

export interface ScatterModel {
  kind: "scatter";
  fx: ChartField;
  fy: ChartField;
  points: ResearchRecord[];
  total: number;
  missing: number;
  label: (r: ResearchRecord) => string;
  best: ResearchRecord[];
  insights: Insight[];
  note: string;
}

export function scatterModel(records: ResearchRecord[], fx: ChartField, fy: ChartField, colorBy: ColorBy): ScatterModel {
  const pts = chartPoints(records, [fx, fy]);
  const missing = pts.total - pts.points.length;
  if (pts.points.length < 2) {
    return {
      kind: "scatter", fx, fy, ...pts, missing, best: [],
      insights: [{ text: `Only ${pts.points.length} of ${pts.total} materials report both ${fx.label.toLowerCase()} and ${fy.label.toLowerCase()}.` }],
      note: "",
    };
  }
  const best = paretoFront(pts.points, fx, fy);
  return {
    kind: "scatter", fx, fy, ...pts, missing, best,
    insights: scatterInsights(pts, fx, fy, best, colorBy),
    note: `${pts.points.length} of ${pts.total} plotted${missing ? `; ${missing} don’t report both values` : ""}. With this few points, treat links as hints, not trends. Anode values come from electrode tests; cycles, retention and energy density from full cells where stated.`,
  };
}

export interface RankingModel {
  kind: "rank";
  field: ChartField;
  points: ResearchRecord[];
  total: number;
  missing: number;
  label: (r: ResearchRecord) => string;
  insights: Insight[];
  note: string;
}

export function rankingModel(records: ResearchRecord[], field: ChartField, colorBy: ColorBy): RankingModel {
  const pts = chartPoints(records, [field]);
  const points = [...pts.points].sort((a, b) => val(field, b) - val(field, a));
  const missing = pts.total - points.length;
  return {
    kind: "rank", field, points, total: pts.total, missing, label: pts.label,
    insights: rankingInsights(points, field, pts.label, colorBy),
    note: points.length
      ? `${points.length} of ${pts.total} shown${missing ? `; ${missing} don’t report this value` : ""}. Select a bar to see its details and page numbers.`
      : "",
  };
}
