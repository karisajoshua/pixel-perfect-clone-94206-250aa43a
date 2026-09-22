import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import { listRiskClassCategories, listVehicleMakes, listVehicleModels, listMotorTypes, listCoverOptions, listRiskClasses, listVehicleUses } from "@/lib/ipen/common.functions";
import { generateQuotes, confirmQuote } from "@/lib/ipen/policies.functions";
import { initiateMpesaExpress } from "@/lib/ipen/payments.functions";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: { id: string; email?: string | null; phone?: string | null; full_name?: string | null };
};

function pickList(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (Array.isArray(v?.data)) return v.data;
  if (Array.isArray(v?.items)) return v.items;
  if (Array.isArray(v?.result)) return v.result;
  return [];
}
function idOf(x: any) { return x?.id ?? x?.Id ?? x?.value ?? x?.code ?? ""; }
function nameOf(x: any) { return x?.name ?? x?.Name ?? x?.title ?? x?.description ?? String(idOf(x)); }

export function IpenMotorQuoteWizard({ open, onOpenChange, client }: Props) {
  const [step, setStep] = useState(1);
  const [categoryId, setCategoryId] = useState("");
  const [riskClassId, setRiskClassId] = useState("");
  const [coverOptionId, setCoverOptionId] = useState("");
  const [motorTypeId, setMotorTypeId] = useState("");
  const [makeId, setMakeId] = useState("");
  const [modelId, setModelId] = useState("");
  const [useId, setUseId] = useState("");
  const [reg, setReg] = useState("");
  const [year, setYear] = useState("");
  const [value, setValue] = useState("");
  const [phone, setPhone] = useState(client.phone ?? "");
  const [chassisNumber, setChassisNumber] = useState("");
  const [bodyType, setBodyType] = useState("");
  const [licensedToCarry, setLicensedToCarry] = useState("");
  const [insuredPin, setInsuredPin] = useState("");
  const [quotes, setQuotes] = useState<any[]>([]);
  const [pickedQuote, setPickedQuote] = useState<any>(null);
  const [confirmed, setConfirmed] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const catFn = useServerFn(listRiskClassCategories);
  const rcFn = useServerFn(listRiskClasses);
  const coFn = useServerFn(listCoverOptions);
  const mtFn = useServerFn(listMotorTypes);
  const mkFn = useServerFn(listVehicleMakes);
  const mdFn = useServerFn(listVehicleModels);
  const useFn = useServerFn(listVehicleUses);
  const genFn = useServerFn(generateQuotes);
  const confFn = useServerFn(confirmQuote);
  const stkFn = useServerFn(initiateMpesaExpress);

  const cats = useQuery({ queryKey: ["ipen","cats"], enabled: open, queryFn: () => catFn({ data: {} }) });
  const covers = useQuery({ queryKey: ["ipen","covers"], enabled: open, queryFn: () => coFn({ data: {} }) });
  const types = useQuery({ queryKey: ["ipen","types"], enabled: open, queryFn: () => mtFn({ data: {} }) });
  const makes = useQuery({ queryKey: ["ipen","makes"], enabled: open, queryFn: () => mkFn({ data: {} }) });
  const models = useQuery({ queryKey: ["ipen","models"], enabled: open, queryFn: () => mdFn({ data: {} }) });
  const risks = useQuery({
    queryKey: ["ipen","risks", categoryId], enabled: open && !!categoryId,
    queryFn: () => rcFn({ data: { riskClassCategoryId: categoryId } }),
  });
  const uses = useQuery({
    queryKey: ["ipen","uses", categoryId, coverOptionId], enabled: open && !!coverOptionId,
    queryFn: () => useFn({ data: { productClass: categoryId, coverType: coverOptionId } }),
  });

  const modelList = useMemo(() => pickList(models.data).filter((m: any) => !makeId || String(m.makeId ?? m.MakeId ?? m.vehicleMakeId) === String(makeId)), [models.data, makeId]);

  useEffect(() => { if (!open) { setStep(1); setQuotes([]); setPickedQuote(null); setConfirmed(null); } }, [open]);

  // These DMVIC fields are collected during the motor journey so they are available
  // after payment/policy confirmation; they are not sent to IPEN quote generation.
  const dmvicDetailsComplete = chassisNumber && bodyType && licensedToCarry && insuredPin;
  const canQuote = categoryId && riskClassId && coverOptionId && reg && year && value && dmvicDetailsComplete;

  const doGenerate = async () => {
    setBusy(true);
    try {
      const res = await genFn({ data: {
        riskClassCategoryId: categoryId,
        riskClassId,
        riskClassCoverOptionId: coverOptionId,
        motorTypeId: motorTypeId || undefined,
        vehicleMakeId: makeId || undefined,
        vehicleModelId: modelId || undefined,
        vehicleUseId: useId || undefined,
        registrationNumber: reg,
        yearOfManufacture: year,
        vehicleValue: value,
        phoneNumber: phone || undefined,
        emailAddress: client.email ?? undefined,
      }});
      const list = pickList(res);
      setQuotes(list.length ? list : (res ? [res] : []));
      setStep(3);
    } catch (e: any) { toast.error(e?.message ?? "Could not fetch quotes"); }
    finally { setBusy(false); }
  };

  const doConfirm = async () => {
    if (!pickedQuote) return;
    setBusy(true);
    try {
      const quoteItemId = pickedQuote.id ?? pickedQuote.quoteItemId ?? pickedQuote.Id;
      const commencementDate = new Date().toISOString().slice(0, 10);
      const res = await confFn({ data: { quoteItemId, commencementDate } });
      setConfirmed(res);
      setStep(4);
      toast.success("Quote confirmed");
    } catch (e: any) { toast.error(e?.message ?? "Could not confirm"); }
    finally { setBusy(false); }
  };

  const doPay = async () => {
    const proposalId = confirmed?.proposalId ?? confirmed?.data?.proposalId ?? confirmed?.id;
    const amount = pickedQuote?.premium ?? pickedQuote?.totalPremium ?? pickedQuote?.amount;
    if (!proposalId || !phone || !amount) { toast.error("Missing proposal, phone, or amount"); return; }
    setBusy(true);
    try {
      await stkFn({ data: { proposalId, phoneNumber: phone, amount } });
      toast.success("STK push sent to " + phone);
      onOpenChange(false);
    } catch (e: any) { toast.error(e?.message ?? "STK push failed"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>IPEN motor quote — {client.full_name}</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Risk class category">
              <PickSelect value={categoryId} onChange={setCategoryId} items={pickList(cats.data)} loading={cats.isLoading} />
            </Field>
            <Field label="Risk class">
              <PickSelect value={riskClassId} onChange={setRiskClassId} items={pickList(risks.data)} loading={risks.isFetching} disabled={!categoryId} />
            </Field>
            <Field label="Cover option">
              <PickSelect value={coverOptionId} onChange={setCoverOptionId} items={pickList(covers.data)} loading={covers.isLoading} />
            </Field>
            <Field label="Motor type">
              <PickSelect value={motorTypeId} onChange={setMotorTypeId} items={pickList(types.data)} loading={types.isLoading} />
            </Field>
            <Field label="Vehicle use">
              <PickSelect value={useId} onChange={setUseId} items={pickList(uses.data)} loading={uses.isFetching} disabled={!coverOptionId} />
            </Field>
            <div />
            <Field label="Make">
              <PickSelect value={makeId} onChange={(v) => { setMakeId(v); setModelId(""); }} items={pickList(makes.data)} loading={makes.isLoading} />
            </Field>
            <Field label="Model">
              <PickSelect value={modelId} onChange={setModelId} items={modelList} disabled={!makeId} />
            </Field>
            <Field label="Registration"><Input value={reg} onChange={(e) => setReg(e.target.value)} placeholder="KAA 123A" /></Field>
            <Field label="Year"><Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2020" inputMode="numeric" /></Field>
            <Field label="Value (KES)"><Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="1500000" inputMode="numeric" /></Field>
            <Field label="Phone (M-Pesa)"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="2547XXXXXXXX" /></Field>
            <Field label="Chassis number"><Input value={chassisNumber} onChange={(e) => setChassisNumber(e.target.value.toUpperCase())} placeholder="Vehicle chassis / VIN" /></Field>
            <Field label="Body type"><Input value={bodyType} onChange={(e) => setBodyType(e.target.value)} placeholder="e.g. Saloon" /></Field>
            <Field label="Licensed to carry"><Input value={licensedToCarry} onChange={(e) => setLicensedToCarry(e.target.value)} placeholder="e.g. 5" inputMode="numeric" /></Field>
            <Field label="Insured KRA PIN"><Input value={insuredPin} onChange={(e) => setInsuredPin(e.target.value.toUpperCase())} placeholder="Policyholder KRA PIN" /></Field>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2">
            {quotes.length === 0 && <div className="text-sm text-muted-foreground">No quotes returned.</div>}
            {quotes.map((q, i) => {
              const key = q.id ?? q.quoteItemId ?? i;
              const isPicked = pickedQuote && (pickedQuote.id ?? pickedQuote.quoteItemId) === (q.id ?? q.quoteItemId);
              return (
                <button key={key} type="button" onClick={() => setPickedQuote(q)}
                  className={`w-full text-left rounded-md border p-3 hover:bg-muted/40 ${isPicked ? "border-primary ring-1 ring-primary" : ""}`}>
                  <div className="flex justify-between text-sm">
                    <div className="font-medium">{q.insurerName ?? q.insurer ?? q.productName ?? "Product"}</div>
                    <div className="font-mono">KES {Number(q.premium ?? q.totalPremium ?? q.amount ?? 0).toLocaleString()}</div>
                  </div>
                  {q.productName && q.insurerName && <div className="text-xs text-muted-foreground">{q.productName}</div>}
                </button>
              );
            })}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-2 text-sm">
            <div>Proposal reference: <span className="font-mono">{confirmed?.proposalId ?? confirmed?.data?.proposalId ?? confirmed?.id ?? "—"}</span></div>
            <div>Amount: <span className="font-mono">KES {Number(pickedQuote?.premium ?? pickedQuote?.totalPremium ?? 0).toLocaleString()}</span></div>
            <div>M-Pesa phone: <span className="font-mono">{phone || "—"}</span></div>
            <p className="text-muted-foreground">Send the STK push now; the client will be prompted on their phone.</p>
          </div>
        )}

        <DialogFooter>
          {step === 1 && <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={!canQuote || busy} onClick={doGenerate}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Get quotes</Button>
          </>}
          {step === 3 && <>
            <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
            <Button disabled={!pickedQuote || busy} onClick={doConfirm}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Confirm quote</Button>
          </>}
          {step === 4 && <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
            <Button disabled={busy} onClick={doPay}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Send STK push</Button>
          </>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}

function PickSelect({ value, onChange, items, loading, disabled }: { value: string; onChange: (v: string) => void; items: any[]; loading?: boolean; disabled?: boolean }) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || loading}>
      <SelectTrigger><SelectValue placeholder={loading ? "Loading…" : "Select"} /></SelectTrigger>
      <SelectContent>
        {items.map((it: any) => {
          const id = String(idOf(it));
          if (!id) return null;
          return <SelectItem key={id} value={id}>{nameOf(it)}</SelectItem>;
        })}
      </SelectContent>
    </Select>
  );
}