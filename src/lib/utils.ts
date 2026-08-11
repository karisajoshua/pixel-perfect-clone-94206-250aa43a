import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const POLICY_TERM_LABELS: Record<string, string> = {
  tor: "1 mo (TOR)",
  one_month_extendable: "1 mo ext.",
  second_installment: "2nd installment",
  rop: "ROP",
  six_months: "6 mo",
  annual: "Annual",
};
export const policyTermLabel = (t?: string | null) => (t ? POLICY_TERM_LABELS[t] ?? t : "—");
