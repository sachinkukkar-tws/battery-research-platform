import type { ReactNode } from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { Button } from "./Button";
import styles from "./Feedback.module.css";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className={styles.state} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      <span>{label}…</span>
    </div>
  );
}

export function ErrorState({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <div className={`${styles.state} ${styles.error}`} role="alert">
      <AlertTriangle aria-hidden="true" />
      <strong>{title}</strong>
      <span>{message}</span>
      {onRetry && (
        <Button variant="quiet" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ children, action, icon = true }: { children: ReactNode; action?: ReactNode; icon?: boolean }) {
  return (
    <div className={styles.state}>
      {icon && <Inbox aria-hidden="true" />}
      <span>{children}</span>
      {action}
    </div>
  );
}

/** Pulsing dots for "thinking" states. */
export function Dots() {
  return (
    <span className={styles.dots} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}
