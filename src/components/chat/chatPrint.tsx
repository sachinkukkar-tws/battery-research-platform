import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { renderToStaticMarkup } from "react-dom/server";
import { CITE_HREF_PREFIX } from "@/domain/markdown";

// Citation markers print as [CP10]; other links (DOIs) stay links.
const components: Components = {
  a: ({ href, children }) =>
    href?.startsWith(CITE_HREF_PREFIX) ? <span className="cite">[{href.slice(CITE_HREF_PREFIX.length)}]</span> : <a href={href}>{children}</a>,
};

// A zero page margin stops the browser printing its own header and footer (the page address, title, date and
// page numbers). The document's margins come from the padding instead, repeated on every page.
const PRINT_CSS = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 10.5pt/1.5 "Segoe UI", "Helvetica Neue", Arial, sans-serif; color: #1d2125; }
  .doc { padding: 16mm 16mm; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
  h1 { font-size: 17pt; margin: 0 0 4pt; }
  h2 { font-size: 13pt; margin: 14pt 0 4pt; }
  h3 { font-size: 11pt; margin: 10pt 0 4pt; color: #15716f; }
  h4 { font-size: 10.5pt; margin: 8pt 0 2pt; }
  p, li { margin: 3pt 0; }
  ul, ol { padding-left: 16pt; }
  hr { border: 0; border-top: 1px solid #d5dade; margin: 12pt 0; }
  em { color: #4a5561; }
  table { border-collapse: collapse; width: 100%; margin: 6pt 0; font-size: 9.5pt; }
  th, td { border: 1px solid #d5dade; padding: 4pt 6pt; text-align: left; vertical-align: top; }
  th { background: #f1f3f5; }
  tr, li, h2, h3 { break-inside: avoid; }
  h2, h3 { break-after: avoid; }
  a { color: #15716f; text-decoration: none; word-break: break-all; }
  .cite { color: #15716f; font-weight: 600; }
`;

/** The chat's Markdown as a printable HTML page. Raw HTML in the Markdown is never rendered. */
export function chatPrintHtml(markdown: string, title: string): string {
  const body = renderToStaticMarkup(
    <Markdown remarkPlugins={[remarkGfm]} components={components}>
      {markdown}
    </Markdown>,
  );
  const safeTitle = title.replace(/[<>&"]/g, "") || "Chat";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${safeTitle}</title><style>${PRINT_CSS}</style></head><body><main class="doc">${body}</main></body></html>`;
}

/**
 * Opens the browser's print window for the chat, where "Save as PDF" saves it. A hidden frame holds the page,
 * so the app itself isn't printed. Chrome and Edge suggest the file name from the app's own title, not the
 * frame's, so the app takes the chat's name until the print window closes.
 */
export function printChat(markdown: string, title: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  const appTitle = document.title;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    document.title = appTitle;
    frame.remove();
  };
  frame.onload = () => {
    const win = frame.contentWindow;
    if (!win) return finish();
    win.addEventListener("afterprint", finish);
    document.title = title;
    win.focus();
    win.print();
  };
  frame.srcdoc = chatPrintHtml(markdown, title);
  document.body.appendChild(frame);
  // If the print window never reports back, don't leave the frame or the title behind.
  setTimeout(finish, 120_000);
}
