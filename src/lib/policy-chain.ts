import { supabase } from "@/integrations/supabase/client";

/**
 * Instalment covers (1-month extendable -> 2nd instalment -> ROP) are separate
 * policy rows linked by `rop_of_policy_id`. Money is usually invoiced once, on
 * the first cover in that chain, so any "what has been paid on this cover"
 * question has to be answered across the whole chain.
 *
 * Renewals use `previous_policy_id` and are deliberately NOT followed here:
 * a renewal is a new period with its own money.
 */
export async function fetchPolicyChainIds(policyId: string): Promise<string[]> {
  if (!policyId) return [];

  // Walk up to the root of the instalment chain.
  let rootId = policyId;
  for (let i = 0; i < 6; i++) {
    const { data } = await supabase
      .from("policies")
      .select("rop_of_policy_id")
      .eq("id", rootId)
      .maybeSingle();
    const parent = (data as any)?.rop_of_policy_id as string | null | undefined;
    if (!parent || parent === rootId) break;
    rootId = parent;
  }

  // Then walk down collecting every descendant.
  const ids = new Set<string>([rootId, policyId]);
  let frontier = [rootId];
  for (let i = 0; i < 6 && frontier.length; i++) {
    const { data } = await supabase
      .from("policies")
      .select("id")
      .in("rop_of_policy_id", frontier);
    const next = (data ?? []).map((r: any) => r.id).filter((cid: string) => !ids.has(cid));
    next.forEach((cid: string) => ids.add(cid));
    frontier = next;
  }
  return [...ids];
}

export type ChainInvoice = {
  id: string;
  invoice_no: string;
  policy_id: string | null;
  issue_date: string;
  due_date: string;
  total: number;
  amount_paid: number;
  status: string;
  payments: ChainPayment[];
};

export type ChainPayment = {
  id: string;
  invoice_id: string;
  amount: number;
  method: string | null;
  reference: string | null;
  paid_date: string;
  created_at: string;
};

/** Every invoice (with its payments) raised anywhere on this cover's chain. */
export async function fetchChainInvoices(policyId: string): Promise<ChainInvoice[]> {
  const ids = await fetchPolicyChainIds(policyId);
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("invoices")
    .select("id, invoice_no, policy_id, issue_date, due_date, total, amount_paid, status, payments(id, invoice_id, amount, method, reference, paid_date, created_at)")
    .in("policy_id", ids)
    .order("issue_date", { ascending: true });
  return ((data ?? []) as any[]).map((i) => ({
    ...i,
    total: Number(i.total ?? 0),
    amount_paid: Number(i.amount_paid ?? 0),
    payments: (i.payments ?? []).map((p: any) => ({ ...p, amount: Number(p.amount ?? 0) })),
  }));
}

export function sortPayments<T extends { paid_date: string; created_at?: string }>(payments: T[]): T[] {
  return [...payments].sort((a, b) => {
    if (a.paid_date !== b.paid_date) return a.paid_date < b.paid_date ? -1 : 1;
    return String(a.created_at ?? "") < String(b.created_at ?? "") ? -1 : 1;
  });
}

/** Flattened chain totals, used for a cover's paid / balance figures. */
export function chainTotals(invoices: ChainInvoice[]) {
  const billed = invoices.reduce((s, i) => s + i.total, 0);
  const paid = invoices.reduce((s, i) => s + i.payments.reduce((t, p) => t + p.amount, 0), 0);
  return { billed, paid, balance: Math.max(0, Math.round((billed - paid) * 100) / 100) };
}
