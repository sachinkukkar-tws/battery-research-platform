import { useMemo } from "react";
import { Card, CardBody, CardHeader } from "@/components/common/Card";
import { Controls, Field, SegmentedControl, Select, Toggle, type Option } from "@/components/common/Controls";
import { DataGate } from "@/components/common/DataGate";
import { ChartLegend } from "@/components/charts/ChartLegend";
import { Insights } from "@/components/charts/Insights";
import { RankingChart } from "@/components/charts/RankingChart";
import { ScatterChart } from "@/components/charts/ScatterChart";
import { CHART_FIELD_LIST, CHART_FIELDS, type ChartFieldKey } from "@/domain/chartFields";
import { rankingModel, scatterModel, type ColorBy } from "@/domain/charts";
import { useDetailDialog } from "@/state/DetailDialogContext";
import { useResearchData } from "@/state/ResearchDataContext";
import { useViewState, type ChartSettings } from "@/state/ViewStateContext";
import styles from "./Charts.module.css";

const FIELD_OPTIONS: Option<ChartFieldKey>[] = CHART_FIELD_LIST.map((f) => ({ value: f.key, label: f.label }));
const MODE_OPTIONS: Option<ChartSettings["mode"]>[] = [
  { value: "scatter", label: "Compare two values" },
  { value: "rank", label: "Rank by one value" },
];
const COLOR_OPTIONS: Option<ColorBy>[] = [
  { value: "battery", label: "Battery type" },
  { value: "from", label: "Anode starting material" },
];

export function ChartsPage() {
  return (
    <Card>
      <CardHeader title="Charts" subtitle="Compare two values across every material, or rank materials by one value" />
      <CardBody>
        <DataGate label="Loading the measurements">
          <Charts />
        </DataGate>
      </CardBody>
    </Card>
  );
}

function Charts() {
  const { dataset } = useResearchData();
  const { openPair } = useDetailDialog();
  const { chart: c, updateChart } = useViewState();
  const scatter = c.mode === "scatter";

  const model = useMemo(
    () =>
      scatter
        ? scatterModel(dataset.records, CHART_FIELDS[c.x], CHART_FIELDS[c.y], c.colorBy)
        : rankingModel(dataset.records, CHART_FIELDS[c.rank], c.colorBy),
    [scatter, dataset.records, c.x, c.y, c.rank, c.colorBy],
  );

  return (
    <>
      <Controls>
        <SegmentedControl label="Chart" value={c.mode} options={MODE_OPTIONS} onChange={(mode) => updateChart({ mode })} />
        {scatter ? (
          <>
            <Field label="Horizontal axis">
              <Select value={c.x} options={FIELD_OPTIONS} onChange={(x) => updateChart({ x })} />
            </Field>
            <Field label="Vertical axis">
              <Select value={c.y} options={FIELD_OPTIONS} onChange={(y) => updateChart({ y })} />
            </Field>
          </>
        ) : (
          <Field label="Value">
            <Select value={c.rank} options={FIELD_OPTIONS} onChange={(rank) => updateChart({ rank })} />
          </Field>
        )}
        <Field label="Colour by">
          <Select value={c.colorBy} options={COLOR_OPTIONS} onChange={(colorBy) => updateChart({ colorBy })} />
        </Field>
      </Controls>
      {scatter && (
        <Controls className={styles.toggles}>
          <Toggle label="Names" checked={c.showLabels} onChange={(showLabels) => updateChart({ showLabels })} />
          <Toggle label="Best balance" checked={c.showBest} onChange={(showBest) => updateChart({ showBest })} />
          <Toggle label="Trend line" checked={c.showTrend} onChange={(showTrend) => updateChart({ showTrend })} />
        </Controls>
      )}
      <div className={styles.layout}>
        <div>
          <div className={styles.wrap}>
            {model.kind === "scatter" ? (
              <ScatterChart
                model={model}
                colorBy={c.colorBy}
                showLabels={c.showLabels}
                showBest={c.showBest}
                showTrend={c.showTrend}
                onSelect={openPair}
              />
            ) : (
              <RankingChart model={model} colorBy={c.colorBy} onSelect={openPair} />
            )}
          </div>
          <ChartLegend colorBy={c.colorBy} showBest={scatter && c.showBest && model.kind === "scatter" && model.best.length > 0} />
        </div>
        <Insights items={model.insights} note={model.note} />
      </div>
    </>
  );
}
