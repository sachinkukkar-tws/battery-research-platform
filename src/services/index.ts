import type { AppConfig } from "./config";
import { createHttpAmplifiClient, type AmplifiClient } from "./amplifiApi";
import { createHttpExplorerClient, type ExplorerClient } from "./explorerApi";

export interface Services {
  config: AppConfig;
  amplifi: AmplifiClient;
  explorer: ExplorerClient;
}

/** Everything comes from Amplifi through the proxy: the chat, and the Explorer's data. */
export function createServices(config: AppConfig): Services {
  return { config, amplifi: createHttpAmplifiClient(config), explorer: createHttpExplorerClient(config) };
}

export type { AmplifiClient, ExplorerClient };
export { readConfig, type AppConfig, type RouterMode } from "./config";
export { ApiError, describeError, isAbort } from "./http";
