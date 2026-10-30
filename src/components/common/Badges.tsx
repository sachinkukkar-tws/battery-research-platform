import type { ReactNode } from "react";
import { formulaParts } from "@/domain/chemistry";
import styles from "./Badges.module.css";

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
