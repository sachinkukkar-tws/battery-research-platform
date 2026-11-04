import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Archive, ArchiveRestore, ChevronDown, MoreHorizontal, Pencil, Pin, PinOff, Trash2, X } from "lucide-react";
import { IconButton } from "@/components/common/Button";
import type { ChatSession } from "@/types";
import styles from "./Chat.module.css";

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** "Today, 10:42", "Yesterday, 18:05" or "29 Oct, 10:42", in the reader's time zone. */
function when(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return `Today, ${time}`;
  if (sameDay(d, yesterday)) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, ${time}`;
}

interface ChatActions {
  onOpen: (chatId: string) => void;
  onDelete: (chatId: string) => void;
  onRename: (chatId: string, title: string) => void;
  onPin: (chatId: string, pinned: boolean) => void;
  onArchive: (chatId: string, archived: boolean) => void;
}

interface ChatHistoryProps extends ChatActions {
  id: string;
  /** On a narrow screen the list slides in over the chat; on a wide one it's always shown. */
  open: boolean;
  chats: ChatSession[];
  currentId: string | null;
  onClose: () => void;
}

/**
 * The chats kept in this browser: pinned ones first, then the rest, the most recent first, and archived ones
 * folded away at the end. Opening one shows it again, and follow-up questions continue it.
 */
export function ChatHistory({ id, open, chats, currentId, onClose, ...actions }: ChatHistoryProps) {
  const titleId = useId();
  const archivedId = useId();
  const [showArchived, setShowArchived] = useState(false);
  const pinned = chats.filter((c) => c.pinned && !c.archived);
  const recent = chats.filter((c) => !c.pinned && !c.archived);
  const archived = chats.filter((c) => c.archived);
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && open && !e.defaultPrevented) onClose();
  };
  const list = (items: ChatSession[], label?: string) => (
    <ul className={styles.historyList} aria-label={label}>
      {items.map((c) => (
        <ChatRow key={c.id} chat={c} current={c.id === currentId} {...actions} />
      ))}
    </ul>
  );
  return (
    <nav id={id} aria-labelledby={titleId} className={`${styles.history} ${open ? styles.historyOpen : ""}`} onKeyDown={onKeyDown}>
      <div className={styles.historyHead}>
        <h2 className={styles.historyTitle} id={titleId}>
          Previous chats
        </h2>
        <IconButton label="Close the chat list" variant="plain" className={styles.historyClose} onClick={onClose}>
          <X aria-hidden="true" />
        </IconButton>
      </div>
      {pinned.length > 0 && (
        <>
          <h3 className={styles.historyGroup}>Pinned</h3>
          {list(pinned, "Pinned chats")}
          {recent.length > 0 && <h3 className={styles.historyGroup}>Recent</h3>}
        </>
      )}
      {recent.length > 0 && list(recent)}
      {!pinned.length && !recent.length && <p className={styles.historyEmpty}>Your chats appear here.</p>}
      {archived.length > 0 && (
        <>
          <button
            type="button"
            className={styles.archivedToggle}
            aria-expanded={showArchived}
            aria-controls={archivedId}
            onClick={() => setShowArchived((s) => !s)}
          >
            <ChevronDown aria-hidden="true" className={showArchived ? styles.chevronOpen : undefined} />
            Archived ({archived.length})
          </button>
          <div id={archivedId} hidden={!showArchived}>
            {list(archived, "Archived chats")}
          </div>
        </>
      )}
    </nav>
  );
}

function ChatRow({ chat: c, current, onOpen, onDelete, onRename, onPin, onArchive }: { chat: ChatSession; current: boolean } & ChatActions) {
  const menuId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const rowRef = useRef<HTMLLIElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const scope = c.messages.find((m) => m.role === "user")?.scope;

  // The menu closes on a click outside it; opening it puts focus on its first item.
  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const away = (e: PointerEvent) => {
      if (!rowRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [menuOpen]);

  const closeMenu = () => {
    setMenuOpen(false);
    menuButtonRef.current?.focus();
  };

  const onMenuKey = (e: KeyboardEvent) => {
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
    } else if (e.key === "Tab") {
      setMenuOpen(false);
    }
  };

  const act = (fn: () => void) => () => {
    setMenuOpen(false);
    fn();
  };

  return (
    <li ref={rowRef} className={styles.historyItem}>
      {renaming ? (
        <RenameField
          title={c.title}
          onDone={(title) => {
            if (title !== null) onRename(c.id, title);
            setRenaming(false);
            requestAnimationFrame(() => menuButtonRef.current?.focus());
          }}
        />
      ) : (
        <button type="button" className={styles.chatButton} aria-current={current ? "page" : undefined} onClick={() => onOpen(c.id)}>
          <span className={styles.chatTitle}>{c.title}</span>
          <span className={styles.chatMeta}>
            {when(c.updatedAt)}
            {scope ? ` · ${scope}` : ""}
          </span>
        </button>
      )}
      <IconButton
        ref={menuButtonRef}
        label={`Options for the chat “${c.title}”`}
        variant="plain"
        className={`${styles.chatMenuButton} ${menuOpen ? styles.chatMenuButtonOpen : ""}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? menuId : undefined}
        onClick={() => setMenuOpen((o) => !o)}
      >
        <MoreHorizontal aria-hidden="true" />
      </IconButton>
      {menuOpen && (
        <div ref={menuRef} id={menuId} role="menu" aria-label={`Options for the chat “${c.title}”`} className={styles.chatMenu} onKeyDown={onMenuKey}>
          <button type="button" role="menuitem" tabIndex={-1} className={styles.chatMenuItem} onClick={act(() => setRenaming(true))}>
            <Pencil aria-hidden="true" /> Rename
          </button>
          {!c.archived && (
            <button type="button" role="menuitem" tabIndex={-1} className={styles.chatMenuItem} onClick={act(() => onPin(c.id, !c.pinned))}>
              {c.pinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />} {c.pinned ? "Unpin" : "Pin"}
            </button>
          )}
          <button type="button" role="menuitem" tabIndex={-1} className={styles.chatMenuItem} onClick={act(() => onArchive(c.id, !c.archived))}>
            {c.archived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />} {c.archived ? "Unarchive" : "Archive"}
          </button>
          <button type="button" role="menuitem" tabIndex={-1} className={`${styles.chatMenuItem} ${styles.chatMenuDanger}`} onClick={act(() => onDelete(c.id))}>
            <Trash2 aria-hidden="true" /> Delete
          </button>
        </div>
      )}
    </li>
  );
}

/** Edits a chat's title in place: Enter or leaving the field saves it, Escape keeps the old one. */
function RenameField({ title, onDone }: { title: string; onDone: (title: string | null) => void }) {
  const [value, setValue] = useState(title);
  const done = useRef(false);
  const finish = (next: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(next);
  };
  return (
    <input
      className={styles.renameInput}
      aria-label="Chat name"
      value={value}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish(value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") finish(value);
        if (e.key === "Escape") {
          e.preventDefault();
          finish(null);
        }
      }}
    />
  );
}
