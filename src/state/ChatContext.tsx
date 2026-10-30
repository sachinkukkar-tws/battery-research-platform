import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import type { AnswerOrigin, ChatMessage, ChatSession } from "@/types";
import { describeError, isAbort } from "@/services";
import { uid } from "@/domain/format";
import { useServices } from "./ServicesContext";
import { chatReducer, historyFor, loadChats, saveChats } from "./chatReducer";

interface ChatApi {
  /** The messages of the chat on screen. */
  messages: ChatMessage[];
  /** Every chat kept in this browser, the most recent first. */
  chats: ChatSession[];
  /** The chat on screen, or null for a new chat with no questions yet. */
  currentId: string | null;
  isBusy: boolean;
  /** Paper the next question is limited to, or null for all papers. */
  scope: string | null;
  setScope: (paperId: string | null) => void;
  send: (question: string, scopeOverride?: string | null) => void;
  stop: () => void;
  /** Asks the question behind an answer again, replacing that answer. */
  regenerate: (assistantId: string) => void;
  /** Starts an empty chat. The chat on screen stays in the list of previous chats. */
  newChat: () => void;
  /** Shows a previous chat again; follow-up questions continue its Amplifi conversation. */
  openChat: (chatId: string) => void;
  deleteChat: (chatId: string) => void;
  setFeedback: (messageId: string, feedback: "up" | "down" | null) => void;
  /** Increments whenever another screen asks for the composer to take focus. */
  focusRequest: number;
  requestComposerFocus: () => void;
}

const ChatContext = createContext<ChatApi | null>(null);
const NO_MESSAGES: ChatMessage[] = [];

export function ChatProvider({ children }: { children: ReactNode }) {
  const { amplifi } = useServices();
  const [state, dispatch] = useReducer(chatReducer, undefined, loadChats);
  const [scope, setScope] = useState<string | null>(null);
  const [isBusy, setBusy] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);

  // Keep the chats in this browser, so they're still there after the page or the browser closes.
  useEffect(() => saveChats(state), [state]);

  // Cancel any in-flight request if the provider unmounts.
  useEffect(() => () => controllerRef.current?.abort(), []);

  const current = state.chats.find((c) => c.id === state.currentId) ?? null;
  const messages = current?.messages ?? NO_MESSAGES;
  const expectedOrigin: AnswerOrigin = "amplifi";

  /** Asks Amplifi in the chat on screen. `earlier` is what the question follows, for Amplifi's context. */
  const ask = useCallback(
    async (question: string, askScope: string | null, earlier: ChatMessage[]) => {
      busyRef.current = true;
      setBusy(true);
      const chatId = current?.id ?? uid("c");
      const answerId = uid("a");
      dispatch({
        type: "ask",
        chatId,
        at: new Date().toISOString(),
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
          history: historyFor(earlier),
          conversationId: current?.conversationId ?? null,
          signal: controller.signal,
          onText: (text) => dispatch({ type: "update", chatId, id: answerId, patch: { text, status: "streaming" } }),
        });
        dispatch({
          type: "update",
          chatId,
          id: answerId,
          patch: { text: answer.text, citations: answer.citations, origin: answer.origin, status: "complete" },
        });
        if (answer.conversationId) dispatch({ type: "conversation", chatId, conversationId: answer.conversationId });
      } catch (e) {
        dispatch({
          type: "update",
          chatId,
          id: answerId,
          patch: isAbort(e) ? { status: "stopped" } : { status: "error", error: describeError(e) },
        });
      } finally {
        controllerRef.current = null;
        busyRef.current = false;
        setBusy(false);
      }
    },
    [amplifi, current, expectedOrigin],
  );

  const send = useCallback(
    (raw: string, scopeOverride?: string | null) => {
      const question = raw.trim();
      if (!question || busyRef.current) return;
      void ask(question, scopeOverride === undefined ? scope : scopeOverride, messages);
    },
    [ask, messages, scope],
  );

  const stop = useCallback(() => controllerRef.current?.abort(), []);

  const regenerate = useCallback(
    (assistantId: string) => {
      if (busyRef.current || !current) return;
      const i = current.messages.findIndex((m) => m.id === assistantId);
      const question = current.messages[i - 1];
      if (i < 1 || question?.role !== "user") return;
      dispatch({ type: "remove", chatId: current.id, ids: [question.id, assistantId] });
      void ask(question.text, question.scope, current.messages.slice(0, i - 1));
    },
    [ask, current],
  );

  // Switching chats stops an answer that is still arriving, as starting a new chat always has.
  const show = useCallback((chatId: string | null) => {
    controllerRef.current?.abort();
    dispatch({ type: "open", chatId });
    setFocusRequest((n) => n + 1);
  }, []);

  const newChat = useCallback(() => show(null), [show]);
  const openChat = useCallback((chatId: string) => show(chatId), [show]);

  const deleteChat = useCallback(
    (chatId: string) => {
      if (chatId === state.currentId) controllerRef.current?.abort();
      dispatch({ type: "delete", chatId });
    },
    [state.currentId],
  );

  const setFeedback = useCallback(
    (id: string, feedback: "up" | "down" | null) => {
      if (current) dispatch({ type: "update", chatId: current.id, id, patch: { feedback } });
    },
    [current],
  );

  const requestComposerFocus = useCallback(() => setFocusRequest((n) => n + 1), []);

  const api = useMemo<ChatApi>(
    () => ({
      messages,
      chats: state.chats,
      currentId: state.currentId,
      isBusy,
      scope,
      setScope,
      send,
      stop,
      regenerate,
      newChat,
      openChat,
      deleteChat,
      setFeedback,
      focusRequest,
      requestComposerFocus,
    }),
    [
      messages,
      state.chats,
      state.currentId,
      isBusy,
      scope,
      send,
      stop,
      regenerate,
      newChat,
      openChat,
      deleteChat,
      setFeedback,
      focusRequest,
      requestComposerFocus,
    ],
  );

  return <ChatContext.Provider value={api}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatApi {
  const v = useContext(ChatContext);
  if (!v) throw new Error("useChat must be used inside <ChatProvider>");
  return v;
}
