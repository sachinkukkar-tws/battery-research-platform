import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import styles from "./Toast.module.css";

export type ToastTone = "success" | "error";

interface ToastApi {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
}

const DURATION_MS = { success: 3200, error: 6000 };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const counter = useRef(0);

  const showToast = useCallback((message: string, tone: ToastTone = "success") => {
    counter.current += 1;
    setToast({ id: counter.current, message, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), DURATION_MS[toast.tone]);
    return () => clearTimeout(t);
  }, [toast]);

  const api = useMemo(() => ({ showToast }), [showToast]);
  const Icon = toast?.tone === "error" ? AlertCircle : CheckCircle2;

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* The live region stays mounted so screen readers announce each new message. */}
      <div className={styles.region} role="status" aria-live="polite" aria-atomic="true">
        {toast && (
          <div key={toast.id} className={`${styles.toast} ${toast.tone === "error" ? styles.error : ""}`}>
            <Icon aria-hidden="true" size={20} />
            <span>{toast.message}</span>
            <button type="button" className={styles.close} onClick={() => setToast(null)} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const t = useContext(ToastContext);
  if (!t) throw new Error("useToast must be used inside <ToastProvider>");
  return t;
}
