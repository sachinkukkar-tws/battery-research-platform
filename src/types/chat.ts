/** Where an answer came from: every answer comes from Amplifi. */
export type AnswerOrigin = "amplifi";

export interface Citation {
  paperId: string;
  page: string | null;
}

export type MessageStatus = "pending" | "streaming" | "complete" | "stopped" | "error";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  status: MessageStatus;
  citations: Citation[];
  /** Paper the question was limited to, if any. */
  scope: string | null;
  origin?: AnswerOrigin;
  error?: string;
  feedback?: "up" | "down" | null;
}

export interface ConversationTurn {
  role: "user" | "assistant";
  text: string;
}

/** One conversation with Amplifi, kept in this browser so it can be opened again later. */
export interface ChatSession {
  id: string;
  /** The first question, as it was asked. */
  title: string;
  /** When the chat started and when it last changed (ISO times). */
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  /** Amplifi's chat session, so follow-up questions continue it. */
  conversationId: string | null;
}

export interface AskRequest {
  question: string;
  scope: string | null;
  history: ConversationTurn[];
  conversationId: string | null;
  signal?: AbortSignal;
  /** Called with the text so far when the backend streams. Optional for non-streaming backends. */
  onText?: (textSoFar: string) => void;
}

export interface AmplifiAnswer {
  text: string;
  citations: Citation[];
  origin: AnswerOrigin;
  conversationId: string | null;
}
