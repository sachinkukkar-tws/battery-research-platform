import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import styles from "./Workspace.module.css";

interface StatCardProps {
  icon: LucideIcon;
  tone: "primary" | "success" | "warning" | "info";
  label: string;
  value: ReactNode;
  foot: ReactNode;
  footIcon: LucideIcon;
  /** Route to open, or a handler for in-page targets. */
  to?: string;
  onClick?: () => void;
}

export function StatCard({ icon: Icon, tone, label, value, foot, footIcon: FootIcon, to, onClick }: StatCardProps) {
  const body = (
    <>
      <span className={styles.statBody}>
        <Icon className={`${styles.statIcon} ${styles[tone]}`} aria-hidden="true" strokeWidth={1.6} />
        <span className={styles.numbers}>
          <span className={styles.statLabel}>{label}</span>
          <span className={styles.num}>{value}</span>
        </span>
      </span>
      <span className={styles.statFoot}>
        <FootIcon aria-hidden="true" />
        {foot}
      </span>
    </>
  );
  return to ? (
    <Link to={to} className={styles.stat}>
      {body}
    </Link>
  ) : (
    <button type="button" className={styles.stat} onClick={onClick}>
      {body}
    </button>
  );
}
