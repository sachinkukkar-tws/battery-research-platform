import { Card, CardBody, CardHeader } from "@/components/common/Card";
import { Controls, Field, Select } from "@/components/common/Controls";
import { DataGate } from "@/components/common/DataGate";
import { EmptyState } from "@/components/common/Feedback";
import { ReviewCard } from "@/components/review/ReviewCard";
import { ReviewHistory } from "@/components/review/ReviewHistory";
import { REVIEW_SOURCE_FILTERS } from "@/domain/review";
import { plural } from "@/domain/format";
import { useAskAbout } from "@/hooks/useAskAbout";
import { useResearchData } from "@/state/ResearchDataContext";
import { useViewState } from "@/state/ViewStateContext";
import styles from "@/components/review/Review.module.css";

export function ReviewPage() {
  return (
    <DataGate label="Loading the review queue">
      <Review />
    </DataGate>
  );
}

function Review() {
  const { queue, decisions, dataset, pendingReviewIds, submitReview } = useResearchData();
  const { reviewFilter, setReviewFilter } = useViewState();
  const askAbout = useAskAbout();
  const list = queue.filter((r) => reviewFilter === "all" || r.source === reviewFilter);

  const summary = queue.length
    ? `${queue.length} ${plural(queue.length, "value")} waiting${reviewFilter === "all" ? "" : `, ${list.length} shown`}.`
    : "Nothing waiting. Every value has been checked.";

  return (
    <>
      <Card>
        <CardHeader
          title="Review queue"
          subtitle="Values waiting for a person to check them against the paper. Only checked values count as verified in the Workspace and Charts."
        />
        <CardBody>
          <Controls>
            <Field label="Show">
              <Select value={reviewFilter} options={REVIEW_SOURCE_FILTERS} onChange={setReviewFilter} />
            </Field>
          </Controls>
          <p className="small" style={{ marginTop: 14, color: "var(--slate)" }} aria-live="polite">
            {summary}
          </p>
        </CardBody>
      </Card>
      <section className={styles.queue} aria-label="Waiting values">
        {list.map((item) => (
          <ReviewCard
            key={item.id}
            item={item}
            paper={dataset.papers[item.paper]}
            pending={pendingReviewIds.includes(item.id)}
            onDecide={(action, value) => void submitReview(item.id, action, value)}
            onAsk={() => askAbout(item.paper)}
          />
        ))}
        {queue.length > 0 && !list.length && (
          <Card>
            <EmptyState>No waiting values from this source.</EmptyState>
          </Card>
        )}
      </section>
      <ReviewHistory decisions={decisions} />
    </>
  );
}
