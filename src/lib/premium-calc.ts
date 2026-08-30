import { leviesApply, ratingModeFor } from "@/lib/product-classes";

export type PremiumBreakdown = {
  base: number;
  benefits: number;
  pll: number;
  pa: number;
  gross: number;
  levies: number;
  total: number;
};

const round = (n: number) => +(Number.isFinite(n) ? n : 0).toFixed(2);

export function isThirdPartyCover(coverType?: string | null) {
  return coverType === "third_party" || coverType === "third_party_fire_theft";
}

export function benefitRateOf(li: any) {
  const v = li?.benefit_rate_pct;
  return v === undefined || v === null || v === "" ? 0.25 : Number(v);
}

/**
 * Premium maths for every product class.
 * Motor keeps the original behaviour; non-motor classes rate on sum insured,
 * a flat quoted premium, or a per-unit premium.
 */
export function computePremium(args: {
  productClass?: string | null;
  coverType?: string | null;
  sumInsured?: number | string | null;
  lineItems?: any;
}): PremiumBreakdown {
  const li = args.lineItems ?? {};
  const mode = ratingModeFor(args.productClass);
  const sumInsured = Number(args.sumInsured ?? 0) || 0;
  const ratePct = Number(li.rate_pct ?? 0) || 0;

  let base = 0;
  let benefits = 0;
  let pll = 0;
  let pa = 0;
  let leviable = leviesApply(args.productClass);

  if (mode === "motor") {
    const tp = isThirdPartyCover(args.coverType);
    if (tp) {
      base = Number(li.flat_premium ?? 0) || 0;
      leviable = false; // third-party covers carry no levies
    } else {
      const list: string[] = Array.isArray(li.benefits) ? li.benefits : [];
      base = round(sumInsured * (ratePct / 100));
      benefits = round(sumInsured * (benefitRateOf(li) / 100) * list.length);
      pll = li.pll_enabled ? Number(li.pll_amount ?? 0) || 0 : 0;
      pa = li.pa_enabled ? Number(li.pa_amount ?? 0) || 0 : 0;
    }
  } else if (mode === "sum_insured") {
    base = round(sumInsured * (ratePct / 100));
  } else if (mode === "flat") {
    base = Number(li.flat_premium ?? 0) || 0;
  } else if (mode === "per_unit") {
    const units = Number(li.units ?? 0) || 0;
    const perUnit = Number(li.unit_premium ?? 0) || 0;
    base = round(units * perUnit);
  }

  const gross = round(base + benefits + pll + pa);
  const auto = leviable ? round(gross * 0.0045 + 40) : 0;
  const levies =
    li.levies_override === undefined || li.levies_override === null || li.levies_override === ""
      ? auto
      : Number(li.levies_override) || 0;

  return { base, benefits, pll, pa, gross, levies, total: round(gross + levies) };
}
