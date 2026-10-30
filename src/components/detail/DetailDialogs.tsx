import { useId } from "react";
import { Dialog } from "@/components/common/Dialog";
import { PaperPreview } from "@/components/evidence/PaperPreview";
import { SourceView } from "@/components/evidence/SourceView";
import { useDetailDialog } from "@/state/DetailDialogContext";

export function DetailDialogs() {
  const { target, close } = useDetailDialog();
  const titleId = useId();
  return (
    <Dialog open={target !== null} onClose={close} labelledBy={titleId}>
      {target?.kind === "paper" && <PaperPreview key={target.id} paperId={target.id} titleId={titleId} />}
      {target?.kind === "source" && <SourceView source={target.source} titleId={titleId} />}
    </Dialog>
  );
}
