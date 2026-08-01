import { supabase } from "@/integrations/supabase/client";

/** Removes payments and line items, then the invoice itself. */
export async function deleteInvoiceCascade(invoiceId: string) {
  const p = await supabase.from("payments").delete().eq("invoice_id", invoiceId);
  if (p.error) throw new Error(p.error.message);
  const it = await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
  if (it.error) throw new Error(it.error.message);
  const inv = await supabase.from("invoices").delete().eq("id", invoiceId);
  if (inv.error) throw new Error(inv.error.message);
}