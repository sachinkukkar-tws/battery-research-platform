import { screen, waitFor, within } from "@testing-library/react";
import { readConfig } from "@/services/config";
import { ApiError } from "@/services/http";
import { createMockResearchService } from "@/services/researchService";
import { renderApp } from "./renderApp";

describe("Workspace", () => {
  it("shows the stats and links metrics to the relevant records", async () => {
    const { user } = renderApp();
    expect(await screen.findByText("Tested pairs")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Papers\s*37/ })).toHaveAttribute("href", "/library");
    await user.click(screen.getByRole("link", { name: /Waiting for review/ }));
    expect(await screen.findByRole("heading", { name: "Review queue" })).toBeInTheDocument();
  });

  it("filters pairs from a quick question and clears them", async () => {
    const { user } = renderApp();
    await screen.findByText("Explore results");
    await user.selectOptions(screen.getByLabelText("Quick question"), "Which pairs have low-temperature data?");
    expect(screen.getByText(/^2 tested pairs from 2 papers/)).toBeInTheDocument();
    expect(screen.getByText("1 on")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear all options" }));
    expect(screen.getByText(/^10 tested pairs from 8 papers/)).toBeInTheDocument();
  });

  it("opens a pair's details and asks Amplifi to find a missing value", async () => {
    const { user } = renderApp();
    await user.click(await screen.findByRole("button", { name: /^Ni-NPC\s*NVP/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getAllByRole("button", { name: "Find with Amplifi" })[0]!);
    expect(await within(dialog).findByText(/Demo mode: when connected, Amplifi searches CP03/)).toBeInTheDocument();
    expect(within(dialog).getByText("Demo")).toBeInTheDocument();
  });
});

describe("loading and errors", () => {
  it("explains a failed load and retries", async () => {
    const research = createMockResearchService({ delayMs: 0 });
    const failing = { ...research, getDataset: vi.fn().mockRejectedValueOnce(new ApiError("server", "The platform had a problem (error 503).")).mockImplementation(research.getDataset) };
    const { user } = renderApp("/library", { research: failing });
    expect(await screen.findByRole("alert")).toHaveTextContent("The platform had a problem (error 503).");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/of 37 papers shown/)).toBeInTheDocument();
  });
});

describe("Library", () => {
  it("searches and recovers from an empty result", async () => {
    const { user } = renderApp("/library");
    const search = await screen.findByLabelText("Search");
    await user.type(search, "severson");
    expect(screen.getByText("1 of 37 papers shown. 8 checked, 1 extracted, 28 harvested.")).toBeInTheDocument();
    await user.type(search, "zzz");
    await user.click(screen.getByRole("button", { name: "Clear the search" }));
    expect(screen.getByText(/^37 of 37 papers shown/)).toBeInTheDocument();
  });

  it("keeps filters when leaving and coming back", async () => {
    const { user } = renderApp("/library");
    await user.type(await screen.findByLabelText("Search"), "CP0");
    await user.click(screen.getByRole("link", { name: "Charts" }));
    await user.click(screen.getByRole("link", { name: "Library" }));
    expect(await screen.findByLabelText("Search")).toHaveValue("CP0");
  });
});

describe("Review", () => {
  it("approves a value, updates the badge and confirms", async () => {
    const { user } = renderApp("/review");
    await screen.findByText("6 values waiting.");
    await user.click(screen.getAllByRole("button", { name: "Approve" })[0]!);
    expect(await screen.findByText("5 values waiting.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review, 5 waiting" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "" })).toBeTruthy();
    expect(screen.getByText(/Approved\. CP02’s full-cell result now counts as checked\./)).toBeInTheDocument();
    expect(screen.getByText("Done in this session")).toBeInTheDocument();
  });

  it("requires a value before saving a correction", async () => {
    const { user } = renderApp("/review");
    await user.click((await screen.findAllByRole("button", { name: "Correct" }))[0]!);
    const input = screen.getByLabelText(/Corrected value for/);
    await user.clear(input);
    await user.click(screen.getByRole("button", { name: "Save correction" }));
    expect(screen.getByText("Type the corrected value first.")).toBeInTheDocument();
    await user.type(input, "11.5 Ah pouch, 2,250 cycles");
    await user.click(screen.getByRole("button", { name: "Save correction" }));
    expect(await screen.findByText("11.5 Ah pouch, 2,250 cycles")).toBeInTheDocument();
    expect(screen.getByText(/Correction saved\./)).toBeInTheDocument();
  });

  it("keeps the item and reports the error when saving fails", async () => {
    const research = { ...createMockResearchService({ delayMs: 0 }), submitReview: vi.fn().mockRejectedValue(new ApiError("unauthorized", "The platform needs you to sign in again.")) };
    const { user } = renderApp("/review", { research });
    await user.click((await screen.findAllByRole("button", { name: "Approve" }))[0]!);
    expect(await screen.findByText(/Couldn’t save the decision\. The platform needs you to sign in again\./)).toBeInTheDocument();
    expect(screen.getByText("6 values waiting.")).toBeInTheDocument();
  });

  it("ignores a double click while a decision is saving", async () => {
    let resolve!: () => void;
    const submitReview = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    const research = { ...createMockResearchService({ delayMs: 0 }), submitReview };
    const { user } = renderApp("/review", { research });
    const approve = (await screen.findAllByRole("button", { name: "Approve" }))[0]!;
    await user.click(approve);
    await user.click(approve);
    expect(submitReview).toHaveBeenCalledTimes(1);
    resolve();
    expect(await screen.findByText("5 values waiting.")).toBeInTheDocument();
  });
});

