import { uid } from "@/domain/format";
import type { ChatMessage, ChatSession, ConversationTurn } from "@/types";

/** Every chat kept in this browser, the most recent first, and the one on screen. `currentId` is null for a new, empty chat. */
export interface ChatsState {
  chats: ChatSession[];
  currentId: string | null;
}

export type ChatAction =
  /** A question and its pending answer. The first question of a new chat creates the chat. */
  | { type: "ask"; chatId: string; at: string; messages: ChatMessage[] }
  | { type: "update"; chatId: string; id: string; patch: Partial<ChatMessage> }
  | { type: "remove"; chatId: string; ids: string[] }
  | { type: "conversation"; chatId: string; conversationId: string }
  | { type: "open"; chatId: string | null }
  | { type: "delete"; chatId: string };

/** The oldest chats beyond this are dropped, so the saved list stays small. */
const MAX_CHATS = 50;
const TITLE_LENGTH = 80;

const titleOf = (question: string) => (question.length > TITLE_LENGTH ? `${question.slice(0, TITLE_LENGTH - 1).trimEnd()}…` : question);

const changeChat = (state: ChatsState, chatId: string, change: (chat: ChatSession) => ChatSession): ChatsState => ({
  ...state,
  chats: state.chats.map((c) => (c.id === chatId ? change(c) : c)),
});

export function chatReducer(state: ChatsState, action: ChatAction): ChatsState {
  switch (action.type) {
    case "ask": {
      const existing = state.chats.find((c) => c.id === action.chatId);
      const others = state.chats.filter((c) => c.id !== action.chatId);
      const question = action.messages.find((m) => m.role === "user")?.text ?? "";
      const chat: ChatSession = existing
        ? { ...existing, messages: [...existing.messages, ...action.messages], updatedAt: action.at }
        : { id: action.chatId, title: titleOf(question), createdAt: action.at, updatedAt: action.at, messages: action.messages, conversationId: null };
      // The chat asked in moves to the top of the list.
      return { chats: [chat, ...others].slice(0, MAX_CHATS), currentId: action.chatId };
    }
    case "update":
      return changeChat(state, action.chatId, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === action.id ? { ...m, ...action.patch } : m)) }));
    case "remove":
      return changeChat(state, action.chatId, (c) => ({ ...c, messages: c.messages.filter((m) => !action.ids.includes(m.id)) }));
    case "conversation":
      return changeChat(state, action.chatId, (c) => ({ ...c, conversationId: action.conversationId }));
    case "open":
      return { ...state, currentId: action.chatId };
    case "delete":
      return { chats: state.chats.filter((c) => c.id !== action.chatId), currentId: state.currentId === action.chatId ? null : state.currentId };
  }
}

/** Completed turns sent as context for follow-up questions. Failed answers are left out. */
export function historyFor(messages: ChatMessage[], maxTurns = 10): ConversationTurn[] {
  return messages
    .filter((m) => m.role === "user" || (m.status === "complete" && m.origin === "amplifi"))
    .slice(-maxTurns)
    .map((m) => ({ role: m.role, text: m.text }));
}

const STORAGE_KEY = "brp-chats";
/** Earlier versions kept a single chat for each browser tab under this key. */
const OLD_KEY = "brp-chat";

/** An answer that was still arriving when the page closed is marked stopped. */
const settle = (m: ChatMessage): ChatMessage => (m.status === "pending" || m.status === "streaming" ? { ...m, status: "stopped" } : m);
const isChat = (c: unknown): c is ChatSession =>
  typeof c === "object" && c !== null && typeof (c as ChatSession).id === "string" && Array.isArray((c as ChatSession).messages);

/** The chats kept in this browser, and the one that was on screen. */
export function loadChats(): ChatsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ChatsState>;
      const chats = (Array.isArray(parsed.chats) ? parsed.chats : []).filter(isChat).map((c) => ({ ...c, messages: c.messages.map(settle) }));
      return { chats, currentId: chats.some((c) => c.id === parsed.currentId) ? (parsed.currentId as string) : null };
    }
    // Move over the chat an earlier version kept for this tab.
    const old = JSON.parse(sessionStorage.getItem(OLD_KEY) ?? "null") as { messages?: ChatMessage[]; conversationId?: string | null } | null;
    const messages = Array.isArray(old?.messages) ? old.messages.map(settle) : [];
    const question = messages.find((m) => m.role === "user");
    if (!question) return { chats: [], currentId: null };
    const at = new Date().toISOString();
    const chat: ChatSession = {
      id: uid("c"),
      title: titleOf(question.text),
      createdAt: at,
      updatedAt: at,
      messages,
      conversationId: old?.conversationId ?? null,
    };
    return { chats: [chat], currentId: chat.id };
  } catch {
    return { chats: [], currentId: null };
  }
}

export function saveChats(state: ChatsState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    sessionStorage.removeItem(OLD_KEY);
  } catch {
    /* Storage can be full or blocked; the chats still work until the page closes. */
  }
}
