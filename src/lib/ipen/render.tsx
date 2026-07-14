import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

export function unwrap(data: any): any {
  if (data == null) return data;
  if (typeof data === "object" && !Array.isArray(data)) {
    if ("data" in data && data.data !== undefined && Object.keys(data).length <= 3) {
      return unwrap(data.data);
    }
    if ("result" in data && data.result !== undefined && Object.keys(data).length <= 3) {
      return unwrap(data.result);
    }
    if ("items" in data && Array.isArray(data.items)) return data.items;
  }
  return data;
}

export function humanize(key: string): string {
  const s = key
    .replace(/[_\-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const DATE_KEY = /(date|_at|At|Date|dob|expiry|start|end)$/i;
const AMOUNT_KEY = /(amount|premium|balance|total|price|sum|paid|due|payable)/i;

export function fmtValue(key: string, v: any): ReactNode {
  if (v == null || v === "") return <span className="text-muted-foreground">—</span>;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return `${v.length} item${v.length === 1 ? "" : "s"}`;
  if (typeof v === "object") {
    const name = v.name ?? v.label ?? v.title ?? v.description;
    if (typeof name === "string") return name;
    return <span className="text-muted-foreground text-xs">{JSON.stringify(v)}</span>;
  }
  if (typeof v === "string" && DATE_KEY.test(key)) {
    const d = new Date(v);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }
  }
  if (typeof v === "number" && AMOUNT_KEY.test(key)) {
    return `KES ${v.toLocaleString()}`;
  }
  if (typeof v === "string" && /^status$|^state$/i.test(key)) {
    return <StatusPill value={v} />;
  }
  const s = String(v);
  if (s.length > 80) return <span title={s}>{s.slice(0, 80)}…</span>;
  return s;
}

export function StatusPill({ value }: { value: string }) {
  const v = value.toLowerCase();
  const variant: "default" | "secondary" | "destructive" | "outline" =
    /active|success|approved|paid|complete/.test(v)
      ? "default"
      : /pend|process/.test(v)
        ? "secondary"
        : /fail|error|reject|cancel/.test(v)
          ? "destructive"
          : "outline";
  return <Badge variant={variant}>{value}</Badge>;
}

const HIDE_KEYS = /^(id|.*Id|guid|uuid|createdBy|updatedBy|tenantId|userId)$/;

function pickColumns(rows: any[]): string[] {
  const counts = new Map<string, number>();
  for (const r of rows.slice(0, 20)) {
    if (r && typeof r === "object" && !Array.isArray(r)) {
      for (const k of Object.keys(r)) {
        if (HIDE_KEYS.test(k)) continue;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k]) => k);
}

export function AutoTable({ rows, columns }: { rows: any[]; columns?: string[] }) {
  if (!rows.length) {
    return <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">No records.</div>;
  }
  const cols = columns?.length ? columns : pickColumns(rows);
  if (!cols.length) {
    // Rows are primitives
    return (
      <div className="overflow-auto rounded-md border">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="px-3 py-2">{String(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div className="overflow-auto rounded-md border max-h-[480px]">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 sticky top-0">
          <tr>
            {cols.map((c) => (
              <th key={c} className="px-3 py-2 text-left font-medium">{humanize(c)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t hover:bg-muted/30">
              {cols.map((c) => (
                <td key={c} className="px-3 py-2 align-top">{fmtValue(c, r?.[c])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KeyValueGrid({ obj, columns = 2 }: { obj: Record<string, any>; columns?: 2 | 3 }) {
  const entries = Object.entries(obj).filter(([k, v]) => !HIDE_KEYS.test(k) && v !== null && v !== undefined && v !== "");
  if (!entries.length) {
    return <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">No details.</div>;
  }
  const gridCls = columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return (
    <div className={`grid gap-x-6 gap-y-3 ${gridCls}`}>
      {entries.map(([k, v]) => (
        <div key={k} className="flex flex-col border-b pb-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{humanize(k)}</span>
          <span className="text-sm mt-0.5">{fmtValue(k, v)}</span>
        </div>
      ))}
    </div>
  );
}

export function SmartRender({ data, emptyLabel = "No data." }: { data: any; emptyLabel?: string }) {
  const d = unwrap(data);
  if (d == null) return <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">{emptyLabel}</div>;
  if (Array.isArray(d)) {
    if (d.length && typeof d[0] === "object" && d[0] !== null) return <AutoTable rows={d} />;
    return <AutoTable rows={d} />;
  }
  if (typeof d === "object") {
    // Split arrays out into their own sub-tables
    const scalars: Record<string, any> = {};
    const arrays: [string, any[]][] = [];
    for (const [k, v] of Object.entries(d)) {
      if (Array.isArray(v)) arrays.push([k, v]);
      else scalars[k] = v;
    }
    return (
      <div className="space-y-6">
        {Object.keys(scalars).length > 0 && <KeyValueGrid obj={scalars} />}
        {arrays.map(([k, v]) => (
          <div key={k} className="space-y-2">
            <h4 className="text-sm font-semibold">{humanize(k)} <span className="text-muted-foreground font-normal">({v.length})</span></h4>
            {v.length ? <AutoTable rows={v} /> : <div className="text-xs text-muted-foreground">Empty.</div>}
          </div>
        ))}
      </div>
    );
  }
  return <div className="text-sm">{String(d)}</div>;
}

export function RawJson({ data }: { data: any }) {
  return (
    <details className="rounded-md border">
      <summary className="cursor-pointer px-3 py-2 text-xs text-muted-foreground">Raw response</summary>
      <pre className="max-h-72 overflow-auto p-3 text-xs">{JSON.stringify(data, null, 2)}</pre>
    </details>
  );
}