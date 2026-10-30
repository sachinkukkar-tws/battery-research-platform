import { Mark } from "@/components/common/Badges";
import styles from "./Chat.module.css";

export function Welcome({ onAsk, questions }: { onAsk: (q: string) => void; questions: string[] }) {
  return (
    <div className={styles.welcome}>
      <Mark size="lg" />
      <h2>What would you like to know?</h2>
      <p className="muted">Ask about the client papers. Amplifi answers from them, with citations you can open.</p>
      {questions.length > 0 && (
        <ul className={styles.suggestions} aria-label="Suggested questions">
          {questions.map((q) => (
            <li key={q}>
              <button type="button" className={styles.suggestion} onClick={() => onAsk(q)}>
                {q}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
