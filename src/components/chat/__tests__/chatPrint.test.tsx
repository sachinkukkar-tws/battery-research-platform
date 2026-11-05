import { chatPrintHtml, printChat } from "../chatPrint";

describe("printChat", () => {
  it("gives the page the chat's name while printing, so the PDF is saved under it, then restores it", () => {
    document.title = "Battery Science Explorer";
    let frame: HTMLIFrameElement | undefined;
    const append = vi.spyOn(document.body, "appendChild").mockImplementation(<T extends Node>(node: T) => {
      frame = node as unknown as HTMLIFrameElement;
      return node;
    });
    printChat("# ICE by electrolyte", "ICE by electrolyte");
    append.mockRestore();

    // A stand-in for the frame's window: printing records the page title, as the browser's save name does.
    let titleWhilePrinting = "";
    const listeners: Record<string, () => void> = {};
    const win = {
      addEventListener: (type: string, fn: () => void) => (listeners[type] = fn),
      focus: () => {},
      print: () => {
        titleWhilePrinting = document.title;
        listeners.afterprint?.();
      },
    };
    Object.defineProperty(frame!, "contentWindow", { value: win });
    frame!.onload!(new Event("load"));

    expect(titleWhilePrinting).toBe("ICE by electrolyte");
    expect(document.title).toBe("Battery Science Explorer");
  });
});

describe("chatPrintHtml", () => {
  it("lays out headings, tables and links, with citations as [CPxx]", () => {
    const html = chatPrintHtml("# Title\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\nSee [CP10](#cite-CP10) and https://doi.org/10.1/x", "ICE by electrolyte");
    expect(html).toContain("<title>ICE by electrolyte</title>");
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<td>1</td>");
    expect(html).toContain('<span class="cite">[CP10]</span>');
    expect(html).toContain('<a href="https://doi.org/10.1/x">');
  });

  it("never renders raw HTML from an answer", () => {
    const html = chatPrintHtml('Hello <script>alert("x")</script> <img src=x onerror=alert(1)>', "<b>bad</b>");
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<img");
    expect(html).toContain("<title>bbad/b</title>");
  });
});
