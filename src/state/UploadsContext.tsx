import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { UploadItem, UploadOptions } from "@/types";
import { validatePdf } from "@/domain/upload";
import { uid } from "@/domain/format";
import { DATASETS } from "@/data/datasets";
import { describeError, isAbort } from "@/services";
import { useServices } from "./ServicesContext";
import { useResearchData } from "./ResearchDataContext";
import { useToast } from "./ToastContext";

interface UploadsApi {
  items: UploadItem[];
  /** Validates and starts uploading. Returns a reason for every file that was turned away. */
  addFiles: (files: File[], options: UploadOptions) => string[];
  cancel: (id: string) => void;
  retry: (id: string) => void;
  dismiss: (id: string) => void;
}

const UploadsContext = createContext<UploadsApi | null>(null);

const ACTIVE = new Set(["uploading", "processing"]);

/** Lives above the routes so uploads keep going when the person leaves the Upload page. */
export function UploadsProvider({ children }: { children: ReactNode }) {
  const { documents, config } = useServices();
  const { addPaper, refreshLibrary } = useResearchData();
  const { showToast } = useToast();
  const [items, setItems] = useState<UploadItem[]>([]);
  const files = useRef(new Map<string, File>());
  const controllers = useRef(new Map<string, AbortController>());
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const all = controllers.current;
    return () => all.forEach((c) => c.abort());
  }, []);

  const patch = useCallback((id: string, p: Partial<UploadItem>) => {
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...p } : it)));
  }, []);

  const run = useCallback(
    async (id: string, file: File, options: UploadOptions) => {
      const controller = new AbortController();
      controllers.current.set(id, controller);
      patch(id, { status: "uploading", progress: 0, stage: 0, error: null, message: null });
      try {
        const result = await documents.uploadPaper(
          file,
          options,
          {
            onProgress: (f) => patch(id, f >= 1 ? { progress: 1, status: "processing" } : { progress: f }),
            onStage: (stage) => patch(id, { stage, status: "processing", progress: 1 }),
          },
          controller.signal,
        );
        patch(id, {
          status: "completed",
          progress: 1,
          stage: result.processingReported ? 3 : 0,
          message: result.message,
          origin: result.origin,
        });
        if (result.paper) addPaper(result.paper);
        else void refreshLibrary();
        showToast(`${file.name} added to ${DATASETS[options.datasetId].label}.`);
      } catch (e) {
        if (isAbort(e)) patch(id, { status: "cancelled", error: null, message: "Upload cancelled." });
        else patch(id, { status: "failed", error: describeError(e) });
      } finally {
        controllers.current.delete(id);
      }
    },
    [addPaper, documents, patch, refreshLibrary, showToast],
  );

  const addFiles = useCallback(
    (incoming: File[], options: UploadOptions) => {
      const rejected: string[] = [];
      const accepted: UploadItem[] = [];
      for (const file of incoming) {
        const check = validatePdf(file, config.maxUploadBytes);
        if (!check.ok) {
          rejected.push(check.reason);
          continue;
        }
        const duplicate = itemsRef.current.some(
          (it) => it.fileName === file.name && it.size === file.size && ACTIVE.has(it.status),
        );
        if (duplicate) {
          rejected.push(`${file.name} is already uploading.`);
          continue;
        }
        const id = uid("up");
        files.current.set(id, file);
        accepted.push({
          id, fileName: file.name, size: file.size, options, status: "uploading", progress: 0, stage: 0,
          message: null, error: null, origin: null,
        });
      }
      if (accepted.length) {
        setItems((list) => [...accepted.reverse(), ...list]);
        accepted.forEach((it) => void run(it.id, files.current.get(it.id)!, options));
      }
      return rejected;
    },
    [config.maxUploadBytes, run],
  );

  const cancel = useCallback((id: string) => controllers.current.get(id)?.abort(), []);

  const retry = useCallback(
    (id: string) => {
      const file = files.current.get(id);
      const item = itemsRef.current.find((it) => it.id === id);
      if (file && item && !ACTIVE.has(item.status)) void run(id, file, item.options);
    },
    [run],
  );

  const dismiss = useCallback((id: string) => {
    controllers.current.get(id)?.abort();
    files.current.delete(id);
    setItems((list) => list.filter((it) => it.id !== id));
  }, []);

  const api = useMemo(() => ({ items, addFiles, cancel, retry, dismiss }), [items, addFiles, cancel, retry, dismiss]);
  return <UploadsContext.Provider value={api}>{children}</UploadsContext.Provider>;
}

export function useUploads(): UploadsApi {
  const v = useContext(UploadsContext);
  if (!v) throw new Error("useUploads must be used inside <UploadsProvider>");
  return v;
}
