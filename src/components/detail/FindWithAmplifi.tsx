import { useEffect, useRef, useState } from "react";
import type { FoundValue } from "@/types";
import { Button } from "@/components/common/Button";
import { describeError, isAbort } from "@/services";
import { useServices } from "@/state/ServicesContext";
import styles from "./Detail.module.css";

interface FindWithAmplifiProps {
  paperId: string;
  sample: string;
  field: string;
}

type State = { status: "idle" } | { status: "loading" } | { status: "done"; result: FoundValue } | { status: "error"; message: string };

/** For a value missing from the table: asks Amplifi to look for it in the paper. Never fills the gap itself. */
export function FindWithAmplifi({ paperId, sample, field }: FindWithAmplifiProps) {
  const { amplifi } = useServices();
  const [state, setState] = useState<State>({ status: "idle" });
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const find = async () => {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setState({ status: "loading" });
    try {
      const result = await amplifi.findValue({ paperId, sample, field, signal: c.signal });
      setState({ status: "done", result });
    } catch (e) {
      if (!isAbort(e)) setState({ status: "error", message: describeError(e) });
    }
  };

  return (
    <>
      <span className="muted">Not in table</span>
      <br />
      <Button variant="quiet" className={styles.find} onClick={find} busy={state.status === "loading"}>
        {state.status === "loading" ? "Asking Amplifi…" : "Find with Amplifi"}
      </Button>
      <div aria-live="polite">
        {state.status === "done" && (
          <div className={styles.found}>
            {state.result.origin === "mock" && <span className={styles.demoTag}>Demo</span>}
            {state.result.value ? (
              <>
                <strong>{state.result.value}</strong>
                {state.result.page ? `, page ${state.result.page}` : ""}.{" "}
              </>
            ) : null}
            {state.result.quote}
            {state.result.origin === "amplifi" && state.result.value && " Check this against the paper before using it."}
          </div>
        )}
        {state.status === "error" && <div className={`${styles.found} ${styles.foundError}`}>Amplifi didn’t respond. {state.message}</div>}
      </div>
    </>
  );
}
