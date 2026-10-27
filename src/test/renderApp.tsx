import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AppProviders } from "@/AppProviders";
import { AppRoutes } from "@/AppRoutes";
import type { Services } from "@/services";
import { readConfig } from "@/services/config";
import { createMockAmplifiClient } from "@/services/amplifiApi";
import { createMockDocumentService } from "@/services/documentService";
import { createMockResearchService } from "@/services/researchService";

/** Mock services with no artificial delays, with any adapter overridable per test. */
export function testServices(overrides: Partial<Services> = {}): Services {
  return {
    config: { ...readConfig({}), routerMode: "memory" },
    research: createMockResearchService({ delayMs: 0 }),
    documents: createMockDocumentService({ delayMs: 0, stepMs: 0 }),
    amplifi: createMockAmplifiClient({ thinkMs: 0, wordMs: [0, 0] }),
    ...overrides,
  };
}

export function renderApp(path = "/workspace", overrides: Partial<Services> = {}) {
  // applyAccept: false mirrors drag-and-drop, which ignores the input's accept filter.
  const user = userEvent.setup({ applyAccept: false });
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
