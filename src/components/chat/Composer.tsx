import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Square } from "lucide-react";
import type { ExplorerPaper } from "@/types";
import { useAutoGrow } from "@/hooks/useAutoGrow";
import styles from "./Chat.module.css";

interface ComposerProps {
  busy: boolean;
  scope: string | null;
  papers: Pick<ExplorerPaper, "id" | "firstAuthor">[];
  focusRequest: number;
  autoFocus: boolean;
  onScopeChange: (paperId: string | null) => void;
  onSend: (text: string) => void;
  onStop: () => void;
}

export function Composer({ busy, scope, papers, focusRequest, autoFocus, onScopeChange, onSend, onStop }: ComposerProps) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useAutoGrow(ref, text);

  // Focus when another screen asks for it (e.g. "Ask Amplifi about CP07"), and on first visit on desktop.
  useEffect(() => {
    if (autoFocus || focusRequest > 0) ref.current?.focus();
  }, [focusRequest, autoFocus]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) {
      onStop();
      return;
    }
    if (!text.trim()) return;
    onSend(text);
    setText("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!busy) submit();
    }
  };

  return (
    <form className={styles.composer} onSubmit={submit}>
      <textarea
        ref={ref}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask Amplifi about the papers"
        aria-label="Message Amplifi"
        aria-describedby="composer-hint"
      />
      <span id="composer-hint" className="visually-hidden">Press Enter to send, Shift and Enter for a new line.</span>
      <div className={styles.composerRow}>
        <select
          className={styles.scope}
          value={scope ?? ""}
          onChange={(e) => onScopeChange(e.target.value || null)}
          aria-label="Which papers to search"
        >
          <option value="">All papers</option>
          {papers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstAuthor ? `${p.id}, ${p.firstAuthor} et al.` : p.id}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className={`${styles.send} ${busy ? styles.stop : ""}`}
          disabled={!busy && !text.trim()}
          aria-label={busy ? "Stop the answer" : "Send"}
          title={busy ? "Stop" : "Send"}
        >
          {busy ? <Square aria-hidden="true" fill="currentColor" /> : <ArrowUp aria-hidden="true" />}
        </button>
      </div>
    </form>
  );
}
