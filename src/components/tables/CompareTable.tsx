import type { ReactNode } from "react";
import type { ResearchRecord } from "@/types";
import { pairName } from "@/domain/pairs";
import { Formula, NotReported } from "@/components/common/Badges";
import styles from "./Tables.module.css";

const ROWS: { label: string; render: (r: ResearchRecord) => ReactNode }[] = [
  { label: "Battery type", render: (r) => r.battery },
  { label: "Anode made from", render: (r) => r.anodeFrom },
  { label: "Anode test", render: (r) => r.anodeTest ?? <NotReported>Not in table</NotReported> },
  {
    label: "Cathode",
    render: (r) =>
      r.cathode ? (
        <>
          {r.cathode}
          {r.cathodeFormula && r.cathodeFormula !== r.cathode && (
            <>
              {" "}
              (<Formula value={r.cathodeFormula} />)
            </>
          )}
        </>
      ) : (
        <NotReported>No full cell</NotReported>
      ),
  },
  { label: "Cell", render: (r) => r.cell },
  { label: "Result", render: (r) => r.result ?? <NotReported>Not in table</NotReported> },
  { label: "Cycling", render: (r) => r.cycling ?? <NotReported>Not in table</NotReported> },
  {
    label: "Energy density",
    render: (r) => (r.energy != null ? `${r.energyText ?? r.energy} Wh/kg (${r.energyBasis ?? "basis not stated"})` : <NotReported />),
  },
  { label: "Source", render: (r) => `${r.paper}, page ${r.page}${r.checked ? "" : " (not yet checked by hand)"}` },
];

export function CompareTable({ records }: { records: ResearchRecord[] }) {
  return (
    <div className={styles.scroll}>
      <table className={`${styles.table} ${styles.compare}`}>
        <caption className="visually-hidden">Side-by-side comparison of the selected pairs</caption>
        <thead>
          <tr>
            <td />
            {records.map((r) => (
              <th key={r.id} scope="col">
                {pairName(r)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              {records.map((r) => (
                <td key={r.id}>{row.render(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
