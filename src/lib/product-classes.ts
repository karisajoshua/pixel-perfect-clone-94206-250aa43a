export type RatingMode = "motor" | "sum_insured" | "flat" | "per_unit";

export type RiskFieldType = "text" | "number" | "date" | "textarea";

export type RiskField = {
  key: string;
  label: string;
  type?: RiskFieldType;
  placeholder?: string;
  /** Include this value in the generated risk label. */
  inLabel?: boolean;
};

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
  /** "motor" keeps the vehicle picker and the motor premium maths. */
  category?: "motor" | "non_motor";
  /** Group heading in the class picker. */
  group?: string;
  ratingMode?: RatingMode;
  /** Label for the count in per-unit rating (e.g. "Members"). */
  unitLabel?: string;
  /** Whether PHCF + training levy + stamp duty apply. */
  levies?: boolean;
  riskFields?: RiskField[];
};

const MOTOR_CLASSES: ProductClassDef[] = ([
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
] as ProductClassDef[]).map((c) => ({ ...c, category: "motor" as const, group: "Motor", ratingMode: "motor" as const, levies: true }));

const LOCATION: RiskField = { key: "location", label: "Risk location / address", inLabel: true };
const DESCRIPTION: RiskField = { key: "description", label: "Risk description", type: "textarea" };

const NON_MOTOR_CLASSES: ProductClassDef[] = ([
  {
    value: "fire_property",
    label: "Fire & Property",
    group: "Non-Motor",
    ratingMode: "sum_insured",
    riskFields: [LOCATION, { key: "property_type", label: "Property / building type", inLabel: true }, DESCRIPTION],
    subclasses: [
      { value: "fire_domestic", label: "Fire Domestic" },
      { value: "fire_industrial", label: "Fire Industrial & Special Perils" },
      { value: "burglary", label: "Burglary" },
      { value: "all_risks", label: "All Risks" },
      { value: "money", label: "Money" },
      { value: "electronic_equipment", label: "Electronic Equipment" },
      { value: "machinery_breakdown", label: "Machinery Breakdown" },
      { value: "business_combined", label: "Business Combined" },
    ],
  },
  {
    value: "liability",
    label: "Liability",
    group: "Non-Motor",
    ratingMode: "flat",
    riskFields: [
      { key: "business_activity", label: "Business activity", inLabel: true },
      { key: "limit_of_indemnity", label: "Limit of indemnity (KES)", type: "number" },
      DESCRIPTION,
    ],
    subclasses: [
      { value: "public_liability", label: "Public Liability" },
      { value: "product_liability", label: "Product Liability" },
      { value: "professional_indemnity", label: "Professional Indemnity" },
      { value: "directors_officers", label: "Directors & Officers" },
    ],
  },
  {
    value: "accident_health",
    label: "Accident & Health",
    group: "Non-Motor",
    ratingMode: "per_unit",
    unitLabel: "Members / employees",
    riskFields: [
      { key: "scheme_name", label: "Scheme / employer name", inLabel: true },
      { key: "inpatient_limit", label: "Inpatient limit (KES)", type: "number" },
      { key: "outpatient_limit", label: "Outpatient limit (KES)", type: "number" },
      { key: "annual_wage_bill", label: "Annual wage bill (KES) — WIBA", type: "number" },
    ],
    subclasses: [
      { value: "personal_accident", label: "Personal Accident" },
      { value: "group_personal_accident", label: "Group Personal Accident" },
      { value: "wiba", label: "WIBA" },
      { value: "wiba_plus", label: "WIBA Plus" },
      { value: "medical_individual", label: "Medical — Individual" },
      { value: "medical_corporate", label: "Medical — Corporate" },
      { value: "last_expense", label: "Last Expense" },
    ],
  },
  {
    value: "marine_goods",
    label: "Marine & Goods",
    group: "Non-Motor",
    ratingMode: "sum_insured",
    riskFields: [
      { key: "cargo", label: "Cargo / goods description", inLabel: true },
      { key: "voyage_from", label: "From", inLabel: true },
      { key: "voyage_to", label: "To", inLabel: true },
      { key: "conveyance", label: "Conveyance / vessel" },
    ],
    subclasses: [
      { value: "marine_cargo", label: "Marine Cargo" },
      { value: "goods_in_transit", label: "Goods in Transit" },
    ],
  },
  {
    value: "engineering",
    label: "Engineering",
    group: "Non-Motor",
    ratingMode: "sum_insured",
    riskFields: [
      { key: "project_name", label: "Project / plant description", inLabel: true },
      LOCATION,
      { key: "contract_period", label: "Contract period" },
    ],
    subclasses: [
      { value: "contractors_all_risks", label: "Contractors All Risks" },
      { value: "erection_all_risks", label: "Erection All Risks" },
      { value: "plant_machinery", label: "Contractors Plant & Machinery" },
    ],
  },
  {
    value: "bonds",
    label: "Bonds",
    group: "Non-Motor",
    ratingMode: "flat",
    riskFields: [
      { key: "beneficiary", label: "Beneficiary / obligee", inLabel: true },
      { key: "bond_amount", label: "Bond amount (KES)", type: "number" },
      { key: "contract_ref", label: "Contract / tender reference" },
    ],
    subclasses: [
      { value: "performance_bond", label: "Performance Bond" },
      { value: "bid_bond", label: "Bid Bond" },
      { value: "customs_bond", label: "Customs Bond" },
      { value: "immigration_bond", label: "Immigration Bond" },
    ],
  },
  {
    value: "travel",
    label: "Travel",
    group: "Non-Motor",
    ratingMode: "per_unit",
    unitLabel: "Travellers",
    levies: false,
    riskFields: [
      { key: "destination", label: "Destination", inLabel: true },
      { key: "travel_from", label: "Departure date", type: "date" },
      { key: "travel_to", label: "Return date", type: "date" },
    ],
    subclasses: [],
  },
  {
    value: "domestic_package",
    label: "Domestic Package",
    group: "Non-Motor",
    ratingMode: "sum_insured",
    riskFields: [LOCATION, { key: "occupancy", label: "Occupancy (owner / tenant)", inLabel: true }, DESCRIPTION],
    subclasses: [],
  },
  {
    value: "agriculture_nonmotor",
    label: "Agriculture (Crop & Livestock)",
    group: "Non-Motor",
    ratingMode: "sum_insured",
    riskFields: [
      { key: "farm_location", label: "Farm location", inLabel: true },
      { key: "crop_or_livestock", label: "Crop / livestock type", inLabel: true },
      { key: "acreage_or_headcount", label: "Acreage / head count", type: "number" },
    ],
    subclasses: [
      { value: "crop", label: "Crop" },
      { value: "livestock", label: "Livestock" },
    ],
  },
] as ProductClassDef[]).map((c) => ({ category: "non_motor" as const, levies: true, ...c }));

