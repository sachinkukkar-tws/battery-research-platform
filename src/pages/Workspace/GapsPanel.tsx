import { useMemo } from "react";
import type { BatteryType } from "@/types";
import { Controls, Field, Select } from "@/components/common/Controls";
import { UntestedGrid } from "@/components/tables/UntestedGrid";
import { EXTRA_GRID_CATHODES } from "@/data/explore";
import { buildPairGrid } from "@/domain/pairs";
import { useResearchData } from "@/state/ResearchDataContext";
import { useViewState } from "@/state/ViewStateContext";
import styles from "./Workspace.module.css";

const BATTERY_OPTIONS = [
  { value: "Sodium-ion", label: "Sodium-ion" },
  { value: "Lithium-ion", label: "Lithium-ion" },
] as const;

export function GapsPanel() {
  const { dataset } = useResearchData();
  const { gridBattery, setGridBattery, showPairsFor } = useViewState();
  const grid = useMemo(() => buildPairGrid(dataset.records, gridBattery, EXTRA_GRID_CATHODES[gridBattery]), [dataset.records, gridBattery]);
  return (
    <>
      <Controls>
        <Field label="Battery type">
          <Select<BatteryType> value={gridBattery} options={BATTERY_OPTIONS} onChange={setGridBattery} />
        </Field>
      </Controls>
      <div className={styles.gapTop}>
        {grid.anodes.length ? <UntestedGrid grid={grid} onSelectCell={showPairsFor} /> : <p className="muted">No {gridBattery.toLowerCase()} anodes in these papers yet.</p>}
      </div>
      <p className={styles.note}>
        Filled squares are pairs tested in the papers; select one to see it. Hatched squares are untested, which is where new research could focus.
      </p>
    </>
  );
}
