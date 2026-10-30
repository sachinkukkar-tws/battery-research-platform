import { useCallback } from "react";
import { useServices } from "@/state/ServicesContext";

/** The link that opens a paper's PDF through the proxy, at a page when one is given. */
export function usePdfHref() {
  const { config } = useServices();
  return useCallback((paperId: string, page?: number | null) => `${config.amplifiProxyUrl}/papers/${paperId}.pdf${page ? `#page=${page}` : ""}`, [config]);
}