export const PRODUCT_CLASSES: ProductClassDef[] = [...MOTOR_CLASSES, ...NON_MOTOR_CLASSES];

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

/** Motor is the default so legacy rows keep the vehicle-based behaviour. */
export function isMotorClass(cls?: string | null) {
  const def = findClass(cls);
  return def ? def.category !== "non_motor" : true;
}

export function ratingModeFor(cls?: string | null): RatingMode {
  return findClass(cls)?.ratingMode ?? "motor";
}

export function leviesApply(cls?: string | null) {
  const def = findClass(cls);
  return def ? def.levies !== false : true;
}

export function riskFieldsFor(cls?: string | null): RiskField[] {
  return findClass(cls)?.riskFields ?? [];
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

/** Short readable description of the insured risk, built from the class risk fields. */
export function buildRiskLabel(
  cls?: string | null,
  sub?: string | null,
  details?: Record<string, any> | null,
): string {
  const head = findSubclass(cls, sub)?.label ?? findClass(cls)?.label ?? "";
  const parts = riskFieldsFor(cls)
    .filter((f) => f.inLabel)
    .map((f) => details?.[f.key])
    .filter((v) => v !== null && v !== undefined && String(v).trim() !== "")
    .map((v) => String(v).trim());
  if (!parts.length) return head;
  return head ? `${head} — ${parts.join(", ")}` : parts.join(", ");
}

/** What identifies this cover in lists: vehicle registration for motor, risk label otherwise. */
export function coverSubject(row: {
  product_class?: string | null;
  product_subclass?: string | null;
  risk_label?: string | null;
  risk_details?: Record<string, any> | null;
  vehicles?: { registration_no?: string | null } | null;
}): string {
  if (isMotorClass(row.product_class)) return row.vehicles?.registration_no ?? "—";
  return (
    row.risk_label?.trim() ||
    buildRiskLabel(row.product_class, row.product_subclass, row.risk_details) ||
    "—"
  );
}
