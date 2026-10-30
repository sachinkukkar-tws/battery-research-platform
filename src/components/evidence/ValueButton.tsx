import type { ReactNode } from "react";
import { METRIC_LABEL, formatUnits } from "@/domain/explorer";
import { useDetailDialog, type SourceRef } from "@/state/DetailDialogContext";
import type { ExtractedValue } from "@/types";
import styles from "./Evidence.module.css";

/** A value that opens the sentence and PDF page it came from. */
export function ValueButton({ source, children }: { source: SourceRef; children?: ReactNode }) {
  const { showSource } = useDetailDialog();
  return (
    <button type="button" className={styles.value} onClick={() => showSource(source)}>
      {children ?? formatUnits(source.value)}
    </button>
  );
}

export const valueSource = (v: ExtractedValue): SourceRef => ({ label: METRIC_LABEL[v.metric], value: v.value, by: "numbers", item: v });
