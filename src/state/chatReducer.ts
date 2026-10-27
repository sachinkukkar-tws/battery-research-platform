import type { ChatMessage, ConversationTurn } from "@/types";

export type ChatAction =
  | { type: "add"; messages: ChatMessage[] }
  | { type: "update"; id: string; patch: Partial<ChatMessage> }
  | { type: "remove"; ids: string[] }
  | { type: "clear" };

export function chatReducer(state: ChatMessage[], action: ChatAction): ChatMessage[] {
  switch (action.type) {
    case "add":
      return [...state, ...action.messages];
    case "update":
      return state.map((m) => (m.id === action.id ? { ...m, ...action.patch } : m));
    case "remove":
      return state.filter((m) => !action.ids.includes(m.id));
    case "clear":
      return [];
  }
}

/** Completed turns sent as context for follow-up questions. Failed and demo answers are left out. */
export function historyFor(messages: ChatMessage[], maxTurns = 10): ConversationTurn[] {
  return messages
    .filter((m) => m.role === "user" || (m.status === "complete" && m.origin === "amplifi"))
    .slice(-maxTurns)
    .map((m) => ({ role: m.role, text: m.text }));
}

const STORAGE_KEY = "brp-chat";

/** Restores the thread for this browser tab. In-flight answers are marked stopped. */
export function loadThread(): { messages: ChatMessage[]; conversationId: string | null } {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { messages: [], conversationId: null };
    const parsed = JSON.parse(raw) as { messages?: ChatMessage[]; conversationId?: string | null };
    const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
    return {
      messages: messages.map((m) => (m.status === "pending" || m.status === "streaming" ? { ...m, status: "stopped" } : m)),
      conversationId: parsed.conversationId ?? null,
    };
  } catch {
    return { messages: [], conversationId: null };
  }
}

export function saveThread(messages: ChatMessage[], conversationId: string | null) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, conversationId }));
  } catch {
    /* Storage can be full or blocked; the thread still works for this page view. */
  }
}
