import { useState } from "react";
import type { DatasetId } from "@/types";
import { Card, CardBody, CardHeader } from "@/components/common/Card";
import { Field, Select, Toggle } from "@/components/common/Controls";
import { DropZone } from "@/components/upload/DropZone";
import { UploadCard } from "@/components/upload/UploadCard";
import { DATASET_ORDER, DATASETS } from "@/data/datasets";
import { useServices } from "@/state/ServicesContext";
import { useUploads } from "@/state/UploadsContext";
import styles from "@/components/upload/Upload.module.css";

const DATASET_OPTIONS = DATASET_ORDER.map((id) => ({ value: id, label: `${DATASETS[id].label} dataset` }));

export function UploadPage() {
  const { config } = useServices();
  const { items, addFiles, cancel, retry, dismiss } = useUploads();
  const [datasetId, setDatasetId] = useState<DatasetId>("theme-b");
  const [extract, setExtract] = useState(true);
  const [rejected, setRejected] = useState<string[]>([]);

  return (
    <>
      <Card>
        <CardHeader
          title="Upload papers to Amplifi"
          subtitle="Each PDF is added to an Amplifi dataset, so it can be searched in Ask Amplifi. Its values can also be extracted and sent to Review."
        />
        <CardBody>
          <div className={styles.options}>
            <Field label="Add to">
              <Select wide value={datasetId} options={DATASET_OPTIONS} onChange={setDatasetId} />
            </Field>
            <Toggle label="Extract values and send them to Review" checked={extract} onChange={setExtract} />
          </div>
          <DropZone maxBytes={config.maxUploadBytes} onFiles={(files) => setRejected(addFiles(files, { datasetId, extract }))} />
          {rejected.length > 0 && (
            <div className={styles.rejections} role="alert">
              <strong>
                {rejected.length === 1 ? "One file wasn’t added." : `${rejected.length} files weren’t added.`}
              </strong>
              <ul>
                {rejected.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          {config.mode === "mock" && (
            <p className="small muted" style={{ marginTop: 12 }}>
              Demo mode: files stay in your browser. The steps are simulated so the workflow can be shown.
            </p>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Uploads" subtitle="Progress from upload to Amplifi. Uploads keep going if you open another page." />
        <CardBody>
          {items.length ? (
            <ul className={styles.list} aria-live="polite">
              {items.map((it) => (
                <UploadCard key={it.id} item={it} onCancel={() => cancel(it.id)} onRetry={() => retry(it.id)} onDismiss={() => dismiss(it.id)} />
              ))}
            </ul>
          ) : (
            <p className="muted">No uploads yet in this session.</p>
          )}
        </CardBody>
      </Card>
    </>
  );
}
