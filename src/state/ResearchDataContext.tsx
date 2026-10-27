import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import type { LibraryPaper, ResearchDataset, ResearchRecord, ReviewAction, ReviewDecision, ReviewItem } from "@/types";
import { applyReviewDecision, OUTCOME_OF, reviewConfirmation } from "@/domain/review";
import { describeError, isAbort } from "@/services";
import { useServices } from "./ServicesContext";
import { useToast } from "./ToastContext";

export type LoadStatus = "loading" | "ready" | "error";

interface State {
  status: LoadStatus;
  error: string | null;
  dataset: ResearchDataset;
  library: LibraryPaper[];
  queue: ReviewItem[];
  decisions: ReviewDecision[];
  checkedValueCount: number | null;
  pendingReviewIds: string[];
  loadedAt: number | null;
}

type Action =
  | { type: "load_start" }
  | { type: "load_success"; dataset: ResearchDataset; library: LibraryPaper[]; queue: ReviewItem[] }
  | { type: "load_failure"; error: string }
  | { type: "review_pending"; id: string }
  | { type: "review_settled"; id: string }
  | { type: "review_applied"; id: string; action: ReviewAction; value?: string }
  | { type: "paper_added"; paper: LibraryPaper }
  | { type: "library_replaced"; library: LibraryPaper[] };

const EMPTY: State = {
  status: "loading",
  error: null,
  dataset: { papers: {}, records: [], checkedValueCount: null },
  library: [],
  queue: [],
  decisions: [],
  checkedValueCount: null,
  pendingReviewIds: [],
  loadedAt: null,
};

export function researchReducer(state: State, action: Action): State {
  switch (action.type) {
    case "load_start":
      return { ...state, status: "loading", error: null };
    case "load_success":
      return {
        ...state,
        status: "ready",
        error: null,
        dataset: action.dataset,
        library: action.library,
        queue: action.queue,
        checkedValueCount: action.dataset.checkedValueCount,
        loadedAt: Date.now(),
      };
    case "load_failure":
      return { ...state, status: "error", error: action.error };
    case "review_pending":
      return { ...state, pendingReviewIds: [...state.pendingReviewIds, action.id] };
    case "review_settled":
      return { ...state, pendingReviewIds: state.pendingReviewIds.filter((x) => x !== action.id) };
    case "review_applied": {
      const next = applyReviewDecision(state, action.id, action.action, action.value);
      return { ...state, ...next, pendingReviewIds: state.pendingReviewIds.filter((x) => x !== action.id) };
    }
    case "paper_added":
      return { ...state, library: [action.paper, ...state.library.filter((p) => p.id !== action.paper.id)] };
    case "library_replaced":
      return { ...state, library: action.library };
  }
}

interface ResearchDataApi extends State {
  reload: () => void;
  /** Persists a review decision, then updates local state. Returns false if it failed. */
  submitReview: (id: string, action: ReviewAction, value?: string) => Promise<boolean>;
  addPaper: (paper: LibraryPaper) => void;
  /** Refetches the library without showing a loading state. */
  refreshLibrary: () => Promise<void>;
  recordById: (id: string) => ResearchRecord | undefined;
  paperById: (id: string) => LibraryPaper | undefined;
}

const ResearchDataContext = createContext<ResearchDataApi | null>(null);

export function ResearchDataProvider({ children }: { children: ReactNode }) {
  const { research, documents } = useServices();
  const { showToast } = useToast();
  const [state, dispatch] = useReducer(researchReducer, EMPTY);
  const [loadKey, bumpLoadKey] = useReducer((n: number) => n + 1, 0);
  const pending = useRef(new Set<string>());

  // Fetching on mount (and on reload) is a genuine side effect: synchronising with the backend.
  useEffect(() => {
    const controller = new AbortController();
    dispatch({ type: "load_start" });
    Promise.all([
      research.getDataset(controller.signal),
      documents.listPapers(controller.signal),
      research.getReviewQueue(controller.signal),
    ]).then(
      ([dataset, library, queue]) => dispatch({ type: "load_success", dataset, library, queue }),
      (e) => {
        if (!isAbort(e)) dispatch({ type: "load_failure", error: describeError(e) });
      },
    );
    return () => controller.abort();
  }, [research, documents, loadKey]);

  const submitReview = useCallback(
    async (id: string, action: ReviewAction, value?: string) => {
      // Guards against double clicks before the pending state has rendered.
      if (pending.current.has(id)) return false;
      const item = state.queue.find((q) => q.id === id);
      if (!item) return false;
      pending.current.add(id);
      dispatch({ type: "review_pending", id });
      try {
        await research.submitReview(id, action, value);
        dispatch({ type: "review_applied", id, action, value });
        showToast(reviewConfirmation(item, OUTCOME_OF[action]));
        return true;
      } catch (e) {
        dispatch({ type: "review_settled", id });
        showToast(`Couldn’t save the decision. ${describeError(e)}`, "error");
        return false;
      } finally {
        pending.current.delete(id);
      }
    },
    [research, showToast, state.queue],
  );

  const addPaper = useCallback((paper: LibraryPaper) => dispatch({ type: "paper_added", paper }), []);

  const refreshLibrary = useCallback(async () => {
    try {
      dispatch({ type: "library_replaced", library: await documents.listPapers() });
    } catch (e) {
      showToast(`Couldn’t refresh the Library. ${describeError(e)}`, "error");
    }
  }, [documents, showToast]);

  const recordIndex = useMemo(() => new Map(state.dataset.records.map((r) => [r.id, r])), [state.dataset.records]);
  const paperIndex = useMemo(() => new Map(state.library.map((p) => [p.id, p])), [state.library]);

  const api = useMemo<ResearchDataApi>(
    () => ({
      ...state,
      reload: bumpLoadKey,
      submitReview,
      addPaper,
      refreshLibrary,
      recordById: (id) => recordIndex.get(id),
      paperById: (id) => paperIndex.get(id),
    }),
    [state, submitReview, addPaper, refreshLibrary, recordIndex, paperIndex],
  );

  return <ResearchDataContext.Provider value={api}>{children}</ResearchDataContext.Provider>;
}

export function useResearchData(): ResearchDataApi {
  const v = useContext(ResearchDataContext);
  if (!v) throw new Error("useResearchData must be used inside <ResearchDataProvider>");
  return v;
}
