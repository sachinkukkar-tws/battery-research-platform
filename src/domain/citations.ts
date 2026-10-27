/** Inline citation markers Amplifi uses for paper IDs, e.g. [CP07], [C12], [N1], [I2]. */
export const CITATION_PATTERN = /\[(CP\d{2}|C\d{1,2}|N\d|I\d)\]/g;

export type CitedSegment = { kind: "text"; text: string } | { kind: "cite"; paperId: string };

/** Splits answer text into plain text and citation segments so citations can be rendered as buttons. */
export function splitCitedText(text: string): CitedSegment[] {
  const out: CitedSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(CITATION_PATTERN)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ kind: "text", text: text.slice(last, i) });
    out.push({ kind: "cite", paperId: m[1]! });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

export function extractCitationIds(text: string): string[] {
  return [...new Set([...text.matchAll(CITATION_PATTERN)].map((m) => m[1]!))];
}
