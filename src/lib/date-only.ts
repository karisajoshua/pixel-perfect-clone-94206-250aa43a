/**
 * Parse a value that may be a calendar date string ("YYYY-MM-DD") as a LOCAL date.
 * `new Date("2026-08-04")` is parsed as midnight UTC, which renders as the previous
 * day for viewers behind UTC. Full timestamps fall through to normal parsing.
 */
export function parseLocalDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const s = String(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function formatLocalDate(value: Date): string {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export function addDaysToDateISO(value: string, days: number): string {
  const date = parseLocalDate(value);
  if (!date) return "";
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

/** Inclusive final day of an annual cover beginning on `value`. */
export function annualEndDateISO(value: string): string {
  const date = parseLocalDate(value);
  if (!date) return "";
  date.setFullYear(date.getFullYear() + 1);
  date.setDate(date.getDate() - 1);
  return formatLocalDate(date);
}

export function isValidDateRange(start?: string | null, end?: string | null): boolean {
  const parsedStart = parseLocalDate(start);
  const parsedEnd = parseLocalDate(end);
  return !!parsedStart && !!parsedEnd && parsedEnd.getTime() >= parsedStart.getTime();
}
