import type { UploadItem } from "@/types";
import { Button } from "@/components/common/Button";
import { DATASETS } from "@/data/datasets";
import { formatFileSize } from "@/domain/format";
import { uploadStepNames } from "@/domain/upload";
import styles from "./Upload.module.css";

interface UploadCardProps {
  item: UploadItem;
  onCancel: () => void;
  onRetry: () => void;
  onDismiss: () => void;
}

const STATUS_TEXT: Record<UploadItem["status"], string> = {
  uploading: "Uploading",
  processing: "Processing",
  completed: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
};

type StepState = "done" | "now" | "pending" | "unknown";

function stepState(item: UploadItem, i: number, processingReported: boolean): StepState {
  if (item.status === "completed") {
    if (processingReported) return "done";
    return i === 0 ? "done" : "unknown";
  }
  if (item.status === "uploading") return i === 0 ? "now" : "pending";
  if (item.status === "processing") {
    // The file itself has arrived, so step 0 is done even before the backend reports a stage.
    const current = Math.max(item.stage, 1);
    return i < current ? "done" : i === current ? "now" : "pending";
  }
  return i < item.stage ? "done" : "pending";
}

export function UploadCard({ item, onCancel, onRetry, onDismiss }: UploadCardProps) {
  const ds = DATASETS[item.options.datasetId];
  const steps = uploadStepNames(item.options.extract);
  const active = item.status === "uploading" || item.status === "processing";
  const processingReported = item.origin === "mock" || item.stage > 0;
  const pct = Math.round(item.progress * 100);

  return (
    <li className={`${styles.up} ${styles[item.status]}`}>
      <div className={styles.upHead}>
        <span className={styles.name}>{item.fileName}</span>
        <span className={`${styles.badge} ${styles[`b-${item.status}`]}`}>{STATUS_TEXT[item.status]}</span>
      </div>
      <div className={styles.dest}>
        To {ds.label}
        {item.options.extract ? ", with values sent to Review" : ""}. {formatFileSize(item.size)}
      </div>
      {item.status === "uploading" && (
        <div className={styles.progress} role="progressbar" aria-label={`Uploading ${item.fileName}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <span style={{ width: `${pct}%` }} />
        </div>
      )}
      <ol className={styles.steps} aria-label="Progress">
        {steps.map((s, i) => {
          const st = stepState(item, i, processingReported);
          return (
            <li key={s} className={styles[`step-${st}`]}>
              {s}
              <span className="visually-hidden">
                {{ done: ", done", now: ", in progress", pending: ", not started", unknown: ", status not reported" }[st]}
              </span>
            </li>
          );
        })}
      </ol>
      {item.message && <p className={`small muted ${styles.msg}`}>{item.message}</p>}
      {item.error && (
        <p className={`small ${styles.err}`} role="alert">
          Upload failed. {item.error}
        </p>
      )}
      <div className={styles.upActions}>
        {active && <Button variant="quiet" onClick={onCancel}>Cancel upload</Button>}
        {(item.status === "failed" || item.status === "cancelled") && <Button variant="quiet" onClick={onRetry}>Try again</Button>}
        {!active && <Button variant="link" className="small" onClick={onDismiss}>Remove from list</Button>}
      </div>
    </li>
  );
}
