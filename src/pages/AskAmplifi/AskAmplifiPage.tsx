import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, History } from "lucide-react";
import { Button } from "@/components/common/Button";
import { AssistantMessage } from "@/components/chat/AssistantMessage";
import { ChatHistory } from "@/components/chat/ChatHistory";
import { Composer } from "@/components/chat/Composer";
import { Welcome } from "@/components/chat/Welcome";
import { suggestQuestions } from "@/domain/explorer";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { canAskAbout } from "@/services/config";
import { useChat } from "@/state/ChatContext";
import { useDetailDialog } from "@/state/DetailDialogContext";
import { useExplorerData } from "@/state/ExplorerDataContext";
import { useServices } from "@/state/ServicesContext";
import { useToast } from "@/state/ToastContext";
import styles from "@/components/chat/Chat.module.css";

const NEAR_BOTTOM_PX = 160;

export function AskAmplifiPage() {
  const chat = useChat();
  const { openPaper } = useDetailDialog();
  const { data } = useExplorerData();
  const papers = useMemo(() => Object.values(data?.papers ?? {}).sort((x, y) => x.id.localeCompare(y.id)), [data]);
  const questions = useMemo(() => suggestQuestions(data), [data]);
  const { config } = useServices();
  const { showToast } = useToast();
  const desktop = useMediaQuery("(min-width: 992px)");
  const scrollRef = useRef<HTMLDivElement>(null);
  const historyId = useId();
  const [pinned, setPinned] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);

  const messages = chat.messages;

  // Follow the answer as it streams, unless the person has scrolled up to read.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && pinned) el.scrollTop = el.scrollHeight;
  }, [messages, pinned]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX);
  };

  const send = useCallback(
    (q: string) => {
      setPinned(true);
      chat.send(q);
    },
    [chat],
  );

  const openChat = (chatId: string) => {
    setPinned(true);
    chat.openChat(chatId);
    setHistoryOpen(false);
  };

  const newChat = () => {
    setPinned(true);
    chat.newChat();
    setHistoryOpen(false);
  };

  const copy = useCallback(
    (text: string) => {
      if (!navigator.clipboard?.writeText) {
        showToast("Copying isn’t available in this browser. Select the text instead.", "error");
        return;
      }
      navigator.clipboard.writeText(text).then(
        () => showToast("Copied to the clipboard."),
        () => showToast("Couldn’t copy. Select the text instead.", "error"),
      );
    },
    [showToast],
  );

  const feedback = useCallback(
    (id: string, v: "up" | "down" | null) => {
      chat.setFeedback(id, v);
      if (v) showToast("Thanks. Your rating is saved with this chat.");
    },
    [chat, showToast],
  );

  return (
    <div className={styles.layout}>
      <ChatHistory
        id={historyId}
        open={historyOpen}
        chats={chat.chats}
        currentId={chat.currentId}
        onOpen={openChat}
        onDelete={chat.deleteChat}
        onClose={() => setHistoryOpen(false)}
      />
      <div className={styles.page}>
        <h1 className="visually-hidden">Ask Amplifi</h1>
        <div className={styles.toolbar}>
          <Button
            variant="quiet"
            className={styles.historyToggle}
            aria-expanded={historyOpen}
            aria-controls={historyId}
            onClick={() => setHistoryOpen((open) => !open)}
          >
            <History aria-hidden="true" /> Chats
          </Button>
          <Button variant="quiet" onClick={newChat} disabled={!messages.length}>
            New chat
          </Button>
        </div>
        <div className={styles.scroll} ref={scrollRef} onScroll={onScroll}>
          <div className={styles.col}>
            {messages.length === 0 ? (
              <Welcome onAsk={send} questions={questions} />
            ) : (
              <ol className={styles.thread} aria-label="Conversation" aria-live="polite" aria-busy={chat.isBusy}>
                {messages.map((m, i) => (
                  <li key={m.id}>
                    {m.role === "user" ? (
                      <div className={styles.user}>
                        <span className="visually-hidden">You asked: </span>
                        <div className={styles.bubble}>{m.text}</div>
                      </div>
                    ) : (
                      <AssistantMessage
                        message={m}
                        canRegenerate={!chat.isBusy && i > 0}
                        onCite={openPaper}
                        onCopy={copy}
                        onRegenerate={chat.regenerate}
                        onFeedback={feedback}
                      />
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
        <div className={styles.composerWrap}>
          {!pinned && (
            <button
              type="button"
              className={styles.toBottom}
              aria-label="Scroll to the latest message"
              onClick={() => {
                scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
                setPinned(true);
              }}
            >
              <ArrowDown aria-hidden="true" />
            </button>
          )}
          <Composer
            busy={chat.isBusy}
            scope={chat.scope}
            papers={papers.filter((p) => canAskAbout(config, p.id))}
            focusRequest={chat.focusRequest}
            autoFocus={desktop}
            onScopeChange={chat.setScope}
            onSend={send}
            onStop={chat.stop}
          />
          <p className={styles.disclaimer}>Amplifi answers from the papers and cites its sources. Check important values against the paper.</p>
        </div>
      </div>
    </div>
  );
}
