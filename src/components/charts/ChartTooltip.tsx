import type { ResearchRecord } from "@/types";
import type { ChartField } from "@/domain/chartFields";
import { formatValue } from "@/domain/charts";
import styles from "./Charts.module.css";

interface ChartTooltipProps {
  record: ResearchRecord;
  label: string;
  fields: ChartField[];
  /** Position as fractions of the chart's width and height. */
  left: number;
  top: number;
  id: string;
}

export function ChartTooltip({ record, label, fields, left, top, id }: ChartTooltipProps) {
  const flip = left > 0.6;
  return (
    <div
      id={id}
      role="tooltip"
      className={styles.tip}
      style={{
        left: `${left * 100}%`,
        top: `${top * 100}%`,
        transform: `translate(${flip ? "calc(-100% - 14px)" : "14px"}, -100%)`,
      }}
    >
      <strong>{label}</strong>
      {fields.map((f) => {
        const v = f.get(record);
        const note = f.note?.(record);
        return (
          <div key={f.key}>
            {f.label}: {v == null ? "Not reported" : formatValue(f, v)}
            {note ? ` (${note})` : ""}
          </div>
        );
      })}
      <div className={styles.tipSource}>
        {record.paper}
        {record.checked ? ", checked by hand" : ", not yet checked"}
      </div>
    </div>
  );
}
