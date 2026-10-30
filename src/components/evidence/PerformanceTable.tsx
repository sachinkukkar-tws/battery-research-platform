import { METRIC_LABEL, conditionToShow, formatUnits } from "@/domain/explorer";
import type { ExtractedValue } from "@/types";
import { ValueButton, valueSource } from "./ValueButton";
import styles from "./Evidence.module.css";

const sourceKey = (v: ExtractedValue) => `${v.paper}|${v.page}|${v.quote}|${v.value}`;

/** How many rows from `i` on share row i's metric. */
const runLength = (rows: ExtractedValue[], i: number) => {
  const end = rows.findIndex((r, j) => j > i && r.metric !== rows[i]!.metric);
  return (end === -1 ? rows.length : end) - i;
};

/**
 * Reported values, half-cell (anode) and full-cell results apart, each metric named once.
 * Values arrive sorted by metric. Each value opens its sentence and PDF page.
 */
export function PerformanceTable({ values, showPaper = true }: { values: ExtractedValue[]; showPaper?: boolean }) {
  if (!values.length) return <p className={styles.empty}>No checked values.</p>;
  return (
    <div className={styles.tableFrame}>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Metric</th>
              <th scope="col">Value</th>
              <th scope="col">{showPaper ? "Anode sample, paper" : "Anode sample"}</th>
            </tr>
          </thead>
          {(["half cell", "full cell"] as const).map((test) => {
            const rows = values.filter((v) => v.testType === test);
            return rows.length ? (
              <tbody key={test}>
                <tr className={styles.group}>
                  <th scope="colgroup" colSpan={3}>
                    {test === "half cell" ? "Half cell" : "Full cell"}
                  </th>
                </tr>
                {rows.map((v, i) => {
                  const condition = conditionToShow(v);
                  const first = i === 0 || rows[i - 1]!.metric !== v.metric;
                  return (
                    <tr key={sourceKey(v)} className={first ? undefined : styles.sameMetric}>
                      {first && (
                        <th scope="rowgroup" rowSpan={runLength(rows, i)}>
                          {METRIC_LABEL[v.metric]}
                        </th>
                      )}
                      <td>
                        <ValueButton source={valueSource(v)} />
                        {condition && <span className={styles.condition}>{formatUnits(condition)}</span>}
                      </td>
                      <td>
                        {v.sample}
                        {showPaper && <span className={styles.paperTag}>{v.paper}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            ) : null;
          })}
        </table>
      </div>
    </div>
  );
}
