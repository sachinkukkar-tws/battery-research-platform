export interface FormulaPart {
  text: string;
  sub: boolean;
}

/**
 * Splits a chemical formula into normal and subscript runs: "Na3V2(PO4)3" becomes
 * Na, 3(sub), V, 2(sub), (PO, 4(sub), ), 3(sub). Digits are subscripted only after a letter or ")".
 */
export function formulaParts(formula: string): FormulaPart[] {
  const parts: FormulaPart[] = [];
  const re = /(?<=[A-Za-z)])(\d+(?:\.\d+)?)/g;
  let last = 0;
  for (const m of formula.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) parts.push({ text: formula.slice(last, i), sub: false });
    parts.push({ text: m[0], sub: true });
    last = i + m[0].length;
  }
  if (last < formula.length) parts.push({ text: formula.slice(last), sub: false });
  return parts;
}
