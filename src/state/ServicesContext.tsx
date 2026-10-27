import { createContext, useContext, type ReactNode } from "react";
import type { Services } from "@/services";

const ServicesContext = createContext<Services | null>(null);

/** Supplies the backend adapters. Tests pass mock services with no delays. */
export function ServicesProvider({ services, children }: { services: Services; children: ReactNode }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const s = useContext(ServicesContext);
  if (!s) throw new Error("useServices must be used inside <ServicesProvider>");
  return s;
}
