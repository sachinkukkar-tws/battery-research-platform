import type { ReactNode } from "react";
import type { PaperStatus } from "@/types";
import { formulaParts } from "@/domain/chemistry";
import styles from "./Badges.module.css";

const STATUS_CLASS: Record<PaperStatus, string> = {
  Checked: styles.checked!,
  Extracted: styles.extracted!,
  Harvested: styles.harvested!,
};

export function StatusBadge({ status }: { status: PaperStatus }) {
  return <span className={`${styles.status} ${STATUS_CLASS[status] ?? ""}`}>{status}</span>;
}

export function Chip({ children }: { children: ReactNode }) {
  return <span className={styles.chip}>{children}</span>;
}

/** Renders "Na3V2(PO4)3" with proper subscripts. */
export function Formula({ value }: { value: string }) {
  return (
    <>
      {formulaParts(value).map((p, i) => (p.sub ? <sub key={i}>{p.text}</sub> : <span key={i}>{p.text}</span>))}
    </>
  );
}

/** The platform mark: two cells of a battery, used for the logo and Amplifi's avatar. */
export function Mark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <span className={`${styles.mark} ${styles[size]}`} aria-hidden="true">
      <i />
      <i />
    </span>
  );
}

export function NotReported({ children = "Not reported" }: { children?: ReactNode }) {
  return <span className={styles.notReported}>{children}</span>;
}
