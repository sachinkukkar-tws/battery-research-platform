import { CITATION_PATTERN, citationParts } from "./citations";

/** Link target used for citation markers, so the renderer can turn them back into Library buttons. */
export const CITE_HREF_PREFIX = "#cite-";

// Amplifi rewrites Markdown list items as "•" and nests them as "   ◦" (and "▪" below that).
const BULLET_LEVELS: Record<string, number> = { "•": 0, "◦": 1, "▪": 2 };
const AMPLIFI_BULLET = /^[ \t]*([•◦▪])[ \t]+/gm;

/**
 * Turns an Amplifi answer into standard Markdown for the renderer: bullet characters become
 * nested list items, and [CP07]-style markers become links the renderer shows as citation buttons.
 * A note inside the brackets, as in [CP07, laboratory measurement], stays beside the button.
 */
export function answerToMarkdown(text: string): string {
  return text
    .replace(AMPLIFI_BULLET, (_m, bullet: string) => `${"  ".repeat(BULLET_LEVELS[bullet] ?? 0)}- `)
    .replace(CITATION_PATTERN, (_m, first: string, rest: string) => {
      const { ids, note } = citationParts(first, rest);
      const links = ids.map((id) => `[${id}](${CITE_HREF_PREFIX}${id})`).join(" ");
      return note ? `${links} (${note})` : links;
    });
}
