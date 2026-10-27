import { useId } from "react";
import { Dialog } from "@/components/common/Dialog";
import { useDetailDialog } from "@/state/DetailDialogContext";
import { PaperDetail } from "./PaperDetail";
import { PairDetail } from "./PairDetail";

export function DetailDialogs() {
  const { target, close } = useDetailDialog();
  const titleId = useId();
  return (
    <Dialog open={target !== null} onClose={close} labelledBy={titleId}>
      {target?.kind === "paper" && <PaperDetail key={target.id} paperId={target.id} titleId={titleId} />}
      {target?.kind === "pair" && <PairDetail key={target.id} recordId={target.id} titleId={titleId} />}
    </Dialog>
  );
}
