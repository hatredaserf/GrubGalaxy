// lib/admin-utils.ts

/** Accepts either [..] or { data: [..] } from the backend. */
export function asList<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  const maybe = (res as { data?: unknown })?.data;
  return Array.isArray(maybe) ? (maybe as T[]) : [];
}

/** MySQL tinyint(1) often arrives as 0/1, so normalize to a boolean. */
export function toBool(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export function formatDate(value?: string): string {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
}