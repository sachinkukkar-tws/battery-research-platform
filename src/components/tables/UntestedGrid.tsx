import { plural } from "@/domain/format";
import { isLithium, type PairGrid } from "@/domain/pairs";
import styles from "./Tables.module.css";

interface UntestedGridProps {
  grid: PairGrid;
  onSelectCell: (anode: string, cathode: string) => void;
}

export function UntestedGrid({ grid, onSelectCell }: UntestedGridProps) {
  return (
    <div className={styles.scroll}>
      <table className={`${styles.table} ${styles.grid}`}>
        <caption className="visually-hidden">Anode and cathode combinations. Tested cells are buttons; untested cells are hatched.</caption>
        <thead>
          <tr>
            <th scope="col">Anode</th>
            {grid.cathodes.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.anodes.map((a) => (
            <tr key={a.anode}>
              <th scope="row">
                {a.anode} <span className="muted">({a.paper})</span>
              </th>
              {grid.cathodes.map((c) => {
                const n = grid.count(a.anode, c);
                return (
                  <td key={c}>
                    {n ? (
                      <button
                        type="button"
                        className={isLithium(a) ? styles.cellLi : styles.cellNa}
                        onClick={() => onSelectCell(a.anode, c)}
                        aria-label={`${a.anode} with ${c}: ${n} ${plural(n, "test")}. Show in Find pairs`}
                      >
                        {n} {plural(n, "test")}
                      </button>
                    ) : (
                      <span className={styles.untested} title="Not tested in these papers">
                        <span className="visually-hidden">Not tested</span>
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
