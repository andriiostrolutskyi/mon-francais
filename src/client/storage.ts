import { useEffect, useState } from "react";
import type { ZodType } from "zod";

export function readText(key: string, fallback = "") {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

export function readStored<T>(key: string, schema: ZodType<T>): T | null {
  try {
    const result = schema.safeParse(JSON.parse(readText(key, "null")));
    return result.success ? result.data : null;
  } catch { return null; }
}

export function storeText(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}

export function useStoredSelection<T extends string>(key: string, choices: readonly T[], fallback: T) {
  const [stored, setStored] = useState(() => readText(key, fallback));
  const value = choices.find((choice) => choice === stored) ?? fallback;
  // Preserve the saved ID while remote choices are still loading.
  useEffect(() => { storeText(key, stored); }, [key, stored]);
  return [value, setStored] as const;
}
