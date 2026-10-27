/** Where an answer came from. "mock" answers must always be labelled as demo answers in the UI. */
export type AnswerOrigin = "amplifi" | "mock";

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

export interface FindValueRequest {
  paperId: string;
  sample: string;
  field: string;
  signal?: AbortSignal;
}

export interface FoundValue {
  value: string | null;
  page: string | null;
  quote: string;
  origin: AnswerOrigin;
}
