import type { LibraryPaper } from "./library";
import type { AnswerOrigin } from "./chat";

export type DatasetId = "theme-a" | "theme-b";

export interface Dataset {
  id: DatasetId;
  label: string;
  collection: string;
}

export interface UploadOptions {
  datasetId: DatasetId;
  /** Extract values and send them to Review, rather than only indexing for search. */
  extract: boolean;
}

/** Index into the four pipeline steps shown for each upload. */
export type UploadStage = 0 | 1 | 2 | 3;

export type UploadStatus = "uploading" | "processing" | "completed" | "failed" | "cancelled";

export interface UploadEvents {
  onProgress?: (fraction: number) => void;
  onStage?: (stage: UploadStage) => void;
}

export interface UploadResult {
  paper: LibraryPaper | null;
  message: string;
  origin: AnswerOrigin;
  /** False when the backend accepted the file but didn't report processing status. */
  processingReported: boolean;
}

export interface UploadItem {
  id: string;
  fileName: string;
  size: number;
  options: UploadOptions;
  status: UploadStatus;
  progress: number;
  stage: UploadStage;
  message: string | null;
  error: string | null;
  origin: AnswerOrigin | null;
}

export type FileValidation = { ok: true } | { ok: false; reason: string };
