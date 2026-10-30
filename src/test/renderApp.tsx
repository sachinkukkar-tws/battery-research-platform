import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AppProviders } from "@/AppProviders";
import { AppRoutes } from "@/AppRoutes";
import type { Services } from "@/services";
import { readConfig } from "@/services/config";
import type { ExplorerClient, RefreshStatus } from "@/services/explorerApi";
import { ApiError } from "@/services/http";
import type { ExplorerData } from "@/types";
import { EXPLORER_FIXTURE } from "./fixtures/explorerData";

export const IDLE: RefreshStatus = { state: "idle", startedAt: null, finishedAt: null, stage: null, done: 0, failed: 0, total: 0, error: null };

/** A stand-in for the proxy's Explorer routes: it serves the recorded data, or nothing when given null. */
export function fakeExplorer(data: ExplorerData | null = EXPLORER_FIXTURE, overrides: Partial<ExplorerClient> = {}): ExplorerClient {
  return { load: async () => data, status: async () => IDLE, refresh: async () => IDLE, ...overrides };
}

/** Test services: the recorded Explorer data, and a chat that each test asking a question must stand in for. */
export function testServices(overrides: Partial<Services> = {}): Services {
  return {
    config: { ...readConfig({}), routerMode: "memory" },
    amplifi: { ask: () => Promise.reject(new ApiError("network", "This test didn’t set up an answer.")) },
    explorer: fakeExplorer(),
    ...overrides,
  };
}

export function renderApp(path = "/explore", overrides: Partial<Services> = {}) {
  const user = userEvent.setup();
  const services = testServices(overrides);
  const utils = render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppProviders services={services}>
        <AppRoutes />
      </AppProviders>
    </MemoryRouter>,
  );
  return { user, services, ...utils };
}
