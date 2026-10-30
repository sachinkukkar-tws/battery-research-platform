import { memo } from "react";
import { Copy, FileText, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import type { ChatMessage } from "@/types";
import { IconButton } from "@/components/common/Button";
import { Dots } from "@/components/common/Feedback";
import { Mark } from "@/components/common/Badges";
import { CitedText } from "./CitedText";
import styles from "./Chat.module.css";

interface AssistantMessageProps {
  message: ChatMessage;
  canRegenerate: boolean;
  onCite: (paperId: string) => void;
  onCopy: (text: string) => void;
  onRegenerate: (id: string) => void;
  onFeedback: (id: string, v: "up" | "down" | null) => void;
}

export const AssistantMessage = memo(function AssistantMessage({ message: m, canRegenerate, onCite, onCopy, onRegenerate, onFeedback }: AssistantMessageProps) {
  const done = m.status === "complete" || m.status === "stopped" || m.status === "error";
  return (
    <div className={styles.ai}>
      <Mark size="sm" />
      <div className={styles.body}>
        <div className={styles.name}>
          Amplifi
          {m.scope && <span className={styles.scopeTag}>Searching {m.scope} only</span>}
        </div>
        {m.status === "pending" && (
          <p className={styles.thinking} role="status">
            Searching the papers
            <Dots />
          </p>
        )}
        {m.status === "error" && (
          <p className={styles.error} role="alert">
            Amplifi couldn’t answer. {m.error}
          </p>
        )}
        {(m.status === "streaming" || m.status === "complete" || m.status === "stopped") && m.text && (
          <div className={styles.text}>
            <CitedText text={m.text} onCite={onCite} />
            {m.status === "streaming" && <span className={styles.caret} aria-hidden="true" />}
          </div>
        )}
        {m.status === "stopped" && (
          <p className="muted small">{m.text ? "Stopped before the answer finished." : "Stopped before the answer arrived."}</p>
        )}
        {m.status === "complete" && m.citations.length > 0 && (
          <div className={styles.sources}>
            <span className="visually-hidden">Sources:</span>
            {m.citations.map((c) => (
              <button key={`${c.paperId}-${c.page}`} type="button" className={styles.source} onClick={() => onCite(c.paperId)}>
                <FileText aria-hidden="true" />
                {c.paperId}
                {c.page ? `, page ${c.page}` : ""}
              </button>
            ))}
          </div>
        )}
        {done && (
          <div className={styles.actions}>
            {m.text && (
              <IconButton variant="plain" label="Copy answer" onClick={() => onCopy(m.text)}>
                <Copy aria-hidden="true" />
              </IconButton>
            )}
            <IconButton variant="plain" label="Ask again" onClick={() => onRegenerate(m.id)} disabled={!canRegenerate}>
              <RotateCcw aria-hidden="true" />
            </IconButton>
            {m.status === "complete" && (
              <>
                <IconButton variant="plain" label="Good answer" pressed={m.feedback === "up"} onClick={() => onFeedback(m.id, m.feedback === "up" ? null : "up")}>
                  <ThumbsUp aria-hidden="true" />
                </IconButton>
                <IconButton variant="plain" label="Poor answer" pressed={m.feedback === "down"} onClick={() => onFeedback(m.id, m.feedback === "down" ? null : "down")}>
                  <ThumbsDown aria-hidden="true" />
                </IconButton>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
