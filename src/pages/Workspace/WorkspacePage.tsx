import { useId, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, CircleCheck, Clock, Link2, Library, RefreshCw } from "lucide-react";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/common/Card";
import { DataGate } from "@/components/common/DataGate";
import { Tabs, TabCount, tabPanelProps, type TabDef } from "@/components/common/Tabs";
import { DonutChart } from "@/components/charts/DonutChart";
import { ScatterChart } from "@/components/charts/ScatterChart";
import { CHART_FIELDS } from "@/domain/chartFields";
import { scatterModel } from "@/domain/charts";
import { statusCounts } from "@/domain/library";
import { plural } from "@/domain/format";
import { useDetailDialog } from "@/state/DetailDialogContext";
import { useResearchData } from "@/state/ResearchDataContext";
import { useViewState, type ExploreTab } from "@/state/ViewStateContext";
import { ComparePanel } from "./ComparePanel";
import { FindPairsPanel } from "./FindPairsPanel";
import { GapsPanel } from "./GapsPanel";
import { StatCard } from "./StatCard";
import styles from "./Workspace.module.css";

export function WorkspacePage() {
  return (
    <DataGate>
      <Workspace />
    </DataGate>
  );
}

function Workspace() {
  const { library, queue, dataset, checkedValueCount } = useResearchData();
  const { openPair } = useDetailDialog();
  const view = useViewState();
  const exploreRef = useRef<HTMLDivElement>(null);
  const tabsId = useId();

  const counts = useMemo(() => statusCounts(library), [library]);
  const tested = useMemo(() => dataset.records.filter((r) => r.cathode), [dataset.records]);
  const testedPapers = new Set(tested.map((r) => r.paper)).size;
  const mini = useMemo(() => scatterModel(dataset.records, CHART_FIELDS.capacity, CHART_FIELDS.ice, "battery"), [dataset.records]);

  const showTestedPairs = () => {
    view.resetPairFilters();
    view.setExploreTab("pairs");
    exploreRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    exploreRef.current?.focus({ preventScroll: true });
  };

  const tabs: TabDef<ExploreTab>[] = [
    { id: "pairs", label: "Find pairs" },
    { id: "compare", label: <>Compare<TabCount n={view.picked.length} /></> },
    { id: "gaps", label: "Untested pairs" },
  ];

  return (
    <>
      <h2 className="visually-hidden">Overview</h2>
      <div className={styles.statGrid}>
        <StatCard to="/library" icon={Library} tone="primary" label="Papers" value={library.length}
          foot={`${counts.Checked} checked, ${counts.Extracted} extracted`} footIcon={RefreshCw} />
        <StatCard to="/charts" icon={CircleCheck} tone="success" label="Values checked"
          value={checkedValueCount ?? "Not reported"} foot="Checked against the papers" footIcon={BarChart3} />
        <StatCard to="/review" icon={Clock} tone="warning" label="Waiting for review" value={queue.length}
          foot={queue.length ? "Review now" : "Nothing waiting"} footIcon={ArrowRight} />
        <StatCard onClick={showTestedPairs} icon={Link2} tone="info" label="Tested pairs" value={tested.length}
          foot={`From ${testedPapers} ${plural(testedPapers, "paper")}`} footIcon={ArrowRight} />
      </div>

      <div className={styles.grid2}>
        <Card>
          <CardHeader title="Materials at a glance" subtitle="Reversible capacity against first-cycle efficiency, from the anode tests" />
          <CardBody>
            <ScatterChart model={mini} colorBy="battery" compact showBest={false} onSelect={openPair} />
          </CardBody>
          <CardFooter>
            <BarChart3 aria-hidden="true" />
            <Link to="/charts" className={styles.footLink}>Open Charts for more values</Link>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader title="Paper status" subtitle="How far each paper has got" />
          <CardBody>
            <DonutChart
              title="Papers by status"
              centerValue={library.length}
              centerLabel="papers"
              parts={[
                { label: "Checked", value: counts.Checked, color: "var(--success)" },
                { label: "Extracted", value: counts.Extracted, color: "var(--warning)" },
                { label: "Harvested", value: counts.Harvested, color: "var(--rule)" },
              ]}
            />
          </CardBody>
          <CardFooter>
            <CircleCheck aria-hidden="true" />
            <span>{counts.Checked} {plural(counts.Checked, "paper has", "papers have")} every value checked</span>
          </CardFooter>
        </Card>
      </div>

      <Card>
        <div ref={exploreRef} tabIndex={-1} className={styles.anchor}>
          <CardHeader title="Explore results" subtitle="Which anode and cathode combinations have been tested, and how they performed">
            <Tabs idBase={tabsId} label="Explore views" tabs={tabs} active={view.exploreTab} onChange={view.setExploreTab} />
          </CardHeader>
        </div>
        <CardBody className={styles.tabBody}>
          <div {...tabPanelProps(tabsId, view.exploreTab)}>
            {view.exploreTab === "pairs" && <FindPairsPanel />}
            {view.exploreTab === "compare" && <ComparePanel />}
            {view.exploreTab === "gaps" && <GapsPanel />}
          </div>
        </CardBody>
      </Card>
    </>
  );
}
