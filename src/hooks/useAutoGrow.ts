import { useLayoutEffect, type RefObject } from "react";

/** Grows a textarea with its content up to a maximum height. */
export function useAutoGrow(ref: RefObject<HTMLTextAreaElement>, value: string, maxPx = 200) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxPx)}px`;
  }, [ref, value, maxPx]);
}
