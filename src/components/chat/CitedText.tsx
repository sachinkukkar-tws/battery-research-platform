import { memo, useMemo } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { answerToMarkdown, CITE_HREF_PREFIX } from "@/domain/markdown";
import styles from "./Chat.module.css";

/**
 * Answer text rendered from Markdown (headings, bold, lists, tables), with inline [CP07]-style
 * markers turned into buttons that open the paper. Raw HTML in the answer is never rendered.
 */
export const CitedText = memo(function CitedText({ text, onCite }: { text: string; onCite: (paperId: string) => void }) {
  const components = useMemo<Components>(
    () => ({
      a: ({ href, children }) => {
        if (href?.startsWith(CITE_HREF_PREFIX)) {
          const paperId = href.slice(CITE_HREF_PREFIX.length);
          return (
            <button type="button" className={styles.cite} onClick={() => onCite(paperId)} aria-label={`Source ${paperId}, open in the Library`}>
              {paperId}
            </button>
          );
        }
        return (
          <a href={href} target="_blank" rel="noreferrer">
            {children}
          </a>
        );
      },
      // The page already has an h1; answer headings sit below it.
      h1: ({ children }) => <h3>{children}</h3>,
      h2: ({ children }) => <h3>{children}</h3>,
      h3: ({ children }) => <h4>{children}</h4>,
      h4: ({ children }) => <h4>{children}</h4>,
      h5: ({ children }) => <h4>{children}</h4>,
      h6: ({ children }) => <h4>{children}</h4>,
      table: ({ children }) => (
        <div className={styles.tableWrap}>
          <table>{children}</table>
        </div>
      ),
    }),
    [onCite],
  );
  return (
    <div className={styles.markdown}>
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {answerToMarkdown(text)}
      </Markdown>
    </div>
  );
});
