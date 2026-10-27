import styles from "./Charts.module.css";

export interface DonutPart {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  parts: DonutPart[];
  centerValue: number;
  centerLabel: string;
  title: string;
}

const R = 62;
const C = 2 * Math.PI * R;

export function DonutChart({ parts, centerValue, centerLabel, title }: DonutChartProps) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  let offset = 0;
  const summary = parts.map((p) => `${p.label} ${p.value}`).join(", ");
  return (
    <div className={styles.donutWrap}>
      <svg viewBox="0 0 170 170" role="img" aria-label={`${title}: ${summary}`} className={styles.donut}>
        {parts.map((p) => {
          const len = (p.value / total) * C;
          const seg = (
            <circle
              key={p.label}
              cx={85}
              cy={85}
              r={R}
              fill="none"
              stroke={p.color}
              strokeWidth={22}
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 85 85)"
              className={styles.donutSeg}
            />
          );
          offset += len;
          return seg;
        })}
        <text x={85} y={82} textAnchor="middle" className={styles.donutNum}>
          {centerValue}
        </text>
        <text x={85} y={104} textAnchor="middle" className={styles.donutLbl}>
          {centerLabel}
        </text>
      </svg>
      <ul className={styles.donutLegend}>
        {parts.map((p) => (
          <li key={p.label}>
            <i style={{ background: p.color }} aria-hidden="true" />
            <span>{p.label}</span>
            <strong>{p.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
