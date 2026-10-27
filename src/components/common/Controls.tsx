import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import styles from "./Controls.module.css";

interface FieldProps {
  label: string;
  children: ReactNode;
  grow?: boolean;
  hidden?: boolean;
}

/** Visible label wrapping one control, so the label is always programmatically associated. */
export function Field({ label, children, grow, hidden }: FieldProps) {
  return (
    <label className={[styles.field, grow ? styles.grow : ""].join(" ")} hidden={hidden}>
      <span className={styles.label}>{label}</span>
      {children}
    </label>
  );
}

export function Controls({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={[styles.controls, className].filter(Boolean).join(" ")}>{children}</div>;
}

export interface Option<T extends string = string> {
  value: T;
  label: string;
}

interface SelectProps<T extends string> extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> {
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  wide?: boolean;
}

export function Select<T extends string>({ value, options, onChange, wide, className, ...rest }: SelectProps<T>) {
  return (
    <select
      className={[styles.select, wide ? styles.wide : "", className].filter(Boolean).join(" ")}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      {...rest}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={[styles.text, className].filter(Boolean).join(" ")} {...rest} />;
});

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** A checkbox styled as a switch. Native semantics keep it keyboard and screen-reader friendly. */
export function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <label className={styles.toggle}>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (v: T) => void;
}

export function SegmentedControl<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className={styles.field}>
      <span className={styles.label} aria-hidden="true">
        {label}
      </span>
      <div className={styles.seg} role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
