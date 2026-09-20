// Shared metric definitions so the main dashboard and the analytics/reports page
// always count the same thing. Pure helpers — safe on client and server.

export type CoverLike = {
  status?: string | null;
  cancelled_at?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  previous_policy_id?: string | null;
  policy_term?: string | null;
};

export const todayISO = (): string => new Date().toISOString().slice(0, 10);

/** A cover counts as live when its certificate dates still cover today and it is not cancelled. */
export const isLiveCover = (p: CoverLike, today: string = todayISO()): boolean =>
  p.status === "active" &&
  !p.cancelled_at &&
  (!p.start_date || p.start_date <= today) &&
  (!p.end_date || p.end_date >= today);

/** First-time business: not a renewal, not a second instalment, not a rest-of-period cover. */
export const isNewBusiness = (p: CoverLike): boolean =>
  !p.previous_policy_id && !["second_installment", "rop"].includes(String(p.policy_term ?? ""));
