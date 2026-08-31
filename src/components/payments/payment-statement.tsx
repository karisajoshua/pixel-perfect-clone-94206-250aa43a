import { sortPayments } from "@/lib/policy-chain";
import { formatKES } from "@/lib/policy-balance";

export type StatementPayment = {
  id: string;
  amount: number | string;
  method?: string | null;
  reference?: string | null;
  paid_date: string;
  created_at?: string;
  invoice_no?: string | null;
};

const methodLabel = (m?: string | null) => {
  switch (m) {
    case "mpesa": return "M-Pesa";
    case "bank": return "Bank transfer";
    case "cash": return "Cash";
    case "cheque": return "Cheque";
    case "card": return "Card";
    default: return m ?? "—";
  }
};

/**
 * Running statement of part payments: every transaction, what had been paid
 * after it, and what was still owed. Sorted oldest first so the balance reads
 * downwards like a ledger.
 */
export function PaymentStatement({
  payments,
  total,
  showInvoice,
  renderActions,
  emptyText = "No payments recorded.",
}: {
  payments: StatementPayment[];
  total: number;
  showInvoice?: boolean;
  renderActions?: (payment: StatementPayment) => React.ReactNode;
  emptyText?: string;
}) {
  const sorted = sortPayments(payments.map((p) => ({ ...p, amount: Number(p.amount ?? 0) })));
  let cumulative = 0;
  const rows = sorted.map((p) => {
    cumulative += Number(p.amount);
    return { ...p, cumulative, balance: Math.max(0, Math.round((total - cumulative) * 100) / 100) };
  });
  const outstanding = Math.max(0, Math.round((total - cumulative) * 100) / 100);

  if (rows.length === 0) {
    return (
      <div className="space-y-2 text-sm">
        <div className="text-muted-foreground">{emptyText}</div>
        <div className="flex justify-between font-medium"><span>Outstanding</span><span className={outstanding > 0 ? "text-destructive" : ""}>{formatKES(outstanding)}</span></div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="py-2 pr-3 font-medium">Date</th>
            {showInvoice && <th className="py-2 pr-3 font-medium">Invoice</th>}
            <th className="py-2 pr-3 font-medium">Method / reference</th>
            <th className="py-2 pr-3 font-medium text-right">Amount</th>
            <th className="py-2 pr-3 font-medium text-right">Paid to date</th>
            <th className="py-2 pr-3 font-medium text-right">Balance</th>
            {renderActions && <th></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t align-top">
              <td className="py-2 pr-3 whitespace-nowrap">{r.paid_date}</td>
              {showInvoice && <td className="py-2 pr-3 font-mono text-xs">{r.invoice_no ?? "—"}</td>}
              <td className="py-2 pr-3">
                {methodLabel(r.method)}
                {r.reference ? <span className="text-muted-foreground"> · {r.reference}</span> : null}
              </td>
              <td className="py-2 pr-3 text-right font-medium">{Number(r.amount).toLocaleString()}</td>
              <td className="py-2 pr-3 text-right text-muted-foreground">{r.cumulative.toLocaleString()}</td>
              <td className={`py-2 pr-3 text-right ${r.balance > 0 ? "text-destructive" : "text-emerald-700"}`}>{r.balance.toLocaleString()}</td>
              {renderActions && <td className="py-2 text-right whitespace-nowrap">{renderActions(r)}</td>}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t font-semibold">
            <td className="py-2 pr-3" colSpan={(showInvoice ? 2 : 1) + 1}>Outstanding</td>
            <td className="py-2 pr-3 text-right">{formatKES(total)}</td>
            <td className="py-2 pr-3 text-right">{cumulative.toLocaleString()}</td>
            <td className={`py-2 pr-3 text-right ${outstanding > 0 ? "text-destructive" : "text-emerald-700"}`}>{outstanding.toLocaleString()}</td>
            {renderActions && <td></td>}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
