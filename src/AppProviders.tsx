import type { ReactNode } from "react";
import type { Services } from "@/services";
import { ChatProvider } from "@/state/ChatContext";
import { DetailDialogProvider } from "@/state/DetailDialogContext";
import { ResearchDataProvider } from "@/state/ResearchDataContext";
import { ServicesProvider } from "@/state/ServicesContext";
import { ToastProvider } from "@/state/ToastContext";
import { UploadsProvider } from "@/state/UploadsContext";
import { ViewStateProvider } from "@/state/ViewStateContext";

/** Provider order matters: later providers use earlier ones. All of them sit inside the router. */
export function AppProviders({ services, children }: { services: Services; children: ReactNode }) {
  return (
    <ServicesProvider services={services}>
      <ToastProvider>
        <ResearchDataProvider>
          <ViewStateProvider>
            <ChatProvider>
              <UploadsProvider>
                <DetailDialogProvider>{children}</DetailDialogProvider>
              </UploadsProvider>
            </ChatProvider>
          </ViewStateProvider>
        </ResearchDataProvider>
      </ToastProvider>
    </ServicesProvider>
  );
}
