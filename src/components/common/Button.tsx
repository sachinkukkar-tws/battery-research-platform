import { forwardRef, type ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "quiet" | "success" | "link";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Shows a busy state and blocks repeat clicks. */
  busy?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", busy = false, className, type = "button", disabled, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={[styles.btn, styles[variant], className].filter(Boolean).join(" ")}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {children}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: "raised" | "plain";
  pressed?: boolean;
}

/** Icon-only button. `label` is required so it always has an accessible name and tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = "raised", pressed, className, type = "button", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={[styles.icon, styles[`icon-${variant}`], className].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
});
