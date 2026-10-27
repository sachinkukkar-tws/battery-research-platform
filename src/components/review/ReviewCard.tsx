import { useId, useRef, useState, type FormEvent } from "react";
import type { PaperMeta, ReviewAction, ReviewItem } from "@/types";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { Chip } from "@/components/common/Badges";
import { TextInput } from "@/components/common/Controls";
import styles from "./Review.module.css";

interface ReviewCardProps {
  item: ReviewItem;
  paper?: PaperMeta;
  pending: boolean;
  onDecide: (action: ReviewAction, value?: string) => void;
  onAsk: () => void;
}

export function ReviewCard({ item, paper, pending, onDecide, onAsk }: ReviewCardProps) {
  const [correcting, setCorrecting] = useState(false);
  const [draft, setDraft] = useState(item.value);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const errorId = useId();

  const save = (e: FormEvent) => {
    e.preventDefault();
    const v = draft.trim();
    if (!v) {
      setError("Type the corrected value first.");
      inputRef.current?.focus();
      return;
    }
    setError(null);
    onDecide("correct", v);
  };

  return (
    <Card as="article" className={styles.item} aria-labelledby={titleId} aria-busy={pending}>
      <div className={styles.top}>
        <h3 className={styles.fieldName} id={titleId}>{item.field}</h3>
        <Chip>{item.paper}, page {item.page}</Chip>
      </div>
      <p className="small muted">
        {paper ? `${paper.author} et al. (${paper.year}). ` : ""}
        {item.sourceLabel}
      </p>
      <p className={styles.val}>
        <span className="visually-hidden">Extracted value: </span>
        {item.value}
      </p>
      {item.note && <p className={styles.note}>Note from testing: {item.note}</p>}
      <div className={styles.acts}>
        <Button variant="success" onClick={() => onDecide("approve")} busy={pending}>Approve</Button>
        <Button
          variant="quiet"
          aria-expanded={correcting}
          disabled={pending}
          onClick={() => {
            setCorrecting((c) => !c);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
        >
          Correct
        </Button>
        <Button variant="quiet" onClick={() => onDecide("reject")} disabled={pending}>Reject</Button>
        <Button variant="link" className="small" onClick={onAsk}>Ask Amplifi about {item.paper}</Button>
        {pending && <span className="small muted" role="status">Saving…</span>}
      </div>
      {correcting && (
        <form className={styles.fix} onSubmit={save}>
          <TextInput
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setCorrecting(false);
                setDraft(item.value);
              }
            }}
            aria-label={`Corrected value for ${item.field}`}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
          />
          <Button type="submit" busy={pending}>Save correction</Button>
          {error && <p id={errorId} className={styles.error} role="alert">{error}</p>}
        </form>
      )}
    </Card>
  );
}
