/**
 * Business-time helpers.
 *
 * All date-based insurance automation (renewal windows, due dates, expiry
 * offsets) is evaluated in the agency's business timezone, not UTC.
 * Kenya (Africa/Nairobi) is a fixed UTC+3 zone with no DST, but we still go
 * through Intl so nothing is hard-coded to a numeric offset.
 *
 * Stored timestamps stay UTC — only the *calendar date* used for business
 * comparisons is converted.
 */
export const BUSINESS_TIMEZONE = "Africa/Nairobi";

/** Calendar date (YYYY-MM-DD) in the business timezone for a given instant. */
export function businessDate(at: Date = new Date(), timeZone = BUSINESS_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** Wall-clock parts (date + hour/minute) in the business timezone. */
export function businessParts(at: Date = new Date(), timeZone = BUSINESS_TIMEZONE) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .formatToParts(at)
    .reduce<Record<string, string>>((a, x) => ((a[x.type] = x.value), a), {});
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    hour: Number(p.hour === "24" ? "0" : p.hour),
    minute: Number(p.minute),
    timezone: timeZone,
  };
}

/** Add whole days to a YYYY-MM-DD date string (calendar arithmetic, DST-free). */
export function addDaysToDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Whole days between two YYYY-MM-DD dates (to - from). */
export function daysBetweenDates(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Days from the business "today" until a date (negative when in the past). */
export function daysUntilBusinessDate(target: string, at: Date = new Date()): number {
  return daysBetweenDates(businessDate(at), target.slice(0, 10));
}
