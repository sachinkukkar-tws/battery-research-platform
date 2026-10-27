import { useRef, type KeyboardEvent, type ReactNode } from "react";
import styles from "./Tabs.module.css";

export interface TabDef<T extends string> {
  id: T;
  label: ReactNode;
}

interface TabsProps<T extends string> {
  /** Shared with tabPanelProps() so tabs and panels reference each other. Use useId() in the parent. */
  idBase: string;
  label: string;
  tabs: readonly TabDef<T>[];
  active: T;
  onChange: (id: T) => void;
}

/** WAI-ARIA tabs: arrow keys, Home and End move between tabs; only the active tab is in the tab order. */
export function Tabs<T extends string>({ idBase: base, label, tabs, active, onChange }: TabsProps<T>) {
  const refs = useRef(new Map<T, HTMLButtonElement>());
  const onKeyDown = (e: KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === active);
    const n = tabs.length;
    const next = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const id = tabs[next]!.id;
    onChange(id);
    refs.current.get(id)?.focus();
  };
  return (
    <div className={styles.tabs} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((t) => (
        <button
          key={t.id}
          ref={(el) => {
            if (el) refs.current.set(t.id, el);
            else refs.current.delete(t.id);
          }}
          type="button"
          role="tab"
          id={`${base}-tab-${t.id}`}
          aria-controls={`${base}-panel-${t.id}`}
          aria-selected={t.id === active}
          tabIndex={t.id === active ? 0 : -1}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function tabPanelProps(base: string, id: string) {
  return { role: "tabpanel", id: `${base}-panel-${id}`, "aria-labelledby": `${base}-tab-${id}`, tabIndex: 0 } as const;
}

export function TabCount({ n }: { n: number }) {
  return n ? <span className={styles.count}>{n}</span> : null;
}
