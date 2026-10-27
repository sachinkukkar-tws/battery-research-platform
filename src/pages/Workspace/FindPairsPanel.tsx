import { useMemo } from "react";
import { Button } from "@/components/common/Button";
import { Controls, Field, Select, Toggle, type Option } from "@/components/common/Controls";
import { EmptyState } from "@/components/common/Feedback";
import { PairList } from "@/components/tables/PairList";
import { QUICK_QUESTIONS } from "@/data/explore";
import { extraFilterCount, filterPairs, pairSummary, uniqueByAnode, uniqueCathodes, type FormatFilter, type PairSort } from "@/domain/pairs";
import { useDetailDialog } from "@/state/DetailDialogContext";
import { useResearchData } from "@/state/ResearchDataContext";
import { useViewState } from "@/state/ViewStateContext";
import styles from "./Workspace.module.css";

const SORT_OPTIONS: Option<PairSort>[] = [
  { value: "cycles", label: "Most cycles" },
  { value: "energy", label: "Highest energy density" },
  { value: "paper", label: "Paper" },
];

const FORMAT_OPTIONS: Option<FormatFilter>[] = [
  { value: "all", label: "Any format" },
  { value: "scaled", label: "Pouch or cylindrical" },
  { value: "Pouch", label: "Pouch" },
  { value: "Cylindrical", label: "Cylindrical" },
  { value: "Coin", label: "Coin" },
  { value: "Not stated", label: "Format not stated" },
];

export function FindPairsPanel() {
  const { dataset } = useResearchData();
  const { openPair } = useDetailDialog();
  const v = useViewState();
  const f = v.pairFilters;
  const records = dataset.records;

  const anodeOptions = useMemo<Option[]>(
    () => [{ value: "all", label: "Any anode" }, ...uniqueByAnode(records).map((r) => ({ value: r.anode, label: `${r.anode} (${r.paper})` }))],
    [records],
  );
  const cathodeOptions = useMemo<Option[]>(
    () => [{ value: "all", label: "Any cathode" }, ...uniqueCathodes(records).map((c) => ({ value: c, label: c }))],
    [records],
  );
  const quickOptions = useMemo<Option[]>(
    () => [{ value: "", label: "Choose a question…" }, ...QUICK_QUESTIONS.map((q, i) => ({ value: String(i), label: q.question }))],
    [],
  );

  const list = useMemo(() => filterPairs(records, f), [records, f]);
  const summary = pairSummary(list, f, v.pairFocus);
  const extras = extraFilterCount(f);

  return (
    <>
      <Controls>
        <Field label="Quick question">
          <Select
            wide
            value={v.quickQuestion == null ? "" : String(v.quickQuestion)}
            options={quickOptions}
            onChange={(val) => {
              const q = val === "" ? undefined : QUICK_QUESTIONS[Number(val)];
              if (q) v.applyQuickQuestion(Number(val), q.set, q.focus);
              else v.resetPairFilters();
            }}
          />
        </Field>
        <Field label="Anode">
          <Select value={f.anode} options={anodeOptions} onChange={(anode) => v.updatePairFilters({ anode })} />
        </Field>
        <Field label="Cathode">
          <Select value={f.cathode} options={cathodeOptions} onChange={(cathode) => v.updatePairFilters({ cathode })} />
        </Field>
        <Field label="Sort by">
          <Select value={f.sort} options={SORT_OPTIONS} onChange={(sort) => v.updatePairFilters({ sort })} />
        </Field>
      </Controls>

      <details className={styles.more} open={v.moreOptionsOpen} onToggle={(e) => v.setMoreOptionsOpen(e.currentTarget.open)}>
        <summary>
          More options
          {extras > 0 && <span className={styles.on}>{extras} on</span>}
        </summary>
        <Controls>
          <Field label="Cell format">
            <Select value={f.format} options={FORMAT_OPTIONS} onChange={(format) => v.updatePairFilters({ format })} />
          </Field>
          <Field label="Battery type">
            <Select
              value={f.battery}
              options={[{ value: "all", label: "Any type" }, { value: "Sodium-ion", label: "Sodium-ion" }, { value: "Lithium-ion", label: "Lithium-ion" }] as const}
              onChange={(battery) => v.updatePairFilters({ battery })}
            />
          </Field>
          <Field label="Anode made from">
            <Select
              value={f.from}
              options={[{ value: "all", label: "Any material" }, { value: "Biomass", label: "Biomass" }, { value: "Other", label: "Other" }] as const}
              onChange={(from) => v.updatePairFilters({ from })}
            />
          </Field>
          <Toggle label="Low-temperature data" checked={f.lowTemp} onChange={(lowTemp) => v.updatePairFilters({ lowTemp })} />
        </Controls>
      </details>

      <Button variant="link" onClick={v.resetPairFilters}>
        Clear all options
      </Button>
      <p className={styles.summary} aria-live="polite">
        {summary}
      </p>
      {list.length ? (
        <PairList records={list} picked={v.picked} onOpen={openPair} onTogglePick={v.togglePicked} />
      ) : (
        <EmptyState
          action={
            <Button variant="link" onClick={v.resetPairFilters}>
              Clear the options
            </Button>
          }
        >
          No pairs match these options.
        </EmptyState>
      )}
    </>
  );
}
