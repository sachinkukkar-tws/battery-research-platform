import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Sourced } from "@/types";

/** A value someone clicked, with the quote and PDF page it was checked against. */
export interface SourceRef {
  label: string;
  value: string;
  /** Highlight the value in its quote by its numbers (measurements) or its words (materials, samples). */
  by: "numbers" | "text";
  item: Sourced;
}

export type DetailTarget = { kind: "paper"; id: string } | { kind: "source"; source: SourceRef } | null;

interface DetailDialogApi {
  target: DetailTarget;
  /** A cited paper, from Ask Amplifi. */
  openPaper: (paperId: string) => void;
  /** The sentence and page a value came from. */
  showSource: (source: SourceRef) => void;
  close: () => void;
}

const DetailDialogContext = createContext<DetailDialogApi | null>(null);

/** One dialog for the whole app, so the chat, the Explorer and Papers can all open papers and sources. */
export function DetailDialogProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<DetailTarget>(null);
  const openPaper = useCallback((id: string) => setTarget({ kind: "paper", id }), []);
  const showSource = useCallback((source: SourceRef) => setTarget({ kind: "source", source }), []);
  const close = useCallback(() => setTarget(null), []);
  const api = useMemo(() => ({ target, openPaper, showSource, close }), [target, openPaper, showSource, close]);
  return <DetailDialogContext.Provider value={api}>{children}</DetailDialogContext.Provider>;
}

export function useDetailDialog(): DetailDialogApi {
  const v = useContext(DetailDialogContext);
  if (!v) throw new Error("useDetailDialog must be used inside <DetailDialogProvider>");
  return v;
}
