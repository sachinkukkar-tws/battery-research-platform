import type { FileValidation } from "@/types";
import { formatFileSize } from "./format";

const PDF_MIME = "application/pdf";

export function validatePdf(file: Pick<File, "name" | "size" | "type">, maxBytes: number): FileValidation {
  const looksPdf = /\.pdf$/i.test(file.name);
  // Some systems report an empty MIME type for PDFs, so the extension decides when type is blank.
  if (!looksPdf || (file.type && file.type !== PDF_MIME)) {
    return { ok: false, reason: `${file.name} isn’t a PDF. Only PDF papers can be added.` };
  }
  if (file.size === 0) return { ok: false, reason: `${file.name} is empty. Check the file and select it again.` };
  if (file.size > maxBytes) {
    return { ok: false, reason: `${file.name} is ${formatFileSize(file.size)}. The limit is ${formatFileSize(maxBytes)}.` };
  }
  return { ok: true };
}

export const uploadStepNames = (extract: boolean) =>
  extract
    ? ["Uploaded", "Added to Amplifi", "Values extracted", "Sent to Review"]
    : ["Uploaded", "Added to Amplifi", "Indexed for search", "Ready in Ask Amplifi"];
