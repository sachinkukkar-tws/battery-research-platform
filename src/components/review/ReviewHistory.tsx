import type { ReviewDecision } from "@/types";
import { capitalize } from "@/domain/format";
import { Card, CardBody, CardHeader } from "@/components/common/Card";
import styles from "./Review.module.css";

export function ReviewHistory({ decisions }: { decisions: ReviewDecision[] }) {
  if (!decisions.length) return null;
  return (
    <Card>
      <CardHeader title="Done in this session" level={2} />
      <CardBody>
        <ul className={styles.doneList}>
          {decisions.map((d) => (
            <li key={d.item.id} className={styles.doneRow}>
              <span className={styles[d.outcome]}>{capitalize(d.outcome)}</span>
              <span>{d.item.paper}: {d.item.field}</span>
              <span className="muted">{d.finalValue}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
