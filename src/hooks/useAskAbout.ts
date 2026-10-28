import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { canAskAbout } from "@/services/config";
import { useChat } from "@/state/ChatContext";
import { useDetailDialog } from "@/state/DetailDialogContext";
import { useServices } from "@/state/ServicesContext";

/** Whether an "Ask Amplifi about" button should be shown for a paper. */
export function useCanAskAbout() {
  const { config } = useServices();
  return useCallback((paperId: string) => canAskAbout(config, paperId), [config]);
}

/** Opens Ask Amplifi limited to one paper, with the composer focused. */
export function useAskAbout() {
  const navigate = useNavigate();
  const { setScope, requestComposerFocus } = useChat();
  const { close } = useDetailDialog();
  return useCallback(
    (paperId: string) => {
      close();
      setScope(paperId);
      navigate("/ask");
      requestComposerFocus();
    },
    [close, navigate, requestComposerFocus, setScope],
  );
}
