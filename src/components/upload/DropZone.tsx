import { useId, useState, type DragEvent } from "react";
import { FileUp } from "lucide-react";
import { formatFileSize } from "@/domain/format";
import styles from "./Upload.module.css";

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  maxBytes: number;
  disabled?: boolean;
}

/**
 * Drag-and-drop target backed by a real file input. The input is visually hidden but still
 * focusable, so keyboard users press Enter or Space on it to open the file picker.
 */
export function DropZone({ onFiles, maxBytes, disabled }: DropZoneProps) {
  const [over, setOver] = useState(false);
  const inputId = useId();
  const hintId = useId();

  const onDrag = (e: DragEvent) => {
    e.preventDefault();
    if (!disabled) setOver(e.type === "dragenter" || e.type === "dragover");
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (!disabled && e.dataTransfer.files.length) onFiles([...e.dataTransfer.files]);
  };

  return (
    <label
      htmlFor={inputId}
      className={`${styles.drop} ${over ? styles.over : ""}`}
      onDragEnter={onDrag}
      onDragOver={onDrag}
      onDragLeave={onDrag}
      onDrop={onDrop}
    >
      <FileUp aria-hidden="true" className={styles.dropIcon} strokeWidth={1.6} />
      <strong>Drop PDFs here</strong>
      <span className="muted">or select files from your computer</span>
      <span className="small muted" id={hintId}>PDF only, up to {formatFileSize(maxBytes)} each</span>
      <input
        id={inputId}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        disabled={disabled}
        className={styles.fileInput}
        aria-describedby={hintId}
        onChange={(e) => {
          if (e.target.files?.length) onFiles([...e.target.files]);
          e.target.value = "";
        }}
      />
    </label>
  );
}
