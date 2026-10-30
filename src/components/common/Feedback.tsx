import styles from "./Feedback.module.css";

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
