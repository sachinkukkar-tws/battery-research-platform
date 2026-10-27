import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { BatteryType } from "@/types";
import { DEFAULT_PAIR_FILTERS, togglePick, type PairFilters } from "@/domain/pairs";
import { DEFAULT_LIBRARY_FILTERS, type LibraryFilters } from "@/domain/library";
import type { ReviewSourceFilter } from "@/domain/review";
import type { ChartFieldKey } from "@/domain/chartFields";
import type { ColorBy } from "@/domain/charts";
import { DEFAULT_COMPARE } from "@/data/explore";

/**
 * Filters and selections that should survive moving between pages, so a person can
 * set up a view, check a paper in the Library, and come back to the same view.
 */
export type ExploreTab = "pairs" | "compare" | "gaps";

export interface ChartSettings {
  mode: "scatter" | "rank";
  x: ChartFieldKey;
  y: ChartFieldKey;
  rank: ChartFieldKey;
  colorBy: ColorBy;
  showLabels: boolean;
  showBest: boolean;
  showTrend: boolean;
}

export const DEFAULT_CHART_SETTINGS: ChartSettings = {
  mode: "scatter",
  x: "capacity",
  y: "ice",
  rank: "aret",
  colorBy: "battery",
  showLabels: true,
  showBest: true,
  showTrend: false,
};

export type CompareSlots = [string, string, string];

interface ViewState {
  pairFilters: PairFilters;
  /** Index of the chosen quick question, or null when filters were set by hand. */
  quickQuestion: number | null;
  pairFocus: "anode" | "cathode" | undefined;
  moreOptionsOpen: boolean;
  exploreTab: ExploreTab;
  picked: string[];
  compareSlots: CompareSlots;
  gridBattery: BatteryType;
  libraryFilters: LibraryFilters;
  reviewFilter: ReviewSourceFilter;
  chart: ChartSettings;
}

interface ViewStateApi extends ViewState {
  /** Updates filters by hand, which clears any quick question. */
  updatePairFilters: (patch: Partial<PairFilters>) => void;
  applyQuickQuestion: (index: number | null, set: Partial<PairFilters>, focus?: "anode" | "cathode") => void;
  resetPairFilters: () => void;
  /** Shows the pairs list filtered to one anode (and optionally cathode). */
  showPairsFor: (anode: string, cathode?: string) => void;
  setMoreOptionsOpen: (open: boolean) => void;
  setExploreTab: (tab: ExploreTab) => void;
  togglePicked: (id: string) => void;
  setCompareSlot: (index: 0 | 1 | 2, id: string) => void;
  setGridBattery: (b: BatteryType) => void;
  updateLibraryFilters: (patch: Partial<LibraryFilters>) => void;
  resetLibraryFilters: () => void;
  setReviewFilter: (f: ReviewSourceFilter) => void;
  updateChart: (patch: Partial<ChartSettings>) => void;
}

const ViewStateContext = createContext<ViewStateApi | null>(null);

const HIDDEN_FILTER_KEYS: (keyof PairFilters)[] = ["format", "battery", "from", "lowTemp"];

export function ViewStateProvider({ children }: { children: ReactNode }) {
  const [pairFilters, setPairFilters] = useState<PairFilters>(DEFAULT_PAIR_FILTERS);
  const [quickQuestion, setQuickQuestion] = useState<number | null>(null);
  const [pairFocus, setPairFocus] = useState<"anode" | "cathode" | undefined>();
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [exploreTab, setExploreTab] = useState<ExploreTab>("pairs");
  const [picked, setPicked] = useState<string[]>([]);
  const [compareSlots, setCompareSlots] = useState<CompareSlots>(DEFAULT_COMPARE);
  const [gridBattery, setGridBattery] = useState<BatteryType>("Sodium-ion");
  const [libraryFilters, setLibraryFilters] = useState<LibraryFilters>(DEFAULT_LIBRARY_FILTERS);
  const [reviewFilter, setReviewFilter] = useState<ReviewSourceFilter>("all");
  const [chart, setChart] = useState<ChartSettings>(DEFAULT_CHART_SETTINGS);

  const updatePairFilters = useCallback((patch: Partial<PairFilters>) => {
    setPairFilters((f) => ({ ...f, ...patch }));
    setQuickQuestion(null);
    setPairFocus(undefined);
  }, []);

  const applyQuickQuestion = useCallback((index: number | null, set: Partial<PairFilters>, focus?: "anode" | "cathode") => {
    setPairFilters({ ...DEFAULT_PAIR_FILTERS, ...set });
    setQuickQuestion(index);
    setPairFocus(focus);
    // Open "More options" when the question sets a filter that lives there, so it isn't hidden.
    if (HIDDEN_FILTER_KEYS.some((k) => k in set)) setMoreOptionsOpen(true);
  }, []);

  const resetPairFilters = useCallback(() => {
    setPairFilters(DEFAULT_PAIR_FILTERS);
    setQuickQuestion(null);
    setPairFocus(undefined);
  }, []);

  const showPairsFor = useCallback((anode: string, cathode?: string) => {
    setPairFilters({ ...DEFAULT_PAIR_FILTERS, anode, ...(cathode ? { cathode } : {}) });
    setQuickQuestion(null);
    setPairFocus(undefined);
    setExploreTab("pairs");
  }, []);

  const togglePicked = useCallback(
    (id: string) => {
      const next = togglePick(picked, id);
      setPicked(next);
      // Mirror the picks into the compare slots, as the prototype did.
      setCompareSlots((slots) => slots.map((s, k) => next[k] ?? s) as CompareSlots);
    },
    [picked],
  );

  const setCompareSlot = useCallback((index: 0 | 1 | 2, id: string) => {
    setCompareSlots((slots) => {
      const next = [...slots] as CompareSlots;
      next[index] = id;
      return next;
    });
  }, []);

  const updateLibraryFilters = useCallback((patch: Partial<LibraryFilters>) => setLibraryFilters((f) => ({ ...f, ...patch })), []);
  const resetLibraryFilters = useCallback(() => setLibraryFilters(DEFAULT_LIBRARY_FILTERS), []);
  const updateChart = useCallback((patch: Partial<ChartSettings>) => setChart((c) => ({ ...c, ...patch })), []);

  const api = useMemo<ViewStateApi>(
    () => ({
      pairFilters, quickQuestion, pairFocus, moreOptionsOpen, exploreTab, picked, compareSlots, gridBattery,
      libraryFilters, reviewFilter, chart,
      updatePairFilters, applyQuickQuestion, resetPairFilters, showPairsFor, setMoreOptionsOpen, setExploreTab,
      togglePicked, setCompareSlot, setGridBattery, updateLibraryFilters, resetLibraryFilters, setReviewFilter, updateChart,
    }),
    [
      pairFilters, quickQuestion, pairFocus, moreOptionsOpen, exploreTab, picked, compareSlots, gridBattery,
      libraryFilters, reviewFilter, chart,
      updatePairFilters, applyQuickQuestion, resetPairFilters, showPairsFor, togglePicked, setCompareSlot,
      updateLibraryFilters, resetLibraryFilters, updateChart,
    ],
  );

  return <ViewStateContext.Provider value={api}>{children}</ViewStateContext.Provider>;
}

export function useViewState(): ViewStateApi {
  const v = useContext(ViewStateContext);
  if (!v) throw new Error("useViewState must be used inside <ViewStateProvider>");
  return v;
}
