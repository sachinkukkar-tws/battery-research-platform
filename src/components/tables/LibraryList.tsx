import type { LibraryPaper } from "@/types";
import { StatusBadge } from "@/components/common/Badges";
import styles from "./Tables.module.css";

export function LibraryList({ papers, onOpen }: { papers: LibraryPaper[]; onOpen: (id: string) => void }) {
  return (
    <div className={styles.frame}>
      <table className={`${styles.table} ${styles.lib}`}>
        <caption className="visually-hidden">Papers in the Library. Select a paper to see its details.</caption>
        <thead>
          <tr>
            <th scope="col" className={styles.libId}>ID</th>
            <th scope="col">Paper</th>
            <th scope="col">Collection</th>
            <th scope="col">Status</th>
            <th scope="col">Values</th>
          </tr>
        </thead>
        <tbody>
          {papers.map((p) => (
            <tr key={p.id} className={styles.clickRow}>
              <td className={`${styles.libId} muted`}>{p.id}</td>
              <td className={styles.libTitleCell}>
                <button type="button" className={styles.rowLink} onClick={() => onOpen(p.id)} title={p.title}>
                  <span className={styles.t1}>{p.title}</span>
                  <span className={styles.subline}>
                    {p.id}. {p.authors}
                    {p.year ? `, ${p.year}` : ""}. {p.type}
                    {p.isDemoUpload ? ". Demo upload" : ""}
                  </span>
                </button>
              </td>
              <td data-label="Collection" className="small muted">{p.collection}</td>
              <td className={styles.libStatus}>
                <StatusBadge status={p.status} />
              </td>
              <td data-label="Values" className="small">{p.values ?? "None yet"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
