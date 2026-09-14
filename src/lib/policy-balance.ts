/**
 * Single source of truth for "how much is still owed on this cover".
 * The figures win over the stored status label: a cover only counts as
 * paid in full when the computed balance is zero, even if a stale
 * `payment_status = 'paid'` says otherwise (manual edits, imports).
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
  /** true when the stored payment_status label disagrees with the figures */
  mismatch: boolean;
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

  const outstanding = balance > 0.01;
  const resolvedPaid = paidKnown ? paidAmount : Math.max(0, round2(annual - balance));

  const status = String(policy.payment_status ?? "");
  const mismatch =
    !unknown &&
    ((status === "paid" && outstanding) ||
      (status !== "" && status !== "paid" && !outstanding && (annual > 0 || hasStored)));

  return { annual, paid: resolvedPaid, balance, unknown, outstanding, mismatch };
}

export const formatKES = (n: number) => `KES ${Number(n).toLocaleString()}`;

/**
 * A cover is live when today falls inside its dates and its status is one of
 * the "in force" states. Renewed and pending covers count as active — they are
 * real cover, they just carry a workflow status.
 */
const ACTIVE_STATUSES = ["active", "renewed", "pending"];

export function isCoverActive(policy: { status?: string | null; start_date?: string | null; end_date?: string | null } | null | undefined) {
  if (!policy) return false;
  if (!ACTIVE_STATUSES.includes(String(policy.status ?? ""))) return false;
  const today = new Date().toISOString().slice(0, 10);
  if (policy.start_date && policy.start_date > today) return false;
  if (policy.end_date && policy.end_date < today) return false;
  return true;
}

export type CoverLabel = { label: string; tone: "active" | "expired" | "pending" | "cancelled" | "neutral" };

/**
 * What a cover should be called on screen. The dates win over the stored
 * status word: a one-month cover whose expiry has passed reads "Expired"
 * even if the record still says "active". Display only — nothing is written.
 */
export function coverLabel(
  policy: { status?: string | null; start_date?: string | null; end_date?: string | null } | null | undefined,
): CoverLabel {
  const status = String(policy?.status ?? "");
  if (!policy) return { label: "—", tone: "neutral" };
  if (status === "cancelled") return { label: "cancelled", tone: "cancelled" };
  const today = new Date().toISOString().slice(0, 10);
  if (ACTIVE_STATUSES.includes(status)) {
    if (policy.end_date && policy.end_date < today) return { label: "expired", tone: "expired" };
    if (policy.start_date && policy.start_date > today) return { label: "not started", tone: "pending" };
    return { label: "active", tone: "active" };
  }
  if (status === "expired") return { label: "expired", tone: "expired" };
  return { label: status || "—", tone: "neutral" };
}

export const COVER_TONE_CLASS: Record<CoverLabel["tone"], string> = {
  active: "bg-green-100 text-green-900 border-green-200",
  expired: "bg-red-100 text-red-900 border-red-200",
  pending: "bg-yellow-100 text-yellow-900 border-yellow-200",
  cancelled: "bg-gray-100 text-gray-700 border-gray-200",
  neutral: "",
};

/** Display string for a balance, including the "not set" prompt. */
export function balanceLabel(b: PolicyBalance) {
  return b.unknown ? "Balance not set — add the premium" : formatKES(b.balance);
}