describe("Upload", () => {
  const pdf = (name = "paper.pdf") => new File(["%PDF-1.7"], name, { type: "application/pdf" });

  it("rejects files that aren't PDFs and explains why", async () => {
    const { user } = renderApp("/upload");
    await user.upload(screen.getByLabelText(/Drop PDFs here/), new File(["x"], "notes.docx", { type: "" }));
    expect(screen.getByRole("alert")).toHaveTextContent("notes.docx isn’t a PDF");
  });

  it("uploads a PDF through every step and adds it to the Library", async () => {
    const { user } = renderApp("/upload");
    await screen.findByText("No uploads yet in this session.");
    await user.upload(screen.getByLabelText(/Drop PDFs here/), pdf("new-anode.pdf"));
    expect(await screen.findByText("Done")).toBeInTheDocument();
    expect(screen.getByText(/Demo mode: the file wasn’t sent anywhere/)).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Library" }));
    expect(await screen.findByText("new-anode")).toBeInTheDocument();
  });

  it("shows a failed upload with a retry", async () => {
    const documents = {
      listPapers: async () => [],
      uploadPaper: vi.fn().mockRejectedValueOnce(new ApiError("too_large", "The platform rejected the file as too large.")).mockResolvedValue({ paper: null, message: "Accepted.", origin: "amplifi", processingReported: false }),
    };
    const { user } = renderApp("/upload", { documents });
    await user.upload(screen.getByLabelText(/Drop PDFs here/), pdf());
    expect(await screen.findByText(/Upload failed\. The platform rejected the file as too large\./)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Accepted.")).toBeInTheDocument();
    expect(documents.uploadPaper).toHaveBeenCalledTimes(2);
  });
});

describe("Ask Amplifi", () => {
  it("answers a suggested question, labels it as a demo and opens the cited paper", async () => {
    const { user } = renderApp("/ask");
    await user.click(await screen.findByRole("button", { name: "What is S-HC-2 in CP09 made from?" }));
    expect(await screen.findByText(/made from starch/)).toBeInTheDocument();
    expect(screen.getByText("Demo answer, not generated by Amplifi")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "CP09, page 2" }));
    expect(await screen.findByRole("heading", { name: /Tuning hard carbon pores/ })).toBeInTheDocument();
  });

  it("shows an error when Amplifi fails and doesn't invent an answer", async () => {
    const amplifi = { ask: vi.fn().mockRejectedValue(new ApiError("timeout", "Amplifi took too long to respond. Try again.")), findValue: vi.fn() };
    const { user } = renderApp("/ask", { amplifi });
    await user.type(await screen.findByLabelText("Message Amplifi"), "Hello{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("Amplifi couldn’t answer. Amplifi took too long to respond.");
  });

  it("sends earlier real answers as history for follow-ups, and the chosen paper scope", async () => {
    const ask = vi.fn().mockResolvedValue({ text: "First [CP01].", citations: [], origin: "amplifi", conversationId: "conv-1" });
    const { user } = renderApp("/ask", { amplifi: { ask, findValue: vi.fn() } });
    const box = await screen.findByLabelText("Message Amplifi");
    await user.selectOptions(screen.getByLabelText("Which papers to search"), "CP01");
    await user.type(box, "One{Enter}");
    await screen.findByText(/^First/);
    await user.type(box, "Two{Enter}");
    await waitFor(() => expect(ask).toHaveBeenCalledTimes(2));
    expect(ask.mock.calls[1]![0]).toMatchObject({
      question: "Two",
      scope: "CP01",
      conversationId: "conv-1",
      history: [{ role: "user", text: "One" }, { role: "assistant", text: "First [CP01]." }],
    });
  });

  it("renders an Amplifi answer's Markdown instead of showing the symbols", async () => {
    const text = "## Key evidence\n• **Laboratory measurement**\n   ◦ ICE of 94.8% at 20 mA/g [CP01].";
    const ask = vi.fn().mockResolvedValue({ text, citations: [], origin: "amplifi", conversationId: null });
    const { user } = renderApp("/ask", { amplifi: { ask, findValue: vi.fn() } });
    await user.type(await screen.findByLabelText("Message Amplifi"), "ICE?{Enter}");
    expect(await screen.findByRole("heading", { name: "Key evidence" })).toBeInTheDocument();
    expect(screen.getByText("Laboratory measurement").tagName).toBe("STRONG");
    expect(screen.getByText(/ICE of 94\.8%/).closest("li")).not.toBeNull();
    expect(screen.queryByText(/##|\*\*|•|◦/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Source CP01, open in the Library" }));
    expect(await screen.findByRole("heading", { name: /Pore-stitching engineering/ })).toBeInTheDocument();
  });

  it("labels Ask Amplifi as live when only the chat is connected", async () => {
    const config = { ...readConfig({ VITE_CHAT_MODE: "live" }), routerMode: "memory" as const };
    const { user } = renderApp("/ask", { config });
    expect(await screen.findByText("Live Amplifi")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Library" }));
    expect(await screen.findByText("Demo data")).toBeInTheDocument();
  });

  it("opens from a paper with the scope set", async () => {
    const { user } = renderApp("/library");
    await user.click(await screen.findByRole("button", { name: /Pore-stitching engineering/ }));
    await user.click(await screen.findByRole("button", { name: "Ask Amplifi about CP01" }));
    expect(await screen.findByLabelText("Which papers to search")).toHaveValue("CP01");
  });
});
