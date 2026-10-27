import type { LibraryPaper, UploadEvents, UploadOptions, UploadResult, UploadStage } from "@/types";
import { MOCK_LIBRARY } from "@/data/mockData";
import { DATASETS } from "@/data/datasets";
import type { AppConfig } from "./config";
import { ApiError, errorForStatus, requestJson } from "./http";
import { sleep } from "./sleep";
import { isObj, parseLibrary, parseLibraryPaper } from "./validate";

/** Library documents and PDF ingestion. */
export interface DocumentService {
  listPapers(signal?: AbortSignal): Promise<LibraryPaper[]>;
  uploadPaper(file: File, options: UploadOptions, events: UploadEvents, signal?: AbortSignal): Promise<UploadResult>;
}

let mockUploadCount = 0;

export function createMockDocumentService({ delayMs = 250, stepMs = 900 }: { delayMs?: number; stepMs?: number } = {}): DocumentService {
  return {
    async listPapers(signal) {
      await sleep(delayMs, signal);
      return structuredClone(MOCK_LIBRARY);
    },
    async uploadPaper(file, options, events, signal) {
      const ds = DATASETS[options.datasetId];
      // Simulated progress so the UI states can be demonstrated. Nothing leaves the browser.
      for (let p = 1; p <= 5; p++) {
        await sleep(stepMs / 5, signal);
        events.onProgress?.(p / 5);
      }
      for (let s = 1; s <= 3; s++) {
        events.onStage?.(s as UploadStage);
        await sleep(stepMs, signal);
      }
      mockUploadCount += 1;
      return {
        origin: "mock",
        processingReported: true,
        message: `Demo mode: the file wasn’t sent anywhere. When connected, it’s added to the ${ds.label} dataset in Amplifi and can be searched in Ask Amplifi${options.extract ? ", and its extracted values appear in Review" : ""}.`,
        paper: {
          id: `UP${mockUploadCount}`,
          authors: "Uploaded paper",
          year: null,
          title: file.name.replace(/\.pdf$/i, ""),
          type: "Not yet identified",
          collection: ds.collection,
          status: "Harvested",
          values: null,
          note: `Demo upload to ${ds.label}. When connected, the harvester identifies the paper from its DOI${options.extract ? " and extracts its values for Review" : ""}.`,
          isDemoUpload: true,
        },
      };
    },
  };
}

/**
 * Upload uses XMLHttpRequest because fetch() cannot report upload progress.
 * Contract (from the prototype): POST {base}/upload, multipart form with file, dataset, extract.
 * The response body is optional; if it contains a `paper` object it is added to the Library.
 */
function xhrUpload(url: string, form: FormData, timeoutMs: number, events: UploadEvents, signal?: AbortSignal): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.timeout = timeoutMs;
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) events.onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) return reject(errorForStatus(xhr.status, "The platform"));
      if (!xhr.responseText) return resolve(null);
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch {
        reject(new ApiError("invalid_response", "The platform sent a response that isn’t valid JSON."));
      }
    };
    xhr.onerror = () => reject(new ApiError("network", "Couldn’t reach the platform. Check your connection and try again."));
    xhr.ontimeout = () => reject(new ApiError("timeout", "The upload took too long. Try again."));
    xhr.onabort = () => reject(new ApiError("aborted", "The upload was cancelled."));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}

export function createHttpDocumentService(config: AppConfig): DocumentService {
  const base = config.platformApiBase;
  const service = "The platform";
  return {
    listPapers: (signal) =>
      requestJson(`${base}/papers`, { signal, timeoutMs: config.timeoutMs, service, parse: (r) => parseLibrary(r, service) }),
    async uploadPaper(file, options, events, signal) {
      const form = new FormData();
      form.append("file", file);
      form.append("dataset", options.datasetId);
      form.append("extract", String(options.extract));
      // Uploads can be large; allow four times the normal timeout.
      const raw = await xhrUpload(`${base}/upload`, form, config.timeoutMs * 4, events, signal);
      const paper = isObj(raw) && isObj(raw.paper) ? parseLibraryPaper(raw.paper, service, 0) : null;
      return {
        origin: "amplifi",
        paper,
        // The prototype's platform API doesn't report ingestion progress after the upload completes.
        processingReported: false,
        message: "The platform accepted the file. Processing continues in the background; the paper appears in the Library when it’s ready.",
      };
    },
  };
}
