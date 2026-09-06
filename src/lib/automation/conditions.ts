import type { Condition, ConditionGroup, ConditionLeaf } from "./types";

/** Resolve a dotted path ("event.payload.status") against an object. */
export function getPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null) return undefined;
    if (Array.isArray(acc) && /^\d+$/.test(key)) return acc[Number(key)];
    if (typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

/** Replace {{a.b.c}} placeholders in a string using the context. */
export function interpolate(template: string, ctx: unknown): string {
  return template.replace(/\{\{\s*([\w.\-]+)\s*\}\}/g, (_, p) => {
    const v = getPath(ctx, p);
    return v == null ? "" : String(v);
  });
}

/** Deep-resolve placeholders in a data object. A value that is exactly "{{path}}" keeps its native type. */
export function resolveData(data: unknown, ctx: unknown): unknown {
  if (typeof data === "string") {
    const m = data.match(/^\{\{\s*([\w.\-]+)\s*\}\}$/);
    if (m) return getPath(ctx, m[1]);
    return interpolate(data, ctx);
  }
  if (Array.isArray(data)) return data.map((d) => resolveData(d, ctx));
  if (data && typeof data === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) out[k] = resolveData(v, ctx);
    return out;
  }
  return data;
}

function toComparable(v: unknown): number | string | boolean | null {
  if (v == null) return null;
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (v.trim() !== "" && Number.isFinite(n)) return n;
    const d = Date.parse(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(d)) return d;
    return v;
  }
  return JSON.stringify(v);
}

function isGroup(c: Condition): c is ConditionGroup {
  return typeof c === "object" && c !== null && ("and" in c || "or" in c);
}

export function evaluateLeaf(leaf: ConditionLeaf, ctx: unknown): boolean {
  const actual = getPath(ctx, leaf.path);
  const expected = leaf.value;
  switch (leaf.op) {
    case "exists":
      return actual !== undefined && actual !== null && actual !== "";
    case "equals":
      return toComparable(actual) === toComparable(expected) || actual === expected;
    case "not_equals":
      return !(toComparable(actual) === toComparable(expected) || actual === expected);
    case "contains": {
      if (Array.isArray(actual)) return actual.includes(expected as never);
      if (typeof actual === "string") return actual.toLowerCase().includes(String(expected ?? "").toLowerCase());
      return false;
    }
    case "greater_than":
    case "less_than":
    case "greater_than_or_equal":
    case "less_than_or_equal": {
      const a = toComparable(actual);
      const b = toComparable(expected);
      if (a == null || b == null) return false;
      if (leaf.op === "greater_than") return a > b;
      if (leaf.op === "less_than") return a < b;
      if (leaf.op === "greater_than_or_equal") return a >= b;
      return a <= b;
    }
    default:
      return false;
  }
}

/** Evaluate a (possibly nested) condition. An empty/undefined condition is true. */
export function evaluateCondition(cond: Condition | undefined | null, ctx: unknown): boolean {
  if (!cond) return true;
  if (isGroup(cond)) {
    if (cond.and) return cond.and.every((c) => evaluateCondition(c, ctx));
    if (cond.or) return cond.or.some((c) => evaluateCondition(c, ctx));
    return true;
  }
  return evaluateLeaf(cond, ctx);
}
