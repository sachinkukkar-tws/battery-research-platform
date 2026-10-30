import { Link, NavLink, useParams, useSearchParams } from "react-router-dom";
import { Compass, ExternalLink, MessageSquareText } from "lucide-react";
import { Button, ButtonLink } from "@/components/common/Button";
import { Chip, Formula } from "@/components/common/Badges";
import { Panel } from "@/components/common/Page";
import { Tabs } from "@/components/common/Tabs";
import { ChecksBadge } from "@/components/evidence/ChecksBadge";
import { DataStatus, ExplorerGate } from "@/components/evidence/ExplorerGate";
import { MaterialList } from "@/components/evidence/MaterialList";
import { PerformanceTable } from "@/components/evidence/PerformanceTable";
import { SampleList } from "@/components/evidence/SampleList";
import { ValueButton } from "@/components/evidence/ValueButton";
import { batteryLabel, evidenceChecks, explorerHrefFor, paperByline, paperRecord, paperShortByline, paperTitle } from "@/domain/explorer";
import { useAskAbout, useCanAskAbout } from "@/hooks/useAskAbout";
import { usePdfHref } from "@/hooks/usePdfHref";
import type { ExplorerData, ExplorerPaper, ExtractedFullCell, ExtractedValue } from "@/types";
import styles from "./Papers.module.css";

export function PapersPage() {
  return (
    <>
      <h1 className="visually-hidden">Papers</h1>
      <ExplorerGate>{(data) => <Papers data={data} />}</ExplorerGate>
    </>
  );
}

function Papers({ data }: { data: ExplorerData }) {
  const { paperId } = useParams();
  const papers = Object.values(data.papers).sort((a, b) => a.id.localeCompare(b.id));
  const paper = paperId ? data.papers[paperId] : papers[0];

  return (
    <div className={styles.layout}>
      <nav className={styles.list} aria-label="Client papers">
        <ul>
          {papers.map((p) => (
            <li key={p.id}>
              <NavLink
                to={`/papers/${p.id}`}
                className={({ isActive }) => `${styles.item} ${isActive || (!paperId && p.id === paper?.id) ? styles.current : ""}`}
                aria-current={p.id === paper?.id ? "page" : undefined}
              >
                <span className={styles.itemTop}>
                  <span className={styles.itemId}>{p.id}</span>
                  {p.kind === "review" && <Chip>Review</Chip>}
                </span>
                <span className={styles.itemTitle}>{paperTitle(p)}</span>
                <span className={styles.itemMeta}>{paperShortByline(p)}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className={styles.detailColumn}>
        {paper ? (
          <PaperDetail key={paper.id} data={data} paper={paper} />
        ) : (
          <Panel>
            <p className={styles.muted}>
              {paperId} isn’t in Amplifi’s data. <Link to="/papers">See all papers</Link>
            </p>
          </Panel>
        )}
        <DataStatus data={data} />
      </div>
    </div>
  );
}

function PaperDetail({ data, paper }: { data: ExplorerData; paper: ExplorerPaper }) {
  const [params, setParams] = useSearchParams();
  const pdfHref = usePdfHref();
  const askAbout = useAskAbout();
  const canAsk = useCanAskAbout();
  const record = paperRecord(data, paper.id);
  const inExplorer = explorerHrefFor(data, paper.id);
  const review = paper.kind === "review";
  // The open view stays in the address, and stays put when another paper is opened.
  const view = params.get("view") ?? "performance";

  return (
    <article className={styles.detail} aria-labelledby="paper-title">
      <header className={styles.hero}>
        <p className={styles.eyebrow}>
          {[paper.id, paper.battery && batteryLabel(paper.battery)].filter(Boolean).join(" · ")}
          {review && <Chip>Review</Chip>}
        </p>
        <h2 className={styles.title} id="paper-title">
          {paperTitle(paper)}
        </h2>
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
        </p>
        {review && <p className={styles.notice}>A review: its values come from the studies it covers, as it reports them.</p>}
        <div className={styles.actions}>
          <ButtonLink href={pdfHref(paper.id)} target="_blank" rel="noreferrer">
            Open the PDF <ExternalLink aria-hidden="true" />
          </ButtonLink>
          {canAsk(paper.id) && (
            <Button variant="quiet" onClick={() => askAbout(paper.id)} aria-label={`Ask Amplifi about ${paper.id}`}>
              <MessageSquareText aria-hidden="true" /> Ask Amplifi
            </Button>
          )}
          {inExplorer && (
            <Link to={inExplorer} className={styles.explorerLink}>
              <Compass aria-hidden="true" /> See it in the Explorer
            </Link>
          )}
          <ChecksBadge checks={evidenceChecks(data, paper.id)} />
        </div>
      </header>

      <Panel>
        <Tabs
          label="What Amplifi found in this paper"
          value={view}
          onChange={(v) => setParams({ view: v }, { replace: true })}
          items={[
            {
              id: "performance",
              label: "Performance",
              count: record.performance.length,
              content: <PerformanceTable values={record.performance} showPaper={false} />,
            },
            { id: "synthesis", label: "Synthesis", count: record.anodes.length, content: <SampleList samples={record.anodes} showPaper={false} /> },
            {
              id: "cells",
              label: "Full cells",
              count: record.fullCells.length,
              content: <FullCells cells={record.fullCells} performance={record.performance} />,
            },
            { id: "materials", label: "Materials", count: record.materials.length, content: <MaterialList materials={record.materials} showPaper={false} /> },
          ]}
        />
      </Panel>
    </article>
  );
}

/** The paper's full cells, each with its cathode, cell format and source. */
function FullCells({ cells, performance }: { cells: ExtractedFullCell[]; performance: ExtractedValue[] }) {
  if (!cells.length) {
    return (
      <p className={styles.muted}>
        {performance.some((v) => v.testType === "half cell")
          ? "Amplifi found no full cells in this paper, only half-cell (anode) tests."
          : "Amplifi found no full cells in this paper."}
      </p>
    );
  }
  return (
    <ul className={styles.cells}>
      {cells.map((c) => (
        <li key={`${c.anodeSample}|${c.cathode}|${c.cellFormat}`}>
          <span className={styles.cellPair}>
            {c.anodeSample} <span aria-hidden="true">→</span>
            <span className="visually-hidden">with</span> {c.cathodeLabel}
          </span>
          <span className={styles.cellMeta}>
            {c.cathodeFormula && c.cathodeFormula !== c.cathodeLabel && (
              <>
                <Formula value={c.cathodeFormula} /> ·{" "}
              </>
            )}
            {c.cellFormat === "not stated" ? "cell format not stated" : `${c.cellFormat} cell`} ·{" "}
            <ValueButton source={{ label: "Full cell", value: c.cathodeShortName ?? c.cathode.split(" (")[0]!, by: "text", item: c }}>p. {c.page}</ValueButton>
          </span>
        </li>
      ))}
    </ul>
  );
}
