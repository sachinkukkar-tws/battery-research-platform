import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import type { AnswerOrigin, ChatMessage } from "@/types";
import { describeError, isAbort } from "@/services";
import { uid } from "@/domain/format";
import { useServices } from "./ServicesContext";
import { chatReducer, historyFor, loadThread, saveThread } from "./chatReducer";

interface ChatApi {
  messages: ChatMessage[];
  isBusy: boolean;
  /** Paper the next question is limited to, or null for all papers. */
  scope: string | null;
  setScope: (paperId: string | null) => void;
  send: (question: string, scopeOverride?: string | null) => void;
  stop: () => void;
  /** Asks the question behind an answer again, replacing that answer. */
  regenerate: (assistantId: string) => void;
  newChat: () => void;
  setFeedback: (messageId: string, feedback: "up" | "down" | null) => void;
  /** Increments whenever another screen asks for the composer to take focus. */
  focusRequest: number;
  requestComposerFocus: () => void;
}

const ChatContext = createContext<ChatApi | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { amplifi } = useServices();
  const [initial] = useState(loadThread);
  const [messages, dispatch] = useReducer(chatReducer, initial.messages);
  const [conversationId, setConversationId] = useState<string | null>(initial.conversationId);
  const [scope, setScope] = useState<string | null>(null);
  const [isBusy, setBusy] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);

  // Keep the thread for this browser tab, so a refresh doesn't lose the conversation.
  useEffect(() => saveThread(messages, conversationId), [messages, conversationId]);

  // Cancel any in-flight request if the provider unmounts.
  useEffect(() => () => controllerRef.current?.abort(), []);

  const expectedOrigin: AnswerOrigin = "amplifi";

  const send = useCallback(
    async (raw: string, scopeOverride?: string | null) => {
      const question = raw.trim();
      if (!question || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      const askScope = scopeOverride === undefined ? scope : scopeOverride;
      const answerId = uid("a");
      dispatch({
        type: "add",
        messages: [
          { id: uid("q"), role: "user", text: question, status: "complete", citations: [], scope: askScope },
          { id: answerId, role: "assistant", text: "", status: "pending", citations: [], scope: askScope, origin: expectedOrigin, feedback: null },
        ],
      });
      const controller = new AbortController();
      controllerRef.current = controller;
      try {
        const answer = await amplifi.ask({
          question,
          scope: askScope,
          history: historyFor(messages),
          conversationId,
          signal: controller.signal,
          onText: (text) => dispatch({ type: "update", id: answerId, patch: { text, status: "streaming" } }),
        });
        dispatch({
          type: "update",
          id: answerId,
          patch: { text: answer.text, citations: answer.citations, origin: answer.origin, status: "complete" },
        });
        if (answer.conversationId) setConversationId(answer.conversationId);
      } catch (e) {
        dispatch({
          type: "update",
          id: answerId,
          patch: isAbort(e) ? { status: "stopped" } : { status: "error", error: describeError(e) },
        });
      } finally {
        controllerRef.current = null;
        busyRef.current = false;
        setBusy(false);
      }
    },
    [amplifi, conversationId, expectedOrigin, messages, scope],
  );

  const stop = useCallback(() => controllerRef.current?.abort(), []);

  const regenerate = useCallback(
    (assistantId: string) => {
      if (busyRef.current) return;
      const i = messages.findIndex((m) => m.id === assistantId);
      const question = messages[i - 1];
      if (i < 1 || question?.role !== "user") return;
      dispatch({ type: "remove", ids: [question.id, assistantId] });
      void send(question.text, question.scope);
    },
    [messages, send],
  );

  const newChat = useCallback(() => {
    controllerRef.current?.abort();
    dispatch({ type: "clear" });
    setConversationId(null);
    setFocusRequest((n) => n + 1);
  }, []);

  const setFeedback = useCallback(
    (id: string, feedback: "up" | "down" | null) => dispatch({ type: "update", id, patch: { feedback } }),
    [],
  );

  const requestComposerFocus = useCallback(() => setFocusRequest((n) => n + 1), []);

  const api = useMemo<ChatApi>(
    () => ({
      messages, isBusy, scope, setScope,
      send: (q, s) => void send(q, s),
      stop, regenerate, newChat, setFeedback, focusRequest, requestComposerFocus,
    }),
    [messages, isBusy, scope, send, stop, regenerate, newChat, setFeedback, focusRequest, requestComposerFocus],
  );

  return <ChatContext.Provider value={api}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatApi {
  const v = useContext(ChatContext);
  if (!v) throw new Error("useChat must be used inside <ChatProvider>");
  return v;
}
