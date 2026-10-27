import type { AppConfig } from "./config";
import { createHttpAmplifiClient, createMockAmplifiClient, type AmplifiClient } from "./amplifiApi";
import { createHttpDocumentService, createMockDocumentService, type DocumentService } from "./documentService";
import { createHttpResearchService, createMockResearchService, type ResearchService } from "./researchService";

export interface Services {
  config: AppConfig;
  research: ResearchService;
  documents: DocumentService;
  amplifi: AmplifiClient;
}

/** The single place that decides between mock adapters and real backends. */
export function createServices(config: AppConfig): Services {
  const amplifi = createAmplifi(config);
  if (config.mode === "live") {
    return {
      config,
      research: createHttpResearchService(config),
      documents: createHttpDocumentService(config),
      amplifi,
    };
  }
  return {
    config,
    research: createMockResearchService(),
    documents: createMockDocumentService(),
    amplifi,
  };
}

/** Chat follows `chatMode`; Find with Amplifi follows `mode`, since the proxy only serves chat so far. */
function createAmplifi(config: AppConfig): AmplifiClient {
  const live = createHttpAmplifiClient(config);
  const mock = createMockAmplifiClient();
  return {
    ask: (config.chatMode === "live" ? live : mock).ask,
    findValue: (config.mode === "live" ? live : mock).findValue,
  };
}

export type { AmplifiClient, DocumentService, ResearchService };
export { readConfig, type AppConfig, type RouterMode } from "./config";
export { ApiError, describeError, isAbort } from "./http";
