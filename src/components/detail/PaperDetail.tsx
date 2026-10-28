import { useNavigate } from "react-router-dom";
import { Button } from "@/components/common/Button";
import { PIPELINE_STEPS, pipelineStage } from "@/domain/library";
import { plural } from "@/domain/format";
import { useAskAbout, useCanAskAbout } from "@/hooks/useAskAbout";
import { useDetailDialog } from "@/state/DetailDialogContext";
import { useResearchData } from "@/state/ResearchDataContext";
import { useViewState } from "@/state/ViewStateContext";
import styles from "./Detail.module.css";

export function PaperDetail({ paperId, titleId }: { paperId: string; titleId: string }) {
  const { paperById, dataset, queue } = useResearchData();
  const { close } = useDetailDialog();
  const { showPairsFor } = useViewState();
  const askAbout = useAskAbout();
  const canAsk = useCanAskAbout();
  const navigate = useNavigate();
  const paper = paperById(paperId);

  if (!paper) {
    return (
      <>
        <h2 id={titleId} className={styles.title}>
          {paperId} isn’t in the Library
        </h2>
        <p className={styles.meta}>The paper may have been removed, or it isn’t loaded yet. Ask Amplifi can still search it if it’s in the knowledge base.</p>
        {canAsk(paperId) && (
          <div className={styles.actions}>
            <Button onClick={() => askAbout(paperId)}>Ask Amplifi about {paperId}</Button>
          </div>
        )}
      </>
    );
  }

  const records = dataset.records.filter((r) => r.paper === paper.id);
  const waiting = queue.filter((q) => q.paper === paper.id).length;
  const stage = pipelineStage(paper.status);

  return (
    <>
      <h2 id={titleId} className={styles.title}>
        {paper.title}
      </h2>
      <p className={styles.meta}>
        {paper.id}. {paper.authors}
        {paper.year ? ` (${paper.year})` : ""}. {paper.type}, {paper.collection}.
      </p>
      <ol className={styles.pipeline} aria-label={`Status: ${paper.status}`}>
        {PIPELINE_STEPS.map((s, i) => (
          <li key={s} className={i < stage ? styles.done : undefined}>
            {s}
            <span className="visually-hidden">{i < stage ? ", done" : ", not yet"}</span>
          </li>
        ))}
      </ol>
      <p className={styles.note}>{paper.note}</p>
      {records.length > 0 && (
        <dl className={styles.dl}>
          {records.map((r) => (
            <div key={r.id}>
              <dt>{r.cathode ? `${r.cathode} cell` : "Anode test"}</dt>
              <dd>
                {r.cell}
                {r.cycling ? `. ${r.cycling}` : ""}
                {r.result ? `. ${r.result}` : ""} <span className="muted small">(p. {r.page})</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div className={styles.actions}>
        {canAsk(paper.id) && <Button onClick={() => askAbout(paper.id)}>Ask Amplifi about {paper.id}</Button>}
        {waiting > 0 && (
          <Button
            variant="quiet"
            onClick={() => {
              close();
              navigate("/review");
            }}
          >
            Review {waiting} waiting {plural(waiting, "value")}
          </Button>
        )}
        {records.length > 0 && (
          <Button
            variant="quiet"
            onClick={() => {
              close();
              showPairsFor(records[0]!.anode);
              navigate("/workspace");
            }}
          >
            See in Workspace
          </Button>
        )}
      </div>
    </>
  );
}
