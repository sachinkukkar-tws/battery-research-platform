/** The client works in India; the prototype formats numbers with Indian digit grouping. */
export const NUMBER_LOCALE = "en-IN";

export const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

export const formatCount = (n: number) => n.toLocaleString(NUMBER_LOCALE);

export function formatFileSize(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export const capitalize = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

export const uid = (prefix = "id") => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
