import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Card.module.css";

export function Card({ className, as: Tag = "section", ...rest }: HTMLAttributes<HTMLElement> & { as?: "section" | "article" | "div" }) {
  return <Tag className={[styles.card, className].filter(Boolean).join(" ")} {...rest} />;
}

interface CardHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Heading level; pages use h2 under the page's h1. */
  level?: 2 | 3;
  id?: string;
  children?: ReactNode;
}

export function CardHeader({ title, subtitle, level = 2, id, children }: CardHeaderProps) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <header className={styles.header}>
      <H className={styles.title} id={id}>
        {title}
      </H>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      {children}
    </header>
  );
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={[styles.body, className].filter(Boolean).join(" ")} {...rest} />;
}

export function CardFooter({ children }: { children: ReactNode }) {
  return (
    <footer className={styles.footer}>
      <hr />
      <div className={styles.stats}>{children}</div>
    </footer>
  );
}
