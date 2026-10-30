import { useState } from "react";
import type { ExtractedAnode } from "@/types";
import { ValueButton } from "./ValueButton";
import styles from "./Evidence.module.css";

/** Texts longer than this fold to two lines, with a button to read the rest. */
const FOLD_AT = 140;

function Folded({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (text.length <= FOLD_AT) return <>{text}</>;
  return (
    <>
      <span className={open ? undefined : styles.clamp}>{text}</span>
      <button type="button" className={styles.more} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? "Less" : "More"}
      </button>
    </>
  );
}

/** How each anode sample was made: starting material, method and final heat treatment, each with its source. */
export function SampleList({ samples, showPaper = true }: { samples: ExtractedAnode[]; showPaper?: boolean }) {
  if (!samples.length) return <p className={styles.empty}>No checked anode samples.</p>;
  return (
    <ul className={styles.samples}>
      {samples.map((s) => (
        <li key={`${s.paper}|${s.sample}|${s.quote}`}>
          <p className={styles.sampleName}>
            {s.sample}
            <span>
              {showPaper ? `${s.paper}, ` : ""}
              <ValueButton source={{ label: `How ${s.sample} was made`, value: s.temperature ?? s.sample, by: s.temperature ? "numbers" : "text", item: s }}>
                p. {s.page}
              </ValueButton>
            </span>
          </p>
          {s.precursor || s.method || s.temperature ? (
            <dl className={styles.facts}>
              {s.precursor && (
                <div>
                  <dt>Starting material</dt>
                  <dd>
                    <Folded text={s.precursor} />
                  </dd>
                </div>
              )}
              {s.method && (
                <div>
                  <dt>Method</dt>
                  <dd>
                    <Folded text={s.method} />
                  </dd>
                </div>
              )}
              {s.temperature && (
                <div>
                  <dt>Final heat</dt>
                  <dd>{s.temperature}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className={styles.empty}>No checked details on how it was made.</p>
          )}
        </li>
      ))}
    </ul>
  );
}
