import { useId, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { ButtonLink } from "@/components/common/Button";
import { Chip, Formula } from "@/components/common/Badges";
import { Panel } from "@/components/common/Page";
import { Tabs } from "@/components/common/Tabs";
import { ChecksBadge } from "@/components/evidence/ChecksBadge";
import { MaterialList } from "@/components/evidence/MaterialList";
import { PerformanceTable } from "@/components/evidence/PerformanceTable";
import { SampleList } from "@/components/evidence/SampleList";
import { DataStatus, ExplorerGate } from "@/components/evidence/ExplorerGate";
import { ValueButton, valueSource } from "@/components/evidence/ValueButton";
import {
  STRENGTH_RULE,
  anodeSlug,
  anodeTypes,
  batteryLabel,
  cathodesFor,
  evidenceChecks,
  familyLabel,
  formatUnits,
  highlights,
  pairView,
  paperShortByline,
  paperTitle,
  type AnodeType,
  type CathodeOption,
  type PairView,
} from "@/domain/explorer";
import { plural } from "@/domain/format";
import { usePdfHref } from "@/hooks/usePdfHref";
import type { ExplorerData } from "@/types";
import styles from "./Explorer.module.css";

const STRENGTH_CLASS = {
  Strong: styles.strong,
  Moderate: styles.moderate,
  Limited: styles.limited,
} as const;
const listWords = (words: string[]) => (words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words.at(-1)}` : (words[0] ?? ""));

export function ExplorerPage() {
  return (
    <>
      <h1 className="visually-hidden">Explorer</h1>
      <ExplorerGate>{(data) => <Explorer data={data} />}</ExplorerGate>
    </>
  );
}

function Explorer({ data }: { data: ExplorerData }) {
  const [params, setParams] = useSearchParams();
  const anodeId = useId();
  const cathodeId = useId();
  const types = useMemo(() => anodeTypes(data), [data]);
  const type = types.find((t) => anodeSlug(t) === params.get("anode")) ?? types[0];
  const cathodes = useMemo(() => (type ? cathodesFor(data, type) : []), [data, type]);
  const cathode = cathodes.find((c) => c.label === params.get("cathode")) ?? cathodes[0];
  const pair = useMemo(() => (type && cathode ? pairView(data, type, cathode) : null), [data, type, cathode]);
  const view = params.get("view") ?? "performance";
  // The pair and the open view live in the address, so the search can open a pair, it can be shared, and Back works.
  // The view stays as it is when another pair is picked, to compare pairs side by side.
  const choose = (t: AnodeType, c?: string) => setParams({ anode: anodeSlug(t), ...(c ? { cathode: c } : {}), ...(params.get("view") ? { view } : {}) });
  const showView = (v: string) => setParams({ ...Object.fromEntries(params), view: v }, { replace: true });

  return (
    <div className={styles.layout}>
      <aside className={styles.rail} aria-label="Choose a pair">
        <section>
          <h2 className={styles.railTitle} id={anodeId}>
            Anode
          </h2>
          <div className={styles.options} role="group" aria-labelledby={anodeId}>
            {types.map((t) => (
              <button key={t.key} type="button" className={styles.option} aria-pressed={t.key === type?.key} onClick={() => choose(t)}>
                <span className={styles.optionTop}>
                  {familyLabel(t.family)}
                  <span className={styles.count}>
                    {t.papers.length} {plural(t.papers.length, "paper")}
                  </span>
                </span>
                <span className={styles.optionSub}>{batteryLabel(t.battery)}</span>
              </button>
            ))}
          </div>
        </section>
        <section>
          <h2 className={styles.railTitle} id={cathodeId}>
            Cathode
          </h2>
          {cathodes.length && type ? (
            <div className={styles.options} role="group" aria-labelledby={cathodeId}>
              {cathodes.map((c) => (
                <CathodeOptionButton key={c.label} cathode={c} pressed={c.label === cathode?.label} onPick={() => choose(type, c.label)} />
              ))}
            </div>
          ) : (
            <p className={styles.optionSub}>Amplifi found no checked full cells with this anode.</p>
          )}
          <details className={styles.rule}>
            <summary>How evidence is rated</summary>
            <p>{STRENGTH_RULE}</p>
          </details>
        </section>
      </aside>

      <div className={styles.content}>
        {type && cathode && pair ? (
          <PairDetails
            key={`${type.key}|${cathode.label}`}
            data={data}
            pair={pair}
            family={familyLabel(type.family)}
            cathode={cathode}
            view={view}
            onView={showView}
          />
        ) : (
          <Panel>
            <p className={styles.optionSub}>Pick an anode with full cells to see a pair.</p>
          </Panel>
        )}
        <DataStatus data={data} />
      </div>
    </div>
  );
}

function CathodeOptionButton({ cathode, pressed, onPick }: { cathode: CathodeOption; pressed: boolean; onPick: () => void }) {
  const n = cathode.papers.length;
  return (
    <button type="button" className={styles.option} aria-pressed={pressed} onClick={onPick}>
      <span className={styles.optionTop}>
        {cathode.label}
        <span className={`${styles.strength} ${STRENGTH_CLASS[cathode.strength]}`}>{cathode.strength}</span>
      </span>
      <span className={styles.optionSub}>
        {n} {plural(n, "paper")}
      </span>
    </button>
  );
}

interface PairDetailsProps {
  data: ExplorerData;
  pair: PairView;
  family: string;
  cathode: CathodeOption;
  view: string;
  onView: (view: string) => void;
}

function PairDetails({ data, pair, family, cathode, view, onView }: PairDetailsProps) {
  const battery = data.papers[pair.papers[0] ?? ""]?.battery;
  const top = highlights(pair);
  const papers = [...new Set([...pair.evidence["full cell"], ...pair.evidence["half cell"], ...pair.evidence.review])];
  const formula = cathode.formula && cathode.formula !== cathode.label ? cathode.formula : null;

  return (
    <>
      <section className={styles.hero} aria-labelledby="explorer-pair">
        <p className={styles.eyebrow}>
          {batteryLabel(battery ?? null)} · {pair.papers.length} {plural(pair.papers.length, "paper")} with full cells
        </p>
        <h2 className={styles.pairTitle} id="explorer-pair">
          {family} + {cathode.label}
        </h2>
        {(formula || cathode.formats.length > 0) && (
          <p className={styles.formula}>
            {formula && (
              <>
                Cathode <Formula value={formula} />
              </>
            )}
            {formula && cathode.formats.length > 0 && " · "}
            {cathode.formats.length > 0 && `${listWords(cathode.formats)} cells`}
          </p>
        )}
        {top.length > 0 && (
          <ul className={styles.glance} aria-label="At a glance">
            {top.map((h) => (
              <li key={h.label}>
                <span className={styles.glanceLabel}>{h.label}</span>
                <ValueButton source={valueSource(h.item)}>
                  <span className={styles.glanceValue}>{formatUnits(h.text)}</span>
                </ValueButton>
                <span className={styles.glanceFrom}>
                  {h.item.sample}, {h.item.paper}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Panel>
        <Tabs
          label="About this pair"
          value={view}
          onChange={onView}
          items={[
            { id: "performance", label: "Performance", count: pair.performance.length, content: <PerformanceTable values={pair.performance} /> },
            { id: "synthesis", label: "Synthesis", count: pair.samples.length, content: <SampleList samples={pair.samples} /> },
            { id: "materials", label: "Materials", count: pair.materials.length, content: <MaterialList materials={pair.materials} /> },
            { id: "papers", label: "Papers", count: papers.length, content: <PaperRows data={data} pair={pair} papers={papers} /> },
          ]}
        />
      </Panel>
    </>
  );
}

/** The pair's papers: what each tests, how many evidence checks it passes, and its PDF. */
function PaperRows({ data, pair, papers }: { data: ExplorerData; pair: PairView; papers: string[] }) {
  const pdfHref = usePdfHref();
  return (
    <ul className={styles.papers}>
      {papers.map((pid) => {
        const paper = data.papers[pid];
        if (!paper) return null;
        const tests = [
          pair.evidence["full cell"].includes(pid) && "Full cell",
          pair.evidence["half cell"].includes(pid) && "Half cell",
          pair.evidence.review.includes(pid) && "Review",
        ].filter((t): t is string => !!t);
        return (
          <li key={pid}>
            <article className={styles.paper} aria-label={`${pid}: ${paperTitle(paper)}`}>
              <div className={styles.paperText}>
                <Link to={`/papers/${pid}`} className={styles.paperLink}>
                  <span className={styles.paperId}>{pid}</span> {paperTitle(paper)}
                </Link>
                <div className={styles.paperTags}>
                  <span>{paperShortByline(paper)}</span>
                  {tests.map((t) => (
                    <Chip key={t}>{t}</Chip>
                  ))}
                  <ChecksBadge checks={evidenceChecks(data, pid)} />
                </div>
              </div>
              <ButtonLink variant="quiet" href={pdfHref(pid)} target="_blank" rel="noreferrer" aria-label={`Open the PDF of ${pid}`}>
                PDF <ExternalLink aria-hidden="true" />
              </ButtonLink>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
