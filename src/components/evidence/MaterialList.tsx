import { MATERIAL_KINDS } from "@/domain/explorer";
import { capitalize } from "@/domain/format";
import type { ExtractedMaterial } from "@/types";
import { ValueButton } from "./ValueButton";
import styles from "./Evidence.module.css";

const listWords = (words: string[]) => (words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words.at(-1)}` : (words[0] ?? ""));

/** The cell materials Amplifi found, each opening its source, and one line for the kinds it found none of. */
export function MaterialList({ materials, showPaper = true }: { materials: ExtractedMaterial[]; showPaper?: boolean }) {
  if (!materials.length) return <p className={styles.empty}>No checked materials.</p>;
  const missing = MATERIAL_KINDS.filter((k) => !materials.some((m) => m.kind === k));
  const ordered = [...materials].sort((a, b) => MATERIAL_KINDS.indexOf(a.kind) - MATERIAL_KINDS.indexOf(b.kind));
  return (
    <>
      <dl className={styles.facts}>
        {ordered.map((m) => (
          <div key={`${m.paper}|${m.kind}|${m.quote}`}>
            <dt>{capitalize(m.kind)}</dt>
            <dd>
              <ValueButton source={{ label: capitalize(m.kind), value: m.value, by: "text", item: m }} />
              {showPaper && <span className={styles.paperTag}>{m.paper}</span>}
            </dd>
          </div>
        ))}
      </dl>
      {missing.length > 0 && <p className={`${styles.empty} ${styles.after}`}>No checked value for: {listWords(missing)}.</p>}
    </>
  );
}
