import { useCallback, useId, useMemo } from "react";
import { axisLabel } from "@/domain/chartFields";
import { buildAxis, colorOf, formatTick, formatValue, linearFit, placeLabels, type ColorBy, type ScatterModel } from "@/domain/charts";
import { ChartTooltip } from "./ChartTooltip";
import { useChartPointer } from "./useChartPointer";
import styles from "./Charts.module.css";

interface ScatterChartProps {
  model: ScatterModel;
  colorBy: ColorBy;
  showLabels?: boolean;
  showBest?: boolean;
  showTrend?: boolean;
  compact?: boolean;
  onSelect: (recordId: string) => void;
}

const SIZES = {
  full: { W: 900, H: 460, m: { l: 74, r: 30, t: 20, b: 62 }, r: 7.5 },
  compact: { W: 640, H: 300, m: { l: 52, r: 20, t: 14, b: 44 }, r: 7 },
};

export function ScatterChart({ model, colorBy, showLabels = true, showBest = true, showTrend = false, compact = false, onSelect }: ScatterChartProps) {
  const { fx, fy, points, label, best } = model;
  const { W, H, m, r: radius } = SIZES[compact ? "compact" : "full"];
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const tipId = useId();
  const titleId = useId();

  const geometry = useMemo(() => {
    if (points.length < 2) return null;
    const ax = buildAxis(fx, points.map((p) => fx.get(p) as number));
    const ay = buildAxis(fy, points.map((p) => fy.get(p) as number));
    const X = (v: number) => m.l + ax.scale(v) * iw;
    const Y = (v: number) => m.t + ih - ay.scale(v) * ih;
    const coords = points.map((p) => ({ cx: X(fx.get(p) as number), cy: Y(fy.get(p) as number), text: label(p) }));
    const labels = placeLabels(coords, { minX: m.l - 4, maxX: W });

    let trend: { x1: number; y1: number; x2: number; y2: number } | null = null;
    if (points.length >= 3) {
      const tx = (v: number) => (fx.log ? Math.log10(v) : v);
      const ty = (v: number) => (fy.log ? Math.log10(v) : v);
      const ity = (v: number) => (fy.log ? Math.pow(10, v) : v);
      const itx = (v: number) => (fx.log ? Math.pow(10, v) : v);
      const xs = points.map((p) => tx(fx.get(p) as number));
      const ys = points.map((p) => ty(fy.get(p) as number));
      const { slope, intercept } = linearFit(xs, ys);
      const x0 = Math.min(...xs);
      const x1 = Math.max(...xs);
      const clampY = (v: number) => Math.max(m.t, Math.min(m.t + ih, v));
      trend = {
        x1: X(itx(x0)), y1: clampY(Y(ity(slope * x0 + intercept))),
        x2: X(itx(x1)), y2: clampY(Y(ity(slope * x1 + intercept))),
      };
    }
    return { ax, ay, X, Y, coords, labels, trend };
  }, [points, fx, fy, label, m.l, m.t, iw, ih, W]);

  const select = useCallback((i: number) => onSelect(points[i]!.id), [onSelect, points]);
  const { active, markProps } = useChartPointer(select);

  const title = `${fy.label} against ${fx.label}`;

  if (!geometry) {
    return (
      <div className={styles.empty} role="status">
        Fewer than two materials report both of these values. Try another pair of values.
      </div>
    );
  }

  const { ax, ay, X, Y, coords, labels, trend } = geometry;
  const activePoint = active != null ? points[active] : undefined;
  const activeCoord = active != null ? coords[active] : undefined;

  return (
    <div className={`${styles.plot} ${compact ? styles.scrollableCompact : styles.scrollable}`}>
      <div className={styles.canvas}>
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-labelledby={titleId} className={styles.svg}>
        <title id={titleId}>{title}</title>
        <g aria-hidden="true">
          {ax.ticks.map((v) => (
            <line key={`gx${v}`} className={styles.gridline} x1={X(v)} x2={X(v)} y1={m.t} y2={m.t + ih} />
          ))}
          {ay.ticks.map((v) => (
            <line key={`gy${v}`} className={styles.gridline} x1={m.l} x2={m.l + iw} y1={Y(v)} y2={Y(v)} />
          ))}
          <g className={styles.axis}>
            {!compact && (
              <>
                <line x1={m.l} x2={m.l + iw} y1={m.t + ih} y2={m.t + ih} />
                <line x1={m.l} x2={m.l} y1={m.t} y2={m.t + ih} />
              </>
            )}
            {ax.ticks.map((v) => (
              <text key={`tx${v}`} x={X(v)} y={m.t + ih + (compact ? 18 : 20)} textAnchor="middle">
                {formatTick(fx, v)}
              </text>
            ))}
            {ay.ticks.map((v) => (
              <text key={`ty${v}`} x={m.l - (compact ? 8 : 10)} y={Y(v) + 4} textAnchor="end">
                {formatTick(fy, v)}
                {compact && fy.unit === "%" ? "%" : ""}
              </text>
            ))}
            <text x={m.l + iw / 2} y={H - (compact ? 6 : 14)} textAnchor="middle" className={styles.axisTitle}>
              {axisLabel(fx)}
              {fx.log ? ", log scale" : ""}
            </text>
            {!compact && (
              <text transform={`translate(18 ${m.t + ih / 2}) rotate(-90)`} textAnchor="middle" className={styles.axisTitle}>
                {axisLabel(fy)}
                {fy.log ? ", log scale" : ""}
              </text>
            )}
          </g>
          {showTrend && trend && <line className={styles.trend} {...trend} />}
        </g>
        {points.map((p, i) => {
          const c = coords[i]!;
          const isBest = showBest && best.includes(p);
          const name = `${label(p)}: ${formatValue(fx, fx.get(p) as number)}, ${formatValue(fy, fy.get(p) as number)}${isBest ? ". Best balance" : ""}`;
          return (
            <circle
              key={p.id}
              className={`${styles.pt} ${isBest ? styles.best : ""}`}
              cx={c.cx}
              cy={c.cy}
              r={active === i ? radius + 2 : radius}
              fill={colorOf(p, colorBy)}
              {...markProps(i, name, tipId)}
            />
          );
        })}
        {showLabels && (
          <g aria-hidden="true">
            {labels.map(
              (l, i) =>
                l && (
                  <text key={points[i]!.id} className={styles.ptLabel} x={l.x} y={l.y} textAnchor={l.anchor}>
                    {l.text}
                  </text>
                ),
            )}
          </g>
        )}
      </svg>
      {activePoint && activeCoord && (
        <ChartTooltip id={tipId} record={activePoint} label={label(activePoint)} fields={[fx, fy]} left={activeCoord.cx / W} top={activeCoord.cy / H} />
      )}
      </div>
    </div>
  );
}
