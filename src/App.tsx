import { useState, type ReactNode } from "react";
import { BrowserRouter, HashRouter, MemoryRouter } from "react-router-dom";
import { createServices, readConfig, type RouterMode, type Services } from "@/services";
import { AppProviders } from "./AppProviders";
import { AppRoutes } from "./AppRoutes";

// Opt into React Router v7 behaviour now so upgrading later changes nothing.
const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

function Router({ mode, children }: { mode: RouterMode; children: ReactNode }) {
  if (mode === "hash") return <HashRouter future={FUTURE}>{children}</HashRouter>;
  if (mode === "memory") return <MemoryRouter future={FUTURE} initialEntries={["/workspace"]}>{children}</MemoryRouter>;
  return <BrowserRouter future={FUTURE}>{children}</BrowserRouter>;
}

export function App({ services: injected }: { services?: Services }) {
  // Created once per app instance; tests inject their own.
  const [services] = useState(() => injected ?? createServices(readConfig()));
  return (
    <Router mode={services.config.routerMode}>
      <AppProviders services={services}>
        <AppRoutes />
      </AppProviders>
    </Router>
  );
}
