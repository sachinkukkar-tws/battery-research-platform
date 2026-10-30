import { useId, type KeyboardEvent } from "react";
import { Trash2, X } from "lucide-react";
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

interface ChatHistoryProps {
  id: string;
  /** On a narrow screen the list slides in over the chat; on a wide one it's always shown. */
  open: boolean;
  chats: ChatSession[];
  currentId: string | null;
  onOpen: (chatId: string) => void;
  onDelete: (chatId: string) => void;
  onClose: () => void;
}

/** The chats kept in this browser, the most recent first. Opening one shows it again, and follow-up questions continue it. */
export function ChatHistory({ id, open, chats, currentId, onOpen, onDelete, onClose }: ChatHistoryProps) {
  const titleId = useId();
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && open) onClose();
  };
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
      {chats.length ? (
        <ul className={styles.historyList}>
          {chats.map((c) => {
            const scope = c.messages.find((m) => m.role === "user")?.scope;
            return (
              <li key={c.id} className={styles.historyItem}>
                <button type="button" className={styles.chatButton} aria-current={c.id === currentId ? "page" : undefined} onClick={() => onOpen(c.id)}>
                  <span className={styles.chatTitle}>{c.title}</span>
                  <span className={styles.chatMeta}>
                    {when(c.updatedAt)}
                    {scope ? ` · ${scope}` : ""}
                  </span>
                </button>
                <IconButton label={`Delete the chat “${c.title}”`} variant="plain" className={styles.chatDelete} onClick={() => onDelete(c.id)}>
                  <Trash2 aria-hidden="true" />
                </IconButton>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.historyEmpty}>Your chats appear here.</p>
      )}
    </nav>
  );
}
