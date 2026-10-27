import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import styles from "./Dialog.module.css";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
}

/**
 * Modal built on the native <dialog> element, which provides focus containment, Escape to close,
 * an inert background and focus return to the opener. React owns the open state; the effect
 * only mirrors it onto the element.
 */
export function Dialog({ open, onClose, labelledBy, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // A click on the dialog element itself (not its content) is a click on the backdrop.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.inner}>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          <X aria-hidden="true" />
        </button>
        {open && children}
      </div>
    </dialog>
  );
}
