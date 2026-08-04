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
