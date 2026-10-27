import type { ReactNode } from "react";
import { useResearchData } from "@/state/ResearchDataContext";
import { Card, CardBody } from "./Card";
import { ErrorState, LoadingState } from "./Feedback";

/** Shows loading and error states for the research data, and renders children once it's ready. */
export function DataGate({ children, label = "Loading the research data" }: { children: ReactNode; label?: string }) {
  const { status, error, reload } = useResearchData();
  if (status === "ready") return <>{children}</>;
  return (
    <Card>
      <CardBody>
        {status === "loading" ? (
          <LoadingState label={label} />
        ) : (
          <ErrorState title="The research data didn’t load" message={error ?? "Unknown error."} onRetry={reload} />
        )}
      </CardBody>
    </Card>
  );
}
