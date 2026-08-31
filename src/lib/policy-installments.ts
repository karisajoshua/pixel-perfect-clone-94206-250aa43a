/**
 * Helpers for the one-month installment path:
 *   1 mo extendable  ->  (optional 2nd installment)  ->  Rest of Period (ROP)
 */

import { addDaysToDateISO, annualEndDateISO } from "@/lib/date-only";

export const INSTALLMENT_TERMS = ["one_month_extendable", "second_installment"] as const;

export type InstallmentPlan = "clear_balance" | "two_installments";

export const INSTALLMENT_PLAN_LABELS: Record<InstallmentPlan, string> = {
  clear_balance: "Clear balance next month → ROP",
  two_installments: "Split into 2 installments → ROP on 3rd month",
};

export const isInstallmentTerm = (term?: string | null) =>
  !!term && (INSTALLMENT_TERMS as readonly string[]).includes(term);

const toDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
};

export const addDaysISO = addDaysToDateISO;

/** Last day of the annual cover that began on `originalStart` (start + 12 months - 1 day). */
export const anniversaryEndISO = (originalStart: string) => {
  return annualEndDateISO(originalStart);
};

export const monthsBetween = (fromISO: string, toISOStr: string) => {
  const a = toDate(fromISO), b = toDate(toISOStr);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
};

export type InstallmentSummary = {
  annual: number;
  paid: number;
  balance: number;
  /** what staff should collect for the next installment */
  nextAmount: number;
  /** what remains after that next installment (0 under the clear-balance plan) */
  afterNext: number;
  cleared: boolean;
};

export function computeInstallmentSummary(opts: {
  premiumGross?: number | null;
  paid?: number | null;
  plan?: string | null;
  term?: string | null;
}): InstallmentSummary {
  const annual = Number(opts.premiumGross ?? 0);
  const paid = Number(opts.paid ?? 0);
  const balance = Math.max(0, Math.round((annual - paid) * 100) / 100);
  // Only the first month can still be split in two; on the 2nd installment cover
  // the remaining balance must be cleared to get the ROP.
  const split = opts.plan === "two_installments" && opts.term === "one_month_extendable";
  const nextAmount = split ? Math.round((balance / 2) * 100) / 100 : balance;
  return {
    annual,
    paid,
    balance,
    nextAmount,
    afterNext: Math.round((balance - nextAmount) * 100) / 100,
    cleared: balance <= 0.01 && annual > 0,
  };
}

/** The term the follow-on cover should carry. */
export function nextCoverTerm(term?: string | null, plan?: string | null): "second_installment" | "rop" {
  if (term === "one_month_extendable" && plan === "two_installments") return "second_installment";
  return "rop";
}

/** Builds the insert payload for the follow-on (2nd installment or ROP) policy. */
export function buildNextCoverPayload(policy: any, summary: InstallmentSummary) {
  const term = nextCoverTerm(policy.policy_term, policy.installment_plan);
  const chainStart = policy.installment_origin_start ?? policy.start_date;
  const start = addDaysISO(policy.end_date, 1);
  const anniversary = anniversaryEndISO(chainStart);
  const end = term === "second_installment" ? addDaysISO(start, 29) : anniversary;
  if (!start || !end || end < start) {
    throw new Error("This installment chain has no valid remaining cover period. Check the original policy dates.");
  }
  return {
    term,
    payload: {
      policy_no: "",
      certificate_no: null,
      client_id: policy.client_id,
      vehicle_id: policy.vehicle_id ?? null,
      insurer_id: policy.insurer_id ?? null,
      branch_id: policy.branch_id ?? null,
      product_class: policy.product_class,
      product_subclass: policy.product_subclass ?? null,
      tonnage: policy.tonnage ?? null,
      cover_type: policy.cover_type,
      sum_insured: policy.sum_insured ?? null,
      premium_gross: summary.balance || null,
      policy_term: term,
      installment_plan: term === "second_installment" ? policy.installment_plan : null,
      start_date: start,
      end_date: end,
      status: "active",
      payment_status: "unpaid",
      balance_due: summary.balance || null,
      previous_policy_id: policy.id,
      rop_of_policy_id: policy.id,
      notes: term === "rop"
        ? `Rest of period following ${policy.policy_no}.`
        : `Second installment following ${policy.policy_no}.`,
    } as Record<string, unknown>,
  };
}
