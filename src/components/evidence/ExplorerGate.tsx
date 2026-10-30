import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/common/Button";
import { Panel } from "@/components/common/Page";
import { uncheckedCount } from "@/domain/explorer";
import { useExplorerData } from "@/state/ExplorerDataContext";
import type { ExplorerData } from "@/types";
import styles from "./Evidence.module.css";

/** "2026-10-30T11:42+05:30" as "11:42", in the reader's time zone. */
const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** "2026-10-30T11:42+05:30" as "30 October 2026, 11:42", in the reader's time zone. */
export const formatDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "an unknown time";

/** How far a refresh has got, while one runs. */
function RefreshProgress() {
  const { refresh } = useExplorerData();
  if (refresh?.state !== "running") return null;
  const pct = refresh.total ? Math.round((refresh.done / refresh.total) * 100) : 0;
  return (
    <div className={styles.progress} role="status">
      <p>
        {refresh.stage ?? "Asking Amplifi"}: {refresh.done} of {refresh.total} answers
        {refresh.failed ? `, ${refresh.failed} without an answer` : ""}.{refresh.startedAt ? ` Started at ${formatTime(refresh.startedAt)}.` : ""}
      </p>
      <div className={styles.bar} aria-hidden="true">
        <i style={{ width: `${Math.max(4, pct)}%` }} />
      </div>
    </div>
  );
}

function RefreshButton({ children = "Refresh from Amplifi" }: { children?: ReactNode }) {
  const { refresh, startRefresh } = useExplorerData();
  const running = refresh?.state === "running";
  return (
    <Button variant="quiet" onClick={startRefresh} busy={running}>
      <RefreshCw aria-hidden="true" /> {running ? "Amplifi is extracting the papers" : children}
    </Button>
  );
}

function RefreshProblem() {
  const { refresh, refreshError } = useExplorerData();
  const message = refreshError ?? (refresh?.state === "failed" ? refresh.error : null);
  return message ? (
    <p className={styles.problem} role="alert">
      The refresh didn’t finish: {message}
    </p>
  ) : null;
}

/** Shows the page once Amplifi's data has loaded, and says what to do when it can't. */
export function ExplorerGate({ children }: { children: (data: ExplorerData) => ReactNode }) {
  const { state, reload } = useExplorerData();
  if (state.status === "ready") return <>{children(state.data)}</>;
  if (state.status === "loading") {
    return (
      <Panel>
        <p className={styles.empty} role="status">
          Loading Amplifi’s data…
        </p>
      </Panel>
    );
  }
  if (state.status === "missing") {
    return (
      <Panel title="No data from Amplifi yet">
        <div className={styles.gate}>
          <p className={styles.empty}>
            The Explorer shows what Amplifi extracts from the papers, with every value checked against its PDF. Nothing has been extracted
            yet. Amplifi is asked three questions about each paper, and the result is kept for next time.
          </p>
          <RefreshButton>Extract the papers with Amplifi</RefreshButton>
          <RefreshProgress />
          <RefreshProblem />
        </div>
      </Panel>
    );
  }
  return (
    <Panel title="Couldn’t load Amplifi’s data">
      <div className={styles.gate} role="alert">
        <p className={styles.empty}>
          {state.message} Make sure the proxy is running (<code>npm run amplifi:proxy</code>), then try again.
        </p>
        <Button variant="quiet" onClick={reload}>
          Try again
        </Button>
      </div>
    </Panel>
  );
}

/** Where the data came from, when, and a way to ask Amplifi again, on one line. */
export function DataStatus({ data }: { data: ExplorerData }) {
  const left = uncheckedCount(data);
  return (
    <div className={styles.status}>
      <p title={data.method}>
        From Amplifi, {formatDateTime(data.extractedAt)} · every value checked against its PDF
        {left > 0 && ` · ${left} that didn’t pass the checks are left out`}
      </p>
      <RefreshButton />
      <RefreshProgress />
      <RefreshProblem />
    </div>
  );
}
