import { useEffect } from "react";

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title}, Battery Science Explorer`;
  }, [title]);
}
