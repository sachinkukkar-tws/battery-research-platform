import { ExternalLink } from "lucide-react";
import { ButtonLink } from "@/components/common/Button";
import { formatUnits, highlight, paperByline, paperTitle } from "@/domain/explorer";
import { usePdfHref } from "@/hooks/usePdfHref";
import type { SourceRef } from "@/state/DetailDialogContext";
import { useExplorerData } from "@/state/ExplorerDataContext";
import styles from "./Evidence.module.css";

/** Dialog content: the sentence a value was copied from, with the value highlighted, and a link to its PDF page. */
export function SourceView({ source, titleId }: { source: SourceRef; titleId: string }) {
  const pdfHref = usePdfHref();
  const { data } = useExplorerData();
  const { item } = source;
  const paper = data?.papers[item.paper];
  return (
    <div className={styles.dialogBody}>
      <div>
        <p className={styles.kicker}>{source.label}</p>
        <h2 id={titleId} className={styles.dialogTitle}>
          {formatUnits(source.value)}
        </h2>
      </div>
      <blockquote className={styles.quote}>
        {highlight(item.quote, source.value, source.by).map((part, i) => (part.mark ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>))}
      </blockquote>
      {paper && (
        <p className={styles.meta}>
          {paper.id} · <i>{paperTitle(paper)}</i> · {paperByline(paper)} · page {item.page}
          {paper.doi && (
            <>
              {" · "}
              <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noreferrer">
                doi:{paper.doi}
              </a>
            </>
          )}
        </p>
      )}
      <div className={styles.actions}>
        <ButtonLink href={pdfHref(item.paper, item.page)} target="_blank" rel="noreferrer">
          Open the PDF at page {item.page} <ExternalLink aria-hidden="true" />
        </ButtonLink>
      </div>
      <p className={styles.meta}>Amplifi quoted this from the paper, and the check found it on page {item.page} of the PDF.</p>
    </div>
  );
}
