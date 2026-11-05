import type { ChatMessage, ChatSession, ExplorerPaper } from "@/types";
import { extractCitationIds } from "./citations";
import { paperTitle } from "./explorer";

/** "4 November 2026, 14:39", in the reader's time zone. */
const exportTime = (d: Date) =>
  `${d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;

/** One line per cited paper, from the details the PDF confirmed: "**CP09** He et al. (2026). Title. *Journal*. https://doi.org/…". */
function paperReference(id: string, paper: ExplorerPaper | undefined): string {
  if (!paper) return `- **${id}**`;
  const author = paper.firstAuthor ? `${paper.firstAuthor} et al.` : null;
  const parts = [
    author && paper.year ? `${author} (${paper.year}).` : author ? `${author}.` : null,
    `${paperTitle(paper)}.`,
    paper.journal && `*${paper.journal}*.`,
    paper.doi && `https://doi.org/${paper.doi}`,
  ];
  return `- **${id}** ${parts.filter(Boolean).join(" ")}`;
}

function answerText(m: ChatMessage, format: (text: string) => string): string {
  if (m.status === "error") return `*Amplifi couldn’t answer. ${m.error ?? ""}*`.replace(" *", "*");
  if (m.status === "stopped") return m.text ? `${format(m.text)}\n\n*Stopped before the answer finished.*` : "*Stopped before the answer arrived.*";
  return format(m.text);
}

/**
 * The chat as a Markdown document, which the PDF export lays out: each question with Amplifi's answer, then the
 * papers the answers cite. `formatAnswer` can rewrite each answer's text, e.g. into standard Markdown.
 */
export function chatToMarkdown(
  chat: Pick<ChatSession, "title" | "messages">,
  papers: Record<string, ExplorerPaper>,
  exportedAt = new Date(),
  formatAnswer: (text: string) => string = (text) => text,
): string {
  const out = [`# ${chat.title}`, "", `*Exported on ${exportTime(exportedAt)}*`];
  const cited = new Set<string>();
  let n = 0;
  chat.messages.forEach((m, i) => {
    if (m.role === "user") {
      n += 1;
      // Only a question limited to one paper says what it searched; all papers is the default.
      const scope = m.scope ?? chat.messages[i + 1]?.scope ?? null;
      out.push("", "---", "", `## Question ${n}`, "", m.text);
      if (scope) out.push("", `*Searched paper ${scope} only*`);
    } else if (m.status !== "pending" && m.status !== "streaming") {
      out.push("", "### Amplifi’s answer", "", answerText(m, formatAnswer));
      for (const id of [...extractCitationIds(m.text), ...m.citations.map((c) => c.paperId)]) cited.add(id);
    }
  });
  if (cited.size) {
    out.push("", "---", "", "## Papers cited", "");
    for (const id of [...cited].sort()) out.push(paperReference(id, papers[id]));
  }
  return `${out.join("\n")}\n`;
}

/** The PDF's suggested file name: the chat's name, without the characters file names can't have. */
export function chatExportFileName(chat: Pick<ChatSession, "title">): string {
  const name = chat.title
    .replace(/[\\/:*?"<>|…]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120)
    .trim();
  return name || "Chat";
}
