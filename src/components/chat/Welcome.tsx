import { Mark } from "@/components/common/Badges";
import { SUGGESTED_QUESTIONS } from "@/data/chatSuggestions";
import styles from "./Chat.module.css";

export function Welcome({ onAsk, isMock }: { onAsk: (q: string) => void; isMock: boolean }) {
  return (
    <div className={styles.welcome}>
      <Mark size="lg" />
      <h2>What would you like to know?</h2>
      <p className="muted">
        Ask about the papers in the knowledge base. Every answer cites its sources.
        {isMock && " In demo mode, only the questions below have answers."}
      </p>
      <ul className={styles.suggestions} aria-label="Suggested questions">
        {SUGGESTED_QUESTIONS.map((q) => (
          <li key={q}>
            <button type="button" className={styles.suggestion} onClick={() => onAsk(q)}>
              {q}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
