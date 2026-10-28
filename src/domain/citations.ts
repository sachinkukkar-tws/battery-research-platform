/** A paper ID Amplifi cites, e.g. CP07, C12, N1 or I2. */
const PAPER_ID = /^(?:CP\d{2}|C\d{1,2}|N\d|I\d)$/;
// A file name Amplifi sometimes cites instead of the ID, e.g. CP01_Shen_2026.pdf.
const FILE_SUFFIX = /_\S*\.pdf$/i;

/**
 * Inline citation markers: a bracket that starts with a paper ID, such as [CP07], [CP01, CP03],
 * [CP01, laboratory measurement] or [CP01_Shen_2026.pdf]. Group 1 is the first ID; group 2 is
 * anything after it. Brackets that don't start with an ID, like [lab study], are not citations.
 */
export const CITATION_PATTERN = /\[(CP\d{2}|C\d{1,2}|N\d|I\d)(?:_[^\s\]]*\.pdf)?((?:[\s,;][^[\]\n]*)?)\]/g;

/** Splits one citation marker into the papers it cites and any note Amplifi wrote beside them. */
export function citationParts(firstId: string, rest = ""): { ids: string[]; note: string } {
  const ids = [firstId];
  const notes: string[] = [];
  for (const raw of rest.split(/[,;]/)) {
    const part = raw.trim();
    const id = part.replace(FILE_SUFFIX, "");
    if (PAPER_ID.test(id)) {
      if (!ids.includes(id)) ids.push(id);
    } else if (part) {
      notes.push(part);
    }
  }
  return { ids, note: notes.join(", ") };
}

export type CitedSegment = { kind: "text"; text: string } | { kind: "cite"; paperId: string };

/** Splits answer text into plain text and citation segments so citations can be rendered as buttons. */
export function splitCitedText(text: string): CitedSegment[] {
  const out: CitedSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(CITATION_PATTERN)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ kind: "text", text: text.slice(last, i) });
    const { ids, note } = citationParts(m[1]!, m[2]);
    ids.forEach((paperId, k) => {
      if (k > 0) out.push({ kind: "text", text: " " });
      out.push({ kind: "cite", paperId });
    });
    if (note) out.push({ kind: "text", text: ` (${note})` });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

export function extractCitationIds(text: string): string[] {
  return [...new Set([...text.matchAll(CITATION_PATTERN)].flatMap((m) => citationParts(m[1]!, m[2]).ids))];
}
