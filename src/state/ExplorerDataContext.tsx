import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { describeError } from "@/services";
import type { RefreshStatus } from "@/services/explorerApi";
import type { ExplorerData } from "@/types";
import { useServices } from "./ServicesContext";

export type ExplorerState =
  | { status: "loading" }
  | { status: "ready"; data: ExplorerData }
  /** The proxy is up, but nothing has been extracted from the papers yet. */
  | { status: "missing" }
  | { status: "error"; message: string };

interface ExplorerDataApi {
  state: ExplorerState;
  /** The data when it has loaded, else null. */
  data: ExplorerData | null;
  /** The latest refresh, while one runs and after it ends. */
  refresh: RefreshStatus | null;
  refreshError: string | null;
  /** Asks Amplifi about every paper again; the page keeps showing the current data until the new data is ready. */
  startRefresh: () => void;
  reload: () => void;
}

const ExplorerDataContext = createContext<ExplorerDataApi | null>(null);
const POLL_MS = 4000;

/** Loads the Explorer's data from Amplifi, through the proxy, once for the whole app. */
export function ExplorerDataProvider({ children }: { children: ReactNode }) {
  const { explorer } = useServices();
  const [state, setState] = useState<ExplorerState>({ status: "loading" });
  const [refresh, setRefresh] = useState<RefreshStatus | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  // Loading data from an outside system is an effect; `version` reloads it.
  useEffect(() => {
    const ctrl = new AbortController();
    explorer.load(ctrl.signal).then(
      (data) => setState(data ? { status: "ready", data } : { status: "missing" }),
      (e) => !ctrl.signal.aborted && setState({ status: "error", message: describeError(e) }),
    );
    return () => ctrl.abort();
  }, [explorer, version]);

  // While a refresh runs on the proxy, follow it; when it ends, load the new data.
  const follow = useCallback(
    (s: RefreshStatus) => {
      setRefresh(s);
      window.clearTimeout(timer.current);
      if (s.state === "running") {
        timer.current = window.setTimeout(() => {
          explorer.status().then(follow, (e) => setRefreshError(describeError(e)));
        }, POLL_MS);
      } else if (s.state === "done") {
        setVersion((v) => v + 1);
      }
    },
    [explorer],
  );

  // A refresh may already be running when the page opens.
  useEffect(() => {
    explorer.status().then((s) => s.state === "running" && follow(s), () => {});
    return () => window.clearTimeout(timer.current);
  }, [explorer, follow]);

  const startRefresh = useCallback(() => {
    setRefreshError(null);
    explorer.refresh().then(follow, (e) => setRefreshError(describeError(e)));
  }, [explorer, follow]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setVersion((v) => v + 1);
  }, []);

  const api = useMemo<ExplorerDataApi>(
    () => ({ state, data: state.status === "ready" ? state.data : null, refresh, refreshError, startRefresh, reload }),
    [state, refresh, refreshError, startRefresh, reload],
  );
  return <ExplorerDataContext.Provider value={api}>{children}</ExplorerDataContext.Provider>;
}

export function useExplorerData(): ExplorerDataApi {
  const v = useContext(ExplorerDataContext);
  if (!v) throw new Error("useExplorerData must be used inside <ExplorerDataProvider>");
  return v;
}
