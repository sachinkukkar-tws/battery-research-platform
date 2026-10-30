import { checksSummary, type EvidenceCheck } from "@/domain/explorer";
import { capitalize } from "@/domain/format";
import styles from "./Evidence.module.css";

/** "4/5 checks"; opening it lists the five evidence checks, each passed or missed. */
export function ChecksBadge({ checks }: { checks: EvidenceCheck[] }) {
  const passed = checks.filter((c) => c.ok).length;
  return (
    <details className={styles.checks}>
      <summary className={passed === checks.length ? styles.checksAll : undefined} aria-label={checksSummary(checks)}>
        {passed}/{checks.length} checks
      </summary>
      <ul className={styles.checkList}>
        {checks.map((c) => (
          <li key={c.label} className={c.ok ? styles.checkOk : styles.checkMiss}>
            <span aria-hidden="true">{c.ok ? "✓" : "✗"}</span> {c.ok ? c.label : capitalize(c.miss)}
          </li>
        ))}
      </ul>
    </details>
  );
}
