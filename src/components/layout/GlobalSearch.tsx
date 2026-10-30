import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { searchExplorer, type SearchResult } from "@/domain/search";
import { useExplorerData } from "@/state/ExplorerDataContext";
import styles from "./GlobalSearch.module.css";

/** Header search over materials, samples, papers and DOIs. "/" focuses it from anywhere. */
export function GlobalSearch() {
  const navigate = useNavigate();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const { data } = useExplorerData();
  const results = useMemo(() => (data ? searchExplorer(data, query) : []), [data, query]);
  const showList = open && query.trim().length >= 2;

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (r: SearchResult) => {
    navigate(r.to);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (results.length) setActive((i) => (i + (e.key === "ArrowDown" ? 1 : results.length - 1)) % results.length);
    } else if (e.key === "Enter" && showList && results[active]) {
      e.preventDefault();
      go(results[active]);
    } else if (e.key === "Escape") {
      if (showList) setOpen(false);
      else setQuery("");
    }
  };

  return (
    <div className={styles.search} role="search">
      <Search className={styles.icon} aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label="Search a material, paper or DOI"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
        placeholder="Search a material, paper or DOI"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      <kbd className={styles.key} aria-hidden="true">
        /
      </kbd>
      {showList && (
        <ul id={listId} role="listbox" className={styles.results} aria-label="Search results">
          {results.length ? (
            results.map((r, i) => (
              <li
                key={r.kind + r.label}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={styles.result}
                // mousedown, not click, so the input's blur doesn't close the list first
                onMouseDown={(e) => {
                  e.preventDefault();
                  go(r);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span className={styles.kind}>{r.kind}</span>
                <span className={styles.text}>
                  <span className={styles.label}>{r.label}</span>
                  <span className={styles.detail}>{r.detail}</span>
                </span>
              </li>
            ))
          ) : (
            <li role="option" aria-selected={false} aria-disabled="true" className={styles.none}>
              {data ? `Nothing matches “${query.trim()}”` : "Amplifi’s data isn’t loaded yet"}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
