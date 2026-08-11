export type ProductSubclass = {
  value: string;
  label: string;
  tonnage?: boolean;
  tpoOnly?: boolean;
};

export type ProductClassDef = {
  value: string;
  label: string;
  subclasses: ProductSubclass[];
};

export const PRODUCT_CLASSES: ProductClassDef[] = [
  { value: "motor_private", label: "Motor Private", subclasses: [] },
  {
    value: "motor_commercial",
    label: "Motor Commercial",
    subclasses: [
      { value: "own_goods", label: "Own Goods", tonnage: true },
      { value: "general_cartage", label: "General Cartage", tonnage: true },
      { value: "prime_movers", label: "Prime Movers" },
      { value: "institutional", label: "Institutional Vehicles" },
      { value: "commercial_tuk_tuk", label: "Commercial Tuk Tuk" },
      { value: "tankers_liquid", label: "Tankers — Liquid Carrying" },
      { value: "driving_school", label: "Driving School" },
      { value: "hearse", label: "Hearse" },
      { value: "ambulance", label: "Ambulance" },
      { value: "agriculture", label: "Agriculture" },
    ],
  },
  { value: "private_motorcycle", label: "Private Motorcycle", subclasses: [] },
  {
    value: "psv",
    label: "PSV",
    subclasses: [
      { value: "motorcycle_psv", label: "Motorcycle PSV (Bodaboda)" },
      { value: "tuk_tuk_tpo", label: "Motor Tuk Tuk — Third Party Only", tpoOnly: true },
      { value: "tsv", label: "Tourist Service Vehicle (TSV)" },
      { value: "psv_chauffeur", label: "Motor PSV (Chauffeur driven) — Private hire" },
      { value: "psv_matatu", label: "Motor PSV (Matatu)" },
      { value: "psv_unmarked", label: "Motor PSV Unmarked (Online)" },
      { value: "psv_yellow_line", label: "Motor PSV Yellow-Line — TPO", tpoOnly: true },
    ],
  },
];

// Legacy values still present on older records.
const LEGACY_CLASS_LABELS: Record<string, string> = {
  motor: "Motor Private",
  fire: "Fire",
  medical: "Medical",
  travel: "Travel",
  life: "Life",
  other: "Other",
};

export function findClass(value?: string | null) {
  return PRODUCT_CLASSES.find((c) => c.value === value);
}

export function subclassesFor(value?: string | null): ProductSubclass[] {
  return findClass(value)?.subclasses ?? [];
}

export function findSubclass(cls?: string | null, sub?: string | null) {
  return subclassesFor(cls).find((s) => s.value === sub);
}

export function hasTonnage(cls?: string | null, sub?: string | null) {
  return !!findSubclass(cls, sub)?.tonnage;
}

export function isTpoOnly(cls?: string | null, sub?: string | null) {
  return !!findSubclass(cls, sub)?.tpoOnly;
}

function titleize(v: string) {
  return v.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export function productClassLabel(
  cls?: string | null,
  sub?: string | null,
  tonnage?: number | string | null,
): string {
  if (!cls) return "—";
  const base = findClass(cls)?.label ?? LEGACY_CLASS_LABELS[cls] ?? titleize(cls);
  const subDef = findSubclass(cls, sub);
  if (!subDef) return base;
  const t = tonnage === null || tonnage === undefined || tonnage === "" ? null : Number(tonnage);
  const tSuffix = t && !Number.isNaN(t) ? ` (${t}t)` : "";
  return `${base} — ${subDef.label}${tSuffix}`;
}