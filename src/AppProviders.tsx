import type { ReactNode } from "react";
import type { Services } from "@/services";
import { ChatProvider } from "@/state/ChatContext";
import { DetailDialogProvider } from "@/state/DetailDialogContext";
import { ExplorerDataProvider } from "@/state/ExplorerDataContext";
import { ServicesProvider } from "@/state/ServicesContext";
import { ToastProvider } from "@/state/ToastContext";

/** Provider order matters: later providers use earlier ones. All of them sit inside the router. */
export function AppProviders({ services, children }: { services: Services; children: ReactNode }) {
  return (
    <ServicesProvider services={services}>
      <ToastProvider>
        <ExplorerDataProvider>
          <ChatProvider>
            <DetailDialogProvider>{children}</DetailDialogProvider>
          </ChatProvider>
        </ExplorerDataProvider>
      </ToastProvider>
    </ServicesProvider>
  );
}
