import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useChat } from "@/state/ChatContext";
import { useDetailDialog } from "@/state/DetailDialogContext";

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
