import { useCallback, useId } from "react";
import { colorOf, formatValue, type ColorBy, type RankingModel } from "@/domain/charts";
import { ChartTooltip } from "./ChartTooltip";
import { useChartPointer } from "./useChartPointer";
import styles from "./Charts.module.css";

interface RankingChartProps {
  model: RankingModel;
  colorBy: ColorBy;
  onSelect: (recordId: string) => void;
}

const W = 900;
const ROW = 34;
const M = { l: 230, r: 120, t: 16, b: 16 };
const MAX_LABEL = 32;

const truncate = (s: string) => (s.length > MAX_LABEL ? `${s.slice(0, MAX_LABEL - 1)}…` : s);

export function RankingChart({ model, colorBy, onSelect }: RankingChartProps) {
  const { field, points, label } = model;
  const tipId = useId();
  const titleId = useId();
  const select = useCallback((i: number) => onSelect(points[i]!.id), [onSelect, points]);
  const { active, markProps } = useChartPointer(select);

  if (!points.length) {
    return (
      <div className={styles.empty} role="status">
        No material reports this value yet.
      </div>
    );
  }

  const H = M.t + M.b + points.length * ROW;
  const iw = W - M.l - M.r;
  const max = Math.max(...points.map((p) => field.get(p) as number)) * 1.05;
  const activePoint = active != null ? points[active] : undefined;

  return (
    <div className={`${styles.plot} ${styles.scrollable}`}>
      <div className={styles.canvas}>
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-labelledby={titleId} className={styles.svg}>
        <title id={titleId}>Materials ranked by {field.label.toLowerCase()}</title>
        {points.map((p, i) => {
          const v = field.get(p) as number;
          const y = M.t + i * ROW;
          const w = Math.max(3, (v / max) * iw);
          const name = label(p);
          const hasNote = !!field.note?.(p);
          return (
            <g key={p.id}>
              <text className={styles.barName} x={M.l - 12} y={y + ROW / 2 + 4} textAnchor="end" aria-hidden="true">
                {truncate(name)}
                {name.length > MAX_LABEL && <title>{name}</title>}
              </text>
              <rect
                className={styles.bar}
                x={M.l}
                y={y + 7}
                width={w}
                height={ROW - 14}
                rx={4}
                fill={colorOf(p, colorBy)}
                {...markProps(i, `${name}: ${formatValue(field, v)}${hasNote ? `, ${field.note!(p)}` : ""}`, tipId)}
              />
              <text className={styles.barVal} x={M.l + w + 8} y={y + ROW / 2 + 4} aria-hidden="true">
                {formatValue(field, v)}
                {hasNote ? " *" : ""}
              </text>
            </g>
          );
        })}
      </svg>
      {activePoint && active != null && (
        <ChartTooltip
          id={tipId}
          record={activePoint}
          label={label(activePoint)}
          fields={[field]}
          left={Math.min(M.l + ((field.get(activePoint) as number) / max) * iw, W - 300) / W}
          top={(M.t + active * ROW + 6) / H}
        />
      )}
      </div>
    </div>
  );
}
