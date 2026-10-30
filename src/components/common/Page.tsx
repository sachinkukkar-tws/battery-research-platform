import { useId, type ReactNode } from "react";
import styles from "./Page.module.css";

interface PanelProps {
  title?: ReactNode;
  hint?: ReactNode;
  level?: 2 | 3;
  className?: string;
  children: ReactNode;
}

/** A section of a page on its own surface, labelled by its heading. */
export function Panel({ title, hint, level = 3, className, children }: PanelProps) {
  const id = useId();
  const H = level === 2 ? "h2" : "h3";
  return (
    <section className={[styles.panel, className].filter(Boolean).join(" ")} aria-labelledby={title ? id : undefined}>
      {title && (
        <div className={styles.panelHead}>
          <H id={id} className={styles.panelTitle}>
            {title}
          </H>
          {hint && <p className={styles.hint}>{hint}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
