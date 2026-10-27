import type { ResearchRecord } from "@/types";
import { formatCount } from "@/domain/format";
import { isLithium, pairName } from "@/domain/pairs";
import { NotReported } from "@/components/common/Badges";
import styles from "./Tables.module.css";

interface PairListProps {
  records: ResearchRecord[];
  picked: string[];
  onOpen: (recordId: string) => void;
  onTogglePick: (recordId: string) => void;
}

/**
 * Tested anode–cathode pairs. Rendered as a real table for screen readers;
 * on narrow screens CSS restacks each row into a card.
 */
export function PairList({ records, picked, onOpen, onTogglePick }: PairListProps) {
  return (
    <div className={styles.frame}>
      <table className={`${styles.table} ${styles.pairs}`}>
        <caption className="visually-hidden">Tested pairs. Select a pair to see its details.</caption>
        <thead>
          <tr>
            <th scope="col">Anode and cathode</th>
            <th scope="col">Cell</th>
            <th scope="col">Cycles</th>
            <th scope="col">Energy density</th>
            <th scope="col">Source</th>
            <th scope="col">
              <span className="visually-hidden">Compare</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => {
            const isPicked = picked.includes(r.id);
            return (
              <tr key={r.id} className={styles.clickRow}>
                <td>
                  <button type="button" className={styles.rowLink} onClick={() => onOpen(r.id)}>
                    <span className={styles.pair}>
                      {r.anode}
                      <span className={`${styles.wire} ${!r.cathode ? styles.wireNone : isLithium(r) ? styles.wireLi : ""}`} aria-hidden="true" />
                      {r.cathode ?? <span className="muted">No full cell</span>}
                    </span>
                    <span className={styles.subline}>
                      {r.battery}, anode from {r.anodeFrom.toLowerCase()}
                    </span>
                  </button>
                </td>
                <td data-label="Cell">{r.cell}</td>
                <td data-label="Cycles">
                  {r.cycles != null ? (
                    <>
                      {formatCount(r.cycles)} <span className="muted">cycles</span>
                    </>
                  ) : (
                    <NotReported />
                  )}
                </td>
                <td data-label="Energy density">
                  {r.energy != null ? (
                    <>
                      {r.energyText ?? r.energy} <span className="muted">Wh/kg</span>
                    </>
                  ) : (
                    <NotReported />
                  )}
                </td>
                <td data-label="Source">
                  {r.paper}, p. {r.page}
                  {!r.checked && <span className={styles.flag}>Not yet checked</span>}
                </td>
                <td className={styles.pickCell}>
                  <button
                    type="button"
                    className={styles.pick}
                    aria-pressed={isPicked}
                    disabled={!r.cathode}
                    onClick={() => onTogglePick(r.id)}
                    aria-label={`${isPicked ? "Remove" : "Add"} ${pairName(r)} ${isPicked ? "from" : "to"} the comparison`}
                    title={r.cathode ? undefined : "Only full cells can be compared"}
                  >
                    {isPicked ? "Added" : "Compare"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
