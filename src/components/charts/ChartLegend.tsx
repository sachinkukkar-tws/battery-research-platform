import { LEGENDS, type ColorBy } from "@/domain/charts";
import styles from "./Charts.module.css";

export function ChartLegend({ colorBy, showBest }: { colorBy: ColorBy; showBest?: boolean }) {
  return (
    <ul className={styles.legend} aria-label="Legend">
      {LEGENDS[colorBy].map((l) => (
        <li key={l.label}>
          <i style={{ background: l.color }} aria-hidden="true" />
          {l.label}
        </li>
      ))}
      {showBest && (
        <li>
          <i className={styles.legendBest} aria-hidden="true" />
          Best balance (outlined)
        </li>
      )}
    </ul>
  );
}
