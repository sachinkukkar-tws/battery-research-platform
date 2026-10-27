import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type DetailTarget = { kind: "paper"; id: string } | { kind: "pair"; id: string } | null;

interface DetailDialogApi {
  target: DetailTarget;
  openPaper: (paperId: string) => void;
  openPair: (recordId: string) => void;
  close: () => void;
}

const DetailDialogContext = createContext<DetailDialogApi | null>(null);

/** One detail dialog for the whole app, so citations, charts and tables can all open papers and pairs. */
export function DetailDialogProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<DetailTarget>(null);
  const openPaper = useCallback((id: string) => setTarget({ kind: "paper", id }), []);
  const openPair = useCallback((id: string) => setTarget({ kind: "pair", id }), []);
  const close = useCallback(() => setTarget(null), []);
  const api = useMemo(() => ({ target, openPaper, openPair, close }), [target, openPaper, openPair, close]);
  return <DetailDialogContext.Provider value={api}>{children}</DetailDialogContext.Provider>;
}

export function useDetailDialog(): DetailDialogApi {
  const v = useContext(DetailDialogContext);
  if (!v) throw new Error("useDetailDialog must be used inside <DetailDialogProvider>");
  return v;
}
