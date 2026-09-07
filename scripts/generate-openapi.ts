/**
 * Generates an OpenAPI 3.1 document describing the whole application API:
 *  - every server function (typed RPC) exported from src/lib/**\/*.functions.ts
 *  - every HTTP route under src/routes/api/**
 *  - every public database table, as reusable component schemas
 *
 * Run:  bun run scripts/generate-openapi.ts
 * Output: public/openapi.json  (served at /openapi.json and /api/public/openapi.json)
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const OUT = join(ROOT, "public", "openapi.json");

const SERVER_BASE = "https://app.zestinsurance.co.ke";

// ---------- helpers ----------

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function titleCase(s: string) {
  return s.replace(/[-_/]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanize(name: string) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

/** TanStack Start RPC path for a server function export. */
function serverFnPath(fileRel: string, exportName: string) {
  const payload = JSON.stringify({
    file: `/${fileRel}?tss-serverFn-split`,
    export: `${exportName}_createServerFn_handler`,
  });
  const b64 = Buffer.from(payload, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `/_serverFn/${b64}`;
}

// ---------- zod validator → JSON schema (best effort) ----------

const ZOD_PRIMITIVES: Record<string, any> = {
  string: { type: "string" },
  number: { type: "number" },
  boolean: { type: "boolean" },
  date: { type: "string", format: "date-time" },
  any: {},
  unknown: {},
  record: { type: "object", additionalProperties: true },
  array: { type: "array", items: {} },
  object: { type: "object", additionalProperties: true },
};

/** OpenAPI 3.1 nullability: a type union, not the 3.0 `nullable` keyword. */
function nullableOf(schema: any): any {
  if (!schema || typeof schema.type !== "string") return { anyOf: [schema ?? {}, { type: "null" }] };
  return { ...schema, type: [schema.type, "null"] };
}

function zodFieldSchema(expr: string): any {
  const base = /z\.(\w+)\(/.exec(expr)?.[1] ?? "any";
  let schema: any = { ...(ZOD_PRIMITIVES[base] ?? {}) };
  if (base === "enum") {
    const values = /z\.enum\(\[([^\]]*)\]/.exec(expr)?.[1] ?? "";
    schema = {
      type: "string",
      enum: values.split(",").map((v) => v.trim().replace(/^["']|["']$/g, "")).filter(Boolean),
    };
  }
  if (base === "literal") {
    const v = /z\.literal\((["'])(.*?)\1/.exec(expr)?.[2];
    schema = { type: "string", enum: v ? [v] : [] };
  }
  if (/\.uuid\(/.test(expr)) schema.format = "uuid";
  if (/\.email\(/.test(expr)) schema.format = "email";
  if (/\.int\(/.test(expr)) schema.type = "integer";
  if (/\.array\(\)|z\.array\(/.test(expr) && schema.type !== "array") schema = { type: "array", items: schema };
  if (/\.nullable\(\)/.test(expr)) schema = nullableOf(schema);
  return schema;
}

/** Split a z.object({ ... }) body into top-level `key: expr` pairs. */
function splitTopLevel(body: string): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  let depth = 0;
  let current = "";
  for (const ch of body) {
    if ("([{".includes(ch)) depth++;
    if (")]}".includes(ch)) depth--;
    if (ch === "," && depth === 0) {
      pairs.push(current as any);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) pairs.push(current as any);
  return (pairs as unknown as string[])
    .map((chunk) => {
      const m = /^\s*([A-Za-z0-9_"']+)\s*:\s*([\s\S]+)$/.exec(chunk);
      if (!m) return null;
      return [m[1].replace(/["']/g, ""), m[2]] as [string, string];
    })
    .filter(Boolean) as Array<[string, string]>;
}

function matchBalanced(src: string, startIndex: number, open = "{", close = "}") {
  let depth = 0;
  for (let i = startIndex; i < src.length; i++) {
    if (src[i] === open) depth++;
    else if (src[i] === close) {
      depth--;
      if (depth === 0) return src.slice(startIndex + 1, i);
    }
  }
  return "";
}

function inputSchemaFrom(block: string): any | null {
  const idx = block.indexOf("inputValidator");
  if (idx === -1) return null;
  const scope = block.slice(idx, idx + 2500);
  const objIdx = scope.indexOf("z.object(");
  if (objIdx === -1) return { type: "object", additionalProperties: true };
  const braceStart = scope.indexOf("{", objIdx);
  if (braceStart === -1) return { type: "object", additionalProperties: true };
  const body = matchBalanced(scope, braceStart);
  const properties: Record<string, any> = {};
  const required: string[] = [];
  for (const [key, expr] of splitTopLevel(body)) {
    properties[key] = zodFieldSchema(expr);
    if (!/\.optional\(\)|\.default\(/.test(expr)) required.push(key);
  }
  if (Object.keys(properties).length === 0) return { type: "object", additionalProperties: true };
  return { type: "object", properties, ...(required.length ? { required } : {}), additionalProperties: false };
}

// ---------- 1. server functions ----------

type Operation = {
  path: string;
  method: string;
  tag: string;
  operationId: string;
  summary: string;
  description: string;
  requestSchema: any | null;
  authenticated: boolean;
  security?: any[];
};

const MODULE_TAGS: Record<string, string> = {
  "clients": "Clients",
  "vehicles": "Vehicles & risk items",
  "dashboard": "Dashboard & metrics",
  "reports": "Reports",
  "renewal-alerts": "Renewals",
  "portal": "Client portal",
  "service-requests": "Service requests",
  "kyc": "KYC & documents",
  "kra": "KRA PIN checker",
  "sessions": "Sessions & security",
  "tenants": "Agency (tenant) settings",
  "tour": "Product tour",
  "admin-users": "Staff & roles",
  "platform": "Platform (super admin)",
  "automation/workflows": "Automation engine",
  "api/example": "Examples",
  "ipen/auth": "IPEN — authentication",
  "ipen/policies": "IPEN — policies",
  "ipen/claims": "IPEN — claims",
  "ipen/payments": "IPEN — payments (M-Pesa)",
  "ipen/documents": "IPEN — documents",
  "ipen/common": "IPEN — reference data",
  "ipen/profile": "IPEN — profile",
  "ipen/portal": "IPEN — portal",
  "ipen/ocr": "IPEN — OCR",
  "ipen/assistant": "IPEN — assistant",
};

function tagForFile(rel: string) {
  const key = rel.replace(/^src\/lib\//, "").replace(/\.functions\.ts$/, "");
  return MODULE_TAGS[key] ?? titleCase(key);
}

function collectServerFunctions(): Operation[] {
  const ops: Operation[] = [];
  const files = walk(join(ROOT, "src", "lib")).filter((f) => f.endsWith(".functions.ts"));
  for (const file of files.sort()) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    const src = readFileSync(file, "utf8");
    const re = /(?:\/\*\*((?:(?!\*\/)[\s\S])*?)\*\/\s*)?export const (\w+) = createServerFn\(\s*\{([^}]*)\}\s*\)/g;
    let m: RegExpExecArray | null;
    const marks: Array<{ name: string; method: string; doc: string; start: number }> = [];
    while ((m = re.exec(src))) {
      marks.push({
        name: m[2],
        method: (/method:\s*["'](\w+)["']/.exec(m[3])?.[1] ?? "POST").toUpperCase(),
        doc: (m[1] ?? "")
          .split("\n")
          .map((l) => l.replace(/^\s*\*ted?\s?/, "").replace(/^\s*\*\s?/, "").trim())
          .filter((l) => l && !l.startsWith("@"))
          .join(" ")
          .trim(),
        start: m.index,
      });
    }
    marks.forEach((mark, i) => {
      const block = src.slice(mark.start, marks[i + 1]?.start ?? src.length);
      const authenticated = /requireSupabaseAuth/.test(block);
      ops.push({
        path: serverFnPath(rel, mark.name),
        // TanStack serialises GET server-fn input in the query string; everything
        // else posts a JSON body. Both are documented as POST-with-body for clarity
        // when the function declares POST.
        method: mark.method === "GET" ? "get" : "post",
        tag: tagForFile(rel),
        operationId: mark.name,
        summary: humanize(mark.name),
        description:
          (mark.doc ? mark.doc + "\n\n" : "") +
          `Server function \`${mark.name}\` exported from \`${rel}\`.\n\n` +
          (authenticated
            ? "Requires a signed-in user: send the Supabase access token as `Authorization: Bearer <token>`. Row-level security applies as that user."
            : "No authentication middleware. Access is still limited by row-level security for any data it reads on behalf of the caller."),
        requestSchema: inputSchemaFrom(block),
        authenticated,
      });
    });
  }
  return ops;
}

// ---------- 2. HTTP routes ----------

function collectHttpRoutes(): Operation[] {
  const ops: Operation[] = [];
  const apiDir = join(ROOT, "src", "routes", "api");
  const files = walk(apiDir).filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));
  for (const file of files.sort()) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    const src = readFileSync(file, "utf8");
    const routePath = /createFileRoute\(\s*["']([^"']+)["']/.exec(src)?.[1];
    if (!routePath) continue;
    const methods = new Set<string>();
    for (const m of src.matchAll(/^\s*(GET|POST|PUT|PATCH|DELETE|OPTIONS)\s*:/gm)) methods.add(m[1].toLowerCase());
    if (methods.size === 0) continue;
    const secretHeader = /headers\.get\(\s*["'](x-[\w-]+)["']/.exec(src)?.[1];
    const isPublic = routePath.startsWith("/api/public/");
    for (const method of methods) {
      if (method === "options") continue;
      ops.push({
        path: routePath,
        method,
        tag: isPublic ? "Public HTTP endpoints" : "Internal HTTP endpoints",
        operationId: `${method}_${routePath.replace(/[^\w]+/g, "_").replace(/^_|_$/g, "")}`,
        summary: titleCase(routePath.split("/").slice(-1)[0]),
        description:
          `Defined in \`${rel}\`.` +
          (secretHeader
            ? `\n\nAuthenticated with the shared-secret header \`${secretHeader}\`. Requests without the correct value receive \`403 Forbidden\`.`
            : isPublic
              ? "\n\nPublic endpoint — verify the caller inside the handler."
              : "\n\nRequires a signed-in session."),
        requestSchema:
          method === "get" ? null : { type: "object", additionalProperties: true },
        authenticated: false,
        security: secretHeader ? [{ [`${secretHeader}`]: [] }] : [],
      });
    }
  }
  return ops;
}

// ---------- 3. database tables → component schemas ----------

const TS_TO_SCHEMA: Record<string, any> = {
  string: { type: "string" },
  number: { type: "number" },
  boolean: { type: "boolean" },
  Json: {},
};

function collectTableSchemas(): Record<string, any> {
  const src = readFileSync(join(ROOT, "src", "integrations", "supabase", "types.ts"), "utf8");
  const tablesIdx = src.indexOf("Tables: {");
  const body = matchBalanced(src, src.indexOf("{", tablesIdx));
  const schemas: Record<string, any> = {};
  const re = /^ {6}(\w+): \{\n {8}Row: \{\n([\s\S]*?)\n {8}\}/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const table = m[1];
    const properties: Record<string, any> = {};
    const required: string[] = [];
    for (const line of m[2].split("\n")) {
      const f = /^\s*(\w+):\s*(.+?)\s*$/.exec(line);
      if (!f) continue;
      const [, col, type] = f;
      const nullable = /\| null$/.test(type);
      const bare = type.replace(/\s*\|\s*null$/, "").replace(/\[\]$/, "");
      let schema: any = TS_TO_SCHEMA[bare] ? { ...TS_TO_SCHEMA[bare] } : { type: "string" };
      if (/\[\]$/.test(type.replace(/\s*\|\s*null$/, ""))) schema = { type: "array", items: schema };
      if (nullable) schema = nullableOf(schema);
      else required.push(col);
      const isText = schema.type === "string" || (Array.isArray(schema.type) && schema.type.includes("string"));
      if (/(^|_)id$/.test(col) && isText) schema.format = "uuid";
      if (/_at$/.test(col) && isText) schema.format = "date-time";
      if (/_date$/.test(col) && isText) schema.format = "date";
      properties[col] = schema;
    }
    if (Object.keys(properties).length)
      schemas[titleCase(table).replace(/\s/g, "")] = {
        type: "object",
        title: titleCase(table),
        description: `Row shape of the \`public.${table}\` table. Reachable through the data API with row-level security applied to the signed-in user.`,
        properties,
        required,
      };
  }
  return schemas;
}

// ---------- assemble ----------

const serverFns = collectServerFunctions();
const httpRoutes = collectHttpRoutes();
const schemas = collectTableSchemas();

const paths: Record<string, any> = {};
for (const op of [...serverFns, ...httpRoutes]) {
  paths[op.path] ??= {};
  paths[op.path][op.method] = {
    tags: [op.tag],
    operationId: op.operationId,
    summary: op.summary,
    description: op.description,
    ...(op.security !== undefined ? { security: op.security } : op.authenticated ? { security: [{ bearerAuth: [] }] } : { security: [] }),
    ...(op.requestSchema
      ? {
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: op.path.startsWith("/_serverFn/")
                  ? { type: "object", properties: { data: op.requestSchema }, required: ["data"] }
                  : op.requestSchema,
              },
            },
          },
        }
      : {}),
    responses: {
      "200": { description: "Success", content: { "application/json": { schema: { type: "object", additionalProperties: true } } } },
      "401": { description: "Not signed in or missing credentials" },
      "403": { description: "Not allowed for this user, role or agency" },
      "500": { description: "Unexpected error" },
    },
  };
}

const tagNames = Array.from(new Set([...serverFns, ...httpRoutes].map((o) => o.tag))).sort();

const doc = {
  openapi: "3.1.0",
  info: {
    title: "Zest Insurance Agency Management API",
    version: "1.0.0",
    description: [
      "Complete API surface of the insurance agency management platform: clients, vehicles and other risk items, quotations, policies and installment chains, invoices, payments and receipts, claims, renewals, KYC, the client portal, staff and roles, agency (tenant) settings, the automation engine, the platform super-admin console and the AfricaBima/IPEN integration.",
      "",
      "## How the API is shaped",
      "",
      "Two kinds of endpoints exist:",
      "",
      "1. **Server functions** — typed remote procedure calls used by the web app. Each one is a single URL under `/_serverFn/...` that accepts `{ \"data\": { ... } }` as its JSON body and returns JSON. The URL is generated from the source file and export name and is stable for a given release.",
      "2. **HTTP endpoints** — conventional REST-style routes under `/api/...`, used by external callers such as scheduled jobs, the M-Pesa callback and the in-app assistant.",
      "",
      "## Authentication",
      "",
      "* User-facing calls send `Authorization: Bearer <access token>` from the signed-in session. Every query is additionally filtered by row-level security, so a caller only ever sees their own agency's data.",
      "* Machine endpoints (`/api/public/*`) use a shared-secret request header, documented per endpoint.",
      "",
      "## Multi-agency isolation",
      "",
      "Every record carries an agency identifier and database policies enforce that one agency can never read or change another agency's data.",
      "",
      "## Data model",
      "",
      "The `components.schemas` section documents every table in the database, including columns, types and nullability.",
    ].join("\n"),
    contact: { name: "Zest Insurance Agency", url: SERVER_BASE },
  },
  servers: [
    { url: SERVER_BASE, description: "Production" },
    { url: "https://pixel-perfect-clone-94206.lovable.app", description: "Published app" },
  ],
  tags: tagNames.map((name) => ({ name })),
  paths,
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Access token of the signed-in user.",
      },
      "x-automation-secret": { type: "apiKey", in: "header", name: "x-automation-secret", description: "Shared secret for the automation scheduler tick." },
      "x-hook-secret": { type: "apiKey", in: "header", name: "x-hook-secret", description: "Shared secret for the daily renewal reminder job." },
      "x-ipen-callback-secret": { type: "apiKey", in: "header", name: "x-ipen-callback-secret", description: "Shared secret for AfricaBima/IPEN payment callbacks." },
    },
    schemas,
  },
};

mkdirSync(join(ROOT, "public"), { recursive: true });
writeFileSync(OUT, JSON.stringify(doc, null, 2));
console.log(
  `openapi.json written: ${serverFns.length} server functions, ${httpRoutes.length} HTTP operations, ${Object.keys(schemas).length} data schemas, ${tagNames.length} modules.`,
);
