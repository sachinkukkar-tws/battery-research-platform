import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import styles from "./Tabs.module.css";

export interface TabItem {
  id: string;
  label: string;
  /** How many items the view holds, shown beside its label. */
  count?: number;
  content: ReactNode;
}

const KEYS: Record<string, (i: number, n: number) => number> = {
  ArrowRight: (i, n) => (i + 1) % n,
  ArrowLeft: (i, n) => (i - 1 + n) % n,
  Home: () => 0,
  End: (_, n) => n - 1,
};

/** One view at a time, chosen from a row of tabs. The arrow keys move between the tabs. */
export function Tabs({ label, items, value, onChange }: { label: string; items: TabItem[]; value: string; onChange: (id: string) => void }) {
  const base = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = items.find((t) => t.id === value) ?? items[0];

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const move = KEYS[e.key];
    if (!move) return;
    e.preventDefault();
    const next = move(i, items.length);
    onChange(items[next]!.id);
    tabs.current[next]?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label={label} className={styles.list}>
        {items.map((t, i) => {
          const selected = t.id === current?.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-${t.id}-tab`}
              aria-selected={selected}
              aria-controls={`${base}-${t.id}-panel`}
              tabIndex={selected ? 0 : -1}
              className={styles.tab}
              onClick={() => onChange(t.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              {t.label}
              {t.count !== undefined && <span className={styles.count}>{t.count}</span>}
            </button>
          );
        })}
      </div>
      {current && (
        <div role="tabpanel" id={`${base}-${current.id}-panel`} aria-labelledby={`${base}-${current.id}-tab`} tabIndex={0} className={styles.panel}>
          {current.content}
        </div>
      )}
    </div>
  );
}
