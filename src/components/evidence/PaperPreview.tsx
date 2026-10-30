import { ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button, ButtonLink } from "@/components/common/Button";
import { checkedCount, paperByline, paperTitle } from "@/domain/explorer";
import { usePdfHref } from "@/hooks/usePdfHref";
import { useDetailDialog } from "@/state/DetailDialogContext";
import { useExplorerData } from "@/state/ExplorerDataContext";
import styles from "./Evidence.module.css";

/** Dialog content for a paper cited in Ask Amplifi. */
export function PaperPreview({ paperId, titleId }: { paperId: string; titleId: string }) {
  const navigate = useNavigate();
  const { close } = useDetailDialog();
  const { data } = useExplorerData();
  const pdfHref = usePdfHref();
  const paper = data?.papers[paperId];

  if (!data || !paper) {
    return (
      <div className={styles.dialogBody}>
        <h2 id={titleId} className={styles.dialogTitle}>
          {paperId}
        </h2>
        <p className={styles.meta}>
          {data ? "This paper isn’t in Amplifi’s Explorer data." : "Amplifi’s data for the papers isn’t loaded, so there are no details to show."}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.dialogBody}>
      <div>
        <p className={styles.kicker}>
          {paper.id}
          {paper.kind ? ` · ${paper.kind === "review" ? "Review" : "Research article"}` : ""}
        </p>
        <h2 id={titleId} className={styles.dialogTitle}>
          {paperTitle(paper)}
        </h2>
      </div>
      <p className={styles.meta}>
        {paperByline(paper)}
        {paper.doi && (
          <>
            {" · "}
            <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noreferrer">
              doi:{paper.doi}
            </a>
          </>
        )}
        <br />
        {checkedCount(data, paper.id)} values from this paper are checked against its PDF.
      </p>
      <div className={styles.actions}>
        <Button
          onClick={() => {
            close();
            navigate(`/papers/${paper.id}`);
          }}
        >
          Open the paper
        </Button>
        <ButtonLink variant="quiet" href={pdfHref(paper.id)} target="_blank" rel="noreferrer">
          PDF <ExternalLink aria-hidden="true" />
        </ButtonLink>
      </div>
    </div>
  );
}
