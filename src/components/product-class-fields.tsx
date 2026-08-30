import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRODUCT_CLASSES, subclassesFor, hasTonnage, isTpoOnly } from "@/lib/product-classes";

type Props = {
  productClass?: string | null;
  subclass?: string | null;
  tonnage?: number | string | null;
  onChange: (patch: { product_class?: string; product_subclass?: string | null; tonnage?: number | null; cover_type?: string }) => void;
};

/** Class + sub-class + tonnage pickers, shared by quotes, policies and vehicle covers. */
export function ProductClassFields({ productClass, subclass, tonnage, onChange }: Props) {
  const subs = subclassesFor(productClass);
  const showTonnage = hasTonnage(productClass, subclass);

  return (
    <>
      <div className="space-y-1.5 min-w-0">
        <Label>Product class</Label>
        <Select
          value={productClass ?? ""}
          onValueChange={(v) => onChange({ product_class: v, product_subclass: null, tonnage: null })}
        >
          <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
          <SelectContent>
            {PRODUCT_CLASSES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {subs.length > 0 && (
        <div className="space-y-1.5 min-w-0">
          <Label>Sub-class</Label>
          <Select
            value={subclass ?? ""}
            onValueChange={(v) => {
              const patch: any = { product_subclass: v };
              if (!hasTonnage(productClass, v)) patch.tonnage = null;
              if (isTpoOnly(productClass, v)) patch.cover_type = "third_party";
              onChange(patch);
            }}
          >
            <SelectTrigger><SelectValue placeholder="Select sub-class" /></SelectTrigger>
            <SelectContent>
              {subs.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {showTonnage && (
        <div className="space-y-1.5 min-w-0">
          <Label>Tonnage (tonnes)</Label>
          <Input
            type="number"
            min={0}
            step="0.1"
            placeholder="e.g. 7"
            value={tonnage ?? ""}
            onChange={(e) => onChange({ tonnage: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </div>
      )}
    </>
  );
}