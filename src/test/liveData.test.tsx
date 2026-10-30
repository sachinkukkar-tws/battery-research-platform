import { screen } from "@testing-library/react";
import { ApiError } from "@/services/http";
import type { ExplorerData } from "@/types";
import { EXPLORER_FIXTURE } from "./fixtures/explorerData";
import { IDLE, fakeExplorer, renderApp } from "./renderApp";

describe("Amplifi's data, live through the proxy", () => {
  it("asks Amplifi to extract the papers when there's no data yet, then shows what it found", async () => {
    let data: ExplorerData | null = null;
    const refresh = vi.fn(async () => {
      data = EXPLORER_FIXTURE;
      return { ...IDLE, state: "done" as const };
    });
    const { user } = renderApp("/explore", { explorer: { load: async () => data, status: async () => IDLE, refresh } });
    expect(await screen.findByRole("heading", { name: "No data from Amplifi yet" })).toBeInTheDocument();
    expect(screen.getByText("No data yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Extract the papers with Amplifi" }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("heading", { name: "Hard carbon + NFPP" })).toBeInTheDocument();
    expect(screen.getByText("Amplifi data")).toBeInTheDocument();
  });

  it("shows how far Amplifi has got while it extracts the papers", async () => {
    const running = { ...IDLE, state: "running" as const, stage: "Asking Amplifi about each paper", done: 3, failed: 1, total: 20 };
    const { user } = renderApp("/papers", { explorer: fakeExplorer(null, { refresh: async () => running }) });
    await user.click(await screen.findByRole("button", { name: "Extract the papers with Amplifi" }));
    expect(await screen.findByText(/^Asking Amplifi about each paper: 3 of 20 answers, 1 without an answer\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Amplifi is extracting the papers" })).toBeDisabled();
  });

  it("says where the data came from, and keeps it in view while Amplifi extracts the papers again", async () => {
    const refresh = vi.fn(async () => ({ ...IDLE, state: "running" as const, total: 20 }));
    const { user } = renderApp("/explore", { explorer: fakeExplorer(EXPLORER_FIXTURE, { refresh }) });
    expect(await screen.findByText(/^From Amplifi, .+ · every value checked against its PDF · \d+ that didn’t pass the checks are left out$/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refresh from Amplifi" }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: "Amplifi is extracting the papers" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hard carbon + NFPP" })).toBeInTheDocument();
  });

  it("says when a refresh fails", async () => {
    const failed = { ...IDLE, state: "failed" as const, error: "Amplifi didn't answer for any paper." };
    const { user } = renderApp("/explore", { explorer: fakeExplorer(null, { refresh: async () => failed }) });
    await user.click(await screen.findByRole("button", { name: "Extract the papers with Amplifi" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The refresh didn’t finish: Amplifi didn't answer for any paper.");
  });

  it("says when the proxy can't be reached, and loads the data on Try again", async () => {
    const load = vi.fn().mockRejectedValueOnce(new ApiError("network", "Couldn’t reach the Amplifi proxy.")).mockResolvedValue(EXPLORER_FIXTURE);
    const { user } = renderApp("/explore", { explorer: fakeExplorer(null, { load }) });
    expect(await screen.findByRole("heading", { name: "Couldn’t load Amplifi’s data" })).toBeInTheDocument();
    expect(screen.getByText("Data unavailable")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/Couldn’t reach the Amplifi proxy\..*npm run amplifi:proxy/);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Hard carbon + NFPP" })).toBeInTheDocument();
  });
});
