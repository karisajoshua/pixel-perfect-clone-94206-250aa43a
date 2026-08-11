/**
 * Single source of truth for "how much is still owed on this cover".
 * Stored `balance_due` wins; otherwise it is derived from the premium minus
 * what has actually been paid. When neither is known the caller is told so it
 * can prompt staff instead of silently rendering a dash.
 */

export type PolicyBalanceInput = {
  premium_gross?: number | string | null;
  balance_due?: number | string | null;
  payment_status?: string | null;
};

export type PolicyBalance = {
  annual: number;
  paid: number;
  balance: number;
  /** true when there is no premium and no stored balance to work from */
  unknown: boolean;
  outstanding: boolean;
};

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

export function policyBalance(policy: PolicyBalanceInput, paid?: number | null): PolicyBalance {
  const annual = num(policy.premium_gross);
  const hasStored = policy.balance_due !== null && policy.balance_due !== undefined && policy.balance_due !== "";
  const paidKnown = paid !== null && paid !== undefined;
  const paidAmount = paidKnown ? Math.max(0, num(paid)) : 0;

  if (policy.payment_status === "paid") {
    return { annual, paid: paidKnown ? paidAmount : annual, balance: 0, unknown: false, outstanding: false };
  }

  let balance: number;
  let unknown = false;
  if (hasStored) {
    balance = Math.max(0, round2(num(policy.balance_due)));
  } else if (annual > 0) {
    balance = Math.max(0, round2(annual - paidAmount));
  } else {
    balance = 0;
    unknown = true;
  }

  const resolvedPaid = paidKnown ? paidAmount : Math.max(0, round2(annual - balance));
  return { annual, paid: resolvedPaid, balance, unknown, outstanding: balance > 0.01 };
}

export const formatKES = (n: number) => `KES ${Number(n).toLocaleString()}`;

/** Display string for a balance, including the "not set" prompt. */
export function balanceLabel(b: PolicyBalance) {
  return b.unknown ? "Balance not set — add the premium" : formatKES(b.balance);
}