import { screen, within } from "@testing-library/react";
import { renderApp } from "./renderApp";

describe("Explorer", () => {
  it("opens first, on the best-supported pair, with the Amplifi data badge", async () => {
    renderApp("/");
    expect(await screen.findByRole("heading", { name: "Hard carbon + NFPP" })).toBeInTheDocument();
    expect(screen.getByText("Amplifi data")).toBeInTheDocument();
    const anodes = within(screen.getByRole("group", { name: "Anode" })).getAllByRole("button");
    expect(anodes.map((b) => b.textContent)).toEqual([expect.stringMatching(/^Hard carbon/), expect.stringMatching(/^Graphite\/hard carbon/)]);
    const cathodes = within(screen.getByRole("group", { name: "Cathode" })).getAllByRole("button");
    expect(cathodes.map((b) => b.textContent)).toEqual([
      expect.stringMatching(/^NFPPStrong/),
      expect.stringMatching(/^NVPStrong/),
      expect.stringMatching(/^PBModerate/),
      expect.stringMatching(/^NaNi1\/3Fe1\/3Mn1\/3O2Limited/),
    ]);
  });

  it("keeps the pair in the address, so a link opens it", async () => {
    renderApp("/explore?anode=sodium-ion-hard-carbon&cathode=NVP");
    expect(await screen.findByRole("heading", { name: "Hard carbon + NVP" })).toBeInTheDocument();
  });

  it("shows a value's source sentence and PDF page in a dialog", async () => {
    const { user } = renderApp("/explore");
    await user.click(await screen.findByRole("button", { name: /^NVP/ }));
    expect(screen.getByRole("heading", { name: "Hard carbon + NVP" })).toBeInTheDocument();

    await user.click(within(screen.getByRole("table")).getAllByRole("button")[0]!);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("link", { name: /^Open the PDF at page \d+/ })).toHaveAttribute("href", expect.stringMatching(/^\/amplifi\/papers\/CP0[379]\.pdf#page=\d+$/));
    expect(dialog.querySelector("mark")).not.toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("puts the pair's best results at a glance, each linked to its source", async () => {
    const { user } = renderApp("/explore");
    const glance = await screen.findByRole("list", { name: "At a glance" });
    expect(within(glance).getByText("Highest reversible capacity")).toBeInTheDocument();
    await user.click(within(glance).getAllByRole("button")[0]!);
    expect(within(screen.getByRole("dialog")).getByText("Reversible capacity")).toBeInTheDocument();
  });

  it("lists the review that covers a pair among its papers, each linked to Papers", async () => {
    const { user } = renderApp("/explore?anode=sodium-ion-hard-carbon&cathode=NVP");
    await user.click(await screen.findByRole("tab", { name: /^Papers/ }));
    const review = await screen.findByRole("article", { name: /^CP08: Hard carbon for sodium-ion batteries/ });
    expect(within(review).getByText("Review")).toBeInTheDocument();
    expect(within(review).getByRole("link", { name: "Open the PDF of CP08" })).toHaveAttribute("href", "/amplifi/papers/CP08.pdf");
    await user.click(within(review).getByRole("link", { name: /^CP08/ }));
    expect(await screen.findByText(/^A review: its values come from the studies it covers/)).toBeInTheDocument();
  });

  it("shows one view of a pair at a time, and keeps that view when another cathode is picked", async () => {
    const { user } = renderApp("/explore");
    expect(await screen.findByRole("tab", { name: /^Performance/ })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: /^Synthesis/ }));
    expect(screen.queryByRole("table")).toBeNull();
    expect(within(screen.getByRole("tabpanel")).getAllByRole("listitem").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /^NVP/ }));
    expect(screen.getByRole("heading", { name: "Hard carbon + NVP" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^Synthesis/ })).toHaveAttribute("aria-selected", "true");
    screen.getByRole("tab", { name: /^Synthesis/ }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /^Materials/ })).toHaveAttribute("aria-selected", "true");
  });

  it("folds a long method to two lines, with a button to read the rest", async () => {
    const { user } = renderApp("/explore?anode=sodium-ion-hard-carbon&cathode=NFPP&view=synthesis");
    const more = (await screen.findAllByRole("button", { name: "More" }))[0]!;
    expect(more).toHaveAttribute("aria-expanded", "false");
    await user.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    expect(more).toHaveTextContent("Less");
  });

  it("explains the evidence rating only when asked", async () => {
    const { user } = renderApp("/explore");
    const rule = await screen.findByText("How evidence is rated");
    expect(screen.getByText(/^Strong: two or more papers/)).not.toBeVisible();
    await user.click(rule);
    expect(screen.getByText(/^Strong: two or more papers/)).toBeVisible();
  });

  it("switches to the lithium-ion anode and its cathode", async () => {
    const { user } = renderApp("/explore");
    await user.click(await screen.findByRole("button", { name: /^Graphite\/hard carbon/ }));
    expect(screen.getByRole("heading", { name: "Graphite/hard carbon + NCM523" })).toBeInTheDocument();
  });
});
