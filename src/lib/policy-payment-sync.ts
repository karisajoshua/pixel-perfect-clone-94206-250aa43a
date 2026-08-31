import { supabase } from "@/integrations/supabase/client";
import { fetchPolicyChainIds } from "@/lib/policy-chain";

/**
 * Keeps a cover's payment fields in step with the invoice(s) raised against it
 * — and against every other cover in the same instalment chain, because the
 * money is usually invoiced once on the first cover but settles them all.
 * Called after a payment is recorded or removed.
 */
export async function syncPolicyFromInvoice(policyId?: string | null) {
  if (!policyId) return;
  const chainIds = await fetchPolicyChainIds(policyId);
  if (chainIds.length === 0) return;

  const { data: invoices } = await supabase
    .from("invoices")
    .select("total, amount_paid")
    .in("policy_id", chainIds);
  if (!invoices || invoices.length === 0) return;

  const total = invoices.reduce((s, i) => s + Number(i.total ?? 0), 0);
  const paid = invoices.reduce((s, i) => s + Number(i.amount_paid ?? 0), 0);
  const balance = Math.max(0, Math.round((total - paid) * 100) / 100);
  const payment_status = paid <= 0 ? "unpaid" : balance <= 0.01 ? "paid" : "partial";

  const { data: policies } = await supabase
    .from("policies")
    .select("id, premium_gross")
    .in("id", chainIds);

  for (const policy of policies ?? []) {
    const update: Record<string, unknown> = { payment_status, balance_due: balance };
    if ((policy.premium_gross === null || Number(policy.premium_gross) === 0) && total > 0) {
      update.premium_gross = total;
    }
    await supabase.from("policies").update(update as any).eq("id", policy.id);
  }
}
