import type { ChatMessage } from "@/types";
import { EXPLORER_FIXTURE } from "@/test/fixtures/explorerData";
import { chatExportFileName, chatToMarkdown } from "../chatExport";

const msg = (m: Partial<ChatMessage> & Pick<ChatMessage, "id" | "role" | "text">): ChatMessage => ({ status: "complete", citations: [], scope: null, ...m });

describe("chatToMarkdown", () => {
  const chat = {
    title: "Which electrolyte gave the higher ICE?",
    messages: [
      msg({ id: "u1", role: "user", text: "Which electrolyte gave the higher ICE?", scope: "CP10" }),
      msg({ id: "a1", role: "assistant", text: "Ether-based, 92.2% [CP10].", scope: "CP10" }),
      msg({ id: "u2", role: "user", text: "And across the papers?" }),
      msg({ id: "a2", role: "assistant", text: "", status: "error", error: "Amplifi took too long to respond." }),
    ],
  };
  const md = chatToMarkdown(chat, EXPLORER_FIXTURE.papers, new Date(2026, 10, 4, 14, 39));

  it("lists each question with its answer, under the title and export time only", () => {
    expect(md.startsWith("# Which electrolyte gave the higher ICE?\n\n*Exported on 4 November 2026, 14:39*\n\n---")).toBe(true);
    expect(md).toContain("## Question 1\n\nWhich electrolyte gave the higher ICE?\n\n*Searched paper CP10 only*");
    expect(md).toContain("### Amplifi’s answer\n\nEther-based, 92.2% [CP10].");
    // A question across all the papers doesn't say so.
    expect(md).toContain("## Question 2\n\nAnd across the papers?\n\n### Amplifi’s answer");
    expect(md).toContain("*Amplifi couldn’t answer. Amplifi took too long to respond.*");
    expect(md).not.toMatch(/Battery Research Platform|Check important values/);
  });

  it("ends with the cited papers' details, without page numbers", () => {
    const p = EXPLORER_FIXTURE.papers.CP10!;
    expect(md).toContain(`## Papers cited\n\n- **CP10** ${p.firstAuthor} et al. (${p.year}). ${p.title}. *${p.journal}*. https://doi.org/${p.doi}`);
    expect(md).not.toMatch(/page \d/i);
  });

  it("names the file after the chat, without characters file names can't have", () => {
    expect(chatExportFileName({ title: "Which electrolyte gave the higher ICE?" })).toBe("Which electrolyte gave the higher ICE");
    expect(chatExportFileName({ title: 'ICE: ether vs ester / CP10 "summary"' })).toBe("ICE ether vs ester CP10 summary");
    expect(chatExportFileName({ title: "???" })).toBe("Chat");
  });
});
