import { useMemo } from "react";
import { Controls, Field, Select, type Option } from "@/components/common/Controls";
import { CompareTable } from "@/components/tables/CompareTable";
import { pairName } from "@/domain/pairs";
import { useResearchData } from "@/state/ResearchDataContext";
import { useViewState } from "@/state/ViewStateContext";
import styles from "./Workspace.module.css";

export function ComparePanel() {
  const { dataset, recordById } = useResearchData();
  const { compareSlots, setCompareSlot } = useViewState();

  const options = useMemo<Option[]>(
    () => dataset.records.filter((r) => r.cathode).map((r) => ({ value: r.id, label: `${pairName(r)}, ${r.cell} (${r.paper})` })),
    [dataset.records],
  );
  const withNone = useMemo(() => [{ value: "", label: "None" }, ...options], [options]);
  const selected = compareSlots.filter(Boolean).map(recordById).filter((r) => r !== undefined);

  return (
    <>
      <Controls>
        {([0, 1, 2] as const).map((i) => (
          <Field key={i} label={i === 2 ? "Pair 3 (optional)" : `Pair ${i + 1}`} grow>
            <Select value={compareSlots[i]} options={withNone} onChange={(id) => setCompareSlot(i, id)} />
          </Field>
        ))}
      </Controls>
      <div className={styles.gapTop}>
        {selected.length ? <CompareTable records={selected} /> : <p className="muted">Choose at least one pair to compare.</p>}
      </div>
      <p className={styles.note}>Energy densities are only comparable when they’re based on the same mass, so the basis is shown with each value.</p>
    </>
  );
}
