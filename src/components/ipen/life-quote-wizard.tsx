import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listLifeProducts,
  listLifeProductFrequencies,
  createLifeQuote,
  getLifeBenefitsSchedule,
  confirmLifeQuote,
} from "@/lib/ipen/policies.functions";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type Step = "product" | "quote" | "schedule" | "confirm" | "done";

export function LifeQuoteWizard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const productsFn = useServerFn(listLifeProducts);
  const freqFn = useServerFn(listLifeProductFrequencies);
  const createFn = useServerFn(createLifeQuote);
  const scheduleFn = useServerFn(getLifeBenefitsSchedule);
  const confirmFn = useServerFn(confirmLifeQuote);

  const [step, setStep] = useState<Step>("product");
  const [productId, setProductId] = useState<string>("");
  const [premiumOption, setPremiumOption] = useState<string>("");
  const [term, setTerm] = useState<string>("10");
  const [sumInsured, setSumInsured] = useState<string>("");
  const [quote, setQuote] = useState<any>(null);
  const [schedule, setSchedule] = useState<any>(null);
  const [policyStartDate, setPolicyStartDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [busy, setBusy] = useState(false);

  const products = useQuery({
    queryKey: ["ipen", "life-products"],
    queryFn: () => productsFn(),
    enabled: open,
  });
  const frequencies = useQuery({
    queryKey: ["ipen", "life-freq", productId],
    queryFn: () => freqFn({ data: { productId } }),
    enabled: !!productId,
  });

  const productList: any[] = Array.isArray(products.data)
    ? products.data
    : ((products.data as any)?.data ?? []);
  const freqList: any[] = Array.isArray(frequencies.data)
    ? frequencies.data
    : ((frequencies.data as any)?.data ?? []);

  const create = async () => {
    setBusy(true);
    try {
      const res = await createFn({
        data: {
          product: productId,
          premiumOption,
          term,
          hasSpouse: false,
          calculateSumInsured: !sumInsured,
          sumInsured: sumInsured || undefined,
        },
      });
      setQuote(res);
      setStep("schedule");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create quote");
    } finally {
      setBusy(false);
    }
  };

  const loadSchedule = async () => {
    const quoteId =
      quote?.quoteId ?? quote?.id ?? quote?.data?.quoteId ?? quote?.data?.id;
    if (!quoteId) return toast.error("Missing quote id");
    setBusy(true);
    try {
      const res = await scheduleFn({ data: { quoteId } });
      setSchedule(res);
      setStep("confirm");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load schedule");
    } finally {
      setBusy(false);
    }
  };

  const confirmIt = async () => {
    const quoteId =
      quote?.quoteId ?? quote?.id ?? quote?.data?.quoteId ?? quote?.data?.id;
    if (!quoteId) return toast.error("Missing quote id");
    setBusy(true);
    try {
      await confirmFn({
        data: {
          quoteId,
          policyStartDate,
          productId,
          insurerId: quote?.insurerId ?? quote?.data?.insurerId ?? 0,
        },
      });
      setStep("done");
      toast.success("Life policy quote confirmed");
    } catch (e: any) {
      toast.error(e?.message ?? "Confirm failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New life insurance quote</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {step === "product" && (
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label className="text-xs">Product</Label>
                <select
                  className="w-full border rounded-md px-2 py-1.5 bg-background"
                  value={productId}
                  onChange={(e) => {
                    setProductId(e.target.value);
                    setPremiumOption("");
                  }}
                >
                  <option value="">Select a product…</option>
                  {productList.map((p: any) => (
                    <option key={p.id ?? p.productId} value={String(p.id ?? p.productId)}>
                      {p.name ?? p.productName ?? `Product ${p.id}`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Premium frequency</Label>
                <select
                  className="w-full border rounded-md px-2 py-1.5 bg-background"
                  value={premiumOption}
                  onChange={(e) => setPremiumOption(e.target.value)}
                  disabled={!productId}
                >
                  <option value="">Select…</option>
                  {freqList.map((f: any) => (
                    <option key={f.id ?? f.frequencyId} value={String(f.id ?? f.frequencyId)}>
                      {f.name ?? f.frequencyName ?? `Frequency ${f.id}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Term (years)</Label>
                  <Input value={term} onChange={(e) => setTerm(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Sum insured (optional)</Label>
                  <Input value={sumInsured} onChange={(e) => setSumInsured(e.target.value)} />
                </div>
              </div>
            </div>
          )}
          {step === "schedule" && quote && (
            <div>
              <div className="text-xs mb-2 text-muted-foreground">Quote received.</div>
              <pre className="bg-muted/40 p-2 rounded text-xs overflow-auto max-h-64">
                {JSON.stringify(quote, null, 2)}
              </pre>
            </div>
          )}
          {step === "confirm" && (
            <div className="space-y-3">
              <pre className="bg-muted/40 p-2 rounded text-xs overflow-auto max-h-56">
                {JSON.stringify(schedule, null, 2)}
              </pre>
              <div>
                <Label className="text-xs">Policy start date</Label>
                <Input
                  type="date"
                  value={policyStartDate}
                  onChange={(e) => setPolicyStartDate(e.target.value)}
                />
              </div>
            </div>
          )}
          {step === "done" && (
            <div className="text-sm text-muted-foreground">
              Quote confirmed. Proceed to payment in the policies module.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          {step === "product" && (
            <Button disabled={busy || !productId || !premiumOption} onClick={create}>
              {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Generate quote
            </Button>
          )}
          {step === "schedule" && (
            <Button disabled={busy} onClick={loadSchedule}>
              {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} View benefits schedule
            </Button>
          )}
          {step === "confirm" && (
            <Button disabled={busy} onClick={confirmIt}>
              {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Confirm quote
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}