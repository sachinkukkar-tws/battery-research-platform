import { screen, waitFor, within } from "@testing-library/react";
import { readConfig } from "@/services/config";
import { ApiError } from "@/services/http";
import { renderApp } from "./renderApp";

describe("App shell", () => {
  it("offers only the Explorer, Papers and Ask Amplifi", async () => {
    renderApp("/");
    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect(within(nav).getAllByRole("link").map((a) => a.textContent)).toEqual(["Explorer", "Papers", "Ask Amplifi"]);
    expect(screen.queryByRole("link", { name: /Workspace|Library|Review|Charts/ })).toBeNull();
  });

  it("finds a cathode from the header search and opens its pair", async () => {
    const { user } = renderApp("/papers");
    await user.type(screen.getByRole("combobox", { name: "Search a material, paper or DOI" }), "Na3V2");
    const results = screen.getByRole("listbox", { name: "Search results" });
    expect(within(results).getAllByRole("option")[0]).toHaveTextContent(/^CathodeNVP/);
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("heading", { name: "Hard carbon + NVP" })).toBeInTheDocument();
  });

  it("finds a paper by its DOI", async () => {
    const { user } = renderApp("/explore");
    await user.type(screen.getByRole("combobox", { name: "Search a material, paper or DOI" }), "10.1039/D4SC00734D");
    await user.click(within(screen.getByRole("listbox")).getByRole("option", { name: /CP08/ }));
    expect(await screen.findByRole("heading", { name: /^Hard carbon for sodium-ion batteries/ })).toBeInTheDocument();
  });
});

describe("Papers", () => {
  it("opens the first paper and switches to another", async () => {
    const { user } = renderApp("/papers");
    expect(await screen.findByRole("heading", { name: /^Pore-stitching engineering/ })).toBeInTheDocument();
    await user.click(within(screen.getByRole("navigation", { name: "Client papers" })).getByRole("link", { name: /^CP04/ }));
    expect(screen.getByRole("heading", { name: /^A stage-wise plateau-sodiation mechanism/ })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /^Full cells/ }));
    expect(screen.getByText("Amplifi found no full cells in this paper, only half-cell (anode) tests.")).toBeInTheDocument();
  });

  it("marks the review and shows a value's source", async () => {
    const { user } = renderApp("/papers/CP08");
    expect(await screen.findByText(/^A review: its values come from the studies it covers/)).toBeInTheDocument();
    await user.click(screen.getByText(/^\d\/5 checks$/));
    expect(screen.getByText("DOI found in the PDF")).toBeVisible();
    await user.click(within(screen.getByRole("table")).getAllByRole("button")[0]!);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("link", { name: /^Open the PDF at page \d+/ })).toHaveAttribute("href", expect.stringMatching(/^\/amplifi\/papers\/CP08\.pdf#page=\d+$/));
  });

  it("links a paper to its pair in the Explorer", async () => {
    const { user } = renderApp("/papers/CP06");
    await user.click(await screen.findByRole("link", { name: "See it in the Explorer" }));
    expect(await screen.findByRole("heading", { name: "Hard carbon + NFPP" })).toBeInTheDocument();
  });
});

describe("Ask Amplifi", () => {
  it("suggests questions from Amplifi's data, sends one to Amplifi and opens the cited paper", async () => {
    const ask = vi.fn().mockResolvedValue({ text: "The answer [CP09].", citations: [], origin: "amplifi", conversationId: null });
    const { user } = renderApp("/ask", { amplifi: { ask } });
    const first = within(await screen.findByRole("list", { name: "Suggested questions" })).getAllByRole("button")[0]!;
    expect(first).toHaveTextContent(/^What is .+ in CP\d{2} made from\?$/);
    await user.click(first);
    expect(ask).toHaveBeenCalledWith(expect.objectContaining({ question: first.textContent }));
    await screen.findByText(/^The answer/);
    expect(screen.queryByText(/demo/i)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Source CP09, open the paper" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: /Tuning hard carbon pores/ })).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Open the paper" }));
    expect(await screen.findByRole("navigation", { name: "Client papers" })).toBeInTheDocument();
  });

  it("shows an error when Amplifi fails and doesn't invent an answer", async () => {
    const amplifi = { ask: vi.fn().mockRejectedValue(new ApiError("timeout", "Amplifi took too long to respond. Try again.")) };
    const { user } = renderApp("/ask", { amplifi });
    await user.type(await screen.findByLabelText("Message Amplifi"), "Hello{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("Amplifi couldn’t answer. Amplifi took too long to respond.");
  });

  it("sends earlier real answers as history for follow-ups, and the chosen paper scope", async () => {
    const ask = vi.fn().mockResolvedValue({ text: "First [CP01].", citations: [], origin: "amplifi", conversationId: "conv-1" });
    const { user } = renderApp("/ask", { amplifi: { ask } });
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
    const { user } = renderApp("/ask", { amplifi: { ask } });
    await user.type(await screen.findByLabelText("Message Amplifi"), "ICE?{Enter}");
    expect(await screen.findByRole("heading", { name: "Key evidence" })).toBeInTheDocument();
    expect(screen.getByText("Laboratory measurement").tagName).toBe("STRONG");
    expect(screen.getByText(/ICE of 94\.8%/).closest("li")).not.toBeNull();
    expect(screen.queryByText(/##|\*\*|•|◦/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Source CP01, open the paper" }));
    expect(await screen.findByRole("heading", { name: /Pore-stitching engineering/ })).toBeInTheDocument();
  });

  it("makes a citation clickable when Amplifi writes extra words inside the brackets", async () => {
    const ask = vi.fn().mockResolvedValue({ text: "ICE of 94.8% [CP01, laboratory measurement].", citations: [], origin: "amplifi", conversationId: null });
    const { user } = renderApp("/ask", { amplifi: { ask } });
    await user.type(await screen.findByLabelText("Message Amplifi"), "ICE?{Enter}");
    expect(await screen.findByText(/\(laboratory measurement\)/)).toBeInTheDocument();
    expect(screen.queryByText(/\[CP01/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Source CP01, open the paper" }));
    expect(await screen.findByRole("heading", { name: /Pore-stitching engineering/ })).toBeInTheDocument();
  });

  it("offers only the papers loaded in Amplifi, when they're listed", async () => {
    const config = { ...readConfig({ VITE_AMPLIFI_PAPERS: "CP01,CP02" }), routerMode: "memory" as const };
    const { user } = renderApp("/ask", { config });
    const list = await screen.findByLabelText("Which papers to search");
    expect(within(list).getAllByRole("option").map((o) => (o as HTMLOptionElement).value)).toEqual(["", "CP01", "CP02"]);
    await user.click(screen.getByRole("link", { name: "Papers" }));
    await user.click(within(await screen.findByRole("navigation", { name: "Client papers" })).getByRole("link", { name: /^CP05/ }));
    expect(screen.queryByRole("button", { name: /Ask Amplifi about/ })).toBeNull();
  });

  it("labels the chat as live Amplifi, and the other pages as Amplifi data", async () => {
    const { user } = renderApp("/ask");
    expect(await screen.findByText("Live Amplifi")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Explorer" }));
    expect(await screen.findByText("Amplifi data")).toBeInTheDocument();
  });

  it("opens from a paper with the scope set", async () => {
    const { user } = renderApp("/papers/CP01");
    await user.click(await screen.findByRole("button", { name: "Ask Amplifi about CP01" }));
    expect(await screen.findByLabelText("Which papers to search")).toHaveValue("CP01");
  });
});
