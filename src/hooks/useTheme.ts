import { useCallback, useEffect } from "react";
import { useMediaQuery } from "./useMediaQuery";
import { useStoredState } from "./useStoredState";

export type ThemeChoice = "system" | "light" | "dark";

/**
 * Follows the system theme until the person picks one, then remembers it.
 * index.html applies the stored choice before React loads, so there is no flash.
 */
export function useTheme() {
  const [choice, setChoice] = useStoredState<ThemeChoice>("brp-theme", "system", ["system", "light", "dark"]);
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  const resolved: "light" | "dark" = choice === "system" ? (systemDark ? "dark" : "light") : choice;

  // Syncing with the <html> element is an external system, so an effect is appropriate here.
  useEffect(() => {
    const root = document.documentElement;
    if (choice === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", choice);
  }, [choice]);

  const toggle = useCallback(() => {
    const root = document.documentElement;
    root.classList.add("theming");
    setChoice(resolved === "dark" ? "light" : "dark");
    window.setTimeout(() => root.classList.remove("theming"), 400);
  }, [resolved, setChoice]);

  return { theme: resolved, toggle };
}
