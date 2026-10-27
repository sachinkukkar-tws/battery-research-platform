import { useCallback, useState, type KeyboardEvent } from "react";

/** Hover/focus tracking and keyboard activation shared by the chart marks. */
export function useChartPointer(onSelect: (index: number) => void) {
  const [active, setActive] = useState<number | null>(null);
  const markProps = useCallback(
    (i: number, label: string, tipId: string) => ({
      tabIndex: 0,
      role: "button" as const,
      "aria-label": label,
      "aria-describedby": active === i ? tipId : undefined,
      onMouseEnter: () => setActive(i),
      onMouseLeave: () => setActive((a) => (a === i ? null : a)),
      onFocus: () => setActive(i),
      onBlur: () => setActive((a) => (a === i ? null : a)),
      onClick: () => {
        setActive(null);
        onSelect(i);
      },
      onKeyDown: (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(i);
        }
        if (e.key === "Escape") setActive(null);
      },
    }),
    [active, onSelect],
  );
  return { active, markProps };
}
