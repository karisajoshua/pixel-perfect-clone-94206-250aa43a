import { supabase } from "@/integrations/supabase/client";

/**
 * Keeps a policy's payment fields in step with the invoice(s) raised against it.
 * Called after a payment is recorded or removed.
 */
export async function syncPolicyFromInvoice(policyId?: string | null) {
  if (!policyId) return;
  const { data: invoices } = await supabase
    .from("invoices")
    .select("total, amount_paid")
    .eq("policy_id", policyId);
  if (!invoices || invoices.length === 0) return;

  const total = invoices.reduce((s, i) => s + Number(i.total ?? 0), 0);
  const paid = invoices.reduce((s, i) => s + Number(i.amount_paid ?? 0), 0);
  const balance = Math.max(0, total - paid);
  const payment_status = paid <= 0 ? "unpaid" : balance <= 0.01 ? "paid" : "partial";

  const { data: policy } = await supabase
    .from("policies")
    .select("premium_gross")
    .eq("id", policyId)
    .maybeSingle();

  const update: Record<string, unknown> = { payment_status, balance_due: balance };
  if (policy && (policy.premium_gross === null || Number(policy.premium_gross) === 0) && total > 0) {
    update.premium_gross = total;
  }
  await supabase.from("policies").update(update as any).eq("id", policyId);
}