import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { riskFieldsFor } from "@/lib/product-classes";

type Props = {
  productClass?: string | null;
  details?: Record<string, any> | null;
  onChange: (details: Record<string, any>) => void;
};

/** Class-specific risk questions for non-motor covers. Shared by quotes and policies. */
export function RiskDetailsFields({ productClass, details, onChange }: Props) {
  const fields = riskFieldsFor(productClass);
  if (!fields.length) return null;
  const d = details ?? {};
  const set = (k: string, v: any) => onChange({ ...d, [k]: v });

  return (
    <div className="sm:col-span-2 space-y-3 rounded-md border p-3">
      <p className="text-sm font-medium">Risk details</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map((f) => (
          <div key={f.key} className={`space-y-1.5 min-w-0 ${f.type === "textarea" ? "sm:col-span-2" : ""}`}>
            <Label className="text-xs">{f.label}</Label>
            {f.type === "textarea" ? (
              <Textarea rows={2} value={d[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
            ) : (
              <Input
                type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                placeholder={f.placeholder}
                value={d[f.key] ?? ""}
                onChange={(e) =>
                  set(f.key, f.type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)
                }
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
