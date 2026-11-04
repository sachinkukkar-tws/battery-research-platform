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

function answerText(m: ChatMessage): string {
  if (m.status === "error") return `*Amplifi couldn’t answer. ${m.error ?? ""}*`.replace(" *", "*");
  if (m.status === "stopped") return m.text ? `${m.text}\n\n*Stopped before the answer finished.*` : "*Stopped before the answer arrived.*";
  return m.text;
}

/** The chat as a Markdown document: each question with Amplifi's answer, then the papers the answers cite. */
export function chatToMarkdown(chat: Pick<ChatSession, "title" | "messages">, papers: Record<string, ExplorerPaper>, exportedAt = new Date()): string {
  const out = [
    `# ${chat.title}`,
    "",
    `Exported from the Battery Research Platform on ${exportTime(exportedAt)}.`,
    "Amplifi answers from the papers and names its sources. Check important values against the paper.",
  ];
  const cited = new Set<string>();
  let n = 0;
  chat.messages.forEach((m, i) => {
    if (m.role === "user") {
      n += 1;
      const scope = m.scope ?? chat.messages[i + 1]?.scope ?? null;
      out.push("", "---", "", `## Question ${n}`, "", m.text, "", `*Searched: ${scope ? `paper ${scope} only` : "all papers"}*`);
    } else if (m.status !== "pending" && m.status !== "streaming") {
      out.push("", "### Amplifi’s answer", "", answerText(m));
      for (const id of [...extractCitationIds(m.text), ...m.citations.map((c) => c.paperId)]) cited.add(id);
    }
  });
  if (cited.size) {
    out.push("", "---", "", "## Papers cited", "");
    for (const id of [...cited].sort()) out.push(paperReference(id, papers[id]));
  }
  return `${out.join("\n")}\n`;
}

/** "amplifi-chat-2026-11-04-which-structural-descriptor.md" */
export function chatExportFileName(chat: Pick<ChatSession, "title" | "createdAt">): string {
  const day = chat.createdAt.slice(0, 10);
  const slug = chat.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, 5)
    .join("-");
  return `amplifi-chat-${day}${slug ? `-${slug}` : ""}.md`;
}
