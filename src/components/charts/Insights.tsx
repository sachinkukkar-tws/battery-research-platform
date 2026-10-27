import type { Insight } from "@/domain/charts";
import styles from "./Charts.module.css";

export function Insights({ items, note }: { items: Insight[]; note: string }) {
  return (
    <section className={styles.insights} aria-live="polite" aria-label="What this shows">
      <h3>What this shows</h3>
      <ul>
        {items.map((it, i) => (
          <li key={i} className={it.key ? styles.key : undefined}>
            {it.lead && <strong>{it.lead} </strong>}
            {it.text}
          </li>
        ))}
      </ul>
      {note && <p className={styles.caveat}>{note}</p>}
    </section>
  );
}
