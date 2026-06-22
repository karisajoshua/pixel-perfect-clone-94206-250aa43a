// Normalize phone numbers to E.164. Defaults to Kenya (+254) for local formats.
export function normalizePhone(input?: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Already E.164
  if (trimmed.startsWith("+")) return "+" + trimmed.slice(1).replace(/\D/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  // Kenyan local: 07XXXXXXXX or 01XXXXXXXX (10 digits starting with 0)
  if (digits.length === 10 && digits.startsWith("0")) return "+254" + digits.slice(1);
  // 7XXXXXXXX or 1XXXXXXXX (9 digits, no leading 0)
  if (digits.length === 9 && (digits.startsWith("7") || digits.startsWith("1"))) return "+254" + digits;
  // 2547XXXXXXXX without plus
  if (digits.length === 12 && digits.startsWith("254")) return "+" + digits;
  // Fallback: prepend +
  return "+" + digits;
}

export function looksLikeEmail(value: string): boolean {
  return value.includes("@");
}