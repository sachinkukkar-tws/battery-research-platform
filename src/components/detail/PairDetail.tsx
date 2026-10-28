import { Button } from "@/components/common/Button";
import { Formula } from "@/components/common/Badges";
import { pairName } from "@/domain/pairs";
import { useAskAbout, useCanAskAbout } from "@/hooks/useAskAbout";
import { useDetailDialog } from "@/state/DetailDialogContext";
import { useResearchData } from "@/state/ResearchDataContext";
import { FindWithAmplifi } from "./FindWithAmplifi";
import styles from "./Detail.module.css";

export function PairDetail({ recordId, titleId }: { recordId: string; titleId: string }) {
  const { recordById, dataset } = useResearchData();
  const { openPaper } = useDetailDialog();
  const askAbout = useAskAbout();
  const canAsk = useCanAskAbout();
  const r = recordById(recordId);

  if (!r) {
    return (
      <h2 id={titleId} className={styles.title}>
        This record isn’t available
      </h2>
    );
  }

  const paper = dataset.papers[r.paper];
  const missing = (field: string) => <FindWithAmplifi paperId={r.paper} sample={r.anode} field={field} />;

  return (
    <>
      <h2 id={titleId} className={styles.title}>
        {pairName(r)}
      </h2>
      <p className={styles.meta}>
        {r.paper}
        {paper ? `: ${paper.author} et al. (${paper.year}). ${paper.title}` : ""}
      </p>
      <dl className={styles.dl}>
        <div><dt>Battery type</dt><dd>{r.battery}</dd></div>
        <div><dt>Anode made from</dt><dd>{r.anodeFrom}</dd></div>
        <div>
          <dt>Anode test</dt>
          <dd>
            {r.anodeTest ? (
              <>
                {r.anodeTest} <span className="muted">(page {r.anodePage})</span>
              </>
            ) : (
              missing("reversible capacity")
            )}
          </dd>
        </div>
        {r.cathode && (
          <div>
            <dt>Cathode</dt>
            <dd>
              {r.cathode}
              {r.cathodeFormula && r.cathodeFormula !== r.cathode && (
                <>
                  {" "}(<Formula value={r.cathodeFormula} />)
                </>
              )}
            </dd>
          </div>
        )}
        <div><dt>Cell</dt><dd>{r.cell}</dd></div>
        {r.cathode && (
          <>
            <div><dt>Result</dt><dd>{r.result ?? missing("full-cell capacity")}</dd></div>
            <div><dt>Cycling</dt><dd>{r.cycling ?? missing("full-cell cycling result")}</dd></div>
            <div>
              <dt>Energy density</dt>
              <dd>{r.energy != null ? `${r.energyText ?? r.energy} Wh/kg, ${r.energyBasis ?? "basis not stated"}` : missing("full-cell energy density")}</dd>
            </div>
          </>
        )}
        {r.lowTemp && <div><dt>Low temperature</dt><dd>{r.lowTemp}</dd></div>}
        <div>
          <dt>Source</dt>
          <dd>
            PDF page {r.page}. {r.checked ? "Checked by hand against the paper." : "Taken from the abstract; waiting in Review."}
          </dd>
        </div>
      </dl>
      <div className={styles.actions}>
        {canAsk(r.paper) && <Button onClick={() => askAbout(r.paper)}>Ask Amplifi about {r.paper}</Button>}
        <Button variant="quiet" onClick={() => openPaper(r.paper)}>
          Open {r.paper} in the Library
        </Button>
      </div>
    </>
  );
}
